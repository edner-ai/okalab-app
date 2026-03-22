import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { Input } from "../../Components/ui/input";
import { Button } from "../../Components/ui/button";
import { Card, CardContent } from "../../Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../Components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../Components/ui/select";

import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { useLanguage } from "../../Components/shared/LanguageContext";

const PLATFORM_WALLET_FALLBACK = "platform@okalab.local";

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getEarningOrigin(transaction) {
  const description = String(transaction?.description || "").toLowerCase();
  if (
    description.includes("excedente sin referido") ||
    description.includes("bono perdido") ||
    description.includes("participacion plataforma")
  ) {
    return "unassigned";
  }
  return "base_fee";
}

export default function AdminEarnings() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [seminarFilter, setSeminarFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [seminarStatusFilter, setSeminarStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-platform-earnings"],
    queryFn: async () => {
      const { data: platformWallet } = await supabase
        .from("wallets")
        .select("user_email")
        .eq("user_type", "platform")
        .limit(1)
        .maybeSingle();

      const platformEmail = platformWallet?.user_email || PLATFORM_WALLET_FALLBACK;

      const { data: transactions, error: txError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_email", platformEmail)
        .eq("type", "platform_fee")
        .gt("amount", 0)
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      const seminarIds = [...new Set((transactions || []).map((tx) => tx.seminar_id).filter(Boolean))];

      let seminars = [];
      if (seminarIds.length > 0) {
        const { data: seminarRows, error: seminarError } = await supabase
          .from("seminars")
          .select("id, title, professor_email, status, start_date")
          .in("id", seminarIds);
        if (seminarError) throw seminarError;
        seminars = seminarRows || [];
      }

      return {
        platformEmail,
        transactions: transactions || [],
        seminars,
      };
    },
  });

  const seminarsById = useMemo(
    () => new Map((data?.seminars || []).map((seminar) => [seminar.id, seminar])),
    [data?.seminars]
  );

  const rows = useMemo(() => {
    return (data?.transactions || []).map((transaction) => {
      const seminar = seminarsById.get(transaction.seminar_id);
      return {
        ...transaction,
        origin: getEarningOrigin(transaction),
        seminarTitle: seminar?.title || "-",
        seminarStatus: seminar?.status || "unknown",
        professorEmail: seminar?.professor_email || "-",
        seminarStartDate: seminar?.start_date || null,
      };
    });
  }, [data?.transactions, seminarsById]);

  const seminarOptions = useMemo(() => {
    return [...new Map(rows.filter((row) => row.seminar_id).map((row) => [row.seminar_id, row])).values()].sort(
      (a, b) => String(a.seminarTitle || "").localeCompare(String(b.seminarTitle || ""))
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return rows.filter((row) => {
      if (seminarFilter !== "all" && row.seminar_id !== seminarFilter) return false;
      if (originFilter !== "all" && row.origin !== originFilter) return false;
      if (seminarStatusFilter !== "all" && row.seminarStatus !== seminarStatusFilter) return false;

      const createdAtMs = new Date(row.created_at).getTime();
      if (fromTime && createdAtMs < fromTime) return false;
      if (toTime && createdAtMs > toTime) return false;

      if (!q) return true;
      const haystack = [
        row.user_email || "",
        row.seminarTitle || "",
        row.professorEmail || "",
        row.seminar_id || "",
        row.description || "",
        row.origin || "",
        row.seminarStatus || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [dateFrom, dateTo, originFilter, rows, search, seminarFilter, seminarStatusFilter]);

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const baseFees = filtered
      .filter((row) => row.origin === "base_fee")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const unassigned = filtered
      .filter((row) => row.origin === "unassigned")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const seminarsCount = new Set(filtered.map((row) => row.seminar_id).filter(Boolean)).size;
    const professorsCount = new Set(
      filtered.map((row) => row.professorEmail).filter((email) => email && email !== "-")
    ).size;

    return {
      total,
      baseFees,
      unassigned,
      seminarsCount,
      professorsCount,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("admin_earnings", "Ganancias")}</h1>
        <p className="text-slate-500 text-sm">
          {t(
            "admin_earnings_subtitle",
            "Ingresos de la plataforma por comisiones y excedentes no atribuibles a referidos válidos."
          )}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          {t("admin_earnings_platform_wallet", "Billetera de plataforma")}: {data?.platformEmail || PLATFORM_WALLET_FALLBACK}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-400 tracking-wide">
              {t("admin_earnings_total", "Total plataforma")}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{money(summary.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-400 tracking-wide">
              {t("admin_earnings_base_fees", "Comisión base")}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{money(summary.baseFees)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-400 tracking-wide">
              {t("admin_earnings_unassigned", "Excedente no atribuible")}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{money(summary.unassigned)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-400 tracking-wide">
              {t("admin_earnings_seminars_count", "Seminarios")}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary.seminarsCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-400 tracking-wide">
              {t("admin_earnings_professors_count", "Profesores")}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary.professorsCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t(
                  "admin_earnings_search",
                  "Buscar por seminario, profesor, descripción o id de seminario..."
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button variant="outline" className="gap-2 xl:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              {t("common_filters", "Filtros")}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select value={seminarFilter} onValueChange={setSeminarFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin_earnings_seminar", "Seminario")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("admin_earnings_seminar_all", "Todos los seminarios")}</SelectItem>
                {seminarOptions.map((row) => (
                  <SelectItem key={row.seminar_id} value={row.seminar_id}>
                    {row.seminarTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin_earnings_origin", "Origen")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("admin_earnings_origin_all", "Todos los orígenes")}</SelectItem>
                <SelectItem value="base_fee">{t("admin_earnings_origin_base_fee", "Comisión base")}</SelectItem>
                <SelectItem value="unassigned">
                  {t("admin_earnings_origin_unassigned", "Excedente no atribuible")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={seminarStatusFilter} onValueChange={setSeminarStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin_earnings_seminar_status", "Estado del seminario")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("admin_earnings_seminar_status_all", "Todos los estados")}</SelectItem>
                <SelectItem value="draft">{t("draft", "Borrador")}</SelectItem>
                <SelectItem value="published">{t("published", "Publicado")}</SelectItem>
                <SelectItem value="in_progress">{t("in_progress", "En progreso")}</SelectItem>
                <SelectItem value="completed">{t("completed", "Completado")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled", "Cancelado")}</SelectItem>
                <SelectItem value="unknown">{t("common_unknown", "Desconocido")}</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder={t("admin_earnings_date_from", "Desde")}
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder={t("admin_earnings_date_to", "Hasta")}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("admin_loading_earnings", "Cargando ganancias...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm py-10 text-center">
              {t("common_no_results", "Sin resultados")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_seminar", "Seminario")}</TableHead>
                  <TableHead>{t("role_professor", "Profesor")}</TableHead>
                  <TableHead>{t("admin_earnings_origin", "Origen")}</TableHead>
                  <TableHead>{t("common_status", "Status")}</TableHead>
                  <TableHead>{t("admin_amount", "Monto")}</TableHead>
                  <TableHead>{t("admin_description", "Descripción")}</TableHead>
                  <TableHead>{t("admin_created", "Creado")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[240px] truncate">
                      <div className="font-medium text-slate-900">{row.seminarTitle}</div>
                      <div className="text-xs text-slate-500">{row.seminar_id || "-"}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.professorEmail || "-"}</TableCell>
                    <TableCell>
                      {row.origin === "base_fee"
                        ? t("admin_earnings_origin_base_fee", "Comisión base")
                        : t("admin_earnings_origin_unassigned", "Excedente no atribuible")}
                    </TableCell>
                    <TableCell>{t(row.seminarStatus, row.seminarStatus || "-")}</TableCell>
                    <TableCell>{money(row.amount)}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{row.description || "-"}</TableCell>
                    <TableCell>{fmtDate(row.created_at)}</TableCell>
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
