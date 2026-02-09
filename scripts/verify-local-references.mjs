import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES = ["index.html", "team.html", "sponsoring-anfrage.html", "404.html"];
// Only match real src/href attributes, not custom attributes like data-site-href.
const ATTR_RE = /(?:^|[\s<])(src|href)="([^"]+)"/g;

const missing = [];

for (const page of PAGES) {
  const absolute = path.join(ROOT, page);
  const html = await fs.readFile(absolute, "utf8");

  for (const match of html.matchAll(ATTR_RE)) {
    const ref = String(match[2] || "");
    if (
      !ref ||
      ref.startsWith("#") ||
      ref.startsWith("http://") ||
      ref.startsWith("https://") ||
      ref.startsWith("mailto:") ||
      ref.startsWith("tel:") ||
      ref.startsWith("data:")
    ) {
      continue;
    }

    const clean = ref.split("?")[0].split("#")[0];
    if (!clean || clean.endsWith("/")) continue;

    const resolved = path.resolve(path.dirname(absolute), clean.replace(/^\/+/, ""));
    try {
      await fs.access(resolved);
    } catch {
      missing.push(`${page} -> ${ref}`);
    }
  }
}

if (missing.length > 0) {
  console.error("MISSING_REFERENCES");
  missing.forEach((entry) => console.error(entry));
  process.exitCode = 1;
} else {
  console.log("NO_MISSING_REFERENCES");
}
