import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";
import { Card, CardContent } from "../../Components/ui/card";
import { Badge } from "../../Components/ui/badge";

import { Search, SlidersHorizontal, Loader2, ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../Components/shared/LanguageContext";

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function AdminEnrollments() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) => {
      const haystack = [
        e.seminar_id || "",
        e.student_email || "",
        e.invited_by_email || "",
        e.status || "",
        e.payment_status || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [enrollments, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("admin_enrollment", "Enrollment")}</h1>
          <p className="text-slate-500 text-sm">{t("admin_enrollment_subtitle", "Manage enrollments")}</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("admin_search_enrollments", "Search by seminar_id, student email...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("common_filters", "Filters")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("admin_loading_enrollments", "Loading enrollments...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-10 text-center">
              {t("common_no_results", "No results")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_seminar_id", "Seminar ID")}</TableHead>
                  <TableHead>{t("admin_student_email", "Student Email")}</TableHead>
                  <TableHead>{t("common_status", "Status")}</TableHead>
                  <TableHead>{t("admin_payment_status", "Payment")}</TableHead>
                  <TableHead>{t("common_amount", "Amount")}</TableHead>
                  <TableHead>{t("admin_referred_by", "Referred By")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const paymentStatus = (e.payment_status || "").toLowerCase();
                  const needsReview =
                    paymentStatus === "pending" ||
                    paymentStatus === "pending_payment";

                  return (
                    <TableRow key={e.id}>
                      <TableCell className="truncate max-w-[160px]">
                        {e.seminar_id}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px]">
                        {e.student_email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.status || "-"}</Badge>
                      </TableCell>
                      <TableCell>{paymentStatus || "-"}</TableCell>
                      <TableCell>
                        {money(e.final_price ?? e.amount_paid ?? 0)}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px]">
                        {e.invited_by_email || "-"}
                      </TableCell>
                      <TableCell>
                        {needsReview ? (
                          <Link
                            to={`/process-payment?enrollment_id=${e.id}&mode=admin`}
                          >
                            <Button size="sm" variant="outline" className="gap-1">
                              {t("common_review", "Review")}
                              <ArrowUpRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
