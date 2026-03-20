// ProcessPayment.jsx (UNIFIED)
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";
import LocalCurrencyReference from "../Components/payments/LocalCurrencyReference";
import { normalizeCountryCode } from "../utils/countries";
import { getIntlLocale } from "../utils/dateLocale";
import { resolvePaymentWindow } from "../utils/paymentWindow";

import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../Components/ui/dialog";
import { Textarea } from "../Components/ui/textarea";

import { motion } from "framer-motion";
import { toast } from "sonner";
import { getPaymentStatusLabel } from "../utils/paymentStatus";
import {
  clampWalletAmount,
  OKALAB_WALLET_MIN_APPLY,
  OKALAB_WALLET_PAYMENT_CODE,
} from "../utils/payouts";
import { ArrowLeft, CreditCard, Loader2, Check, AlertCircle, X, Copy, ExternalLink } from "lucide-react";

const PAYMENT_METHOD_LANGUAGES = ["es", "en", "fr", "ht"];

const sortBySortOrder = (a, b) => {
  const orderA = Number(a?.sort_order || 0);
  const orderB = Number(b?.sort_order || 0);
  if (orderA !== orderB) return orderA - orderB;
  return String(a?.field_key || a?.code || a?.id || "").localeCompare(
    String(b?.field_key || b?.code || b?.id || "")
  );
};

const getLocalizedText = (value, currentLanguage, fallbackLanguage = "es") => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const preferredLanguages = [
    currentLanguage,
    fallbackLanguage,
    ...PAYMENT_METHOD_LANGUAGES.filter((lang) => lang !== currentLanguage && lang !== fallbackLanguage),
  ];

  for (const languageCode of preferredLanguages) {
    const text = value?.[languageCode];
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return (
    Object.values(value).find((item) => typeof item === "string" && item.trim())?.trim() || ""
  );
};

const isMethodVisibleForLanguage = (method, currentLanguage) => {
  const languages = Array.isArray(method?.visible_languages) ? method.visible_languages.filter(Boolean) : [];
  return languages.length === 0 || languages.includes(currentLanguage);
};

const isMethodVisibleForCountry = (method, countryCode) => {
  const countries = Array.isArray(method?.visible_countries) ? method.visible_countries.filter(Boolean) : [];
  return countries.length === 0 || (countryCode ? countries.includes(countryCode) : false);
};

const mapDynamicPaymentMethod = (method, currentLanguage) => {
  const fields = Array.isArray(method?.payment_method_fields)
    ? method.payment_method_fields
        .filter((field) => field?.enabled !== false)
        .sort(sortBySortOrder)
        .map((field) => {
          const localizedFieldValue =
            getLocalizedText(field?.field_value_i18n, currentLanguage) ||
            (typeof field?.field_value === "string" ? field.field_value.trim() : "");

          return {
            ...field,
            label: getLocalizedText(field?.label_i18n, currentLanguage) || field?.field_key || "",
            helpText: getLocalizedText(field?.help_text_i18n, currentLanguage),
            field_value: localizedFieldValue,
          };
        })
    : [];

  const primaryUrlField = fields.find((field) => field.field_type === "url" && field.field_value);

  return {
    ...method,
    title: getLocalizedText(method?.title_i18n, currentLanguage) || method?.code || method?.provider || "Metodo",
    description: getLocalizedText(method?.description_i18n, currentLanguage),
    instructions: getLocalizedText(method?.instructions_i18n, currentLanguage),
    fields,
    externalUrl: primaryUrlField?.field_value || "",
  };
};

