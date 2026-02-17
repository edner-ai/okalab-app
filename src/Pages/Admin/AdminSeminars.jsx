import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";
import { Card, CardContent } from "../../Components/ui/card";

import { Search, SlidersHorizontal, Plus, Loader2 } from "lucide-react";
import { useLanguage } from "../../Components/shared/LanguageContext";

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

export default function AdminSeminars() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: seminars = [], isLoading } = useQuery({
    queryKey: ["admin-seminars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select("id, title, description, category, start_date, end_date, total_hours, status, professor_email")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return seminars;
    return seminars.filter((s) => {
      const haystack = [
        s.title || "",
        s.description || "",
        s.category || "",
        s.professor_email || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [seminars, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("admin_seminar", "Seminar")}</h1>
          <p className="text-slate-500 text-sm">{t("admin_seminar_subtitle", "Manage seminars data")}</p>
        </div>

        <Link to="/createseminar">
          <Button className="bg-slate-900 hover:bg-slate-800 gap-2">
            <Plus className="h-4 w-4" />
            {t("common_add", "Add")}
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("admin_search_seminars", "Search by title, description, professor")}
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
              {t("admin_loading_seminars", "Loading seminars...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-10 text-center">
              {t("common_no_results", "No results")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common_title", "Title")}</TableHead>
                  <TableHead>{t("common_description", "Description")}</TableHead>
                  <TableHead>{t("common_category", "Category")}</TableHead>
                  <TableHead>{t("common_start", "Start")}</TableHead>
                  <TableHead>{t("common_end", "End")}</TableHead>
                  <TableHead>{t("common_hours", "Hours")}</TableHead>
                  <TableHead>{t("common_status", "Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium truncate max-w-[220px]">
                      {s.title || "-"}
                    </TableCell>
                    <TableCell className="truncate max-w-[240px]">
                      {s.description || "-"}
                    </TableCell>
                    <TableCell>{s.category || "-"}</TableCell>
                    <TableCell>{fmtDate(s.start_date)}</TableCell>
                    <TableCell>{fmtDate(s.end_date)}</TableCell>
                    <TableCell>{s.total_hours ?? "-"}</TableCell>
                    <TableCell>{s.status || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
