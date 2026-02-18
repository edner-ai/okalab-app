import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../Components/shared/LanguageContext";
import { Card, CardContent } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { ArrowLeft, MapPin } from "lucide-react";
import StarRating from "../Components/reviews/StarRating";

export default function TeacherProfile() {
  const { id } = useParams();
  const { t } = useLanguage();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["teacher-profile", id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, bio, location, role, is_verified, verification_status")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data ?? null;
      } catch (err) {
        console.warn("teacher profile error", err?.message || err);
        return null;
      }
    },
  });

  const { data: ratingRows = [] } = useQuery({
    queryKey: ["teacher-profile-rating-stats", id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_professor_rating_stats", {
          professor_ids: [id],
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("teacher rating stats error", err?.message || err);
        return [];
      }
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["teacher-profile-reviews", id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_professor_reviews", {
          p_professor_id: id,
        });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn("teacher reviews error", err?.message || err);
        return [];
      }
    },
  });

  const ratingStats = useMemo(() => {
    const row = Array.isArray(ratingRows) ? ratingRows[0] : ratingRows;
    const avg = Number(row?.avg_rating);
    const count = Number(row?.review_count);
    return {
      avg: Number.isFinite(avg) ? avg : 0,
      count: Number.isFinite(count) ? count : 0,
    };
  }, [ratingRows]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="h-48 bg-white rounded-2xl animate-pulse border border-slate-100" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
            {t("teacher_not_found", "Profesor no encontrado")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link to="/teachers" className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <ArrowLeft className="h-4 w-4" />
            {t("common_back", "Volver")}
          </Link>

          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "Profesor"}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl">
                {(profile.full_name || "P")[0]?.toUpperCase()}
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">
                {profile.full_name || t("professor", "Profesor")}
              </h1>
              <div className="flex items-center gap-2">
                <StarRating value={ratingStats.avg} readOnly size={18} />
                <span className="text-sm text-slate-500">
                  {ratingStats.count
                    ? `${ratingStats.avg.toFixed(1)} · ${ratingStats.count} ${t("reviews", "reseñas")}`
                    : t("teacher_no_reviews", "Sin reseñas")}
                </span>
              </div>
              {profile.location ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {t("teacher_profile_about", "Sobre el profesor")}
            </h2>
            <p className="text-slate-600">
              {profile.bio || t("teacher_bio_empty", "Sin biografía")}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("teacher_profile_reviews", "Reseñas de estudiantes")}
          </h2>

          {reviewsLoading ? (
            <div className="h-40 bg-white rounded-2xl animate-pulse border border-slate-100" />
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
              {t("teacher_profile_no_reviews", "Aún no hay reseñas")}
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-0 shadow-sm">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating || 0} readOnly size={16} />
                        <span className="text-sm text-slate-500">{t("review_student", "Estudiante")}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="text-sm text-slate-600">{review.comment}</p>
                    ) : (
                      <p className="text-sm text-slate-400">{t("review_no_comment", "Sin comentario")}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Link to="/seminars">
            <Button variant="outline">{t("back_to_seminars", "Volver a seminarios")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
