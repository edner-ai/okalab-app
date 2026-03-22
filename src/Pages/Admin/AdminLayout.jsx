import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../Components/shared/LanguageContext";

import AdminSidebar from "./AdminSidebar";
import AdminOverview from "./AdminOverview";
import AdminUsers from "./AdminUsers";
import AdminSeminars from "./AdminSeminars";
import AdminEnrollments from "./AdminEnrollments";
import AdminWallets from "./AdminWallets";
import AdminTransactions from "./AdminTransactions";
import AdminEarnings from "./AdminEarnings";
import AdminWithdrawals from "./AdminWithdrawals";
import AdminVerifications from "./AdminVerifications";
import PlatformSettings from "./PlatformSettings";
import AdminTranslations from "./AdminTranslations";

export default function AdminLayout() {
  const { authLoading, profileLoading, user, profile, refresh, isAdmin, roleReady, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [attemptedProfileRefresh, setAttemptedProfileRefresh] = useState(false);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let alive = true;
    if (user && !profile && !profileLoading && !attemptedProfileRefresh) {
      (async () => {
        await refresh();
        if (alive) setAttemptedProfileRefresh(true);
      })();
    }
    return () => {
      alive = false;
    };
  }, [user, profile, profileLoading, attemptedProfileRefresh, refresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("admin_loading_session", "Cargando sesión...")}
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profileLoading && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("admin_loading_profile", "Cargando perfil...")}
      </div>
    );
  }

  if (!profile && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("admin_loading_profile", "Cargando perfil...")}
      </div>
    );
  }

  if (!isAdmin && roleReady) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 w-full bg-white border-b px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-sm font-semibold text-slate-900">
          {t("home", "Inicio")}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm font-semibold text-rose-600"
        >
          {t("logout", "Cerrar sesión")}
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-57px)] flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="seminars" element={<AdminSeminars />} />
            <Route path="enrollments" element={<AdminEnrollments />} />
            <Route path="wallets" element={<AdminWallets />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="earnings" element={<AdminEarnings />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="settings" element={<Navigate to="/admin/settings/app" replace />} />
            <Route path="settings/app" element={<PlatformSettings section="app" />} />
            <Route path="settings/fees" element={<PlatformSettings section="fees" />} />
            <Route path="settings/payments" element={<PlatformSettings section="payments" />} />
            <Route path="settings/support" element={<PlatformSettings section="support" />} />
            <Route path="settings/seminars" element={<PlatformSettings section="seminars" />} />
            <Route path="translations" element={<AdminTranslations />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
