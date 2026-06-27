"use strict";

const crypto = require("node:crypto");
const fileSystem = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5179);
const ROOT_DIR = path.resolve(__dirname, "..");
const SEED_PACKS_FILE = path.join(ROOT_DIR, "data", "demo-packs.json");
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = process.env.PROJECTS_STATE_FILE || path.join(DATA_DIR, "state.json");
const STATE_DIR = path.dirname(STATE_FILE);
const DATABASE_URL = process.env.DATABASE_URL || "";
const STATE_STORAGE = normalizeStateStorageMode(process.env.PROJECTS_STATE_STORAGE || (hasPostgresConfig() ? "postgres" : "file"));
const DEFAULT_STATE_KEY = normalizeText(process.env.PROJECTS_STATE_KEY || "default", 120) || "default";
const ASSET_VERSION = normalizeAssetVersion(process.env.PROJECTS_ASSET_VERSION
  || process.env.RENDER_GIT_COMMIT
  || process.env.GIT_COMMIT
  || process.env.COMMIT_SHA
  || `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`);
const API_CLIENT_HEADER = "x-projects-demo-client";
const MAX_BODY_BYTES = 1024 * 1024;
const publicStaticFiles = new Set([
  "/index.html",
  "/data/demo-packs.json"
]);
const publicStaticPrefixes = [
  "/assets/"
];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  "access-control-allow-headers": `content-type, ${API_CLIENT_HEADER}`
};
const securityHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

const stateStorage = createStateStorage();

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || HOST}`);
  try {
    await routeRequest(request, response, url);
  } catch (error) {
    const status = Number(error.statusCode || 500);
    sendJson(response, status, {
      error: status >= 500 ? "Internal server error" : error.message,
      detail: status >= 500 ? undefined : error.detail
    });
    if (status >= 500) {
      console.error(error);
    }
  }
});

stateStorage.ready.then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Projects demo app listening at http://${HOST}:${PORT}`);
    console.log(`State storage: ${stateStorage.label}`);
  });
}).catch((error) => {
  console.error("Projects demo app failed to initialize storage.", error);
  process.exit(1);
});

