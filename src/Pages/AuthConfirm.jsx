import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { useLanguage } from "../Components/shared/LanguageContext";
import { getAppBasePath } from "../utils/appUrl";

const COPY = {
  es: {
    loadingTitle: "Verificando acceso",
    loadingBody: "Estamos validando tu enlace seguro.",
    successTitle: "Acceso confirmado",
    successBody: "Tu acceso fue validado correctamente. Serás redirigido en un momento.",
    recoveryTitle: "Acceso confirmado",
    recoveryBody: "Ahora puedes crear una nueva contraseña.",
    errorTitle: "No se pudo validar el enlace",
    errorBody: "Este enlace es inválido, expiró o ya fue utilizado.",
    backLogin: "Volver a login",
    continue: "Continuar",
  },
  en: {
    loadingTitle: "Verifying access",
    loadingBody: "We are validating your secure link.",
    successTitle: "Access confirmed",
    successBody: "Your access was validated successfully. You will be redirected shortly.",
    recoveryTitle: "Access confirmed",
    recoveryBody: "You can now create a new password.",
    errorTitle: "The link could not be validated",
    errorBody: "This link is invalid, expired, or has already been used.",
    backLogin: "Back to login",
    continue: "Continue",
  },
  fr: {
    loadingTitle: "Verification en cours",
    loadingBody: "Nous validons votre lien securise.",
    successTitle: "Acces confirme",
    successBody: "Votre acces a ete valide avec succes. Vous allez etre redirige dans un instant.",
    recoveryTitle: "Acces confirme",
    recoveryBody: "Vous pouvez maintenant creer un nouveau mot de passe.",
    errorTitle: "Le lien n'a pas pu etre valide",
    errorBody: "Ce lien est invalide, expire ou deja utilise.",
    backLogin: "Retour au login",
    continue: "Continuer",
  },
  ht: {
    loadingTitle: "Ap verifye aks la",
    loadingBody: "Nou ap valide lyen sekirize ou a.",
    successTitle: "Aks konfime",
    successBody: "Aks ou valide byen. Nou pral redirije ou touswit.",
    recoveryTitle: "Aks konfime",
    recoveryBody: "Kounye a ou ka kreye yon nouvo modpas.",
    errorTitle: "Nou pa t ka valide lyen an",
    errorBody: "Lyen sa a pa valab, li ekspire oswa li deja itilize.",
    backLogin: "Retounen nan login",
    continue: "Kontinye",
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

export default function AuthConfirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const copy = resolveCopy(language);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const redirectTo = getSafeRedirectPath(searchParams.get("redirect_to"));

      if (!tokenHash || !type) {
        setStatus("error");
        setErrorMessage(copy.errorBody);
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (cancelled) return;

      if (error) {
        setStatus("error");
        setErrorMessage(error.message || copy.errorBody);
        return;
      }

      if (type === "recovery") {
        setStatus("recovery");
        setTimeout(() => {
          navigate(`/reset-password?redirect_to=${encodeURIComponent(redirectTo)}`, { replace: true });
        }, 800);
        return;
      }

      setStatus("success");
      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 800);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [copy.errorBody, navigate, searchParams]);

  const content =
    status === "loading"
      ? { title: copy.loadingTitle, body: copy.loadingBody, icon: <Loader2 className="h-10 w-10 animate-spin text-blue-600" /> }
      : status === "success"
        ? { title: copy.successTitle, body: copy.successBody, icon: <CheckCircle2 className="h-10 w-10 text-emerald-600" /> }
        : status === "recovery"
          ? { title: copy.recoveryTitle, body: copy.recoveryBody, icon: <CheckCircle2 className="h-10 w-10 text-emerald-600" /> }
          : { title: copy.errorTitle, body: errorMessage || copy.errorBody, icon: <AlertCircle className="h-10 w-10 text-rose-600" /> };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <Card className="w-full max-w-lg border border-slate-200 bg-white shadow-xl">
        <CardHeader className="text-center items-center gap-4">
          {content.icon}
          <CardTitle className="text-2xl">{content.title}</CardTitle>
          <CardDescription className="text-base text-slate-500">{content.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          {status === "error" ? (
            <Button asChild variant="outline">
              <Link to="/login">{copy.backLogin}</Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                const redirectTo = getSafeRedirectPath(searchParams.get("redirect_to"));
                navigate(status === "recovery" ? `/reset-password?redirect_to=${encodeURIComponent(redirectTo)}` : redirectTo, {
                  replace: true,
                });
              }}
            >
              {copy.continue}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
