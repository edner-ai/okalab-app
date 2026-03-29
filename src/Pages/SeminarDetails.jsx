import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../Components/shared/LanguageContext";
import LocalCurrencyReference from "../Components/payments/LocalCurrencyReference";
import { getIntlLocale } from "../utils/dateLocale";
import { buildPublicAppUrl } from "../utils/appUrl";
import { normalizeCountryCode } from "../utils/countries";
import { resolvePaymentWindow } from "../utils/paymentWindow";
import { parseDateValue } from "../utils/dateValue";
import { buildContactOnboardingUrl } from "../utils/contactProfile";
import { getVideoConferencePlatformLabel } from "../utils/videoConference";
import {
  normalizeSeminarCover,
  normalizeSeminarMaterials,
} from "../utils/seminarMedia";
import {
  clearReferralStateForSeminar,
  getStoredReferralCodeForSeminar,
  storeReferralState,
} from "../utils/referralState";
import { useAuth } from "../context/AuthContext.jsx";

import { Button } from "../Components/ui/button";
import { Card, CardContent } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Components/ui/tabs";
import StarRating from "../Components/reviews/StarRating";
import PaymentWindowCountdown from "../Components/seminars/PaymentWindowCountdown";
import LocationInfo from "../Components/seminars/LocationInfo";
import {
  buildInterestInviteUrl,
  clearStoredInterestInviterRequestIdForSeminar,
  getSeminarInterestSourceLabel,
  getStoredInterestInviterRequestIdForSeminar,
  getStoredInterestShareRequestIdForSeminar,
  storeInterestInviterRequestId,
  storeInterestShareRequestId,
} from "../utils/seminarInterest";

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
  PlayCircle,
  ExternalLink,
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
  const d = parseDateValue(value);
  if (!d || Number.isNaN(d.getTime())) return String(value);
  const locale = getIntlLocale(lang);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
}

