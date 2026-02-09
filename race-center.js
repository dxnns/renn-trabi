"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, sendApiError, readJsonBody } = require("./lib/server/json-http");
const { normalizeSingleLine, normalizeMultiline, sanitize } = require("./lib/server/text");
const { hashSensitive, timingSafeEqualText } = require("./lib/server/crypto");
const { resolveDataPath } = require("./lib/server/paths");
const { toInt } = require("./lib/server/numbers");

const FEED_CATEGORIES = new Set(["technik", "rennen", "team"]);
const REACTION_KEYS = ["fire", "checkered", "wrench"];

function createRaceCenter(options) {
  const rootDir = path.resolve(options.rootDir);
  const maxBodyBytes = Number.isInteger(options.maxBodyBytes) ? options.maxBodyBytes : 16_384;
  const logSecurity = typeof options.logSecurity === "function" ? options.logSecurity : () => {};

  const config = {
    adminToken: String(process.env.ADMIN_TOKEN || ""),
    hashSalt: String(process.env.RACE_HASH_SALT || process.env.LEAD_HASH_SALT || "bembel-race"),
    maxFeedItems: toInt(process.env.RACE_FEED_MAX_ITEMS, 600, 50, 5_000),
    reactionWindowMs: toInt(process.env.RACE_REACTION_WINDOW_MS, 60_000, 1_000, 3_600_000),
    reactionMax: toInt(process.env.RACE_REACTION_MAX_REQUESTS, 36, 1, 1_000),
    reactionBlockMs: toInt(process.env.RACE_REACTION_BLOCK_MS, 10 * 60_000, 1_000, 86_400_000),
    voteWindowMs: toInt(process.env.RACE_VOTE_WINDOW_MS, 60_000, 1_000, 3_600_000),
    voteMax: toInt(process.env.RACE_VOTE_MAX_REQUESTS, 12, 1, 1_000),
    voteBlockMs: toInt(process.env.RACE_VOTE_BLOCK_MS, 15 * 60_000, 1_000, 86_400_000),
  };

  const raceStorePath = resolveDataPath(rootDir, process.env.RACE_STORE_FILE || "data/race-center.json");
  const reactionBuckets = new Map();
  const voteBuckets = new Map();
  let storeWriteQueue = Promise.resolve();

  void ensureRaceStoreFile(raceStorePath, logSecurity);

  async function handle(req, res, context) {
    const { method, pathname, clientIp } = context;

    if (method === "OPTIONS") {
      return sendJson(req, res, 204, null, {
        Allow: "GET, POST, OPTIONS",
        "Cache-Control": "no-store",
      });
    }

    if (pathname === "/api/race/feed") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "GET, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleGetFeed(req, res);
    }

    if (pathname === "/api/race/summary") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "GET, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleGetSummary(req, res);
    }

    if (pathname === "/api/race/polls/active") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "GET, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleGetActivePolls(req, res);
    }

    const voteMatch = pathname.match(/^\/api\/race\/polls\/([a-z0-9-]{6,80})\/vote$/i);
    if (voteMatch) {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "POST, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleVote(req, res, clientIp, voteMatch[1]);
    }

    const reactMatch = pathname.match(/^\/api\/race\/feed\/([0-9a-f-]{36})\/react$/i);
    if (reactMatch) {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "POST, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      return handleReact(req, res, clientIp, reactMatch[1]);
    }

    if (pathname === "/api/admin/race/feed") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "method_not_allowed" }, {
          Allow: "POST, OPTIONS",
          "Cache-Control": "no-store",
        });
      }
      if (!requireAdminToken(req, res, config.adminToken)) return true;
      return handleAdminCreateFeed(req, res);
    }

    return false;
  }

  function cleanup() {
    cleanupRateStore(reactionBuckets, config.reactionWindowMs);
    cleanupRateStore(voteBuckets, config.voteWindowMs);
  }

  return {
    handle,
    cleanup,
  };

  async function handleGetFeed(req, res) {
    const parsed = new URL(req.url || "/", "http://localhost");
    const sinceMs = parseIsoTimestamp(parsed.searchParams.get("since"));
    const limit = toInt(parsed.searchParams.get("limit"), 24, 1, 100);
    const category = normalizeCategory(parsed.searchParams.get("category"));

    const store = await readRaceStoreSnapshot(storeWriteQueue, raceStorePath);
    const feed = normalizeFeedList(store.feed)
      .filter((item) => !category || item.category === category)
      .filter((item) => !Number.isFinite(sinceMs) || Date.parse(item.at) > sinceMs)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .slice(-limit);

    return sendJson(req, res, 200, {
      ok: true,
      items: feed.map(projectFeedItem),
      serverTime: new Date().toISOString(),
    }, { "Cache-Control": "no-store" });
  }

  async function handleGetSummary(req, res) {
    const store = await readRaceStoreSnapshot(storeWriteQueue, raceStorePath);
    const feed = normalizeFeedList(store.feed).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const latest = feed[0] || null;
    const summary = normalizeSummary(store.summary, latest);

    return sendJson(req, res, 200, {
      ok: true,
      summary: {
        state: summary.state,
        nextMilestone: summary.nextMilestone,
        lastUpdateAt: summary.lastUpdateAt || "",
        lastUpdate: latest
          ? {
              id: latest.id,
              title: latest.title,
              category: latest.category,
              at: latest.at,
            }
          : null,
      },
      serverTime: new Date().toISOString(),
    }, { "Cache-Control": "no-store" });
  }

  async function handleGetActivePolls(req, res) {
    const now = Date.now();
    const store = await readRaceStoreSnapshot(storeWriteQueue, raceStorePath);
    const polls = normalizePolls(store.polls)
      .filter((poll) => isPollActive(poll, now))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(projectPoll);

    return sendJson(req, res, 200, {
      ok: true,
      polls,
      serverTime: new Date().toISOString(),
    }, { "Cache-Control": "no-store" });
  }

  async function handleVote(req, res, clientIp, pollId) {
    const rateResult = checkRateLimit(
      voteBuckets,
      `vote:${clientIp}`,
      config.voteWindowMs,
      config.voteMax,
      config.voteBlockMs
    );

    if (!rateResult.allowed) {
      return sendJson(req, res, 429, { error: "too_many_votes" }, {
        "Retry-After": String(rateResult.retryAfter),
        "Cache-Control": "no-store",
      });
    }

    try {
      const payload = await readJsonBody(req, maxBodyBytes);
      const optionId = normalizeSingleLine(payload.optionId, 80).toLowerCase();
      const voterId = normalizeSingleLine(payload.voterId, 120);
      const actionRaw = normalizeSingleLine(payload.action, 20).toLowerCase();
      const action = actionRaw === "remove" || actionRaw === "toggle" ? actionRaw : "vote";
      if ((action === "vote" || action === "toggle") && !optionId) {
        return sendJson(req, res, 400, { error: "invalid_option" }, { "Cache-Control": "no-store" });
      }

      const voteIdentity = voterId || clientIp;
      const voteHash = hashSensitive(`${pollId}|${voteIdentity}`, config.hashSalt);

      const result = await withRaceStoreMutation(
        storeWriteQueue,
        async (store) => {
          const polls = normalizePolls(store.polls);
          store.polls = polls;

          const poll = polls.find((entry) => entry.id === pollId);
          if (!poll) return { error: "not_found" };
          if (!isPollActive(poll, Date.now())) return { error: "poll_closed", poll };

          if (!poll.votesByVoter || typeof poll.votesByVoter !== "object") {
            poll.votesByVoter = {};
          }
          if (!Array.isArray(poll.voterHashes)) poll.voterHashes = [];

          const selectedOptionId = normalizeSingleLine(poll.votesByVoter[voteHash], 80).toLowerCase();
          const selectedOption = poll.options.find((entry) => entry.id === selectedOptionId) || null;

          const clearVote = () => {
            if (selectedOption) {
              selectedOption.votes = Math.max(0, (Number(selectedOption.votes) || 0) - 1);
            }
            delete poll.votesByVoter[voteHash];
            const hashIdx = poll.voterHashes.indexOf(voteHash);
            if (hashIdx !== -1) {
              poll.voterHashes.splice(hashIdx, 1);
            }
            poll.updatedAt = new Date().toISOString();
            return "";
          };

          if (action === "remove") {
            return { poll, selectedOptionId: clearVote() };
          }

          const option = poll.options.find((entry) => entry.id === optionId);
          if (!option) return { error: "invalid_option", poll, selectedOptionId: selectedOptionId || "" };

          if (action === "toggle" && selectedOptionId === optionId) {
            return { poll, selectedOptionId: clearVote() };
          }

          if (selectedOptionId === optionId) {
            return { error: "already_voted", poll, selectedOptionId: selectedOptionId || "" };
          }

          if (selectedOption) {
            selectedOption.votes = Math.max(0, (Number(selectedOption.votes) || 0) - 1);
          }

          option.votes = Math.max(0, Number(option.votes) || 0) + 1;
          poll.votesByVoter[voteHash] = option.id;
          if (!poll.voterHashes.includes(voteHash)) {
            poll.voterHashes.push(voteHash);
          }
          poll.updatedAt = new Date().toISOString();
          return { poll, selectedOptionId: option.id };
        },
        raceStorePath,
        logSecurity,
        (nextQueue) => {
          storeWriteQueue = nextQueue;
        }
      );

      if (result.error === "not_found") {
        return sendJson(req, res, 404, { error: "poll_not_found" }, { "Cache-Control": "no-store" });
      }
      if (result.error === "poll_closed") {
        return sendJson(req, res, 409, { error: "poll_closed", poll: projectPoll(result.poll), selectedOptionId: result.selectedOptionId || "" }, { "Cache-Control": "no-store" });
      }
      if (result.error === "invalid_option") {
        return sendJson(req, res, 400, { error: "invalid_option", poll: projectPoll(result.poll), selectedOptionId: result.selectedOptionId || "" }, { "Cache-Control": "no-store" });
      }
      if (result.error === "already_voted") {
        return sendJson(req, res, 409, { error: "already_voted", poll: projectPoll(result.poll), selectedOptionId: result.selectedOptionId || "" }, { "Cache-Control": "no-store" });
      }

      return sendJson(req, res, 200, { ok: true, poll: projectPoll(result.poll), selectedOptionId: result.selectedOptionId || "" }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }

  async function handleReact(req, res, clientIp, feedItemId) {
    const rateResult = checkRateLimit(
      reactionBuckets,
      `react:${clientIp}`,
      config.reactionWindowMs,
      config.reactionMax,
      config.reactionBlockMs
    );

    if (!rateResult.allowed) {
      return sendJson(req, res, 429, { error: "too_many_reactions" }, {
        "Retry-After": String(rateResult.retryAfter),
        "Cache-Control": "no-store",
      });
    }

    try {
      const payload = await readJsonBody(req, maxBodyBytes);
      const reaction = normalizeSingleLine(payload.reaction, 40).toLowerCase();
      const voterId = normalizeSingleLine(payload.voterId, 120);
      const actionRaw = normalizeSingleLine(payload.action, 20).toLowerCase();
      const action = actionRaw === "remove" || actionRaw === "toggle" ? actionRaw : "add";

      if (!REACTION_KEYS.includes(reaction)) {
        return sendJson(req, res, 400, { error: "invalid_reaction" }, { "Cache-Control": "no-store" });
      }

      const reactIdentity = voterId || clientIp;
      const reactHash = hashSensitive(`${feedItemId}|${reaction}|${reactIdentity}`, config.hashSalt);

      const result = await withRaceStoreMutation(
        storeWriteQueue,
        async (store) => {
          const feed = normalizeFeedList(store.feed);
          store.feed = feed;
          const item = feed.find((entry) => entry.id === feedItemId);
          if (!item) return { error: "not_found" };

          if (!item.reactions || typeof item.reactions !== "object") {
            item.reactions = emptyReactions();
          }
          if (!item.reactionVoters || typeof item.reactionVoters !== "object") {
            item.reactionVoters = {};
          }
          if (!Array.isArray(item.reactionVoters[reaction])) {
            item.reactionVoters[reaction] = [];
          }

          const voterHashes = item.reactionVoters[reaction];
          const existingIndex = voterHashes.indexOf(reactHash);
          const alreadyReacted = existingIndex !== -1;

          if (action === "add") {
            if (alreadyReacted) {
              return { error: "already_reacted", item, reacted: true };
            }
            voterHashes.push(reactHash);
            item.reactions[reaction] = Math.max(0, Number(item.reactions[reaction]) || 0) + 1;
            return { item, reacted: true };
          }

          if (action === "remove") {
            if (alreadyReacted) {
              voterHashes.splice(existingIndex, 1);
              item.reactions[reaction] = Math.max(0, (Number(item.reactions[reaction]) || 0) - 1);
            }
            return { item, reacted: false };
          }

          if (alreadyReacted) {
            voterHashes.splice(existingIndex, 1);
            item.reactions[reaction] = Math.max(0, (Number(item.reactions[reaction]) || 0) - 1);
            return { item, reacted: false };
          }

          voterHashes.push(reactHash);
          item.reactions[reaction] = Math.max(0, Number(item.reactions[reaction]) || 0) + 1;
          return { item, reacted: true };
        },
        raceStorePath,
        logSecurity,
        (nextQueue) => {
          storeWriteQueue = nextQueue;
        }
      );

      if (result.error === "not_found") {
        return sendJson(req, res, 404, { error: "update_not_found" }, { "Cache-Control": "no-store" });
      }
      if (result.error === "already_reacted") {
        return sendJson(req, res, 409, { error: "already_reacted", item: projectFeedItem(result.item), reacted: true }, { "Cache-Control": "no-store" });
      }

      return sendJson(req, res, 200, { ok: true, item: projectFeedItem(result.item), reacted: Boolean(result.reacted) }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }

  async function handleAdminCreateFeed(req, res) {
    try {
      const payload = await readJsonBody(req, maxBodyBytes);
      const category = normalizeCategory(payload.category) || "rennen";
      const title = normalizeSingleLine(payload.title, 120);
      const body = normalizeMultiline(payload.body, 2_000);
      const state = normalizeSingleLine(payload.state, 80);
      const nextMilestone = normalizeSingleLine(payload.nextMilestone, 180);
      const atInput = normalizeSingleLine(payload.at, 80);
      const createdAt = parseIsoTimestamp(atInput);
      const at = Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString();

      if (!title || !body) {
        return sendJson(req, res, 400, { error: "invalid_payload" }, { "Cache-Control": "no-store" });
      }

      const pollQuestion = normalizeSingleLine(payload.pollQuestion, 240);
      const pollOptions = Array.isArray(payload.pollOptions)
        ? payload.pollOptions
            .map((entry) => normalizeSingleLine(entry, 120))
            .filter(Boolean)
            .slice(0, 6)
        : [];

      const result = await withRaceStoreMutation(
        storeWriteQueue,
        async (store) => {
          const feed = normalizeFeedList(store.feed);
          const nowIso = new Date().toISOString();
          const item = {
            id: crypto.randomUUID(),
            category,
            title,
            body,
            at,
            createdAt: nowIso,
            reactions: emptyReactions(),
            reactionVoters: {},
          };

          feed.push(item);
          while (feed.length > config.maxFeedItems) {
            feed.shift();
          }
          store.feed = feed;

          const summary = normalizeSummary(store.summary, item);
          summary.lastUpdateAt = item.at;
          if (state) summary.state = state;
          if (nextMilestone) summary.nextMilestone = nextMilestone;
          store.summary = summary;

          let poll = null;
          if (pollQuestion && pollOptions.length >= 2) {
            const uniqueLabels = [];
            const seenLabels = new Set();
            pollOptions.forEach((label) => {
              const key = label.toLowerCase();
              if (seenLabels.has(key)) return;
              seenLabels.add(key);
              uniqueLabels.push(label);
            });

            if (uniqueLabels.length >= 2) {
              const usedOptionIds = new Set();
              const options = uniqueLabels.map((label) => {
                let optionId = slugify(label);
                let suffix = 2;
                while (usedOptionIds.has(optionId)) {
                  optionId = `${optionId}-${suffix}`;
                  suffix += 1;
                }
                usedOptionIds.add(optionId);
                return {
                  id: optionId,
                  label,
                  votes: 0,
                };
              });

              const polls = normalizePolls(store.polls);
              poll = {
                id: crypto.randomUUID(),
                question: pollQuestion,
                status: "active",
                createdAt: nowIso,
                updatedAt: nowIso,
                expiresAt: "",
                options,
                voterHashes: [],
                votesByVoter: {},
              };
              polls.unshift(poll);
              store.polls = polls.slice(0, 30);
            }
          }

          return { item, poll, summary };
        },
        raceStorePath,
        logSecurity,
        (nextQueue) => {
          storeWriteQueue = nextQueue;
        }
      );

      return sendJson(req, res, 201, {
        ok: true,
        item: projectFeedItem(result.item),
        poll: result.poll ? projectPoll(result.poll) : null,
        summary: {
          state: result.summary.state,
          nextMilestone: result.summary.nextMilestone,
          lastUpdateAt: result.summary.lastUpdateAt || "",
        },
      }, { "Cache-Control": "no-store" });
    } catch (err) {
      return sendApiError(req, res, err);
    }
  }
}

module.exports = {
  createRaceCenter,
};

function checkRateLimit(store, key, windowMs, maxRequests, blockMs) {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket) {
    bucket = {
      windowStart: now,
      count: 0,
      blockedUntil: 0,
    };
    store.set(key, bucket);
  }

  if (bucket.blockedUntil > now) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
    };
  }

  if (now - bucket.windowStart >= windowMs) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) {
    bucket.blockedUntil = now + blockMs;
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil(blockMs / 1000)),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

