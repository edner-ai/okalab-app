export const REFERRAL_CODE_KEY = "referral_code";
export const REFERRAL_SEMINAR_KEY = "referral_seminar";
export const REFERRAL_RETURN_URL_KEY = "referral_return_url";

export function getStoredReferralCodeForSeminar(seminarId) {
  if (!seminarId) return null;
  return localStorage.getItem(REFERRAL_SEMINAR_KEY) === String(seminarId)
    ? localStorage.getItem(REFERRAL_CODE_KEY)
    : null;
}

export function buildReferralReturnUrl(pathname, search, referralCode) {
  if (!pathname || !referralCode) return null;
  const params = new URLSearchParams(search || "");
  params.set("ref", referralCode);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function storeReferralState({ seminarId, referralCode, pathname, search }) {
  if (!seminarId || !referralCode) return;
  localStorage.setItem(REFERRAL_CODE_KEY, referralCode);
  localStorage.setItem(REFERRAL_SEMINAR_KEY, String(seminarId));
  const returnUrl = buildReferralReturnUrl(pathname, search, referralCode);
  if (returnUrl) {
    localStorage.setItem(REFERRAL_RETURN_URL_KEY, returnUrl);
  }
}

export function clearReferralStateForSeminar(seminarId) {
  if (!seminarId) return;
  if (localStorage.getItem(REFERRAL_SEMINAR_KEY) !== String(seminarId)) return;
  localStorage.removeItem(REFERRAL_CODE_KEY);
  localStorage.removeItem(REFERRAL_SEMINAR_KEY);
  localStorage.removeItem(REFERRAL_RETURN_URL_KEY);
}

export function getStoredReferralReturnUrl() {
  return localStorage.getItem(REFERRAL_RETURN_URL_KEY);
}

export function clearStoredReferralReturnUrl() {
  localStorage.removeItem(REFERRAL_RETURN_URL_KEY);
}