function fmtDateLong(value, lang = "es") {
  if (!value) return "-";
  const d = parseDateValue(value);
  if (!d || Number.isNaN(d.getTime())) return String(value);
  const locale = getIntlLocale(lang);
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function normalizeInterestEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidInterestEmail(value) {
  const email = normalizeInterestEmail(value);
  return email.includes("@") && email.includes(".");
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
  const interestRefParam = searchParams.get("interest_ref");
  const referralCode = referralParam || getStoredReferralCodeForSeminar(seminarId);

  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showInterestDialog, setShowInterestDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralPrompted, setReferralPrompted] = useState(false);
  const [interestForm, setInterestForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [ownInterestRequestId, setOwnInterestRequestId] = useState("");

  const { user, profile, contactProfileComplete } = useAuth();
  const residenceCountryCode = normalizeCountryCode(profile?.country_code);

  const { t, language } = useLanguage();
  const defaultMetaRef = useRef(null);

  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_public_seminar_details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    refetchOnMount: "always",
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!seminarId || !referralCode) return;
    storeReferralState({
      seminarId,
      referralCode,
      pathname: location.pathname,
      search: location.search,
    });
  }, [seminarId, referralCode, location.pathname, location.search]);

  useEffect(() => {
    if (!seminarId) return;
    setOwnInterestRequestId(getStoredInterestShareRequestIdForSeminar(seminarId) || "");
  }, [seminarId]);

  useEffect(() => {
    if (!seminarId || !interestRefParam) return;
    storeInterestInviterRequestId({
      seminarId,
      requestId: interestRefParam,
    });
  }, [seminarId, interestRefParam]);

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
    refetchOnMount: "always",
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

      // "Activos": si tuvieras cancelled, lo excluimos
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
  const isInterestOnly = String(seminar?.status || "").toLowerCase() === "interest_only";
  const isCompleted = String(seminar?.status || "").toLowerCase() === "completed";
  const seminarStartDate = useMemo(() => {
    if (!seminar?.start_date) return null;
    return parseDateValue(seminar.start_date);
  }, [seminar?.start_date]);
  const seminarEndDate = useMemo(() => {
    if (!seminar?.end_date) return null;
    return parseDateValue(seminar.end_date, { endOfDay: true });
  }, [seminar?.end_date]);
  const hasStarted = !!seminarStartDate && new Date() >= seminarStartDate;
  const isEnded = !!seminarEndDate && new Date() > seminarEndDate;

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

  const { data: quote } = useQuery({
    queryKey: ["quote", seminarId],
    enabled: !!seminarId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("quote_price", {
        p_seminar_id: seminarId,
      });
      if (error) throw error;
      return (data && data[0]) || null;
    },
    staleTime: 1000 * 60 * 2,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  const paymentWindow = useMemo(
    () =>
      resolvePaymentWindow({
        seminarStartDate: seminar?.start_date,
        quote,
        settings: platformSettings,
        forcePayOpen: isFull,
      }),
    [seminar?.start_date, quote, platformSettings, isFull]
  );

  const {
    paymentOpenDate,
    paymentCloseDate,
    isPaymentWindowClosed,
    isEnrollClosedForPayments,
    canPayNow,
    isPaymentOpenByCapacity,
  } = paymentWindow;

  const userEnrollment = useMemo(() => {
    if (!user) return null;
    return enrollments.find((e) => e.student_id === user.id) || null;
  }, [user, enrollments]);

  // Flags de rol/propiedad
  const role = (profile?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isOwner = !!user && (seminar?.professor_id === user.id || seminar?.instructor_id === user.id);
  const isOwnerProfessor = isOwner && (role === "professor" || role === "teacher" || role === "" || role === "instructor");
  const professorProfileId = seminar?.professor_id || seminar?.instructor_id || null;
  const interestSourceType = isInterestOnly ? "prelaunch" : isCompleted ? "completed" : isFull ? "full" : null;
  const accountInterestEmail = useMemo(
    () => normalizeInterestEmail(user?.email || profile?.email),
    [profile?.email, user?.email]
  );
  const dialogInterestEmail = useMemo(
    () => normalizeInterestEmail(interestForm.email),
    [interestForm.email]
  );

  const fetchExistingInterestRequest = async (email) => {
    const normalizedEmail = normalizeInterestEmail(email);
    if (!seminarId || !interestSourceType || !isValidInterestEmail(normalizedEmail)) {
      return null;
    }

    const { data, error } = await supabase.rpc("get_seminar_interest_request_status", {
      p_seminar_id: seminarId,
      p_email: normalizedEmail,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  };

  const { data: accountInterestRequest = null } = useQuery({
    queryKey: ["seminar-interest-request-status", seminarId, accountInterestEmail],
    enabled: !!seminarId && !!interestSourceType && isValidInterestEmail(accountInterestEmail),
    queryFn: () => fetchExistingInterestRequest(accountInterestEmail),
    staleTime: 1000 * 30,
    refetchOnMount: "always",
  });

  const { data: dialogInterestRequest = null, isFetching: isCheckingDialogInterestRequest } = useQuery({
    queryKey: ["seminar-interest-request-status", seminarId, dialogInterestEmail],
    enabled:
      showInterestDialog &&
      !!seminarId &&
      !!interestSourceType &&
      isValidInterestEmail(dialogInterestEmail) &&
      dialogInterestEmail !== accountInterestEmail,
    queryFn: () => fetchExistingInterestRequest(dialogInterestEmail),
    staleTime: 1000 * 30,
  });

  const canRequestInterest =
    !!seminar &&
    !userEnrollment &&
    !isOwnerProfessor &&
    !isAdmin &&
    !!interestSourceType;
  const interestInviterRequestId =
    interestRefParam || getStoredInterestInviterRequestIdForSeminar(seminarId);
  const resolvedInterestRequestId =
    ownInterestRequestId || accountInterestRequest?.request_id || "";
  const dialogExistingInterestRequest =
    dialogInterestEmail && dialogInterestEmail === accountInterestEmail
      ? accountInterestRequest
      : dialogInterestRequest;
  const canShareInterestDemand =
    interestSourceType === "prelaunch" && !!resolvedInterestRequestId && !isOwnerProfessor && !isAdmin;
  const hasRegisteredInterest = !!resolvedInterestRequestId;
  const interestDefaultForm = useMemo(
    () => ({
      full_name: profile?.full_name || "",
      email: user?.email || profile?.email || "",
      phone: profile?.phone || "",
      message: "",
    }),
    [profile?.email, profile?.full_name, profile?.phone, user?.email]
  );

  useEffect(() => {
    if (!seminar) return;

    const defaultImage = buildPublicAppUrl("/assets/hero.webp");

    const rawDescription =
      seminar?.short_description ||
      seminar?.description ||
      t(
        "seminar_meta_description_fallback",
        "Seminarios colaborativos donde todos ganan: profesores reciben su ingreso objetivo y estudiantes pagan menos."
      );
    const description = String(rawDescription).replace(/\s+/g, " ").trim().slice(0, 160);

    const title = `${seminar.title} | Okalab`;
    const ogImage = normalizeSeminarCover(seminar, defaultImage).imageSrc;
    const ogUrl = buildPublicAppUrl(`/seminars/${seminarId}`);

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
    clearReferralStateForSeminar(seminarId);
  }, [userEnrollment, seminarId]);

  useEffect(() => {
    if (userEnrollment && showEnrollDialog) {
      setShowEnrollDialog(false);
    }
  }, [userEnrollment, showEnrollDialog]);

  useEffect(() => {
    if (!showInterestDialog) return;
    setInterestForm(interestDefaultForm);
  }, [showInterestDialog, interestDefaultForm]);

  useEffect(() => {
    if (!referralCode || referralPrompted) return;
    if (enrollmentsLoading) return;
    if (
      !user ||
      !seminar ||
      userEnrollment ||
      isOwner ||
      isAdmin ||
      isInterestOnly ||
      isFull ||
      isEnded ||
      isEnrollClosedForPayments
    ) {
      return;
    }
    setShowEnrollDialog(true);
    setReferralPrompted(true);
  }, [
    referralCode,
    referralPrompted,
    user,
    seminar,
    userEnrollment,
    isOwner,
    isAdmin,
    isInterestOnly,
    isFull,
    isEnded,
    isEnrollClosedForPayments,
    enrollmentsLoading,
  ]);

  // Pricing (modelo):
  // - El precio por estudiante baja con inscritos hasta alcanzar target_students
  // - Una vez alcanzado el objetivo, el precio se congela en el mínimo (target_income / target_students)
  const targetIncome = Number(seminar?.target_income || 0);
  const targetStudents = Math.max(1, Number(seminar?.target_students || 15));

  const platformFeePercent = useMemo(() => {
    const feeFromSettings = Number(platformSettings?.platform_fee_percent);
    if (Number.isFinite(feeFromSettings)) return feeFromSettings;
    const feeFromSeminar = Number(seminar?.platform_fee_percent);
    return Number.isFinite(feeFromSeminar) ? feeFromSeminar : 15;
  }, [platformSettings?.platform_fee_percent, seminar?.platform_fee_percent]);

  const minPrice = targetIncome > 0 ? targetIncome / targetStudents : 0;
  const denomNow = Math.min(targetStudents, Math.max(1, enrollmentCount));
  const fallbackEstimatedPriceNow =
    targetIncome > 0 ? targetIncome / denomNow : Number(seminar?.price || 0);
  const quotedEstimatedPriceNow = Number(quote?.estimated_price_now);
  const estimatedPriceNow =
    Number.isFinite(quotedEstimatedPriceNow) && quotedEstimatedPriceNow > 0
      ? (targetIncome > 0
          ? Math.min(quotedEstimatedPriceNow, fallbackEstimatedPriceNow)
          : quotedEstimatedPriceNow)
      : fallbackEstimatedPriceNow;

  const targetReached = enrollmentCount >= targetStudents; // inscritos >= objetivo

  // Precio si entra +1 estudiante (para el aviso "Con +1 estudiante")
  const nextPrice =
    targetIncome > 0
      ? (targetReached ? minPrice : targetIncome / Math.min(targetStudents, Math.max(1, enrollmentCount + 1)))
      : 0;

  const priceAfterEnroll =
    Number.isFinite(nextPrice) && nextPrice > 0 ? nextPrice : estimatedPriceNow;

  const savings = targetIncome > 0 ? ((1 - estimatedPriceNow / targetIncome) * 100).toFixed(0) : "0";
  const discountText = t("discount_pct", "{pct}% de descuento").replace(/\{\s*pct\s*\}/gi, savings);

  
const paymentWindowNote = isInterestOnly
    ? t(
        "seminar_interest_only_payment_window_help",
        "Mientras solo captes interesados no se habilitan inscripciones, pagos ni bonos. Define fechas para abrir el flujo normal."
      )
    : isPaymentWindowClosed
      ? t("payment_window_closed_note", "La ventana de pago cerro el {close}.")
      : isPaymentOpenByCapacity
        ? t(
            "payment_window_full_note",
            "Cupos completos: los pagos ya estan habilitados y cierran el {close}."
          )
        : canPayNow
          ? t("payment_window_open_note", "Pagos abiertos del {open} al {close}. Inscripciones cerradas.")
          : t(
              "payment_window_upcoming_note",
              "Pagos abriran el {open} y cierran el {close}. Hasta entonces solo reservas tu cupo."
            );
  const paymentWindowNoteText = paymentWindowNote
    .replace("{open}", paymentOpenDate ? fmtDateLong(paymentOpenDate, language) : "-")
    .replace("{close}", paymentCloseDate ? fmtDateLong(paymentCloseDate, language) : "-");

const minPriceGoalText = useMemo(() => {
    const raw = t(
      "min_price_if_goal_slots",
      "Si llegamos al cupo objetivo ({targetStudents}), el precio mínimo es"
    );
    return String(raw).replace(/\{\s*targetStudents\s*\}|\$\{\s*targetStudents\s*\}/g, String(targetStudents));
  }, [t, targetStudents]);


// --- Regla de pago: pagar si el seminario llenó cupo o si ya abrió la ventana ---
const payStatus = (userEnrollment?.payment_status || userEnrollment?.status || "").toLowerCase();
// UNICA FUENTE de pago: payment_status. Estados pagables: unpaid / rejected
const isPayableStatus = payStatus === "unpaid" || payStatus === "rejected";
const isEnrollmentPaid = payStatus === "paid";
const materialsAccessMode = seminar?.materials_access_mode || "start_date";
const materialsReleasedForPaidStudents =
  materialsAccessMode === "after_payment" || hasStarted;
const canAccessMaterials =
  isOwnerProfessor || isAdmin || (!!userEnrollment && isEnrollmentPaid && materialsReleasedForPaidStudents);
const canRequestMaterials = !!seminarId;
const showPayButton = !!userEnrollment && isPayableStatus && canPayNow;
const payableAmount = Number(userEnrollment?.final_price ?? estimatedPriceNow ?? 0);
const showUpcomingPayButton =
  !!userEnrollment &&
  isPayableStatus &&
  !canPayNow &&
  !isPaymentWindowClosed &&
  !!paymentOpenDate;
const showClosedPayState = !!userEnrollment && isPayableStatus && isPaymentWindowClosed;

const showDecisionBlock =
  !!userEnrollment && isPayableStatus && canPayNow && !targetReached;

const { data: seminarMaterials = [], isLoading: materialsLoading } = useQuery({
  queryKey: ["seminar-materials", seminarId, user?.id || "anon", materialsAccessMode, hasStarted],
  enabled: canRequestMaterials,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_accessible_seminar_materials", {
      p_seminar_id: seminarId,
    });

    if (error) throw error;

    const normalized = normalizeSeminarMaterials(data || []);

    return Promise.all(
      normalized.map(async (material) => {
        if (material.type !== "file" || !material.bucket || !material.path) {
          return material;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(material.bucket)
          .createSignedUrl(material.path, 60 * 60);

        if (signedError) {
          console.warn("signed seminar material error", signedError?.message || signedError);
          return material;
        }

        return {
          ...material,
          url: signedData?.signedUrl || material.url,
        };
      })
    );
  },
  staleTime: 1000 * 60 * 5,
});

  // Bloque "modelo economico" como Base44
  const platformFee = targetIncome * (platformFeePercent / 100);
  const professorNet = targetIncome - platformFee;

  const enrollMutation = useMutation({
	    mutationFn: async () => {
	      if (!user) {
	        const nextUrl = `${location.pathname}${location.search || ""}`;
	        navigate(`/login?next=${encodeURIComponent(nextUrl)}`);
	        return null;
	      }
	      if (isInterestOnly) {
	        throw new Error(
	          t(
	            "seminar_interest_only_payment_window_help",
	            "Mientras solo captes interesados no se habilitan inscripciones, pagos ni bonos. Define fechas para abrir el flujo normal."
	          )
	        );
	      }
	      if (!contactProfileComplete) {
	        navigate(buildContactOnboardingUrl(`${location.pathname}${location.search || ""}`));
        throw new Error(
          t(
            "contact_profile_required_enroll",
            "Completa tu perfil de contacto antes de inscribirte."
          )
        );
      }
      if (isFull) {
        throw new Error(
          t(
            "seminar_full",
            "No quedan cupos disponibles. Explora otros seminarios o espera una nueva fecha."
          )
        );
      }
      if (isEnded) {
        throw new Error(
          t(
            "seminar_ended",
            "Este seminario ya finalizó. Explora otros seminarios disponibles."
          )
        );
      }
      if (isEnrollClosedForPayments) {
        throw new Error(
          t(
            "enrollments_closed_payment_window",
            "Inscripciones cerradas: la ventana de pagos ya comenzó."
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

  // Estados definitivos
  status: "enrolled",        // solo UI / funcional
  payment_status: "unpaid",  // UNICA verdad de pago

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
      if (referralCode) {
        clearReferralStateForSeminar(seminarId);
      }
      // No pagamos aquí: el pago se maneja en la ventana configurada (ProcessPayment / quote_price)
    },
    onError: (err) => {
      const rawMessage = String(err?.message || "");
      const isDuplicateEnrollment =
        err?.code === "23505" ||
        rawMessage.includes("enrollments_unique_student_seminar") ||
        rawMessage.toLowerCase().includes("duplicate key value violates unique constraint");

      if (isDuplicateEnrollment) {
        queryClient.invalidateQueries({ queryKey: ["seminar-enrollments", seminarId] });
        queryClient.invalidateQueries({ queryKey: ["seminar-enrollment-count", seminarId] });
        setShowEnrollDialog(false);
        toast.error(t("already_enrolled", "¡Ya estás inscrito!"));
        return;
      }

      toast.error(
        err?.message ||
          t("enroll_error", "No se pudo completar la inscripción. Intenta nuevamente.")
      );
    },
  });

  const cancelEnrollmentMutation = useMutation({
    mutationFn: async () => {
      if (!userEnrollment?.id) throw new Error("Enrollment missing");
      const { error } = await supabase.rpc("cancel_enrollment", {
        p_enrollment_id: userEnrollment.id,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success(t("cancel_enrollment_success", "Inscripción cancelada"));
      queryClient.invalidateQueries({ queryKey: ["seminar-enrollments", seminarId] });
      queryClient.invalidateQueries({ queryKey: ["seminar-enrollment-count", seminarId] });
    },
    onError: (err) =>
      toast.error(
        err?.message || t("cancel_enrollment_error", "No se pudo cancelar la inscripción")
      ),
  });

  const interestRequestMutation = useMutation({
    mutationFn: async () => {
      if (!seminarId || !interestSourceType) {
        throw new Error(t("seminar_interest_unavailable", "Esta solicitud no esta disponible para este seminario."));
      }
      const fullName = String(interestForm.full_name || "").trim();
      const email = String(interestForm.email || "").trim().toLowerCase();

      if (!fullName) {
        throw new Error(t("seminar_interest_name_required", "Tu nombre es obligatorio."));
      }

      if (!email) {
        throw new Error(t("seminar_interest_email_required", "Tu correo es obligatorio."));
      }

      const existingRequest = await fetchExistingInterestRequest(email);
      if (existingRequest?.request_id) {
        return {
          requestId: existingRequest.request_id,
          alreadyExisted: true,
        };
      }

      const { data: requestId, error } = await supabase.rpc("submit_seminar_interest_request", {
        p_seminar_id: seminarId,
        p_full_name: fullName,
        p_email: email,
        p_phone: interestForm.phone || null,
        p_country_code: residenceCountryCode || null,
        p_preferred_language: language || null,
        p_message: interestForm.message || null,
        p_source_type: interestSourceType,
        p_invited_by_request_id:
          interestSourceType === "prelaunch" ? interestInviterRequestId || null : null,
      });

      if (error) throw error;
      return {
        requestId: requestId || null,
        alreadyExisted: false,
      };
    },
    onSuccess: ({ requestId, alreadyExisted }) => {
      setShowInterestDialog(false);
      if (requestId) {
        setOwnInterestRequestId(requestId);
        storeInterestShareRequestId({ seminarId, requestId });
      }
      clearStoredInterestInviterRequestIdForSeminar(seminarId);
      toast.success(
        alreadyExisted
          ? t(
              "seminar_interest_already_registered",
              "Ya registraste tu interes en este seminario."
            )
          : interestSourceType === "prelaunch"
            ? t(
                "seminar_interest_success_with_invite",
                "Tu solicitud fue registrada. Ahora tambien puedes invitar a otras personas interesadas para ayudar a que este seminario abra inscripciones."
              )
            : t(
                "seminar_interest_success",
                "Tu solicitud fue registrada. El profesor o el equipo de Okalab podran contactarte si este seminario abre inscripciones o si se publica una nueva edicion."
              )
      );
      if (interestSourceType === "prelaunch" && requestId) {
        setShowShareDialog(true);
      }
    },
    onError: (err) => {
      toast.error(
        err?.message ||
          t(
            "seminar_interest_error",
            "No se pudo registrar tu solicitud. Intenta nuevamente."
          )
      );
    },
  });

  const copyReferralLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = useMemo(() => {
    const base = buildPublicAppUrl(`/seminars/${seminarId}`);
    if (interestSourceType === "prelaunch" && resolvedInterestRequestId) {
      return buildPublicAppUrl(buildInterestInviteUrl(seminarId, resolvedInterestRequestId));
    }
    if (userEnrollment?.id) return `${base}?ref=${userEnrollment.id}`;
    return base;
  }, [seminarId, resolvedInterestRequestId, interestSourceType, userEnrollment?.id]);

  const interestSourceLabel = interestSourceType
    ? getSeminarInterestSourceLabel(interestSourceType, t)
    : "";
  const interestDialogTitle =
    interestSourceType === "prelaunch"
      ? t("seminar_interest_prelaunch_title", "Solicitar apertura")
      : isCompleted
        ? t("seminar_interest_reopen_title", "Solicitar reapertura")
        : t("seminar_interest_full_title", "Unirme a la lista de interes");
  const interestDialogDescription =
    interestSourceType === "prelaunch"
      ? t(
          "seminar_interest_prelaunch_note",
          "Este seminario aun no tiene fechas definidas. Deja tus datos para que te avisen cuando abra inscripciones."
        )
      : isCompleted
        ? t(
            "seminar_interest_completed_note",
            "Este seminario ya finalizo, pero puedes dejar tus datos para una nueva edicion."
          )
        : t(
            "seminar_interest_full_note",
            "Este seminario ya lleno sus cupos. Deja tus datos para avisarte si se abre una nueva edicion."
          );

  const shareMessage = useMemo(() => {
    const msg =
      interestSourceType === "prelaunch"
        ? t(
            "seminar_interest_share_message",
            "Me interesa este seminario en Okalab. Si a ti tambien te interesa, solicita apertura aqui:"
          )
        : t("share_message", "Mira este seminario en Okalab:");
    return `${msg}\n${shareUrl}`;
  }, [shareUrl, interestSourceType, t]);

  const waShare = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
    [shareMessage]
  );
  const fbShare = useMemo(
    () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    [shareUrl]
  );
  const lnShare = useMemo(
    () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    [shareUrl]
  );
  const tgShare = useMemo(
    () =>
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`,
    [shareUrl, shareMessage]
  );
  const xShare = useMemo(
    () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`,
    [shareMessage]
  );
  const emailShare = useMemo(() => {
    const subject = seminar?.title ? `Okalab: ${seminar.title}` : "Okalab";
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, seminar?.title]);

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: seminar?.title || "Okalab",
        text: t("share_message", "Mira este seminario en Okalab:"),
        url: shareUrl,
      });
    } catch {
      // usuario canceló o error, no hacemos nada
    }
  };

  const ModalityIcon = seminar ? (modalityIcons[seminar.modality] || Monitor) : Monitor;
  const assetBase = import.meta.env.BASE_URL || "/";
  const fallbackHeroImage = `${assetBase}assets/hero.webp`;
  const seminarCover = normalizeSeminarCover(seminar, fallbackHeroImage);
  const heroImageSrc = seminarCover.imageSrc;

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
              {seminarCover.type === "youtube" && seminarCover.videoUrl ? (
                <a
                  href={seminarCover.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>{t("watch_video", "Ver video")}</span>
                </a>
              ) : null}
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
                    {seminar.total_hours ? `${seminar.total_hours} ${t("hours", "horas")}` : "-"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <ModalityIcon className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs text-slate-500">{t("modality", "Modalidad")}</p>
                  <p className="font-semibold capitalize">{seminar.modality ? t(seminar.modality, seminar.modality) : "-"}</p>
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
                      {professorProfileId ? (
                        <Link to={`/teachers/${professorProfileId}`} className="flex items-center gap-4 hover:opacity-90 transition">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {seminar.professor_name?.[0]?.toUpperCase() || "P"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {seminar.professor_name || t("professor", "Profesor")}
                            </p>
                          </div>
                        </Link>
                      ) : (
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
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="materials" className="mt-6">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    {materialsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                      </div>
                    ) : seminarMaterials.length > 0 ? (
                      <div className="space-y-3">
                        {seminarMaterials.map((material) =>
                          material.url ? (
                            <a
                              key={material.id}
                              href={material.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              <div className="p-2 bg-white rounded-lg">
                                {material.type === "youtube" ? (
                                  <Video className="h-5 w-5 text-purple-600" />
                                ) : material.type === "link" ? (
                                  <ExternalLink className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <FileText className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-slate-900">{material.title}</p>
                                  {material.isPreviewPublic ? (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                      {t("material_preview_public_badge", "Vista previa")}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-slate-500">
                                  {material.type === "youtube"
                                    ? t("seminar_cover_youtube", "Video YouTube")
                                    : material.type === "link"
                                      ? t("open_link", "Abrir enlace")
                                      : t("download", "Descargar")}
                                </p>
                              </div>
                              {material.type === "file" ? (
                                <Download className="h-5 w-5 text-slate-400" />
                              ) : (
                                <ExternalLink className="h-5 w-5 text-slate-400" />
                              )}
                            </a>
                          ) : (
                            <div
                              key={material.id}
                              className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl"
                            >
                              <div className="p-2 bg-white rounded-lg">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-slate-900">{material.title}</p>
                                  {material.isPreviewPublic ? (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                      {t("material_preview_public_badge", "Vista previa")}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-slate-500">
                                  {t(
                                    "materials_link_unavailable",
                                    "Este archivo se habilitará cuando tu acceso quede confirmado."
                                  )}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                        {!canAccessMaterials ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            {t(
                              "materials_preview_note",
                              "Estos materiales se comparten antes del pago. Si el profesor añadió otros materiales privados, se desbloquean según las reglas del seminario."
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : canAccessMaterials ? (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          {t(
                            "materials_empty_private",
                            "El profesor aun no ha cargado materiales para este seminario."
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          {!!userEnrollment && !isEnrollmentPaid
                            ? t(
                                "materials_payment_required",
                                "Tu pago debe estar aprobado para acceder a los materiales."
                              )
                            : !!userEnrollment && isEnrollmentPaid && !materialsReleasedForPaidStudents
                              ? t(
                                  "materials_start_date_locked",
                                  "Los materiales se habilitan en la fecha de inicio del seminario."
                                )
                              : t(
                                  "materials_enroll_and_pay_to_access",
                                  "Inscribete y paga para acceder a los materiales."
                                )}
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
            {(seminar.modality === "presential" || seminar.modality === "hybrid") ? (
              <LocationInfo seminar={seminar} />
            ) : null}

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

              const platform = getVideoConferencePlatformLabel(seminar, t);
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
                      - {t("professor_receives", "Profesor recibe")}: ${professorNet.toFixed(2)} ({t("after_fee", "despues de")} {platformFeePercent}% {t("fee_commission", "comision")})
                    </li>
                    <li>- {t("platformFee", "Comision plataforma")}: ${platformFee.toFixed(2)}</li>
                  </ul>
                ) : null}
              </CardContent>
            </Card>

            {/* Pricing Card (igual Base44) */}
            <Card className="border-0 shadow-xl sticky top-24">
              <CardContent className="p-6 space-y-6">
	                <div className="text-center">
	                  <p className="text-sm text-slate-500">
	                    {isInterestOnly
	                      ? t("interest_only", "Captando interesados")
	                      : t("price_estimated_now", "Precio estimado si pagas ahora")}
	                  </p>
	                  <p className="text-4xl font-bold text-slate-900 mt-1">
	                    {isInterestOnly
	                      ? t("seminar_interest_only_date_tbd", "Fecha por definir")
	                      : `$${estimatedPriceNow.toFixed(2)}`}
	                  </p>
	                  {!isInterestOnly ? (
	                    <>
	                      <LocalCurrencyReference
	                        usdAmount={estimatedPriceNow}
	                        countryCode={residenceCountryCode}
	                        settings={platformSettings}
	                        language={language}
	                        t={t}
	                        className="mt-4 text-left"
	                      />
	                      {user && !residenceCountryCode ? (
	                        <p className="mt-3 text-xs text-slate-500">
	                          {t(
	                            "seminar_country_hint",
	                            "Selecciona tu pais de residencia en tu perfil para ver la referencia en tu moneda y los metodos de pago correctos."
	                          )}
	                        </p>
	                      ) : null}

	                      {targetIncome > 0 && (
	                        <Badge variant="secondary" className="mt-2 bg-emerald-100 text-emerald-700">
	                          <TrendingDown className="h-3 w-3 mr-1" />
	                          {discountText}
	                        </Badge>
	                      )}
	                    </>
	                  ) : null}
	                </div>

	                <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-900">
	                  {paymentWindowNoteText}
	                </div>

                  {!isInterestOnly && (paymentOpenDate || paymentCloseDate) && !isPaymentWindowClosed ? (
                    <PaymentWindowCountdown
                      targetDate={canPayNow ? paymentCloseDate : paymentOpenDate}
                      mode={canPayNow ? "close" : "open"}
                      t={t}
                    />
                  ) : null}
              
                
	                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{t("targetIncome", "Ingreso objetivo")}:</span>
                      <span className="font-semibold">${targetIncome}</span>
                    </div>
	                    <div className="flex items-center justify-between text-sm">
	                      <span className="text-slate-600">{t("target_goal_slots_label", "Cupos (objetivo)")}:</span>
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
                    {isInterestOnly
                      ? t(
                          "seminar_interest_only_capacity_note",
                          "Muestra tu objetivo y capacidad para captar demanda antes de fijar calendario."
                        )
                      : t("priceExplanation", "Mientras mas estudiantes se inscriban, menor sera el precio para cada uno.")}
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

                    {showDecisionBlock && (
                      <div className="p-4 bg-amber-50 rounded-xl text-sm text-amber-900 space-y-3">
                        <p>
                          {t(
                            "payment_window_open_only_enrolled",
                            "Pagos abiertos: puedes pagar o cancelar tu inscripción."
                          )}
                        </p>
                        <div className="grid gap-2">
                          <Button
                            onClick={() =>
                              navigate(`/process-payment?enrollment_id=${userEnrollment.id}`)
                            }
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {t("pay", "Pagar")}
                          </Button>
                          <Button variant="outline" onClick={() => cancelEnrollmentMutation.mutate()}>
                            {t("cancel_enrollment", "Cancelar inscripción")}
                          </Button>
                        </div>
                      </div>
                    )}

	                    {!showDecisionBlock && showPayButton && (
	                      <Button
	                        onClick={() =>
	                          navigate(`/process-payment?enrollment_id=${userEnrollment.id}`)
	                        }
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base"
                      >
	                        {t("pay", "Pagar")} ${payableAmount.toFixed(2)}
	                      </Button>
	                    )}

                        {!showDecisionBlock && showUpcomingPayButton && (
                          <Button
                            disabled
                            className="w-full h-auto py-3 bg-slate-300 text-slate-700 hover:bg-slate-300 cursor-not-allowed whitespace-normal text-center"
                          >
                            {t("payment_available_on", "Pagar disponible el {date}").replace(
                              "{date}",
                              paymentOpenDate ? fmtDateLong(paymentOpenDate, language) : "-"
                            )}
                          </Button>
                        )}

                        {!showDecisionBlock && showClosedPayState && (
                          <div className="space-y-3">
                            <div className="p-4 bg-amber-50 rounded-xl text-amber-900 text-sm">
                              {t("payment_window_closed_note", "La ventana de pago cerró el {close}.").replace(
                                "{close}",
                                paymentCloseDate ? fmtDateLong(paymentCloseDate, language) : "-"
                              )}
                            </div>
                            <Button
                              disabled
                              className="w-full h-12 bg-slate-400 text-white cursor-not-allowed"
                            >
                              {t("payment_window_closed_button", "Ventana de pago cerrada")}
                            </Button>
                          </div>
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
                ) : canRequestInterest ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-900 text-sm">
                      {hasRegisteredInterest
                        ? interestSourceType === "prelaunch"
                          ? t(
                              "seminar_interest_prelaunch_registered_note",
                              "Ya registraste tu interes en este seminario. Ahora puedes invitar a otras personas interesadas para ayudar a que abra inscripciones."
                            )
                          : isCompleted
                            ? t(
                                "seminar_interest_completed_registered_note",
                                "Ya solicitaste una nueva edicion de este seminario. Te contactaran si se reabre."
                              )
                            : t(
                                "seminar_interest_full_registered_note",
                                "Ya te uniste a la lista de interes de este seminario. Te contactaran si se libera o abre una nueva edicion."
                              )
                        : interestSourceType === "prelaunch"
                        ? t(
                            "seminar_interest_prelaunch_public_note",
                            "Este seminario se esta mostrando para captar interesados. Deja tus datos y te avisaremos cuando abra inscripciones."
                          )
                        : isCompleted
                        ? t(
                            "seminar_interest_completed_public_note",
                            "Este seminario ya finalizo. Puedes dejar tus datos para solicitar una nueva edicion."
                          )
                        : t(
                            "seminar_interest_full_public_note",
                            "Los cupos ya se llenaron. Puedes dejar tus datos para que te contacten si se reabre."
                          )}
                    </div>
                    {hasRegisteredInterest ? (
                      <Button
                        disabled
                        className="w-full h-12 bg-slate-400 text-white cursor-not-allowed text-base"
                      >
                        {t("seminar_interest_registered_button", "Solicitud registrada")}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowInterestDialog(true)}
                        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-base"
                      >
                        {interestSourceType === "prelaunch"
                          ? t("seminar_request_opening", "Solicitar apertura")
                          : isCompleted
                          ? t("seminar_request_reopen", "Solicitar reapertura")
                          : t("seminar_join_interest_list", "Unirme a la lista de interes")}
                      </Button>
                    )}
                    {interestSourceType === "prelaunch" && canShareInterestDemand ? (
                      <Button
                        variant="outline"
                        onClick={() => setShowShareDialog(true)}
                        className="w-full h-12 text-base"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        {t("seminar_interest_invite_friends", "Invitar amigos")}
                      </Button>
                    ) : null}
                    {interestSourceType === "prelaunch" && !canShareInterestDemand ? (
                      <p className="text-xs text-slate-500 text-center">
                        {t(
                          "seminar_interest_invite_after_request",
                          "Despues de solicitar apertura podras invitar a otras personas interesadas."
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : isEnded ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-900 text-sm">
                      {t(
                        "seminar_ended",
                        "Este seminario ya finalizó. Explora otros seminarios disponibles."
                      )}
                    </div>
                    <Button
                      disabled
                      className="w-full h-12 bg-slate-400 text-white cursor-not-allowed"
                    >
                      {t("seminar_ended_button", "Seminario finalizado")}
                    </Button>
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
                ) : isEnrollClosedForPayments ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-900 text-sm">
                      {t(
                        "enrollments_closed_payment_window",
                        "Inscripciones cerradas: la ventana de pagos ya comenzó."
                      )}
                    </div>
                    <Button
                      disabled
                      className="w-full h-12 bg-slate-400 text-white cursor-not-allowed"
                    >
                      {t("enrollments_closed", "Inscripciones cerradas")}
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

                {enrollmentCount > 0 && targetIncome > 0 && !targetReached && !isInterestOnly && (
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t("currentPrice", "Precio actual")}:</span>
                <span className="text-lg font-semibold">${estimatedPriceNow.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t("price_after_enroll", "Precio con tu inscripción")}:</span>
                <span className="text-2xl font-bold">${priceAfterEnroll.toFixed(2)}</span>
              </div>
              <LocalCurrencyReference
                usdAmount={estimatedPriceNow}
                countryCode={residenceCountryCode}
                settings={platformSettings}
                language={language}
                t={t}
                showRate={false}
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-900">
              {paymentWindowNoteText}
              <div className="mt-1">
                {minPriceGoalText} <b>${minPrice.toFixed(2)}</b>.
              </div>
            </div>

            {referralCode && (
              <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                {t("invited_enrollment_note", "¡Fuiste invitado! Tu inscripción ayuda a reducir el precio para todos.")}
              </div>
            )}

            {isFull && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-900">
                {t(
                  "seminar_full",
                  "No quedan cupos disponibles. Explora otros seminarios o espera una nueva fecha."
                )}
              </div>
            )}
            {isEnded && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-900">
                {t(
                  "seminar_ended",
                  "Este seminario ya finalizó. Explora otros seminarios disponibles."
                )}
              </div>
            )}
            {isEnrollClosedForPayments && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-900">
                {t(
                  "enrollments_closed_payment_window",
                  "Inscripciones cerradas: la ventana de pagos ya comenzó."
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
              disabled={enrollMutation.isPending || isFull || isEnded || isEnrollClosedForPayments}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {enrollMutation.isPending ? t("common_processing", "Procesando...") : t("confirm_enroll", "Confirmar inscripción")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={showInterestDialog} onOpenChange={setShowInterestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{interestDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
              <p className="font-medium text-slate-900">{seminar.title}</p>
              <p>{interestDialogDescription}</p>
              {interestSourceLabel ? <Badge variant="outline">{interestSourceLabel}</Badge> : null}
            </div>

            <div className="grid gap-3">
              <Input
                value={interestForm.full_name}
                onChange={(e) =>
                  setInterestForm((current) => ({ ...current, full_name: e.target.value }))
                }
                placeholder={t("seminar_interest_name", "Nombre completo")}
              />
              <Input
                type="email"
                value={interestForm.email}
                onChange={(e) =>
                  setInterestForm((current) => ({ ...current, email: e.target.value }))
                }
                placeholder={t("seminar_interest_email", "Correo electronico")}
              />
              {showInterestDialog && isValidInterestEmail(dialogInterestEmail) ? (
                isCheckingDialogInterestRequest ? (
                  <p className="text-xs text-slate-500">
                    {t(
                      "seminar_interest_lookup_checking",
                      "Verificando si este correo ya registro interes..."
                    )}
                  </p>
                ) : dialogExistingInterestRequest?.request_id ? (
                  <p className="text-xs text-amber-700">
                    {t(
                      "seminar_interest_lookup_note",
                      "Ya existe una solicitud registrada con este correo para este seminario."
                    )}
                  </p>
                ) : null
              ) : null}
              <Input
                value={interestForm.phone}
                onChange={(e) =>
                  setInterestForm((current) => ({ ...current, phone: e.target.value }))
                }
                placeholder={t("seminar_interest_phone", "Telefono o WhatsApp (opcional)")}
              />
              <Textarea
                value={interestForm.message}
                onChange={(e) =>
                  setInterestForm((current) => ({ ...current, message: e.target.value }))
                }
                rows={4}
                placeholder={t(
                  "seminar_interest_message",
                  "Deja un comentario si quieres que te contacten cuando haya una nueva edicion."
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterestDialog(false)}>
              {t("common_cancel", "Cancelar")}
            </Button>
            <Button
              onClick={() => interestRequestMutation.mutate()}
              disabled={interestRequestMutation.isPending || !!dialogExistingInterestRequest?.request_id}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {interestRequestMutation.isPending
                ? t("common_processing", "Procesando...")
                : dialogExistingInterestRequest?.request_id
                  ? t("seminar_interest_registered_button", "Solicitud registrada")
                : interestSourceType === "prelaunch"
                  ? t("seminar_request_opening", "Solicitar apertura")
                : isCompleted
                  ? t("seminar_request_reopen", "Solicitar reapertura")
                  : t("seminar_join_interest_list", "Unirme a la lista de interes")}
            </Button>
            {interestSourceType === "prelaunch" && dialogExistingInterestRequest?.request_id ? (
              <Button
                variant="outline"
                onClick={() => {
                  setOwnInterestRequestId(dialogExistingInterestRequest.request_id);
                  storeInterestShareRequestId({
                    seminarId,
                    requestId: dialogExistingInterestRequest.request_id,
                  });
                  setShowInterestDialog(false);
                  setShowShareDialog(true);
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {t("seminar_interest_invite_friends", "Invitar amigos")}
              </Button>
            ) : null}
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
      <LocalCurrencyReference
        usdAmount={payableAmount}
        countryCode={residenceCountryCode}
        settings={platformSettings}
        language={language}
        t={t}
      />

      <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-900">
        <b>{t("important", "Importante:")}</b> {t("payment_pending_admin", "este pago queda")} <b>{t("pending", "pendiente")}</b> {t("payment_pending_admin_suffix", "hasta que un administrador lo apruebe (flujo del modelo económico).")}
      </div>

      {!canPayNow && (
        <div className="p-3 bg-red-50 rounded-xl text-sm text-red-800">
          {t(
            "payment_wait_full_or_window",
            "Aún no puedes pagar: el seminario debe llenarse o entrar en la ventana de pago."
          )}
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowPayDialog(false)}>
        {t("common_cancel", "Cancelar")}
      </Button>
      <Button
        onClick={() => {
          setShowPayDialog(false);
          navigate(`/process-payment?enrollment_id=${userEnrollment.id}`);
        }}
        disabled={!canPayNow}
        className="bg-slate-900 hover:bg-slate-800"
      >
        {t("confirm_payment", "Confirmar pago")}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Share Dialog (igual Base44 idea) */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {interestSourceType === "prelaunch"
                ? t("seminar_interest_invite_friends", "Invitar amigos")
                : t("invite", "Invitar")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-slate-600">
              {interestSourceType === "prelaunch"
                ? t(
                    "seminar_interest_share_note",
                    "Comparte este enlace para sumar personas interesadas. Los bonos economicos solo aplican cuando el seminario abra inscripciones y se cumplan las condiciones normales."
                  )
                : t(
                    "share_link_note",
                    "Comparte este enlace. Tu invitacion ayudara a bajar el precio y luego podras ganar incentivos."
                  )}
            </p>

            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="bg-slate-50"
              />
              <Button onClick={copyReferralLink} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
    </div>
  );
}


