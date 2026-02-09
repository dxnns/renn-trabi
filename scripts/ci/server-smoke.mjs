import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const ROOT_DIR = process.cwd();
const PORT = 4179;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_TOKEN = "ci-admin-token";
const CI_DATA_DIR = path.join(ROOT_DIR, "dist", "ci-data");
const LOG_LIMIT = 120;
const REQUEST_TIMEOUT_MS = 8_000;
const STARTUP_TIMEOUT_MS = 20_000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createLogBuffer() {
  const lines = [];
  return {
    push(prefix, chunk) {
      const text = String(chunk || "").trim();
      if (!text) return;
      for (const line of text.split(/\r?\n/)) {
        lines.push(`${prefix}${line}`);
      }
      while (lines.length > LOG_LIMIT) {
        lines.shift();
      }
    },
    dump() {
      return lines.join("\n");
    },
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "manual",
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "brt-ci-smoke/1.0",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function request(pathname, options = {}) {
  return fetchWithTimeout(`${BASE_URL}${pathname}`, options);
}

async function requestJson(pathname, options = {}) {
  const res = await request(pathname, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

function getFirstSetCookie(headers) {
  if (headers && typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return String(values[0] || "");
    }
  }

  const fallback = String(headers?.get?.("set-cookie") || "");
  return fallback;
}

async function waitForServerReady() {
  const started = Date.now();
  // Server is considered ready when index responds with a 2xx status.
  while (Date.now() - started < STARTUP_TIMEOUT_MS) {
    try {
      const res = await request("/");
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await delay(300);
  }
  throw new Error("Server startup timeout");
}

async function stopServer(proc) {
  if (!proc || proc.exitCode !== null) return;

  proc.kill("SIGTERM");
  for (let i = 0; i < 20; i += 1) {
    if (proc.exitCode !== null) return;
    await delay(100);
  }

  if (proc.exitCode === null) {
    proc.kill("SIGKILL");
  }
}

async function main() {
  await fs.rm(CI_DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(CI_DATA_DIR, { recursive: true });

  const logs = createLogBuffer();
  const serverEnv = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(PORT),
    ADMIN_TOKEN,
    LEAD_STORE_FILE: "dist/ci-data/leads.json",
    RACE_STORE_FILE: "dist/ci-data/race-center.json",
    AUTO_REPLY_LOG_FILE: "dist/ci-data/auto-replies.jsonl",
    AUTO_REPLY_ENABLED: "false",
    FORCE_HTTPS: "false",
  };

  const proc = spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (chunk) => logs.push("[stdout] ", chunk));
  proc.stderr.on("data", (chunk) => logs.push("[stderr] ", chunk));

  try {
    await waitForServerReady();

    const home = await request("/");
    assert(home.status === 200, `GET / expected 200, got ${home.status}`);
    const homeHtml = await home.text();
    assert(
      homeHtml.toLowerCase().includes("bembel racing team"),
      "GET / does not contain expected site marker."
    );
    assert(
      String(home.headers.get("content-security-policy") || "").includes("default-src 'self'"),
      "GET / missing Content-Security-Policy header."
    );
    assert(
      String(home.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      "GET / missing X-Content-Type-Options=nosniff."
    );
    assert(
      String(home.headers.get("x-frame-options") || "").toUpperCase() === "DENY",
      "GET / missing X-Frame-Options=DENY."
    );

    for (const pathname of [
      "/team.html",
      "/sponsoring-anfrage.html",
      "/404.html",
      "/robots.txt",
      "/sitemap.xml",
      "/feed.xml",
      "/manifest.webmanifest",
    ]) {
      const res = await request(pathname);
      assert(res.status === 200, `GET ${pathname} expected 200, got ${res.status}`);
    }

    const notFound = await request("/not-existing-page");
    assert(notFound.status === 404, `GET /not-existing-page expected 404, got ${notFound.status}`);

    for (const apiPath of ["/api/race/feed", "/api/race/summary", "/api/race/polls/active"]) {
      const { res, json } = await requestJson(apiPath);
      assert(res.status === 200, `GET ${apiPath} expected 200, got ${res.status}`);
      assert(json && json.ok === true, `GET ${apiPath} expected { ok: true } response.`);
    }

    const adminSessionGuest = await request("/api/admin/session");
    assert(
      adminSessionGuest.status === 401,
      `GET /api/admin/session (guest) expected 401, got ${adminSessionGuest.status}`
    );

    const login = await requestJson("/api/admin/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
      },
      body: JSON.stringify({ token: ADMIN_TOKEN }),
    });
    assert(login.res.status === 200, `POST /api/admin/session expected 200, got ${login.res.status}`);
    assert(login.json?.ok === true, "POST /api/admin/session expected ok=true.");
    assert(login.json?.csrfToken, "POST /api/admin/session missing csrfToken.");

    const setCookie = getFirstSetCookie(login.res.headers);
    const cookie = setCookie.split(";")[0];
    assert(cookie.includes("="), "POST /api/admin/session missing session cookie.");

    const sessionWithCookie = await requestJson("/api/admin/session", {
      headers: { cookie },
    });
    assert(
      sessionWithCookie.res.status === 200,
      `GET /api/admin/session (cookie) expected 200, got ${sessionWithCookie.res.status}`
    );
    assert(sessionWithCookie.json?.authenticated === true, "Expected authenticated session after login.");

    const contactLead = await requestJson("/api/leads/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "CI Contact",
        email: "ci-contact@example.com",
        topic: "Presse",
        msg: "Kontaktanfrage aus CI-Smoketest.",
        website: "",
        pagePath: "/index.html",
        formStartedAt: Date.now() - 5_000,
      }),
    });
    assert(
      contactLead.res.status === 201 || contactLead.res.status === 202,
      `POST /api/leads/contact expected 201/202, got ${contactLead.res.status}`
    );
    assert(contactLead.json?.leadId, "POST /api/leads/contact missing leadId.");

    const sponsorLead = await requestJson("/api/leads/sponsor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "CI Sponsor",
        company: "CI GmbH",
        email: "ci-sponsor@example.com",
        phone: "+49 000 000",
        selectedPlan: "Silber",
        selectedAmount: 1500,
        startWindow: "Sofort",
        interests: ["Website/Content"],
        message: "Sponsoring-Anfrage aus CI-Smoketest.",
        website: "",
        pagePath: "/sponsoring-anfrage.html",
        formStartedAt: Date.now() - 5_000,
      }),
    });
    assert(
      sponsorLead.res.status === 201 || sponsorLead.res.status === 202,
      `POST /api/leads/sponsor expected 201/202, got ${sponsorLead.res.status}`
    );
    assert(sponsorLead.json?.leadId, "POST /api/leads/sponsor missing leadId.");

    const adminLeads = await requestJson("/api/admin/leads?limit=20", {
      headers: { cookie },
    });
    assert(adminLeads.res.status === 200, `GET /api/admin/leads expected 200, got ${adminLeads.res.status}`);
    assert(Array.isArray(adminLeads.json?.leads), "GET /api/admin/leads missing leads array.");
    assert(
      Number(adminLeads.json?.total || 0) >= 2,
      `GET /api/admin/leads expected at least 2 entries, got ${adminLeads.json?.total}`
    );

    const adminRaceCreate = await requestJson("/api/admin/race/feed", {
      method: "POST",
      headers: {
        authorization: `Bearer ${ADMIN_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        category: "rennen",
        title: "CI Smoke Update",
        body: "Race-Center-Testeintrag aus CI.",
        pollQuestion: "Welche Abstimmung soll getestet werden?",
        pollOptions: ["Option A", "Option B"],
      }),
    });
    assert(
      adminRaceCreate.res.status === 201,
      `POST /api/admin/race/feed expected 201, got ${adminRaceCreate.res.status}`
    );
    const feedItemId = String(adminRaceCreate.json?.item?.id || "");
    const pollId = String(adminRaceCreate.json?.poll?.id || "");
    const pollOptionId = String(adminRaceCreate.json?.poll?.options?.[0]?.id || "");
    assert(feedItemId, "POST /api/admin/race/feed missing item.id.");
    assert(pollId && pollOptionId, "POST /api/admin/race/feed missing poll payload.");

    const react = await requestJson(`/api/race/feed/${feedItemId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reaction: "fire",
        action: "add",
        voterId: "ci-smoke-voter",
      }),
    });
    assert(
      react.res.status === 200,
      `POST /api/race/feed/:id/react expected 200, got ${react.res.status}`
    );
    assert(
      Number(react.json?.item?.reactions?.fire || 0) >= 1,
      "POST /api/race/feed/:id/react did not increment reaction counter."
    );

    const vote = await requestJson(`/api/race/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        optionId: pollOptionId,
        action: "vote",
        voterId: "ci-smoke-voter",
      }),
    });
    assert(
      vote.res.status === 200,
      `POST /api/race/polls/:id/vote expected 200, got ${vote.res.status}`
    );
    assert(
      Number(vote.json?.poll?.totalVotes || 0) >= 1,
      "POST /api/race/polls/:id/vote did not increment total votes."
    );

    const logout = await requestJson("/api/admin/session/logout", {
      method: "POST",
      headers: {
        cookie,
        origin: BASE_URL,
        "x-admin-csrf": String(login.json.csrfToken),
      },
    });
    assert(logout.res.status === 200, `POST /api/admin/session/logout expected 200, got ${logout.res.status}`);
    assert(logout.json?.ok === true, "POST /api/admin/session/logout expected ok=true.");

    const adminAfterLogout = await request("/api/admin/session", {
      headers: { cookie },
    });
    assert(
      adminAfterLogout.status === 401,
      `GET /api/admin/session after logout expected 401, got ${adminAfterLogout.status}`
    );

    console.log("SERVER_SMOKE_OK");
  } catch (err) {
    console.error("SERVER_SMOKE_FAILED");
    console.error(err?.stack || String(err));
    const tail = logs.dump();
    if (tail) {
      console.error("SERVER_LOG_TAIL_BEGIN");
      console.error(tail);
      console.error("SERVER_LOG_TAIL_END");
    }
    process.exitCode = 1;
  } finally {
    await stopServer(proc);
  }
}

main().catch((err) => {
  console.error("SERVER_SMOKE_CRASH");
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
