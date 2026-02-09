import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(THIS_DIR, "..", "..", "..");
export const CONTENT_FILE = path.join(PROJECT_ROOT, "content", "site-content.json");
export const SCHEMA_FILE = path.join(PROJECT_ROOT, "content", "site-content.schema.json");

const SEO_MARKER_START = "<!-- GENERATED:SEO:BEGIN -->";
const SEO_MARKER_END = "<!-- GENERATED:SEO:END -->";

const SEO_PAGE_FILE_MAP = {
  index: "index.html",
  team: "team.html",
  sponsoring: "sponsoring-anfrage.html",
  notFound: "404.html",
};

const MAINPAGE_CONFIG_TARGET = "assets/js/mainpage-config.js";
const SPONSORING_CONFIG_TARGET = "assets/js/sponsoring-config.js";
const MANIFEST_TARGET = "manifest.webmanifest";
const SITEMAP_TARGET = "sitemap.xml";
const FEED_TARGET = "feed.xml";

export async function loadContentAndSchema() {
  const [contentRaw, schemaRaw] = await Promise.all([
    fs.readFile(CONTENT_FILE, "utf8"),
    fs.readFile(SCHEMA_FILE, "utf8"),
  ]);

  return {
    content: JSON.parse(contentRaw),
    schema: JSON.parse(schemaRaw),
  };
}

export function validateContent(content, schema) {
  const errors = [];
  validateBySchema(schema, content, "$", errors, schema);
  validateCustomRules(content, errors);
  return errors;
}

export async function buildArtifacts(content) {
  const artifacts = new Map();

  artifacts.set(MAINPAGE_CONFIG_TARGET, renderGeneratedJsGlobal("BEMBEL_MAINPAGE_CONFIG", content.mainpageConfig));
  artifacts.set(SPONSORING_CONFIG_TARGET, renderGeneratedJsGlobal("BEMBEL_SPONSORING_CONFIG", content.sponsoringConfig));
  artifacts.set(MANIFEST_TARGET, `${JSON.stringify(content.manifest, null, 2)}\n`);
  artifacts.set(SITEMAP_TARGET, renderSitemapXml(content));
  artifacts.set(FEED_TARGET, renderFeedXml(content));

  for (const [seoKey, filePath] of Object.entries(SEO_PAGE_FILE_MAP)) {
    const absolutePath = path.join(PROJECT_ROOT, filePath);
    const source = await fs.readFile(absolutePath, "utf8");
    const seoBlock = renderSeoBlock(content, seoKey);
    artifacts.set(filePath, replaceBetweenMarkers(source, SEO_MARKER_START, SEO_MARKER_END, seoBlock));
  }

  return artifacts;
}

export async function writeArtifacts(artifacts) {
  const changed = [];

  for (const [relativePath, generated] of artifacts) {
    const absolutePath = path.join(PROJECT_ROOT, relativePath);
    const current = await fs.readFile(absolutePath, "utf8").catch(() => "");
    if (current === generated) continue;
    await fs.writeFile(absolutePath, generated, "utf8");
    changed.push(relativePath);
  }

  return changed;
}

export async function checkArtifactDrift(artifacts) {
  const drift = [];

  for (const [relativePath, generated] of artifacts) {
    const absolutePath = path.join(PROJECT_ROOT, relativePath);
    const current = await fs.readFile(absolutePath, "utf8").catch(() => "");
    if (current !== generated) {
      drift.push(relativePath);
    }
  }

  return drift;
}

