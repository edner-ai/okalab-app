import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Card, CardContent } from "../../Components/ui/card";
import { useLanguage } from "../../Components/shared/LanguageContext";

const STAT_CARDS = [
  { key: "users", label: "Users" },
  { key: "seminars", label: "Seminars" },
  { key: "enrollments", label: "Enrollments" },
  { key: "pendingWithdrawals", label: "Pending Withdrawals" },
  { key: "pendingVerifications", label: "Pending Verifications" },
];

async function countRows(table, filters = []) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  filters.forEach(({ column, value }) => {
    q = q.eq(column, value);
  });
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export default function AdminOverview() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [
        users,
        seminars,
        enrollments,
        pendingWithdrawals,
        pendingVerifications,
      ] = await Promise.all([
        countRows("profiles"),
        countRows("seminars"),
        countRows("enrollments"),
        countRows("withdrawal_requests", [{ column: "status", value: "pending" }]),
        countRows("profiles", [{ column: "verification_status", value: "pending" }]),
      ]);

      return {
        users,
        seminars,
        enrollments,
        pendingWithdrawals,
        pendingVerifications,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("admin_overview", "Overview")}</h1>
        <p className="text-slate-600 mt-1">{t("admin_overview_subtitle", "Backoffice snapshot.")}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.key} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-slate-400 tracking-wide">
                {t(`admin_stat_${stat.key}`, stat.label)}
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {isLoading ? "..." : data?.[stat.key] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
