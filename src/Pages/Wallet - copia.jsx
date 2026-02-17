import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../Components/shared/LanguageContext";

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

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function TransactionList({ transactions }) {
  const { t } = useLanguage();
  if (!transactions?.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center text-slate-500">
          {t("noTransactions", "No hay transacciones todavía.")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <Card key={tx.id} className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{tx.description || t(tx.type, tx.type)}</p>
              <p className="text-xs text-slate-500">
                {t(tx.type, tx.type)} · {t(tx.status, tx.status || "—")} · {tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
              </p>
            </div>
            <div className="font-bold text-slate-900">{money(tx.amount)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Wallet() {
  const { user, loading, role } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isProfessor = role === "admin" || role === "professor" || role === "teacher";

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", user?.email],
    enabled: !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_email", user.email)
        .maybeSingle();
      if (error) throw error;

      if (data) return data;

      // crear wallet si no existe (según tu SQL)
      const payload = {
        user_email: user.email,
        user_type: isProfessor ? "professor" : "student",
        balance: 0,
        pending_balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase.from("wallets").insert([payload]);
      if (insErr) throw insErr;

      const { data: created, error: selErr } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_email", user.email)
        .maybeSingle();
      if (selErr) throw selErr;
      return created;
    },
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["wallet_transactions", user?.email, user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      // tu tabla tiene user_email a veces null, así que hacemos OR por seguridad
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .or(`user_email.eq.${user.email},user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Stats (similar a Base44)
  const referralCount = useMemo(
    () => transactions.filter((t) => t.type === "referral_bonus").length,
    [transactions]
  );

  // Mis seminarios / inscripciones (para los 3 cards de arriba)
  const { data: mySeminars = [] } = useQuery({
    queryKey: ["wallet-seminars-count", user?.id, isProfessor],
    enabled: !!user && !loading,
    queryFn: async () => {
      if (!isProfessor) return [];
      const { data, error } = await supabase.from("seminars").select("id").eq("professor_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["wallet-enrollments-count", user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("id").eq("student_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Withdraw = crea tx + mueve balance -> pending_balance (igual concepto)
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(withdrawAmount);
      if (!wallet) throw new Error(t("wallet_unavailable", "Billetera no disponible"));
      if (!amount || amount <= 0) throw new Error(t("invalid_amount", "Monto inválido"));
      if (amount > Number(wallet.balance || 0)) throw new Error(t("amount_exceeds_balance", "Monto mayor al balance disponible"));

      const now = new Date().toISOString();

      // tx withdrawal pending
      const { error: txErr } = await supabase.from("wallet_transactions").insert([
        {
          id: crypto.randomUUID(),
          created_at: now,
          user_id: user.id,
          amount,
          type: "withdrawal",
          description: t("withdraw_request_description", "Solicitud de retiro"),
          status: "pending",
          wallet_id: null,
          user_email: user.email,
          seminar_id: null,
        },
      ]);
      if (txErr) throw txErr;

      // update wallet
      const { error: wErr } = await supabase
        .from("wallets")
        .update({
          balance: Number(wallet.balance || 0) - amount,
          pending_balance: Number(wallet.pending_balance || 0) + amount,
          total_withdrawn: Number(wallet.total_withdrawn || 0) + amount,
          updated_at: now,
        })
        .eq("user_email", user.email);

      if (wErr) throw wErr;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["wallet_transactions"] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      toast.success(t("withdraw_request_sent", "Solicitud de retiro enviada"));
    },
    onError: (e) => toast.error(e?.message || t("withdraw_request_error", "No se pudo solicitar retiro")),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top stats (como tu captura) */}
            <div className="grid sm:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-xl">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t("mySeminars", "Mis Seminarios")}</p>
                        <p className="text-2xl font-bold">{isProfessor ? mySeminars.length : 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-100 rounded-xl">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t("enrollments", "Inscripciones")}</p>
                        <p className="text-2xl font-bold">{myEnrollments.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5">
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

            {/* Transactions */}
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
                <TransactionList
                  transactions={transactions.filter((t) =>
                    ["seminar_income", "referral_bonus", "surplus_distribution"].includes(t.type)
                  )}
                />
              </TabsContent>

              <TabsContent value="withdrawals" className="mt-6">
                <TransactionList transactions={transactions.filter((t) => t.type === "withdrawal")} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar: Wallet card como Base44 (mini-cards) */}
          <div className="space-y-6">
            {walletLoading ? (
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
            ) : (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <WalletIcon className="h-5 w-5" />
                    {t("my_wallet", "Mi billetera")}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/10 rounded-xl">
                    <p className="text-sm text-white/70">{t("availableBalance", "Balance disponible")}</p>
                    <p className="text-3xl font-bold">{money(wallet?.balance)}</p>
                  </div>

                  {/* 3 mini-cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[11px] text-amber-200/90 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" /> {t("pending", "Pendiente")}
                      </p>
                      <p className="font-bold">{money(wallet?.pending_balance)}</p>
                    </div>

                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[11px] text-emerald-200/90 flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" /> {t("totalEarned", "Ganado")}
                      </p>
                      <p className="font-bold">{money(wallet?.total_earned)}</p>
                    </div>

                    <div className="p-3 bg-white/10 rounded-xl text-center">
                      <p className="text-[11px] text-sky-200/90 flex items-center justify-center gap-1">
                        <Download className="h-3 w-3" /> {t("totalWithdrawn", "Retirado")}
                      </p>
                      <p className="font-bold">{money(wallet?.total_withdrawn)}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setShowWithdrawDialog(true)}
                    className="w-full bg-white text-slate-900 hover:bg-white/90"
                  >
                    {t("requestWithdrawal", "Solicitar retiro")}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{t("quickActions", "Acciones rápidas")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isProfessor && (
                  <Link to="/createseminar" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="h-4 w-4 mr-2" />
                      {t("createSeminar", "Crear seminario")}
                    </Button>
                  </Link>
                )}
                <Link to="/my-seminars" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    {t("mySeminars", "Mis seminarios")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Withdraw Dialog */}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              {t("common_cancel", "Cancelar")}
            </Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || withdrawMutation.isPending}
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
