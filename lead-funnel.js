"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function createLeadFunnel(options) {
  const rootDir = path.resolve(options.rootDir);
  const maxBodyBytes = Number.isInteger(options.maxBodyBytes) ? options.maxBodyBytes : 16_384;
  const logSecurity = typeof options.logSecurity === "function" ? options.logSecurity : () => {};

  const config = {
    adminToken: String(process.env.ADMIN_TOKEN || ""),
    hashSalt: String(process.env.LEAD_HASH_SALT || "bembel-racing"),
    minFillMs: toInt(process.env.MIN_FORM_FILL_MS, 2_000, 0, 300_000),
    maxFormAgeMs: toInt(process.env.MAX_FORM_AGE_MS, 86_400_000, 60_000, 30 * 86_400_000),
    formLimitWindowMs: toInt(process.env.FORM_RATE_LIMIT_WINDOW_MS, 900_000, 10_000, 86_400_000),
    formLimitMax: toInt(process.env.FORM_RATE_LIMIT_MAX_REQUESTS, 10, 1, 500),
    formLimitBlockMs: toInt(process.env.FORM_RATE_LIMIT_BLOCK_MS, 3_600_000, 10_000, 86_400_000),
    maxLeadsStored: toInt(process.env.MAX_LEADS_STORED, 5_000, 100, 200_000),
    autoReplyEnabled: process.env.AUTO_REPLY_ENABLED !== "false",
    autoReplyFrom: String(process.env.AUTO_REPLY_FROM || "noreply@bembelracingteam.de"),
    autoReplyReplyTo: String(process.env.AUTO_REPLY_REPLY_TO || "kontakt@bembelracingteam.de"),
    autoReplyWebhookUrl: String(process.env.AUTO_REPLY_WEBHOOK_URL || ""),
    smtpHost: String(process.env.SMTP_HOST || ""),
    smtpPort: toInt(process.env.SMTP_PORT, 587, 1, 65535),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: String(process.env.SMTP_USER || ""),
    smtpPass: String(process.env.SMTP_PASS || ""),
  };

  const leadStorePath = resolveDataPath(rootDir, process.env.LEAD_STORE_FILE || "data/leads.json");
  const outboxLogPath = resolveDataPath(
    rootDir,
    process.env.AUTO_REPLY_LOG_FILE || "data/auto-replies.jsonl"
  );

  const leadTypes = new Set(["contact", "sponsor"]);
  const leadStatuses = new Set(["new", "qualified", "contacted", "won", "lost", "spam"]);
  const contactTopics = new Set(["Sponsoring", "Mitmachen", "Presse", "Sonstiges"]);
  const sponsorPlans = new Set(["Bronze", "Silber", "Gold"]);

  const formRateBuckets = new Map();
  let leadWriteQueue = Promise.resolve();
  let outboxWriteQueue = Promise.resolve();

  void ensureLeadStoreFile(leadStorePath, logSecurity);

  async function handle(req, res, context) {
    const { method, pathname, clientIp } = context;

    if (method === "OPTIONS") {
      return sendJson(req, res, 204, null, {
        Allow: "GET, POST, PATCH, OPTIONS",
        "Cache-Control": "no-store",
      });
    }

    if (pathname === "/api/leads/contact") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "POST, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleContactLead(req, res, clientIp);
    }

    if (pathname === "/api/leads/sponsor") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "POST, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleSponsorLead(req, res, clientIp);
    }

    if (pathname === "/api/admin/session") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "GET, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      if (!requireAdminToken(req, res, config.adminToken)) return true;
      return sendJson(req, res, 200, { ok: true, timestamp: new Date().toISOString() }, { "Cache-Control": "no-store" });
    }

    if (pathname === "/api/admin/leads") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "GET, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      if (!requireAdminToken(req, res, config.adminToken)) return true;
      return handleAdminList(req, res);
    }

    const patchMatch = pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})$/i);
    if (patchMatch) {
      if (method !== "PATCH") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "PATCH, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      if (!requireAdminToken(req, res, config.adminToken)) return true;
      return handleAdminPatch(req, res, patchMatch[1]);
    }

    return false;
  }

  function cleanup() {
    const now = Date.now();
    for (const [key, bucket] of formRateBuckets) {
      const staleWindow = now - bucket.windowStart > config.formLimitWindowMs * 3;
      const blockExpired = bucket.blockedUntil <= now;
      if (staleWindow && blockExpired) {
        formRateBuckets.delete(key);
      }
    }
  }

  return {
    handle,
    cleanup,
  };

  function checkFormRate(ip, formType) {
    const now = Date.now();
    const key = `${formType}:${ip}`;
    let bucket = formRateBuckets.get(key);

    if (!bucket) {
      bucket = { windowStart: now, count: 0, blockedUntil: 0 };
      formRateBuckets.set(key, bucket);
    }

    if (bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
      };
    }

    if (now - bucket.windowStart >= config.formLimitWindowMs) {
      bucket.windowStart = now;
      bucket.count = 0;
    }

    bucket.count += 1;
    if (bucket.count > config.formLimitMax) {
      bucket.blockedUntil = now + config.formLimitBlockMs;
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(config.formLimitBlockMs / 1000)),
      };
    }

    return { allowed: true, retryAfter: 0 };
  }

  async function handleContactLead(req, res, clientIp) {
    try {
      const formRate = checkFormRate(clientIp, "contact");
      if (!formRate.allowed) {
        return sendJson(req, res, 429, { error: "too_many_submissions" }, {
          "Retry-After": String(formRate.retryAfter),
          "Cache-Control": "no-store",
        });
      }

      const body = await readJsonBody(req, maxBodyBytes);
      const normalized = normalizeContactPayload(body, contactTopics);
      const signals = collectSpamSignals({
        honeypot: normalized.honeypot,
        formStartedAt: normalized.formStartedAt,
        message: normalized.message,
        minFillMs: config.minFillMs,
        maxFormAgeMs: config.maxFormAgeMs,
      });

      const lead = await withLeadStoreMutation(leadWriteQueue, async (store) => {
        if (hasDuplicateLead(store.leads, normalized, "contact")) {
          signals.push("duplicate_message");
        }

        const now = new Date().toISOString();
        const status = signals.length > 0 ? "spam" : "new";
        const createdLead = {
          id: crypto.randomUUID(),
          type: "contact",
          status,
          createdAt: now,
          updatedAt: now,
          contact: {
            name: normalized.name,
            email: normalized.email,
            company: "",
            phone: "",
          },
          details: {
            topic: normalized.topic,
            message: normalized.message,
          },
          source: {
            path: normalized.pagePath,
            ipHash: hashSensitive(clientIp, config.hashSalt),
            userAgent: normalizeSingleLine(req.headers["user-agent"], 240),
            referer: normalizeSingleLine(req.headers.referer, 240),
          },
          spamSignals: signals,
          autoReply: {
            status: "pending",
            attempts: 0,
            lastAttemptAt: null,
            lastError: "",
          },
          timeline: [
            {
              at: now,
              actor: "system",
              action: "created",
              note: status === "spam" ? "Automatisch als Spam markiert." : "Kontaktanfrage eingegangen.",
            },
          ],
        };

        store.leads.push(createdLead);
        trimLeadStore(store, config.maxLeadsStored);
        return createdLead;
      }, leadStorePath, logSecurity, (nextQueue) => {
        leadWriteQueue = nextQueue;
      });

      queueAutoReply(lead.id);

      return sendJson(req, res, lead.status === "spam" ? 202 : 201, {
        ok: true,
        leadId: lead.id,
        status: lead.status === "spam" ? "received" : "created",
      }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }

  async function handleSponsorLead(req, res, clientIp) {
    try {
      const formRate = checkFormRate(clientIp, "sponsor");
      if (!formRate.allowed) {
        return sendJson(req, res, 429, { error: "too_many_submissions" }, {
          "Retry-After": String(formRate.retryAfter),
          "Cache-Control": "no-store",
        });
      }

      const body = await readJsonBody(req, maxBodyBytes);
      const normalized = normalizeSponsorPayload(body, sponsorPlans);
      const signals = collectSpamSignals({
        honeypot: normalized.honeypot,
        formStartedAt: normalized.formStartedAt,
        message: normalized.message,
        minFillMs: config.minFillMs,
        maxFormAgeMs: config.maxFormAgeMs,
      });

      const lead = await withLeadStoreMutation(leadWriteQueue, async (store) => {
        if (hasDuplicateLead(store.leads, normalized, "sponsor")) {
          signals.push("duplicate_message");
        }

        const now = new Date().toISOString();
        const status = signals.length > 0 ? "spam" : "new";
        const createdLead = {
          id: crypto.randomUUID(),
          type: "sponsor",
          status,
          createdAt: now,
          updatedAt: now,
          contact: {
            name: normalized.name,
            email: normalized.email,
            company: normalized.company,
            phone: normalized.phone,
          },
          details: {
            selectedPlan: normalized.selectedPlan,
            selectedAmount: normalized.selectedAmount,
            startWindow: normalized.startWindow,
            interests: normalized.interests,
            message: normalized.message,
          },
          source: {
            path: normalized.pagePath,
            ipHash: hashSensitive(clientIp, config.hashSalt),
            userAgent: normalizeSingleLine(req.headers["user-agent"], 240),
            referer: normalizeSingleLine(req.headers.referer, 240),
          },
          spamSignals: signals,
          autoReply: {
            status: "pending",
            attempts: 0,
            lastAttemptAt: null,
            lastError: "",
          },
          timeline: [
            {
              at: now,
              actor: "system",
              action: "created",
              note: status === "spam" ? "Automatisch als Spam markiert." : "Sponsoring-Anfrage eingegangen.",
            },
          ],
        };

        store.leads.push(createdLead);
        trimLeadStore(store, config.maxLeadsStored);
        return createdLead;
      }, leadStorePath, logSecurity, (nextQueue) => {
        leadWriteQueue = nextQueue;
      });

      queueAutoReply(lead.id);

      return sendJson(req, res, lead.status === "spam" ? 202 : 201, {
        ok: true,
        leadId: lead.id,
        status: lead.status === "spam" ? "received" : "created",
      }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }

  async function handleAdminList(req, res) {
    const parsed = new URL(req.url || "/", "http://localhost");
    const filterType = normalizeSingleLine(parsed.searchParams.get("type"), 40).toLowerCase();
    const filterStatus = normalizeSingleLine(parsed.searchParams.get("status"), 40).toLowerCase();
    const query = normalizeSingleLine(parsed.searchParams.get("q"), 120).toLowerCase();

    const limit = toInt(parsed.searchParams.get("limit"), 60, 1, 500);
    const offset = toInt(parsed.searchParams.get("offset"), 0, 0, 1_000_000);

    const store = await readLeadStoreSnapshot(leadWriteQueue, leadStorePath);
    let leads = [...store.leads];

    if (leadTypes.has(filterType)) {
      leads = leads.filter((lead) => lead.type === filterType);
    }
    if (leadStatuses.has(filterStatus)) {
      leads = leads.filter((lead) => lead.status === filterStatus);
    }
    if (query) {
      leads = leads.filter((lead) => leadMatchesQuery(lead, query));
    }

    leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return sendJson(req, res, 200, {
      ok: true,
      total: leads.length,
      offset,
      limit,
      stats: buildLeadStats(store.leads),
      leads: leads.slice(offset, offset + limit).map(projectLeadForAdmin),
    }, { "Cache-Control": "no-store" });
  }

  async function handleAdminPatch(req, res, leadId) {
    try {
      const payload = await readJsonBody(req, maxBodyBytes);
      const nextStatus = normalizeSingleLine(payload.status, 40).toLowerCase();
      const note = normalizeMultiline(payload.note, 500);
      const actor = normalizeSingleLine(payload.actor || "admin", 80) || "admin";

      if (!leadStatuses.has(nextStatus)) {
        return sendJson(req, res, 400, { error: "invalid_status" }, { "Cache-Control": "no-store" });
      }

      const updatedLead = await withLeadStoreMutation(leadWriteQueue, async (store) => {
        const lead = store.leads.find((item) => item.id === leadId);
        if (!lead) return null;

        const now = new Date().toISOString();
        lead.status = nextStatus;
        lead.updatedAt = now;
        if (!Array.isArray(lead.timeline)) lead.timeline = [];
        lead.timeline.push({
          at: now,
          actor,
          action: "status_change",
          note: note || `Status auf '${nextStatus}' gesetzt.`,
        });
        return lead;
      }, leadStorePath, logSecurity, (nextQueue) => {
        leadWriteQueue = nextQueue;
      });

      if (!updatedLead) {
        return sendJson(req, res, 404, { error: "not_found" }, { "Cache-Control": "no-store" });
      }

      return sendJson(req, res, 200, { ok: true, lead: projectLeadForAdmin(updatedLead) }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }

  function queueAutoReply(leadId) {
    setImmediate(() => {
      void dispatchAutoReply(leadId).catch((err) => {
        logSecurity("auto_reply_dispatch_error", sanitize(err.message));
      });
    });
  }

  async function dispatchAutoReply(leadId) {
    const store = await readLeadStoreSnapshot(leadWriteQueue, leadStorePath);
    const lead = store.leads.find((entry) => entry.id === leadId);
    if (!lead) return;

    if (!config.autoReplyEnabled) {
      await markAutoReplyState(leadId, "disabled", "AUTO_REPLY_ENABLED=false", "Auto-Reply deaktiviert.");
      return;
    }

    if (lead.status === "spam") {
      await markAutoReplyState(
        leadId,
        "skipped_spam",
        "lead_marked_as_spam",
        "Auto-Reply wegen Spam-Flag uebersprungen."
      );
      return;
    }

    const recipient = normalizeSingleLine(lead.contact?.email, 220).toLowerCase();
    if (!isValidEmail(recipient)) {
      await markAutoReplyState(
        leadId,
        "failed",
        "invalid_recipient",
        "Auto-Reply fehlgeschlagen: Empfaengeradresse ungueltig."
      );
      return;
    }

    const mail = buildAutoReplyMessage(lead);
    const result = await deliverAutoReplyMessage(
      {
        leadId,
        to: recipient,
        subject: mail.subject,
        text: mail.text,
      },
      config,
      outboxLogPath,
      outboxWriteQueue,
      (nextQueue) => {
        outboxWriteQueue = nextQueue;
      }
    );

    const note =
      result.status === "sent"
        ? `Auto-Reply versendet (${result.transport}).`
        : `Auto-Reply Status: ${result.status}${result.error ? ` (${result.error})` : ""}.`;

    await markAutoReplyState(leadId, result.status, result.error || "", note);
  }

  async function markAutoReplyState(leadId, status, error, note) {
    await withLeadStoreMutation(leadWriteQueue, async (store) => {
      const lead = store.leads.find((entry) => entry.id === leadId);
      if (!lead) return;

      const now = new Date().toISOString();
      if (!lead.autoReply || typeof lead.autoReply !== "object") {
        lead.autoReply = { status: "pending", attempts: 0, lastAttemptAt: null, lastError: "" };
      }

      lead.autoReply.status = status;
      lead.autoReply.attempts = Number(lead.autoReply.attempts || 0) + 1;
      lead.autoReply.lastAttemptAt = now;
      lead.autoReply.lastError = error || "";

      lead.updatedAt = now;
      if (!Array.isArray(lead.timeline)) lead.timeline = [];
      lead.timeline.push({
        at: now,
        actor: "system",
        action: "auto_reply",
        note: note || `Auto-Reply: ${status}`,
      });
    }, leadStorePath, logSecurity, (nextQueue) => {
      leadWriteQueue = nextQueue;
    });
  }
}

module.exports = {
  createLeadFunnel,
};

function requireAdminToken(req, res, adminToken) {
  if (!adminToken) {
    sendJson(req, res, 503, { error: "admin_not_configured" }, { "Cache-Control": "no-store" });
    return false;
  }

  const provided = extractAdminToken(req);
  if (!provided || !timingSafeEqualText(provided, adminToken)) {
    sendJson(req, res, 401, { error: "unauthorized" }, {
      "WWW-Authenticate": "Bearer realm=admin",
      "Cache-Control": "no-store",
    });
    return false;
  }

  return true;
}

function extractAdminToken(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return String(req.headers["x-admin-token"] || "").trim();
}

function timingSafeEqualText(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function sendJson(req, res, statusCode, payload, extraHeaders = {}) {
  if (res.headersSent) return true;

  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }

  res.statusCode = statusCode;
  if (statusCode === 204 || payload === null) {
    return res.end();
  }

  const body = `${JSON.stringify(payload)}\n`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
  return true;
}

function sendApiError(req, res, err) {
  const code = normalizeSingleLine(err?.message || "", 80);
  if (code === "payload_too_large") {
    return sendJson(req, res, 413, { error: "payload_too_large" }, { "Cache-Control": "no-store" });
  }
  if (code === "unsupported_media_type") {
    return sendJson(req, res, 415, { error: "unsupported_media_type" }, { "Cache-Control": "no-store" });
  }
  if (code === "invalid_payload" || code === "empty_body" || code === "invalid_json") {
    return sendJson(req, res, 400, { error: "bad_request" }, { "Cache-Control": "no-store" });
  }
  return sendJson(req, res, 500, { error: "internal_server_error" }, { "Cache-Control": "no-store" });
}

async function readJsonBody(req, maxBodyBytes) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new Error("unsupported_media_type");
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw new Error("payload_too_large");
    }
    chunks.push(chunk);
  }

  if (size === 0) {
    throw new Error("empty_body");
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_json");
  }

  return parsed;
}

async function ensureLeadStoreFile(filePath, logSecurity) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });

  const exists = await fsp
    .access(filePath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (exists) return;

  const initial = { version: 1, leads: [] };
  await fsp.writeFile(filePath, `${JSON.stringify(initial, null, 2)}\n`, "utf8");

  if (typeof logSecurity === "function") {
    logSecurity("lead_store_init", `path=${sanitize(filePath)}`);
  }
}

