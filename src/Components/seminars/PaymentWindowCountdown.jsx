import React, { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { getCountdownParts } from "../../utils/paymentWindow";

function pad(value) {
  return String(value).padStart(2, "0");
}

export default function PaymentWindowCountdown({
  targetDate,
  mode = "open",
  t,
  className = "",
  compact = false,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetDate) return undefined;

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  const parts = useMemo(() => getCountdownParts(targetDate, now), [targetDate, now]);

  if (!targetDate || parts.totalMs <= 0) return null;

  const palette =
    mode === "close"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  const caption =
    mode === "close"
      ? t?.("payment_countdown_close", "Tiempo restante para pagar")
      : t?.("payment_countdown_open", "Faltan para abrir los pagos");

  const labels = [
    { key: "days", value: parts.days, fallback: "d" },
    { key: "hours", value: parts.hours, fallback: "h" },
    { key: "minutes", value: parts.minutes, fallback: "m" },
    { key: "seconds", value: parts.seconds, fallback: "s" },
  ];

  return (
    <div
      className={[
        "rounded-2xl border",
        compact ? "p-3" : "p-4",
        palette,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-2">
        <Clock3 className={compact ? "h-4 w-4" : "h-5 w-5"} />
        <p className={compact ? "text-sm font-medium" : "text-sm font-semibold"}>{caption}</p>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {labels.map((item) => (
          <div key={item.key} className="rounded-xl bg-white/70 px-2 py-3 text-center">
            <div className={compact ? "text-lg font-bold" : "text-xl font-bold"}>{pad(item.value)}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">
              {t?.(`payment_countdown_${item.key}`, item.fallback)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
