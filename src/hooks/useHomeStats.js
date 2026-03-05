import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

const statsCacheKey = "home_stats_cache";

export function useHomeStats() {
  const cachedStats = useMemo(() => {
    try {
      const raw = localStorage.getItem(statsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      console.warn("home stats cache parse error", err?.message || err);
      return null;
    }
  }, []);

  return useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_home_stats");
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        const students = Number(row?.students_count);
        const seminars = Number(row?.seminars_count);
        const satisfactionPct = Number(row?.satisfaction_pct);

        const normalized = {
          students: Number.isFinite(students) ? students : null,
          seminars: Number.isFinite(seminars) ? seminars : null,
          satisfactionPct: Number.isFinite(satisfactionPct) ? satisfactionPct : null,
        };

        try {
          localStorage.setItem(
            statsCacheKey,
            JSON.stringify({ data: normalized, updatedAt: Date.now() })
          );
        } catch {
          // ignore caching errors
        }

        return normalized;
      } catch (err) {
        console.warn("home stats error", err?.message || err);
        return { students: null, seminars: null, satisfactionPct: null };
      }
    },
    staleTime: 1000 * 60 * 5,
    initialData: cachedStats?.data ?? undefined,
    initialDataUpdatedAt: cachedStats?.updatedAt || 0,
  });
}
