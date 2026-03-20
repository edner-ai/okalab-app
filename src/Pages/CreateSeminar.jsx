// CreateSeminar.jsx (UNIFIED)
// Nota: este archivo es grande. Está basado en tu CreateSeminar actual y solo agrega:
// - modo edición (?edit=...)
// - update en vez de insert
// - spinner al cargar seminario

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Upload,
  Plus,
  X,
  Loader2,
  Check,
  DollarSign,
  Clock,
  Users,
  MapPin,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  PlayCircle,
  FileText,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, isBefore, isEqual } from "date-fns";
import { getDateFnsLocale } from "../utils/dateLocale";
import { resolvePaymentWindow } from "../utils/paymentWindow";
import { parseDateValue } from "../utils/dateValue";
import { buildContactOnboardingUrl } from "../utils/contactProfile";
import {
  getMeetingLinkPlaceholder,
  getVideoConferencePlatformOptions,
  isCustomVideoConferencePlatform,
  supportsMeetingCredentials,
} from "../utils/videoConference";
import {
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  normalizeSeminarMaterials,
  parseYouTubeVideoId,
} from "../utils/seminarMedia";
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

const coverTypeOptions = [
  { value: "image", labelKey: "seminar_cover_image", fallback: "Imagen" },
  { value: "youtube", labelKey: "seminar_cover_youtube", fallback: "Video YouTube" },
];

const materialTypeOptions = [
  { value: "file", labelKey: "material_type_file", fallback: "Archivo" },
  { value: "youtube", labelKey: "material_type_youtube", fallback: "YouTube" },
  { value: "link", labelKey: "material_type_link", fallback: "Enlace" },
];




