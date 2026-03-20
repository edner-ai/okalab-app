import { normalizeCountryCode } from "./countries";
import { getIntlLocale } from "./dateLocale";

const LOCAL_CURRENCY_CONFIG = {
  DO: {
    currency: "DOP",
    rateKey: "usd_to_dop",
  },
  HT: {
    currency: "HTG",
    rateKey: "usd_to_htg",
  },
};

export function formatCurrencyAmount(amount, currency, language = "es") {
  if (!Number.isFinite(Number(amount))) return "";

  return new Intl.NumberFormat(getIntlLocale(language), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function getLocalCurrencyConfig(countryCode) {
  const normalized = normalizeCountryCode(countryCode);
  return LOCAL_CURRENCY_CONFIG[normalized] || null;
}

export function getExchangeRateForCountry(settings, countryCode) {
  const config = getLocalCurrencyConfig(countryCode);
  if (!config) return null;

  const rate = Number(settings?.[config.rateKey]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function getLocalCurrencyQuote({ amountUsd, countryCode, settings, language = "es" }) {
  const normalizedAmountUsd = Number(amountUsd);
  const config = getLocalCurrencyConfig(countryCode);
  const rate = getExchangeRateForCountry(settings, countryCode);

  if (!config || !Number.isFinite(normalizedAmountUsd) || normalizedAmountUsd <= 0 || !rate) {
    return null;
  }

  const localAmount = normalizedAmountUsd * rate;

  return {
    countryCode: normalizeCountryCode(countryCode),
    currency: config.currency,
    rate,
    amountUsd: normalizedAmountUsd,
    localAmount,
    formattedLocalAmount: formatCurrencyAmount(localAmount, config.currency, language),
    formattedRate: formatCurrencyAmount(rate, config.currency, language),
  };
}