function validateBySchema(schema, value, valuePath, errors, rootSchema) {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (schema.$ref) {
    const resolved = resolveSchemaRef(rootSchema, schema.$ref);
    if (!resolved) {
      errors.push(`${valuePath}: unresolved $ref ${schema.$ref}`);
      return;
    }
    validateBySchema(resolved, value, valuePath, errors, rootSchema);
    return;
  }

  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matchesType = allowedTypes.some((type) => valueMatchesType(value, type));
    if (!matchesType) {
      errors.push(`${valuePath}: expected type ${allowedTypes.join(" or ")}`);
      return;
    }
  }

  if (Array.isArray(schema.enum)) {
    const inEnum = schema.enum.some((entry) => deepEqual(entry, value));
    if (!inEnum) {
      errors.push(`${valuePath}: value not in enum`);
      return;
    }
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${valuePath}: minLength ${schema.minLength} violated`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${valuePath}: maxLength ${schema.maxLength} violated`);
    }
    if (typeof schema.pattern === "string") {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) {
        errors.push(`${valuePath}: pattern mismatch`);
      }
    }
    if (typeof schema.format === "string") {
      if (!isValidFormat(value, schema.format)) {
        errors.push(`${valuePath}: invalid format ${schema.format}`);
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${valuePath}: minimum ${schema.minimum} violated`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${valuePath}: maximum ${schema.maximum} violated`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${valuePath}: minItems ${schema.minItems} violated`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${valuePath}: maxItems ${schema.maxItems} violated`);
    }
    if (schema.items) {
      value.forEach((entry, idx) => {
        validateBySchema(schema.items, entry, `${valuePath}[${idx}]`, errors, rootSchema);
      });
    }
  }

  if (isPlainObject(value)) {
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required : [];

    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${valuePath}: missing required property "${key}"`);
      }
    }

    for (const [key, propValue] of Object.entries(value)) {
      if (key in properties) {
        validateBySchema(properties[key], propValue, `${valuePath}.${key}`, errors, rootSchema);
        continue;
      }

      if (schema.additionalProperties === false) {
        errors.push(`${valuePath}: additional property "${key}" is not allowed`);
      } else if (isPlainObject(schema.additionalProperties)) {
        validateBySchema(schema.additionalProperties, propValue, `${valuePath}.${key}`, errors, rootSchema);
      }
    }
  }
}

function validateCustomRules(content, errors) {
  const site = content?.site;
  if (!isPlainObject(site)) return;

  const domain = String(site.domain || "");
  if (!domain.startsWith("https://")) {
    errors.push("$.site.domain must start with https://");
  }

  try {
    const parsedDomain = new URL(domain);
    if (parsedDomain.hostname !== "www.bembelracingteam.de") {
      errors.push("$.site.domain must target www.bembelracingteam.de");
    }
  } catch {
    errors.push("$.site.domain must be a valid absolute URL");
  }

  const mainRace = content?.mainpageConfig?.race || {};
  const raceStartLocal = String(mainRace.startLocal || "");
  if (!isValidFormat(raceStartLocal, "date-time")) {
    errors.push("$.mainpageConfig.race.startLocal must be a valid date-time");
  }

  const indexJsonLd = content?.seoPages?.index?.jsonLd;
  const eventNode = Array.isArray(indexJsonLd?.["@graph"])
    ? indexJsonLd["@graph"].find((node) => node && node["@type"] === "Event")
    : null;
  if (eventNode && eventNode.startDate) {
    const eventStart = String(eventNode.startDate);
    const raceDatePart = raceStartLocal.slice(0, 10);
    if (raceDatePart && eventStart !== raceDatePart) {
      errors.push("$.seoPages.index.jsonLd Event.startDate must match mainpageConfig.race.startLocal date");
    }
  }

  const sitemapPaths = new Set(
    (content?.sitemap?.entries || []).map((entry) => String(entry?.path || "")).filter(Boolean)
  );
  for (const [key, seoPage] of Object.entries(content?.seoPages || {})) {
    const pagePath = String(seoPage?.path || "");
    if (!pagePath.startsWith("/")) {
      errors.push(`$.seoPages.${key}.path must start with "/"`);
    }
    if (key !== "notFound" && !sitemapPaths.has(pagePath)) {
      errors.push(`$.seoPages.${key}.path is missing in sitemap.entries`);
    }
  }

  const raceFeed = content?.mainpageConfig?.raceCenter?.feed;
  if (Array.isArray(raceFeed)) {
    for (const [idx, item] of raceFeed.entries()) {
      const category = String(item?.category || "");
      if (!["technik", "rennen", "team"].includes(category)) {
        errors.push(`$.mainpageConfig.raceCenter.feed[${idx}].category is invalid`);
      }
      if (!isValidFormat(String(item?.at || ""), "date-time")) {
        errors.push(`$.mainpageConfig.raceCenter.feed[${idx}].at must be date-time`);
      }
    }
  }

  const sponsoring = content?.sponsoringConfig || {};
  const defaultPlan = String(sponsoring.defaultPlan || "");
  if (!isPlainObject(sponsoring.planMeta) || !isPlainObject(sponsoring.planMeta[defaultPlan])) {
    errors.push("$.sponsoringConfig.defaultPlan must exist in sponsoringConfig.planMeta");
  }

  const range = sponsoring.amountRange || {};
  const min = Number(range.min);
  const max = Number(range.max);
  const step = Number(range.step);
  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    errors.push("$.sponsoringConfig.amountRange.min must be <= max");
  }
  if (Number.isFinite(step) && step <= 0) {
    errors.push("$.sponsoringConfig.amountRange.step must be > 0");
  }
}

function resolveSchemaRef(rootSchema, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    return null;
  }
  const parts = ref.slice(2).split("/");
  let current = rootSchema;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
  }
  return current || null;
}

function valueMatchesType(value, type) {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function isValidFormat(value, format) {
  if (format === "uri") {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  if (format === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  }

  if (format === "date-time") {
    if (!value.includes("T")) return false;
    return Number.isFinite(Date.parse(value));
  }

  return true;
}

function renderGeneratedJsGlobal(globalName, payload) {
  return [
    "/* ===============================",
    "   GENERATED FILE - DO NOT EDIT.",
    "   Source: content/site-content.json",
    "   =============================== */",
    "",
    `window.${globalName} = ${JSON.stringify(payload, null, 2)};`,
    "",
  ].join("\n");
}

function renderSeoBlock(content, seoKey) {
  const site = content.site;
  const page = content.seoPages[seoKey];
  const canonicalUrl = absoluteUrl(site.domain, page.path);
  const ogImage = site.ogImage;
  const og = page.og || {};
  const twitter = page.twitter || {};

  const lines = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeAttr(page.description)}" />`,
    `<meta name="robots" content="${escapeAttr(page.robots)}" />`,
    `<meta name="googlebot" content="${escapeAttr(page.googlebot)}" />`,
    `<meta name="author" content="${escapeAttr(site.author)}" />`,
    `<meta name="theme-color" content="${escapeAttr(site.themeColor)}" />`,
    `<meta name="format-detection" content="${escapeAttr(site.formatDetection)}" />`,
    `<meta name="referrer" content="${escapeAttr(site.referrer)}" />`,
    "",
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
    `<link rel="alternate" hreflang="de" href="${escapeAttr(canonicalUrl)}" />`,
    `<link rel="alternate" hreflang="de-DE" href="${escapeAttr(canonicalUrl)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(canonicalUrl)}" />`,
    "",
    `<meta property="og:locale" content="${escapeAttr(site.locale)}" />`,
    `<meta property="og:site_name" content="${escapeAttr(site.name)}" />`,
    `<meta property="og:title" content="${escapeAttr(og.title || page.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(og.description || page.description)}" />`,
    `<meta property="og:type" content="${escapeAttr(og.type || "website")}" />`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeAttr(ogImage.url)}" />`,
    `<meta property="og:image:secure_url" content="${escapeAttr(ogImage.secureUrl)}" />`,
    `<meta property="og:image:type" content="${escapeAttr(ogImage.type)}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(ogImage.alt)}" />`,
    `<meta property="og:image:width" content="${escapeAttr(String(ogImage.width))}" />`,
    `<meta property="og:image:height" content="${escapeAttr(String(ogImage.height))}" />`,
    "",
    `<meta name="twitter:card" content="${escapeAttr(twitter.card || "summary_large_image")}" />`,
    `<meta name="twitter:title" content="${escapeAttr(twitter.title || page.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(twitter.description || page.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(ogImage.url)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(ogImage.alt)}" />`,
    "",
    "<script type=\"application/ld+json\">",
    indentBlock(JSON.stringify(page.jsonLd, null, 2), "  "),
    "</script>",
  ];

  return indentBlock(lines.join("\n"), "  ");
}

