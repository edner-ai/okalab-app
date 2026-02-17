// ProcessPayment.jsx (UNIFIED)
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../Components/ui/dialog";
import { Textarea } from "../Components/ui/textarea";

import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Loader2, Check, AlertCircle, X } from "lucide-react";

export default function ProcessPayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading, role } = useAuth();
  const { t } = useLanguage();

  const urlParams = new URLSearchParams(window.location.search);
  const enrollmentId = urlParams.get("enrollment_id");
  const mode = urlParams.get("mode") || "student";
  const isAdminMode = mode === "admin";

  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [cardData, setCardData] = useState({
    cardNumber: "",
    cardName: "",
    cardExpiry: "",
    cardCvc: "",
  });
  // Modal de rechazo (admin)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const adminReturnUrl = "/admin/enrollments";

  if (!enrollmentId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("error", "Error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">{t("payment_missing_enrollment", "Falta enrollment_id")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminMode && role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("access_restricted_title", "Acceso restringido")}</h2>
            <p className="text-slate-600 mb-4">{t("admin_only_process_payments", "Solo un administrador puede procesar pagos.")}</p>
            <Link to="/my-seminars">
              <Button variant="outline">{t("common_back", "Volver")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollment", enrollmentId],
    enabled: !!enrollmentId && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("id", enrollmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: seminar, isLoading: seminarLoading } = useQuery({
    queryKey: ["seminar", enrollment?.seminar_id],
    enabled: !!enrollment?.seminar_id && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .eq("id", enrollment.seminar_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", enrollment?.seminar_id],
    enabled: !!enrollment?.seminar_id && !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("quote_price", {
        p_seminar_id: enrollment.seminar_id,
      });
      if (error) throw error;
      return (data && data[0]) || null;
    },
  });

  const studentPayMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("auth_required", "Debes iniciar sesión."));
      if (!enrollmentId) throw new Error(t("payment_missing_enrollment", "Falta enrollment_id."));
      if (!enrollment) throw new Error(t("payment_enrollment_not_found", "Inscripción no encontrada."));
      if (!seminar) throw new Error(t("payment_seminar_not_found", "Seminario no encontrado."));

      // Seguridad: el enrollment debe pertenecer al usuario
      if (enrollment.student_id && enrollment.student_id !== user.id) {
        throw new Error(t("payment_not_allowed", "No tienes permiso para pagar esta inscripción."));
      }

      const { data, error } = await supabase.rpc("pay_enrollment", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(t("payment_submitted", "Pago registrado. Pendiente de validación."));
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      const target = seminar?.id ? `/seminars/${seminar.id}` : "/seminars";
      setTimeout(() => navigate(target), 800);
    },
    onError: (err) => toast.error(err?.message || t("payment_process_error", "Error al procesar pago")),
  });

  const approvePaymentMutation = useMutation({
    mutationFn: async () => {
      if (role !== "admin") throw new Error(t("admin_only_approve_payments", "Solo admin puede aprobar pagos."));
      const { data, error } = await supabase.rpc("approve_enrollment_payment", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(t("payment_approved", "Pago aprobado"));
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (isAdminMode) {
        setTimeout(() => navigate(adminReturnUrl), 800);
      }
    },
    onError: (err) => toast.error(err?.message || t("payment_approve_error", "Error al aprobar pago")),
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (reason) => {
      if (role !== "admin") throw new Error(t("admin_only_reject_payments", "Solo admin puede rechazar pagos."));
      const { data, error } = await supabase.rpc("reject_enrollment_payment", {
        p_enrollment_id: enrollmentId,
        p_reason: reason || t("payment_reject_reason_admin", "Rechazado por admin"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(t("payment_rejected", "Pago rechazado"));
      await queryClient.invalidateQueries({ queryKey: ["enrollment", enrollmentId] });
      if (isAdminMode) {
        setTimeout(() => navigate(adminReturnUrl), 800);
      }
    },
    onError: (err) => toast.error(err?.message || t("payment_reject_error", "Error al rechazar pago")),
  });

  if (loading || enrollmentLoading || seminarLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("common_loading", "Cargando…")}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("auth_login", "Inicia sesión")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">{t("payment_login_required", "Debes iniciar sesión para procesar pagos.")}</p>
            <Button className="w-full" onClick={() => navigate("/login")}>
              {t("auth_go_login", "Ir a login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!enrollment || !seminar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("not_found", "No encontrado")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">{t("payment_not_found", "No se encontró la inscripción o el seminario.")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((enrollment.payment_status || "").toLowerCase() === "paid") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("payment_already_processed", "Pago ya procesado")}</h2>
            <p className="text-slate-600 mb-4">{t("payment_already_paid", "Esta inscripción ya fue pagada")}</p>
            {isAdminMode ? (
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => navigate(adminReturnUrl)}>
                  {t("common_back", "Volver")}
                </Button>
                <Link to={`/seminars/${seminar.id}`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                    {t("viewSeminar", "Ver seminario")}
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to={`/seminars/${seminar.id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 mt-2">
                  {t("viewSeminar", "Ver seminario")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminMode) {
    const paymentStatus = (enrollment.payment_status || "").toLowerCase();
    const enrollmentStatus = (enrollment.status || "").toLowerCase();

    const amount = enrollment.final_price ?? enrollment.amount_paid ?? quote?.estimated_price_now ?? 0;

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t("payment_process_title", "Procesar pago")}</h1>
              <p className="text-slate-500 text-sm">{t("payment_admin_validation", "Validación por administrador")}</p>
            </div>
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>{t("detail", "Detalle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-600 space-y-1">
                <p><b>{t("seminar", "Seminario")}:</b> {seminar?.title || "—"}</p>
                <p><b>{t("student", "Estudiante")}:</b> {enrollment.student_email || "—"}</p>
                <p><b>{t("amount", "Monto")}:</b> ${Number(amount || 0).toFixed(2)}</p>
                <p><b>{t("enrollment_status", "Estado inscripción")}:</b> {enrollmentStatus || "—"}</p>
                <p><b>{t("payment_status", "Estado pago")}:</b> {paymentStatus || "—"}</p>
              </div>

              {paymentStatus !== "pending_payment" && paymentStatus !== "pending" ? (
                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                  {t("payment_not_pending", "Este pago no está pendiente de validación.")}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-300 disabled:cursor-not-allowed"
                    onClick={() => approvePaymentMutation.mutate()}
                    disabled={approvePaymentMutation.isPending || rejectPaymentMutation.isPending}
                  >
                    {approvePaymentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    {t("common_approve", "Aprobar")}
                  </Button>

                  <Button
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={approvePaymentMutation.isPending || rejectPaymentMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t("common_reject", "Rechazar")}
                  </Button>
                </div>
              )}

              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("payment_reject_title", "Rechazar pago")}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">{t("payment_reject_help", "Puedes escribir un motivo (opcional).")}</p>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t("payment_reject_placeholder", "Motivo del rechazo...")}
                      className="min-h-[100px]"
                    />
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectOpen(false);
                        setRejectReason("");
                      }}
                      disabled={rejectPaymentMutation.isPending}
                    >
                      {t("common_cancel", "Cancelar")}
                    </Button>

                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        const defaultReason = t("payment_reject_reason_admin", "Rechazado por admin");
                        const reasonToSend = rejectReason.trim() || defaultReason;
                        rejectPaymentMutation.mutate(reasonToSend, {
                          onSuccess: () => {
                            setRejectOpen(false);
                            setRejectReason("");
                          },
                        });
                      }}
                      disabled={rejectPaymentMutation.isPending}
                    >
                      {rejectPaymentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      {t("payment_reject_confirm", "Confirmar rechazo")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Modo estudiante (solicitud de pago)
  const amountNow = Number(quote?.estimated_price_now ?? enrollment.final_price ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("payment_title", "Pago")}</h1>
            <p className="text-slate-500 text-sm">
              {t("payment_deferred_note", "Pago diferido: el precio se calcula al pagar y el excedente se distribuye automáticamente.")}
            </p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>{t("payment_method", "Método de pago")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-sm text-slate-600">
                <p className="mb-1">
                  <span className="text-slate-500">{t("seminar", "Seminario")}</span><br />
                  <b className="text-slate-900">{seminar.title}</b>
                </p>
                <p>
                  {t("amount_to_pay", "Monto a pagar (cotizado)")}: <b>${amountNow.toFixed(2)}</b>
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("payment_method", "Método de pago")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="transfer">🏦 {t("payment_method_transfer", "Transferencia")}</SelectItem>
                    <SelectItem value="cash">💵 {t("payment_method_cash", "Efectivo")}</SelectItem>
                    <SelectItem value="card">💳 {t("payment_method_card", "Tarjeta")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "card" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t("card_number", "Número de tarjeta")}</Label>
                    <Input
                      value={cardData.cardNumber}
                      onChange={(e) => setCardData((p) => ({ ...p, cardNumber: e.target.value }))}
                      placeholder={t("card_number_placeholder", "1234 5678 9012 3456")}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("card_expiry", "Expira")}</Label>
                    <Input
                      value={cardData.cardExpiry}
                      onChange={(e) => setCardData((p) => ({ ...p, cardExpiry: e.target.value }))}
                      placeholder={t("card_expiry_placeholder", "MM/AA")}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("card_cvc", "CVC")}</Label>
                    <Input
                      value={cardData.cardCvc}
                      onChange={(e) => setCardData((p) => ({ ...p, cardCvc: e.target.value }))}
                      placeholder={t("card_cvc_placeholder", "123")}
                      className="h-12"
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12 bg-slate-900 hover:bg-slate-800"
                onClick={() => studentPayMutation.mutate()}
                disabled={studentPayMutation.isPending}
              >
                {studentPayMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {t("confirm_payment", "Confirmar pago")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