function cleanupRateStore(store, windowMs) {
  const now = Date.now();
  for (const [key, bucket] of store) {
    const staleWindow = now - bucket.windowStart > windowMs * 3;
    const blockExpired = bucket.blockedUntil <= now;
    if (staleWindow && blockExpired) {
      store.delete(key);
    }
  }
}

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

async function ensureRaceStoreFile(filePath, logSecurity) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });

  const exists = await fsp
    .access(filePath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (exists) return;

  const initial = createInitialRaceStore();
  await fsp.writeFile(filePath, `${JSON.stringify(initial, null, 2)}\n`, "utf8");

  if (typeof logSecurity === "function") {
    logSecurity("race_store_init", `path=${sanitize(filePath)}`);
  }
}

function createInitialRaceStore() {
  return {
    version: 1,
    summary: {
      state: "In Vorbereitung",
      nextMilestone: "Naechster Meilenstein folgt",
      lastUpdateAt: "",
    },
    feed: [],
    polls: [],
  };
}

async function readRaceStore(filePath) {
  await ensureRaceStoreFile(filePath, () => {});
  const raw = await fsp.readFile(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = createInitialRaceStore();
  }

  if (!parsed || typeof parsed !== "object") {
    parsed = createInitialRaceStore();
  }

  parsed = migrateLegacySeedData(parsed);

  parsed.summary = normalizeSummary(parsed.summary, null);
  parsed.feed = normalizeFeedList(parsed.feed);
  parsed.polls = normalizePolls(parsed.polls);
  return parsed;
}