function renderSitemapXml(content) {
  const domain = content.site.domain;
  const entries = Array.isArray(content.sitemap.entries) ? content.sitemap.entries : [];

  const lines = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset",
    "  xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"",
    "  xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"",
    "  xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"",
    ">",
  ];

  entries.forEach((entry, idx) => {
    const url = absoluteUrl(domain, entry.path);
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(url)}</loc>`);
    lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="de" href="${escapeXml(url)}" />`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="de-DE" href="${escapeXml(url)}" />`);
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url)}" />`);
    if (entry.image && entry.image.loc) {
      lines.push("    <image:image>");
      lines.push(`      <image:loc>${escapeXml(entry.image.loc)}</image:loc>`);
      lines.push(`      <image:title>${escapeXml(String(entry.image.title || ""))}</image:title>`);
      lines.push("    </image:image>");
    }
    lines.push("  </url>");
    if (idx !== entries.length - 1) {
      lines.push("");
    }
  });

  lines.push("</urlset>");
  lines.push("");
  return lines.join("\n");
}

function renderFeedXml(content) {
  const feed = content.feed || {};
  const domain = content.site.domain;
  const imageUrl = String(feed.imageUrl || "");
  const items = Array.isArray(feed.items) ? feed.items : [];

  const lines = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\">",
    "  <channel>",
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(absoluteUrl(domain, "/"))}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <language>${escapeXml(feed.language)}</language>`,
    `    <lastBuildDate>${escapeXml(feed.lastBuildDate)}</lastBuildDate>`,
    `    <ttl>${escapeXml(String(feed.ttl))}</ttl>`,
    "    <image>",
    `      <url>${escapeXml(imageUrl)}</url>`,
    `      <title>${escapeXml(feed.title)}</title>`,
    `      <link>${escapeXml(absoluteUrl(domain, "/"))}</link>`,
    "    </image>",
    "",
  ];

  items.forEach((item, idx) => {
    lines.push("    <item>");
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    lines.push(`      <link>${escapeXml(item.link)}</link>`);
    lines.push(`      <description>${escapeXml(item.description)}</description>`);
    lines.push(`      <pubDate>${escapeXml(item.pubDate)}</pubDate>`);
    lines.push(`      <guid isPermaLink=\"true\">${escapeXml(item.guid)}</guid>`);
    lines.push("    </item>");
    if (idx !== items.length - 1) {
      lines.push("");
    }
  });

  lines.push("  </channel>");
  lines.push("</rss>");
  lines.push("");

  return lines.join("\n");
}

function replaceBetweenMarkers(source, startMarker, endMarker, block) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Missing SEO markers (${startMarker} / ${endMarker})`);
  }

  const before = source.slice(0, start + startMarker.length);
  const after = source.slice(end);
  return `${before}\n${block}\n${after}`;
}

function absoluteUrl(domain, pagePath) {
  const cleanDomain = String(domain || "").replace(/\/+$/, "");
  const cleanPath = `/${String(pagePath || "").replace(/^\/+/, "")}`;
  return `${cleanDomain}${cleanPath === "/" ? "/" : cleanPath}`;
}

function indentBlock(text, indent) {
  return String(text)
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((entry, idx) => deepEqual(entry, b[idx]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}
