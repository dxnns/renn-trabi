"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { createLeadFunnel } = require("./lead-funnel");

const ROOT_DIR = path.resolve(__dirname);
const ASSETS_DIR = path.join(ROOT_DIR, "assets");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = toInt(process.env.PORT, 8080, { min: 1, max: 65535 });

const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const FORCE_HTTPS = process.env.FORCE_HTTPS === "true";
const MAX_URL_LENGTH = toInt(process.env.MAX_URL_LENGTH, 2048, { min: 256, max: 16_384 });
const MAX_CONTENT_LENGTH = toInt(process.env.MAX_CONTENT_LENGTH, 16_384, { min: 0, max: 1024 * 1024 });
const MAX_CONCURRENT_REQUESTS_PER_IP = toInt(
  process.env.MAX_CONCURRENT_REQUESTS_PER_IP,
  24,
  { min: 1, max: 500 }
);

const RATE_LIMIT_WINDOW_MS = toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000, {
  min: 1_000,
  max: 3_600_000,
});
const RATE_LIMIT_MAX_REQUESTS = toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 180, {
  min: 10,
  max: 20_000,
});
const RATE_LIMIT_BLOCK_MS = toInt(process.env.RATE_LIMIT_BLOCK_MS, 10 * 60_000, {
  min: 1_000,
  max: 24 * 60 * 60_000,
});

const REQUEST_TIMEOUT_MS = toInt(process.env.REQUEST_TIMEOUT_MS, 15_000, {
  min: 1_000,
  max: 120_000,
});

const ALLOWED_HOSTS = new Set(
  (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
);

const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PATCH"]);
const STATIC_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PAGE_ROUTES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/team", "team.html"],
  ["/team.html", "team.html"],
  ["/sponsoring-anfrage", "sponsoring-anfrage.html"],
  ["/sponsoring-anfrage.html", "sponsoring-anfrage.html"],
  ["/admin-leads", "admin-leads.html"],
  ["/admin-leads.html", "admin-leads.html"],
]);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const SUSPICIOUS_PATH_PATTERNS = [
  /\/\.git(?:\/|$)/i,
  /\/\.env(?:\.|$)/i,
  /\/wp-admin(?:\/|$)/i,
  /\/wp-login(?:\.|$)/i,
  /\/xmlrpc(?:\.|$)/i,
  /\.(?:php|phtml|asp|aspx|jsp|cgi|pl|py|bak|sql|ini|env)$/i,
];

const RATE_BUCKETS = new Map();
const INFLIGHT_REQUESTS = new Map();

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self' mailto:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
].join("; ");

const leadFunnel = createLeadFunnel({
  rootDir: ROOT_DIR,
  maxBodyBytes: MAX_CONTENT_LENGTH,
  logSecurity,
});

const server = http.createServer(handleRequest);
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS + 5_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(PORT, HOST, () => {
  logInfo(`Secure server running on http://${HOST}:${PORT}`);
  if (FORCE_HTTPS) {
    logInfo("FORCE_HTTPS is enabled. In production use TLS at the reverse proxy.");
  }
  if (ALLOWED_HOSTS.size > 0) {
    logInfo(`Allowed hosts: ${Array.from(ALLOWED_HOSTS).join(", ")}`);
  }
});

server.on("clientError", (err, socket) => {
  const msg = `HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n`;
  socket.end(msg);
  logSecurity("client_error", `message=${sanitize(err.message)}`);
});

setInterval(cleanupStores, 5 * 60_000).unref();

