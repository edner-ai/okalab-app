import { es, enUS, fr, ht } from "date-fns/locale";

const DATE_FNS_LOCALES = {
  es,
  en: enUS,
  fr,
  ht,
};

const INTL_LOCALES = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  ht: "ht-HT",
};

export function getDateFnsLocale(lang = "es") {
  return DATE_FNS_LOCALES[lang] || es;
}

export function getIntlLocale(lang = "es") {
  const preferred = INTL_LOCALES[lang] || INTL_LOCALES.es;
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat?.supportedLocalesOf) {
    return preferred;
  }

  const candidates = lang === "ht" ? [preferred, "fr-HT", "fr-FR"] : [preferred];
  for (const candidate of candidates) {
    if (Intl.DateTimeFormat.supportedLocalesOf([candidate]).length > 0) {
      return candidate;
    }
  }

  return preferred;
}
