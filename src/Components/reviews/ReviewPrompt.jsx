import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../shared/LanguageContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { toast } from "sonner";
import StarRating from "./StarRating";

export default function ReviewPrompt() {
  const qc = useQueryClient();
  const { user, authLoading } = useAuth();
  const { t } = useLanguage();

  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-reviews", user?.id],
    enabled: !!user?.id && !authLoading,
    queryFn: async () => {
      try {
        const { data: enrollments, error: enrollErr } = await supabase
          .from("enrollments")
          .select("seminar_id,status,payment_status")
          .eq("student_id", user.id);
        if (enrollErr) throw enrollErr;

        const activeEnrollments = (enrollments || []).filter(
          (e) => (e?.status || "") !== "cancelled" && (e?.payment_status || "") !== "cancelled"
        );
        const seminarIds = Array.from(new Set(activeEnrollments.map((e) => e.seminar_id).filter(Boolean)));
        if (!seminarIds.length) return [];

        const today = new Date().toISOString().slice(0, 10);
        const { data: seminars, error: semErr } = await supabase
          .from("seminars")
          .select("id,title,professor_id,instructor_id,end_date")
          .in("id", seminarIds)
          .lt("end_date", today);
        if (semErr) throw semErr;

        const endedSeminars = seminars || [];
        const endedIds = endedSeminars.map((s) => s.id);
        if (!endedIds.length) return [];

        const { data: reviews, error: revErr } = await supabase
          .from("seminar_reviews")
          .select("seminar_id")
          .eq("student_id", user.id)
          .in("seminar_id", endedIds);
        if (revErr) throw revErr;

        const reviewedSet = new Set((reviews || []).map((r) => r.seminar_id));
        return endedSeminars.filter((s) => !reviewedSet.has(s.id));
      } catch (err) {
        console.warn("pending reviews error", err?.message || err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setQueue(pending || []);
  }, [pending]);

  useEffect(() => {
    if (!dismissed && queue.length > 0) {
      setOpen(true);
    }
  }, [queue, dismissed]);

  const current = useMemo(() => queue[0] || null, [queue]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!current || !user) return;
      const payload = {
        seminar_id: current.id,
        student_id: user.id,
        professor_id: current.professor_id || current.instructor_id,
        rating,
        comment: comment?.trim() ? comment.trim() : null,
      };
      const { error } = await supabase.from("seminar_reviews").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("review_thanks", "¡Gracias por tu calificación!"));
      setRating(0);
      setComment("");
      setQueue((prev) => prev.slice(1));
      qc.invalidateQueries({ queryKey: ["pending-reviews", user?.id] });
    },
    onError: (err) => {
      toast.error(err?.message || t("review_submit_error", "No se pudo enviar tu calificación"));
    },
  });

  const handleLater = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleLater() : setOpen(true))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("review_pending_title", "Califica este seminario")}</DialogTitle>
          <p className="text-sm text-slate-500">{current.title}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm text-slate-600">{t("review_rating_label", "Tu calificación")}</Label>
            <StarRating value={rating} onChange={setRating} size={26} className="mt-2" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">{t("review_comment_label", "Comentario (opcional)")}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("review_comment_placeholder", "Cuéntanos tu experiencia...")}
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleLater}>
            {t("review_later", "Más tarde")}
          </Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || rating < 1}>
            {t("review_submit", "Enviar calificación")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
