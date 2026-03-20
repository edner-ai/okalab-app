import React, { useMemo } from "react";
import { getLocalCurrencyQuote } from "../../utils/localCurrency";

export default function LocalCurrencyReference({
  usdAmount,
  countryCode,
  settings,
  language,
  t,
  className = "",
  showRate = true,
}) {
  const quote = useMemo(
    () =>
      getLocalCurrencyQuote({
        amountUsd: usdAmount,
        countryCode,
        settings,
        language,
      }),
    [usdAmount, countryCode, settings, language]
  );

  if (!quote) return null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 ${className}`.trim()}>
      <p>
        {t("local_currency_reference", "Referencia en tu moneda")}:{" "}
        <span className="font-semibold text-slate-900">{quote.formattedLocalAmount}</span>
      </p>
      {showRate ? (
        <p className="mt-1 text-xs text-slate-500">
          {t("local_currency_rate_note", "Tasa usada")}: 1 USD = {quote.formattedRate}
        </p>
      ) : null}
    </div>
  );
}
