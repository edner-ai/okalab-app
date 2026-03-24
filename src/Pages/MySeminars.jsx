// MySeminars.jsx (FIXED: Student/Professor/Admin + styling + payment buttons)
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../Components/ui/dialog";

import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Clock,
  Eye,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Trash2,
  MoreVertical,
  Loader2,
  Settings,
  CreditCard,
  Search,
  Mail,
  Phone,
  MessageCircle,
  Download,
} from "lucide-react";

import { format } from "date-fns";
import { getDateFnsLocale } from "../utils/dateLocale";
import { buildPublicAppUrl } from "../utils/appUrl";
import { buildWhatsAppLink } from "../utils/contactProfile";
import { parseDateValue } from "../utils/dateValue";
import { resolvePaymentWindow } from "../utils/paymentWindow";
import {
  buildCreateEditionUrl,
  getSeminarInterestSourceLabel,
  getSeminarInterestStatusBadgeClass,
  getSeminarInterestStatusLabel,
  seminarInterestStatusOptions,
} from "../utils/seminarInterest";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../Components/ui/dropdown-menu";
import { toast } from "sonner";
import { getPaymentStatusLabel, normalizePayStatus } from "../utils/paymentStatus";
import PaymentWindowCountdown from "../Components/seminars/PaymentWindowCountdown";

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
  unpaid: "bg-sky-100 text-sky-700",
  failed: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-200 text-slate-600"
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

function isPendingLikeStatus(status) {
  return !status || ["pending", "pending_payment", "unpaid", "rejected"].includes(status);
}

function canMarkSeminarCompleted(status) {
  return ["published", "in_progress"].includes(String(status || "").toLowerCase());
}

