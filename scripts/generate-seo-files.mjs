import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const PUBLIC_SEMINAR_STATUSES = ["published", "completed", "interest_only"];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function normalizeBasePath(value) {
  if (!value) return "/";
  let base = value.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

function normalizePublicUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readEnv(mode) {
  const baseEnv = parseEnvFile(path.join(rootDir, ".env"));
  const modeEnv = mode ? parseEnvFile(path.join(rootDir, `.env.${mode}`)) : {};
  return { ...baseEnv, ...modeEnv };
}

function buildAbsoluteUrl(siteUrl, routePath = "/") {
  const normalizedSite = normalizePublicUrl(siteUrl);
  if (!normalizedSite) return "";
  if (!routePath || routePath === "/") return normalizedSite;
  const cleanPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${normalizedSite}${cleanPath}`;
}

function generateRobotsTxt({ siteUrl, indexable }) {
  if (!siteUrl) {
    return ["User-agent: *", "Disallow: /"].join("\n") + "\n";
  }

  if (!indexable) {
    return ["User-agent: *", "Disallow: /"].join("\n") + "\n";
  }

  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${buildAbsoluteUrl(siteUrl, "/sitemap.xml")}`,
  ].join("\n") + "\n";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastMod(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function buildUrlNode({ loc, lastmod = "" }) {
  const lines = ["  <url>", `    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) {
    lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  }
  lines.push("  </url>");
  return lines.join("\n");
}

async function fetchDynamicSeminarRoutes(env, siteUrl, indexable) {
  if (!indexable) return [];

  const supabaseUrl = normalizePublicUrl(env.VITE_SUPABASE_URL);
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!siteUrl || !supabaseUrl || !anonKey) {
    return [];
  }

  try {
    const requestUrl = new URL(`${supabaseUrl}/rest/v1/seminars`);
    requestUrl.searchParams.set("select", "id,created_at,status");
    requestUrl.searchParams.set(
      "or",
      `(${PUBLIC_SEMINAR_STATUSES.map((status) => `status.eq.${status}`).join(",")})`
    );
    requestUrl.searchParams.set("order", "created_at.desc");

    const response = await fetch(requestUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase REST responded with ${response.status}: ${errorText.slice(0, 300)}`
      );
    }

    const seminars = await response.json();
    if (!Array.isArray(seminars)) {
      throw new Error("Unexpected seminars payload");
    }

    return seminars
      .filter(
        (seminar) =>
          seminar?.id &&
          PUBLIC_SEMINAR_STATUSES.includes(String(seminar.status || ""))
      )
      .map((seminar) => ({
        loc: buildAbsoluteUrl(siteUrl, `/seminars/${seminar.id}`),
        lastmod: formatLastMod(seminar.created_at),
      }));
  } catch (error) {
    console.warn(
      `[seo] Dynamic seminar sitemap skipped: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

function generateSitemapXml(siteUrl, entries) {
  const urlNodes = entries
    .map((entry) => buildUrlNode(entry))
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlNodes,
    "</urlset>",
    "",
  ].join("\n");
}

const modeArg = process.argv[2] || "production";
const env = readEnv(modeArg);
const publicUrl = normalizePublicUrl(env.VITE_PUBLIC_URL);
const basePath = normalizeBasePath(env.VITE_BASE_PATH || "/");
const indexable = String(env.VITE_SITE_INDEXABLE || "").toLowerCase() === "true";
const siteUrl = publicUrl || basePath;

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const staticEntries = indexable
  ? [
      { loc: buildAbsoluteUrl(siteUrl, "/") },
      { loc: buildAbsoluteUrl(siteUrl, "/seminars") },
      { loc: buildAbsoluteUrl(siteUrl, "/teachers") },
      { loc: buildAbsoluteUrl(siteUrl, "/privacy") },
      { loc: buildAbsoluteUrl(siteUrl, "/terms") },
      { loc: buildAbsoluteUrl(siteUrl, "/support") },
    ]
  : [];

const dynamicSeminarEntries = await fetchDynamicSeminarRoutes(env, siteUrl, indexable);

fs.writeFileSync(
  path.join(publicDir, "robots.txt"),
  generateRobotsTxt({ siteUrl, indexable }),
  "utf8"
);

fs.writeFileSync(
  path.join(publicDir, "sitemap.xml"),
  generateSitemapXml(siteUrl, [...staticEntries, ...dynamicSeminarEntries]),
  "utf8"
);
