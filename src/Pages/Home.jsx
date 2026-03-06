import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import HeroSection from "../Components/home/HeroSection";
import HowItWorksSection from "../Components/home/HowItWorksSection";
import CategoriesSection from "../Components/home/CategoriesSection";
import SeminarCard from "../Components/seminars/SeminarCard";
import { Button } from "../Components/ui/button";

import { useLanguage } from "../Components/shared/LanguageContext";
import { createPageUrl } from "../utils";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { t, language: uiLanguage } = useLanguage();
  const { user, canCreateSeminar, profile } = useAuth();
  const [languageFilter, setLanguageFilter] = useState("preferred");
  const preferredLanguage =
    profile?.preferred_language || localStorage.getItem("preferred_language") || uiLanguage || "";

  const professorCtaHref = !user
    ? "/login?next=/profile&intent=become-professor"
    : canCreateSeminar
      ? "/createseminar"
      : "/profile?intent=become-professor";

  const { data: featuredSeminars = [], isLoading: featuredLoading, error: featuredError } = useQuery({
    queryKey: ["home-featured-seminars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select(
          "id,title,target_income,target_students,excess_students,max_students,price,category,modality,start_date,total_hours,image_url,created_at,language"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const featuredIds = useMemo(() => featuredSeminars.map((s) => s.id).filter(Boolean), [featuredSeminars]);

  const { data: featuredRatings = [] } = useQuery({
    queryKey: ["home-featured-rating-stats", featuredIds],
    enabled: featuredIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_rating_stats", {
          seminar_ids: featuredIds,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("featured rating stats error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: enrollmentStats = [] } = useQuery({
    queryKey: ["home-featured-enrollment-counts", featuredIds],
    enabled: featuredIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_seminar_enrollment_counts", {
          seminar_ids: featuredIds,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("enrollment count error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const enrollmentCountBySeminar = useMemo(() => {
    const map = {};
    (enrollmentStats || []).forEach((row) => {
      if (!row?.seminar_id) return;
      map[row.seminar_id] = Number(row.enrolled_count || 0);
    });
    return map;
  }, [enrollmentStats]);

  const ratingBySeminar = useMemo(() => {
    const map = {};
    (featuredRatings || []).forEach((row) => {
      if (!row?.seminar_id) return;
      map[row.seminar_id] = {
        avg: Number(row.avg_rating || 0),
        count: Number(row.review_count || 0),
      };
    });
    return map;
  }, [featuredRatings]);

  const filteredFeaturedSeminars = useMemo(() => {
    return featuredSeminars.filter((seminar) => {
      if (languageFilter === "all") return true;
      if (!preferredLanguage) return true;
      return seminar.language === preferredLanguage;
    });
  }, [featuredSeminars, languageFilter, preferredLanguage]);

  const getEnrollmentCount = (id) => enrollmentCountBySeminar[id] || 0;
  const getRating = (id) => ratingBySeminar[id] || { avg: 0, count: 0 };

  return (
    <div className="min-h-screen bg-white">
      <HeroSection professorCtaHref={professorCtaHref} />
      <HowItWorksSection />
      <CategoriesSection />

      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="mb-2 text-3xl font-bold text-slate-900">
                {t("featuredSeminars", "Seminarios destacados")}
              </h2>
              <p className="text-slate-600">
                {t("featuredSeminarsSubtitle", "Los seminarios mas populares de nuestra comunidad")}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="hidden h-11 items-center rounded-xl bg-slate-100 p-1 sm:flex">
                <button
                  type="button"
                  onClick={() => setLanguageFilter("preferred")}
                  className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                    languageFilter === "preferred" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {t("seminars_language_preferred", "Solo mi idioma")}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageFilter("all")}
                  className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                    languageFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {t("seminars_language_all", "Todos")}
                </button>
              </div>

              <Link to={createPageUrl("Seminars")}>
                <Button variant="outline" className="hidden items-center gap-2 rounded-xl sm:flex">
                  {t("viewAll", "Ver todos")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {featuredError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              {t("featuredSeminarsError", "No se pudieron cargar los seminarios destacados.")}
            </div>
          ) : featuredLoading ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[420px] animate-pulse rounded-3xl border border-slate-100 bg-white" />
              ))}
            </div>
          ) : filteredFeaturedSeminars.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
              {languageFilter === "preferred"
                ? t("featuredSeminarsEmptyPreferred", "Aun no hay seminarios destacados en tu idioma.")
                : t("featuredSeminarsEmpty", "Aun no hay seminarios publicados.")}
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {filteredFeaturedSeminars.map((seminar) => {
                const rating = getRating(seminar.id);
                return (
                  <SeminarCard
                    key={seminar.id}
                    seminar={seminar}
                    enrollmentCount={getEnrollmentCount(seminar.id)}
                    ratingAvg={rating.avg}
                    ratingCount={rating.count}
                  />
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center sm:hidden">
            <div className="mx-auto mb-4 flex h-11 max-w-xs items-center justify-center rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setLanguageFilter("preferred")}
                className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                  languageFilter === "preferred" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {t("seminars_language_preferred", "Solo mi idioma")}
              </button>
              <button
                type="button"
                onClick={() => setLanguageFilter("all")}
                className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                  languageFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {t("seminars_language_all", "Todos")}
              </button>
            </div>

            <Link to={createPageUrl("Seminars")}>
              <Button className="w-full rounded-xl">
                {t("viewAllSeminars", "Ver todos los seminarios")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-6 text-4xl font-bold text-white">
              {t("readyToShare", "Listo para compartir tu conocimiento?")}
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-white/70">
              {t(
                "readyToShareSub",
                "Crea tu primer seminario y recibe el ingreso que mereces, mientras ayudas a otros a aprender."
              )}
            </p>
            <Link to={professorCtaHref}>
              <Button size="lg" className="h-14 rounded-xl bg-white px-8 text-lg text-slate-900 hover:bg-white/90">
                {t("createSeminar", "Crear mi seminario")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-900 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                <span className="text-lg font-bold text-white">O</span>
              </div>
              <div className="text-xl font-bold text-white">Okalab</div>
              <span className="hidden text-sm text-slate-400 sm:inline">
                © {new Date().getFullYear()} Okalab. {t("allRightsReserved", "Todos los derechos reservados.")}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-400">
              <Link to="/privacy" className="transition-colors hover:text-white">
                {t("privacy", "Privacidad")}
              </Link>
              <Link to="/terms" className="transition-colors hover:text-white">
                {t("terms", "Terminos")}
              </Link>
              <Link to="/support" className="transition-colors hover:text-white">
                {t("support", "Soporte")}
              </Link>
            </div>

            <p className="text-sm text-slate-400 sm:hidden">
              © {new Date().getFullYear()} Okalab. {t("allRightsReserved", "Todos los derechos reservados.")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
