import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../Components/ui/card";
import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Textarea } from "../../Components/ui/textarea";
import { Label } from "../../Components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../Components/shared/LanguageContext";
import PaymentMethodsSettings from "./PaymentMethodsSettings";

const LOGO_BUCKET = "app-assets";
const MAX_LOGO_MB = 2;
const SUPPORT_LANGS = ["es", "en", "fr", "ht"];
const SUPPORT_LANG_LABELS = {
  es: "Español",
  en: "English",
  fr: "Français",
  ht: "Kreyòl",
};
const SUPPORT_LOCALIZED_FIELDS = {
  support_whatsapp_feedback_link_i18n: "support_whatsapp_feedback_link",
  support_whatsapp_message_i18n: "support_whatsapp_message",
  support_facebook_forum_link_i18n: "support_facebook_forum_link",
  support_whatsapp_channel_link_i18n: "support_whatsapp_channel_link",
  support_email_i18n: "support_email",
};
const maxBytes = (mb) => mb * 1024 * 1024;
const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};
const clampDays = (value, fallback = 0) => {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
};
const normalizeExchangeRate = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(4));
};
const emptyLocalizedText = () =>
  SUPPORT_LANGS.reduce((acc, lang) => {
    acc[lang] = "";
    return acc;
  }, {});
const normalizeLocalizedText = (value, fallback = "") => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return SUPPORT_LANGS.reduce((acc, lang) => {
    acc[lang] = typeof source[lang] === "string" ? source[lang] : fallback;
    return acc;
  }, {});
};
const getLocalizedFallbackValue = (value) => {
  if (!value || typeof value !== "object") return "";
  for (const lang of SUPPORT_LANGS) {
    const next = String(value[lang] || "").trim();
    if (next) return next;
  }
  return "";
};
const normalizeSettings = (values) => {
  const professor = clampPercent(values.surplus_professor_percent);
  const referral = clampPercent(values.surplus_referral_percent);
  const normalizedReferral =
    Math.abs(professor + referral - 100) < 0.01 ? referral : Math.max(0, 100 - professor);
  const openDays = clampDays(values.payment_open_days, 7);
  const closeDays = clampDays(values.payment_close_days, 2);
  const normalizedOpen = Math.max(openDays, closeDays);
  const normalizedClose = Math.min(openDays, closeDays);

  return {
    ...values,
    platform_fee_percent: clampPercent(values.platform_fee_percent),
    surplus_professor_percent: professor,
    surplus_referral_percent: normalizedReferral,
    payment_open_days: normalizedOpen,
    payment_close_days: normalizedClose,
    support_whatsapp_feedback_link_i18n: normalizeLocalizedText(
      values.support_whatsapp_feedback_link_i18n,
      values.support_whatsapp_feedback_link || ""
    ),
    support_whatsapp_message_i18n: normalizeLocalizedText(
      values.support_whatsapp_message_i18n,
      values.support_whatsapp_message || ""
    ),
    support_facebook_forum_link_i18n: normalizeLocalizedText(
      values.support_facebook_forum_link_i18n,
      values.support_facebook_forum_link || ""
    ),
    support_whatsapp_channel_link_i18n: normalizeLocalizedText(
      values.support_whatsapp_channel_link_i18n,
      values.support_whatsapp_channel_link || ""
    ),
    support_email_i18n: normalizeLocalizedText(values.support_email_i18n, values.support_email || ""),
    usd_to_dop: normalizeExchangeRate(values.usd_to_dop),
    usd_to_htg: normalizeExchangeRate(values.usd_to_htg),
  };
};

const DEFAULT_SETTINGS = {
  id: 1,
  app_name: "Okalab",
  app_description: "",
  app_logo_url: "",
  platform_fee_percent: 0,
  surplus_professor_percent: 0,
  surplus_referral_percent: 0,
  enable_transfer: true,
  enable_paypal: false,
  enable_card: false,
  enable_cash: false,
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_iban: "",
  bank_swift: "",
  bank_notes: "",
  paypal_link: "",
  support_whatsapp_feedback_link: "",
  support_whatsapp_message: "",
  support_facebook_forum_link: "",
  support_whatsapp_channel_link: "",
  support_email: "",
  support_whatsapp_feedback_link_i18n: emptyLocalizedText(),
  support_whatsapp_message_i18n: emptyLocalizedText(),
  support_facebook_forum_link_i18n: emptyLocalizedText(),
  support_whatsapp_channel_link_i18n: emptyLocalizedText(),
  support_email_i18n: emptyLocalizedText(),
  payment_open_days: 7,
  payment_close_days: 2,
  usd_to_dop: null,
  usd_to_htg: null,
};

