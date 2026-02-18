import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Card, CardContent } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { Input } from "../Components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Components/ui/tabs";
import StarRating from "../Components/reviews/StarRating";

import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Monitor,
  Laptop,
  Download,
  Share2,
  Copy,
  Check,
  FileText,
  Video,
  ArrowLeft,
  TrendingDown,
  Gift,
} from "lucide-react";
import { toast } from "sonner";

const modalityIcons = {
  online: Monitor,
  presential: MapPin,
  hybrid: Laptop,
};

const categoryColors = {
  employability: "bg-blue-100 text-blue-700",
  entrepreneurship: "bg-emerald-100 text-emerald-700",
  digital_skills: "bg-purple-100 text-purple-700",
};

// Formateo simple (sin date-fns)
function fmtDate(value, lang = "es") {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const locale = lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
}

function fmtDateLong(value, lang = "es") {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const locale = lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function normalizeImageUrl(url, fallback) {
  if (!url) return fallback;
  const clean = String(url).split("?")[0];
  if (clean.includes("/storage/v1/object/sign/")) {
    return clean.replace("/storage/v1/object/sign/", "/storage/v1/object/public/");
  }
  return url;
}

export default function SeminarDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Soportar /seminars/:id y también ?id=...
  const { id: idFromParams } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const seminarId = idFromParams || searchParams.get("id");
  const referralParam = searchParams.get("ref");
  const referralCode =
    referralParam ||
    (localStorage.getItem("referral_seminar") === String(seminarId)
      ? localStorage.getItem("referral_code")
      : null);

  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralPrompted, setReferralPrompted] = useState(false);

  const [user, setUser] = useState(null);

  // Perfil/rol para controlar UI (profesor no debe ver "Inscribirse" en su propio seminario)
  const { data: profile } = useQuery({
    queryKey: ["profile-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const { t, language } = useLanguage();
  const defaultMetaRef = useRef(null);

  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_public_fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("platform_fee_percent, surplus_professor_percent, surplus_referral_percent, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    refetchOnMount: "always",
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!seminarId || !referralParam) return;
    localStorage.setItem("referral_code", referralParam);
    localStorage.setItem("referral_seminar", String(seminarId));
  }, [seminarId, referralParam]);

  // 1) Seminar
  const { data: seminar, isLoading } = useQuery({
    queryKey: ["seminar", seminarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .eq("id", seminarId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!seminarId,
  });

  // 2) Enrollments
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["seminar-enrollments", seminarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("seminar_id", seminarId);

      if (error) throw error;

      // “Activos”: si tuvieras cancelled, lo excluimos
      return (data || []).filter((e) => (e.status || e.payment_status) !== "cancelled");
    },
    enabled: !!seminarId,
  });

  const { data: enrollmentStats = [] } = useQuery({
    queryKey: ["seminar-enrollment-count", seminarId],
    enabled: !!seminarId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: [seminarId],
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("enrollment count error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const enrollmentCount = useMemo(() => {
    const row = Array.isArray(enrollmentStats) ? enrollmentStats[0] : enrollmentStats;
    const count = Number(row?.enrolled_count);
    return Number.isFinite(count) ? count : enrollments.length;
  }, [enrollmentStats, enrollments.length]);

  const maxStudents = Number(seminar?.max_students || 0);
  const isFull = Number.isFinite(maxStudents) && maxStudents > 0 && enrollmentCount >= maxStudents;

  const { data: ratingRows = [] } = useQuery({
    queryKey: ["seminar-rating-stats", seminarId],
    enabled: !!seminarId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_rating_stats", {
          seminar_ids: [seminarId],
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("seminar rating stats error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const ratingStats = useMemo(() => {
    const row = Array.isArray(ratingRows) ? ratingRows[0] : ratingRows;
    const avg = Number(row?.avg_rating);
    const count = Number(row?.review_count);
    return {
      avg: Number.isFinite(avg) ? avg : 0,
      count: Number.isFinite(count) ? count : 0,
    };
  }, [ratingRows]);

  const userEnrollment = useMemo(() => {
    if (!user) return null;
    return enrollments.find((e) => e.student_id === user.id) || null;
  }, [user, enrollments]);

  // Flags de rol/propiedad
  const role = (profile?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isOwner = !!user && (seminar?.professor_id === user.id || seminar?.instructor_id === user.id);
  const isOwnerProfessor = isOwner && (role === "professor" || role === "teacher" || role === "" || role === "instructor");

  useEffect(() => {
    if (!seminar) return;

    const appBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
    const publicBaseUrl =
      import.meta.env.VITE_PUBLIC_URL ||
      `${window.location.origin}${appBasePath === "/" ? "" : appBasePath}`;
    const defaultImage = `${publicBaseUrl}/assets/hero.webp`;

    const rawDescription =
      seminar?.short_description ||
      seminar?.description ||
      t(
        "seminar_meta_description_fallback",
        "Seminarios colaborativos donde todos ganan: profesores reciben su ingreso objetivo y estudiantes pagan menos."
      );
    const description = String(rawDescription).replace(/\s+/g, " ").trim().slice(0, 160);

    const title = `${seminar.title} | Okalab`;
    const ogImage = normalizeImageUrl(seminar?.image_url, defaultImage);
    const ogUrl = `${publicBaseUrl}/seminars/${seminarId}`;

    const getMeta = (attr, key) =>
      document.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") || "";
    const setMeta = (attr, key, value) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    if (!defaultMetaRef.current) {
      defaultMetaRef.current = {
        title: document.title,
        description: getMeta("name", "description"),
        ogTitle: getMeta("property", "og:title"),
        ogDescription: getMeta("property", "og:description"),
        ogImage: getMeta("property", "og:image"),
        ogUrl: getMeta("property", "og:url"),
        twitterTitle: getMeta("name", "twitter:title"),
        twitterDescription: getMeta("name", "twitter:description"),
        twitterImage: getMeta("name", "twitter:image"),
      };
    }

    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:url", ogUrl);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);

    return () => {
      const defaults = defaultMetaRef.current;
      if (!defaults) return;
      document.title = defaults.title || "Okalab";
      setMeta("name", "description", defaults.description || "");
      setMeta("property", "og:title", defaults.ogTitle || "");
      setMeta("property", "og:description", defaults.ogDescription || "");
      setMeta("property", "og:image", defaults.ogImage || "");
      setMeta("property", "og:url", defaults.ogUrl || "");
      setMeta("name", "twitter:title", defaults.twitterTitle || "");
      setMeta("name", "twitter:description", defaults.twitterDescription || "");
      setMeta("name", "twitter:image", defaults.twitterImage || "");
    };
  }, [seminar, seminarId, t]);

  useEffect(() => {
    if (!userEnrollment) return;
    if (localStorage.getItem("referral_seminar") === String(seminarId)) {
      localStorage.removeItem("referral_code");
      localStorage.removeItem("referral_seminar");
    }
  }, [userEnrollment, seminarId]);

  useEffect(() => {
    if (userEnrollment && showEnrollDialog) {
      setShowEnrollDialog(false);
    }
  }, [userEnrollment, showEnrollDialog]);

  useEffect(() => {
    if (!referralCode || referralPrompted) return;
    if (enrollmentsLoading) return;
    if (!user || !seminar || userEnrollment || isOwner || isAdmin || isFull) return;
    setShowEnrollDialog(true);
    setReferralPrompted(true);
  }, [referralCode, referralPrompted, user, seminar, userEnrollment, isOwner, isAdmin, isFull, enrollmentsLoading]);

  // Pricing (modelo):
  // - El precio por estudiante baja con inscritos hasta alcanzar target_students
  // - Una vez alcanzado el objetivo, el precio se congela en el mínimo (target_income / target_students)
  const targetIncome = Number(seminar?.target_income || 0);
  const targetStudents = Math.max(1, Number(seminar?.target_students || 15));
  const dueDays = Number(seminar?.payment_due_days || 7);

  const platformFeePercent = useMemo(() => {
    const feeFromSettings = Number(platformSettings?.platform_fee_percent);
    if (Number.isFinite(feeFromSettings)) return feeFromSettings;
    const feeFromSeminar = Number(seminar?.platform_fee_percent);
    return Number.isFinite(feeFromSeminar) ? feeFromSeminar : 15;
  }, [platformSettings?.platform_fee_percent, seminar?.platform_fee_percent]);

  const dueDate = useMemo(() => {
    if (!seminar?.start_date) return null;
    const d = new Date(seminar.start_date);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - dueDays);
    return d;
  }, [seminar?.start_date, dueDays]);

  const minPrice = targetIncome > 0 ? targetIncome / targetStudents : 0;
  const denomNow = Math.min(targetStudents, Math.max(1, enrollmentCount));
  const estimatedPriceNow = targetIncome > 0 ? targetIncome / denomNow : Number(seminar?.price || 0);
  const targetReachedForPrice = enrollmentCount >= targetStudents;
  const nextPrice = targetIncome > 0
    ? (targetReachedForPrice ? minPrice : targetIncome / Math.min(targetStudents, Math.max(1, enrollmentCount + 1)))
    : 0;
  const savings = targetIncome > 0 ? ((1 - (estimatedPriceNow / targetIncome)) * 100).toFixed(0) : "0";


// --- Regla de pago (según prompt/pdf): pagar solo si objetivo alcanzado O ya estamos dentro de la ventana por fecha ---
const payStatus = (userEnrollment?.payment_status || userEnrollment?.status || "").toLowerCase();
// ÚNICA FUENTE de pago: payment_status. Estados pagables: unpaid / rejected
const isPayableStatus = payStatus === "unpaid" || payStatus === "rejected";
const targetReached = enrollmentCount >= targetStudents; // inscritos >= objetivo
const canPayByDate = !!dueDate && new Date() >= dueDate; // dentro de X días antes del inicio
const showPayButton = !!userEnrollment && isPayableStatus && (targetReached || canPayByDate);
const payableAmount = Number(userEnrollment?.final_price ?? estimatedPriceNow ?? 0);

  // Bloque “modelo económico” como Base44
  const platformFee = targetIncome * (platformFeePercent / 100);
  const professorNet = targetIncome - platformFee;

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        const nextUrl = `${location.pathname}${location.search || ""}`;
        navigate(`/login?next=${encodeURIComponent(nextUrl)}`);
        return null;
      }
      if (isFull) {
        throw new Error(
          t(
            "seminar_full",
            "No quedan cupos disponibles. Explora otros seminarios o espera una nueva fecha."
          )
        );
      }
      if (userEnrollment) return userEnrollment;

      // Resolver invitador (si viene ref=enrollment_id) via RPC para evitar RLS
      let invitedByEmail = null;
      if (referralCode) {
        const { data: inviterEmail, error: invErr } = await supabase.rpc("get_inviter_email", {
          p_enrollment_id: referralCode,
          p_seminar_id: seminarId,
        });
        if (!invErr) invitedByEmail = inviterEmail || null;
      }

      // Crear enrollment PENDING (sin pago inmediato)
const enrollmentPayload = {
  seminar_id: seminarId,
  student_id: user.id,
  student_email: user.email,

  // 🔑 Estados definitivos
  status: "enrolled",        // solo UI / funcional
  payment_status: "unpaid",  // ÚNICA verdad de pago

  invited_by_email: invitedByEmail || null,
};

const { data, error } = await supabase
  .from("enrollments")
  .insert(enrollmentPayload)
  .select()
  .single();

if (error) {
  console.error("Error creating enrollment:", error);
  throw error;
}


      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seminar-enrollments", seminarId] });
      queryClient.invalidateQueries({ queryKey: ["seminar-enrollment-count", seminarId] });
      setShowEnrollDialog(false);
      if (referralCode && localStorage.getItem("referral_seminar") === String(seminarId)) {
        localStorage.removeItem("referral_code");
        localStorage.removeItem("referral_seminar");
      }
      // No pagamos ahora: el pago ocurre {dueDays} días antes (desde ProcessPayment)
    },
    onError: (err) => {
      toast.error(
        err?.message ||
          t("enroll_error", "No se pudo completar la inscripción. Intenta nuevamente.")
      );
    },
  });


