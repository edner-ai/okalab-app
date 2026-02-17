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

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function AdminTransactions() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const haystack = [
        t.wallet_id || "",
        t.user_email || "",
        t.type || "",
        t.seminar_id || "",
        t.description || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [transactions, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("admin_transactions", "Transacciones")}</h1>
        <p className="text-slate-500 text-sm">{t("admin_transactions_subtitle", "Todas las transacciones de billetera")}</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("admin_transactions_search", "Buscar por wallet_id, user_email, type...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("common_filters", "Filtros")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("admin_loading_transactions", "Cargando transacciones...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-10 text-center">
              {t("common_no_results", "Sin resultados")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_wallet_id", "Wallet ID")}</TableHead>
                  <TableHead>{t("admin_user_email", "User Email")}</TableHead>
                  <TableHead>{t("admin_type", "Tipo")}</TableHead>
                  <TableHead>{t("admin_amount", "Monto")}</TableHead>
                  <TableHead>{t("admin_seminar_id", "Seminar ID")}</TableHead>
                  <TableHead>{t("admin_description", "Descripción")}</TableHead>
                  <TableHead>{t("admin_created", "Creado")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="truncate max-w-[160px]">
                      {t.wallet_id || "-"}
                    </TableCell>
                    <TableCell className="truncate max-w-[200px]">
                      {t.user_email || "-"}
                    </TableCell>
                    <TableCell>{t.type || "-"}</TableCell>
                    <TableCell>{money(t.amount)}</TableCell>
                    <TableCell className="truncate max-w-[160px]">
                      {t.seminar_id || "-"}
                    </TableCell>
                    <TableCell className="truncate max-w-[220px]">
                      {t.description || "-"}
                    </TableCell>
                    <TableCell>{fmtDate(t.created_at)}</TableCell>
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
