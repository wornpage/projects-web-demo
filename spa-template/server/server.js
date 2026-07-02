// __PROJECT_NAME__ API server
// Express + Postgres, structured JSON logging, graceful shutdown.

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const constants = require("./src/constants");
const { normalizedCorsOrigin } = require("./src/security");
const { createStateStorage, stateFileResolvePath } = require("./src/state-storage");

// ---- Config ----
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";
const CORS_ORIGIN = normalizedCorsOrigin(process.env.CORS_ORIGIN || "");
const PUBLIC_DIR = path.resolve(__dirname, "..");

const stateStorage = createStateStorage(process.env);

// ---- Helpers ----
function jsonLog(level, message, extra = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...extra };
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

function jsonReply(res, status, body = {}) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function jsonError(res, status, message) {
  jsonReply(res, status, { error: message });
}

// ---- Shared headers ----
const SHARED_HEADERS = {
  "cache-control": "no-store",
  "clear-site-data": `"cookies"`,
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-permitted-cross-domain-policies": "none",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
};

// ---- CORS ----
function applyCors(res, origin) {
  if (CORS_ORIGIN && origin === CORS_ORIGIN) {
    res.setHeader("access-control-allow-origin", CORS_ORIGIN);
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT");
    res.setHeader("vary", "Origin");
  }
}

// ---- Request handler ----
async function handleRequest(req, res) {
  applyCors(res, req.headers.origin);
  for (const [key, value] of Object.entries(SHARED_HEADERS)) {
    res.setHeader(key, value);
  }

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // ---- API routes ----
  if (pathname === "/api/health") {
    jsonReply(res, 200, { status: "ok", storage: stateStorage.label });
    return;
  }

  // Add your API routes here

  // ---- Static files ----
  serveStatic(res, pathname);
}

function serveStatic(res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(PUBLIC_DIR, safe);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(404);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = constants.MIME_TYPES[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.end(data);
  });
}

// ---- Graceful shutdown ----
function shutdown(signal) {
  return async () => {
    jsonLog("info", "Shutdown signal received.", { signal });
    server.close(() => {
      jsonLog("info", "HTTP server closed.", { signal });
      stateStorage.close().then(() => {
        jsonLog("info", "State storage closed.", { signal });
        process.exit(0);
      }).catch((err) => {
        jsonLog("error", "Error closing state storage.", { message: err.message, signal });
        process.exit(1);
      });
    });
    setTimeout(() => {
      jsonLog("error", "Forced shutdown after timeout.", { signal });
      process.exit(1);
    }, 10_000).unref();
  };
}

// ---- Start ----
const server = http.createServer(handleRequest);

if (require.main === module) {
  stateStorage.ready.then(() => {
    server.listen(PORT, HOST, () => {
      jsonLog("info", "Server listening.", { host: HOST, port: PORT });
      jsonLog("info", "State storage initialized.", { storage: stateStorage.label });
    });
  }).catch((error) => {
    jsonLog("error", "Failed to initialize state storage.", { message: error.message });
    process.exit(1);
  });

  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
}

module.exports = { handleRequest };
