import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../Components/shared/LanguageContext";
import { Input } from "../Components/ui/input";
import { Card, CardContent } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import StarRating from "../Components/reviews/StarRating";

export default function Teachers() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers-directory"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, bio, location, role, is_verified, verification_status, updated_at")
          .or("role.eq.teacher,role.eq.professor,is_verified.eq.true,verification_status.eq.approved")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("teachers load error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const teacherIds = useMemo(() => teachers.map((tch) => tch.id).filter(Boolean), [teachers]);
  const { data: teacherRatingStats = [] } = useQuery({
    queryKey: ["teacher-rating-stats", teacherIds],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_professor_rating_stats", {
          professor_ids: teacherIds,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("teacher rating stats error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const ratingByProfessor = useMemo(() => {
    const map = {};
    (teacherRatingStats || []).forEach((row) => {
      if (!row?.professor_id) return;
      map[row.professor_id] = {
        avg: Number(row.avg_rating || 0),
        count: Number(row.review_count || 0),
      };
    });
    return map;
  }, [teacherRatingStats]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return teachers;
    return teachers.filter((tch) =>
      [tch.full_name, tch.bio, tch.location].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [teachers, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold text-slate-900">
            {t("teachers_title", "Profesores")}
          </h1>
          <p className="text-slate-500 mt-2">
            {t("teachers_subtitle", "Explora profesores verificados y sus calificaciones")}
          </p>
          <div className="mt-6 max-w-lg">
            <Input
              placeholder={t("teachers_search_placeholder", "Buscar profesor...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white rounded-2xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
            {t("teachers_empty", "No hay profesores para mostrar")}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((teacher) => {
              const ratingData = ratingByProfessor[teacher.id] || { avg: 0, count: 0 };
              const avg = ratingData.avg || 0;

              return (
                <Card key={teacher.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      {teacher.avatar_url ? (
                        <img
                          src={teacher.avatar_url}
                          alt={teacher.full_name || "Profesor"}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                          {(teacher.full_name || "P")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{teacher.full_name || t("professor", "Profesor")}</p>
                        <div className="flex items-center gap-2">
                          <StarRating value={avg} readOnly size={16} />
                          <span className="text-xs text-slate-500">
                            {ratingData.count ? avg.toFixed(1) : t("teacher_no_reviews", "Sin reseñas")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {teacher.bio ? (
                      <p className="text-sm text-slate-600 line-clamp-3">{teacher.bio}</p>
                    ) : (
                      <p className="text-sm text-slate-400">{t("teacher_bio_empty", "Sin biografía")}</p>
                    )}

                    {teacher.location ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="h-4 w-4" />
                        <span>{teacher.location}</span>
                      </div>
                    ) : null}

                    <Link to={`/teachers/${teacher.id}`} className="block">
                      <Button className="w-full bg-slate-900 text-white hover:bg-slate-800">
                        {t("teacher_view_profile", "Ver perfil")}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
