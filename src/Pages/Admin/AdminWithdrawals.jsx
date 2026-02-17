import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAnonKey, supabaseUrl } from "../../lib/supabase";
import { toast } from "sonner";
import { useLanguage } from "../../Components/shared/LanguageContext";
import { Button } from "../../Components/ui/button";
import { Check, X } from "lucide-react";

export default function AdminWithdrawals() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const parseInvokeError = async (error) => {
    let message = error?.message || "Edge Function error";

    if (error?.context) {
      try {
        const text = await error.context.text();
        if (text) {
          try {
            const payload = JSON.parse(text);
            message = payload?.error || payload?.message || text;
          } catch {
            message = text;
          }
        }
      } catch {
        // keep default message
      }
    }

    return message;
  };

  const getValidatedAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(t("auth_session_expired", "Tu sesion expiro. Vuelve a iniciar sesion."));
    }

    const { error } = await supabase.auth.getUser(session.access_token);
    if (error) {
      throw new Error(error.message || t("auth_session_expired", "Tu sesion expiro. Vuelve a iniciar sesion."));
    }

    return session.access_token;
  };

  const invokeOnce = async (body, accessToken) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/withdrawal-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        "x-user-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || text || res.statusText);
    }

    if (payload?.error) throw new Error(payload.error);
    return payload;
  };

  const invokeWithdrawalAction = async (body) => {
    const accessToken = await getValidatedAccessToken();

    try {
      return await invokeOnce(body, accessToken);
    } catch (error) {
      const msg = (error?.message || "").toLowerCase();
      const shouldRetry = msg.includes("invalid jwt") || msg.includes("jwt") || msg.includes("non-2xx");

      if (!shouldRetry) throw error;

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshData?.session?.access_token;

      if (refreshError || !refreshedToken) {
        throw new Error(t("auth_session_expired", "Tu sesion expiro. Vuelve a iniciar sesion."));
      }

      const { error: validateError } = await supabase.auth.getUser(refreshedToken);
      if (validateError) {
        throw new Error(validateError.message || t("auth_session_expired", "Tu sesion expiro. Vuelve a iniciar sesion."));
      }

      return await invokeOnce(body, refreshedToken);
    }
  };

  const { data = [] } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approve = useMutation({
    mutationFn: async (id) => {
      await invokeWithdrawalAction({ action: "approve", withdrawal_id: id });
    },
    onSuccess: () => {
      toast.success(t("withdrawal_approved", "Retiro aprobado"));
      qc.invalidateQueries(["withdrawals"]);
    },
    onError: (err) => toast.error(err?.message || t("withdrawal_approve_error", "No se pudo aprobar")),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }) => {
      await invokeWithdrawalAction({ action: "reject", withdrawal_id: id, reason });
    },
    onSuccess: () => {
      toast.success(t("withdrawal_rejected", "Retiro rechazado"));
      qc.invalidateQueries(["withdrawals"]);
    },
    onError: (err) => toast.error(err?.message || t("withdrawal_reject_error", "No se pudo rechazar")),
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t("admin_withdrawals", "Solicitudes de retiro")}</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>{t("admin_user_email", "Email")}</th>
            <th>{t("admin_amount", "Monto")}</th>
            <th>{t("admin_status", "Estado")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((w) => (
            <tr key={w.id} className="border-b">
              <td>{w.user_email}</td>
              <td>${w.amount}</td>
              <td>{w.status}</td>
              <td className="space-x-2">
                {w.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => approve.mutate(w.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {t("common_approve", "Aprobar")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() =>
                        reject.mutate({ id: w.id, reason: t("admin_withdrawal_rejected_reason", "Rechazado por admin") })
                      }
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t("common_reject", "Rechazar")}
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
