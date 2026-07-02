"use strict";

// ---------------------------------------------------------------------------
// Module: security
// CORS, rate limiting, client key validation, security headers
// ---------------------------------------------------------------------------

const constants = require("./constants.js");
const { normalizeText, httpError, envInteger } = require("./validation.js");

const rateLimitBuckets = new Map();

const RATE_LIMIT_WINDOW_MS = envInteger("PROJECTS_RATE_LIMIT_WINDOW_MS", 60 * 1000, 1000, 60 * 60 * 1000);
const RATE_LIMIT_API_REQUESTS = envInteger("PROJECTS_RATE_LIMIT_API_REQUESTS", 1200, 1, 100000);
const RATE_LIMIT_SOURCE_WRITE_REQUESTS = envInteger("PROJECTS_RATE_LIMIT_SOURCE_WRITE_REQUESTS", 600, 1, 100000);
const RATE_LIMIT_STATE_WRITE_REQUESTS = envInteger("PROJECTS_RATE_LIMIT_STATE_WRITE_REQUESTS", 120, 1, 100000);

const EXPLICIT_CORS_ORIGINS = parseCorsOrigins([
  process.env.PROJECTS_PUBLIC_ORIGIN,
  process.env.PROJECTS_ALLOWED_ORIGINS
].filter(Boolean).join(","));

function isApiPathname(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isGeneratedClientStateKey(value) {
  return /^demo-(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{22})$/iu.test(value)
    || isSyncStateKey(value);
}

function isSyncStateKey(value) {
  return /^sync-[A-Za-z0-9_-]{43}$/u.test(value);
}

function stateKeyForRequest(request) {
  const value = normalizeText(request.headers[constants.API_CLIENT_HEADER], 120);
  if (isGeneratedClientStateKey(value)) {
    return value;
  }

  throw httpError(400, `Missing or invalid ${constants.API_CLIENT_HEADER} header.`);
}

function stateWriteKeyForRequest(request) {
  const stateKey = stateKeyForRequest(request);
  enforceStateWriteRateLimit(request, stateKey);
  return stateKey;
}

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "media-src 'none'",
    "manifest-src 'none'",
    "connect-src 'self'",
    "form-action 'none'"
  ].join("; ");
}

// --- CORS ---

function normalizedCorsOrigin(value) {
  const text = normalizeText(value, 300);
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function parseCorsOrigins(value) {
  return new Set(
    String(value || "")
      .split(/[\s,]+/u)
      .map((origin) => normalizedCorsOrigin(origin))
      .filter(Boolean)
  );
}

function isCorsRequestAllowed(request) {
  const origin = normalizedCorsOrigin(request.headers.origin);
  return (!origin || Boolean(allowedCorsOrigin(origin, request)))
    && isPreflightMethodAllowed(request)
    && arePreflightHeadersAllowed(request);
}

function corsHeadersForRequest(request) {
  if (!request) {
    return {};
  }

  const origin = normalizedCorsOrigin(request.headers.origin);
  const allowedOrigin = allowedCorsOrigin(origin, request);
  if (!allowedOrigin) {
    return {};
  }

  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": constants.CORS_ALLOWED_METHODS,
    "access-control-allow-headers": constants.CORS_ALLOWED_HEADERS,
    "access-control-max-age": "600"
  };
}

function allowedCorsOrigin(origin, request) {
  if (!origin) {
    return "";
  }
  if (EXPLICIT_CORS_ORIGINS.has(origin)) {
    return origin;
  }
  return isSameHostOrigin(origin, request) ? origin : "";
}

function isSameHostOrigin(origin, request) {
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  return requestHostValues(request).some((host) => host === originHost);
}

function requestHostValues(request) {
  const values = [
    request.headers.host
  ];
  return values
    .flatMap((value) => String(value || "").split(","))
    .map((host) => normalizeText(host, 300).toLowerCase())
    .filter(Boolean);
}

function isPreflightMethodAllowed(request) {
  const method = normalizeText(request.headers["access-control-request-method"], 40).toUpperCase();
  return !method || constants.CORS_ALLOWED_METHOD_SET.has(method);
}

function arePreflightHeadersAllowed(request) {
  const rawHeaders = normalizeText(request.headers["access-control-request-headers"], 300).toLowerCase();
  if (!rawHeaders) {
    return true;
  }

  return rawHeaders
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean)
    .every((header) => constants.CORS_ALLOWED_HEADER_SET.has(header));
}

// --- Rate limiting ---

function enforceApiSourceRateLimit(request) {
  enforceRateLimit(
    `api-source:${requestSourceKey(request)}`,
    RATE_LIMIT_API_REQUESTS,
    "Too many API requests."
  );
}

function enforceStateWriteRateLimit(request, stateKey) {
  enforceRateLimit(
    `write-source:${requestSourceKey(request)}`,
    RATE_LIMIT_SOURCE_WRITE_REQUESTS,
    "Too many API write requests."
  );
  enforceRateLimit(
    `write-key:${stateKey}`,
    RATE_LIMIT_STATE_WRITE_REQUESTS,
    "Too many writes for this demo state."
  );
}

function enforceRateLimit(bucketKey, limit, message) {
  const now = Date.now();
  pruneRateLimitBuckets(now);

  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return;
  }

  if (bucket.count >= limit) {
    throw httpError(429, message, {
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    });
  }

  bucket.count += 1;
}

function pruneRateLimitBuckets(now) {
  if (rateLimitBuckets.size < constants.RATE_LIMIT_BUCKET_CAP) {
    return;
  }

  for (const [bucketKey, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  while (rateLimitBuckets.size > constants.RATE_LIMIT_BUCKET_CAP) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    rateLimitBuckets.delete(oldestKey);
  }
}

function requestSourceKey(request) {
  const family = normalizeText(request.socket?.remoteFamily, 20) || "socket";
  const address = normalizeText(request.socket?.remoteAddress, 120) || "unknown";
  return `${family}:${address}`;
}

module.exports = {
  isApiPathname,
  isGeneratedClientStateKey,
  isSyncStateKey,
  stateKeyForRequest,
  stateWriteKeyForRequest,
  contentSecurityPolicy,
  normalizedCorsOrigin,
  parseCorsOrigins,
  isCorsRequestAllowed,
  corsHeadersForRequest,
  allowedCorsOrigin,
  isSameHostOrigin,
  requestHostValues,
  isPreflightMethodAllowed,
  arePreflightHeadersAllowed,
  enforceApiSourceRateLimit,
  enforceStateWriteRateLimit,
  enforceRateLimit,
  requestSourceKey,
  rateLimitBuckets
};
