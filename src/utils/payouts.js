import { normalizeCountryCode } from "./countries";

export const PAYOUT_METHOD_OPTIONS = [
  "bank_transfer",
  "paypal",
  "moncash",
  "natcash",
];
export const OKALAB_WALLET_PAYMENT_CODE = "okalab_balance";
export const OKALAB_WALLET_MIN_APPLY = 0.1;

export function getAvailablePayoutMethodOptions(countryCode, t) {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const baseOptions = [
    { value: "bank_transfer", label: t("payout_method_bank_transfer", "Transferencia bancaria") },
    { value: "paypal", label: t("payout_method_paypal", "PayPal") },
  ];

  if (normalizedCountry === "HT") {
    return [
      { value: "moncash", label: t("payout_method_moncash", "MonCash") },
      { value: "natcash", label: t("payout_method_natcash", "NatCash") },
      ...baseOptions,
    ];
  }

  return baseOptions;
}

export function getPayoutMinimum(method, countryCode) {
  const normalizedMethod = String(method || "").trim().toLowerCase();
  const normalizedCountry = normalizeCountryCode(countryCode);

  if (normalizedMethod === "paypal") return 25;

  if (normalizedMethod === "moncash" || normalizedMethod === "natcash") {
    return normalizedCountry === "HT" ? 10 : 25;
  }

  if (normalizedMethod === "bank_transfer") {
    return normalizedCountry === "DO" || normalizedCountry === "HT" ? 10 : 50;
  }

  return 25;
}

export function getPayoutMethodLabel(method, t) {
  const normalizedMethod = String(method || "").trim().toLowerCase();

  return (
    {
      bank_transfer: t("payout_method_bank_transfer", "Transferencia bancaria"),
      paypal: t("payout_method_paypal", "PayPal"),
      moncash: t("payout_method_moncash", "MonCash"),
      natcash: t("payout_method_natcash", "NatCash"),
    }[normalizedMethod] || t("common_unknown", "Desconocido")
  );
}

export function getPayoutDestinationSummary(profile, t) {
  const method = String(profile?.preferred_payout_method || "").trim().toLowerCase();

  if (method === "paypal") {
    return String(profile?.payout_paypal_email || "").trim();
  }

  if (method === "bank_transfer") {
    return [
      String(profile?.payout_bank_name || "").trim(),
      String(profile?.payout_bank_account_name || "").trim(),
      String(profile?.payout_bank_account_number || "").trim(),
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (method === "moncash" || method === "natcash") {
    return [
      String(profile?.payout_mobile_wallet_full_name || "").trim(),
      String(profile?.payout_mobile_wallet_phone || "").trim(),
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return t("payout_not_configured", "No configurado");
}

export function getPayoutProfileState(profile) {
  const preferredPayoutMethod = String(profile?.preferred_payout_method || "").trim().toLowerCase();
  const payoutPaypalEmail = String(profile?.payout_paypal_email || "").trim();
  const payoutBankAccountName = String(profile?.payout_bank_account_name || "").trim();
  const payoutBankName = String(profile?.payout_bank_name || "").trim();
  const payoutBankAccountNumber = String(profile?.payout_bank_account_number || "").trim();
  const payoutMobileWalletFullName = String(profile?.payout_mobile_wallet_full_name || "").trim();
  const payoutMobileWalletPhone = String(profile?.payout_mobile_wallet_phone || "").trim();
  const countryCode = normalizeCountryCode(profile?.country_code);
  const missing = [];

  if (!countryCode) missing.push("country_code");
  if (!preferredPayoutMethod) missing.push("preferred_payout_method");

  if (preferredPayoutMethod === "paypal" && !payoutPaypalEmail) {
    missing.push("payout_paypal_email");
  }

  if (preferredPayoutMethod === "bank_transfer") {
    if (!payoutBankName) missing.push("payout_bank_name");
    if (!payoutBankAccountName) missing.push("payout_bank_account_name");
    if (!payoutBankAccountNumber) missing.push("payout_bank_account_number");
  }

  if (preferredPayoutMethod === "moncash" || preferredPayoutMethod === "natcash") {
    if (countryCode !== "HT") missing.push("country_code");
    if (!payoutMobileWalletFullName) missing.push("payout_mobile_wallet_full_name");
    if (!payoutMobileWalletPhone) missing.push("payout_mobile_wallet_phone");
  }

  return {
    preferredPayoutMethod,
    payoutPaypalEmail,
    payoutBankAccountName,
    payoutBankName,
    payoutBankAccountNumber,
    payoutMobileWalletFullName,
    payoutMobileWalletPhone,
    countryCode,
    missing,
    isComplete: missing.length === 0,
  };
}

export function clampWalletAmount(value, availableBalance, totalDue) {
  const normalizedValue = Number(value || 0);
  const normalizedAvailable = Math.max(0, Number(availableBalance || 0));
  const normalizedTotalDue = Math.max(0, Number(totalDue || 0));

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return 0;

  const clamped = Math.min(normalizedValue, normalizedAvailable, normalizedTotalDue);
  return Math.round(clamped * 100) / 100;
}

export function shouldAllowWalletAmount(amount) {
  return Number(amount || 0) >= OKALAB_WALLET_MIN_APPLY;
}