function migrateLegacySeedData(store) {
  if (!store || typeof store !== "object") return createInitialRaceStore();

  const seedFeedTitles = new Set([
    "Setup-Check abgeschlossen",
    "Pit-Ablauf geprobt",
    "Anreisefenster fix",
  ]);
  const seedPollQuestion = "Was soll im naechsten Setup-Update im Fokus stehen?";

  const feed = Array.isArray(store.feed) ? store.feed : [];
  const polls = Array.isArray(store.polls) ? store.polls : [];

  const shouldStripFeed =
    feed.length > 0 &&
    feed.length <= 3 &&
    feed.every((item) => seedFeedTitles.has(normalizeSingleLine(item?.title, 120)));
  const shouldStripPolls =
    polls.length > 0 &&
    polls.length <= 2 &&
    polls.every((poll) => normalizeSingleLine(poll?.question, 240) === seedPollQuestion);

  if (shouldStripFeed) {
    store.feed = [];
  }
  if (shouldStripPolls) {
    store.polls = [];
  }
  if (shouldStripFeed || shouldStripPolls) {
    const summary = store.summary && typeof store.summary === "object" ? store.summary : {};
    if (normalizeSingleLine(summary.nextMilestone, 180) === "Transport, Pit-Setup und Abnahme") {
      summary.nextMilestone = "Naechster Meilenstein folgt";
    }
    if (shouldStripFeed) {
      summary.lastUpdateAt = "";
    }
    store.summary = summary;
  }

  return store;
}

