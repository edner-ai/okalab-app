import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = String(import.meta.env.VITE_PUBLIC_URL || "").trim().replace(/\/+$/, "");
const SITE_INDEXABLE = String(import.meta.env.VITE_SITE_INDEXABLE || "").toLowerCase() === "true";

function upsertHeadTag(tagName, matcher, setup) {
  let element = document.head.querySelector(matcher);
  if (!element) {
    element = document.createElement(tagName);
    document.head.appendChild(element);
  }
  setup(element);
}

function resolveCanonicalPath(pathname, search) {
  const params = new URLSearchParams(search || "");

  if (pathname === "/seminardetails") {
    const seminarId = params.get("id");
    if (seminarId) return `/seminars/${seminarId}`;
  }

  return pathname || "/";
}

function isIndexablePath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/seminars" ||
    /^\/seminars\/[^/]+$/.test(pathname) ||
    pathname === "/teachers" ||
    /^\/teachers\/[^/]+$/.test(pathname) ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/support"
  );
}

export default function SeoRouteMeta() {
  const location = useLocation();

  const canonicalPath = useMemo(
    () => resolveCanonicalPath(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const canonicalUrl = useMemo(() => {
    if (!SITE_URL) return "";
    if (canonicalPath === "/") return SITE_URL;
    return `${SITE_URL}${canonicalPath}`;
  }, [canonicalPath]);

  const robotsContent = useMemo(() => {
    if (!SITE_INDEXABLE) return "noindex,nofollow";
    return isIndexablePath(canonicalPath) ? "index,follow" : "noindex,nofollow";
  }, [canonicalPath]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    upsertHeadTag("meta", 'meta[name="robots"]', (element) => {
      element.setAttribute("name", "robots");
      element.setAttribute("content", robotsContent);
    });

    if (canonicalUrl) {
      upsertHeadTag("link", 'link[rel="canonical"]', (element) => {
        element.setAttribute("rel", "canonical");
        element.setAttribute("href", canonicalUrl);
      });
    }
  }, [canonicalUrl, robotsContent]);

  return null;
}
