import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";
import {
  getPayoutDestinationSummary,
  getPayoutMethodLabel,
  getPayoutMinimum,
  getPayoutProfileState,
} from "../utils/payouts";

import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { ArrowLeft, Loader2, TrendingUp, Users, BookOpen, Wallet as WalletIcon, Download, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

const INCOME_TRANSACTION_TYPES = new Set([
  "seminar_income",
  "referral_bonus",
  "surplus_distribution",
  "professor_earning",
  "professor_excess_bonus",
  "ref_pool_to_professor",
]);

function money(n) {
  const value = Number(String(n ?? 0).replace(/,/g, ""));
  const normalized = Number.isFinite(value) ? value : 0;
  const prefix = normalized < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(normalized).toFixed(2)}`;
}

function buildEmptyWallet(email, isProfessor) {
  return {
    user_email: email,
    user_type: isProfessor ? "professor" : "student",
    balance: 0,
    pending_balance: 0,
    total_earned: 0,
    total_withdrawn: 0,
  };
}

function dedupeTransactions(items = []) {
  const byId = new Map();

  for (const tx of items) {
    if (!tx) continue;
    const fallbackKey = [
      tx.user_id || "",
      tx.user_email || "",
      tx.type || "",
      tx.amount || 0,
      tx.created_at || "",
      tx.description || "",
    ].join("|");
    byId.set(tx.id || fallbackKey, tx);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
  );
}

function TransactionList({ transactions }) {
  const { t } = useLanguage();

  if (!transactions?.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center text-slate-500">
          {t("wallet_no_transactions", "No hay transacciones todavia.")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <Card key={tx.id} className="border-0 shadow-md">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">
                {tx.description || t(tx.type, tx.type)}
              </p>
              <p className="text-xs text-slate-500">
                {t(tx.type, tx.type)} · {t(tx.status, tx.status || "-")} ·{" "}
                {tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
              </p>
            </div>
            <div className="font-bold text-slate-900 self-end sm:self-auto">{money(tx.amount)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Wallet() {
  const { user, profile, authLoading, profileLoading, role } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isProfessor = role === "admin" || role === "professor" || role === "teacher";
  const showWalletSeminarAction = !isProfessor;
  const email = user?.email?.toLowerCase() || "";
  const emptyWallet = useMemo(() => buildEmptyWallet(email, isProfessor), [email, isProfessor]);
  const payoutProfileState = useMemo(() => getPayoutProfileState(profile), [profile]);
  const payoutMethodLabel = useMemo(
    () => getPayoutMethodLabel(payoutProfileState.preferredPayoutMethod, t),
    [payoutProfileState.preferredPayoutMethod, t]
  );
  const payoutDestination = useMemo(
    () => getPayoutDestinationSummary(profile, t),
    [profile, t]
  );
  const payoutMinimum = useMemo(
    () => getPayoutMinimum(payoutProfileState.preferredPayoutMethod, payoutProfileState.countryCode),
    [payoutProfileState.preferredPayoutMethod, payoutProfileState.countryCode]
  );

  const { data: wallet = emptyWallet, isLoading: walletLoading, error: walletError } = useQuery({
    queryKey: ["wallet", user?.id, email, isProfessor],
    enabled: !!user?.id && !!email && !authLoading,
    queryFn: async () => {
      const selectClause = "user_email,user_type,balance,pending_balance,total_earned,total_withdrawn,updated_at";

      const exactResult = await supabase
        .from("wallets")
        .select(selectClause)
        .eq("user_email", email)
        .maybeSingle();

      if (exactResult.error) throw exactResult.error;
      if (exactResult.data) return exactResult.data;

      const fallbackResult = await supabase
        .from("wallets")
        .select(selectClause)
        .ilike("user_email", email)
        .maybeSingle();

      if (fallbackResult.error) throw fallbackResult.error;
      return fallbackResult.data ?? emptyWallet;
    },
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!walletError) return;
    toast.error(walletError?.message || t("wallet_load_error", "No se pudo cargar tu billetera"));
  }, [walletError, t]);

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["wallet_transactions", user?.id, email],
    enabled: !!user?.id && !!email && !authLoading,
    queryFn: async () => {
      const selectClause = "id,user_id,user_email,amount,type,description,status,created_at";

      const userTransactionsRequest = supabase
        .from("wallet_transactions")
        .select(selectClause)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const emailTransactionsRequest = (async () => {
        const exactResult = await supabase
          .from("wallet_transactions")
          .select(selectClause)
          .eq("user_email", email)
          .order("created_at", { ascending: false })
          .limit(100);

        if (exactResult.error) throw exactResult.error;
        if ((exactResult.data ?? []).length > 0) return exactResult.data ?? [];

        const fallbackResult = await supabase
          .from("wallet_transactions")
          .select(selectClause)
          .ilike("user_email", email)
          .order("created_at", { ascending: false })
          .limit(100);

        if (fallbackResult.error) throw fallbackResult.error;
        return fallbackResult.data ?? [];
      })();

      const [{ data: byUserId, error: userIdError }, byEmail] = await Promise.all([
        userTransactionsRequest,
        emailTransactionsRequest,
      ]);

      if (userIdError) throw userIdError;

      return dedupeTransactions([...(byUserId ?? []), ...byEmail]).slice(0, 100);
    },
    staleTime: 1000 * 30,
  });

  const heldReferralTotal = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "referral_bonus" && tx.status === "held")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [transactions]
  );

  const { data: mySeminarsCount = 0 } = useQuery({
    queryKey: ["wallet-seminars-count", user?.id, isProfessor],
    enabled: !!user?.id && !authLoading && isProfessor,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("seminars")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", user.id);

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const { data: myEnrollmentsCount = 0 } = useQuery({
    queryKey: ["wallet-enrollments-count", user?.id],
    enabled: !!user?.id && !authLoading,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id);

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const { data: referralCount = 0 } = useQuery({
    queryKey: ["wallet-referrals-count", user?.id],
    enabled: !!user?.id && !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_referral_count");

      if (error) throw error;
      return Number(data || 0);
    },
    staleTime: 1000 * 60,
  });

  const payoutSummaryLabel = profileLoading
    ? t("admin_loading_profile", "Cargando perfil...")
    : payoutProfileState.isComplete
      ? payoutMethodLabel
      : t("payout_not_configured", "No configurado");

  const payoutSummaryDestination = profileLoading
    ? t("common_loading", "Cargando...")
    : payoutProfileState.isComplete
      ? payoutDestination
      : t(
          "payout_setup_required_help",
          "Configura tu metodo de retiro en Perfil antes de solicitar retiros externos."
        );

  const payoutMinimumLabel = profileLoading
    ? null
    : payoutProfileState.preferredPayoutMethod
      ? `${t("payout_minimum_label", "Minimo de retiro")}: $${Number(payoutMinimum || 0).toFixed(2)}`
      : null;

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(withdrawAmount);

      if (!amount || amount <= 0) {
        throw new Error(t("wallet_invalid_amount", "Monto invalido"));
      }

      if (!payoutProfileState.isComplete) {
        throw new Error(
          t(
            "payout_profile_incomplete_error",
            "Completa tu metodo de retiro y tu pais de residencia antes de solicitar un retiro externo."
          )
        );
      }

      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: amount,
        p_method: payoutProfileState.preferredPayoutMethod,
        p_destination: payoutDestination,
      });

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet_transactions", user?.id] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      toast.success(t("wallet_withdraw_request_sent", "Solicitud de retiro enviada"));
    },
    onError: (e) => toast.error(e?.message || t("wallet_withdraw_request_error", "No se pudo solicitar retiro")),
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-4 pb-8 md:py-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("wallet", "Billetera")}</h1>
            <p className="text-slate-500">{t("wallet_subtitle", "Gestiona tus ganancias y retiros")}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-xl">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t("mySeminars", "Mis Seminarios")}</p>
                        <p className="text-2xl font-bold">{isProfessor ? mySeminarsCount : 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-100 rounded-xl">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t("enrollments", "Inscripciones")}</p>
                        <p className="text-2xl font-bold">{myEnrollmentsCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t("referrals", "Referidos")}</p>
                        <p className="text-2xl font-bold">{referralCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full bg-white border p-1 rounded-xl">
                <TabsTrigger value="all" className="flex-1 rounded-lg">{t("all", "Todas")}</TabsTrigger>
                <TabsTrigger value="income" className="flex-1 rounded-lg">{t("income", "Ingresos")}</TabsTrigger>
                <TabsTrigger value="withdrawals" className="flex-1 rounded-lg">{t("withdrawals", "Retiros")}</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                {txLoading ? <div className="h-28 bg-white rounded-2xl animate-pulse" /> : <TransactionList transactions={transactions} />}
              </TabsContent>

              <TabsContent value="income" className="mt-6">
                <TransactionList transactions={transactions.filter((tx) => INCOME_TRANSACTION_TYPES.has(tx.type))} />
              </TabsContent>

              <TabsContent value="withdrawals" className="mt-6">
                <TransactionList transactions={transactions.filter((tx) => tx.type === "withdrawal")} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            {walletLoading ? (
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
            ) : walletError ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-10 text-center text-slate-500">
                  {t("wallet_load_error", "No se pudo cargar tu billetera")}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <WalletIcon className="h-5 w-5" />
                    {t("myWallet", "Mi billetera")}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/10 rounded-xl">
                    <p className="text-sm text-white/70">{t("availableBalance", "Balance disponible")}</p>
                    <p className="text-3xl font-bold">{money(wallet?.balance)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[10px] sm:text-[11px] text-amber-200/90 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" /> {t("pending", "Pendiente")}
                      </p>
                      <p className="font-bold">{money(wallet?.pending_balance)}</p>
                    </div>

                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[10px] sm:text-[11px] text-emerald-200/90 flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" /> {t("totalEarned", "Ganado")}
                      </p>
                      <p className="font-bold">{money(wallet?.total_earned)}</p>
                    </div>

                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[10px] sm:text-[11px] text-sky-200/90 flex items-center justify-center gap-1">
                        <Download className="h-3 w-3" /> {t("totalWithdrawn", "Retirado")}
                      </p>
                      <p className="font-bold">{money(wallet?.total_withdrawn)}</p>
                    </div>
                  </div>

                  {heldReferralTotal > 0 ? (
                    <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3">
                      <p className="text-sm font-medium text-amber-100">
                        {t("wallet_held_referrals", "Bonos ganados y retenidos")}
                      </p>
                      <p className="text-2xl font-bold text-white">{money(heldReferralTotal)}</p>
                      <p className="mt-1 text-xs text-white/70">
                        {t(
                          "wallet_held_referrals_help",
                          "Se calculan al cerrar la ventana de pago segun el orden de inscripcion de estudiantes pagados que quedaron realmente en excedente y fueron atribuidos a tu enlace. Solo se liberan si tu tambien pagaste tu propia inscripcion y el seminario finaliza correctamente."
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="font-medium text-white">
                      {t("preferred_payout_method", "Metodo de retiro preferido")}:{" "}
                      <span className="text-white/80">{payoutSummaryLabel}</span>
                    </p>
                    <p className="mt-1 text-xs text-white/70 break-words">{payoutSummaryDestination}</p>
                    {payoutMinimumLabel ? (
                      <p className="mt-2 text-xs text-white/60">{payoutMinimumLabel}</p>
                    ) : null}
                  </div>

                  <Button
                    onClick={() => setShowWithdrawDialog(true)}
                    className="w-full bg-white text-slate-900 hover:bg-white/90"
                    disabled={profileLoading}
                  >
                    {t("requestWithdrawal", "Solicitar retiro")}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{t("quickActions", "Acciones rapidas")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {isProfessor && (
                    <Link to="/createseminar" className="block">
                      <Button
                        variant="outline"
                        className="h-auto min-h-14 w-full items-start justify-start whitespace-normal break-words px-3 py-3 text-left text-sm"
                      >
                        <BookOpen className="h-4 w-4 shrink-0 mr-2 mt-0.5" />
                        {t("createSeminar", "Crear seminario")}
                      </Button>
                    </Link>
                  )}
                  <Link to="/my-seminars" className="block">
                    <Button
                      variant="outline"
                      className="h-auto min-h-14 w-full items-start justify-start whitespace-normal break-words px-3 py-3 text-left text-sm"
                    >
                      <Users className="h-4 w-4 shrink-0 mr-2 mt-0.5" />
                      {t("mySeminars", "Mis seminarios")}
                    </Button>
                  </Link>
                  {showWalletSeminarAction ? (
                    <Link to="/my-seminars?wallet_checkout=1" className="block">
                      <Button
                        variant="outline"
                        className="h-auto min-h-14 w-full items-start justify-start whitespace-normal break-words px-3 py-3 text-left text-sm"
                      >
                        <WalletIcon className="h-4 w-4 shrink-0 mr-2 mt-0.5" />
                        {t("wallet_go_to_payments", "Ir a mis pagos")}
                      </Button>
                    </Link>
                  ) : null}
                  <Link to="/profile" className="block">
                    <Button
                      variant="outline"
                      className="h-auto min-h-14 w-full items-start justify-start whitespace-normal break-words px-3 py-3 text-left text-sm"
                    >
                      <Download className="h-4 w-4 shrink-0 mr-2 mt-0.5" />
                      {t("wallet_configure_payout", "Configurar retiro")}
                    </Button>
                  </Link>
                </div>
                {showWalletSeminarAction ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    {t(
                      "okalab_wallet_usage_help",
                      "Tu Saldo Okalab puede usarse desde USD 0.10 para pagar seminarios dentro de la plataforma."
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {t(
                        "wallet_usage_flow_help",
                        "Este atajo te lleva a Mis seminarios y, si tienes un pago pendiente abierto, te dirige al checkout con tu saldo preparado."
                      )}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("requestWithdrawal", "Solicitar retiro")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500">{t("availableBalance", "Balance disponible")}</p>
              <p className="text-2xl font-bold">{money(wallet?.balance)}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-900">
                  {t("preferred_payout_method", "Metodo de retiro preferido")}:
                </span>{" "}
                {payoutSummaryLabel}
              </p>
              <p className="mt-1 break-words">{payoutSummaryDestination}</p>
              {payoutMinimumLabel ? (
                <p className="mt-2 text-xs text-slate-500">{payoutMinimumLabel}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{t("withdraw_amount", "Monto a retirar (USD)")}</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={t("amount_placeholder", "0.00")}
                  className="pl-8"
                  max={wallet?.balance || 0}
                />
              </div>
            </div>

            {profileLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {t("admin_loading_profile", "Cargando perfil...")}
              </div>
            ) : null}

            {!profileLoading && !payoutProfileState.isComplete ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t(
                  "payout_profile_incomplete_error",
                  "Completa tu metodo de retiro y tu pais de residencia antes de solicitar un retiro externo."
                )}
              </div>
            ) : null}

            {!profileLoading &&
            payoutProfileState.isComplete &&
            Number(withdrawAmount || 0) > 0 &&
            Number(withdrawAmount || 0) < Number(payoutMinimum || 0) ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t(
                  "payout_minimum_warning",
                  "Este metodo requiere un minimo de retiro de USD {amount}."
                ).replace("{amount}", Number(payoutMinimum || 0).toFixed(2))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              {t("common_cancel", "Cancelar")}
            </Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={
                profileLoading ||
                !withdrawAmount ||
                Number(withdrawAmount) <= 0 ||
                Number(withdrawAmount) > Number(wallet?.balance || 0) ||
                withdrawMutation.isPending ||
                !payoutProfileState.isComplete ||
                Number(withdrawAmount) < Number(payoutMinimum || 0)
              }
              className="bg-slate-900 hover:bg-slate-800"
            >
              {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("requestWithdrawal", "Solicitar retiro")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
