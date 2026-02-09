import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const REQUEST_TIMEOUT_MS = 15_000;

const CHECKS = [
  { pathname: "/", requiredSnippets: ["bembel racing team", "<title"] },
  { pathname: "/team.html", requiredSnippets: ["<title>team", "bembel racing team"] },
  { pathname: "/sponsoring-anfrage.html", requiredSnippets: ["sponsoring-anfrage", "bembel racing team"] },
  { pathname: "/404.html", requiredSnippets: ["<title>404", "bembel racing team"] },
  { pathname: "/robots.txt", requiredSnippets: ["sitemap:"] },
  { pathname: "/sitemap.xml", requiredSnippets: ["<urlset"] },
  { pathname: "/feed.xml", requiredSnippets: ["<rss"] },
  { pathname: "/manifest.webmanifest", requiredSnippets: ['"name"'] },
];

function withTrailingSlashRemoved(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeHost(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

async function deriveDefaultSiteUrl() {
  const cnamePath = path.join(ROOT_DIR, "CNAME");
  try {
    const cname = (await fs.readFile(cnamePath, "utf8")).trim();
    if (cname) {
      return `https://${normalizeHost(cname)}`;
    }
  } catch {
    // ignore missing CNAME, fallback to repository-derived URL below
  }

  const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
  if (repository.includes("/")) {
    const [owner, repo] = repository.split("/");
    if (owner && repo) {
      return `https://${owner}.github.io/${repo}`;
    }
  }

  throw new Error("Unable to determine SITE_URL. Set SITE_URL explicitly in the workflow.");
}

async function resolveSiteUrl() {
  const configured = withTrailingSlashRemoved(process.env.SITE_URL);
  if (configured) {
    if (!/^https?:\/\//i.test(configured)) {
      throw new Error(`SITE_URL must start with http:// or https://, received: ${configured}`);
    }
    return configured;
  }

  return withTrailingSlashRemoved(await deriveDefaultSiteUrl());
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "brt-pages-health-check/1.0",
      },
    });

    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const siteUrl = await resolveSiteUrl();
  const failures = [];

  console.log(`SITE_URL=${siteUrl}`);

  for (const check of CHECKS) {
    const targetUrl = `${siteUrl}${check.pathname}`;
    try {
      const { response, text } = await fetchText(targetUrl);
      const body = text.toLowerCase();

      if (!response.ok) {
        failures.push(`${check.pathname}: expected HTTP 200..299, got ${response.status}`);
        continue;
      }

      const missingSnippets = check.requiredSnippets.filter((snippet) => !body.includes(snippet));
      if (missingSnippets.length > 0) {
        failures.push(
          `${check.pathname}: missing snippet(s): ${missingSnippets.map((snippet) => JSON.stringify(snippet)).join(", ")}`
        );
        continue;
      }

      console.log(`OK ${check.pathname} (${response.status})`);
    } catch (err) {
      failures.push(`${check.pathname}: request failed: ${err?.message || String(err)}`);
    }
  }

  if (failures.length > 0) {
    console.error("PAGES_HEALTH_CHECK_FAILED");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("PAGES_HEALTH_CHECK_OK");
}

main().catch((err) => {
  console.error("PAGES_HEALTH_CHECK_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