async function readLeadStore(filePath) {
  await ensureLeadStoreFile(filePath);
  const raw = await fsp.readFile(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { version: 1, leads: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    parsed = { version: 1, leads: [] };
  }
  if (!Array.isArray(parsed.leads)) {
    parsed.leads = [];
  }

  return parsed;
}

async function writeLeadStore(filePath, store) {
  const payload = {
    version: 1,
    leads: Array.isArray(store.leads) ? store.leads : [],
  };

  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fsp.rename(tmp, filePath);
}

function withLeadStoreMutation(queueRef, mutator, filePath, logSecurity, updateQueueRef) {
  const op = async () => {
    try {
      const store = await readLeadStore(filePath);
      const result = await mutator(store);
      await writeLeadStore(filePath, store);
      return result;
    } catch (err) {
      if (typeof logSecurity === "function") {
        logSecurity("lead_store_write_error", sanitize(err.message));
      }
      throw err;
    }
  };

  const next = queueRef.then(op, op);
  updateQueueRef(
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

async function readLeadStoreSnapshot(queueRef, filePath) {
  await queueRef.catch(() => undefined);
  return readLeadStore(filePath);
}

function normalizeContactPayload(payload, topicSet) {
  const name = normalizeSingleLine(payload.name, 120);
  const email = normalizeSingleLine(payload.email, 220).toLowerCase();
  const topicRaw = normalizeSingleLine(payload.topic, 60);
  const message = normalizeMultiline(payload.msg ?? payload.message, 4_000);
  const honeypot = normalizeSingleLine(payload.website, 120);
  const pagePath = normalizePathHint(payload.pagePath);
  const formStartedAt = normalizeNumber(payload.formStartedAt);

  if (!name || !email || !message) {
    throw new Error("invalid_payload");
  }
  if (!isValidEmail(email)) {
    throw new Error("invalid_payload");
  }

  const topic = topicSet.has(topicRaw) ? topicRaw : "Sonstiges";
  return { name, email, topic, message, honeypot, pagePath, formStartedAt };
}

function normalizeSponsorPayload(payload, planSet) {
  const name = normalizeSingleLine(payload.name, 120);
  const company = normalizeSingleLine(payload.company, 160);
  const email = normalizeSingleLine(payload.email, 220).toLowerCase();
  const phone = normalizeSingleLine(payload.phone, 80);
  const selectedPlanRaw = normalizeSingleLine(payload.selectedPlan, 40);
  const selectedAmountRaw = normalizeNumber(payload.selectedAmount);
  const startWindow = normalizeSingleLine(payload.startWindow || "Nach Absprache", 80);
  const message = normalizeMultiline(payload.message, 4_000);
  const honeypot = normalizeSingleLine(payload.website, 120);
  const pagePath = normalizePathHint(payload.pagePath);
  const formStartedAt = normalizeNumber(payload.formStartedAt);

  if (!name || !company || !email) {
    throw new Error("invalid_payload");
  }
  if (!isValidEmail(email)) {
    throw new Error("invalid_payload");
  }

  const selectedPlan = planSet.has(selectedPlanRaw) ? selectedPlanRaw : "Bronze";
  const selectedAmount = Number.isFinite(selectedAmountRaw)
    ? Math.max(300, Math.min(500_000, Math.round(selectedAmountRaw)))
    : 300;

  const interests = Array.isArray(payload.interests)
    ? payload.interests
        .map((entry) => normalizeSingleLine(entry, 80))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  return {
    name,
    company,
    email,
    phone,
    selectedPlan,
    selectedAmount,
    startWindow,
    interests,
    message,
    honeypot,
    pagePath,
    formStartedAt,
  };
}

function collectSpamSignals(input) {
  const signals = [];
  if (input.honeypot) {
    signals.push("honeypot_filled");
  }

  if (Number.isFinite(input.formStartedAt)) {
    const elapsed = Date.now() - input.formStartedAt;
    if (elapsed >= 0 && elapsed < input.minFillMs) {
      signals.push("too_fast");
    }
    if (elapsed > input.maxFormAgeMs) {
      signals.push("stale_form");
    }
  }

  if (countUrls(input.message) >= 4) {
    signals.push("link_flood");
  }

  return signals;
}

function hasDuplicateLead(leads, payload, leadType) {
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60_000;

  return leads.some((lead) => {
    if (!lead || lead.type !== leadType) return false;

    const createdMs = Date.parse(lead.createdAt);
    if (!Number.isFinite(createdMs) || nowMs - createdMs > oneDayMs) {
      return false;
    }

    const sameEmail = normalizeSingleLine(lead.contact?.email, 220).toLowerCase() === payload.email;
    if (!sameEmail) return false;

    const sameMessage =
      normalizeMultiline(lead.details?.message, 4_000) === normalizeMultiline(payload.message, 4_000);
    if (!sameMessage) return false;

    if (leadType === "sponsor") {
      const sameCompany =
        normalizeSingleLine(lead.contact?.company, 160).toLowerCase() ===
        normalizeSingleLine(payload.company, 160).toLowerCase();
      return sameCompany;
    }

    return true;
  });
}

function trimLeadStore(store, maxLeadsStored) {
  if (!Array.isArray(store.leads)) {
    store.leads = [];
    return;
  }

  if (store.leads.length <= maxLeadsStored) return;
  const removeCount = store.leads.length - maxLeadsStored;
  store.leads.splice(0, removeCount);
}

function leadMatchesQuery(lead, query) {
  const haystack = [
    lead.id,
    lead.type,
    lead.status,
    lead.contact?.name,
    lead.contact?.email,
    lead.contact?.company,
    lead.contact?.phone,
    lead.details?.topic,
    lead.details?.selectedPlan,
    lead.details?.startWindow,
    lead.details?.message,
    ...(Array.isArray(lead.details?.interests) ? lead.details.interests : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function buildLeadStats(leads) {
  const stats = {
    total: leads.length,
    byType: { contact: 0, sponsor: 0 },
    byStatus: { new: 0, qualified: 0, contacted: 0, won: 0, lost: 0, spam: 0 },
  };

  for (const lead of leads) {
    if (lead?.type === "contact") stats.byType.contact += 1;
    if (lead?.type === "sponsor") stats.byType.sponsor += 1;
    if (Object.hasOwn(stats.byStatus, lead?.status)) {
      stats.byStatus[lead.status] += 1;
    }
  }

  return stats;
}

function projectLeadForAdmin(lead) {
  return {
    id: lead.id,
    type: lead.type,
    status: lead.status,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    contact: {
      name: lead.contact?.name || "",
      email: lead.contact?.email || "",
      company: lead.contact?.company || "",
      phone: lead.contact?.phone || "",
    },
    details: {
      topic: lead.details?.topic || "",
      message: lead.details?.message || "",
      selectedPlan: lead.details?.selectedPlan || "",
      selectedAmount: lead.details?.selectedAmount || 0,
      startWindow: lead.details?.startWindow || "",
      interests: Array.isArray(lead.details?.interests) ? lead.details.interests : [],
    },
    source: {
      path: lead.source?.path || "",
      ipHash: lead.source?.ipHash || "",
      userAgent: lead.source?.userAgent || "",
      referer: lead.source?.referer || "",
    },
    spamSignals: Array.isArray(lead.spamSignals) ? lead.spamSignals : [],
    autoReply: {
      status: lead.autoReply?.status || "pending",
      attempts: Number(lead.autoReply?.attempts || 0),
      lastAttemptAt: lead.autoReply?.lastAttemptAt || null,
      lastError: lead.autoReply?.lastError || "",
    },
    timeline: Array.isArray(lead.timeline) ? lead.timeline.slice(-12) : [],
  };
}

function buildAutoReplyMessage(lead) {
  const greeting = `Hallo ${lead.contact?.name || "Team"},`;

  if (lead.type === "sponsor") {
    const plan = normalizeSingleLine(lead.details?.selectedPlan, 40) || "-";
    const amount = Number(lead.details?.selectedAmount) || 0;
    return {
      subject: "Danke fuer deine Sponsoring-Anfrage | Bembel Racing Team",
      text: [
        greeting,
        "",
        "danke fuer deine Sponsoring-Anfrage. Wir haben alle Angaben erhalten.",
        "",
        `Paket: ${plan}`,
        `Budget: ${amount > 0 ? `${amount} EUR` : "-"}`,
        "",
        "Wir melden uns kurzfristig mit den naechsten Schritten.",
        "",
        "Beste Gruesse",
        "Bembel Racing Team",
      ].join("\n"),
    };
  }

  const topic = normalizeSingleLine(lead.details?.topic, 60) || "Kontakt";
  return {
    subject: "Danke fuer deine Nachricht | Bembel Racing Team",
    text: [
      greeting,
      "",
      "danke fuer deine Nachricht an das Bembel Racing Team.",
      "",
      `Thema: ${topic}`,
      "",
      "Wir melden uns schnellstmoeglich bei dir.",
      "",
      "Beste Gruesse",
      "Bembel Racing Team",
    ].join("\n"),
  };
}

async function deliverAutoReplyMessage(mail, config, outboxLogPath, outboxQueueRef, updateOutboxQueueRef) {
  const now = new Date().toISOString();

  if (config.autoReplyWebhookUrl) {
    try {
      const response = await fetch(config.autoReplyWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "auto_reply",
          timestamp: now,
          from: config.autoReplyFrom,
          replyTo: config.autoReplyReplyTo,
          leadId: mail.leadId,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`webhook_status_${response.status}`);
      }

      await appendOutboxRecord(
        { at: now, leadId: mail.leadId, to: mail.to, subject: mail.subject, status: "sent", transport: "webhook" },
        outboxLogPath,
        outboxQueueRef,
        updateOutboxQueueRef
      );
      return { status: "sent", transport: "webhook", error: "" };
    } catch (err) {
      await appendOutboxRecord(
        {
          at: now,
          leadId: mail.leadId,
          to: mail.to,
          subject: mail.subject,
          status: "failed",
          transport: "webhook",
          error: sanitize(err.message),
        },
        outboxLogPath,
        outboxQueueRef,
        updateOutboxQueueRef
      );
    }
  }

  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    try {
      const nodemailer = loadNodemailer();
      if (!nodemailer) {
        throw new Error("nodemailer_not_installed");
      }

      const transport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: { user: config.smtpUser, pass: config.smtpPass },
      });

      await transport.sendMail({
        from: config.autoReplyFrom,
        to: mail.to,
        replyTo: config.autoReplyReplyTo,
        subject: mail.subject,
        text: mail.text,
      });

      await appendOutboxRecord(
        { at: now, leadId: mail.leadId, to: mail.to, subject: mail.subject, status: "sent", transport: "smtp" },
        outboxLogPath,
        outboxQueueRef,
        updateOutboxQueueRef
      );

      return { status: "sent", transport: "smtp", error: "" };
    } catch (err) {
      await appendOutboxRecord(
        {
          at: now,
          leadId: mail.leadId,
          to: mail.to,
          subject: mail.subject,
          status: "failed",
          transport: "smtp",
          error: sanitize(err.message),
        },
        outboxLogPath,
        outboxQueueRef,
        updateOutboxQueueRef
      );
      return { status: "failed", transport: "smtp", error: sanitize(err.message) };
    }
  }

  await appendOutboxRecord(
    {
      at: now,
      leadId: mail.leadId,
      to: mail.to,
      subject: mail.subject,
      status: "queued",
      transport: "log_only",
      text: mail.text,
    },
    outboxLogPath,
    outboxQueueRef,
    updateOutboxQueueRef
  );

  return { status: "queued", transport: "log_only", error: "no_delivery_transport_configured" };
}

function appendOutboxRecord(record, outboxLogPath, outboxQueueRef, updateOutboxQueueRef) {
  const op = async () => {
    await fsp.mkdir(path.dirname(outboxLogPath), { recursive: true });
    await fsp.appendFile(outboxLogPath, `${JSON.stringify(record)}\n`, "utf8");
  };

  const next = outboxQueueRef.then(op, op);
  updateOutboxQueueRef(
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

function loadNodemailer() {
  try {
    return require("nodemailer");
  } catch {
    return null;
  }
}

function resolveDataPath(rootDir, relativePath) {
  const absolute = path.resolve(rootDir, String(relativePath || ""));
  const rel = path.relative(rootDir, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("data_path_outside_root");
  }
  return absolute;
}

function hashSensitive(value, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${String(value || "")}`)
    .digest("hex")
    .slice(0, 24);
}

function normalizeSingleLine(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeMultiline(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizePathHint(value) {
  const normalized = normalizeSingleLine(value, 180);
  if (!normalized.startsWith("/")) return "";
  if (normalized.includes("..")) return "";
  return normalized;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function countUrls(text) {
  const matches = String(text || "").match(/(?:https?:\/\/|www\.)/gi);
  return matches ? matches.length : 0;
}

function isValidEmail(value) {
  const email = normalizeSingleLine(value, 220);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitize(value) {
  return String(value || "")
    .replace(/[\r\n]/g, " ")
    .slice(0, 300);
}

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
}