async function handleRequest(req, res) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);
  const method = String(req.method || "").toUpperCase();
  const startedAt = Date.now();

  res.setHeader("X-Request-Id", requestId);
  applySecurityHeaders(res);

  if (!enterInflight(clientIp)) {
    return sendError(req, res, 429, "Too Many Requests", {
      "Retry-After": "60",
      "Cache-Control": "no-store",
    });
  }

  try {
    if (!ALLOWED_METHODS.has(method)) {
      return sendError(req, res, 405, "Method Not Allowed", {
        Allow: "GET, HEAD, OPTIONS, POST, PATCH",
        "Cache-Control": "no-store",
      });
    }

    if (!isAllowedHost(req.headers.host)) {
      logSecurity("host_blocked", `ip=${sanitize(clientIp)} host=${sanitize(req.headers.host || "")}`);
      return sendError(req, res, 400, "Bad Request", { "Cache-Control": "no-store" });
    }

    if (FORCE_HTTPS && !isSecureRequest(req)) {
      const hostHeader = sanitize(req.headers.host || "");
      if (hostHeader) {
        const location = `https://${hostHeader}${req.url || "/"}`;
        res.writeHead(308, {
          Location: location,
          "Cache-Control": "no-store",
        });
        return res.end();
      }
    }

    const contentLengthHeader = req.headers["content-length"];
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        return sendError(req, res, 400, "Bad Request", { "Cache-Control": "no-store" });
      }
      if (contentLength > MAX_CONTENT_LENGTH) {
        return sendError(req, res, 413, "Payload Too Large", { "Cache-Control": "no-store" });
      }
      if ((method === "GET" || method === "HEAD") && contentLength > 0) {
        return sendError(req, res, 400, "Bad Request", { "Cache-Control": "no-store" });
      }
    }

    const rateResult = checkRateLimit(clientIp);
    if (!rateResult.allowed) {
      logSecurity("rate_limited", `ip=${sanitize(clientIp)} retry_after=${rateResult.retryAfter}`);
      return sendError(req, res, 429, "Too Many Requests", {
        "Retry-After": String(rateResult.retryAfter),
        "Cache-Control": "no-store",
      });
    }

    const pathname = parsePathname(req.url || "/");
    if (isSuspiciousPath(pathname)) {
      logSecurity("path_probe", `ip=${sanitize(clientIp)} path=${sanitize(pathname)}`);
      return sendError(req, res, 404, "Not Found", { "Cache-Control": "no-store" });
    }

    if (pathname.startsWith("/api/")) {
      const handled = await leadFunnel.handle(req, res, { method, pathname, clientIp });
      if (handled) return;
      return sendError(req, res, 404, "Not Found", { "Cache-Control": "no-store" });
    }

    if (!STATIC_METHODS.has(method)) {
      return sendError(req, res, 405, "Method Not Allowed", {
        Allow: "GET, HEAD, OPTIONS",
        "Cache-Control": "no-store",
      });
    }

    if (method === "OPTIONS") {
      res.writeHead(204, {
        Allow: "GET, HEAD, OPTIONS",
        "Cache-Control": "no-store",
      });
      return res.end();
    }

    const absoluteFilePath = resolveFilePath(pathname);
    if (!absoluteFilePath) {
      return sendError(req, res, 404, "Not Found", { "Cache-Control": "no-store" });
    }

    const fileStat = await fsp.stat(absoluteFilePath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      return sendError(req, res, 404, "Not Found", { "Cache-Control": "no-store" });
    }

    const ext = path.extname(absoluteFilePath).toLowerCase();
    const contentType = MIME_TYPES.get(ext) || "application/octet-stream";
    const etag = makeWeakEtag(fileStat);
    const ifNoneMatch = req.headers["if-none-match"];

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.writeHead(304, {
        ETag: etag,
        "Last-Modified": fileStat.mtime.toUTCString(),
        "Cache-Control": cacheControlFor(ext),
      });
      return res.end();
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(fileStat.size));
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", fileStat.mtime.toUTCString());
    res.setHeader("Cache-Control", cacheControlFor(ext));

    if (method === "HEAD") {
      res.writeHead(200);
      return res.end();
    }

    const stream = fs.createReadStream(absoluteFilePath);
    stream.on("error", (err) => {
      logSecurity("stream_error", `path=${sanitize(pathname)} msg=${sanitize(err.message)}`);
      if (!res.headersSent) {
        sendError(req, res, 500, "Internal Server Error", { "Cache-Control": "no-store" });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } catch (err) {
    if (err instanceof HttpError) {
      return sendError(req, res, err.statusCode, err.publicMessage, { "Cache-Control": "no-store" });
    }
    logSecurity("request_error", `ip=${sanitize(clientIp)} message=${sanitize(err.message)}`);
    sendError(req, res, 500, "Internal Server Error", { "Cache-Control": "no-store" });
  } finally {
    leaveInflight(clientIp);
    const elapsedMs = Date.now() - startedAt;
    logInfo(`${method} ${sanitize(req.url || "/")} ip=${sanitize(clientIp)} ${res.statusCode} ${elapsedMs}ms`);
  }
}

function applySecurityHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Server", "secure-static");

  if (FORCE_HTTPS) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

function sendError(req, res, statusCode, message, extraHeaders = {}) {
  if (res.headersSent) return;
  for (const [header, value] of Object.entries(extraHeaders)) {
    res.setHeader(header, value);
  }

  const body = `${statusCode} ${message}\n`;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));

  if (String(req.method || "").toUpperCase() === "HEAD") {
    return res.end();
  }
  return res.end(body);
}

