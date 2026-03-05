import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Bell,
  Shield,
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
  const queryClient = useQueryClient();
  const platformSettingsCacheKey = "platform_settings_public";
  const cachedPlatformSettings = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(platformSettingsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      console.warn("platform settings cache parse error", err?.message || err);
      return null;
    }
  }, []);

  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("app_name, app_logo_url, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (data && typeof window !== "undefined") {
        try {
          localStorage.setItem(platformSettingsCacheKey, JSON.stringify(data));
        } catch {
          // ignore cache write failures
        }
      }
      return data ?? null;
    },
    staleTime: 1000 * 60 * 5,
    initialData: cachedPlatformSettings ?? undefined,
    initialDataUpdatedAt: cachedPlatformSettings?.updated_at
      ? new Date(cachedPlatformSettings.updated_at).getTime()
      : 0,
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
  const isAdmin = (profile?.role || "").toLowerCase() === "admin";

  // ✅ evita que el avatar “desaparezca”: siempre mostramos placeholder mientras carga
  const avatarLetter = useMemo(() => {
    const letter = displayName?.[0]?.toUpperCase();
    return letter || "U";
  }, [displayName]);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,type,link,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 20,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 15,
  });

  const markNotificationRead = async (notificationId, link) => {
    if (!notificationId) return;
    try {
      await supabase.rpc("mark_notification_read", { p_id: notificationId });
    } catch (err) {
      console.warn("mark notification read error", err?.message || err);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    }
    if (link) {
      navigate(link);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await supabase.rpc("mark_all_notifications_read");
    } catch (err) {
      console.warn("mark all notifications read error", err?.message || err);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
    }
  };

  const formatNotificationDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
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
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`relative ${isHomePage ? "text-white/80" : "text-slate-500"}`}
                      aria-label={tr("notifications", "Notificaciones")}
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 ? (
                        <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-rose-500 text-[10px] text-white flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 bg-white shadow-xl">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <span className="text-sm font-semibold text-slate-900">
                        {tr("notifications", "Notificaciones")}
                      </span>
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        {tr("mark_all_read", "Marcar todo leído")}
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-slate-500">
                        {tr("notifications_empty", "Sin notificaciones")}
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-auto">
                        {notifications.map((notif) => (
                          <DropdownMenuItem
                            key={notif.id}
                            onSelect={(event) => {
                              event.preventDefault();
                              markNotificationRead(notif.id, notif.link);
                            }}
                            className="flex flex-col items-start gap-1 py-2"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  notif.read_at ? "bg-slate-300" : "bg-emerald-500"
                                }`}
                              />
                              <span className="text-sm font-medium text-slate-900">{notif.title}</span>
                              <span className="ml-auto text-[11px] text-slate-400">
                                {formatNotificationDate(notif.created_at)}
                              </span>
                            </div>
                            {notif.body ? (
                              <span className="text-xs text-slate-500 line-clamp-2">{notif.body}</span>
                            ) : null}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

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

                    {isAdmin ? (
                      <Link to="/admin" target="_blank" rel="noreferrer">
                        <DropdownMenuItem>
                          <Shield className="mr-2 h-4 w-4" />
                          {tr("admin_panel", "Admin")}
                        </DropdownMenuItem>
                      </Link>
                    ) : null}

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
