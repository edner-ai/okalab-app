import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../Components/ui/card";
import { Badge } from "../../Components/ui/badge";

import { ArrowLeft, Check, X, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../Components/shared/LanguageContext";

export default function AdminVerifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [authUser, setAuthUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [booting, setBooting] = useState(true);

  // 1) Comprobar si soy admin
  useEffect(() => {
    const run = async () => {
      setBooting(true);

      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!u) {
        navigate("/login");
        return;
      }
      setAuthUser(u);

      const { data: p, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();

      if (error) {
        toast.error(t("admin_profile_read_error", "No se pudo leer tu perfil."));
        setBooting(false);
        return;
      }

      setMyProfile(p);
      setBooting(false);

      const role = (p?.role || "student").toLowerCase();
      if (role !== "admin") {
        toast.error(t("admin_access_denied", "Acceso denegado. Solo admin."));
        navigate("/profile");
      }
    };

    run();
  }, [navigate]);

  // 2) Traer solicitudes pendientes
  const { data: pendingProfiles = [], isLoading } = useQuery({
    queryKey: ["pending-professors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, location, preferred_language, verification_status, is_verified")
        .eq("verification_status", "pending")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!myProfile && (myProfile.role === "admin"),
  });

  // 3) Aprobar
  const approveMutation = useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "approved",
          is_verified: true,
          role: "professor",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("admin_verification_approved", "Aprobado ✅"));
      queryClient.invalidateQueries({ queryKey: ["pending-professors"] });
    },
    onError: () => toast.error(t("admin_verification_approve_error", "No se pudo aprobar.")),
  });

  // 4) Rechazar (opcional pero útil)
  const rejectMutation = useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "rejected",
          is_verified: false,
          // role se queda student
          role: "student",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("admin_verification_rejected", "Rechazado ❌"));
      queryClient.invalidateQueries({ queryKey: ["pending-professors"] });
    },
    onError: () => toast.error(t("admin_verification_reject_error", "No se pudo rechazar.")),
  });

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("admin_verifications", "Verificaciones")}</h1>
            <p className="text-slate-500">{t("admin_verifications_subtitle", "Aprobar solicitudes para convertirse en profesor")}</p>
          </div>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>{t("admin_pending_requests", "Solicitudes pendientes")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("common_loading", "Cargando...")}
              </div>
            ) : pendingProfiles.length === 0 ? (
              <div className="text-slate-500">{t("admin_no_pending_requests", "No hay solicitudes pendientes.")}</div>
            ) : (
              pendingProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {p.full_name || t("common_no_name", "(Sin nombre)")}
                        </p>
                        <Badge className="bg-amber-100 text-amber-800">
                          {t("status_pending", "pending")}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {t("admin_phone", "Tel")}: {p.phone || "—"} · {t("admin_location", "Ubicación")}: {p.location || "—"} · {t("admin_language", "Idioma")}: {p.preferred_language || "—"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {t("admin_id", "ID")}: {p.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      onClick={() => rejectMutation.mutate(p.id)}
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      {t("common_reject", "Rechazar")}
                    </Button>

                    <Button
                      className="gap-2 bg-slate-900 hover:bg-slate-800"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => approveMutation.mutate(p.id)}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {t("common_approve", "Aprobar")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
