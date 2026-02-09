"use strict";

const { normalizeSingleLine } = require("./text");

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

module.exports = {
  sendJson,
  sendApiError,
  readJsonBody,
};
