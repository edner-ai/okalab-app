import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { Input } from "../../Components/ui/input";
import { Button } from "../../Components/ui/button";
import { Card, CardContent } from "../../Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";

import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { useLanguage } from "../../Components/shared/LanguageContext";

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function AdminWallets() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter((w) =>
      (w.user_email || "").toLowerCase().includes(q)
    );
  }, [wallets, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("admin_wallet", "Wallet")}</h1>
        <p className="text-slate-500 text-sm">{t("admin_wallet_subtitle", "Manage user wallets")}</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("admin_search_wallets", "Search by user_email")}
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
              {t("admin_loading_wallets", "Loading wallets...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-10 text-center">
              {t("common_no_results", "No results")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_user_email", "User Email")}</TableHead>
                  <TableHead>{t("admin_user_type", "User Type")}</TableHead>
                  <TableHead>{t("wallet_balance", "Balance")}</TableHead>
                  <TableHead>{t("wallet_pending", "Pending")}</TableHead>
                  <TableHead>{t("wallet_total_earned", "Total Earned")}</TableHead>
                  <TableHead>{t("wallet_total_withdrawn", "Total Withdrawn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => (
                  <TableRow key={w.id || w.user_email}>
                    <TableCell className="truncate max-w-[220px]">
                      {w.user_email || "-"}
                    </TableCell>
                    <TableCell>{w.user_type || "-"}</TableCell>
                    <TableCell>{money(w.balance)}</TableCell>
                    <TableCell>{money(w.pending_balance)}</TableCell>
                    <TableCell>{money(w.total_earned)}</TableCell>
                    <TableCell>{money(w.total_withdrawn)}</TableCell>
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
