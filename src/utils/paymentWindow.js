import { parseDateValue } from "./dateValue";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PAYMENT_WINDOW_SETTINGS = {
  payment_open_days: 7,
  payment_close_days: 2,
};

export function parsePaymentDate(value) {
  return parseDateValue(value);
}

export function normalizePaymentWindowSettings(settings = {}) {
  const rawOpenDays = Math.round(Number(settings?.payment_open_days));
  const rawCloseDays = Math.round(Number(settings?.payment_close_days));

  const openDays = Number.isFinite(rawOpenDays)
    ? Math.max(0, rawOpenDays)
    : DEFAULT_PAYMENT_WINDOW_SETTINGS.payment_open_days;
  const closeDays = Number.isFinite(rawCloseDays)
    ? Math.max(0, rawCloseDays)
    : DEFAULT_PAYMENT_WINDOW_SETTINGS.payment_close_days;

  return {
    payment_open_days: Math.max(openDays, closeDays),
    payment_close_days: Math.min(openDays, closeDays),
  };
}

function buildRelativeDate(startDate, daysBefore, endOfDay = false) {
  const base = parsePaymentDate(startDate);
  if (!base) return null;

  const result = new Date(base.getTime() - daysBefore * DAY_MS);
  if (endOfDay) {
    result.setHours(23, 59, 59, 999);
  }
  return result;
}

export function resolvePaymentWindow({
  seminarStartDate,
  quote,
  settings,
  now = new Date(),
  forcePayOpen = false,
} = {}) {
  const normalizedSettings = normalizePaymentWindowSettings(settings);
  const current = parsePaymentDate(now) || new Date();

  const paymentOpenDate =
    parsePaymentDate(quote?.payment_open_date) ||
    buildRelativeDate(seminarStartDate, normalizedSettings.payment_open_days);

  const paymentCloseDate =
    parsePaymentDate(quote?.payment_close_date) ||
    buildRelativeDate(seminarStartDate, normalizedSettings.payment_close_days, true);

  if (paymentCloseDate) {
    paymentCloseDate.setHours(23, 59, 59, 999);
  }

  const hasScheduledWindow = !!paymentOpenDate && !!paymentCloseDate;
  const scheduledWindowOpen = hasScheduledWindow
    ? current >= paymentOpenDate && current <= paymentCloseDate
    : typeof quote?.is_payment_window_open === "boolean"
      ? quote.is_payment_window_open
      : false;

  const isPaymentWindowClosed = !!paymentCloseDate && current > paymentCloseDate;
  const canPayByWindow = hasScheduledWindow
    ? scheduledWindowOpen
    : typeof quote?.can_pay === "boolean"
      ? quote.can_pay
      : scheduledWindowOpen;
  const canPayNow = !isPaymentWindowClosed && (canPayByWindow || !!forcePayOpen);
  const isPaymentOpenByCapacity = !!forcePayOpen && !canPayByWindow && !isPaymentWindowClosed;

  return {
    ...normalizedSettings,
    paymentOpenDate,
    paymentCloseDate,
    isPaymentWindowOpen: scheduledWindowOpen,
    isPaymentWindowClosed,
    isEnrollClosedForPayments: scheduledWindowOpen || isPaymentWindowClosed || !!forcePayOpen,
    canPayByWindow,
    canPayNow,
    isPaymentOpenByCapacity,
  };
}

export function getCountdownParts(targetDate, now = Date.now()) {
  const targetMs = parsePaymentDate(targetDate)?.getTime();
  if (!targetMs) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalMs = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