async function routeRequest(request, response, url) {
  const pathname = url.pathname.replace(/\/+$/u, "") || "/";
  const method = request.method || "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "projects-web-demo-api",
      stateStorage: stateStorage.label,
      time: new Date().toISOString()
    });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, await readState(stateKeyForRequest(request)));
    return;
  }

  if ((method === "PUT" || method === "POST") && pathname === "/api/state") {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await writeState(payload, stateKeyForRequest(request)));
    return;
  }

  if (method === "GET" && pathname === "/api/packs") {
    const state = await readState(stateKeyForRequest(request));
    sendJson(response, 200, state.packs);
    return;
  }

  if (method === "POST" && pathname === "/api/packs") {
    const payload = await readJsonBody(request);
    const stateKey = stateKeyForRequest(request);
    const state = await readState(stateKey);
    const pack = sanitizePack(payload);
    if (!pack.id) {
      pack.id = uniquePackId(state.packs, slugify(pack.title || "sample-work"));
    }
    if (state.packs.some((item) => item.id === pack.id)) {
      throw httpError(409, `Pack already exists: ${pack.id}`);
    }
    state.packs.unshift(pack);
    await writeState(state, stateKey);
    sendJson(response, 201, pack);
    return;
  }

  const packMatch = pathname.match(/^\/api\/packs\/([^/]+)(?:\/memory)?$/u);
  if (packMatch) {
    const packId = decodeURIComponent(packMatch[1]);
    const isMemoryRoute = pathname.endsWith("/memory");
    if (method === "PATCH" && !isMemoryRoute) {
      const payload = await readJsonBody(request);
      const stateKey = stateKeyForRequest(request);
      const state = await readState(stateKey);
      const pack = findPackOrThrow(state, packId);
      const updated = sanitizePack({ ...pack, ...payload, id: pack.id });
      Object.assign(pack, updated, { id: pack.id });
      await writeState(state, stateKey);
      sendJson(response, 200, pack);
      return;
    }

    if (method === "POST" && isMemoryRoute) {
      const payload = await readJsonBody(request);
      const stateKey = stateKeyForRequest(request);
      const state = await readState(stateKey);
      const pack = findPackOrThrow(state, packId);
      const note = normalizeText(payload.note, 2000);
      if (!note) {
        throw httpError(400, "Memory note is required.");
      }
      pack.memory = normalizeStringArray(pack.memory, 100, 2000);
      if (!pack.memory.some((value) => normalizeText(value) === note)) {
        pack.memory.unshift(note);
        pack.activity = normalizeStringArray(pack.activity, 100, 400);
        pack.activity.unshift("Memory note added.");
      }
      await writeState(state, stateKey);
      sendJson(response, 200, pack);
      return;
    }
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (method === "GET" || method === "HEAD") {
    await serveStaticRequest(request, response, url);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function serveStaticRequest(request, response, url) {
  const file = await resolveStaticFile(url.pathname);
  const extension = path.extname(file).toLowerCase();
  const contentType = contentTypes[extension] || "application/octet-stream";

  if (isIndexFile(file)) {
    const html = injectAppApiBase(await fs.readFile(file, "utf8"));
    response.writeHead(200, {
      ...securityHeaders,
      "content-type": contentType
    });
    response.end(request.method === "HEAD" ? "" : html);
    return;
  }

  response.writeHead(200, {
    ...securityHeaders,
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
    throw httpError(404, "Not found");
  }

  const file = path.resolve(ROOT_DIR, `.${pathname}`);
  if (!file.startsWith(`${ROOT_DIR}${path.sep}`)) {
    throw httpError(404, "Not found");
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

  throw httpError(404, "Not found");
}

function normalizePublicStaticPathname(rawPathname) {
  let pathname = "";
  try {
    pathname = decodeURIComponent(rawPathname || "/");
  } catch {
    throw httpError(404, "Not found");
  }

  if (pathname.includes("\\") || pathname.includes("\0")) {
    throw httpError(404, "Not found");
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
  return publicStaticFiles.has(pathname)
    || publicStaticPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isIndexFile(file) {
  return path.resolve(file) === path.join(ROOT_DIR, "index.html");
}

function injectAppApiBase(html) {
  const versionedHtml = html
    .replace(/(href="assets\/(?:app|demo)\.css\?v=)[^"]*/gu, `$1${ASSET_VERSION}`)
    .replace(/(src="assets\/demo\.js\?v=)[^"]*/u, `$1${ASSET_VERSION}`);
  const script = '<script>window.PROJECTS_API_BASE_URL = window.PROJECTS_API_BASE_URL || location.origin;</script>';
  if (versionedHtml.includes(script)) {
    return versionedHtml;
  }

  return versionedHtml.replace(
    /(\s*<script src="assets\/demo\.js[^>]*><\/script>)/u,
    `  ${script}\n$1`
  );
}

async function readState(stateKey = DEFAULT_STATE_KEY) {
  return stateStorage.read(stateKey);
}

async function writeState(payload, stateKey = DEFAULT_STATE_KEY) {
  return stateStorage.write(payload, stateKey);
}

function createStateStorage() {
  if (STATE_STORAGE === "postgres") {
    return createPostgresStateStorage();
  }

  return createFileStateStorage();
}

function createFileStateStorage() {
  return {
    label: `file:${STATE_FILE}`,
    ready: Promise.resolve(),
    read: readFileState,
    write: writeFileState
  };
}

function createPostgresStateStorage() {
  const poolOptions = postgresPoolOptions();
  if (!poolOptions) {
    throw new Error("DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD is required when PROJECTS_STATE_STORAGE=postgres.");
  }

  const { Pool } = require("pg");
  const pool = new Pool(poolOptions);

  return {
    label: "postgres:projects_demo_state",
    ready: pool.query(`
      CREATE TABLE IF NOT EXISTS projects_demo_state (
        state_key text PRIMARY KEY,
        state_json jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now()
      )
    `),
    async read(stateKey = DEFAULT_STATE_KEY) {
      const result = await pool.query(
        "SELECT state_json FROM projects_demo_state WHERE state_key = $1",
        [stateKey]
      );
      return result.rows[0]?.state_json ? sanitizeState(result.rows[0].state_json) : defaultState();
    },
    async write(payload, stateKey = DEFAULT_STATE_KEY) {
      const state = sanitizeState(payload);
      state.savedAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO projects_demo_state (state_key, state_json, saved_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (state_key) DO UPDATE
         SET state_json = EXCLUDED.state_json,
             saved_at = EXCLUDED.saved_at`,
        [stateKey, JSON.stringify(state), state.savedAt]
      );
      return state;
    }
  };
}

function stateKeyForRequest(request) {
  const value = normalizeText(request.headers[API_CLIENT_HEADER], 120);
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/u.test(value)) {
    return value;
  }

  if (STATE_STORAGE === "postgres") {
    throw httpError(400, `Missing or invalid ${API_CLIENT_HEADER} header.`);
  }

  return DEFAULT_STATE_KEY;
}

function hasPostgresConfig() {
  return Boolean(DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD));
}

function postgresPoolOptions() {
  const ssl = postgresSslOption();
  if (DATABASE_URL) {
    return ssl === undefined
      ? { connectionString: DATABASE_URL }
      : { connectionString: DATABASE_URL, ssl };
  }

  if (!hasPostgresConfig()) {
    return null;
  }

  const options = {
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
  };
  const port = Number(process.env.PGPORT || 5432);
  if (Number.isInteger(port) && port > 0) {
    options.port = port;
  }
  if (ssl !== undefined) {
    options.ssl = ssl;
  }

  return options;
}

function postgresSslOption() {
  const mode = normalizeText(process.env.PROJECTS_POSTGRES_SSL || process.env.PGSSLMODE, 20).toLowerCase();
  if (mode === "require" || mode === "prefer") {
    return { rejectUnauthorized: false };
  }
  if (mode === "disable") {
    return false;
  }
  return undefined;
}

function normalizeStateStorageMode(value) {
  const mode = normalizeText(value, 40).toLowerCase();
  return mode === "postgres" ? "postgres" : "file";
}

async function readFileState() {
  try {
    const text = await fs.readFile(STATE_FILE, "utf8");
    return sanitizeState(JSON.parse(text));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return defaultState();
  }
}

async function writeFileState(payload) {
  const state = sanitizeState(payload);
  await fs.mkdir(STATE_DIR, { recursive: true });
  state.savedAt = new Date().toISOString();
  const tmpFile = path.join(STATE_DIR, `state.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, STATE_FILE);
  return state;
}

async function defaultState() {
  const packs = JSON.parse(await fs.readFile(SEED_PACKS_FILE, "utf8"));
  return sanitizeState({
    packs,
    copyProfile: "general",
    scenarioId: "default",
    selectedId: packs[0]?.id || "",
    status: "Demo buttons update work through the backend API.",
    actionReceipt: null,
    filter: "all",
    query: "",
    triageInput: "",
    triageRows: []
  });
}

function sanitizeState(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const packs = Array.isArray(source.packs) ? source.packs.map(sanitizePack).filter((pack) => pack.id) : [];
  const selectedId = normalizeText(source.selectedId, 120);
  return {
    packs,
    copyProfile: normalizeText(source.copyProfile, 40) || "general",
    scenarioId: normalizeText(source.scenarioId, 80) || "default",
    selectedId: packs.some((pack) => pack.id === selectedId) ? selectedId : packs[0]?.id || "",
    status: normalizeText(source.status, 1000),
    actionReceipt: sanitizePlainObject(source.actionReceipt),
    filter: normalizeText(source.filter, 40) || "all",
    query: normalizeText(source.query, 200),
    triageInput: normalizeText(source.triageInput, 10000),
    triageRows: Array.isArray(source.triageRows) ? source.triageRows.map(sanitizePlainObject) : [],
    savedAt: normalizeText(source.savedAt, 80)
  };
}

function sanitizePack(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    id: normalizeText(source.id, 120),
    title: normalizeText(source.title, 200),
    type: normalizeText(source.type, 80) || "general",
    status: normalizeText(source.status, 40) || "draft",
    blocker: normalizeText(source.blocker, 200) || "none",
    next: normalizeText(source.next, 120),
    due: normalizeText(source.due, 40),
    owner: normalizeText(source.owner, 120),
    purpose: normalizeText(source.purpose, 1000),
    doneWhen: normalizeText(source.doneWhen, 1000),
    sources: normalizeStringArray(source.sources, 50, 200),
    memory: normalizeStringArray(source.memory, 100, 2000),
    activity: normalizeStringArray(source.activity, 100, 400)
  };
}

function sanitizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => typeof key === "string" && key.length <= 80)
      .map(([key, entry]) => [key, sanitizePlainValue(entry)])
  );
}

function sanitizePlainValue(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 100).map(sanitizePlainValue);
  }

  if (value && typeof value === "object") {
    return sanitizePlainObject(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  return normalizeText(value, 2000);
}

function normalizeStringArray(value, maxItems, maxLength) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => normalizeText(item, maxLength)).filter(Boolean)
    : [];
}

function normalizeText(value, maxLength = 2000) {
  return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

function normalizeAssetVersion(value) {
  return normalizeText(value, 120).replace(/[^A-Za-z0-9._-]/gu, "-") || "app";
}

function findPackOrThrow(state, packId) {
  const pack = state.packs.find((item) => item.id === packId);
  if (!pack) {
    throw httpError(404, `Pack not found: ${packId}`);
  }
  return pack;
}

function slugify(value) {
  return normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "sample-work";
}

function uniquePackId(packs, seed) {
  let candidate = seed;
  let suffix = 2;
  while (packs.some((pack) => pack.id === candidate)) {
    candidate = `${seed}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function readJsonBody(request) {
  let body = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      throw httpError(413, "Request body is too large.");
    }
    body += chunk;
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
    "vary": API_CLIENT_HEADER
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...corsHeaders,
    "vary": API_CLIENT_HEADER
  });
  response.end();
}

function httpError(statusCode, message, detail) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.detail = detail;
  return error;
}