const payMutation = useMutation({
  mutationFn: async () => {
    if (!userEnrollment?.id) throw new Error("Enrollment missing");
    const { error } = await supabase.rpc("pay_enrollment", {
      p_enrollment_id: userEnrollment.id,
    });
    if (error) throw error;
    return true;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["seminar-enrollments", seminarId] });
    setShowPayDialog(false);
  },
});

  const copyReferralLink = () => {
    if (!userEnrollment) return;
    const link = `${window.location.origin}/seminars/${seminarId}?ref=${userEnrollment.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ModalityIcon = seminar ? (modalityIcons[seminar.modality] || Monitor) : Monitor;
  const assetBase = import.meta.env.BASE_URL || "/";
  const fallbackHeroImage = `${assetBase}assets/hero.webp`;
  const heroImageSrc = normalizeImageUrl(seminar?.image_url, fallbackHeroImage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!seminar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("seminar_not_found", "Seminario no encontrado")}</h2>
          <Link to="/seminars">
            <Button>{t("view_all_seminars", "Ver todos los seminarios")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <Link to="/seminars">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("back_to_seminars", "Volver a seminarios")}
          </Button>
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <div className="relative h-72 md:h-96 rounded-3xl overflow-hidden">
              <img
                src={heroImageSrc}
                alt={seminar.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== fallbackHeroImage) {
                    e.currentTarget.src = fallbackHeroImage;
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <Badge className={`${categoryColors[seminar.category] || "bg-blue-100 text-blue-700"} mb-3`}>
                  {t(seminar.category, seminar.category)}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-white">{seminar.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <StarRating value={ratingStats.avg} readOnly size={16} />
              {ratingStats.count ? (
                <span className="text-slate-500">
                  {ratingStats.avg.toFixed(1)} · {ratingStats.count} {t("reviews", "reseñas")}
                </span>
              ) : (
                <span className="text-slate-400">{t("review_no_reviews", "Sin reseñas")}</span>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-xs text-slate-500">{t("startDate", "Fecha de inicio")}</p>
                  <p className="font-semibold">{fmtDate(seminar.start_date, language)}</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-xs text-slate-500">{t("duration", "Duración")}</p>
                  <p className="font-semibold">
                    {seminar.total_hours ? `${seminar.total_hours} ${t("hours", "horas")}` : "—"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <ModalityIcon className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs text-slate-500">{t("modality", "Modalidad")}</p>
                  <p className="font-semibold capitalize">{seminar.modality ? t(seminar.modality, seminar.modality) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                  <p className="text-xs text-slate-500">{t("enrolled", "Inscritos")}</p>
                  <p className="font-semibold">{enrollmentCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full bg-white border p-1 rounded-xl">
                <TabsTrigger value="description" className="flex-1 rounded-lg">
                  {t("description", "Descripción")}
                </TabsTrigger>
                <TabsTrigger value="materials" className="flex-1 rounded-lg">
                  {t("materials", "Materiales")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-6">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="prose prose-slate max-w-none">
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {seminar.description || ""}
                      </p>
                    </div>

                    <div className="mt-8 pt-6 border-t">
                      <h3 className="font-semibold text-slate-900 mb-4">{t("professor", "Profesor")}</h3>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {seminar.professor_name?.[0]?.toUpperCase() || "P"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {seminar.professor_name || t("professor", "Profesor")}
                          </p>
                          <p className="text-sm text-slate-500">{seminar.professor_email || ""}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="materials" className="mt-6">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    {Array.isArray(seminar.materials) && seminar.materials.length > 0 ? (
                      <div className="space-y-3">
                        {seminar.materials.map((material, index) => (
                          <a
                            key={index}
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                          >
                            <div className="p-2 bg-white rounded-lg">
                              {material.type === "video" ? (
                                <Video className="h-5 w-5 text-purple-600" />
                              ) : (
                                <FileText className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{material.name}</p>
                              <p className="text-sm text-slate-500">{material.type}</p>
                            </div>
                            <Download className="h-5 w-5 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          {userEnrollment
                            ? t("materials_coming_soon", "Los materiales estarán disponibles próximamente")
                            : t("materials_enroll_to_access", "Inscríbete para acceder a los materiales")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar (igual Base44 estructura) */}
          <div className="space-y-6">
            {/* Video Conference Info (solo si hay datos; visible a inscritos o al profesor/admin) */}
            {(seminar.modality === "online" || seminar.modality === "hybrid") && (() => {
              const hasVC = !!(seminar.video_conference_link || seminar.video_conference_id || seminar.video_conference_password);
              if (!hasVC) return null;
              const canSeeVC = !!userEnrollment || isOwnerProfessor || isAdmin;
              if (!canSeeVC) {
                return (
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-6 text-center">
                      <Video className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-600">
                        {t("enroll_to_access_video", "Inscríbete para acceder a los datos de videoconferencia")}
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              const platform = {
                zoom: t("video_platform_zoom", "Zoom"),
                meet: t("video_platform_meet", "Google Meet"),
                teams: t("video_platform_teams", "Microsoft Teams"),
                other: t("video_platform_other", "Otra"),
              }[seminar.video_conference_platform] || t("videoConference", "Videoconferencia");
              const meetingLink = seminar.video_conference_link || "";
              const meetingId = seminar.video_conference_id || "";
              const meetingPass = seminar.video_conference_password || "";

              return (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Video className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{t("videoConference", "Videoconferencia")}</h3>
                        <p className="text-slate-500 text-sm">{platform}</p>
                      </div>
                    </div>

                    {meetingLink ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">{t("meetingLink", "Enlace de reunión")}</p>
                        <div className="flex gap-2">
                          <Input readOnly value={meetingLink} />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigator.clipboard.writeText(meetingLink)}
                            title={t("copy_link", "Copiar enlace")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="icon" title={t("open_link", "Abrir enlace")}>
                              <ArrowLeft className="h-4 w-4 rotate-180" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {meetingId ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">{t("meetingId", "ID de reunión")}</p>
                        <div className="flex gap-2">
                          <Input readOnly value={meetingId} />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigator.clipboard.writeText(meetingId)}
                            title={t("copy_id", "Copiar ID")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {meetingPass ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">{t("password", "Contraseña")}</p>
                        <div className="flex gap-2">
                          <Input readOnly value={meetingPass} />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigator.clipboard.writeText(meetingPass)}
                            title={t("copy_password", "Copiar contraseña")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {meetingLink ? (
                      <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                        <Button className="w-full bg-purple-600 hover:bg-purple-700">
                          <Video className="h-4 w-4 mr-2" />
                          {t("joinMeeting", "Unirse a la reunión")}
                        </Button>
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Economics (igual estilo Base44) */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-blue-50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-blue-600">$</span> {t("economicsModel", "Modelo económico")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-xl border">
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" /> {t("enrolled", "Inscritos")}
                    </p>
                    <p className="text-lg font-bold mt-1">
                      {enrollmentCount}{" "}
                      {seminar.max_students ? (
                        <span className="text-xs text-slate-400 font-medium">
                          {t("of_max", "de")} {seminar.max_students} {t("max", "máx")}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border">
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">$</span> {t("currentPrice", "Precio actual")}
                    </p>
                    <p className="text-lg font-bold mt-1 text-emerald-600">
                      ${estimatedPriceNow.toFixed(2)}
                    </p>
                  </div>
                </div>

                {(isOwnerProfessor || isAdmin) ? (
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>
                      • {t("professor_receives", "Profesor recibe")}: ${professorNet.toFixed(2)} ({t("after_fee", "después de")} {platformFeePercent}% {t("fee_commission", "comisión")})
                    </li>
                    <li>• {t("platformFee", "Comisión plataforma")}: ${platformFee.toFixed(2)}</li>
                  </ul>
                ) : null}
              </CardContent>
            </Card>

            {/* Pricing Card (igual Base44) */}
            <Card className="border-0 shadow-xl sticky top-24">
              <CardContent className="p-6 space-y-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500">{t("price_estimated_now", "Precio estimado si pagas ahora")}</p>
                  <p className="text-4xl font-bold text-slate-900 mt-1">
                    ${estimatedPriceNow.toFixed(2)}
                  </p>

                  {targetIncome > 0 && (
                    <Badge variant="secondary" className="mt-2 bg-emerald-100 text-emerald-700">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      {t("discount_pct", `${savings}% de descuento`)}
                    </Badge>
                  )}
                </div>

                <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-900">
                  <b>{t("dont_worry", "No te asustes:")}</b> {t("reserve_only_pay_before", "hoy solo reservas tu cupo. Pagas")} <b>{dueDays} {t("days", "días")}</b> {t("before_start", "antes del inicio")}
                  {dueDate ? (
                    <span>
                      {" "}(<b>{fmtDateLong(dueDate, language)}</b>).
                    </span>
                  ) : null}
                  <div className="text-amber-800 mt-1">
                    {t("price_drops_with_more", "Tu precio baja automáticamente mientras más estudiantes confirmen.")}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{t("targetIncome", "Ingreso objetivo")}:</span>
                      <span className="font-semibold">${targetIncome}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{t("target_for_price", "Objetivo (para bajar precio)")}:</span>
                      <span className="font-semibold">{targetStudents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{t("min_price_goal", "Mínimo si llegamos al objetivo")}:</span>
                      <span className="font-semibold">${minPrice.toFixed(2)}</span>
                    </div>
                    {seminar.max_students ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{t("total_capacity", "Capacidad total")}:</span>
                        <span className="font-semibold">{seminar.max_students}</span>
                      </div>
                    ) : null}
                  </div>

                  {seminar.has_certificate && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">
                        {t("hasCertificate", "Ofrece certificado")}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    {t("priceExplanation", "Mientras más estudiantes se inscriban, menor será el precio para cada uno.")}
                  </p>
                </div>

                {(isOwnerProfessor || isAdmin) ? (
                  <Button
                    onClick={() => navigate("/my-seminars", { state: { manageSeminarId: seminarId } })}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-base"
                  >
                    {t("manage", "Gestionar")}
                  </Button>
                ) : userEnrollment ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-xl text-center">
                      <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <p className="font-medium text-emerald-900">{t("already_enrolled", "¡Ya estás inscrito!")}</p>
                    </div>

                    {showPayButton && (
                      <Button
                        onClick={() =>
                          navigate(`/process-payment?enrollment_id=${userEnrollment.id}`)
                        }
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base"
                      >
                        {t("pay", "Pagar")} ${payableAmount.toFixed(2)}
                      </Button>
                    )}

                    <Button
                      onClick={() => setShowShareDialog(true)}
                      className="w-full bg-slate-900 hover:bg-slate-800"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {t("invite", "Invitar")}
                    </Button>

                    <div className="p-4 bg-purple-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">{t("earn_bonuses", "Gana bonos")}</span>
                      </div>
                      <p className="text-xs text-purple-700">
                        {t("surplus_incentive_note", "Si se supera la meta del profesor, el excedente puede repartirse como incentivo.")}
                      </p>
                    </div>
                  </div>
                ) : isFull ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-900 text-sm">
                      {t(
                        "seminar_full",
                        "No quedan cupos disponibles. Explora otros seminarios o espera una nueva fecha."
                      )}
                    </div>
                    <Button
                      disabled
                      className="w-full h-12 bg-slate-400 text-white cursor-not-allowed"
                    >
                      {t("seminar_full_button", "Cupos llenos")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowEnrollDialog(true)}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-base"
                  >
                    {t("enroll", "Inscribirse")}
                  </Button>
                )}

                {enrollmentCount > 0 && targetIncome > 0 && !targetReached && (
                  <div className="text-center text-sm text-slate-500">
                    {t("next_price_with_one", "Con +1 estudiante:")}{" "}
                    <span className="font-medium text-emerald-600">
                      ${nextPrice.toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Enroll Dialog (igual Base44) */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirm_enroll", "Confirmar inscripción")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="font-medium text-slate-900">{seminar.title}</p>
              <p className="text-sm text-slate-500 mt-1">
                {fmtDateLong(seminar.start_date, language)}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">{t("price_estimated_now", "Precio estimado si pagas ahora")}:</span>
              <span className="text-2xl font-bold">${estimatedPriceNow.toFixed(2)}</span>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <b>{t("dont_worry", "No te asustes:")}</b> {t("reserve_only_pay_before", "hoy solo reservas tu cupo. Pagas")} {dueDays} {t("days", "días")} {t("before_start", "antes del inicio")}
              {dueDate ? (
                <> ({t("due_date", "fecha límite")}: <b>{fmtDateLong(dueDate, language)}</b>)</>
              ) : null}.
              <div className="mt-1">
                {t("min_price_if_goal", `Si llegamos al objetivo (${targetStudents}), el precio mínimo es`)} <b>${minPrice.toFixed(2)}</b>.
              </div>
            </div>

            {referralCode && (
              <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                {t("invited_enrollment_note", "¡Fuiste invitado! Tu inscripción ayuda a reducir el precio para todos.")}
              </div>
            )}

            {isFull && (
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-800">
                {t(
                  "seminar_full",
                  "No quedan cupos disponibles. Explora otros seminarios o espera una nueva fecha."
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              {t("common_cancel", "Cancelar")}
            </Button>
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending || isFull}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {enrollMutation.isPending ? t("common_processing", "Procesando...") : t("confirm_enroll", "Confirmar inscripción")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


{/* Pay Dialog (según flujo del pdf/capturas) */}
<Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{t("confirm_payment", "Confirmar pago")}</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-4">
      <div className="p-4 bg-slate-50 rounded-xl">
        <p className="font-medium text-slate-900">{seminar.title}</p>
        <p className="text-sm text-slate-500 mt-1">
          {fmtDateLong(seminar.start_date, language)}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-600">{t("amount_to_pay", "Monto a pagar")}:</span>
        <span className="text-2xl font-bold">${payableAmount.toFixed(2)}</span>
      </div>

      <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-900">
        <b>{t("important", "Importante:")}</b> {t("payment_pending_admin", "este pago queda")} <b>{t("pending", "pendiente")}</b> {t("payment_pending_admin_suffix", "hasta que un administrador lo apruebe (flujo del modelo económico).")}
      </div>

      {!targetReached && !canPayByDate && (
        <div className="p-3 bg-red-50 rounded-xl text-sm text-red-800">
          {t("cannot_pay_yet", "Aún no puedes pagar: faltan inscritos para llegar al objetivo o todavía no estás dentro de la ventana de pago.")}
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowPayDialog(false)}>
        {t("common_cancel", "Cancelar")}
      </Button>
      <Button
        onClick={() => payMutation.mutate()}
        disabled={!showPayButton || payMutation.isPending}
        className="bg-slate-900 hover:bg-slate-800"
      >
        {payMutation.isPending ? t("common_processing", "Procesando...") : t("confirm_payment", "Confirmar pago")}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Share Dialog (igual Base44 idea) */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("invite", "Invitar")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-slate-600">
              {t("share_link_note", "Comparte este enlace. Tu invitación ayudará a bajar el precio y luego podrás ganar incentivos.")}
            </p>

            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/seminars/${seminarId}?ref=${userEnrollment?.id || ""}`}
                className="bg-slate-50"
              />
              <Button onClick={copyReferralLink} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
