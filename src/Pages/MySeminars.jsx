// MySeminars.jsx (FIXED: Student/Professor/Admin + styling + payment buttons)
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Input } from "../Components/ui/input";

import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Clock,
  Eye,
  Trash2,
  MoreVertical,
  Loader2,
  Settings,
  CreditCard,
  Search,
} from "lucide-react";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../Components/ui/dropdown-menu";
import { toast } from "sonner";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

const payBadgeColors = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  pending_payment: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700"
};

const assetBase = import.meta.env.BASE_URL || "/";
const fallbackImage = `${assetBase}assets/hero.webp`;

const normalizeImageUrl = (url, fallback) => {
  if (!url) return fallback;
  const clean = String(url).split("?")[0];
  if (clean.includes("/storage/v1/object/sign/")) {
    return clean.replace("/storage/v1/object/sign/", "/storage/v1/object/public/");
  }
  return url;
};

function tStatus(status, t) {
  const map = {
    all: t?.("all", "Todos") ?? "Todos",
    draft: t?.("draft", "Borrador") ?? "Borrador",
    published: t?.("published", "Publicado") ?? "Publicado",
    in_progress: t?.("in_progress", "En progreso") ?? "En progreso",
    completed: t?.("completed", "Completado") ?? "Completado",
    cancelled: t?.("cancelled", "Cancelado") ?? "Cancelado",
  };
  return map[status] || status;
}

const normalizePayStatus = (s) => (s || "").toLowerCase().trim();