async function writeRaceStore(filePath, store) {
  const payload = {
    version: 1,
    summary: normalizeSummary(store.summary, null),
    feed: normalizeFeedList(store.feed),
    polls: normalizePolls(store.polls),
  };

  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fsp.rename(tmp, filePath);
}

function withRaceStoreMutation(queueRef, mutator, filePath, logSecurity, updateQueueRef) {
  const op = async () => {
    try {
      const store = await readRaceStore(filePath);
      const result = await mutator(store);
      await writeRaceStore(filePath, store);
      return result;
    } catch (err) {
      if (typeof logSecurity === "function") {
        logSecurity("race_store_write_error", sanitize(err.message));
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

async function readRaceStoreSnapshot(queueRef, filePath) {
  await queueRef.catch(() => undefined);
  return readRaceStore(filePath);
}

function normalizeSummary(summary, fallbackLatest) {
  const safe = summary && typeof summary === "object" ? summary : {};
  const fallbackAt = fallbackLatest?.at || "";
  return {
    state: normalizeSingleLine(safe.state, 80) || "In Vorbereitung",
    nextMilestone: normalizeSingleLine(safe.nextMilestone, 180) || "Naechster Boxen-Check",
    lastUpdateAt: normalizeSingleLine(safe.lastUpdateAt, 80) || fallbackAt,
  };
}

function normalizeFeedList(feed) {
  if (!Array.isArray(feed)) return [];
  return feed
    .map((entry) => {
      const id = normalizeSingleLine(entry?.id, 80);
      const title = normalizeSingleLine(entry?.title, 120);
      const body = normalizeMultiline(entry?.body, 2_000);
      if (!id || !title || !body) return null;

      const atMs = parseIsoTimestamp(entry?.at);
      const createdMs = parseIsoTimestamp(entry?.createdAt);
      const at = Number.isFinite(atMs) ? new Date(atMs).toISOString() : new Date().toISOString();
      const createdAt = Number.isFinite(createdMs) ? new Date(createdMs).toISOString() : at;

      const reactions = emptyReactions();
      if (entry?.reactions && typeof entry.reactions === "object") {
        for (const key of REACTION_KEYS) {
          reactions[key] = Math.max(0, Number(entry.reactions[key]) || 0);
        }
      }

      const reactionVoters = {};
      if (entry?.reactionVoters && typeof entry.reactionVoters === "object") {
        for (const key of REACTION_KEYS) {
          const hashes = Array.isArray(entry.reactionVoters[key]) ? entry.reactionVoters[key] : [];
          reactionVoters[key] = hashes
            .map((hash) => normalizeSingleLine(hash, 90))
            .filter(Boolean)
            .slice(0, 50_000);
        }
      }

      return {
        id,
        category: normalizeCategory(entry?.category) || "rennen",
        title,
        body,
        at,
        createdAt,
        reactions,
        reactionVoters,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function normalizePolls(polls) {
  if (!Array.isArray(polls)) return [];
  return polls
    .map((poll) => {
      const id = normalizeSingleLine(poll?.id, 80);
      const question = normalizeSingleLine(poll?.question, 240);
      if (!id || !question) return null;

      const options = Array.isArray(poll.options)
        ? poll.options
            .map((option) => {
              const optionId = normalizeSingleLine(option?.id, 80).toLowerCase();
              const label = normalizeSingleLine(option?.label, 120);
              if (!optionId || !label) return null;
              return {
                id: optionId,
                label,
                votes: Math.max(0, Number(option.votes) || 0),
              };
            })
            .filter(Boolean)
            .slice(0, 8)
        : [];

      if (options.length < 2) return null;

      const statusRaw = normalizeSingleLine(poll?.status, 20).toLowerCase();
      const status = statusRaw === "closed" ? "closed" : "active";

      const createdMs = parseIsoTimestamp(poll?.createdAt);
      const updatedMs = parseIsoTimestamp(poll?.updatedAt);
      const expiresMs = parseIsoTimestamp(poll?.expiresAt);

      const voterHashes = Array.isArray(poll?.voterHashes)
        ? poll.voterHashes
            .map((value) => normalizeSingleLine(value, 90))
            .filter(Boolean)
            .slice(0, 200_000)
        : [];

      const optionIdSet = new Set(options.map((entry) => entry.id));
      const votesByVoter = {};
      if (poll?.votesByVoter && typeof poll.votesByVoter === "object") {
        for (const [hash, votedOption] of Object.entries(poll.votesByVoter)) {
          const voterHash = normalizeSingleLine(hash, 90);
          const votedOptionId = normalizeSingleLine(votedOption, 80).toLowerCase();
          if (!voterHash || !optionIdSet.has(votedOptionId)) continue;
          votesByVoter[voterHash] = votedOptionId;
        }
      }

      return {
        id,
        question,
        status,
        createdAt: Number.isFinite(createdMs) ? new Date(createdMs).toISOString() : new Date().toISOString(),
        updatedAt: Number.isFinite(updatedMs)
          ? new Date(updatedMs).toISOString()
          : Number.isFinite(createdMs)
            ? new Date(createdMs).toISOString()
            : new Date().toISOString(),
        expiresAt: Number.isFinite(expiresMs) ? new Date(expiresMs).toISOString() : "",
        options,
        voterHashes,
        votesByVoter,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function projectFeedItem(item) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    body: item.body,
    at: item.at,
    createdAt: item.createdAt,
    reactions: {
      fire: Math.max(0, Number(item.reactions?.fire) || 0),
      checkered: Math.max(0, Number(item.reactions?.checkered) || 0),
      wrench: Math.max(0, Number(item.reactions?.wrench) || 0),
    },
  };
}

function projectPoll(poll) {
  const options = Array.isArray(poll.options) ? poll.options : [];
  const totalVotes = options.reduce((sum, entry) => sum + Math.max(0, Number(entry.votes) || 0), 0);
  return {
    id: poll.id,
    question: poll.question,
    status: poll.status,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    expiresAt: poll.expiresAt || "",
    totalVotes,
    options: options.map((entry) => ({
      id: entry.id,
      label: entry.label,
      votes: Math.max(0, Number(entry.votes) || 0),
    })),
  };
}

function isPollActive(poll, nowMs) {
  if (poll.status !== "active") return false;
  const expiresMs = parseIsoTimestamp(poll.expiresAt);
  if (!Number.isFinite(expiresMs)) return true;
  return expiresMs > nowMs;
}

function normalizeCategory(value) {
  const normalized = normalizeSingleLine(value, 20).toLowerCase();
  return FEED_CATEGORIES.has(normalized) ? normalized : "";
}

function emptyReactions() {
  return {
    fire: 0,
    checkered: 0,
    wrench: 0,
  };
}

function parseIsoTimestamp(value) {
  const normalized = normalizeSingleLine(value, 80);
  if (!normalized) return Number.NaN;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function slugify(value) {
  const normalized = normalizeSingleLine(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || crypto.randomUUID().slice(0, 8);
}
