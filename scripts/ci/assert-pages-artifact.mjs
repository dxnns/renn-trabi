import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const ARTIFACT_DIR = path.join(ROOT_DIR, "dist", "pages");
const ATTR_RE = /(?:^|[\s<])(src|href)="([^"]+)"/g;

const REQUIRED_FILES = [
  ".nojekyll",
  "index.html",
  "404.html",
  "team.html",
  "sponsoring-anfrage.html",
  "robots.txt",
  "sitemap.xml",
  "feed.xml",
  "manifest.webmanifest",
];
const REQUIRED_DIRS = ["assets"];

async function exists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function shouldSkipReference(ref) {
  return (
    !ref ||
    ref.startsWith("#") ||
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("mailto:") ||
    ref.startsWith("tel:") ||
    ref.startsWith("data:") ||
    ref.startsWith("javascript:")
  );
}

function resolveArtifactReference(pageAbsolutePath, ref) {
  const clean = ref.split("?")[0].split("#")[0];
  if (!clean || clean.endsWith("/")) {
    return "";
  }

  if (clean.startsWith("/")) {
    return path.join(ARTIFACT_DIR, clean.replace(/^\/+/, ""));
  }

  return path.resolve(path.dirname(pageAbsolutePath), clean);
}

async function assertRequiredStructure(errors) {
  for (const fileName of REQUIRED_FILES) {
    const absolute = path.join(ARTIFACT_DIR, fileName);
    if (!(await exists(absolute))) {
      errors.push(`Missing required artifact file: ${fileName}`);
    }
  }

  for (const dirName of REQUIRED_DIRS) {
    const absolute = path.join(ARTIFACT_DIR, dirName);
    const stat = await fs.stat(absolute).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      errors.push(`Missing required artifact directory: ${dirName}/`);
    }
  }
}

async function assertHtmlReferences(errors, info) {
  const entries = await fs.readdir(ARTIFACT_DIR, { withFileTypes: true });
  const htmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (htmlFiles.length === 0) {
    errors.push("No HTML files found in artifact root.");
    return;
  }

  info.push(`HTML_FILES=${htmlFiles.length}`);

  for (const fileName of htmlFiles) {
    const absolute = path.join(ARTIFACT_DIR, fileName);
    const html = await fs.readFile(absolute, "utf8");

    if (!html.includes("GENERATED:SEO:BEGIN") || !html.includes("GENERATED:SEO:END")) {
      errors.push(`${fileName}: missing generated SEO marker block.`);
    }
    if (!/<title>[\s\S]*<\/title>/i.test(html)) {
      errors.push(`${fileName}: missing <title> element.`);
    }

    for (const match of html.matchAll(ATTR_RE)) {
      const ref = String(match[2] || "");
      if (shouldSkipReference(ref)) continue;

      const resolved = resolveArtifactReference(absolute, ref);
      if (!resolved) continue;
      if (!isPathInside(ARTIFACT_DIR, resolved)) {
        errors.push(`${fileName}: reference escapes artifact root -> ${ref}`);
        continue;
      }

      if (!(await exists(resolved))) {
        errors.push(`${fileName}: missing referenced file -> ${ref}`);
      }
    }
  }
}

async function assertSpecialFiles(errors, info) {
  const robots = await fs.readFile(path.join(ARTIFACT_DIR, "robots.txt"), "utf8").catch(() => "");
  const sitemap = await fs.readFile(path.join(ARTIFACT_DIR, "sitemap.xml"), "utf8").catch(() => "");
  const feed = await fs.readFile(path.join(ARTIFACT_DIR, "feed.xml"), "utf8").catch(() => "");
  const manifestRaw = await fs.readFile(path.join(ARTIFACT_DIR, "manifest.webmanifest"), "utf8").catch(() => "");

  if (!/sitemap:/i.test(robots)) {
    errors.push("robots.txt: missing sitemap directive.");
  }

  const sitemapLower = sitemap.toLowerCase();
  if (!sitemapLower.includes("<urlset")) {
    errors.push("sitemap.xml: missing <urlset> root.");
  }
  for (const mustContain of ["/", "/team.html", "/sponsoring-anfrage.html"]) {
    if (!sitemap.includes(mustContain)) {
      errors.push(`sitemap.xml: expected path missing -> ${mustContain}`);
    }
  }

  if (!feed.toLowerCase().includes("<rss") || !feed.toLowerCase().includes("<channel")) {
    errors.push("feed.xml: malformed feed root.");
  }

  try {
    const manifest = JSON.parse(manifestRaw);
    if (!manifest || typeof manifest !== "object") {
      errors.push("manifest.webmanifest: invalid JSON object.");
    } else {
      if (!manifest.name || !manifest.short_name) {
        errors.push("manifest.webmanifest: missing name/short_name.");
      }
      if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
        errors.push("manifest.webmanifest: no icons configured.");
      }
    }
  } catch {
    errors.push("manifest.webmanifest: invalid JSON syntax.");
  }

  const cnamePath = path.join(ARTIFACT_DIR, "CNAME");
  if (await exists(cnamePath)) {
    const cname = (await fs.readFile(cnamePath, "utf8")).trim();
    if (!cname) {
      errors.push("CNAME: empty value.");
    } else if (/^https?:\/\//i.test(cname)) {
      errors.push("CNAME: must contain hostname only, not URL.");
    } else if (/\s/.test(cname)) {
      errors.push("CNAME: contains whitespace.");
    } else {
      info.push(`CNAME=${cname}`);
    }
  }
}

async function main() {
  const errors = [];
  const info = [];

  if (!(await exists(ARTIFACT_DIR))) {
    console.error(`Artifact directory not found: ${ARTIFACT_DIR}`);
    process.exitCode = 1;
    return;
  }

  await assertRequiredStructure(errors);
  await assertHtmlReferences(errors, info);
  await assertSpecialFiles(errors, info);

  if (errors.length > 0) {
    console.error("PAGES_ARTIFACT_ASSERT_FAILED");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("PAGES_ARTIFACT_ASSERT_OK");
  info.forEach((line) => console.log(line));
}

main().catch((err) => {
  console.error("PAGES_ARTIFACT_ASSERT_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