export default function MySeminars() {
  const { user, loading, role } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isAdmin = role === "admin";
  const isProfessor = role === "professor" || role === "teacher" || isAdmin;

  const [activeTab, setActiveTab] = useState("all");
  const [selectedSeminar, setSelectedSeminar] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // -------- PROF/ADMIN: seminarios creados --------
  const { data: mySeminars = [], isLoading: seminarsLoading } = useQuery({
    queryKey: ["my-seminars-created", user?.id, isAdmin],
    enabled: !!user && !loading && isProfessor,
    queryFn: async () => {
      let q = supabase.from("seminars").select("*").order("created_at", { ascending: false });
      if (!isAdmin) q = q.eq("professor_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // If we navigated here from SeminarDetails (owner/admin "Gestionar"), auto-open the manage panel.
  useEffect(() => {
    const manageId = location?.state?.manageSeminarId;
    if (!manageId) return;
    if (!Array.isArray(mySeminars) || mySeminars.length === 0) return;

    const found = mySeminars.find((s) => s.id === manageId);
    if (found) {
      setSelectedSeminar(found);
      // Clear state so refresh/back doesn't keep forcing the panel.
      navigate("/my-seminars", { replace: true, state: {} });
    }
  }, [location?.state, mySeminars, navigate]);

  const createdSeminarIds = useMemo(() => mySeminars.map((s) => s.id), [mySeminars]);

  const { data: enrollmentsForCreated = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrollments-created-seminars", createdSeminarIds.join(",")],
    enabled: !!user && !loading && isProfessor && createdSeminarIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .in("seminar_id", createdSeminarIds);

      if (error) throw error;
      return data ?? [];
    },
  });

  // -------- STUDENT: inscripciones + seminarios inscritos --------
  const { data: myEnrollments = [], isLoading: myEnrollmentsLoading } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user && !loading && !isProfessor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrolledSeminarIds = useMemo(
    () => [...new Set(myEnrollments.map((e) => e.seminar_id).filter(Boolean))],
    [myEnrollments]
  );

  const { data: enrolledSeminars = [], isLoading: enrolledSeminarsLoading } = useQuery({
    queryKey: ["seminars-enrolled", enrolledSeminarIds.join(",")],
    enabled: !!user && !loading && !isProfessor && enrolledSeminarIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("seminars").select("*").in("id", enrolledSeminarIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrollmentBySeminarId = useMemo(() => {
    const map = new Map();
    for (const e of myEnrollments) {
      if (!e?.seminar_id) continue;
      if (!map.has(e.seminar_id)) map.set(e.seminar_id, e); // más reciente
    }
    return map;
  }, [myEnrollments]);

  // -------- Mutations (prof/admin) --------
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("seminars").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-seminars-created"] });
      toast.success(t("seminar_deleted", "Seminario eliminado"));
      setSelectedSeminar(null);
    },
    onError: (e) => toast.error(e?.message || t("seminar_delete_error", "No se pudo eliminar")),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from("seminars").update({ status }).eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-seminars-created"] });
      toast.success(t("status_updated", "Estado actualizado"));
    },
    onError: (e) => toast.error(e?.message || t("status_update_error", "No se pudo actualizar")),
  });

  // Helpers (prof/admin)
  const getEnrollmentCount = (seminarId) =>
    enrollmentsForCreated.filter((e) => e.seminar_id === seminarId).length;

  const getTotalCollected = (seminarId) => {
    const paid = enrollmentsForCreated.filter((e) => {
      const ps = normalizePayStatus(e.payment_status || e.status);
      return e.seminar_id === seminarId && ps === "paid";
    });
    return paid.reduce((sum, e) => sum + (Number(e.amount_paid) || Number(e.final_price) || 0), 0);
  };

  // -------- UI states --------
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // =========================
  // STUDENT MODE (como captura VIEJO izquierda)
  // =========================
  if (!isProfessor) {
    const listLoading = myEnrollmentsLoading || enrolledSeminarsLoading;

    const filtered = (() => {
      if (activeTab === "all") return enrolledSeminars;
      // "pending" debe incluir pending y pending_payment
      return enrolledSeminars.filter((s) => {
        const e = enrollmentBySeminarId.get(s.id);
        const ps = normalizePayStatus(e?.payment_status || e?.status);
        if (activeTab === "pending") return ps === "pending" || ps === "pending_payment" || !ps;
        return ps === activeTab;
      });
    })();

    const totalEnrolls = myEnrollments.length;
    const paidCount = myEnrollments.filter((e) => normalizePayStatus(e.payment_status || e.status) === "paid").length;
    const pendingCount = myEnrollments.filter((e) => {
      const ps = normalizePayStatus(e.payment_status || e.status);
      return ps === "pending" || ps === "pending_payment" || !ps;
    }).length;

    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{t("mySeminars", "Mis seminarios")}</h1>
                <p className="text-slate-500">{t("mySeminars_subtitle_student", "Seminarios en los que estás inscrito")}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-slate-900">{totalEnrolls}</p>
                <p className="text-sm text-slate-500">{t("enrollments", "Inscripciones")}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-emerald-600">{paidCount}</p>
                <p className="text-sm text-slate-500">{t("paid", "Pagadas")}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-sm text-slate-500">{t("pending", "Pendientes")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-white border p-1 rounded-xl mb-6">
              <TabsTrigger value="all" className="flex-1 rounded-lg">{t("all", "Todos")}</TabsTrigger>
              <TabsTrigger value="paid" className="flex-1 rounded-lg">{t("paid", "Pagados")}</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 rounded-lg">{t("pending", "Pendientes")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {listLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Plus className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{t("mySeminars_empty_title", "Aún no estás inscrito")}</h3>
                <p className="text-slate-500 mb-6">{t("mySeminars_empty_subtitle", "Explora seminarios y únete a uno")}</p>
                <Link to="/seminars">
                  <Button className="bg-slate-900 hover:bg-slate-800">{t("exploreSeminars", "Explorar seminarios")}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filtered.map((seminar, index) => {
                  const e = enrollmentBySeminarId.get(seminar.id);
                  const ps = normalizePayStatus(e?.payment_status || e?.status);
                  const payState = ps || "pending";

                  const startDate = seminar.start_date ? new Date(seminar.start_date) : null;
                  const dueDays = Number(seminar.payment_due_days ?? 0);

                  // condición A: objetivo lleno
                  const hasTarget = Number(seminar.target_students ?? 0) > 0;

                  // condición B: ya estamos dentro de X días antes del inicio
                  const canPayByDate = startDate
                    ? new Date() >= new Date(startDate.getTime() - dueDays * 24 * 60 * 60 * 1000)
                    : false;

                  const canSeePayButton = hasTarget || canPayByDate;

                  // estados del enrollment en los que el estudiante puede pagar
                  const isPayableState = ["unpaid", "pending", "pending_payment"].includes(payState);

                  const showPayBtn = e?.id && canSeePayButton && isPayableState;


                  return (
                    <motion.div
                      key={seminar.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-40 h-32 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                              <img
                                src={normalizeImageUrl(seminar.image_url, fallbackImage)}
                                alt={seminar.title}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <Badge className={payBadgeColors[payState] || payBadgeColors.pending}>
                                    {payState === "paid"
                                      ? t("payment_confirmed", "Pago confirmado")
                                      : payState === "rejected"
                                        ? t("payment_rejected", "Pago rechazado")
                                        : t("payment_pending", "Pago pendiente")}
                                  </Badge>
                                  <h3 className="text-lg font-bold text-slate-900 mt-2 line-clamp-1">
                                    {seminar.title}
                                  </h3>
                                </div>

                                <div className="flex gap-2">
                                  <Link to={`/seminars/${seminar.id}`}>
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("view", "Ver")}
                                    </Button>
                                  </Link>

                                  {showPayBtn && (
                                    <Button
                                      size="sm"
                                      className="bg-slate-900 hover:bg-slate-800"
                                      onClick={() => navigate(`/process-payment?enrollment_id=${e.id}`)}
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      {t("pay", "Pagar")}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {seminar.start_date
                                      ? format(new Date(seminar.start_date), "MMM d", { locale: es })
                                      : "—"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  <span>{seminar.total_hours || 0} {t("hours", "horas")}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                                <div>
                                  <p className="text-xs text-slate-500">{t("your_amount", "Tu monto")}</p>
                                  <p className="font-bold text-slate-900">
                                    ${Number(e?.final_price ?? e?.amount_paid ?? 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">{t("status", "Estado")}</p>
                                  <p className="font-bold text-slate-900">{payState}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================
  // PROF/ADMIN MODE (como captura VIEJO derecha)
  // =========================

  // Detalle “Gestionar seminario”
  if (selectedSeminar) {
    const seminarEnrollments = enrollmentsForCreated.filter((e) => e.seminar_id === selectedSeminar.id);
    const enrollmentCount = seminarEnrollments.length;
    const totalCollected = getTotalCollected(selectedSeminar.id);

    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <Button variant="ghost" onClick={() => setSelectedSeminar(null)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("back_to_my_seminars", "Volver a mis seminarios")}
          </Button>

          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{selectedSeminar.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={statusColors[selectedSeminar.status] || statusColors.draft}>
                        {tStatus(selectedSeminar.status, t)}
                      </Badge>
                      <Badge variant="outline">
                        {enrollmentCount} / {selectedSeminar.max_students || "∞"} {t("students", "estudiantes")}
                      </Badge>
                      <Badge variant="outline">{t("collected", "Recaudado")}: ${totalCollected.toFixed(2)}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/seminars/${selectedSeminar.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        {t("view_page", "Ver página")}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/createseminar?edit=${selectedSeminar.id}`)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {t("common_edit", "Editar")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>{t("enrollments", "Inscripciones")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {seminarEnrollments.length === 0 ? (
                  <p className="text-slate-500">{t("enrollments_empty", "Aún no hay inscripciones.")}</p>
                ) : (
                  seminarEnrollments.map((e) => {

                    const ps = normalizePayStatus(e.payment_status || e.status);
                    const amount = Number(e.final_price ?? e.amount_paid ?? 0);

                    const showAdminPayBtn =
                      isAdmin &&
                      amount > 0 &&
                      (ps === "pending_payment" || ps === "pending");

                    return (
                      <div
                        key={e.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{e.student_id}</p>
                          <p className="text-xs text-slate-500">
                            {t("payment", "Pago")}: <b>{ps || "—"}</b> · {t("amount", "Monto")}:{" "}
                            <b>${Number(e.final_price ?? e.amount_paid ?? 0).toFixed(2)}</b>
                          </p>
                        </div>



                        {/* SOLO ADMIN (como tu captura “admin puede procesar pago”, prof NO) */}
                        {showAdminPayBtn && (
                          <div className="flex gap-2">
                            <Link to={`/process-payment?enrollment_id=${e.id}&mode=admin`}>
                              <Button variant="outline" size="sm">
                                <CreditCard className="h-4 w-4 mr-2" />
                                {t("admin_manage_payment", "Administrar pago")}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Listado prof/admin
  const filteredSeminars =
    activeTab === "all" ? mySeminars : mySeminars.filter((s) => s.status === activeTab);

  const searchedSeminars = filteredSeminars.filter((s) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      (s.title || "").toLowerCase().includes(t) ||
      (s.category || "").toLowerCase().includes(t) ||
      (s.modality || "").toLowerCase().includes(t)
    );
  });

  const totalStudents = enrollmentsForCreated.length;
  const totalCollectedAll = mySeminars.reduce((sum, s) => sum + getTotalCollected(s.id), 0);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t("mySeminars", "Mis seminarios")}</h1>
              <p className="text-slate-500">
                {isAdmin ? t("admin_view_all_seminars", "Vista de administrador - Todos los seminarios") : t("mySeminars_subtitle_professor", "Gestiona tus seminarios y estudiantes")}
              </p>
            </div>
          </div>

          {/* SOLO prof/admin (en capturas estudiante NO debe verlo) */}
          <Link to="/createseminar">
            <Button className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4 mr-2" />
              {t("createSeminar", "Crear seminario")}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-slate-900">{mySeminars.length}</p>
              <p className="text-sm text-slate-500">{t("total_seminars", "Total seminarios")}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {mySeminars.filter((s) => s.status === "published").length}
              </p>
              <p className="text-sm text-slate-500">{t("published", "Publicados")}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
              <p className="text-sm text-slate-500">{t("enrollments", "Inscripciones")}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 text-center">
              <p className="text-3xl font-bold text-purple-600">${totalCollectedAll.toFixed(0)}</p>
              <p className="text-sm text-slate-500">{t("collected", "Recaudado")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="w-full bg-white border p-1 rounded-xl">
              <TabsTrigger value="all" className="flex-1 rounded-lg">{t("all", "Todos")}</TabsTrigger>
              <TabsTrigger value="draft" className="flex-1 rounded-lg">{t("draft", "Borradores")}</TabsTrigger>
              <TabsTrigger value="published" className="flex-1 rounded-lg">{t("published", "Publicados")}</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1 rounded-lg">{t("completed", "Completados")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("mySeminars_search", "Buscar por título o categoría...")}
              className="pl-9 h-11"
            />
          </div>
        </div>

        {seminarsLoading || enrollmentsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : searchedSeminars.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Plus className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{t("no_seminars", "No hay seminarios para mostrar")}</h3>
              <p className="text-slate-500 mb-6">
                {isAdmin ? t("no_seminars_admin", "Aún no existen seminarios") : t("no_seminars_professor", "Crea tu primer seminario y comienza a enseñar")}
              </p>
              {!isAdmin && (
                <Link to="/createseminar">
                  <Button className="bg-slate-900 hover:bg-slate-800">{t("createSeminar", "Crear seminario")}</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {searchedSeminars.map((seminar, index) => {
                const enrollmentCount = getEnrollmentCount(seminar.id);
                const totalCollected = getTotalCollected(seminar.id);

                return (
                  <motion.div
                    key={seminar.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-full md:w-40 h-32 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                            <img
                              src={normalizeImageUrl(seminar.image_url, fallbackImage)}
                              alt={seminar.title}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <Badge className={statusColors[seminar.status] || statusColors.draft}>
                                  {tStatus(seminar.status, t)}
                                </Badge>
                                <h3 className="text-lg font-bold text-slate-900 mt-2 line-clamp-1">
                                  {seminar.title}
                                </h3>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedSeminar(seminar)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    {t("manage", "Gestionar")}
                                  </DropdownMenuItem>

                                  <Link to={`/seminars/${seminar.id}`}>
                                    <DropdownMenuItem>
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("viewDetails", "Ver detalles")}
                                    </DropdownMenuItem>
                                  </Link>

                                  {seminar.status === "draft" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateStatusMutation.mutate({ id: seminar.id, status: "published" })
                                      }
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      {t("publish", "Publicar")}
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem
                                    onClick={() => deleteMutation.mutate(seminar.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t("common_delete", "Eliminar")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {seminar.start_date
                                    ? format(new Date(seminar.start_date), "MMM d", { locale: es })
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                <span>{seminar.total_hours || 0} {t("hours", "horas")}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4" />
                                <span>{enrollmentCount} {t("enrolled", "inscritos")}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                              <div>
                                <p className="text-xs text-slate-500">{t("targetIncome", "Ingreso objetivo")}</p>
                                <p className="font-bold text-slate-900">${Number(seminar.target_income || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">{t("collected", "Recaudado")}</p>
                                <p className="font-bold text-emerald-600">${totalCollected.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">{t("currentPrice", "Precio actual")}</p>
                                <p className="font-bold text-blue-600">
                                  $
                                  {(() => {
                                    // ✅ Misma regla que SeminarDetails/quote_price:
                                    // el precio baja por inscritos HASTA target_students y luego se congela en el mínimo.
                                    const targetIncome = Number(seminar.target_income || 0);
                                    const targetStudents = Number(seminar.target_students || 0);

                                    if (targetIncome > 0 && targetStudents > 0) {
                                      const denom = Math.min(targetStudents, Math.max(1, enrollmentCount));
                                      return (targetIncome / denom).toFixed(2);
                                    }

                                    // fallback a price fijo si no hay modelo por objetivo
                                    const fixed = Number(seminar.price || 0);
                                    return (fixed > 0 ? fixed : 0).toFixed(2);
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