function parsePathname(rawUrl) {
  if (rawUrl.length > MAX_URL_LENGTH) {
    throw new HttpError(414, "URI Too Long");
  }
  if (rawUrl.includes("\0")) {
    throw new HttpError(400, "Bad Request");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl, "http://localhost");
  } catch {
    throw new HttpError(400, "Bad Request");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    throw new HttpError(400, "Bad Request");
  }

  if (!decodedPath.startsWith("/")) {
    throw new HttpError(400, "Bad Request");
  }
  if (decodedPath.includes("\\")) {
    throw new HttpError(400, "Bad Request");
  }
  return decodedPath;
}

function resolveFilePath(pathname) {
  if (PAGE_ROUTES.has(pathname)) {
    return path.join(ROOT_DIR, PAGE_ROUTES.get(pathname));
  }

  if (!pathname.startsWith("/assets/")) {
    return null;
  }

  const normalized = path.posix.normalize(pathname);
  if (!normalized.startsWith("/assets/")) {
    return null;
  }

  const pathSegments = normalized.split("/").filter(Boolean);
  for (const segment of pathSegments) {
    if (segment === ".." || segment.startsWith(".")) {
      return null;
    }
  }

  const relativePath = normalized.slice(1).split("/");
  const absolutePath = path.join(ROOT_DIR, ...relativePath);
  if (!isPathInside(ASSETS_DIR, absolutePath)) {
    return null;
  }
  return absolutePath;
}

function isSuspiciousPath(pathname) {
  if (pathname.includes("..")) return true;
  return SUSPICIOUS_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);

  if (!bucket) {
    bucket = {
      windowStart: now,
      count: 0,
      blockedUntil: 0,
    };
    RATE_BUCKETS.set(ip, bucket);
  }

  if (bucket.blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000));
    return { allowed: false, retryAfter };
  }

  if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    bucket.blockedUntil = now + RATE_LIMIT_BLOCK_MS;
    const retryAfter = Math.max(1, Math.ceil(RATE_LIMIT_BLOCK_MS / 1000));
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

function cleanupStores() {
  const now = Date.now();
  for (const [ip, bucket] of RATE_BUCKETS) {
    const staleWindow = now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 3;
    const blockExpired = bucket.blockedUntil <= now;
    if (staleWindow && blockExpired) {
      RATE_BUCKETS.delete(ip);
    }
  }

  for (const [ip, count] of INFLIGHT_REQUESTS) {
    if (count <= 0) {
      INFLIGHT_REQUESTS.delete(ip);
    }
  }

  leadFunnel.cleanup();
}

function enterInflight(ip) {
  const current = INFLIGHT_REQUESTS.get(ip) || 0;
  if (current >= MAX_CONCURRENT_REQUESTS_PER_IP) {
    return false;
  }
  INFLIGHT_REQUESTS.set(ip, current + 1);
  return true;
}

function leaveInflight(ip) {
  const current = INFLIGHT_REQUESTS.get(ip) || 0;
  if (current <= 1) {
    INFLIGHT_REQUESTS.delete(ip);
    return;
  }
  INFLIGHT_REQUESTS.set(ip, current - 1);
}

function isAllowedHost(hostHeader) {
  if (ALLOWED_HOSTS.size === 0) return true;
  const normalizedHost = normalizeHost(hostHeader || "");
  return normalizedHost ? ALLOWED_HOSTS.has(normalizedHost) : false;
}

function normalizeHost(hostHeader) {
  const source = String(hostHeader || "").split(",")[0].trim().toLowerCase();
  if (!source) return "";

  if (source.startsWith("[")) {
    const end = source.indexOf("]");
    if (end === -1) return "";
    return source.slice(0, end + 1);
  }

  const withoutPort = source.split(":")[0];
  return withoutPort;
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwardedFor) return forwardedFor;
  }
  return req.socket.remoteAddress || "unknown";
}

function isSecureRequest(req) {
  if (req.socket.encrypted) return true;
  if (!TRUST_PROXY) return false;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return forwardedProto === "https";
}

function makeWeakEtag(stat) {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

function cacheControlFor(ext) {
  if (ext === ".html") {
    return "no-cache, must-revalidate";
  }
  return "public, max-age=86400, stale-while-revalidate=3600";
}

function isPathInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function sanitize(value) {
  return String(value || "")
    .replace(/[\r\n]/g, " ")
    .slice(0, 300);
}

function toInt(value, fallback, bounds) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < bounds.min || parsed > bounds.max) return fallback;
  return parsed;
}

class HttpError extends Error {
  constructor(statusCode, publicMessage) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

function logInfo(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logSecurity(event, details) {
  console.warn(`[${new Date().toISOString()}] [security:${event}] ${details}`);
}
