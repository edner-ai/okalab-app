import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../Components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../Components/ui/dropdown-menu";

import { Loader2, Mail, Lock, ArrowRight, Sparkles, Languages } from "lucide-react";
import { toast } from "sonner";

function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, refresh } = useAuth();
  const { t, language, changeLanguage } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const preferredLanguage = language || "es";
  const searchParams = new URLSearchParams(location.search);
  const nextParam = searchParams.get("next");
  const intentParam = searchParams.get("intent");
  const appBasePath = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "") || "/";
  const absoluteBase = `${window.location.origin}${appBasePath === "/" ? "" : appBasePath}`;

  const buildRedirectUrl = (path) => {
    const safePath = path && path.startsWith("/") ? path : "/";
    return `${absoluteBase}${safePath}`;
  };

  const getSafeNext = (rawNext) => {
    if (!rawNext) return null;
    if (!rawNext.startsWith("/")) return null;
    if (rawNext.startsWith("//")) return null;
    return rawNext;
  };

  const resolveNext = () => {
    const safeNext = getSafeNext(nextParam);
    if (intentParam === "become-professor") {
      if (safeNext && safeNext.startsWith("/profile")) {
        return safeNext.includes("?") ? `${safeNext}&intent=become-professor` : `${safeNext}?intent=become-professor`;
      }
      return "/profile?intent=become-professor";
    }
    return safeNext;
  };

  useEffect(() => {
    if (!user) return;
    if ((role || "").toLowerCase() === "admin") {
      navigate("/admin", { replace: true });
      return;
    }
    const nextUrl = resolveNext();
    navigate(nextUrl || "/profile", { replace: true });
  }, [user, role, navigate, nextParam, intentParam]);

  const upsertProfile = async (userId, userEmail) => {
    // Evita degradar roles existentes (admin/profesor).
    const lookup = supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const { data: existing, error: lookupError } = await withTimeout(
      lookup,
      6000,
      "profile lookup timeout"
    );

    const now = new Date().toISOString();

    if (existing) {
      const updatePayload = {
        preferred_language: preferredLanguage,
        updated_at: now,
      };
      if (userEmail) updatePayload.email = userEmail;

      const res = await withTimeout(
        supabase.from("profiles").update(updatePayload).eq("id", userId),
        6000,
        "updateProfile timeout"
      );
      if (res?.error) throw res.error;
      return;
    }

    if (!lookupError) {
      const insertPayload = {
        id: userId,
        role: "student",
        verification_status: "none",
        is_verified: false,
        preferred_language: preferredLanguage,
        updated_at: now,
      };
      if (userEmail) insertPayload.email = userEmail;

      const res = await withTimeout(
        supabase.from("profiles").insert([insertPayload]),
        6000,
        "insertProfile timeout"
      );
      if (res?.error) throw res.error;
      return;
    }

    // Fallback seguro: no sobrescribe rol/estado si el lookup falla
    const safePayload = {
      id: userId,
      preferred_language: preferredLanguage,
      updated_at: now,
    };
    if (userEmail) safePayload.email = userEmail;

    const res = await withTimeout(
      supabase.from("profiles").upsert(safePayload),
      6000,
      "upsertProfile fallback timeout"
    );
    if (res?.error) throw res.error;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const nextUrl = resolveNext() || "/profile";
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: "" },
            emailRedirectTo: buildRedirectUrl(nextUrl),
          },
        });
        if (error) throw error;

        if (data?.user?.id) {
          try {
            await upsertProfile(data.user.id, data.user.email);
          } catch {
            // no bloquea registro
          }
        }

        toast.success(t("auth_signup_success", "Registro exitoso. Revisa tu email si pide confirmación."));

        // si NO hay confirmación requerida, habrá sesión. Si la hay, igual dejamos al usuario en login.
        await refresh();
        navigate(nextUrl || "/profile");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data?.user?.id) {
          try {
            await upsertProfile(data.user.id, data.user.email);
          } catch {
            // no bloquea login
          }
        }

        // ✅ clave: resincroniza el AuthProvider (evita “fantasmas”)
        await refresh();
        const nextUrl = resolveNext();
        navigate(nextUrl || "/profile");
      }
    } catch (err) {
      toast.error(err?.message || t("auth_error", "Error de autenticación"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setOauthLoading(true);
    try {
      const nextUrl = resolveNext() || "/profile";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildRedirectUrl(nextUrl),
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err?.message || t("auth_error", "Error de autenticación"));
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-blue-600/30 blur-3xl rounded-full" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-purple-600/30 blur-3xl rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:flex flex-col px-16 py-12 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-blue-600/30 blur-3xl rounded-full" />
            <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-purple-600/30 blur-3xl rounded-full" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
          </div>
          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-2 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-xl">
                <span className="text-white font-black text-xl">O</span>
              </div>
              <span className="text-xl font-bold">Okalab</span>
            </Link>
          </div>

          <div className="flex-1 flex items-center">
            <div className="max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("login_chip", "Plataforma de seminarios colaborativos")}
              </div>
              <h1 className="mt-6 text-5xl font-bold leading-tight text-white">
                {t("login_hero_learn", "Aprende,")}{" "}
                <span className="text-blue-300">{t("login_hero_collaborate", "Colabora")}</span>{" "}
                {t("login_hero_and", "y")}{" "}
                <span className="text-purple-300">{t("login_hero_earn", "Gana")}</span>
              </h1>
              <p className="mt-4 text-white/70 max-w-lg">
                {t(
                  "login_hero_subtitle",
                  "Okalab conecta profesores y estudiantes en experiencias prácticas donde todos ganan."
                )}
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-white/80 text-xs">
                  {t("login_stat_students", "500+ estudiantes")}
                </div>
                <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-white/80 text-xs">
                  {t("login_stat_seminars", "50+ seminarios")}
                </div>
                <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2 rounded-xl text-white/80 text-xs">
                  {t("login_stat_satisfaction", "95% satisfacción")}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/40 relative z-10">
            {t("login_social_soon", "Próximamente: Google y Facebook.")}
          </p>
        </section>

        <section className="relative flex items-center justify-center px-8 py-12 lg:px-12 bg-slate-50">
          <div className="absolute top-10 right-12">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-full p-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  <Languages className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border border-slate-200 rounded-xl shadow-xl">
                <DropdownMenuItem onClick={() => changeLanguage("es")}>ES - Español</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("en")}>EN - English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("fr")}>FR - Français</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("ht")}>HT - Kreyòl</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="w-full max-w-md">
            <Card className="border border-slate-200 bg-white shadow-2xl text-slate-900">
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {isSignUp ? t("auth_create_account", "Crear una cuenta") : t("auth_welcome_back", "Bienvenido de nuevo")}
                </CardTitle>
                <CardDescription className="text-slate-500">
                  {isSignUp
                    ? t("auth_signup_subtitle", "Regístrate para empezar a aprender y colaborar.")
                    : t("auth_login_subtitle", "Inicia sesión para acceder a tu cuenta.")}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 bg-slate-100 border border-slate-200 rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className={`h-10 rounded-xl text-sm font-bold transition ${
                      !isSignUp ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t("auth_login", "Iniciar sesión")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className={`h-10 rounded-xl text-sm font-bold transition ${
                      isSignUp ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t("auth_signup", "Registrarse")}
                  </button>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-100 disabled:cursor-not-allowed"
                    disabled={loading || oauthLoading}
                    onClick={handleGoogleAuth}
                  >
                    {oauthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t("auth_continue_google", "Continuar con Google")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-100 disabled:cursor-not-allowed"
                    disabled
                  >
                    {t("auth_continue_facebook", "Continuar con Facebook")}
                  </Button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex-1 h-px bg-slate-200" />
                  {t("auth_or_email", "o con email")}
                  <span className="flex-1 h-px bg-slate-200" />
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700">{t("auth_email", "Email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        type="email"
                        className="pl-10 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">{t("auth_password", "Contraseña")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        type="password"
                        className="pl-10 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : isSignUp ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    {isSignUp ? t("auth_create_account_btn", "Crear cuenta") : t("auth_login_btn", "Entrar")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-xs text-slate-500 text-center">
              {t("auth_legal_prefix", "Al continuar aceptas nuestros")}{" "}
              <Link to="/terms" className="underline hover:text-slate-900">
                {t("auth_terms", "Términos de servicio")}
              </Link>{" "}
              {t("auth_legal_and", "y")}{" "}
              <Link to="/privacy" className="underline hover:text-slate-900">
                {t("auth_privacy", "Política de privacidad")}
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
