import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import { Label } from "../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
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

const LANG_OPTIONS = [
  { value: "es", label: "🇪🇸 Español" },
  { value: "en", label: "🇬🇧 English" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "ht", label: "🇭🇹 Kreyòl" },
];

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_MB = 2;
const maxBytes = (mb) => mb * 1024 * 1024;

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, changeLanguage } = useLanguage();

  // ✅ Fuente única de verdad (AuthProvider)
  const { user, profile, loading, refresh, role, roleReady, isAdmin } = useAuth();
  const profileRow = profile;

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [showBecomeProfessor, setShowBecomeProfessor] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    phone: "",
    location: "",
    preferred_language: "es",
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
      location: profileRow?.location || "",
      preferred_language: profileRow?.preferred_language || defaultLang,
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
        location: formData.location,
        preferred_language: formData.preferred_language,
        avatar_url: formData.avatar_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload);

      if (error) throw error;

      changeLanguage(formData.preferred_language);
      toast.success(t("profile_updated", "Perfil actualizado ✅"));

      // ✅ refresca profile global para Layout/CreateSeminar
      await refresh();
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
    await supabase.auth.signOut();
    navigate("/");
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

    setUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;

      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
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
      toast.success(t("avatar_updated", "Avatar actualizado"));
    } catch (err) {
      toast.error(err?.message || t("avatar_upload_error", "No se pudo subir el avatar"));
    } finally {
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
                    <Label>{t("profile_location", "Ubicación")}</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                      placeholder={t("profile_location_placeholder", "Ciudad, país")}
                      className="h-12"
                    />
                  </div>
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
              {t("common_save_changes", "Guardar cambios")}
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

