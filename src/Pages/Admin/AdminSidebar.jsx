import { NavLink } from "react-router-dom";
import { useLanguage } from "../../Components/shared/LanguageContext";

const Item = ({ to, children }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      `block px-3 py-2 rounded-lg text-sm ${
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100"
      }`
    }
  >
    {children}
  </NavLink>
);

const Section = ({ title, children }) => (
  <div>
    <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export default function AdminSidebar() {
  const { t } = useLanguage();

  return (
    <aside className="w-64 bg-white border-r p-4 space-y-6">
      <div className="px-3">
        <h2 className="font-bold text-lg">{t("admin_backoffice", "Backoffice")}</h2>
        <p className="text-xs text-slate-500 mt-1">{t("admin_subtitle", "Okalab Admin")}</p>
      </div>

      <Section title={t("admin_section_main", "Main")}>
        <Item to="/admin">{t("admin_overview", "Overview")}</Item>
        <Item to="/admin/users">{t("admin_users", "Users")}</Item>
      </Section>

      <Section title={t("admin_section_data", "Data")}>
        <div className="space-y-1 pl-2 border-l border-slate-100">
          <Item to="/admin/seminars">{t("admin_seminar", "Seminar")}</Item>
          <Item to="/admin/enrollments">{t("admin_enrollment", "Enrollment")}</Item>
          <Item to="/admin/wallets">{t("admin_wallet", "Wallet")}</Item>
          <Item to="/admin/transactions">{t("admin_transactions", "Transactions")}</Item>
          <Item to="/admin/withdrawals">{t("admin_withdrawals", "Withdrawals")}</Item>
        </div>
      </Section>

      <Section title={t("admin_section_settings", "Settings")}>
        <Item to="/admin/settings">{t("admin_platform_settings", "Platform Settings")}</Item>
        <Item to="/admin/translations">{t("admin_translations", "Translations")}</Item>
      </Section>
    </aside>
  );
}
