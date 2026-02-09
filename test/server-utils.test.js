"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Readable } = require("node:stream");

const { toInt } = require("../lib/server/numbers");
const { normalizeSingleLine, normalizeMultiline, sanitize } = require("../lib/server/text");
const { hashSensitive, timingSafeEqualText } = require("../lib/server/crypto");
const { resolveDataPath } = require("../lib/server/paths");
const { sendJson, sendApiError, readJsonBody } = require("../lib/server/json-http");

function createRes() {
  const headers = {};
  return {
    headersSent: false,
    statusCode: 0,
    body: "",
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    end(body = "") {
      this.body = body;
      return true;
    },
  };
}

function createJsonReq(chunks, contentType = "application/json") {
  const req = Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
  req.headers = { "content-type": contentType };
  return req;
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}

async function main() {
  await run("numbers.toInt keeps integer values in bounds and falls back otherwise", () => {
    assert.equal(toInt("42", 5, 1, 100), 42);
    assert.equal(toInt("0", 5, 1, 100), 5);
    assert.equal(toInt("abc", 5, 1, 100), 5);
  });

  await run("text helpers normalize and sanitize values", () => {
    assert.equal(normalizeSingleLine("  Hallo\nTeam\tBRT  ", 50), "Hallo Team BRT");
    assert.equal(normalizeSingleLine(null, 50), "");
    assert.equal(normalizeMultiline(" \rLine 1\r\nLine 2\r ", 50), "Line 1\nLine 2");
    assert.equal(sanitize("Hallo\r\nWelt"), "Hallo  Welt");
  });

  await run("crypto helpers create stable hashes and safe equality checks", () => {
    const hashA = hashSensitive("secret", "salt-1");
    const hashB = hashSensitive("secret", "salt-1");
    const hashC = hashSensitive("secret", "salt-2");

    assert.equal(hashA, hashB);
    assert.notEqual(hashA, hashC);
    assert.equal(hashA.length, 24);
    assert.equal(timingSafeEqualText("abc", "abc"), true);
    assert.equal(timingSafeEqualText("abc", "def"), false);
  });

  await run("paths.resolveDataPath blocks traversal outside root", () => {
    const rootDir = process.cwd();
    const inside = resolveDataPath(rootDir, "data/leads.json");
    assert.equal(path.relative(rootDir, inside), path.join("data", "leads.json"));
    assert.throws(() => resolveDataPath(rootDir, "../outside.json"), /data_path_outside_root/);
  });

  await run("json-http.sendJson writes JSON response and supports 204", () => {
    const res = createRes();
    sendJson({}, res, 200, { ok: true }, { "Cache-Control": "no-store" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.headers["Content-Type"], "application/json; charset=utf-8");
    assert.equal(JSON.parse(String(res.body)).ok, true);

    const resNoContent = createRes();
    sendJson({}, resNoContent, 204, null);
    assert.equal(resNoContent.statusCode, 204);
    assert.equal(resNoContent.body, "");
  });

  await run("json-http.sendApiError maps known parser errors", () => {
    const res = createRes();
    sendApiError({}, res, new Error("invalid_json"));
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(String(res.body)).error, "bad_request");
  });

  await run("json-http.readJsonBody parses valid JSON and rejects bad payloads", async () => {
    const validReq = createJsonReq(['{"name":"BRT"}']);
    const payload = await readJsonBody(validReq, 128);
    assert.equal(payload.name, "BRT");

    const invalidContentTypeReq = createJsonReq(['{"name":"BRT"}'], "text/plain");
    await assert.rejects(() => readJsonBody(invalidContentTypeReq, 128), /unsupported_media_type/);

    const invalidJsonReq = createJsonReq(["{"]);
    await assert.rejects(() => readJsonBody(invalidJsonReq, 128), /invalid_json/);

    const tooLargeReq = createJsonReq(['{"name":"BRT"}']);
    await assert.rejects(() => readJsonBody(tooLargeReq, 2), /payload_too_large/);
  });

  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  console.log("ALL_SERVER_UTIL_TESTS_PASSED");
}

main().catch((err) => {
  console.error("TEST_RUNNER_CRASH");
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