export default function CreateSeminar() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const dateLocale = useMemo(() => getDateFnsLocale(language), [language]);
  const editId = useMemo(() => new URLSearchParams(location.search).get("edit"), [location.search]);
  const isEditing = !!editId;

  const { user, profile, loading, canCreateSeminar, role, contactProfileComplete } = useAuth();
  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_create_seminar"],
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

  const [uploading, setUploading] = useState(false);
  const [loadingSeminar, setLoadingSeminar] = useState(false);
  const settingsAppliedRef = useRef(false);
  const languageTouchedRef = useRef(false);
  const loadedSeminarIdRef = useRef(null);

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
max_students: "",
    cover_type: "image",
    cover_video_url: "",
    cover_video_provider: "",
    cover_video_id: "",
    image_url: "",
    materials: [],
    language: localStorage.getItem("preferred_language") || "es",
    status: "draft",
    location_address: "",
    location_lat: null,
    location_lng: null,
    video_conference_platform: "zoom",
    video_conference_platform_custom_name: "",
    video_conference_link: "",
    video_conference_id: "",
    video_conference_password: "",
    has_certificate: false,
    platform_fee_percent: Number(import.meta.env.VITE_DEFAULT_PLATFORM_FEE_PERCENT || 15),
    professor_bonus_percent: 30,
  });
  const [materialDraft, setMaterialDraft] = useState({
    type: "file",
    title: "",
    url: "",
  });

  // Cargar seminario en modo edición (?edit=<id>)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isEditing) return;
      if (!user) return;
      if (loadedSeminarIdRef.current === editId) return;

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
          start_date: parseDateValue(data.start_date),
          end_date: parseDateValue(data.end_date),
          cover_type: data.cover_type === "youtube" ? "youtube" : "image",
          cover_video_url: data.cover_video_url || "",
          cover_video_provider: data.cover_video_provider || "",
          cover_video_id: data.cover_video_id || "",
          materials: normalizeSeminarMaterials(data.materials || prev.materials || []),
        }));
        loadedSeminarIdRef.current = editId;
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

  const handleVideoConferencePlatformChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      video_conference_platform: value,
      video_conference_platform_custom_name:
        value === "other" ? prev.video_conference_platform_custom_name : "",
      video_conference_id: supportsMeetingCredentials(value) ? prev.video_conference_id : "",
      video_conference_password: supportsMeetingCredentials(value)
        ? prev.video_conference_password
        : "",
    }));
  };

  const handleCoverTypeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      cover_type: value === "youtube" ? "youtube" : "image",
    }));
  };

  const handleCoverVideoUrlChange = (value) => {
    const videoId = parseYouTubeVideoId(value);
    setFormData((prev) => ({
      ...prev,
      cover_video_url: value,
      cover_video_provider: videoId ? "youtube" : "",
      cover_video_id: videoId || "",
    }));
  };

  const handleMaterialDraftChange = (field, value) => {
    setMaterialDraft((prev) => ({ ...prev, [field]: value }));
  };

  const appendMaterial = (material) => {
    handleChange("materials", [...(formData.materials || []), material]);
  };

  const isValid = useMemo(() => {
    const hasValidCoverVideo =
      formData.cover_type !== "youtube" || !!parseYouTubeVideoId(formData.cover_video_url);
    const hasValidCustomVideoPlatform =
      !isCustomVideoConferencePlatform(formData.video_conference_platform) ||
      !!String(formData.video_conference_platform_custom_name || "").trim();

    return (
      !!formData.title &&
      !!formData.description &&
      !!formData.category &&
      !!formData.language &&
      !!formData.start_date &&
      !!formData.end_date &&
      !!formData.total_hours &&
      !!formData.target_income &&
      !!formData.target_students &&
      hasValidCoverVideo &&
      hasValidCustomVideoPlatform
    );
  }, [formData]);

  const coverVideoId = useMemo(
    () => parseYouTubeVideoId(formData.cover_video_url),
    [formData.cover_video_url]
  );

  const coverPreviewImage = useMemo(() => {
    if (formData.cover_type === "youtube" && coverVideoId) {
      return buildYouTubeThumbnailUrl(coverVideoId);
    }
    return formData.image_url || "";
  }, [coverVideoId, formData.cover_type, formData.image_url]);

  const materialPreviewLabel = useMemo(() => {
    const selected = materialTypeOptions.find((option) => option.value === materialDraft.type);
    return selected ? t(selected.labelKey, selected.fallback) : t("material_type_file", "Archivo");
  }, [materialDraft.type, t]);

  const normalizedMaterials = useMemo(
    () => normalizeSeminarMaterials(formData.materials || []),
    [formData.materials]
  );

  const paymentWindowPreview = useMemo(
    () =>
      resolvePaymentWindow({
        seminarStartDate: formData.start_date,
        settings: platformSettings,
      }),
    [formData.start_date, platformSettings]
  );

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
        id: crypto.randomUUID(),
        title: materialDraft.title?.trim() || file.name,
        name: file.name,
        url: res.signedUrl,
        path: res.path,
        bucket: res.bucket,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        type: "file",
      };

      appendMaterial(material);
      setMaterialDraft((prev) => ({ ...prev, title: "" }));
      toast.success(t("seminar_material_uploaded", "Material subido correctamente"));
    } catch (err) {
      toast.error(err?.message || t("seminar_material_upload_error", "Error al subir el material."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addExternalMaterial = () => {
    const title = materialDraft.title.trim();
    const rawUrl = materialDraft.url.trim();

    if (materialDraft.type === "youtube") {
      const videoId = parseYouTubeVideoId(rawUrl);
      if (!videoId) {
        toast.error(t("youtube_url_invalid", "Ingresa un enlace válido de YouTube."));
        return;
      }

      appendMaterial({
        id: crypto.randomUUID(),
        title: title || t("youtube_material_default_title", "Video de YouTube"),
        type: "youtube",
        url: buildYouTubeWatchUrl(videoId),
        youtube_video_id: videoId,
      });
      setMaterialDraft({ type: "youtube", title: "", url: "" });
      return;
    }

    if (materialDraft.type === "link") {
      try {
        const normalized = new URL(rawUrl);
        appendMaterial({
          id: crypto.randomUUID(),
          title: title || normalized.hostname,
          type: "link",
          url: normalized.toString(),
        });
        setMaterialDraft({ type: "link", title: "", url: "" });
      } catch {
        toast.error(t("material_link_invalid", "Ingresa un enlace válido."));
      }
    }
  };

  const buildStoredMaterials = (materials) =>
    normalizeSeminarMaterials(materials).map((material) => ({
      id: material.id,
      title: material.title,
      name: material.title,
      type: material.type,
      url: material.url,
      youtube_video_id: material.youtubeVideoId || null,
      mime_type: material.mimeType || null,
      bucket: material.bucket || null,
      path: material.path || null,
      description: material.description || null,
    }));

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
      if (!contactProfileComplete) {
        navigate(buildContactOnboardingUrl(`${location.pathname}${location.search || ""}`));
        throw new Error(
          t(
            "contact_profile_required_create_seminar",
            "Completa tu perfil de contacto antes de crear un seminario."
          )
        );
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUser = authData?.user || user;
      if (authError || !currentUser) {
        throw new Error(t("auth_required_create_seminar", "Debes iniciar sesión para crear un seminario."));
      }

      const professorName =
        profile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email;

      const resolvedCoverVideoId =
        formData.cover_type === "youtube" ? parseYouTubeVideoId(formData.cover_video_url) : null;

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
max_students: Number.isFinite(parseInt(formData.max_students, 10))
          ? parseInt(formData.max_students, 10)
          : parseInt(formData.target_students, 10) + parseInt(formData.excess_students, 10),
        start_date: formData.start_date ? format(formData.start_date, "yyyy-MM-dd") : null,
        end_date: formData.end_date ? format(formData.end_date, "yyyy-MM-dd") : null,
        cover_type: formData.cover_type === "youtube" ? "youtube" : "image",
        cover_video_url: resolvedCoverVideoId ? buildYouTubeWatchUrl(resolvedCoverVideoId) : null,
        cover_video_provider: resolvedCoverVideoId ? "youtube" : null,
        cover_video_id: resolvedCoverVideoId,
        video_conference_platform_custom_name: requiresCustomPlatformName
          ? String(formData.video_conference_platform_custom_name || "").trim()
          : null,
        video_conference_id: showMeetingCredentials ? formData.video_conference_id : null,
        video_conference_password: showMeetingCredentials ? formData.video_conference_password : null,
        materials: buildStoredMaterials(formData.materials || []),
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
    onSuccess: async (seminar) => {
      queryClient.setQueryData(["seminar", seminar.id], seminar);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seminar", seminar.id] }),
        queryClient.invalidateQueries({ queryKey: ["quote", seminar.id] }),
        queryClient.invalidateQueries({ queryKey: ["seminar-enrollments", seminar.id] }),
        queryClient.invalidateQueries({ queryKey: ["seminar-enrollment-count", seminar.id] }),
        queryClient.invalidateQueries({ queryKey: ["seminars"] }),
        queryClient.invalidateQueries({ queryKey: ["home-featured-seminars"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-seminars"] }),
        queryClient.invalidateQueries({ queryKey: ["my-seminars"] }),
      ]);

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

  if (!contactProfileComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="border-0 shadow-md max-w-lg w-full">
          <CardHeader>
            <CardTitle>{t("contact_profile_required_title", "Completa tu perfil de contacto")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-sm">
              {t(
                "contact_profile_required_create_seminar",
                "Completa tu perfil de contacto antes de crear un seminario."
              )}
            </p>
            <Link to={buildContactOnboardingUrl(`${location.pathname}${location.search || ""}`)}>
              <Button className="w-full">{t("complete_profile", "Completar perfil")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meetingPlaceholder = getMeetingLinkPlaceholder(formData.video_conference_platform, t);
  const videoConferencePlatformOptions = getVideoConferencePlatformOptions(t);
  const requiresCustomPlatformName = isCustomVideoConferencePlatform(formData.video_conference_platform);
  const showMeetingCredentials = supportsMeetingCredentials(formData.video_conference_platform);

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

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>{t("seminar_cover", "Portada del seminario")}</Label>
                      <p className="text-xs text-slate-500">
                        {t(
                          "seminar_cover_help",
                          "Elige si la portada principal será una imagen o un video de YouTube."
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {coverTypeOptions.map((option) => {
                        const selected = formData.cover_type === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleCoverTypeChange(option.value)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {option.value === "youtube" ? (
                              <PlayCircle className="h-4 w-4" />
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                            {t(option.labelKey, option.fallback)}
                          </button>
                        );
                      })}
                    </div>

                    {formData.cover_type === "youtube" ? (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="space-y-2">
                          <Label htmlFor="cover-video-url">
                            {t("seminar_cover_youtube_url", "Enlace del video de YouTube")}
                          </Label>
                          <Input
                            id="cover-video-url"
                            value={formData.cover_video_url}
                            onChange={(e) => handleCoverVideoUrlChange(e.target.value)}
                            placeholder={t(
                              "seminar_cover_youtube_placeholder",
                              "https://www.youtube.com/watch?v=..."
                            )}
                            className="h-12"
                          />
                        </div>

                        <p className="text-xs text-slate-500">
                          {t(
                            "seminar_cover_video_help",
                            "Usa un enlace de YouTube para mostrar una miniatura interactiva en el seminario."
                          )}
                        </p>

                        {formData.cover_video_url && !coverVideoId ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            {t("youtube_url_invalid", "Ingresa un enlace válido de YouTube.")}
                          </div>
                        ) : null}

                        {coverVideoId ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="relative aspect-video overflow-hidden bg-slate-100">
                              <img
                                src={coverPreviewImage}
                                alt={t("seminar_cover_preview", "Vista previa de la portada")}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                  <PlayCircle className="h-8 w-8 text-slate-900" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {t("seminar_cover_preview", "Vista previa de la portada")}
                                </p>
                                <p className="text-xs text-slate-500">YouTube</p>
                              </div>
                              <a
                                href={buildYouTubeWatchUrl(coverVideoId)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                              >
                                <LinkIcon className="h-4 w-4" />
                                {t("watch_video", "Ver video")}
                              </a>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-300 transition-colors bg-white">
                          {formData.image_url ? (
                            <div className="space-y-4">
                              <img
                                src={coverPreviewImage}
                                alt={t("seminar_cover_preview", "Vista previa de la portada")}
                                className="mx-auto h-40 rounded-xl object-cover"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleChange("image_url", "")}
                                className="inline-flex items-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                {t("seminar_cover_remove", "Quitar imagen")}
                              </Button>
                            </div>
                          ) : (
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                              {uploading ? (
                                <Loader2 className="h-8 w-8 mx-auto text-slate-400 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                                  <p className="text-sm text-slate-500">
                                    {t("seminar_image_upload", "Haz clic para subir una imagen")}
                                  </p>
                                </>
                              )}
                            </label>
                          )}
                        </div>

                        <p className="text-xs text-slate-500">
                          {t(
                            "seminar_cover_image_help",
                            `Formatos permitidos: JPG/PNG/WebP. Máximo ${MAX_IMAGE_MB}MB.`
                          )}
                        </p>
                      </div>
                    )}
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
                              ? format(formData.start_date, "PPP", { locale: dateLocale })
                              : t("select_date", "Seleccionar fecha")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white shadow-xl border z-[99999]">
                          <Calendar
                            mode="single"
                            selected={formData.start_date}
                            onSelect={(date) => handleChange("start_date", date)}
                            locale={dateLocale}
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
                              ? format(formData.end_date, "PPP", { locale: dateLocale })
                              : t("select_date", "Seleccionar fecha")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white shadow-xl border z-[99999]">
                          <Calendar
                            mode="single"
                            selected={formData.end_date}
                            onSelect={(date) => handleChange("end_date", date)}
                            locale={dateLocale}
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

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="block min-h-[40px] leading-tight">
                        {t("target_goal_slots_label", "Cupos (objetivo)")} *
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
                        {t(
                          "target_goal_slots_help",
                          "Este número define el cupo objetivo a partir del cual el precio llega a su mínimo."
                        )}
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

                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-medium">
                      {t("payment_window_preview_title", "Ventana de pago configurada por administración")}
                    </p>
                    <p className="mt-1 text-sky-900">
                      {formData.start_date
                        ? t(
                            "payment_window_preview_help",
                            "Estas fechas se calculan automáticamente con la fecha de inicio y los días definidos en BackOffice."
                          )
                        : t(
                            "payment_window_preview_missing_start",
                            "Selecciona la fecha de inicio para ver cuándo abrirán y cerrarán los pagos."
                          )}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-white/70 px-3 py-2">
                        <span className="text-xs uppercase tracking-[0.16em] text-sky-700">
                          {t("payment_open_date_label", "Fecha inicio pago")}
                        </span>
                        <p className="mt-1 font-semibold">
                          {paymentWindowPreview.paymentOpenDate
                            ? format(paymentWindowPreview.paymentOpenDate, "PPP", { locale: dateLocale })
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/70 px-3 py-2">
                        <span className="text-xs uppercase tracking-[0.16em] text-sky-700">
                          {t("payment_close_date_label", "Fecha cierre pago")}
                        </span>
                        <p className="mt-1 font-semibold">
                          {paymentWindowPreview.paymentCloseDate
                            ? format(paymentWindowPreview.paymentCloseDate, "PPP", { locale: dateLocale })
                            : "—"}
                        </p>
                      </div>
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
                        onValueChange={handleVideoConferencePlatformChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[99999] shadow-lg border">
                          {videoConferencePlatformOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.icon} {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {requiresCustomPlatformName ? (
                      <div className="space-y-2">
                        <Label>{t("video_platform_custom_name", "Nombre de la plataforma")}</Label>
                        <Input
                          value={formData.video_conference_platform_custom_name}
                          onChange={(e) =>
                            handleChange("video_conference_platform_custom_name", e.target.value)
                          }
                          placeholder={t(
                            "video_platform_custom_name_placeholder",
                            "Ej: Jitsi, Discord, Signal"
                          )}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label>{t("meetingLink", "Enlace de reuni?n")}</Label>
                      <Input
                        value={formData.video_conference_link}
                        onChange={(e) => handleChange("video_conference_link", e.target.value)}
                        placeholder={meetingPlaceholder}
                      />
                    </div>

                    {showMeetingCredentials ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("meetingId_optional", "ID de reuni?n (opcional)")}</Label>
                          <Input
                            value={formData.video_conference_id}
                            onChange={(e) => handleChange("video_conference_id", e.target.value)}
                            placeholder="123 456 789"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("password_optional", "Contrase?a (opcional)")}</Label>
                          <Input
                            value={formData.video_conference_password}
                            onChange={(e) => handleChange("video_conference_password", e.target.value)}
                            placeholder="******"
                          />
                        </div>
                      </div>
                    ) : null}
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
                  <p className="text-sm text-slate-500">
                    {t(
                      "materials_help",
                      "Agrega archivos descargables, videos de YouTube o enlaces externos para tus estudiantes."
                    )}
                  </p>

                  {normalizedMaterials.length ? (
                    <div className="space-y-3">
                      {normalizedMaterials.map((material, index) => {
                        const icon =
                          material.type === "youtube" ? (
                            <PlayCircle className="h-5 w-5 text-red-500" />
                          ) : material.type === "link" ? (
                            <Globe className="h-5 w-5 text-blue-500" />
                          ) : (
                            <FileText className="h-5 w-5 text-slate-600" />
                          );

                        return (
                          <div
                            key={material.id || index}
                            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                              {icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-slate-900">{material.title}</p>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                                  {t(
                                    `material_type_${material.type}`,
                                    material.type === "youtube"
                                      ? "YouTube"
                                      : material.type === "link"
                                        ? "Enlace"
                                        : "Archivo"
                                  )}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-sm text-slate-500">
                                {material.url || material.path || material.mimeType || material.type}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" type="button" onClick={() => removeMaterial(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      {t("material_empty", "Aún no has agregado materiales.")}
                    </div>
                  )}

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-3">
                      <Label>{t("material_preview", "Tipo de material")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {materialTypeOptions.map((option) => {
                          const selected = materialDraft.type === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setMaterialDraft({ type: option.value, title: "", url: "" })}
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                                selected
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {option.value === "youtube" ? (
                                <PlayCircle className="h-4 w-4" />
                              ) : option.value === "link" ? (
                                <LinkIcon className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              {t(option.labelKey, option.fallback)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor="material-title">
                          {t("material_title_optional", "Título del material (opcional)")}
                        </Label>
                        <Input
                          id="material-title"
                          value={materialDraft.title}
                          onChange={(e) => handleMaterialDraftChange("title", e.target.value)}
                          placeholder={t("material_title", "Ej: Guía del seminario")}
                          className="h-12"
                        />
                      </div>

                      {materialDraft.type === "file" ? (
                        <div className="space-y-2">
                          <Label>{t("material_type_file", "Archivo")}</Label>
                          <label className="flex h-12 items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 cursor-pointer hover:border-slate-300 transition-colors">
                            <input type="file" accept=".pdf,.zip" onChange={handleMaterialUpload} className="hidden" />
                            {uploading ? (
                              <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                            ) : (
                              <Upload className="h-5 w-5 text-slate-400" />
                            )}
                            <span className="text-sm text-slate-600">
                              {t("add_material", "Agregar material descargable")}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="material-url">
                            {materialDraft.type === "youtube"
                              ? t("seminar_cover_youtube_url", "Enlace del video de YouTube")
                              : t("material_url", "Enlace del material")}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="material-url"
                              value={materialDraft.url}
                              onChange={(e) => handleMaterialDraftChange("url", e.target.value)}
                              placeholder={
                                materialDraft.type === "youtube"
                                  ? t("seminar_cover_youtube_placeholder", "https://www.youtube.com/watch?v=...")
                                  : "https://"
                              }
                              className="h-12"
                            />
                            <Button type="button" onClick={addExternalMaterial} className="h-12 shrink-0">
                              <Plus className="mr-2 h-4 w-4" />
                              {t("material_add", "Agregar")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      {materialDraft.type === "file"
                        ? t("material_file_help", `Formatos permitidos: PDF o ZIP. Máximo ${MAX_MATERIAL_MB}MB.`)
                        : materialDraft.type === "youtube"
                          ? t("material_youtube_help", "Comparte un enlace de YouTube para usarlo como material.")
                          : t("material_link_help", "Comparte un enlace externo útil para el seminario.")}
                    </p>
                  </div>
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
                      {t("surplusExplanation", "💡 Si el total recaudado supera tu objetivo, {percent}% del excedente neto es para ti como bonus. El resto solo se asigna a invitadores validos de los estudiantes excedentes; si no aplica un referido valido, vuelve a profesor y plataforma.")
                          .replace("{percent}", formData.professor_bonus_percent ?? 0)}
                    </p>
                  </div>

                  <p className="text-xs text-white/50">
                    {t("students_pay_less", "Los estudiantes pagan menos cuantos más confirmen.")}{" "}
                    {t("goal_slots_short", "Cupos objetivo")}: {formData.target_students || "-"} ·{" "}
                    {t("total_capacity", "Capacidad total")}: {formData.max_students || "-"}
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
                  {t("publish_requirements", "Completa todos los campos obligatorios (*) para publicar (incluye fecha fin y objetivo).")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
