"use strict";

// ---------------------------------------------------------------------------
// Module: constants
// Pure-data constants used across modules (no function calls in initialization)
// ---------------------------------------------------------------------------

const API_CLIENT_HEADER = "x-projects-demo-client";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_STATE_PACKS = 50;
const MAX_PLAIN_VALUE_DEPTH = 6;
const MAX_PLAIN_OBJECT_KEYS = 40;
const MAX_PLAIN_ARRAY_ITEMS = 100;

const DEMO_BLOCKER_NONE = "none";
const DEMO_BLOCKER_NONE_LABEL = "None";
const DEMO_PROOF_TARGET_MISSING = "Add a proof target before finishing this work";

const SERVER_PACK_ACTIONS = new Set(["start", "unblock", "block", "done", "open"]);
const VALID_PACK_STATUSES = new Set(["active", "blocked", "draft", "done"]);
const VALID_COPY_PROFILES = new Set(["climate", "developer", "dj", "general"]);
const VALID_SCENARIOS = new Set(["default", "due-view", "empty", "healthy", "onboarding", "review"]);
const VALID_STATE_FILTERS = new Set(["active", "all", "blocked", "done", "draft", "review"]);

const RUNTIME_CONFIG_PATHNAME = "/assets/runtime-config.js";

const FORWARD_PATH_CHANGE_FIELDS = Object.freeze([
  ["title", "title"],
  ["status", "status"],
  ["blocker", "blocker"],
  ["owner", "owner"],
  ["due", "due date"],
  ["next", "Next action"],
  ["doneWhen", "proof target"],
  ["purpose", "purpose"]
]);

const publicStaticFiles = new Set([
  "/index.html",
  "/assets/demo.css",
  "/assets/demo.js",
  "/assets/favicon.png"
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const CORS_ALLOWED_METHODS = "GET,POST,PUT,OPTIONS";
const CORS_ALLOWED_HEADERS = `content-type, ${API_CLIENT_HEADER}`;
const CORS_ALLOWED_METHOD_SET = new Set(CORS_ALLOWED_METHODS.split(","));
const CORS_ALLOWED_HEADER_SET = new Set(
  CORS_ALLOWED_HEADERS.split(",").map((header) => header.trim().toLowerCase())
);

const RATE_LIMIT_BUCKET_CAP = 10000;

const securityHeaders = {
  "cache-control": "no-store",
  "clear-site-data": "\"cookies\"",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

module.exports = {
  API_CLIENT_HEADER,
  MAX_BODY_BYTES,
  MAX_STATE_PACKS,
  MAX_PLAIN_VALUE_DEPTH,
  MAX_PLAIN_OBJECT_KEYS,
  MAX_PLAIN_ARRAY_ITEMS,
  DEMO_BLOCKER_NONE,
  DEMO_BLOCKER_NONE_LABEL,
  DEMO_PROOF_TARGET_MISSING,
  SERVER_PACK_ACTIONS,
  VALID_PACK_STATUSES,
  VALID_COPY_PROFILES,
  VALID_SCENARIOS,
  VALID_STATE_FILTERS,
  RUNTIME_CONFIG_PATHNAME,
  FORWARD_PATH_CHANGE_FIELDS,
  publicStaticFiles,
  contentTypes,
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHOD_SET,
  CORS_ALLOWED_HEADER_SET,
  RATE_LIMIT_BUCKET_CAP,
  securityHeaders
};
