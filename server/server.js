"use strict";

// ---------------------------------------------------------------------------
// Projects web demo API — entry point
// Implements HTTP server, routing, and static file serving.
// Business logic is delegated to server/src/ modules.
// ---------------------------------------------------------------------------

const crypto = require("node:crypto");
const fileSystem = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const constants = require("./src/constants.js");
const validation = require("./src/validation.js");
const security = require("./src/security.js");
const seed = require("./src/seed.js");
const workflow = require("./src/workflow.js");
const storage = require("./src/state-storage.js");

// ---------------------------------------------------------------------------
// Runtime config and startup
// ---------------------------------------------------------------------------

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5179);
const ROOT_DIR = path.resolve(__dirname, "..");
const STATE_STORAGE = process.env.PROJECTS_STATE_STORAGE || (storage.hasPostgresConfig() ? "postgres" : "file");
const ASSET_VERSION = storage.normalizeAssetVersion(resolveAssetVersion());

function resolveAssetVersion() {
  try {
    return process.env.PROJECTS_ASSET_VERSION
      || process.env.GIT_COMMIT
      || process.env.COMMIT_SHA
      || storage.contentAssetVersion();
  } catch {
    // The Workers bundle has no repo files on disk, so hashing them must not
    // be fatal at import time; normalizeAssetVersion turns "" into "app".
    return "";
  }
}

function jsonLog(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ---------------------------------------------------------------------------
// State storage (with seed module dependency injection)
// ---------------------------------------------------------------------------

const defaultStateStorage = storage.createStateStorage(seed);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    if (!security.isCorsRequestAllowed(request)) {
      sendEmpty(response, 403);
      return;
    }

    sendEmpty(request, response, 204);
    return;
  }

  try {
    const requestId = crypto.randomUUID().slice(0, 8);
    request._requestId = requestId;
    const url = requestUrlFor(request);
    await routeRequest(request, response, url);
  } catch (error) {
    const status = Number(error.statusCode || 500);
    const payload = {
      error: status >= 500 ? "Internal server error" : error.message,
      detail: status >= 500 ? undefined : error.detail
    };
    if (status >= 500) {
      payload.requestId = request._requestId;
      jsonLog("error", error.message, {
        requestId: request._requestId,
        statusCode: status,
        method: request.method,
        url: request.url,
        stack: error.stack?.split("\n").slice(0, 4).join(" ")
      });
    }
    sendJson(request, response, status, payload);
  }
});

// Only start server when run directly (not when required as module for tests)
if (require.main === module) {
  defaultStateStorage.ready.then(() => {
    server.listen(PORT, HOST, () => {
      jsonLog("info", "Server listening.", { host: HOST, port: PORT });
      jsonLog("info", "State storage initialized.", { storage: defaultStateStorage.label });
    });
  }).catch((error) => {
    jsonLog("error", "Failed to initialize state storage.", {
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 3).join(" ")
    });
    process.exit(1);
  });

  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
}

