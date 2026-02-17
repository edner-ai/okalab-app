// CreateSeminar.jsx (UNIFIED)
// Nota: este archivo es grande. Está basado en tu CreateSeminar actual y solo agrega:
// - modo edición (?edit=...)
// - update en vez de insert
// - spinner al cargar seminario

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import { Label } from "../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { Calendar } from "../Components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../Components/ui/popover";

import { ArrowLeft, Calendar as CalendarIcon, Upload, Plus, X, Loader2, Check, DollarSign, Clock, Users, MapPin, Video } from "lucide-react";
import { motion } from "framer-motion";
import { format, isBefore, isEqual } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const categoryOptions = [
  { value: "employability", label: "Empleabilidad" },
  { value: "entrepreneurship", label: "Emprendimiento" },
  { value: "digital_skills", label: "Habilidades digitales" },
];

const modalityOptions = [
  { value: "online", label: "En línea" },
  { value: "presential", label: "Presencial" },
  { value: "hybrid", label: "Híbrida" },
];

const languageOptions = [
  { value: "es", labelKey: "language_es", fallback: "Español" },
  { value: "en", labelKey: "language_en", fallback: "English" },
  { value: "fr", labelKey: "language_fr", fallback: "Français" },
  { value: "ht", labelKey: "language_ht", fallback: "Kreyòl" },
];

const MAX_IMAGE_MB = 2;
const MAX_MATERIAL_MB = 25;
const maxBytes = (mb) => mb * 1024 * 1024;

const ALLOWED_MATERIAL_MIME = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
]);