export default function MySeminars() {
  const { user, loading, role } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = useMemo(() => getDateFnsLocale(language), [language]);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isAdmin = role === "admin";
  const isProfessor = role === "professor" || role === "teacher" || isAdmin;
  const walletCheckoutShortcut = useMemo(
    () => new URLSearchParams(location.search).get("wallet_checkout") === "1",
    [location.search]
  );

  const [activeTab, setActiveTab] = useState("all");
  const [selectedSeminar, setSelectedSeminar] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [seminarPendingCompletion, setSeminarPendingCompletion] = useState(null);
  const walletShortcutHandledRef = useRef(false);

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

  const { data: seminarContactDirectory = [], isLoading: contactDirectoryLoading } = useQuery({
    queryKey: ["seminar-contact-directory", selectedSeminar?.id],
    enabled: !!user && !loading && isProfessor && !!selectedSeminar?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seminar_contact_directory", {
        p_seminar_id: selectedSeminar.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: seminarInterestRequests = [], isLoading: interestRequestsLoading } = useQuery({
    queryKey: ["seminar-interest-requests", selectedSeminar?.id],
    enabled: !!user && !loading && isProfessor && !!selectedSeminar?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminar_interest_requests")
        .select("*")
        .eq("seminar_id", selectedSeminar.id)
        .order("created_at", { ascending: false });

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

  const { data: enrolledSeminarStats = [], isLoading: enrolledSeminarStatsLoading } = useQuery({
    queryKey: ["seminar-enrollment-counts", enrolledSeminarIds.join(",")],
    enabled: !!user && !loading && !isProfessor && enrolledSeminarIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: enrolledSeminarIds,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("student seminar enrollment counts error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });


  const { data: paymentWindowSettings } = useQuery({
    queryKey: ["platform_settings_payment_window"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? { payment_open_days: 7, payment_close_days: 2 };
    },
    staleTime: 1000 * 60 * 5,
  });

  const formatPaymentWindowDate = (value) =>
    value ? format(value, "PPP", { locale: dateLocale }) : "â€”";

  const getCompletionGate = (seminar) => {
    if (!seminar?.id || !canMarkSeminarCompleted(seminar?.status)) {
      return {
        allowed: false,
        reason: t("complete_seminar_unavailable", "Este seminario no se puede marcar como completado."),
      };
    }

    if (!paymentWindowSettings) {
      return {
        allowed: false,
        reason: t(
          "complete_seminar_loading_payment_window",
          "Cargando la ventana de pago antes de permitir el cierre del seminario."
        ),
      };
    }

    const paymentWindow = resolvePaymentWindow({
      seminarStartDate: seminar.start_date,
      settings: paymentWindowSettings,
    });

    if (paymentWindow.isPaymentWindowClosed) {
      return {
        allowed: true,
        reason: "",
        paymentWindow,
      };
    }

    return {
      allowed: false,
      reason: t(
        "complete_seminar_payment_window_open_error",
        "PodrÃ¡s marcar este seminario como completado cuando cierre la ventana de pago el {close}."
      ).replace("{close}", formatPaymentWindowDate(paymentWindow.paymentCloseDate)),
      paymentWindow,
    };
  };

  const enrollmentBySeminarId = useMemo(() => {
    const map = new Map();
    for (const e of myEnrollments) {
      if (!e?.seminar_id) continue;
      if (!map.has(e.seminar_id)) map.set(e.seminar_id, e); // mÃ¡s reciente
    }
    return map;
  }, [myEnrollments]);

  const enrolledCountBySeminarId = useMemo(() => {
    const map = new Map();
    for (const row of enrolledSeminarStats || []) {
      if (!row?.seminar_id) continue;
      const count = Number(row?.enrolled_count);
      map.set(row.seminar_id, Number.isFinite(count) ? count : 0);
    }
    return map;
  }, [enrolledSeminarStats]);

  const enrolledSeminarById = useMemo(
    () => new Map(enrolledSeminars.map((seminar) => [seminar.id, seminar])),
    [enrolledSeminars]
  );

  const walletShortcutTargetEnrollment = useMemo(() => {
    if (isProfessor || !walletCheckoutShortcut || !paymentWindowSettings) return null;

    for (const enrollment of myEnrollments) {
      const seminar = enrolledSeminarById.get(enrollment?.seminar_id);
      if (!seminar) continue;

      const payState = normalizePayStatus(enrollment?.payment_status || enrollment?.status);
      if (!["unpaid", "rejected"].includes(payState)) continue;

      const enrollmentCount = Number(enrolledCountBySeminarId.get(seminar.id) ?? 0);
      const maxStudents = Number(seminar?.max_students || 0);
      const isFull = Number.isFinite(maxStudents) && maxStudents > 0 && enrollmentCount >= maxStudents;
      const paymentWindow = resolvePaymentWindow({
        seminarStartDate: seminar.start_date,
        settings: paymentWindowSettings,
        forcePayOpen: isFull,
      });

      if (paymentWindow.canPayNow) {
        return enrollment;
      }
    }

    return null;
  }, [
    enrolledCountBySeminarId,
    enrolledSeminarById,
    isProfessor,
    myEnrollments,
    paymentWindowSettings,
    walletCheckoutShortcut,
  ]);

  useEffect(() => {
    walletShortcutHandledRef.current = false;
  }, [walletCheckoutShortcut, user?.id]);

  useEffect(() => {
    if (isProfessor || !walletCheckoutShortcut || walletShortcutHandledRef.current) return;
    if (loading || myEnrollmentsLoading || enrolledSeminarsLoading || enrolledSeminarStatsLoading) return;

    walletShortcutHandledRef.current = true;

    if (walletShortcutTargetEnrollment?.id) {
      navigate(
        `/process-payment?enrollment_id=${walletShortcutTargetEnrollment.id}&prefill_wallet=max`,
        { replace: true }
      );
      return;
    }

    navigate("/my-seminars", { replace: true });
    toast(
      t(
        "wallet_no_pending_payments_shortcut",
        "No tienes pagos pendientes abiertos para usar tu Saldo Okalab en este momento."
      )
    );
  }, [
    enrolledSeminarStatsLoading,
    enrolledSeminarsLoading,
    isProfessor,
    loading,
    myEnrollmentsLoading,
    navigate,
    t,
    walletCheckoutShortcut,
    walletShortcutTargetEnrollment,
  ]);

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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-seminars-created"] });
      setSelectedSeminar((current) =>
        current?.id === variables?.id ? { ...current, status: variables.status } : current
      );
      setSeminarPendingCompletion(null);
      toast.success(t("status_updated", "Estado actualizado"));
    },
    onError: (e) => toast.error(e?.message || t("status_update_error", "No se pudo actualizar")),
  });

  const requestMarkCompleted = (seminar) => {
    const gate = getCompletionGate(seminar);
    if (!gate.allowed) {
      toast.error(gate.reason);
      return;
    }
    setSeminarPendingCompletion(seminar);
  };

  const renderCompletionDialog = () => (
    <Dialog
      open={!!seminarPendingCompletion}
      onOpenChange={(open) => {
        if (!open) setSeminarPendingCompletion(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("complete_seminar", "Marcar como completado")}</DialogTitle>
          <DialogDescription>
            {t(
              "complete_seminar_confirm_message",
              "Marca este seminario como completado solo cuando haya finalizado realmente. Esta acciÃ³n puede liberar bonos retenidos y habilitar procesos posteriores."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSeminarPendingCompletion(null)}>
            {t("common_cancel", "Cancelar")}
          </Button>
          <Button
            onClick={() => {
              if (!seminarPendingCompletion?.id) return;
              updateStatusMutation.mutate({
                id: seminarPendingCompletion.id,
                status: "completed",
              });
              setSeminarPendingCompletion(null);
            }}
          >
            {t("complete_seminar", "Marcar como completado")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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

  const openShareDialog = (seminar) => {
    if (!seminar?.id) return;
    const link = buildPublicAppUrl(`/seminars/${seminar.id}`);
    setShareLink(link);
    setShareTitle(seminar?.title || "");
    setShareCopied(false);
    setShareDialogOpen(true);
  };

  const emailContactList = useMemo(
    () => seminarContactDirectory.map((row) => row.student_email).filter(Boolean),
    [seminarContactDirectory]
  );

  const interestEmailList = useMemo(
    () => seminarInterestRequests.map((row) => row.email).filter(Boolean),
    [seminarInterestRequests]
  );

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
      queryClient.invalidateQueries({ queryKey: ["seminar-interest-requests", selectedSeminar?.id] });
      toast.success(t("seminar_interest_status_saved", "Estado actualizado."));
    },
    onError: (err) => {
      toast.error(
        err?.message || t("seminar_interest_status_error", "No se pudo actualizar el estado.")
      );
    },
  });

  const copyContactDirectory = async () => {
    const content = seminarContactDirectory
      .map((row) =>
        [
          row.student_name || row.student_email || row.student_id,
          row.student_email || "",
          row.whatsapp_number || "",
          row.phone || "",
          row.preferred_contact_method || "",
          row.allow_teacher_contact ? t("yes", "SÃ­") : t("no", "No"),
        ].join("\t")
      )
      .join("\n");

    if (!content) {
      toast.error(t("teacher_contact_directory_empty", "AÃºn no hay contactos disponibles."));
      return;
    }

    await navigator.clipboard.writeText(content);
    toast.success(t("contacts_copied", "Contactos copiados"));
  };

  const exportContactDirectory = () => {
    if (!seminarContactDirectory.length) {
      toast.error(t("teacher_contact_directory_empty", "AÃºn no hay contactos disponibles."));
      return;
    }

    const rows = [
      ["name", "email", "whatsapp", "phone", "preferred_contact_method", "allow_teacher_contact", "payment_status", "amount_due"],
      ...seminarContactDirectory.map((row) => [
        row.student_name || "",
        row.student_email || "",
        row.whatsapp_number || "",
        row.phone || "",
        row.preferred_contact_method || "",
        row.allow_teacher_contact ? "true" : "false",
        row.payment_status || "",
        String(row.amount_due ?? 0),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seminar-contacts-${selectedSeminar?.id || "export"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const emailAllStudents = () => {
    if (!emailContactList.length) {
      toast.error(t("teacher_contact_directory_no_email", "No hay correos autorizados para contactar."));
      return;
    }

    const subject = selectedSeminar?.title
      ? t("teacher_contact_email_subject", "Okalab Â· ComunicaciÃ³n del seminario") + `: ${selectedSeminar.title}`
      : t("teacher_contact_email_subject", "Okalab Â· ComunicaciÃ³n del seminario");
    window.location.href = `mailto:?bcc=${encodeURIComponent(
      emailContactList.join(",")
    )}&subject=${encodeURIComponent(subject)}`;
  };

  const exportInterestRequests = () => {
    if (!seminarInterestRequests.length) {
      toast.error(t("seminar_interest_empty", "Aun no hay interesados registrados."));
      return;
    }

    const rows = [
      ["full_name", "email", "phone", "country_code", "source_type", "status", "message", "created_at"],
      ...seminarInterestRequests.map((row) => [
        row.full_name || "",
        row.email || "",
        row.phone || "",
        row.country_code || "",
        row.source_type || "",
        row.status || "",
        row.message || "",
        row.created_at || "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seminar-interest-${selectedSeminar?.id || "export"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const emailInterestedPeople = () => {
    if (!interestEmailList.length) {
      toast.error(t("seminar_interest_no_email", "No hay correos disponibles para contactar."));
      return;
    }

    const subject = selectedSeminar?.title
      ? t("seminar_interest_email_subject", "Okalab Â· Nueva edicion del seminario") + `: ${selectedSeminar.title}`
      : t("seminar_interest_email_subject", "Okalab Â· Nueva edicion del seminario");

    window.location.href = `mailto:?bcc=${encodeURIComponent(
      interestEmailList.join(",")
    )}&subject=${encodeURIComponent(subject)}`;
  };

  const openCreateNewEdition = (seminarId, requestId = "") => {
    if (!seminarId) return;
    navigate(buildCreateEditionUrl(seminarId, requestId));
  };

  const shareMessage = shareLink
    ? `${t("share_professor_message", "Te invito a este seminario en Okalab:")}\n${shareLink}`
    : "";
  const waShare = shareLink ? `https://wa.me/?text=${encodeURIComponent(shareMessage)}` : "#";
  const tgShare = shareLink
    ? `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareMessage)}`
    : "#";
  const fbShare = shareLink ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}` : "#";
  const lnShare = shareLink ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}` : "#";
  const xShare = shareLink ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}` : "#";
  const emailShare = shareLink
    ? `mailto:?subject=${encodeURIComponent(shareTitle ? `Okalab: ${shareTitle}` : "Okalab")}&body=${encodeURIComponent(shareMessage)}`
    : "#";
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const handleNativeShare = async () => {
    if (!canNativeShare || !shareLink) return;
    try {
      await navigator.share({
        title: shareTitle || "Okalab",
        text: t("share_professor_message", "Te invito a este seminario en Okalab:"),
        url: shareLink,
      });
    } catch {
      // usuario cancelÃ³ o error
    }
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
    const listLoading = myEnrollmentsLoading || enrolledSeminarsLoading || enrolledSeminarStatsLoading;

	    const filtered = (() => {
	      if (activeTab === "all") return enrolledSeminars;
	      // "pending" tambiÃ©n cubre reservas y pagos rechazados por reintentar.
	      return enrolledSeminars.filter((s) => {
	        const e = enrollmentBySeminarId.get(s.id);
	        const ps = normalizePayStatus(e?.payment_status || e?.status);
	        if (activeTab === "pending") return isPendingLikeStatus(ps);
	        return ps === activeTab;
	      });
	    })();

    const totalEnrolls = myEnrollments.length;
	    const paidCount = myEnrollments.filter((e) => normalizePayStatus(e.payment_status || e.status) === "paid").length;
	    const pendingCount = myEnrollments.filter((e) => {
	      const ps = normalizePayStatus(e.payment_status || e.status);
	      return isPendingLikeStatus(ps);
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
                <p className="text-slate-500">{t("mySeminars_subtitle_student", "Seminarios en los que estÃ¡s inscrito")}</p>
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
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{t("mySeminars_empty_title", "AÃºn no estÃ¡s inscrito")}</h3>
                <p className="text-slate-500 mb-6">{t("mySeminars_empty_subtitle", "Explora seminarios y Ãºnete a uno")}</p>
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
                  const payLabel = getPaymentStatusLabel(payState, t);

                  const enrollmentCount = Number(enrolledCountBySeminarId.get(seminar.id) ?? 0);
                  const maxStudents = Number(seminar?.max_students || 0);
                  const isFull = Number.isFinite(maxStudents) && maxStudents > 0 && enrollmentCount >= maxStudents;

                  const paymentWindow = resolvePaymentWindow({
                    seminarStartDate: seminar.start_date,
                    settings: paymentWindowSettings,
                    forcePayOpen: isFull,
                  });
                  const {
                    paymentOpenDate,
                    paymentCloseDate,
                    isPaymentWindowClosed,
                    canPayNow,
                    isPaymentOpenByCapacity,
                  } = paymentWindow;

	                  const formatWindowDate = (value) =>
	                    value ? format(value, "PPP", { locale: dateLocale }) : "â€”";

                  const paymentWindowText = isPaymentWindowClosed
                    ? t("payment_window_closed_note", "La ventana de pago cerrÃ³ el {close}.").replace(
                        "{close}",
                        formatWindowDate(paymentCloseDate)
                      )
                    : isPaymentOpenByCapacity
                      ? t(
                          "payment_window_full_note",
                          "Cupos completos: los pagos ya estÃ¡n habilitados y cierran el {close}."
                        ).replace("{close}", formatWindowDate(paymentCloseDate))
                      : canPayNow
                        ? t("payment_window_open_note", "Pagos abiertos del {open} al {close}.")
                            .replace("{open}", formatWindowDate(paymentOpenDate))
                            .replace("{close}", formatWindowDate(paymentCloseDate))
                        : t(
                            "payment_window_upcoming_note",
                            "Pagos abrirÃ¡n el {open} y cierran el {close}. Hasta entonces solo reservas tu cupo."
                          )
                            .replace("{open}", formatWindowDate(paymentOpenDate))
                            .replace("{close}", formatWindowDate(paymentCloseDate));

	                  const isPayActionableState = ["unpaid", "rejected"].includes(payState);
	                  const isPendingReviewState = ["pending", "pending_payment"].includes(payState);
                  const showPayBtn = e?.id && isPayActionableState && canPayNow;
                  const showUpcomingPayBtn =
                    e?.id && isPayActionableState && !canPayNow && !isPaymentWindowClosed && !!paymentOpenDate;
                  const showClosedPayBtn = e?.id && isPayActionableState && isPaymentWindowClosed;


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
	                                      : payState === "unpaid"
	                                        ? t("payment_reserved", "Cupo reservado")
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

                                      {showUpcomingPayBtn && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="cursor-not-allowed"
                                        >
                                          {t("payment_opens_soon", "Pagar pronto")}
                                        </Button>
                                      )}

                                      {showClosedPayBtn && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="cursor-not-allowed"
                                        >
                                          {t("payment_window_closed_button", "Ventana cerrada")}
                                        </Button>
                                      )}
	                                </div>
	                              </div>

	                              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {seminar.start_date
                                      ? format(parseDateValue(seminar.start_date), "MMM d", { locale: dateLocale })
                                      : "â€”"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  <span>{seminar.total_hours || 0} {t("hours", "horas")}</span>
	                                </div>
	                              </div>

                                  {isPayActionableState && (
                                    <div className="mt-4 space-y-3">
                                      <div
                                        className={`rounded-xl px-3 py-3 text-sm ${
                                          canPayNow
                                            ? "bg-emerald-50 text-emerald-900"
                                            : isPaymentWindowClosed
                                              ? "bg-amber-50 text-amber-900"
                                              : "bg-sky-50 text-sky-900"
                                        }`}
                                      >
                                        {paymentWindowText}
                                      </div>

                                      {!isPaymentWindowClosed ? (
                                        <PaymentWindowCountdown
                                          targetDate={canPayNow ? paymentCloseDate : paymentOpenDate}
                                          mode={canPayNow ? "close" : "open"}
                                          compact
                                          t={t}
                                        />
                                      ) : null}
                                    </div>
                                  )}

                                  {isPendingReviewState && (
                                    <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
                                      {t("payment_submitted", "Pago registrado. Pendiente de validaciÃ³n.")}
                                    </div>
                                  )}

	                              <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                                <div>
                                  <p className="text-xs text-slate-500">{t("your_amount", "Tu monto")}</p>
                                  <p className="font-bold text-slate-900">
                                    ${Number(e?.final_price ?? e?.amount_paid ?? 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">{t("status", "Estado")}</p>
                                  <p className="font-bold text-slate-900">{payLabel}</p>
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

  // Detalle â€œGestionar seminarioâ€
  if (selectedSeminar) {
    const seminarEnrollments = enrollmentsForCreated.filter((e) => e.seminar_id === selectedSeminar.id);
    const enrollmentCount = seminarEnrollments.length;
    const totalCollected = getTotalCollected(selectedSeminar.id);
    const selectedSeminarCompletionGate = getCompletionGate(selectedSeminar);

    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Button variant="ghost" onClick={() => setSelectedSeminar(null)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("back_to_my_seminars", "Volver a mis seminarios")}
          </Button>

          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{selectedSeminar.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={statusColors[selectedSeminar.status] || statusColors.draft}>
                        {tStatus(selectedSeminar.status, t)}
                      </Badge>
                      <Badge variant="outline">
                        {enrollmentCount} / {selectedSeminar.max_students || "âˆž"} {t("students", "estudiantes")}
                      </Badge>
                      <Badge variant="outline">{t("collected", "Recaudado")}: ${totalCollected.toFixed(2)}</Badge>
                      <Badge variant="outline">
                        {t("seminar_interest_badge", "Interesados")}: {seminarInterestRequests.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                    {canMarkSeminarCompleted(selectedSeminar.status) ? (
                      <Button
                        size="sm"
                        className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 sm:justify-center"
                        onClick={() => requestMarkCompleted(selectedSeminar)}
                        disabled={updateStatusMutation.isPending || !selectedSeminarCompletionGate.allowed}
                        title={!selectedSeminarCompletionGate.allowed ? selectedSeminarCompletionGate.reason : undefined}
                      >
                        {updateStatusMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        {t("complete_seminar", "Marcar como completado")}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:justify-center"
                      onClick={() => openShareDialog(selectedSeminar)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {t("invite", "Invitar")}
                    </Button>
                    <Link to={`/seminars/${selectedSeminar.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full justify-start sm:justify-center">
                        <Eye className="h-4 w-4 mr-2" />
                        {t("view_page", "Ver pÃ¡gina")}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:justify-center sm:col-span-2 lg:col-span-1"
                      onClick={() => navigate(`/createseminar?edit=${selectedSeminar.id}`)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {t("common_edit", "Editar")}
                    </Button>
                  </div>
                </div>
                {canMarkSeminarCompleted(selectedSeminar.status) && !selectedSeminarCompletionGate.allowed ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {selectedSeminarCompletionGate.reason}
                  </p>
                ) : null}
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>{t("enrollments", "Inscripciones")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {seminarEnrollments.length === 0 ? (
                  <p className="text-slate-500">{t("enrollments_empty", "AÃºn no hay inscripciones.")}</p>
                ) : (
                  seminarEnrollments.map((e) => {

                    const ps = normalizePayStatus(e.payment_status || e.status);
                    const payLabel = getPaymentStatusLabel(ps, t);
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
                            {t("payment", "Pago")}: <b>{payLabel}</b> Â· {t("amount", "Monto")}:{" "}
                            <b>${Number(e.final_price ?? e.amount_paid ?? 0).toFixed(2)}</b>
                          </p>
                        </div>



                        {/* SOLO ADMIN (como tu captura â€œadmin puede procesar pagoâ€, prof NO) */}
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

            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>{t("teacher_contact_directory", "Directorio de contacto")}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      {t(
                        "teacher_contact_directory_help",
                        "Contacta estudiantes autorizados por email, WhatsApp o telÃ©fono."
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={emailAllStudents}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {t("email_all_students", "Email a todos")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={copyContactDirectory}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {t("copy_contacts", "Copiar contactos")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={exportContactDirectory}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("export_contacts", "Exportar contactos")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {contactDirectoryLoading ? (
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t("common_loading", "Cargandoâ€¦")}</span>
                  </div>
                ) : seminarContactDirectory.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    {t("teacher_contact_directory_empty", "AÃºn no hay contactos disponibles.")}
                  </p>
                ) : (
                  seminarContactDirectory.map((row) => {
                    const paymentLabel = getPaymentStatusLabel(
                      normalizePayStatus(row.payment_status || row.enrollment_status),
                      t
                    );
                    const contactAllowed =
                      !!row.student_email || !!row.phone || !!row.whatsapp_number;
                    const whatsappLink = row.whatsapp_number
                      ? buildWhatsAppLink(
                          row.whatsapp_number,
                          t("teacher_contact_default_message", "Hola, te escribo por tu inscripciÃ³n en Okalab.")
                        )
                      : "";

                    return (
                      <div
                        key={row.enrollment_id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {row.student_name || row.student_email || row.student_id}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                              <Badge variant="outline">
                                {t("payment", "Pago")}: {paymentLabel}
                              </Badge>
                              <Badge variant="outline">
                                {t("amount", "Monto")}: ${Number(row.amount_due || 0).toFixed(2)}
                              </Badge>
                              {row.preferred_contact_method ? (
                                <Badge variant="outline">
                                  {t("preferred_contact_method", "Medio de contacto preferido")}:{" "}
                                  {t(`contact_method_${row.preferred_contact_method}`, row.preferred_contact_method)}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.student_email ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => (window.location.href = `mailto:${row.student_email}`)}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                {t("send_email", "Enviar email")}
                              </Button>
                            ) : null}
                            {row.whatsapp_number ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  {t("open_whatsapp", "Abrir WhatsApp")}
                                </a>
                              </Button>
                            ) : null}
                            {row.phone ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={`tel:${row.phone}`}>
                                  <Phone className="h-4 w-4 mr-2" />
                                  {t("call_student", "Llamar")}
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {!contactAllowed ? (
                          <p className="text-sm text-slate-500">
                            {row.allow_teacher_contact
                              ? t("contact_info_hidden", "InformaciÃ³n de contacto no disponible.")
                              : t(
                                  "contact_not_allowed",
                                  "Este estudiante no autorizÃ³ compartir su informaciÃ³n de contacto."
                                )}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>{t("seminar_interest_title", "Interesados en nueva edicion")}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      {t(
                        "seminar_interest_help",
                        "Revisa personas interesadas en reapertura o en lista de espera de este seminario."
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={() => openCreateNewEdition(selectedSeminar?.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("seminar_create_new_edition", "Crear nueva edicion")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={emailInterestedPeople}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {t("seminar_interest_email_all", "Email a interesados")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start sm:w-auto sm:justify-center"
                      onClick={exportInterestRequests}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("seminar_interest_export", "Exportar interesados")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {interestRequestsLoading ? (
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t("common_loading", "Cargando…")}</span>
                  </div>
                ) : seminarInterestRequests.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    {t("seminar_interest_empty", "Aun no hay interesados registrados.")}
                  </p>
                ) : (
                  seminarInterestRequests.map((row) => {
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
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2 min-w-0">
                            <p className="font-medium text-slate-900 break-words">{row.full_name}</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">
                                {getSeminarInterestSourceLabel(row.source_type, t)}
                              </Badge>
                              <Badge className={getSeminarInterestStatusBadgeClass(row.status)}>
                                {getSeminarInterestStatusLabel(row.status, t)}
                              </Badge>
                              <Badge variant="outline">
                                {new Date(row.created_at).toLocaleString()}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-slate-600 break-words">
                              <p>{row.email}</p>
                              {row.phone ? <p>{row.phone}</p> : null}
                              {row.message ? <p className="text-slate-500">{row.message}</p> : null}
                            </div>
                          </div>

                          <div className="space-y-2 w-full lg:w-60">
                            <Select
                              value={row.status || 'new'}
                              onValueChange={(value) =>
                                updateInterestStatusMutation.mutate({ id: row.id, status: value })
                              }
                            >
                              <SelectTrigger>
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
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateNewEdition(selectedSeminar?.id, row.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {t("seminar_create_from_interest", "Crear edicion")}
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
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("invite", "Invitar")}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <p className="text-slate-600 text-sm">
                    {t("share_professor_note", "Comparte este enlace para invitar estudiantes (sin referidos).")}
                  </p>

                  <div className="flex gap-2">
                    <Input readOnly value={shareLink} className="bg-slate-50" />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!shareLink) return;
                        navigator.clipboard.writeText(shareLink);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }}
                    >
                      {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <a href={waShare} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    </Button>
                    <Button asChild variant="outline" className="border-sky-200 text-sky-700 hover:bg-sky-50">
                      <a href={tgShare} target="_blank" rel="noopener noreferrer">Telegram</a>
                    </Button>
                    <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                      <a href={fbShare} target="_blank" rel="noopener noreferrer">Facebook</a>
                    </Button>
                    <Button asChild variant="outline" className="border-sky-200 text-sky-700 hover:bg-sky-50">
                      <a href={lnShare} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                      <a href={xShare} target="_blank" rel="noopener noreferrer">X</a>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                      <a href={emailShare}>Email</a>
                    </Button>
                    {canNativeShare && (
                      <Button variant="outline" onClick={handleNativeShare}>
                        {t("share_native", "Compartir")}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {renderCompletionDialog()}
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
              placeholder={t("mySeminars_search", "Buscar por tÃ­tulo o categorÃ­a...")}
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
                {isAdmin ? t("no_seminars_admin", "AÃºn no existen seminarios") : t("no_seminars_professor", "Crea tu primer seminario y comienza a enseÃ±ar")}
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
                const seminarCompletionGate = getCompletionGate(seminar);

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

                                  {canMarkSeminarCompleted(seminar.status) && (
                                    <DropdownMenuItem
                                      onClick={() => requestMarkCompleted(seminar)}
                                      title={!seminarCompletionGate.allowed ? seminarCompletionGate.reason : undefined}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      {t("complete_seminar", "Marcar como completado")}
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
                                    ? format(parseDateValue(seminar.start_date), "MMM d", { locale: dateLocale })
                                    : "â€”"}
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
                                    // âœ… Misma regla que SeminarDetails/quote_price:
                                    // el precio baja por inscritos HASTA target_students y luego se congela en el mÃ­nimo.
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
        {renderCompletionDialog()}
      </div>
    </div>
  );
}