function shutdown(signal) {
  return async () => {
    jsonLog("info", "Shutdown signal received.", { signal });
    server.close(() => {
      jsonLog("info", "HTTP server closed.", { signal });
      defaultStateStorage.close().then(() => {
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

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

async function routeRequest(request, response, url, stateStorage = defaultStateStorage) {
  const pathname = url.pathname.replace(/\/+$/u, "") || "/";
  const method = request.method || "GET";

  if (security.isApiPathname(pathname)) {
    security.enforceApiSourceRateLimit(request);
  }

  if (method === "GET" && pathname === "/api/health") {
    sendJson(request, response, 200, {
      ok: true,
      service: "projects-web-demo-api",
      storage: stateStorage.mode || STATE_STORAGE,
      time: new Date().toISOString()
    });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    sendJson(request, response, 200, await stateStorage.read(security.stateKeyForRequest(request)));
    return;
  }

  if (method === "GET" && pathname === "/api/demo-packs") {
    security.stateKeyForRequest(request);
    sendJson(request, response, 200, await seed.readSeedPacks());
    return;
  }

  if (method === "GET" && pathname === "/api/state/standup") {
    const stateKey = security.stateKeyForRequest(request);
    const state = await stateStorage.read(stateKey);
    sendJson(request, response, 200, { text: workflow.buildStandupText(state?.packs || []) });
    return;
  }

  if (method === "PUT" && pathname === "/api/state/browser") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const current = await stateStorage.read(stateKey);
    sendJson(request, response, 200, await stateStorage.write(seed.browserStatePayload(payload, current), stateKey));
    return;
  }

  if (method === "POST" && pathname === "/api/state/restore") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    sendJson(request, response, 200, await stateStorage.write(payload, stateKey));
    return;
  }

  if (method === "POST" && pathname === "/api/state/sync-copy") {
    const sourceStateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const result = seed.copyStateToSyncAction(await stateStorage.read(sourceStateKey), payload);
    security.enforceStateWriteRateLimit(request, result.targetClientId);
    await stateStorage.write(result.state, result.targetClientId);
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/filter") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = seed.saveStateFilterAction(state, payload);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/selected") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = seed.saveStateSelectedAction(state, payload);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/scenario") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const current = await stateStorage.read(stateKey);
    const result = await seed.saveStateScenarioAction(current, payload);
    await stateStorage.write(result.state, stateKey, { allowEmptyPacks: true });
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/profile") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = seed.saveStateProfileAction(state, payload);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/reset") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const result = await seed.resetStateAction();
    await stateStorage.write(result.state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/state/erase") {
    sendJson(request, response, 200, await stateStorage.erase(security.stateWriteKeyForRequest(request)));
    return;
  }

  if (method === "GET" && pathname === "/api/packs") {
    const state = await stateStorage.read(security.stateKeyForRequest(request));
    sendJson(request, response, 200, state.packs);
    return;
  }

  if (method === "POST" && pathname === "/api/packs") {
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = seed.createPackFromPayload(state, payload);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 201, result);
    return;
  }

  const packPathMatch = pathname.match(/^\/api\/packs\/([^/]+)\/path$/u);
  if (packPathMatch && method === "POST") {
    const packId = decodeURIComponent(packPathMatch[1]);
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = workflow.savePackPathAction(state, packId, payload);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packNextMatch = pathname.match(/^\/api\/packs\/([^/]+)\/next$/u);
  if (packNextMatch && method === "POST") {
    const packId = decodeURIComponent(packNextMatch[1]);
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = workflow.setPackNextAction(state, packId, payload.next);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packActionMatch = pathname.match(/^\/api\/packs\/([^/]+)\/actions$/u);
  if (packActionMatch && method === "POST") {
    const packId = decodeURIComponent(packActionMatch[1]);
    const stateKey = security.stateWriteKeyForRequest(request);
    const payload = await readJsonBody(request);
    const state = await stateStorage.read(stateKey);
    const result = workflow.runPackAction(state, packId, payload.action);
    await stateStorage.write(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packCommandMatch = pathname.match(/^\/api\/packs\/([^/]+)\/command$/u);
  if (packCommandMatch && method === "GET") {
    const packId = decodeURIComponent(packCommandMatch[1]);
    const state = await stateStorage.read(security.stateKeyForRequest(request));
    const pack = workflow.findPackOrThrow(state, packId);
    sendJson(request, response, 200, workflow.packCommandPreview(pack));
    return;
  }

  const packMatch = pathname.match(/^\/api\/packs\/([^/]+)(?:\/memory)?$/u);
  if (packMatch) {
    const packId = decodeURIComponent(packMatch[1]);
    const isMemoryRoute = pathname.endsWith("/memory");
    if (method === "POST" && isMemoryRoute) {
      const stateKey = security.stateWriteKeyForRequest(request);
      const payload = await readJsonBody(request);
      const state = await stateStorage.read(stateKey);
      const result = workflow.addPackMemoryAction(state, packId, payload.note);
      await stateStorage.write(state, stateKey);
      sendJson(request, response, 200, result);
      return;
    }
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    sendJson(request, response, 404, { error: "Not found" });
    return;
  }

  if (method === "GET" || method === "HEAD") {
    await serveStaticRequest(request, response, url, stateStorage);
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

async function serveStaticRequest(request, response, url, stateStorage) {
  const pathname = normalizePublicStaticPathname(url.pathname);
  if (pathname === constants.RUNTIME_CONFIG_PATHNAME) {
    response.writeHead(200, {
      ...constants.securityHeaders,
      "content-type": constants.contentTypes[".js"]
    });
    response.end(request.method === "HEAD" ? "" : runtimeConfigScript());
    return;
  }

  const file = await resolveStaticFile(pathname);
  const extension = path.extname(file).toLowerCase();
  const contentType = file.endsWith(path.sep + "manifest.json") ? "application/manifest+json" : (constants.contentTypes[extension] || "application/octet-stream");

  if (isLandingFile(file)) {
    // The landing page is script-free, so it needs the CSP but not the
    // runtime-config injection index.html gets.
    response.writeHead(200, {
      ...constants.securityHeaders,
      "content-security-policy": security.contentSecurityPolicy(),
      "content-type": contentType
    });
    response.end(request.method === "HEAD" ? "" : await fs.readFile(file, "utf8"));
    return;
  }

  if (isIndexFile(file)) {
    // SSR is the default for app mode: render the page server-side using the
    // client's state. Add ?nossr=1 to fall back to the static shell (useful
    // for debugging or when the client hasn't generated a state key yet).
    if (!url.searchParams.has("nossr")) {
      try {
        const stateKey = security.stateKeyForRequest(request);
        const serverState = await stateStorage.read(stateKey);
        const ssrRenderer = require("./src/render-html.js");
        const route = (url.searchParams.get("route") || "home").replace(/^#\/?/u, "");
        const shellHtml = await fs.readFile(file, "utf8");
        const ssrHtml = ssrRenderer.renderPageHtml(serverState, route, shellHtml);
        const html = injectAppApiBase(ssrHtml);
        response.writeHead(200, {
          ...constants.securityHeaders,
          "content-security-policy": security.contentSecurityPolicy(),
          "content-type": contentType
        });
        response.end(request.method === "HEAD" ? "" : html);
        return;
      } catch (err) {
        // If SSR fails (e.g. missing state key), fall through to static shell.
        if (err.statusCode !== 400) {
          console.error("SSR render failed, falling back to static shell.", err.message);
        }
      }
    }

    const html = injectAppApiBase(await fs.readFile(file, "utf8"));
    response.writeHead(200, {
      ...constants.securityHeaders,
      "content-security-policy": security.contentSecurityPolicy(),
      "content-type": contentType
    });
    response.end(request.method === "HEAD" ? "" : html);
    return;
  }

  response.writeHead(200, {
    ...constants.securityHeaders,
    "content-type": contentType
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fileSystem.createReadStream(file).pipe(response);
}

async function resolveStaticFile(rawPathname) {
  const pathname = normalizePublicStaticPathname(rawPathname);
  if (!isPublicStaticPathname(pathname)) {
    throw validation.httpError(404, "Not found");
  }

  const file = path.resolve(ROOT_DIR, `.${pathname}`);
  if (!file.startsWith(`${ROOT_DIR}${path.sep}`)) {
    throw validation.httpError(404, "Not found");
  }

  const stats = await fs.stat(file).catch(() => null);
  if (stats?.isFile()) {
    return file;
  }

  if (stats?.isDirectory()) {
    const indexFile = path.join(file, "index.html");
    const indexStats = await fs.stat(indexFile).catch(() => null);
    if (indexStats?.isFile()) {
      return indexFile;
    }
  }

  throw validation.httpError(404, "Not found");
}

function normalizePublicStaticPathname(rawPathname) {
  let pathname = "";
  try {
    pathname = decodeURIComponent(rawPathname || "/");
  } catch {
    throw validation.httpError(404, "Not found");
  }

  if (pathname.includes("\\") || pathname.includes("\0")) {
    throw validation.httpError(404, "Not found");
  }

  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  return path.posix.normalize(pathname);
}

function isPublicStaticPathname(pathname) {
  return constants.publicStaticFiles.has(pathname);
}

function isIndexFile(file) {
  return path.resolve(file) === path.join(ROOT_DIR, "index.html");
}

function isLandingFile(file) {
  return path.resolve(file) === path.join(ROOT_DIR, "landing.html");
}

function injectAppApiBase(html) {
  const assetVersionId = validation.normalizeText(ASSET_VERSION, 120).replace(/[^A-Za-z0-9._-]/gu, "-") || "app";
  const configScript = `<script src="assets/runtime-config.js?v=${assetVersionId}" defer></script>`;

  // Inject runtime-config before the demo script (must execute first with defer).
  // In app mode the backend serves the thin-client build (demo-app.js) which
  // strips the server-authoritative packActionEffect / unblockPacksBlockedBy.
  // The static index.html references demo.js by default; the server rewrites it.
  let injectedHtml = html;
  if (injectedHtml.includes("assets/runtime-config.js")) {
    injectedHtml = injectedHtml.replace(/<script[^>]*src="assets\/runtime-config\.js[^"]*"[^>]*><\/script>/u, configScript);
  } else {
    injectedHtml = injectedHtml.replace(
      /<script[^>]*src="assets\/demo\.js[^"]*"[^>]*><\/script>/u,
      `${configScript}\n$&`
    );
  }

  // Rewrite demo.js -> demo-app.js (the thin-client build for app mode).
  injectedHtml = injectedHtml.replace(
    /(<script[^>]*src="assets\/)demo\.js([^"]*"[^>]*><\/script>)/gu,
    "$1demo-app.js$2"
  );

  return injectedHtml
    .replace(/(href="assets\/demo\.css\?v=)[^"]*/gu, `$1${ASSET_VERSION}`)
    .replace(/(src="assets\/demo-app\.js\?v=)[^"]*/u, `$1${ASSET_VERSION}`)
    .replace(/(src="assets\/runtime-config\.js\?v=)[^"]*/gu, `$1${ASSET_VERSION}`);
}

function runtimeConfigScript(stateStorageMode = STATE_STORAGE) {
  // Pages served by this backend are always same-origin with the API, so the
  // base stays relative. An absolute //HOST:PORT base breaks the browser's
  // localhost <-> 127.0.0.1 alias: the fetch turns cross-origin, CORS denies
  // it, and boot dies. backendMode carries the "backend active" signal.
  const config = {
    apiBase: "",
    backendMode: true,
    assetVersion: ASSET_VERSION,
    apiClientHeader: constants.API_CLIENT_HEADER,
    stateStorage: stateStorageMode
  };
  return `window.__projectsDemoConfig=${JSON.stringify(config)};\nwindow.PROJECTS_API_BASE_URL=${JSON.stringify(config.apiBase)};\n`;
}

// ---------------------------------------------------------------------------
// Request body parsing
// ---------------------------------------------------------------------------

async function readJsonBody(request) {
  requireJsonContentType(request);
  rejectOversizedContentLength(request);

  let body = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > constants.MAX_BODY_BYTES) {
      throw validation.httpError(413, "Request body is too large.");
    }
    body += chunk;
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw validation.httpError(400, "Request body must be valid JSON.");
  }
}

function requireJsonContentType(request) {
  const contentType = validation.normalizeText(request.headers["content-type"], 120).split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw validation.httpError(415, "Request body must use application/json.");
  }
}

function rejectOversizedContentLength(request) {
  const rawLength = validation.normalizeText(request.headers["content-length"], 40);
  if (!rawLength || !/^\d+$/u.test(rawLength)) {
    return;
  }

  const declaredLength = Number(rawLength);
  if (declaredLength > constants.MAX_BODY_BYTES) {
    throw validation.httpError(413, "Request body is too large.");
  }
}

// ---------------------------------------------------------------------------
// URL and request helpers
// ---------------------------------------------------------------------------

function requestUrlFor(request) {
  try {
    return new URL(request.url || "/", "http://projects-demo.local");
  } catch {
    throw validation.httpError(400, "Request URL is invalid.");
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function sendJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...constants.securityHeaders,
    ...security.corsHeadersForRequest(request),
    "content-type": "application/json; charset=utf-8",
    "vary": `Origin, ${constants.API_CLIENT_HEADER}`
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendEmpty(requestOrResponse, responseOrStatusCode, maybeStatusCode) {
  const hasRequest = maybeStatusCode !== undefined;
  const request = hasRequest ? requestOrResponse : null;
  const response = hasRequest ? responseOrStatusCode : requestOrResponse;
  const statusCode = hasRequest ? maybeStatusCode : responseOrStatusCode;
  response.writeHead(statusCode, {
    ...constants.securityHeaders,
    ...security.corsHeadersForRequest(request),
    "vary": `Origin, ${constants.API_CLIENT_HEADER}`
  });
  response.end();
}

module.exports = {
  jsonLog,
  routeRequest,
  sendJson,
  sendEmpty,
  normalizePublicStaticPathname,
  isPublicStaticPathname,
  isIndexFile,
  injectAppApiBase,
  runtimeConfigScript,
  readJsonBody,
  requestUrlFor,
  normalizeText: validation.normalizeText,
  workflowTextField: validation.workflowTextField,
  workflowStringArrayField: validation.workflowStringArrayField,
  postgresStateKey: storage.postgresStateKey,
  isGeneratedClientStateKey: security.isGeneratedClientStateKey,
  isSyncStateKey: security.isSyncStateKey,
  forwardPathStatusForBlocker: workflow.forwardPathStatusForBlocker,
  packCommandPreview: workflow.packCommandPreview,
  resolvePrimaryCommandForPack: workflow.resolvePrimaryCommandForPack,
  envInteger: validation.envInteger,
  sanitizeState: validation.sanitizeState,
  normalizedCorsOrigin: security.normalizedCorsOrigin,
  defaultState: seed.defaultState,
  findPackOrThrow: workflow.findPackOrThrow,
  createPackFromPayload: seed.createPackFromPayload,
  runPackAction: workflow.runPackAction,
  savePackPathAction: workflow.savePackPathAction,
  createsBlockedByCycle: workflow.createsBlockedByCycle,
  unblockPacksBlockedBy: workflow.unblockPacksBlockedBy,
  unblockedReceiptSentence: workflow.unblockedReceiptSentence
};
