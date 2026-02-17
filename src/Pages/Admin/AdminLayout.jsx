import { Navigate, Route, Routes } from "react-router-dom";
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
import AdminWithdrawals from "./AdminWithdrawals";
import AdminVerifications from "./AdminVerifications";
import PlatformSettings from "./PlatformSettings";
import AdminTranslations from "./AdminTranslations";

export default function AdminLayout() {
  const { authLoading, profileLoading, user, profile, refresh, isAdmin, roleReady } = useAuth();
  const { t } = useLanguage();
  const [attemptedProfileRefresh, setAttemptedProfileRefresh] = useState(false);

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
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="seminars" element={<AdminSeminars />} />
          <Route path="enrollments" element={<AdminEnrollments />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="settings" element={<PlatformSettings />} />
          <Route path="translations" element={<AdminTranslations />} />
        </Routes>
      </main>
    </div>
  );
}