const PLATFORM_SETTINGS_EDITABLE_KEYS = [
  "id",
  "app_name",
  "app_description",
  "app_logo_url",
  "platform_fee_percent",
  "surplus_professor_percent",
  "surplus_referral_percent",
  "support_whatsapp_feedback_link",
  "support_whatsapp_message",
  "support_facebook_forum_link",
  "support_whatsapp_channel_link",
  "support_email",
  "support_whatsapp_feedback_link_i18n",
  "support_whatsapp_message_i18n",
  "support_facebook_forum_link_i18n",
  "support_whatsapp_channel_link_i18n",
  "support_email_i18n",
  "payment_open_days",
  "payment_close_days",
  "usd_to_dop",
  "usd_to_htg",
];

const SETTINGS_SECTION_META = {
  app: { titleKey: "admin_settings_app", titleDefault: "App" },
  fees: { titleKey: "admin_settings_fees", titleDefault: "Comisiones y reparto" },
  payments: { titleKey: "admin_settings_payments", titleDefault: "Metodos de pago" },
  support: { titleKey: "admin_settings_support", titleDefault: "Canales de soporte" },
  seminars: { titleKey: "admin_settings_seminars", titleDefault: "Seminarios" },
};

export default function PlatformSettings({ section = "app" }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const activeSection = SETTINGS_SECTION_META[section] ? section : "app";
  const activeSectionMeta = SETTINGS_SECTION_META[activeSection];
  const { data, isLoading } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const [form, setForm] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (data) setForm(normalizeSettings({ ...DEFAULT_SETTINGS, ...data }));
    if (data === null) setForm(DEFAULT_SETTINGS);
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload) => {
      const next = normalizeSettings(payload ?? form);
      const nextWithLegacySupport = {
        ...next,
        support_whatsapp_feedback_link: getLocalizedFallbackValue(next.support_whatsapp_feedback_link_i18n),
        support_whatsapp_message: getLocalizedFallbackValue(next.support_whatsapp_message_i18n),
        support_facebook_forum_link: getLocalizedFallbackValue(next.support_facebook_forum_link_i18n),
        support_whatsapp_channel_link: getLocalizedFallbackValue(next.support_whatsapp_channel_link_i18n),
        support_email: getLocalizedFallbackValue(next.support_email_i18n),
      };
      const safePayload = PLATFORM_SETTINGS_EDITABLE_KEYS.reduce((acc, key) => {
        acc[key] = nextWithLegacySupport[key];
        return acc;
      }, {});
      const { error } = await supabase
        .from("platform_settings")
        .upsert(safePayload, { onConflict: "id" });
      if (error) throw error;
      return { ...form, ...nextWithLegacySupport, ...safePayload };
    },
    onSuccess: (next) => {
      if (next) setForm(next);
      qc.invalidateQueries({ queryKey: ["platform_settings"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_public"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_public_seminar_details"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_payment"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_create_seminar"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_payment_window"] });
      qc.invalidateQueries({ queryKey: ["platform_settings_support"] });
      toast.success(t("platform_settings_saved", "Settings guardados"));
    },
    onError: (err) => toast.error(err?.message || t("common_save_error", "No se pudo guardar")),
  });

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error(t("platform_logo_only_images", "Solo se permiten imágenes"));
      return;
    }
    if (file.size > maxBytes(MAX_LOGO_MB)) {
      toast.error(t("platform_logo_max_size", `El logo debe ser máximo ${MAX_LOGO_MB}MB`));
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `branding/logo.${ext}`;

      const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "image/png",
      });
      if (error) throw error;

      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl || "";

      const next = { ...form, app_logo_url: publicUrl, updated_at: new Date().toISOString() };
      await save.mutateAsync(next);
    } catch (err) {
      toast.error(err?.message || t("platform_logo_upload_error", "No se pudo subir el logo"));
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("platform_settings_loading", "Cargando settings...")}
      </div>
    );
  }

  const syncSurplus = (field, value) => {
    const nextValue = clampPercent(value);
    const otherField =
      field === "surplus_professor_percent" ? "surplus_referral_percent" : "surplus_professor_percent";

    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
      [otherField]: Math.max(0, 100 - nextValue),
    }));
  };

  const updateLocalizedSupportField = (field, lang, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: {
        ...(prev?.[field] || emptyLocalizedText()),
        [lang]: value,
      },
    }));
  };

  return (
    <div className={`${activeSection === "payments" ? "max-w-5xl" : "max-w-3xl"} space-y-6`}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t(activeSectionMeta.titleKey, activeSectionMeta.titleDefault)}
        </h1>
        <p className="text-slate-500 text-sm">{t("platform_settings_subtitle", "Configura la información pública de la app.")}</p>
      </div>

      {activeSection === "app" ? (
        <Card id="app" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("platform_app_info", "App Info")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                {form.app_logo_url ? (
                  <img src={form.app_logo_url} alt={t("platform_app_logo_alt", "App logo")} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">{t("platform_logo_placeholder", "Logo")}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{t("platform_app_logo", "App Logo")}</p>
                <p className="text-xs text-slate-500">{t("platform_logo_hint", `PNG/JPG, máx ${MAX_LOGO_MB}MB`)}</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                variant="outline"
                className="border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("platform_edit_logo", "Edit Logo")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("platform_app_description", "App Description")}</Label>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
            <Textarea
              value={form.app_description || ""}
              onChange={(e) => setForm({ ...form, app_description: e.target.value })}
              placeholder={t("platform_app_description_placeholder", "Describe la plataforma...")}
              className="min-h-28"
            />
          </div>
        </CardContent>
        </Card>
      ) : null}

      {activeSection === "fees" ? (
        <Card id="fees" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("platform_fees_split", "Fees & Split")}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("platform_fee_percent", "Platform fee %")}</Label>
            <Input
              type="number"
              value={form.platform_fee_percent ?? 0}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, platform_fee_percent: clampPercent(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("platform_professor_surplus_percent", "% Profesor (excedente)")}</Label>
            <Input
              type="number"
              value={form.surplus_professor_percent ?? 0}
              onChange={(e) => syncSurplus("surplus_professor_percent", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("platform_referral_surplus_percent", "% Referidores")}</Label>
            <Input
              type="number"
              value={form.surplus_referral_percent ?? 0}
              onChange={(e) => syncSurplus("surplus_referral_percent", e.target.value)}
            />
          </div>
        </CardContent>
        </Card>
      ) : null}

      {activeSection === "payments" ? (
        <Card id="payments" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("payment_methods_title", "Métodos de pago")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {t("local_currency_settings_title", "Referencias en moneda local")}
              </p>
              <p className="text-sm text-slate-500">
                {t(
                  "local_currency_settings_help",
                  "Los seminarios siguen en USD. Estas tasas solo se usan para mostrar la referencia local al estudiante."
                )}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("usd_to_dop_rate", "Tasa USD -> DOP")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.usd_to_dop ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, usd_to_dop: e.target.value }))}
                  placeholder="62.5000"
                />
                <p className="text-xs text-slate-500">
                  {t("usd_to_dop_rate_help", "Monto en pesos dominicanos que corresponde a 1 USD.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("usd_to_htg_rate", "Tasa USD -> HTG")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.usd_to_htg ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, usd_to_htg: e.target.value }))}
                  placeholder="132.0000"
                />
                <p className="text-xs text-slate-500">
                  {t("usd_to_htg_rate_help", "Monto en gourdes haitianos que corresponde a 1 USD.")}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("local_currency_settings_save", "Guardar tasas")}
              </Button>
            </div>
          </div>

          <PaymentMethodsSettings />
          {false && (
            <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label>Transferencia</Label>
              <Switch
                checked={!!form.enable_transfer}
                onCheckedChange={(v) => setForm({ ...form, enable_transfer: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>PayPal</Label>
              <Switch
                checked={!!form.enable_paypal}
                onCheckedChange={(v) => setForm({ ...form, enable_paypal: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Tarjeta</Label>
              <Switch
                checked={!!form.enable_card}
                onCheckedChange={(v) => setForm({ ...form, enable_card: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Efectivo</Label>
              <Switch
                checked={!!form.enable_cash}
                onCheckedChange={(v) => setForm({ ...form, enable_cash: v })}
              />
            </div>
          </div>

          {form.enable_transfer && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={form.bank_name || ""}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Titular</Label>
                <Input
                  value={form.bank_account_name || ""}
                  onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número de cuenta</Label>
                <Input
                  value={form.bank_account_number || ""}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input
                  value={form.bank_iban || ""}
                  onChange={(e) => setForm({ ...form, bank_iban: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SWIFT</Label>
                <Input
                  value={form.bank_swift || ""}
                  onChange={(e) => setForm({ ...form, bank_swift: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.bank_notes || ""}
                  onChange={(e) => setForm({ ...form, bank_notes: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.enable_paypal && (
            <div className="space-y-2">
              <Label>Link PayPal</Label>
              <Input
                value={form.paypal_link || ""}
                onChange={(e) => setForm({ ...form, paypal_link: e.target.value })}
                placeholder="https://paypal.me/tuusuario"
              />
            </div>
          )}

          {form.enable_card && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t("payment_card_soon", "Pago con tarjeta estará disponible próximamente.")}
            </div>
          )}
            </>
          )}
        </CardContent>
        </Card>
      ) : null}

      {activeSection === "support" ? (
        <Card id="support" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("support_channels_title", "Canales de soporte")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {t(
              "support_channels_i18n_help",
              "Configura canales distintos por idioma para no mezclar comunidades, grupos o mensajes entre audiencias."
            )}
          </div>

          {[
            {
              field: "support_whatsapp_feedback_link_i18n",
              label: t("support_whatsapp_feedback_link", "WhatsApp feedback (link o número)"),
              placeholder: "https://wa.me/1809XXXXXXX",
            },
            {
              field: "support_whatsapp_message_i18n",
              label: t("support_whatsapp_message", "Mensaje prefijado de WhatsApp"),
              placeholder: t("support_whatsapp_message_placeholder", "Hola, quiero enviar feedback sobre Okalab"),
            },
            {
              field: "support_facebook_forum_link_i18n",
              label: t("support_facebook_forum_link", "Link foro Facebook"),
              placeholder: "https://facebook.com/groups/...",
            },
            {
              field: "support_whatsapp_channel_link_i18n",
              label: t("support_whatsapp_channel_link", "Link canal WhatsApp"),
              placeholder: "https://whatsapp.com/channel/...",
            },
            {
              field: "support_email_i18n",
              label: t("support_email_label", "Email de soporte"),
              placeholder: "soporte@tu-dominio.com",
            },
          ].map((config) => (
            <div key={config.field} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <Label>{config.label}</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                {SUPPORT_LANGS.map((lang) => (
                  <div key={`${config.field}-${lang}`} className="space-y-2">
                    <Label className="text-xs text-slate-500">{SUPPORT_LANG_LABELS[lang]}</Label>
                    <Input
                      value={form?.[config.field]?.[lang] || ""}
                      onChange={(e) => updateLocalizedSupportField(config.field, lang, e.target.value)}
                      placeholder={config.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
        </Card>
      ) : null}

      {activeSection === "seminars" ? (
        <Card id="seminars" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("platform_seminar_settings", "Seminarios")}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("payment_open_days", "Inicio de pagos (días antes del inicio)")}</Label>
            <Input
              type="number"
              min="0"
              value={form.payment_open_days ?? 7}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payment_open_days: clampDays(e.target.value, 7),
                }))
              }
            />
            <p className="text-xs text-slate-500">
              {t(
                "payment_open_days_help",
                "Cuando comienza la ventana de pago. Al abrir, las inscripciones se cierran y el precio se congela."
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("payment_close_days", "Gestión pagos (días antes del inicio)")}</Label>
            <Input
              type="number"
              min="0"
              value={form.payment_close_days ?? 2}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payment_close_days: clampDays(e.target.value, 2),
                }))
              }
            />
            <p className="text-xs text-slate-500">
              {t(
                "payment_close_days_help",
                "Fecha límite para pagar. Pasado este día, las inscripciones impagas se marcan como vencidas."
              )}
            </p>
          </div>
        </CardContent>
        </Card>
      ) : null}

      {activeSection !== "payments" ? (
        <div className="flex justify-end">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t("common_save_changes", "Guardar cambios")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
