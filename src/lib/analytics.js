const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();

let gaInitialized = false;

function ensureGtag() {
  if (typeof window === "undefined") return false;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  return true;
}

export function isAnalyticsEnabled() {
  return !!GA_MEASUREMENT_ID;
}

export function loadGoogleAnalytics() {
  if (!isAnalyticsEnabled() || typeof document === "undefined") return false;
  if (!ensureGtag()) return false;
  if (gaInitialized) return true;

  const existingScript = document.querySelector(`script[data-ga-measurement-id="${GA_MEASUREMENT_ID}"]`);

  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    script.dataset.gaMeasurementId = GA_MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
  });

  gaInitialized = true;
  return true;
}

export function trackPageView({ path, title, location } = {}) {
  if (!loadGoogleAnalytics() || typeof window === "undefined") return;

  window.gtag("event", "page_view", {
    page_path: path || window.location.pathname + window.location.search,
    page_title: title || document.title,
    page_location: location || window.location.href,
  });
}

export function trackEvent(eventName, params = {}) {
  if (!loadGoogleAnalytics() || typeof window === "undefined" || !eventName) return;
  window.gtag("event", eventName, params);
}

export { GA_MEASUREMENT_ID };