const buildLegacyPaymentMethods = (settings, t) => {
  const methods = [];

  if (settings?.enable_transfer ?? true) {
    methods.push({
      code: "transfer",
      kind: "manual",
      provider: "bank_transfer",
      title: t("payment_method_transfer", "Transferencia"),
      description: "",
      instructions: settings?.bank_notes || "",
      externalUrl: "",
      fields: [
        {
          field_key: "bank_name",
          label: t("bank_name", "Banco"),
          helpText: "",
          field_type: "text",
          field_value: settings?.bank_name || "",
          copyable: false,
        },
        {
          field_key: "bank_account_name",
          label: t("bank_account_name", "Titular"),
          helpText: "",
          field_type: "text",
          field_value: settings?.bank_account_name || "",
          copyable: false,
        },
        {
          field_key: "bank_account_number",
          label: t("bank_account_number", "Cuenta"),
          helpText: "",
          field_type: "text",
          field_value: settings?.bank_account_number || "",
          copyable: true,
        },
        {
          field_key: "bank_iban",
          label: "IBAN",
          helpText: "",
          field_type: "text",
          field_value: settings?.bank_iban || "",
          copyable: true,
        },
        {
          field_key: "bank_swift",
          label: "SWIFT",
          helpText: "",
          field_type: "text",
          field_value: settings?.bank_swift || "",
          copyable: true,
        },
      ].filter((field) => field.field_value),
    });
  }

  if (settings?.enable_paypal) {
    const paypalLink = (settings?.paypal_link || "").trim();
    methods.push({
      code: "paypal",
      kind: "manual",
      provider: "paypal",
      title: "PayPal",
      description: "",
      instructions: "",
      externalUrl: paypalLink,
      fields: paypalLink
        ? [
            {
              field_key: "paypal_link",
              label: "PayPal",
              helpText: "",
              field_type: "url",
              field_value: paypalLink,
              copyable: true,
            },
          ]
        : [],
    });
  }

  if (settings?.enable_cash) {
    methods.push({
      code: "cash",
      kind: "manual",
      provider: "cash",
      title: t("payment_method_cash", "Efectivo"),
      description: "",
      instructions: "",
      externalUrl: "",
      fields: [],
    });
  }

  if (settings?.enable_card) {
    methods.push({
      code: "card",
      kind: "gateway",
      provider: "card",
      title: t("payment_method_card", "Tarjeta"),
      description: "",
      instructions: "",
      externalUrl: "",
      fields: [],
    });
  }

  return methods;
};

