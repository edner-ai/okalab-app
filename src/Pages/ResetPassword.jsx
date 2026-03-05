import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { toast } from "sonner";
import { useLanguage } from "../Components/shared/LanguageContext";
import { getAppBasePath } from "../utils/appUrl";

const COPY = {
  es: {
    title: "Crea una nueva contraseña",
    subtitle: "Elige una contraseña segura para volver a entrar a tu cuenta.",
    password: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    submit: "Guardar contraseña",
    success: "Tu contraseña fue actualizada correctamente.",
    mismatch: "Las contraseñas no coinciden.",
    missingSession: "Tu sesión de recuperación no está activa o el enlace ya expiró.",
    backLogin: "Volver a login",
  },
  en: {
    title: "Create a new password",
    subtitle: "Choose a secure password to access your account again.",
    password: "New password",
    confirmPassword: "Confirm password",
    submit: "Save password",
    success: "Your password was updated successfully.",
    mismatch: "Passwords do not match.",
    missingSession: "Your recovery session is not active or the link has expired.",
    backLogin: "Back to login",
  },
  fr: {
    title: "Creez un nouveau mot de passe",
    subtitle: "Choisissez un mot de passe securise pour acceder de nouveau à votre compte.",
    password: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submit: "Enregistrer le mot de passe",
    success: "Votre mot de passe a été mis à jour avec succes.",
    mismatch: "Les mots de passe ne correspondent pas.",
    missingSession: "Votre session de recuperation n'est pas active ou le lien a expire.",
    backLogin: "Retour au login",
  },
  ht: {
    title: "Kreye yon nouvo modpas",
    subtitle: "Chwazi yon modpas sekirize pou antre nan kont ou anko.",
    password: "Nouvo modpas",
    confirmPassword: "Konfime modpas",
    submit: "Sove modpas la",
    success: "Modpas ou a mete ajou byen.",
    mismatch: "Modpas yo pa menm.",
    missingSession: "Sesyon rekiperasyon ou pa aktif oswa lyen an ekspire.",
    backLogin: "Retounen nan login",
  },
};

const resolveCopy = (language) => COPY[language] || COPY.es;

const getSafeRedirectPath = (rawValue, fallback = "/profile") => {
  const basePath = getAppBasePath();
  const stripBasePath = (value) => {
    if (!value || basePath === "/") return value;
    if (value === basePath) return "/";
    if (value.startsWith(`${basePath}/`)) {
      return value.slice(basePath.length) || "/";
    }
    return value;
  };

  if (!rawValue) return fallback;
  if (rawValue.startsWith("/") && !rawValue.startsWith("//")) {
    return stripBasePath(rawValue);
  }

  try {
    const parsed = new URL(rawValue);
    if (parsed.origin !== window.location.origin) return fallback;
    return stripBasePath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return fallback;
  }
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const copy = resolveCopy(language);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return getSafeRedirectPath(params.get("redirect_to"));
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(copy.mismatch);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(copy.missingSession);
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success(copy.success);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.missingSession);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <Card className="w-full max-w-lg border border-slate-200 bg-white shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{copy.title}</CardTitle>
          <CardDescription className="text-base text-slate-500">{copy.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{copy.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  className="pl-10 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{copy.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  className="pl-10 pr-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {copy.submit}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button asChild variant="ghost">
              <Link to="/login">{copy.backLogin}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
