import { normalizeCountryCode } from "./countries";

export function normalizeContactMethod(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeWhatsAppNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export function buildWhatsAppLink(number, message = "") {
  const normalized = normalizeWhatsAppNumber(number).replace(/^\+/, "");
  if (!normalized) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${text}`;
}

export function getContactProfileState(profile, user) {
  const fullName = String(profile?.full_name || user?.user_metadata?.full_name || "").trim();
  const preferredLanguage = String(profile?.preferred_language || "").trim();
  const countryCode = normalizeCountryCode(profile?.country_code);
  const preferredContactMethod = normalizeContactMethod(profile?.preferred_contact_method);
  const phone = String(profile?.phone || "").trim();
  const whatsappNumber = normalizeWhatsAppNumber(profile?.whatsapp_number);
  const whatsappEnabled = profile?.whatsapp_enabled === true || profile?.whatsapp_enabled === "true";
  const allowTeacherContact =
    profile?.allow_teacher_contact === true || profile?.allow_teacher_contact === "true";
  const allowAdminContact =
    profile?.allow_admin_contact === true || profile?.allow_admin_contact === "true";
  const allowStudentContact =
    profile?.allow_student_contact === true || profile?.allow_student_contact === "true";

  const missing = [];

  if (!fullName) missing.push("full_name");
  if (!preferredLanguage) missing.push("preferred_language");
  if (!countryCode) missing.push("country_code");
  if (!preferredContactMethod) missing.push("preferred_contact_method");

  if (preferredContactMethod === "phone" && !phone) {
    missing.push("phone");
  }

  if (preferredContactMethod === "whatsapp") {
    if (!whatsappEnabled) missing.push("whatsapp_enabled");
    if (!whatsappNumber) missing.push("whatsapp_number");
  }

  return {
    fullName,
    preferredLanguage,
    countryCode,
    preferredContactMethod,
    phone,
    whatsappNumber,
    whatsappEnabled,
    allowTeacherContact,
    allowAdminContact,
    allowStudentContact,
    missing,
    isComplete: missing.length === 0,
  };
}

export function buildContactOnboardingUrl(nextUrl = "/") {
  return `/profile?onboarding=contact&next=${encodeURIComponent(nextUrl)}`;
}
