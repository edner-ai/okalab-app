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

const LOGO_BUCKET = "app-assets";
const MAX_LOGO_MB = 2;
const maxBytes = (mb) => mb * 1024 * 1024;
const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};
const normalizeSettings = (values) => {
  const professor = clampPercent(values.surplus_professor_percent);
  const referral = clampPercent(values.surplus_referral_percent);
  const normalizedReferral =
    Math.abs(professor + referral - 100) < 0.01 ? referral : Math.max(0, 100 - professor);

  return {
    ...values,
    platform_fee_percent: clampPercent(values.platform_fee_percent),
    surplus_professor_percent: professor,
    surplus_referral_percent: normalizedReferral,
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
};

export default function PlatformSettings() {
  const { t } = useLanguage();
  const qc = useQueryClient();
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

      <Card className="border-0 shadow-sm">
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

      <Card className="border-0 shadow-sm">
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