export default function ProcessPayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, loading, role } = useAuth();
  const { t, language } = useLanguage();
  const residenceCountryCode = normalizeCountryCode(profile?.country_code);

  const urlParams = new URLSearchParams(window.location.search);
  const enrollmentId = urlParams.get("enrollment_id");
  const mode = urlParams.get("mode") || "student";
  const prefillWalletMode = urlParams.get("prefill_wallet") || "";
  const isAdminMode = mode === "admin";
  const shouldPrefillMaxWallet = prefillWalletMode === "max";

  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [walletAmountInput, setWalletAmountInput] = useState("");
  const walletPrefillAppliedRef = useRef(false);
  // Modal de rechazo (admin)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const adminReturnUrl = "/admin/enrollments";

  if (!enrollmentId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("error", "Error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">{t("payment_missing_enrollment", "Falta enrollment_id")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminMode && role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("access_restricted_title", "Acceso restringido")}</h2>
            <p className="text-slate-600 mb-4">{t("admin_only_process_payments", "Solo un administrador puede procesar pagos.")}</p>
            <Link to="/my-seminars">
              <Button variant="outline">{t("common_back", "Volver")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollment", enrollmentId],
    enabled: !!enrollmentId && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("id", enrollmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: seminar, isLoading: seminarLoading } = useQuery({
    queryKey: ["seminar", enrollment?.seminar_id],
    enabled: !!enrollment?.seminar_id && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .eq("id", enrollment.seminar_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", enrollment?.seminar_id],
    enabled: !!enrollment?.seminar_id && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("quote_price", {
        p_seminar_id: enrollment.seminar_id,
      });
      if (error) throw error;
      return (data && data[0]) || null;
    },
  });

  const { data: enrollmentStats = [], isLoading: enrollmentCountLoading } = useQuery({
    queryKey: ["seminar-enrollment-count", enrollment?.seminar_id],
    enabled: !!enrollment?.seminar_id && !!user && !loading,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: [enrollment.seminar_id],
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("process payment enrollment count error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: paymentSettings } = useQuery({
    queryKey: ["platform_settings_payment"],
    enabled: !!user && !loading && !isAdminMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select(
          [
            "enable_transfer",
            "enable_paypal",
            "enable_card",
            "enable_cash",
            "bank_name",
            "bank_account_name",
            "bank_account_number",
            "bank_iban",
            "bank_swift",
            "bank_notes",
            "paypal_link",
            "usd_to_dop",
            "usd_to_htg",
          ].join(",")
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? {};
    },
    staleTime: 1000 * 60 * 5,
  });

  const walletEmail = user?.email?.toLowerCase() || "";
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", walletEmail],
    enabled: !!walletEmail && !loading && !isAdminMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("user_email, balance, pending_balance, total_earned, total_withdrawn")
        .ilike("user_email", walletEmail)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 1000 * 60,
  });

  const {
    data: paymentMethodsData = [],
    error: paymentMethodsError,
    isLoading: paymentMethodsLoading,
  } = useQuery({
    queryKey: ["payment_methods_public", language],
    enabled: !!user && !loading && !isAdminMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select(
          `
            id,
            code,
            kind,
            provider,
            enabled,
            visible_languages,
            visible_countries,
            title_i18n,
            description_i18n,
            instructions_i18n,
            public_config,
            sort_order,
            payment_method_fields (
              id,
              field_key,
              label_i18n,
              help_text_i18n,
              field_type,
              field_value,
              field_value_i18n,
              copyable,
              enabled,
              sort_order
            )
          `
        )
        .eq("enabled", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const legacyPaymentMethods = useMemo(
    () => buildLegacyPaymentMethods(paymentSettings || {}, t),
    [paymentSettings, t]
  );

  const dynamicPaymentMethods = useMemo(
    () =>
      Array.isArray(paymentMethodsData)
        ? paymentMethodsData.map((method) => mapDynamicPaymentMethod(method, language)).sort(sortBySortOrder)
        : [],
    [paymentMethodsData, language]
  );

  const languageVisibleDynamicPaymentMethods = useMemo(
    () => dynamicPaymentMethods.filter((method) => isMethodVisibleForLanguage(method, language)),
    [dynamicPaymentMethods, language]
  );

  const visibleDynamicPaymentMethods = useMemo(
    () =>
      languageVisibleDynamicPaymentMethods.filter((method) =>
        isMethodVisibleForCountry(method, residenceCountryCode)
      ),
    [languageVisibleDynamicPaymentMethods, residenceCountryCode]
  );

  const useLegacyPaymentMethods = !!paymentMethodsError || dynamicPaymentMethods.length === 0;
  const noVisibleDynamicPaymentMethodsForLanguage =
    !useLegacyPaymentMethods && dynamicPaymentMethods.length > 0 && languageVisibleDynamicPaymentMethods.length === 0;
  const noVisibleDynamicPaymentMethodsForCountry =
    !useLegacyPaymentMethods &&
    languageVisibleDynamicPaymentMethods.length > 0 &&
    visibleDynamicPaymentMethods.length === 0;
  const waitingForLegacySettings = useLegacyPaymentMethods && !isAdminMode && paymentSettings === undefined;

  const availablePaymentMethods = useMemo(
    () => (useLegacyPaymentMethods ? legacyPaymentMethods : visibleDynamicPaymentMethods),
    [legacyPaymentMethods, useLegacyPaymentMethods, visibleDynamicPaymentMethods]
  );

  useEffect(() => {
    if (availablePaymentMethods.length === 0) return;
    if (!availablePaymentMethods.some((method) => method.code === paymentMethodCode)) {
      setPaymentMethodCode(availablePaymentMethods[0].code);
    }
  }, [availablePaymentMethods, paymentMethodCode]);

  useEffect(() => {
    if (!paymentMethodsError) return;
    console.warn("process payment dynamic methods fallback", paymentMethodsError?.message || paymentMethodsError);
  }, [paymentMethodsError]);

  const selectedPaymentMethod = useMemo(
    () => availablePaymentMethods.find((method) => method.code === paymentMethodCode) || null,
    [availablePaymentMethods, paymentMethodCode]
  );

  const selectedMethodExternalUrl = (selectedPaymentMethod?.externalUrl || "").trim();
  const isCardBlocked = selectedPaymentMethod?.provider === "card";
  const isPaypalMissing = selectedPaymentMethod?.provider === "paypal" && !selectedMethodExternalUrl;

  const enrollmentCount = useMemo(() => {
    const row = Array.isArray(enrollmentStats) ? enrollmentStats[0] : enrollmentStats;
    const count = Number(row?.enrolled_count);
    return Number.isFinite(count) ? count : 0;
  }, [enrollmentStats]);

  const maxStudents = Number(seminar?.max_students || 0);
  const isFull = Number.isFinite(maxStudents) && maxStudents > 0 && enrollmentCount >= maxStudents;

  const paymentWindow = useMemo(
    () =>
      resolvePaymentWindow({
        seminarStartDate: seminar?.start_date,
        quote,
        forcePayOpen: isFull,
      }),
    [seminar?.start_date, quote, isFull]
  );

  const {
    paymentOpenDate,
    paymentCloseDate,
    isPaymentWindowClosed,
    canPayNow,
    isPaymentOpenByCapacity,
  } = paymentWindow;

  const targetIncome = Number(seminar?.target_income || 0);
  const targetStudents = Math.max(1, Number(seminar?.target_students || 15));
  const denominatorNow = Math.min(targetStudents, Math.max(1, enrollmentCount));
  const normalizedEnrollmentFinalPrice = Number(enrollment?.final_price);
  const hasEnrollmentFinalPrice =
    Number.isFinite(normalizedEnrollmentFinalPrice) && normalizedEnrollmentFinalPrice > 0;
  const fallbackAmountNow =
    (hasEnrollmentFinalPrice
      ? normalizedEnrollmentFinalPrice
      : targetIncome > 0
        ? targetIncome / denominatorNow
        : Number(seminar?.price || 0));
  const quotedAmountNow = Number(quote?.estimated_price_now);
  const amountNow =
    Number.isFinite(quotedAmountNow) && quotedAmountNow > 0
      ? (targetIncome > 0 ? Math.min(quotedAmountNow, fallbackAmountNow) : quotedAmountNow)
      : Number(fallbackAmountNow || 0);
  const availableWalletBalance = Math.max(0, Number(wallet?.balance || 0));
  const walletAppliedAmount = clampWalletAmount(walletAmountInput, availableWalletBalance, amountNow);
  const usesWalletBalance = walletAppliedAmount >= OKALAB_WALLET_MIN_APPLY;
  const externalAmountDue = Math.max(0, Number((amountNow - walletAppliedAmount).toFixed(2)));
  const requiresExternalPaymentMethod = externalAmountDue > 0;
  const walletCoversFullAmount = amountNow > 0 && externalAmountDue <= 0;

  useEffect(() => {
    walletPrefillAppliedRef.current = false;
  }, [enrollmentId, shouldPrefillMaxWallet]);

  useEffect(() => {
    if (isAdminMode || !shouldPrefillMaxWallet || walletPrefillAppliedRef.current || walletLoading) return;
    if (amountNow <= 0) return;

    const prefilledAmount = clampWalletAmount(availableWalletBalance, availableWalletBalance, amountNow);
    if (prefilledAmount > 0) {
      setWalletAmountInput(String(prefilledAmount));
    }

    walletPrefillAppliedRef.current = true;
  }, [
    amountNow,
    availableWalletBalance,
    isAdminMode,
    shouldPrefillMaxWallet,
    walletLoading,
  ]);

  const formatWindowDate = (value) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat(getIntlLocale(language), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(value);
  };

  const copyPaymentValue = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("copied", "Copiado"));
    } catch (error) {
      toast.error(error?.message || t("error", "Error"));
    }
  };

  const studentPayMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("auth_required", "Debes iniciar sesión."));
      if (!enrollmentId) throw new Error(t("payment_missing_enrollment", "Falta enrollment_id."));
      if (!enrollment) throw new Error(t("payment_enrollment_not_found", "Inscripción no encontrada."));
      if (!seminar) throw new Error(t("payment_seminar_not_found", "Seminario no encontrado."));
      if (requiresExternalPaymentMethod && !selectedPaymentMethod) {
        throw new Error(t("payment_methods_unavailable", "No hay metodos de pago disponibles ahora mismo."));
      }
      if (!residenceCountryCode) {
        throw new Error(
          t(
            "payment_country_required_body",
            "Antes de mostrar metodos de pago y moneda local, necesitamos tu pais de residencia actual."
          )
        );
      }

      // Seguridad: el enrollment debe pertenecer al usuario
      if (enrollment.student_id && enrollment.student_id !== user.id) {
        throw new Error(t("payment_not_allowed", "No tienes permiso para pagar esta inscripción."));
      }

      if (!canPayNow) {
        throw new Error(
          isPaymentWindowClosed
            ? t("payment_window_closed", "La ventana de pago no está abierta.")
            : t(
                "payment_wait_full_or_window",
                "Aún no puedes pagar: el seminario debe llenarse o entrar en la ventana de pago."
              )
        );
      }

      if (walletAmountInput && walletAppliedAmount <= 0) {
        throw new Error(
          t("wallet_amount_invalid_for_payment", "El monto de Saldo Okalab no es valido.")
        );
      }

      const { data, error } = await supabase.rpc("submit_enrollment_payment", {
        p_enrollment_id: enrollmentId,
        p_payment_method_code: requiresExternalPaymentMethod
          ? selectedPaymentMethod.code
          : OKALAB_WALLET_PAYMENT_CODE,
        p_payment_language: language,
        p_payment_country: residenceCountryCode,
        p_wallet_amount: walletAppliedAmount,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(
        requiresExternalPaymentMethod
          ? t("payment_submitted", "Pago registrado. Pendiente de validacion.")
          : t("wallet_payment_completed", "Pago completado con tu Saldo Okalab.")
      );
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      await queryClient.invalidateQueries({ queryKey: ["wallet", walletEmail] });
      const target = seminar?.id ? `/seminars/${seminar.id}` : "/seminars";
      setTimeout(() => navigate(target), 800);
    },
    onError: (err) => toast.error(err?.message || t("payment_process_error", "Error al procesar pago")),
  });

  const approvePaymentMutation = useMutation({
    mutationFn: async () => {
      if (role !== "admin") throw new Error(t("admin_only_approve_payments", "Solo admin puede aprobar pagos."));
      const { data, error } = await supabase.rpc("approve_enrollment_payment", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(t("payment_approved", "Pago aprobado"));
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (isAdminMode) {
        setTimeout(() => navigate(adminReturnUrl), 800);
      }
    },
    onError: (err) => toast.error(err?.message || t("payment_approve_error", "Error al aprobar pago")),
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (reason) => {
      if (role !== "admin") throw new Error(t("admin_only_reject_payments", "Solo admin puede rechazar pagos."));
      const { data, error } = await supabase.rpc("reject_enrollment_payment", {
        p_enrollment_id: enrollmentId,
        p_reason: reason || t("payment_reject_reason_admin", "Rechazado por admin"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(t("payment_rejected", "Pago rechazado"));
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      if (isAdminMode) {
        setTimeout(() => navigate(adminReturnUrl), 800);
      }
    },
    onError: (err) => toast.error(err?.message || t("payment_reject_error", "Error al rechazar pago")),
  });

  if (
    loading ||
    enrollmentLoading ||
    seminarLoading ||
    enrollmentCountLoading ||
    ((!isAdminMode && !!residenceCountryCode) ? paymentMethodsLoading : false) ||
    ((!isAdminMode && !!residenceCountryCode) ? waitingForLegacySettings : false)
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("common_loading", "Cargando…")}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("auth_login", "Inicia sesión")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">{t("payment_login_required", "Debes iniciar sesión para procesar pagos.")}</p>
            <Button className="w-full" onClick={() => navigate("/login")}>
              {t("auth_go_login", "Ir a login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!enrollment || !seminar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("not_found", "No encontrado")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">{t("payment_not_found", "No se encontró la inscripción o el seminario.")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((enrollment.payment_status || "").toLowerCase() === "paid") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("payment_already_processed", "Pago ya procesado")}</h2>
            <p className="text-slate-600 mb-4">{t("payment_already_paid", "Esta inscripción ya fue pagada")}</p>
            {isAdminMode ? (
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => navigate(adminReturnUrl)}>
                  {t("common_back", "Volver")}
                </Button>
                <Link to={`/seminars/${seminar.id}`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                    {t("viewSeminar", "Ver seminario")}
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to={`/seminars/${seminar.id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 mt-2">
                  {t("viewSeminar", "Ver seminario")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdminMode && !residenceCountryCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>{t("payment_country_required_title", "Pais de residencia requerido")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              {t(
                "payment_country_required_body",
                "Antes de mostrar metodos de pago y moneda local, necesitamos tu pais de residencia actual."
              )}
            </p>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              {t(
                "payment_country_required_help",
                "Tu idioma puede ser creole, frances, ingles o espanol. El pais de residencia es lo que define la moneda y los metodos visibles."
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1 bg-slate-900 hover:bg-slate-800" onClick={() => navigate("/profile")}>
                {t("payment_go_to_profile", "Ir a perfil")}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                {t("common_back", "Volver")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminMode) {
    const paymentStatus = (enrollment.payment_status || "").toLowerCase();
    const paymentLabel = getPaymentStatusLabel(paymentStatus, t);
    const enrollmentStatus = (enrollment.status || "").toLowerCase();
    const paymentMethodLabel =
      enrollment.payment_method_title ||
      getLocalizedText(enrollment.payment_method_snapshot?.title_i18n, language) ||
      enrollment.payment_method_code ||
      t("common_unknown", "Desconocido");
    const paymentMethodProvider = enrollment.payment_method_provider || enrollment.payment_method_code || "";
    const paymentSubmittedAt = enrollment.payment_submitted_at
      ? new Intl.DateTimeFormat(getIntlLocale(language), {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(enrollment.payment_submitted_at))
      : null;

    const normalizedAmountPaid = Number(enrollment?.amount_paid);
    const hasAmountPaid = Number.isFinite(normalizedAmountPaid) && normalizedAmountPaid > 0;
    const amount = hasEnrollmentFinalPrice
      ? normalizedEnrollmentFinalPrice
      : hasAmountPaid
        ? normalizedAmountPaid
        : amountNow ?? 0;

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t("payment_process_title", "Procesar pago")}</h1>
              <p className="text-slate-500 text-sm">{t("payment_admin_validation", "Validación por administrador")}</p>
            </div>
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>{t("detail", "Detalle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-600 space-y-1">
                <p><b>{t("seminar", "Seminario")}:</b> {seminar?.title || "—"}</p>
                <p><b>{t("student", "Estudiante")}:</b> {enrollment.student_email || "—"}</p>
                <p><b>{t("amount", "Monto")}:</b> ${Number(amount || 0).toFixed(2)}</p>
                {Number(enrollment.wallet_credit_applied || 0) > 0 ? (
                  <p>
                    <b>{t("wallet_balance_applied", "Saldo Okalab aplicado")}:</b>{" "}
                    ${Number(enrollment.wallet_credit_applied || 0).toFixed(2)}
                  </p>
                ) : null}
                {Number(enrollment.external_amount_due || 0) > 0 ? (
                  <p>
                    <b>{t("external_amount_due", "Monto externo restante")}:</b>{" "}
                    ${Number(enrollment.external_amount_due || 0).toFixed(2)}
                  </p>
                ) : null}
                <p><b>{t("enrollment_status", "Estado inscripción")}:</b> {enrollmentStatus || "—"}</p>
                <p><b>{t("payment_status", "Estado pago")}:</b> {paymentLabel || "—"}</p>
                <p><b>{t("payment_method", "Método de pago")}:</b> {paymentMethodLabel}</p>
                {paymentMethodProvider ? (
                  <p><b>{t("payment_method_provider", "Proveedor")}:</b> {paymentMethodProvider}</p>
                ) : null}
                {paymentSubmittedAt ? (
                  <p><b>{t("payment_submitted_at", "Pago enviado")}:</b> {paymentSubmittedAt}</p>
                ) : null}
              </div>

              {paymentStatus !== "pending_payment" && paymentStatus !== "pending" ? (
                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                  {t("payment_not_pending", "Este pago no está pendiente de validación.")}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-300 disabled:cursor-not-allowed"
                    onClick={() => approvePaymentMutation.mutate()}
                    disabled={approvePaymentMutation.isPending || rejectPaymentMutation.isPending}
                  >
                    {approvePaymentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    {t("common_approve", "Aprobar")}
                  </Button>

                  <Button
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={approvePaymentMutation.isPending || rejectPaymentMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t("common_reject", "Rechazar")}
                  </Button>
                </div>
              )}

              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("payment_reject_title", "Rechazar pago")}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">{t("payment_reject_help", "Puedes escribir un motivo (opcional).")}</p>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t("payment_reject_placeholder", "Motivo del rechazo...")}
                      className="min-h-[100px]"
                    />
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectOpen(false);
                        setRejectReason("");
                      }}
                      disabled={rejectPaymentMutation.isPending}
                    >
                      {t("common_cancel", "Cancelar")}
                    </Button>

                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        const defaultReason = t("payment_reject_reason_admin", "Rechazado por admin");
                        const reasonToSend = rejectReason.trim() || defaultReason;
                        rejectPaymentMutation.mutate(reasonToSend, {
                          onSuccess: () => {
                            setRejectOpen(false);
                            setRejectReason("");
                          },
                        });
                      }}
                      disabled={rejectPaymentMutation.isPending}
                    >
                      {rejectPaymentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      {t("payment_reject_confirm", "Confirmar rechazo")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Modo estudiante (solicitud de pago)
  const hasAvailablePaymentMethods = requiresExternalPaymentMethod
    ? availablePaymentMethods.length > 0
    : true;
  const selectedMethodDescription = requiresExternalPaymentMethod
    ? selectedPaymentMethod?.description || ""
    : "";
  const selectedMethodInstructions = requiresExternalPaymentMethod
    ? selectedPaymentMethod?.instructions || ""
    : "";
  const selectedMethodFields =
    requiresExternalPaymentMethod && Array.isArray(selectedPaymentMethod?.fields)
      ? selectedPaymentMethod.fields
      : [];
  const showGatewayGuidance =
    requiresExternalPaymentMethod && selectedPaymentMethod?.kind === "gateway" && !isCardBlocked;
  const walletAmountBelowMinimum =
    walletAppliedAmount > 0 && walletAppliedAmount < OKALAB_WALLET_MIN_APPLY;
  const paymentActionDisabled =
    studentPayMutation.isPending ||
    !canPayNow ||
    walletAmountBelowMinimum ||
    (requiresExternalPaymentMethod &&
      (isCardBlocked || isPaypalMissing || !hasAvailablePaymentMethods || !selectedPaymentMethod));

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("payment_title", "Pago")}</h1>
            <p className="text-slate-500 text-sm">
              {t("payment_deferred_note", "Pago diferido: el precio se calcula al pagar y el excedente se distribuye automáticamente.")}
            </p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>{t("payment_method", "Método de pago")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-sm text-slate-600">
                <p className="mb-1">
                  <span className="text-slate-500">{t("seminar", "Seminario")}</span><br />
                  <b className="text-slate-900">{seminar.title}</b>
                </p>
                <p>
                  {t("amount_to_pay", "Monto a pagar (cotizado)")}: <b>${amountNow.toFixed(2)}</b>
                </p>
                {usesWalletBalance ? (
                  <div className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p>
                      {t("wallet_balance_applied", "Saldo Okalab aplicado")}: <b>-${walletAppliedAmount.toFixed(2)}</b>
                    </p>
                    <p>
                      {t("external_amount_due", "Monto externo restante")}: <b>${externalAmountDue.toFixed(2)}</b>
                    </p>
                  </div>
                ) : null}
                {requiresExternalPaymentMethod ? (
                  <LocalCurrencyReference
                    usdAmount={externalAmountDue}
                    countryCode={residenceCountryCode}
                    settings={paymentSettings}
                    language={language}
                    t={t}
                    className="mt-3"
                  />
                ) : null}
              </div>

              {availableWalletBalance > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-emerald-950">
                        {t("wallet_balance_available_for_payment", "Saldo Okalab disponible")}
                      </p>
                      <p className="text-sm text-emerald-900">${availableWalletBalance.toFixed(2)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white"
                      onClick={() =>
                        setWalletAmountInput(
                          String(clampWalletAmount(availableWalletBalance, availableWalletBalance, amountNow))
                        )
                      }
                    >
                      {t("wallet_use_max", "Usar maximo")}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("wallet_apply_to_payment", "Aplicar Saldo Okalab")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={walletAmountInput}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        if (!nextValue) {
                          setWalletAmountInput("");
                          return;
                        }

                        const normalized = clampWalletAmount(
                          nextValue,
                          availableWalletBalance,
                          amountNow
                        );

                        setWalletAmountInput(String(normalized || nextValue));
                      }}
                      placeholder={t("amount_placeholder", "0.00")}
                    />
                    <p className="text-xs text-emerald-900">
                      {t(
                        "wallet_apply_help",
                        "Puedes aplicar desde USD 0.10 hasta el menor valor entre tu saldo y el monto del seminario."
                      )}
                    </p>
                  </div>

                  {walletAmountBelowMinimum ? (
                    <div className="rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-900">
                      {t(
                        "wallet_apply_minimum_error",
                        "Para usar Saldo Okalab en un pago debes aplicar al menos USD 0.10."
                      )}
                    </div>
                  ) : null}

                  {walletCoversFullAmount ? (
                    <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
                      {t(
                        "wallet_full_payment_note",
                        "Tu Saldo Okalab cubre este seminario completo. El pago se confirmara de inmediato."
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {requiresExternalPaymentMethod ? (
                <>
                  <div className="space-y-2">
                    <Label>{t("payment_method", "Método de pago")}</Label>
                    <Select
                      value={paymentMethodCode}
                      onValueChange={setPaymentMethodCode}
                      disabled={!hasAvailablePaymentMethods}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue
                          placeholder={t("payment_method_select_placeholder", "Selecciona un método disponible")}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {availablePaymentMethods.map((method) => (
                          <SelectItem key={method.code} value={method.code}>
                            {method.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {noVisibleDynamicPaymentMethodsForLanguage && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t(
                        "payment_methods_language_unavailable",
                        "No hay métodos de pago visibles para tu idioma en este momento."
                      )}
                    </div>
                  )}

                  {noVisibleDynamicPaymentMethodsForCountry && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t(
                        "payment_methods_country_unavailable",
                        "No hay métodos de pago visibles para tu país de residencia en este momento."
                      )}
                    </div>
                  )}

                  {!hasAvailablePaymentMethods &&
                  !noVisibleDynamicPaymentMethodsForLanguage &&
                  !noVisibleDynamicPaymentMethodsForCountry && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t("payment_methods_unavailable", "No hay métodos de pago disponibles ahora mismo.")}
                    </div>
                  )}

                  {selectedPaymentMethod && (
                    <div className="rounded-xl border p-4 text-sm space-y-4">
                      <div className="space-y-1">
                        <p className="text-slate-700 font-medium">{selectedPaymentMethod.title}</p>
                        {selectedMethodDescription ? <p className="text-slate-600">{selectedMethodDescription}</p> : null}
                      </div>

                      {selectedMethodInstructions ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 whitespace-pre-wrap">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("payment_method_instructions", "Instrucciones")}
                          </p>
                          {selectedMethodInstructions}
                        </div>
                      ) : null}

                      {selectedMethodExternalUrl ? (
                        <div className="flex flex-wrap gap-3">
                          <Button asChild variant="outline" className="bg-white">
                            <a href={selectedMethodExternalUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("payment_method_open_link", "Abrir enlace")}
                            </a>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-white"
                            onClick={() => copyPaymentValue(selectedMethodExternalUrl)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            {t("common_copy", "Copiar")}
                          </Button>
                        </div>
                      ) : null}

                      {selectedMethodFields.length ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("payment_method_details", "Detalles del método")}
                          </p>
                          {selectedMethodFields.map((field) => (
                            <div key={`${selectedPaymentMethod.code}_${field.field_key}`} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {field.label || field.field_key}
                                  </p>
                                  {field.field_type === "url" && field.field_value ? (
                                    <a
                                      href={field.field_value}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="break-all text-blue-600 underline"
                                    >
                                      {field.field_value}
                                    </a>
                                  ) : (
                                    <p className="break-words whitespace-pre-wrap text-slate-900">{field.field_value || "—"}</p>
                                  )}
                                  {field.helpText ? (
                                    <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap">{field.helpText}</p>
                                  ) : null}
                                </div>

                                {field.copyable && field.field_value ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 bg-white"
                                    onClick={() => copyPaymentValue(field.field_value)}
                                    title={t("common_copy", "Copiar")}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {selectedPaymentMethod?.provider === "paypal" && isPaypalMissing && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t("payment_paypal_missing", "PayPal no está configurado aún.")}
                    </div>
                  )}

                  {isCardBlocked && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t("payment_card_soon", "Pago con tarjeta estará disponible próximamente.")}
                    </div>
                  )}

                  {showGatewayGuidance && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      {t(
                        "payment_method_gateway_note",
                        "Este método depende de una pasarela o enlace externo. Completa el pago fuera de Okalab y luego confirma aquí para enviarlo a validación."
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  {t(
                    "wallet_only_payment_method_note",
                    "No necesitas metodo externo: este pago se procesara con tu Saldo Okalab."
                  )}
                </div>
              )}

              {isPaymentOpenByCapacity && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  {t(
                    "payment_full_open_note",
                    "El seminario llenó su cupo y el pago ya está habilitado. La fecha límite sigue siendo {close}."
                  ).replace("{close}", formatWindowDate(paymentCloseDate))}
                </div>
              )}

              {!canPayNow && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {isPaymentWindowClosed
                    ? t("payment_window_closed", "La ventana de pago no está abierta.")
                    : t(
                        "payment_wait_full_or_window",
                        "Aún no puedes pagar: el seminario debe llenarse o entrar en la ventana de pago."
                      )}
                  {paymentOpenDate && paymentCloseDate ? (
                    <div className="mt-1 text-amber-800">
                      {t("payment_window_open_note", "Pagos abiertos del {open} al {close}.")
                        .replace("{open}", formatWindowDate(paymentOpenDate))
                        .replace("{close}", formatWindowDate(paymentCloseDate))}
                    </div>
                  ) : null}
                </div>
              )}

              <Button
                className="w-full h-12 bg-slate-900 hover:bg-slate-800"
                onClick={() => studentPayMutation.mutate()}
                disabled={paymentActionDisabled}
              >
                {studentPayMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {t("confirm_payment", "Confirmar pago")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
