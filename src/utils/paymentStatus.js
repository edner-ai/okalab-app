const normalizePaymentStatus = (value) => (value || "").toLowerCase().trim();

export const getPaymentStatusLabel = (value, t) => {
  const status = normalizePaymentStatus(value);
  const map = {
    paid: t?.("payment_status_paid", "Pagado") ?? "Pagado",
    pending: t?.("payment_status_pending", "Pendiente") ?? "Pendiente",
    pending_payment: t?.("payment_status_pending_payment", "Pago pendiente") ?? "Pago pendiente",
    unpaid: t?.("payment_status_unpaid", "No pagado") ?? "No pagado",
    rejected: t?.("payment_status_rejected", "Rechazado") ?? "Rechazado",
    failed: t?.("payment_status_failed", "Fallido") ?? "Fallido",
    expired: t?.("payment_status_expired", "Vencido") ?? "Vencido",
  };
  return map[status] || (status ? status : (t?.("payment_status_unknown", "Desconocido") ?? "Desconocido"));
};

export const normalizePayStatus = (value) => normalizePaymentStatus(value);
