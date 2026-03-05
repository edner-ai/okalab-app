function normalizeBasePath(rawPath) {
  const value = String(rawPath || "/").trim();
  if (!value || value === "/") return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function inferBasePathFromWindowPath(pathname) {
  const cleanPath = String(pathname || "/");
  const firstSegment = cleanPath.split("/").filter(Boolean)[0];
  if (!firstSegment) return "/";

  // Fallback defensivo para despliegues en subcarpeta sin .env correcto
  if (/^okalab(?:-beta)?$/i.test(firstSegment)) {
    return `/${firstSegment}`;
  }

  return "/";
}

export function getAppBasePath() {
  const configured = normalizeBasePath(
    import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || "/"
  );
  if (configured !== "/") return configured;

  if (typeof window !== "undefined") {
    return inferBasePathFromWindowPath(window.location.pathname);
  }

  return configured;
}

export function getPublicBaseUrl() {
  const envPublic = String(import.meta.env.VITE_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (envPublic && !/localhost|127\.0\.0\.1/i.test(envPublic)) {
    return envPublic;
  }

  if (typeof window === "undefined") {
    return envPublic;
  }

  const basePath = getAppBasePath();
  return `${window.location.origin}${basePath === "/" ? "" : basePath}`;
}

export function buildPublicAppUrl(pathname = "/") {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getPublicBaseUrl()}${safePath}`;
}
