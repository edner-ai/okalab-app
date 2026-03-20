import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import { Label } from "../Components/ui/label";
import { Switch } from "../Components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../Components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Components/ui/select";

import {
  ArrowLeft,
  User as UserIcon,
  Upload,
  Loader2,
  Check,
  GraduationCap,
  Briefcase,
  Languages,
} from "lucide-react";

import { motion } from "framer-motion";
import { toast } from "sonner";
import ReviewPrompt from "../Components/reviews/ReviewPrompt";
import Cropper from "react-easy-crop";
import { getCountryOptions, normalizeCountryCode } from "../utils/countries";
import { getIntlLocale } from "../utils/dateLocale";
import {
  getContactProfileState,
  normalizeContactMethod,
  normalizeWhatsAppNumber,
} from "../utils/contactProfile";
import {
  getAvailablePayoutMethodOptions,
  getPayoutMethodLabel,
  getPayoutMinimum,
} from "../utils/payouts";

const LANG_OPTIONS = [
  { value: "es", label: "🇪🇸 Español" },
  { value: "en", label: "🇬🇧 English" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "ht", label: "🇭🇹 Kreyòl" },
];

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_MB = 2;
const maxBytes = (mb) => mb * 1024 * 1024;

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedImageBlob = async (imageSrc, pixelCrop, mimeType = "image/jpeg") => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo recortar la imagen"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      0.92
    );
  });
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, changeLanguage } = useLanguage();

  // ✅ Fuente única de verdad (AuthProvider)
  const { user, profile, loading, refresh, role, roleReady, isAdmin, signOut, contactProfileComplete } = useAuth();
  const profileRow = profile;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const onboardingMode = searchParams.get("onboarding");
  const onboardingNext = searchParams.get("next") || "/";

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [showBecomeProfessor, setShowBecomeProfessor] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropMimeType, setCropMimeType] = useState("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    phone: "",
    whatsapp_number: "",
    whatsapp_enabled: false,
    preferred_contact_method: "",
    allow_teacher_contact: false,
    allow_admin_contact: false,
    allow_student_contact: false,
    location: "",
    country_code: "",
    preferred_language: "es",
    preferred_payout_method: "",
    payout_paypal_email: "",
    payout_bank_account_name: "",
    payout_bank_name: "",
    payout_bank_account_number: "",
    payout_bank_iban: "",
    payout_bank_swift: "",
    payout_mobile_wallet_full_name: "",
    payout_mobile_wallet_phone: "",
    avatar_url: null,
  });

  // ✅ Evita que un refresh de profile sobreescriba lo que estás editando
  const initializedRef = useRef(false);

  // Si no hay usuario cuando termina loading → login
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    const intent = new URLSearchParams(location.search).get("intent");
    if (intent === "become-professor") {
      setShowBecomeProfessor(true);
    }
  }, [location.search]);

  // Inicializa el formulario desde profile una sola vez
  useEffect(() => {
    if (!user) return;

    const defaultLang = localStorage.getItem("preferred_language") || "es";

    if (!profileRow) {
      // si no hay fila aún, al menos setea idioma local para no romper UI
      if (!initializedRef.current) {
        setFormData((p) => ({ ...p, preferred_language: defaultLang }));
        initializedRef.current = true;
      }
      return;
    }

    if (initializedRef.current) return;

    setFormData({
      full_name: profileRow?.full_name || "",
      bio: profileRow?.bio || "",
      phone: profileRow?.phone || "",
      whatsapp_number: profileRow?.whatsapp_number || "",
      whatsapp_enabled: profileRow?.whatsapp_enabled === true,
      preferred_contact_method: profileRow?.preferred_contact_method || "",
      allow_teacher_contact: profileRow?.allow_teacher_contact === true,
      allow_admin_contact: profileRow?.allow_admin_contact === true,
      allow_student_contact: profileRow?.allow_student_contact === true,
      location: profileRow?.location || "",
      country_code: profileRow?.country_code || "",
      preferred_language: profileRow?.preferred_language || defaultLang,
      preferred_payout_method: profileRow?.preferred_payout_method || "",
      payout_paypal_email: profileRow?.payout_paypal_email || "",
      payout_bank_account_name: profileRow?.payout_bank_account_name || "",
      payout_bank_name: profileRow?.payout_bank_name || "",
      payout_bank_account_number: profileRow?.payout_bank_account_number || "",
      payout_bank_iban: profileRow?.payout_bank_iban || "",
      payout_bank_swift: profileRow?.payout_bank_swift || "",
      payout_mobile_wallet_full_name: profileRow?.payout_mobile_wallet_full_name || "",
      payout_mobile_wallet_phone: profileRow?.payout_mobile_wallet_phone || "",
      avatar_url: profileRow?.avatar_url || null,
    });
    setAvatarPreview(null);

    initializedRef.current = true;
  }, [user, profileRow]);

  // ---- roles / estados ----
  const verificationStatus = profileRow?.verification_status || "none";
  const isVerified = profileRow?.is_verified === true || profileRow?.is_verified === "true";
  const isProfessorRole = role === "teacher" || role === "professor" || role === "instructor";

  const roleLabel = useMemo(() => {
    if (loading || !roleReady) return { text: t("common_loading", "Cargando..."), icon: Loader2, spin: true };
    if (role === "admin") return { text: t("role_admin", "Admin"), icon: UserIcon };
    if (isProfessorRole || isVerified || verificationStatus === "approved")
      return { text: t("role_professor", "Profesor"), icon: GraduationCap };
    return { text: t("role_student", "Estudiante"), icon: Briefcase };
  }, [loading, roleReady, role, isProfessorRole, isVerified, verificationStatus, t]);

  const RoleIcon = roleLabel.icon;
  const avatarVersion = profileRow?.updated_at ? new Date(profileRow.updated_at).getTime() : "";
  const avatarSrc =
    avatarPreview ||
    (formData.avatar_url
      ? `${formData.avatar_url}${avatarVersion ? `?v=${avatarVersion}` : ""}`
      : null);
  const countryOptions = useMemo(
    () => getCountryOptions(getIntlLocale(formData.preferred_language || "es")),
    [formData.preferred_language]
  );

  const draftContactProfileState = useMemo(
    () => getContactProfileState(formData, user),
    [formData, user]
  );

  const contactMissingLabels = useMemo(() => {
    const labels = {
      full_name: t("profile_full_name", "Nombre completo"),
      preferred_language: t("profile_language", "Idioma preferido"),
      country_code: t("profile_country", "Pais de residencia"),
      preferred_contact_method: t("preferred_contact_method", "Medio de contacto preferido"),
      phone: t("profile_phone", "Teléfono"),
      whatsapp_enabled: t("whatsapp_enabled", "WhatsApp habilitado"),
      whatsapp_number: t("whatsapp_number", "Número de WhatsApp"),
    };
    return draftContactProfileState.missing.map((key) => labels[key] || key);
  }, [draftContactProfileState.missing, t]);

  const contactPermissionSettings = useMemo(() => {
    if (isAdmin) {
      return [
        {
          key: "allow_teacher_contact",
          label: t("allow_teacher_contact_admin", "Permitir contacto de profesores"),
          help: t(
            "allow_teacher_contact_admin_help",
            "Autoriza que profesores verificados te contacten para coordinación o soporte operativo."
          ),
        },
        {
          key: "allow_student_contact",
          label: t("allow_student_contact_admin", "Permitir contacto de estudiantes"),
          help: t(
            "allow_student_contact_admin_help",
            "Autoriza que estudiantes puedan escribirte cuando necesiten ayuda o validación."
          ),
        },
      ];
    }

    if (isProfessorRole) {
      return [
        {
          key: "allow_student_contact",
          label: t("allow_student_contact_professor", "Permitir contacto de estudiantes inscritos"),
          help: t(
            "allow_student_contact_professor_help",
            "Solo estudiantes inscritos en tus seminarios podrán usar tus medios autorizados."
          ),
        },
        {
          key: "allow_admin_contact",
          label: t("allow_admin_contact_professor", "Permitir contacto de admin"),
          help: t(
            "allow_admin_contact_professor_help",
            "Autoriza que administración te contacte por soporte, incidencias o validaciones."
          ),
        },
      ];
    }

    return [
      {
        key: "allow_teacher_contact",
        label: t("allow_teacher_contact_student", "Permitir contacto del profesor"),
        help: t(
          "allow_teacher_contact_student_help",
          "Solo profesores de seminarios donde estés inscrito podrán usar tus medios autorizados."
        ),
      },
      {
        key: "allow_admin_contact",
        label: t("allow_admin_contact_student", "Permitir contacto de admin"),
        help: t(
          "allow_admin_contact_student_help",
          "Autoriza que administración te contacte por soporte, incidencias o validaciones."
        ),
      },
    ];
  }, [isAdmin, isProfessorRole, t]);

  const payoutMinimum = useMemo(
    () => getPayoutMinimum(formData.preferred_payout_method, formData.country_code),
    [formData.preferred_payout_method, formData.country_code]
  );
  const payoutMethodOptions = useMemo(
    () => getAvailablePayoutMethodOptions(formData.country_code, t),
    [formData.country_code, t]
  );

  useEffect(() => {
    const isHaitiLocalMethod =
      formData.preferred_payout_method === "moncash" ||
      formData.preferred_payout_method === "natcash";

    if (normalizeCountryCode(formData.country_code) !== "HT" && isHaitiLocalMethod) {
      setFormData((prev) => ({ ...prev, preferred_payout_method: "" }));
    }
  }, [formData.country_code, formData.preferred_payout_method]);

  const resetCropState = () => {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropMimeType("image/jpeg");
  };

  // ---- guardar cambios ----
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const payload = {
        id: user.id,
        full_name: formData.full_name,
        bio: formData.bio,
        phone: formData.phone,
        whatsapp_number: normalizeWhatsAppNumber(formData.whatsapp_number) || null,
        whatsapp_enabled: !!formData.whatsapp_enabled,
        preferred_contact_method: normalizeContactMethod(formData.preferred_contact_method) || null,
        allow_teacher_contact: !!formData.allow_teacher_contact,
        allow_admin_contact: !!formData.allow_admin_contact,
        allow_student_contact: !!formData.allow_student_contact,
        location: formData.location,
        country_code: normalizeCountryCode(formData.country_code) || null,
        preferred_language: formData.preferred_language,
        preferred_payout_method: formData.preferred_payout_method || null,
        payout_paypal_email: formData.payout_paypal_email.trim().toLowerCase() || null,
        payout_bank_account_name: formData.payout_bank_account_name.trim() || null,
        payout_bank_name: formData.payout_bank_name.trim() || null,
        payout_bank_account_number: formData.payout_bank_account_number.trim() || null,
        payout_bank_iban: formData.payout_bank_iban.trim() || null,
        payout_bank_swift: formData.payout_bank_swift.trim() || null,
        payout_mobile_wallet_full_name: formData.payout_mobile_wallet_full_name.trim() || null,
        payout_mobile_wallet_phone: formData.payout_mobile_wallet_phone.trim() || null,
        avatar_url: formData.avatar_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload);

      if (error) throw error;

      changeLanguage(formData.preferred_language);
      toast.success(t("profile_updated", "Perfil actualizado ✅"));

      // ✅ refresca profile global para Layout/CreateSeminar
      await refresh();

      if (onboardingMode === "contact" && draftContactProfileState.isComplete) {
        navigate(onboardingNext, { replace: true });
      }
    } catch (e) {
      toast.error(t("profile_save_error", "No se pudo guardar"));
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ---- solicitar profesor ----
  const requestProfessor = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          verification_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(t("profile_request_sent", "Solicitud enviada. Un administrador la revisará."));
      setShowBecomeProfessor(false);

      // ✅ refresca profile global
      await refresh();
    } catch (e) {
      toast.error(t("profile_request_error", "No se pudo enviar la solicitud"));
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const uploadAvatar = async (blob, mimeType) => {
    if (!user) return;
    const safeType = mimeType?.startsWith("image/") ? mimeType : "image/jpeg";
    const ext = safeType === "image/png" ? "png" : safeType === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
      upsert: true,
      cacheControl: "3600",
      contentType: safeType,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new Error(t("avatar_url_error", "No se pudo obtener URL pública."));

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (updErr) throw updErr;

    setFormData((p) => ({ ...p, avatar_url: publicUrl }));
    setAvatarPreview(publicUrl);
    await refresh();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error(t("avatar_only_images", "Solo se permiten imágenes"));
      return;
    }
    if (file.size > maxBytes(MAX_AVATAR_MB)) {
      toast.error(t("avatar_max_size", `El avatar debe ser máximo ${MAX_AVATAR_MB}MB`));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setCropImageSrc(previewUrl);
    setCropMimeType(file.type || "image/jpeg");
    setCropModalOpen(true);
    e.target.value = "";
  };

  const onCropComplete = (_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    resetCropState();
  };

  const handleCropSave = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    setCropLoading(true);
    setUploading(true);
    try {
      const blob = await getCroppedImageBlob(cropImageSrc, croppedAreaPixels, cropMimeType);
      await uploadAvatar(blob, cropMimeType);
      toast.success(t("avatar_updated", "Avatar actualizado"));
      setCropModalOpen(false);
      resetCropState();
    } catch (err) {
      toast.error(err?.message || t("avatar_upload_error", "No se pudo subir el avatar"));
    } finally {
      setCropLoading(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // Si ya terminó loading pero no hay user, el useEffect redirige.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-6">
        <ReviewPrompt />
        <Dialog
          open={cropModalOpen}
          onOpenChange={(open) => {
            if (!open) handleCropCancel();
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("avatar_crop_title", "Recortar foto")}</DialogTitle>
            </DialogHeader>
            <div className="relative w-full h-72 bg-slate-900/80 rounded-xl overflow-hidden">
              {cropImageSrc ? (
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-slate-600">{t("avatar_crop_zoom", "Zoom")}</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCropCancel} disabled={cropLoading}>
                {t("avatar_crop_cancel", "Cancelar")}
              </Button>
              <Button onClick={handleCropSave} disabled={cropLoading}>
                {cropLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("avatar_crop_save", "Guardar")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("profile", "Perfil")}</h1>
            <p className="text-slate-500">{t("profile_subtitle", "Gestiona tu información personal")}</p>
          </div>
        </div>

        <div className="space-y-6">
          {(onboardingMode === "contact" || !contactProfileComplete) && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
                <CardHeader>
                  <CardTitle>{t("contact_profile_required_title", "Completa tu perfil de contacto")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-emerald-950">
                  <p>
                    {onboardingMode === "contact"
                      ? t(
                          "profile_complete_before_continue",
                          "Necesitas completar estos datos antes de continuar."
                        )
                      : t(
                          "contact_profile_required_body_residence",
                          "Completa tu pais de residencia y un medio de contacto para poder inscribirte o crear seminarios."
                        )}
                  </p>
                  {!draftContactProfileState.isComplete && contactMissingLabels.length > 0 && (
                    <p>
                      {t("contact_profile_missing_fields", "Campos pendientes")}:{" "}
                      <span className="font-medium">{contactMissingLabels.join(", ")}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Profile Header Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Avatar */}
                  <div className="relative">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={t("profile_image_alt", "Profile")}
                        className="w-24 h-24 rounded-full object-cover border-4 border-white/20"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20">
                        <UserIcon className="h-12 w-12 text-white/60" />
                      </div>
                    )}
                    <label
                      className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
                      title={t("avatar_change", "Cambiar avatar")}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </label>
                  </div>

                  {/* Info */}
                  <div className="text-center sm:text-left">
                    <h2 className="text-2xl font-bold">{formData.full_name || user?.email}</h2>
                    <p className="text-white/70">{user?.email}</p>

                    {/* Badge rol */}
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-sm">
                        <RoleIcon className={`h-4 w-4 ${roleLabel.spin ? "animate-spin" : ""}`} />
                        {roleLabel.text}
                      </span>

                      {/* Bloque: SOLO si NO es admin */}
                      {!isAdmin && roleReady && !loading && (
                        <>
                          {isVerified || verificationStatus === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-sm text-emerald-200">
                              <GraduationCap className="h-4 w-4" />
                              {t("verified", "Verificado")}
                            </span>
                          ) : verificationStatus === "pending" ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 rounded-full text-sm text-amber-200">
                              {t("request_pending", "Solicitud pendiente")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowBecomeProfessor((s) => !s)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/15 rounded-full text-sm transition-colors"
                            >
                              <GraduationCap className="h-4 w-4" />
                              {t("becomeProfessor", "Convertirse en profesor")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel Convertirse en profesor */}
                {!isAdmin && showBecomeProfessor && (
                  <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/15">
                    <p className="text-sm text-white/80">
                      {t("profile_request_professor_help", "Envía tu solicitud para ser verificado como profesor. Un administrador la revisará.")}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={requestProfessor}
                        disabled={saving}
                        className="bg-white text-slate-900 hover:bg-white/90 rounded-xl"
                      >
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                        {t("profile_send_request", "Enviar solicitud")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowBecomeProfessor(false)}
                        className="text-white hover:bg-white/10 rounded-xl"
                      >
                        {t("common_cancel", "Cancelar")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Form Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>{t("profile_personal_info", "Información personal")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>{t("profile_full_name", "Nombre completo")}</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder={t("profile_full_name_placeholder", "Tu nombre")}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("profile_bio", "Bio")}</Label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                    placeholder={t("profile_bio_placeholder", "Cuéntanos un poco sobre ti...")}
                    className="min-h-28"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("profile_country", "Pais de residencia")} *</Label>
                  <Select
                    value={formData.country_code || undefined}
                    onValueChange={(value) => setFormData((p) => ({ ...p, country_code: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t("profile_country_placeholder", "Selecciona tu pais")} />
                    </SelectTrigger>

                    <SelectContent className="max-h-80 bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                      {countryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {t(
                      "profile_country_help",
                      "Usamos este pais para mostrar tu moneda local y los metodos de pago correctos."
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("profile_location_detail", "Ciudad o zona")}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                    placeholder={t("profile_location_detail_placeholder", "Ciudad, provincia o zona")}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    {t("profile_language", "Idioma preferido")}
                  </Label>

                  <Select
                    value={formData.preferred_language}
                    onValueChange={(v) => setFormData((p) => ({ ...p, preferred_language: v }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                      {LANG_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t space-y-5">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {t("profile_contact_section", "Contacto y permisos")}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {t(
                        "profile_contact_section_help",
                        "Estos datos se usan para coordinar contigo dentro de los seminarios y definir quién puede contactarte."
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("preferred_contact_method", "Medio de contacto preferido")}</Label>
                    <Select
                      value={formData.preferred_contact_method || undefined}
                      onValueChange={(v) => setFormData((p) => ({ ...p, preferred_contact_method: v }))}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder={t("preferred_contact_method", "Medio de contacto preferido")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                        <SelectItem value="email">{t("contact_method_email", "Email")}</SelectItem>
                        <SelectItem value="phone">{t("contact_method_phone", "Teléfono")}</SelectItem>
                        <SelectItem value="whatsapp">{t("contact_method_whatsapp", "WhatsApp")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("profile_phone", "Teléfono")}</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        placeholder={t("profile_phone_placeholder", "+1 ...")}
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("whatsapp_number", "Número de WhatsApp")}</Label>
                      <Input
                        value={formData.whatsapp_number}
                        onChange={(e) => setFormData((p) => ({ ...p, whatsapp_number: e.target.value }))}
                        placeholder={t("profile_phone_placeholder", "+1 ...")}
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{t("whatsapp_enabled", "WhatsApp habilitado")}</p>
                        <p className="text-sm text-slate-500">
                          {t("whatsapp_enabled_help", "Actívalo si este número también recibe mensajes por WhatsApp.")}
                        </p>
                      </div>
                      <Switch
                        checked={!!formData.whatsapp_enabled}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, whatsapp_enabled: checked }))}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {contactPermissionSettings.map((setting) => (
                      <div
                        key={setting.key}
                        className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{setting.label}</p>
                          <p className="text-sm text-slate-500">{setting.help}</p>
                        </div>
                        <Switch
                          checked={!!formData[setting.key]}
                          onCheckedChange={(checked) =>
                            setFormData((p) => ({ ...p, [setting.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t space-y-5">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {t("profile_payout_section", "Cobro y retiros")}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {t(
                        "profile_payout_section_help",
                        "Define como prefieres recibir retiros externos. Tu Saldo Okalab tambien podra usarse para pagar seminarios."
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("preferred_payout_method", "Metodo de retiro preferido")}</Label>
                    <Select
                      value={formData.preferred_payout_method || undefined}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          preferred_payout_method: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue
                          placeholder={t(
                            "preferred_payout_method_placeholder",
                            "Selecciona como quieres recibir tus retiros"
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                        {payoutMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.preferred_payout_method === "moncash" ||
                    formData.preferred_payout_method === "natcash") && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-900">
                          {t("payout_haiti_mobile_wallet_title", "Datos usados para este retiro")}
                        </p>
                        <p className="mt-1">
                          {t(
                            "payout_haiti_mobile_wallet_help",
                            "Introduce el nombre completo y el telefono exactos de tu cuenta MonCash o NatCash."
                          )}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {t(
                            "payout_haiti_mobile_wallet_requirements",
                            "No transferimos a terceros. Estos datos se usan solo para este metodo de retiro."
                          )}
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("payout_mobile_wallet_full_name", "Nombre completo del titular")}</Label>
                          <Input
                            value={formData.payout_mobile_wallet_full_name}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                payout_mobile_wallet_full_name: e.target.value,
                              }))
                            }
                            placeholder={t(
                              "payout_mobile_wallet_full_name_placeholder",
                              "Nombre exacto de la cuenta"
                            )}
                            className="h-12"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t("payout_mobile_wallet_phone", "Telefono de la cuenta")}</Label>
                          <Input
                            value={formData.payout_mobile_wallet_phone}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                payout_mobile_wallet_phone: e.target.value,
                              }))
                            }
                            placeholder={t("payout_mobile_wallet_phone_placeholder", "+509 ...")}
                            className="h-12"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.preferred_payout_method === "paypal" && (
                    <div className="space-y-2">
                      <Label>{t("payout_paypal_email", "Email de PayPal")}</Label>
                      <Input
                        value={formData.payout_paypal_email}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, payout_paypal_email: e.target.value }))
                        }
                        placeholder={t("email_placeholder", "user@email.com")}
                        className="h-12"
                      />
                    </div>
                  )}

                  {formData.preferred_payout_method === "bank_transfer" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bank_name", "Banco")}</Label>
                        <Input
                          value={formData.payout_bank_name}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, payout_bank_name: e.target.value }))
                          }
                          placeholder={t("bank_name", "Banco")}
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("bank_account_name", "Titular")}</Label>
                        <Input
                          value={formData.payout_bank_account_name}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              payout_bank_account_name: e.target.value,
                            }))
                          }
                          placeholder={t("bank_account_name", "Titular")}
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("bank_account_number", "Cuenta")}</Label>
                        <Input
                          value={formData.payout_bank_account_number}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              payout_bank_account_number: e.target.value,
                            }))
                          }
                          placeholder={t("bank_account_number", "Cuenta")}
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>IBAN</Label>
                        <Input
                          value={formData.payout_bank_iban}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, payout_bank_iban: e.target.value }))
                          }
                          placeholder="IBAN"
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label>SWIFT</Label>
                        <Input
                          value={formData.payout_bank_swift}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, payout_bank_swift: e.target.value }))
                          }
                          placeholder="SWIFT"
                          className="h-12"
                        />
                      </div>
                    </div>
                  )}

                  {formData.preferred_payout_method ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">
                        {t("payout_minimum_label", "Minimo de retiro")}
                      </p>
                      <p className="mt-1">
                        {t(
                          "payout_minimum_help_dynamic",
                          "{method}: USD {amount} minimo para retiro externo."
                        )
                          .replace(
                            "{method}",
                            getPayoutMethodLabel(formData.preferred_payout_method, t)
                          )
                          .replace("{amount}", Number(payoutMinimum || 0).toFixed(2))}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {t(
                          "okalab_wallet_usage_help",
                          "Tu Saldo Okalab puede usarse desde USD 0.10 para pagar seminarios dentro de la plataforma."
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="h-14 bg-slate-900 hover:bg-slate-800 rounded-xl flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {onboardingMode === "contact"
                ? t("save_and_continue", "Guardar y continuar")
                : t("common_save_changes", "Guardar cambios")}
            </Button>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="h-14 border-slate-200 text-red-600 hover:bg-red-50 rounded-xl sm:w-44"
            >
              {t("logout", "Cerrar sesión")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