export default function CreateSeminar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const editId = useMemo(() => new URLSearchParams(location.search).get("edit"), [location.search]);
  const isEditing = !!editId;

  const { user, profile, loading, canCreateSeminar, role } = useAuth();
  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_public_fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("platform_fee_percent, surplus_professor_percent, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    refetchOnMount: "always",
    staleTime: 1000 * 60 * 5,
  });

  const [uploading, setUploading] = useState(false);
  const [loadingSeminar, setLoadingSeminar] = useState(false);
  const settingsAppliedRef = useRef(false);
  const languageTouchedRef = useRef(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    modality: "online",
    start_date: null,
    end_date: null,
    total_hours: "",
    target_income: "",
    target_students: 15,
    excess_students: 0,
    payment_due_days: 7,
    max_students: "",
    image_url: "",
    materials: [],
    language: localStorage.getItem("preferred_language") || "es",
    status: "draft",
    location_address: "",
    location_lat: null,
    location_lng: null,
    video_conference_platform: "zoom",
    video_conference_link: "",
    video_conference_id: "",
    video_conference_password: "",
    has_certificate: false,
    platform_fee_percent: Number(import.meta.env.VITE_DEFAULT_PLATFORM_FEE_PERCENT || 15),
    professor_bonus_percent: 30,
  });

  // Cargar seminario en modo edición (?edit=<id>)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isEditing) return;
      if (!user) return;

      setLoadingSeminar(true);
      try {
        const { data, error } = await supabase
          .from("seminars")
          .select("*")
          .eq("id", editId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setFormData((prev) => ({
          ...prev,
          ...data,
          start_date: data.start_date ? new Date(data.start_date) : null,
          end_date: data.end_date ? new Date(data.end_date) : null,
          materials: Array.isArray(data.materials) ? data.materials : (prev.materials || []),
        }));
      } catch (err) {
        toast.error(err?.message || t("seminar_edit_load_error", "Error al cargar el seminario para editar"));
      } finally {
        if (!cancelled) setLoadingSeminar(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isEditing, editId, user]);

  // Aplicar defaults desde BO en modo creación
  useEffect(() => {
    if (settingsAppliedRef.current) return;
    if (!platformSettings) return;
    if (isEditing) return;

    const fee = Number(platformSettings.platform_fee_percent);
    const bonus = Number(platformSettings.surplus_professor_percent);

    setFormData((prev) => ({
      ...prev,
      platform_fee_percent: Number.isFinite(fee) ? fee : prev.platform_fee_percent,
      professor_bonus_percent: Number.isFinite(bonus) ? bonus : prev.professor_bonus_percent,
    }));

    settingsAppliedRef.current = true;
  }, [platformSettings, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    if (languageTouchedRef.current) return;

    const preferredLang =
      profile?.preferred_language || localStorage.getItem("preferred_language") || "es";

    setFormData((prev) => (prev.language === preferredLang ? prev : { ...prev, language: preferredLang }));
  }, [isEditing, profile?.preferred_language]);

  const handleChange = (field, value) => {
    if (field === "language") {
      languageTouchedRef.current = true;
    }

    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Si cambia la fecha de inicio, la fecha de fin no puede ser anterior o igual
      if (field === "start_date") {
        const start = value instanceof Date ? value : null;
        if (start && next.end_date instanceof Date) {
          if (isBefore(next.end_date, start) || isEqual(next.end_date, start)) {
            next.end_date = null;
          }
        }
      }


      const ts = parseInt(next.target_students, 10);
      const esx = parseInt(next.excess_students, 10);
      if (Number.isFinite(ts) && Number.isFinite(esx)) {
        next.max_students = String(Math.max(0, ts + esx));
      }

      return next;
    });
  };

  const isValid = useMemo(() => {
    return (
      !!formData.title &&
      !!formData.description &&
      !!formData.category &&
      !!formData.language &&
      !!formData.start_date &&
      !!formData.end_date &&
      !!formData.total_hours &&
      !!formData.target_income &&
      !!formData.target_students
    );
  }, [formData]);

  const uploadToStorage = async ({ file, folder, bucket, maxMb, validateMime }) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    if (maxMb && file.size > maxBytes(maxMb)) {
      throw new Error(t("file_max_size", `El archivo debe ser máximo ${maxMb}MB.`));
    }

    if (validateMime && !validateMime(file)) {
      throw new Error(t("file_invalid_format", "Formato no permitido para este campo."));
    }

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) {
      const msg = error?.message || t("file_upload_error", "Error al subir archivo.");
      if (msg.toLowerCase().includes("mime type")) {
        throw new Error(t("materials_invalid_format", "Formato no permitido. Usa PDF o ZIP para materiales."));
      }
      throw error;
    }

    const isPublicBucket = bucket === "seminar-images";
    if (isPublicBucket) {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
      return { publicUrl: publicData.publicUrl, path, bucket };
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);

    if (signedError) throw signedError;

    return { signedUrl: signed.signedUrl, path, bucket };
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadToStorage({
        file,
        folder: "seminar-images",
        bucket: "seminar-images",
        maxMb: MAX_IMAGE_MB,
        validateMime: (f) => f.type?.startsWith("image/"),
      });

      handleChange("image_url", res.publicUrl || res.signedUrl);
      toast.success(t("seminar_image_uploaded", "Imagen subida correctamente"));
    } catch (err) {
      toast.error(err?.message || t("seminar_image_upload_error", "Error al subir la imagen."));
    } finally {
      setUploading(false);
    }
  };

  const handleMaterialUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadToStorage({
        file,
        folder: "seminar-materials",
        bucket: "seminar-materials",
        maxMb: MAX_MATERIAL_MB,
        validateMime: (f) => ALLOWED_MATERIAL_MIME.has(f.type),
      });

      const material = {
        name: file.name,
        url: res.signedUrl,
        type: file.type?.includes("video") ? "video" : "document",
      };

      handleChange("materials", [...(formData.materials || []), material]);
      toast.success(t("seminar_material_uploaded", "Material subido correctamente"));
    } catch (err) {
      toast.error(err?.message || t("seminar_material_upload_error", "Error al subir el material."));
    } finally {
      setUploading(false);
    }
  };

  const removeMaterial = (index) => {
    handleChange(
      "materials",
      (formData.materials || []).filter((_, i) => i !== index)
    );
  };

  const createMutation = useMutation({
    mutationFn: async (status) => {
      if (!user) throw new Error(t("auth_required_create_seminar", "Debes iniciar sesión para crear un seminario."));
      if (!canCreateSeminar) throw new Error(t("create_seminar_no_permission", "No tienes permisos para crear seminarios."));

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUser = authData?.user || user;
      if (authError || !currentUser) {
        throw new Error(t("auth_required_create_seminar", "Debes iniciar sesión para crear un seminario."));
      }

      const professorName =
        profile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email;

      const seminarData = {
        ...formData,
        status,
        ...(isEditing
          ? {}
              : {
              professor_id: currentUser.id,
              instructor_id: currentUser.id,
              professor_email: currentUser.email,
              professor_name: professorName,
            }),
        total_hours: parseFloat(formData.total_hours),
        target_income: parseFloat(formData.target_income),
        target_students: parseInt(formData.target_students, 10),
        excess_students: parseInt(formData.excess_students, 10),
        payment_due_days: parseInt(formData.payment_due_days, 10),
        max_students: Number.isFinite(parseInt(formData.max_students, 10))
          ? parseInt(formData.max_students, 10)
          : parseInt(formData.target_students, 10) + parseInt(formData.excess_students, 10),
        start_date: formData.start_date ? format(formData.start_date, "yyyy-MM-dd") : null,
        end_date: formData.end_date ? format(formData.end_date, "yyyy-MM-dd") : null,
      };

      seminarData.location_lat =
        formData.location_lat === "" || formData.location_lat === null ? null : Number(formData.location_lat);
      seminarData.location_lng =
        formData.location_lng === "" || formData.location_lng === null ? null : Number(formData.location_lng);

      let q = supabase.from("seminars");
      if (isEditing) {
        q = q.update(seminarData).eq("id", editId);
      } else {
        q = q.insert([seminarData]);
      }

      const { data, error } = await q.select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (seminar) => {
      toast.success(isEditing ? t("seminar_updated", "Seminario actualizado correctamente") : t("seminar_created", "Seminario creado correctamente"));
      navigate(`/seminars/${seminar.id}`);
    },
    onError: (err) => {
      toast.error(err?.message || t("seminar_save_error", "Error al guardar seminario"));
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("common_loading", "Cargando…")}</span>
        </div>
      </div>
    );
  }

  if (loadingSeminar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("seminar_loading", "Cargando seminario…")}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="border-0 shadow-md max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("auth_login", "Inicia sesión")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-sm">{t("auth_required_create_seminar", "Debes iniciar sesión para crear un seminario.")}</p>
            <Button className="w-full" onClick={() => navigate("/login")}>
              {t("auth_go_login", "Ir a login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canCreateSeminar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="border-0 shadow-md max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("no_permission", "Sin permisos")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-sm">
              {t("create_seminar_permission", "Solo profesor o admin puede crear seminarios.")}
            </p>
            <Link to="/profile">
              <Button className="w-full" variant="outline">
                {t("go_profile", "Ir a Perfil")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meetingPlaceholder =
    {
      zoom: "https://zoom.us/j/...",
      meet: "https://meet.google.com/...",
      teams: "https://teams.microsoft.com/l/meetup-join/...",
      other: t("meeting_link_placeholder", "Pega aquí el enlace de la reunión..."),
    }[formData.video_conference_platform] || t("meeting_link_placeholder", "Pega aquí el enlace...");

    return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/seminars">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? t("edit_seminar", "Editar seminario") : t("createSeminar", "Crear seminario")}
            </h1>
            <p className="text-slate-500">
              {isEditing
                ? t("edit_seminar_subtitle", "Actualiza los datos de tu seminario")
                : t("create_seminar_subtitle", "Define tu seminario y establece tu ingreso objetivo")}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>{t("basic_info", "Información básica")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>{t("title", "Título")} *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      placeholder={t("seminar_title_placeholder", "Ej: Introducción al Marketing Digital")}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("description", "Descripción")} *</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder={t("seminar_description_placeholder", "Describe el contenido y objetivos del seminario...")}
                      className="min-h-32"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t("category", "Categoría")} *</Label>
                      <Select value={formData.category} onValueChange={(v) => handleChange("category", v)}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder={t("selectCategory", "Selecciona categoría")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[99999] shadow-lg border">
                          {categoryOptions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {t(c.value, c.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("modality", "Modalidad")} *</Label>
                      <Select value={formData.modality} onValueChange={(v) => handleChange("modality", v)}>
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[99999] shadow-lg border">
                          {modalityOptions.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {t(m.value, m.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("common_language", "Idioma")} *</Label>
                      <Select value={formData.language} onValueChange={(v) => handleChange("language", v)}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder={t("common_language", "Idioma")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[99999] shadow-lg border">
                          {languageOptions.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {t(lang.labelKey, lang.fallback)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("seminar_image", "Imagen del seminario")}</Label>

                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-300 transition-colors">
                      {formData.image_url ? (
                        <div className="relative inline-block">
                          <img
                            src={formData.image_url}
                            alt="Preview"
                            className="h-32 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleChange("image_url", "")}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                            aria-label="Quitar imagen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          {uploading ? (
                            <Loader2 className="h-8 w-8 mx-auto text-slate-400 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                              <p className="text-sm text-slate-500">{t("seminar_image_upload", "Haz clic para subir una imagen")}</p>
                            </>
                          )}
                        </label>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      Formatos permitidos: JPG/PNG/WebP. Máximo {MAX_IMAGE_MB}MB.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>{t("dates_duration", "Fechas y duración")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label>{t("startDate", "Fecha de inicio")} *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-12 justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.start_date
                              ? format(formData.start_date, "PPP", { locale: es })
                              : t("select_date", "Seleccionar fecha")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white shadow-xl border z-[99999]">
                          <Calendar
                            mode="single"
                            selected={formData.start_date}
                            onSelect={(date) => handleChange("start_date", date)}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                    <Label>{t("endDate", "Fecha de fin")} *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-12 justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.end_date
                              ? format(formData.end_date, "PPP", { locale: es })
                              : t("select_date", "Seleccionar fecha")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white shadow-xl border z-[99999]">
                          <Calendar
                            mode="single"
                            selected={formData.end_date}
                            onSelect={(date) => handleChange("end_date", date)}
                            locale={es}
                            disabled={(date) =>
                              formData.start_date instanceof Date
                                ? isBefore(date, formData.start_date) || isEqual(date, formData.start_date)
                                : false
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label>{t("total_hours", "Total de horas")} *</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.total_hours}
                          onChange={(e) => handleChange("total_hours", e.target.value)}
                          placeholder="10"
                          className="h-12 pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                    <Label>{t("payment_due_days", "Pago (días antes del inicio)")} *</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.payment_due_days}
                          onChange={(e) => handleChange("payment_due_days", e.target.value)}
                          placeholder="7"
                          className="h-12 pl-10"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("payment_due_note", "Los estudiantes pagan")}{" "}
                        <b>{formData.payment_due_days || 7} {t("days", "días")}</b> {t("payment_due_note_suffix", "antes del inicio (configurable por admin).")}
                      </p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="block min-h-[40px] leading-tight">
                        {t("target_students_label", "Objetivo de estudiantes (para bajar el precio)")} *
                      </Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.target_students}
                          onChange={(e) => handleChange("target_students", e.target.value)}
                          placeholder="15"
                          className="h-12 pl-10"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("target_students_help", "Este número se usa para determinar el precio por estudiante.")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="block min-h-[40px] leading-tight">
                        {t("excess_students_label", "Excedente (cupos extra)")}
                      </Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          value={formData.excess_students}
                          onChange={(e) => handleChange("excess_students", e.target.value)}
                          placeholder="5"
                          className="h-12 pl-10"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("total_capacity", "Capacidad total")}: <b>{formData.max_students || "-"}</b> {t("capacity_formula", "(objetivo + excedente)")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Location */}
            {(formData.modality === "presential" || formData.modality === "hybrid") && (
              <motion.div
                initial={{ opacity: 0, recall: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {t("location", "Ubicación")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("address", "Dirección")}</Label>
                      <Textarea
                        value={formData.location_address}
                        onChange={(e) => handleChange("location_address", e.target.value)}
                        placeholder={t("address_placeholder", "Dirección completa del lugar...")}
                        className="min-h-20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("latitude_optional", "Latitud (opcional)")}</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.location_lat ?? ""}
                          onChange={(e) =>
                            handleChange("location_lat", e.target.value ? parseFloat(e.target.value) : null)
                          }
                          placeholder="18.5944"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("longitude_optional", "Longitud (opcional)")}</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.location_lng ?? ""}
                          onChange={(e) =>
                            handleChange("location_lng", e.target.value ? parseFloat(e.target.value) : null)
                          }
                          placeholder="-72.3074"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Video conference */}
            {(formData.modality === "online" || formData.modality === "hybrid") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.175 }}
              >
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      {t("videoConference", "Videoconferencia")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("platform", "Plataforma")}</Label>
                      <Select
                        value={formData.video_conference_platform}
                        onValueChange={(v) => handleChange("video_conference_platform", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[99999] shadow-lg border">
                          <SelectItem value="zoom">📹 {t("video_platform_zoom", "Zoom")}</SelectItem>
                          <SelectItem value="meet">🎥 {t("video_platform_meet", "Google Meet")}</SelectItem>
                          <SelectItem value="teams">👥 {t("video_platform_teams", "Microsoft Teams")}</SelectItem>
                          <SelectItem value="other">💻 {t("video_platform_other", "Otra")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("meetingLink", "Enlace de reunión")}</Label>
                      <Input
                        value={formData.video_conference_link}
                        onChange={(e) => handleChange("video_conference_link", e.target.value)}
                        placeholder={meetingPlaceholder}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("meetingId_optional", "ID de reunión (opcional)")}</Label>
                        <Input
                          value={formData.video_conference_id}
                          onChange={(e) => handleChange("video_conference_id", e.target.value)}
                          placeholder="123 456 789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("password_optional", "Contraseña (opcional)")}</Label>
                        <Input
                          value={formData.video_conference_password}
                          onChange={(e) => handleChange("video_conference_password", e.target.value)}
                          placeholder="******"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Certificate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.19 }}
            >
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    {t("certificate", "Certificado")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-900">{t("certificate_offer", "Ofrecer certificado de finalización")}</p>
                      <p className="text-sm text-slate-500">{t("certificate_help", "Los estudiantes recibirán un certificado al completar")}</p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData.has_certificate}
                        onChange={(e) => handleChange("has_certificate", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Materials */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>{t("materials", "Materiales")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.materials.map((material, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{material.name}</p>
                        <p className="text-sm text-slate-500">{material.type}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeMaterial(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                    <label className="flex items-center gap-3 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:border-slate-300 transition-colors">
                      <input type="file" onChange={handleMaterialUpload} className="hidden" />
                      {uploading ? (
                        <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                      ) : (
                        <Plus className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="text-slate-500">{t("add_material", "Agregar material descargable")}</span>
                    </label>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar - Pricing */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white sticky top-24">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {t("targetIncome", "Ingreso objetivo")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/70">{t("target_income_usd", "Ingreso objetivo (USD)")} *</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                        $
                      </span>
                      <Input
                        type="number"
                        value={formData.target_income}
                        onChange={(e) => handleChange("target_income", e.target.value)}
                        placeholder="500"
                        className="h-14 pl-10 text-xl font-bold bg-white/10 border-white/20 text-white"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-white/10 rounded-xl space-y-3">
                    <p className="text-sm text-white/70">{t("price_calculation", "Cálculo de precios:")}</p>
                    {formData.target_income ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>{t("targetIncome", "Ingreso objetivo")}:</span>
                          <span className="font-bold">
                            ${parseFloat(formData.target_income || "0").toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                          <span>{t("platformFee", "Comisión plataforma")} ({formData.platform_fee_percent}%):</span>
                          <span className="font-bold text-amber-300">
                            -$
                            {(
                              parseFloat(formData.target_income || "0") *
                              (formData.platform_fee_percent / 100)
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
                          <span>{t("net_income", "Tu ingreso neto")}:</span>
                          <span className="text-emerald-300">
                            $
                            {(
                              parseFloat(formData.target_income || "0") *
                              (1 - formData.platform_fee_percent / 100)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="p-3 bg-emerald-500/20 rounded-lg">
                    <p className="text-xs text-white/90">
                      {t("surplusExplanation", "💡 Si el total recaudado supera tu objetivo, {percent}% del excedente es para ti como bonus, el resto se distribuye entre estudiantes que trajeron referidos.")
                          .replace("{percent}", formData.professor_bonus_percent ?? 0)}
                    </p>
                  </div>

                  <p className="text-xs text-white/50">
                    {t("students_pay_less", "Los estudiantes pagan menos cuantos más confirmen.")} {t("target", "Objetivo")}: {formData.target_students || "-"}· {t("total_capacity", "Capacidad total")}: {formData.max_students || "-"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <div className="space-y-3">
              <Button
                onClick={() => createMutation.mutate("draft")}
                disabled={!isValid || createMutation.isPending}
                variant="outline"
                className="w-full h-12"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("save_draft", "Guardar borrador")}
              </Button>

              <Button
                onClick={() => createMutation.mutate("published")}
                disabled={!isValid || createMutation.isPending}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {t("publish", "Publicar")}
              </Button>

              {!isValid ? (
                <p className="text-xs text-slate-500">
                  {t("publish_requirements", "Completa todos los campos obligatorios (*) para publicar (incluye fecha fin, objetivo y días de pago).")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
