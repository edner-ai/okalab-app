import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { Button } from "./Components/ui/button";
import {
  Home,
  BookOpen,
  Wallet,
  User,
  LogOut,
  Languages,
  GraduationCap,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./Components/ui/dropdown-menu";

import { useAuth } from "./context/AuthContext.jsx";
import { supabase } from "./lib/supabase";
import { useLanguage } from "./Components/shared/LanguageContext";

export default function Layout({ children }) {
  const { user, profile, authLoading, profileLoading, canCreateSeminar, signOut } = useAuth();
  const { changeLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("app_name, app_logo_url, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const appName = platformSettings?.app_name || "Okalab";
  const appLogoUrl = platformSettings?.app_logo_url || null;
  const appLogoVersion = platformSettings?.updated_at ? new Date(platformSettings.updated_at).getTime() : "";
  const appLogoSrc = appLogoUrl && appLogoVersion ? `${appLogoUrl}?v=${appLogoVersion}` : appLogoUrl;

  const tr = (key, fallback) => t(key, fallback);

  const isHomePage = location.pathname === "/";
  const displayName = profile?.full_name || user?.email?.split("@")[0] || tr("user_label", "Usuario");
  const avatarUrl = profile?.avatar_url || null;
  const avatarVersion = profile?.updated_at ? new Date(profile.updated_at).getTime() : "";
  const avatarSrc = avatarUrl && avatarVersion ? `${avatarUrl}?v=${avatarVersion}` : avatarUrl;

  // ✅ Mantiene tu lógica visual: botón Crear solo si profesor/admin
  const isProfessor = canCreateSeminar;

  // ✅ evita que el avatar “desaparezca”: siempre mostramos placeholder mientras carga
  const avatarLetter = useMemo(() => {
    const letter = displayName?.[0]?.toUpperCase();
    return letter || "U";
  }, [displayName]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER DYNAMIQUE BASE44 */}
      <nav
        className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${isHomePage ? "px-4 py-3 md:px-6 md:py-4 bg-transparent" : "bg-white border-b border-slate-200 shadow-sm"}
      `}
      >
        <div className="max-w-7xl mx-auto">
          <div
            className={`
            flex items-center justify-between transition-all
            ${isHomePage
              ? "bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 md:px-6 md:py-3 border border-white/20"
              : "h-14 md:h-16 px-4 md:px-6"}
          `}
          >
            {/* Logo Section */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {appLogoSrc ? (
                  <img src={appLogoSrc} alt={appName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">O</span>
                )}
              </div>
              <span className={`font-bold text-xl ${isHomePage ? "text-white" : "text-slate-900"}`}>
                {appName}
              </span>
            </Link>

            {/* Actions Section */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={isHomePage ? "text-white/80" : "text-slate-500"}>
                    <Languages className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <DropdownMenuItem onClick={() => changeLanguage("es")}>🇪🇸 {tr("language_es", "Español")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage("en")}>🇬🇧 {tr("language_en", "English")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage("fr")}>🇫🇷 {tr("language_fr", "Français")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage("ht")}>🇭🇹 {tr("language_ht", "Kreyòl")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ✅ Mientras carga: mostramos avatar placeholder (no desaparece el menú) */}
              {authLoading && !user ? (
                <Button variant="ghost" size="icon" className="rounded-full" disabled>
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-200 animate-pulse" />
                </Button>
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      {avatarUrl ? (
                        <img
                          src={avatarSrc}
                          alt={displayName}
                          className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm">
                          {avatarLetter}
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white shadow-xl">
                    <div className="px-3 py-2 border-b">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    <Link to="/my-seminars">
                      <DropdownMenuItem>
                        <GraduationCap className="mr-2 h-4 w-4" />
                        {tr("mySeminars")}
                      </DropdownMenuItem>
                    </Link>

                    <Link to="/wallet">
                      <DropdownMenuItem>
                        <Wallet className="mr-2 h-4 w-4" />
                        {tr("wallet")}
                      </DropdownMenuItem>
                    </Link>

                    <Link to="/profile">
                      <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        {tr("profile")}
                      </DropdownMenuItem>
                    </Link>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      {tr("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login" aria-label={tr("login", "Iniciar sesión")}>
                  <Button
                    size="icon"
                    className={`rounded-full w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-md hover:opacity-90 ${
                      isHomePage ? "ring-1 ring-white/30" : "ring-1 ring-slate-200/60"
                    }`}
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ZONE DE CONTENU AVEC COMPENSATION DE HAUTEUR */}

      {/* ReviewPrompt desactivado temporalmente por bloqueo de clicks */}
      <main className={`flex-1 pb-24 md:pb-0 ${isHomePage ? "" : "pt-14 md:pt-16"}`}>
        {children ?? <Outlet />}
      </main>

      {/* BOTTOM NAV MOBILE STYLE BASE44 */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur border-t h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] shadow-lg px-2 grid ${
          isProfessor ? "grid-cols-5" : "grid-cols-4"
        } place-items-center`}
      >
        <Link to="/" className="flex flex-col items-center justify-center text-slate-400">
          <Home className="h-5 w-5" />
          <span className="text-[10px]">{tr("home")}</span>
        </Link>

        <Link to="/seminars" className="flex flex-col items-center justify-center text-slate-400">
          <BookOpen className="h-5 w-5" />
          <span className="text-[10px]">{tr("seminars")}</span>
        </Link>

        {/* Bouton Créer flottant si Professeur */}
        {isProfessor && (
          <Link to="/createseminar" className="relative flex flex-col items-center justify-center">
            <div className="absolute -top-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg border-4 border-white">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <span className="text-[10px] mt-6 text-slate-400">{tr("create_short", "Crear")}</span>
          </Link>
        )}

        <Link to="/wallet" className="flex flex-col items-center justify-center text-slate-400">
          <Wallet className="h-5 w-5" />
          <span className="text-[10px]">{tr("wallet")}</span>
        </Link>

        <Link to="/profile" className="flex flex-col items-center justify-center text-slate-400">
          <User className="h-5 w-5" />
          <span className="text-[10px]">{tr("profile")}</span>
        </Link>
      </nav>
    </div>
  );
}
