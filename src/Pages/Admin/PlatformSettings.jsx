import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../Components/ui/card";
import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Textarea } from "../../Components/ui/textarea";
import { Label } from "../../Components/ui/label";
import { Switch } from "../../Components/ui/switch";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../Components/shared/LanguageContext";

const LOGO_BUCKET = "app-assets";
const MAX_LOGO_MB = 2;
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
  payment_open_days: 7,
  payment_close_days: 2,
};

export default function PlatformSettings() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const location = useLocation();
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

  useEffect(() => {
    if (!form) return;
    const hash = (location.hash || "").replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, form]);

  const save = useMutation({
    mutationFn: async (payload) => {
      const next = normalizeSettings(payload ?? form);
      const { error } = await supabase
        .from("platform_settings")
        .upsert(next, { onConflict: "id" });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      if (next) setForm(next);
      qc.invalidateQueries({ queryKey: ["platform_settings"] });
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("platform_settings_title", "App Settings")}</h1>
        <p className="text-slate-500 text-sm">{t("platform_settings_subtitle", "Configura la información pública de la app.")}</p>
      </div>

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

      <Card id="payments" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("payment_methods_title", "Métodos de pago")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
        </CardContent>
      </Card>

      <Card id="support" className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t("support_channels_title", "Canales de soporte")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("support_whatsapp_feedback_link", "WhatsApp feedback (link o número)")}</Label>
              <Input
                value={form.support_whatsapp_feedback_link || ""}
                onChange={(e) => setForm({ ...form, support_whatsapp_feedback_link: e.target.value })}
                placeholder="https://wa.me/1809XXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("support_whatsapp_message", "Mensaje prefijado de WhatsApp")}</Label>
              <Input
                value={form.support_whatsapp_message || ""}
                onChange={(e) => setForm({ ...form, support_whatsapp_message: e.target.value })}
                placeholder={t("support_whatsapp_message_placeholder", "Hola, quiero enviar feedback sobre Okalab")}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("support_facebook_forum_link", "Link foro Facebook")}</Label>
              <Input
                value={form.support_facebook_forum_link || ""}
                onChange={(e) => setForm({ ...form, support_facebook_forum_link: e.target.value })}
                placeholder="https://facebook.com/groups/..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("support_whatsapp_channel_link", "Link canal WhatsApp")}</Label>
              <Input
                value={form.support_whatsapp_channel_link || ""}
                onChange={(e) => setForm({ ...form, support_whatsapp_channel_link: e.target.value })}
                placeholder="https://whatsapp.com/channel/..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("support_email_label", "Email de soporte")}</Label>
            <Input
              value={form.support_email || ""}
              onChange={(e) => setForm({ ...form, support_email: e.target.value })}
              placeholder="soporte@tu-dominio.com"
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
