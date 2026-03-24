import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "../../Components/ui/badge";
import { Search, SlidersHorizontal, Loader2, Mail, MessageCircle, Plus } from "lucide-react";
import { useLanguage } from "../../Components/shared/LanguageContext";
import {
  buildCreateEditionUrl,
  getSeminarInterestSourceLabel,
  getSeminarInterestStatusBadgeClass,
  getSeminarInterestStatusLabel,
  seminarInterestStatusOptions,
} from "../../utils/seminarInterest";
import { buildWhatsAppLink } from "../../utils/contactProfile";
import { useNavigate } from "react-router-dom";

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function AdminInterestRequests() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [seminarFilter, setSeminarFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-seminar-interest-requests"],
    queryFn: async () => {
      const { data: requests, error: requestError } = await supabase
        .from("seminar_interest_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      const seminarIds = [...new Set((requests || []).map((row) => row.seminar_id).filter(Boolean))];

      let seminars = [];
      if (seminarIds.length > 0) {
        const { data: seminarRows, error: seminarError } = await supabase
          .from("seminars")
          .select("id, title, professor_email, status")
          .in("id", seminarIds);
        if (seminarError) throw seminarError;
        seminars = seminarRows || [];
      }

      return {
        requests: requests || [],
        seminars,
      };
    },
  });

  const updateInterestStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.rpc("update_seminar_interest_request_status", {
        p_request_id: id,
        p_status: status,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seminar-interest-requests"] });
    },
  });

  const seminarsById = useMemo(
    () => new Map((data?.seminars || []).map((seminar) => [seminar.id, seminar])),
    [data?.seminars]
  );

  const rows = useMemo(() => {
    return (data?.requests || []).map((row) => {
      const seminar = seminarsById.get(row.seminar_id);
      return {
        ...row,
        seminarTitle: seminar?.title || "-",
        seminarStatus: seminar?.status || "unknown",
        professorEmail: seminar?.professor_email || "-",
      };
    });
  }, [data?.requests, seminarsById]);

  const seminarOptions = useMemo(() => {
    return [...new Map(rows.filter((row) => row.seminar_id).map((row) => [row.seminar_id, row])).values()].sort(
      (a, b) => String(a.seminarTitle || "").localeCompare(String(b.seminarTitle || ""))
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (seminarFilter !== "all" && row.seminar_id !== seminarFilter) return false;
      if (sourceFilter !== "all" && row.source_type !== sourceFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;

      if (!q) return true;
      const haystack = [
        row.full_name || "",
        row.email || "",
        row.phone || "",
        row.message || "",
        row.seminarTitle || "",
        row.professorEmail || "",
        row.seminar_id || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, seminarFilter, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: filtered.length,
      newCount: filtered.filter((row) => row.status === "new").length,
      contactedCount: filtered.filter((row) => row.status === "contacted").length,
      convertedCount: filtered.filter((row) => row.status === "converted").length,
      seminarsCount: new Set(filtered.map((row) => row.seminar_id).filter(Boolean)).size,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("admin_interest_requests", "Interesados")}
        </h1>
        <p className="text-slate-500 text-sm">
          {t(
            "admin_interest_requests_subtitle",
            "Solicitudes publicas para reapertura o lista de espera de seminarios llenos y completados."
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400 tracking-wide">{t("admin_interest_total", "Total")}</p><p className="text-2xl font-bold text-slate-900 mt-2">{summary.total}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400 tracking-wide">{t("seminar_interest_status_new", "Nuevo")}</p><p className="text-2xl font-bold text-slate-900 mt-2">{summary.newCount}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400 tracking-wide">{t("seminar_interest_status_contacted", "Contactado")}</p><p className="text-2xl font-bold text-slate-900 mt-2">{summary.contactedCount}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400 tracking-wide">{t("seminar_interest_status_converted", "Convertido")}</p><p className="text-2xl font-bold text-slate-900 mt-2">{summary.convertedCount}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs uppercase text-slate-400 tracking-wide">{t("admin_earnings_seminars_count", "Seminarios")}</p><p className="text-2xl font-bold text-slate-900 mt-2">{summary.seminarsCount}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t(
                  "admin_interest_search",
                  "Buscar por nombre, email, seminario o profesor..."
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin_interest_source", "Origen")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("admin_interest_source_all", "Todos los origenes")}</SelectItem>
                <SelectItem value="full">{t("seminar_interest_source_full", "Cupos llenos")}</SelectItem>
                <SelectItem value="completed">{t("seminar_interest_source_completed", "Seminario completado")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("status", "Estado")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("all", "Todos")}</SelectItem>
                {seminarInterestStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getSeminarInterestStatusLabel(status, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex items-center gap-3 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("common_loading", "Cargando…")}</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common_name", "Nombre")}</TableHead>
                  <TableHead>{t("admin_earnings_seminar", "Seminario")}</TableHead>
                  <TableHead>{t("professor", "Profesor")}</TableHead>
                  <TableHead>{t("admin_interest_source", "Origen")}</TableHead>
                  <TableHead>{t("status", "Estado")}</TableHead>
                  <TableHead>{t("message", "Mensaje")}</TableHead>
                  <TableHead>{t("created_at", "Creado")}</TableHead>
                  <TableHead className="text-right">{t("actions", "Acciones")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                      {t("seminar_interest_empty", "Aun no hay interesados registrados.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const whatsappLink = row.phone
                      ? buildWhatsAppLink(
                          row.phone,
                          t(
                            "seminar_interest_default_message",
                            "Hola, te escribo por tu interes en una nueva edicion del seminario en Okalab."
                          )
                        )
                      : "";

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="min-w-[220px]">
                            <p className="font-medium text-slate-900">{row.full_name}</p>
                            <p className="text-xs text-slate-500">{row.email}</p>
                            {row.phone ? <p className="text-xs text-slate-500">{row.phone}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>{row.seminarTitle}</TableCell>
                        <TableCell>{row.professorEmail}</TableCell>
                        <TableCell>{getSeminarInterestSourceLabel(row.source_type, t)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeminarInterestStatusBadgeClass(row.status)}>
                              {getSeminarInterestStatusLabel(row.status, t)}
                            </Badge>
                            <Select
                              value={row.status || 'new'}
                              onValueChange={(value) =>
                                updateInterestStatusMutation.mutate({ id: row.id, status: value })
                              }
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder={t("status", "Estado")} />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                {seminarInterestStatusOptions.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {getSeminarInterestStatusLabel(status, t)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px] text-sm text-slate-600">
                          {row.message || "-"}
                        </TableCell>
                        <TableCell>{fmtDate(row.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(buildCreateEditionUrl(row.seminar_id, row.id))}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {t("seminar_create_from_interest", "Crear edición")}
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={`mailto:${row.email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                {t("send_email", "Enviar email")}
                              </a>
                            </Button>
                            {row.phone ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


