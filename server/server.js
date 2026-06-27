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
  || process.env.GIT_COMMIT
  || process.env.COMMIT_SHA
  || `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`);
const API_CLIENT_HEADER = "x-projects-demo-client";
const MAX_BODY_BYTES = 1024 * 1024;
const DEMO_BLOCKER_NONE = "none";
const DEMO_BLOCKER_NONE_LABEL = "None";
const DEMO_PROOF_TARGET_MISSING = "Add a proof target before finishing this work";
const SERVER_PACK_ACTIONS = new Set(["start", "unblock", "block", "done", "open"]);
const FORWARD_PATH_CHANGE_FIELDS = Object.freeze([
  ["title", "title"],
  ["status", "status"],
  ["blocker", "blocker"],
  ["owner", "owner"],
  ["due", "due date"],
  ["next", "Button runs next"],
  ["doneWhen", "proof target"],
  ["purpose", "purpose"]
]);
const publicStaticFiles = new Set([
  "/index.html",
  "/assets/app.css",
  "/assets/demo.css",
  "/assets/demo.js",
  "/assets/favicon.png",
  "/data/demo-packs.json"
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
const securityHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

const stateStorage = createStateStorage();

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    if (!isCorsRequestAllowed(request)) {
      sendEmpty(response, 403);
      return;
    }

    sendEmpty(request, response, 204);
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || HOST}`);
  try {
    await routeRequest(request, response, url);
  } catch (error) {
    const status = Number(error.statusCode || 500);
    sendJson(request, response, status, {
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
    sendJson(request, response, 200, {
      ok: true,
      service: "projects-web-demo-api",
      storage: STATE_STORAGE,
      time: new Date().toISOString()
    });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    sendJson(request, response, 200, await readState(stateKeyForRequest(request)));
    return;
  }

  if ((method === "PUT" || method === "POST") && pathname === "/api/state") {
    const payload = await readJsonBody(request);
    sendJson(request, response, 200, await writeState(payload, stateKeyForRequest(request)));
    return;
  }

  if (method === "GET" && pathname === "/api/packs") {
    const state = await readState(stateKeyForRequest(request));
    sendJson(request, response, 200, state.packs);
    return;
  }

  if (method === "POST" && pathname === "/api/packs") {
    const payload = await readJsonBody(request);
    const stateKey = stateKeyForRequest(request);
    const state = await readState(stateKey);
    const result = createPackFromPayload(state, payload);
    await writeState(state, stateKey);
    sendJson(request, response, 201, result);
    return;
  }

  const packPathMatch = pathname.match(/^\/api\/packs\/([^/]+)\/path$/u);
  if (packPathMatch && method === "POST") {
    const packId = decodeURIComponent(packPathMatch[1]);
    const payload = await readJsonBody(request);
    const stateKey = stateKeyForRequest(request);
    const state = await readState(stateKey);
    const result = savePackPathAction(state, packId, payload);
    await writeState(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packNextMatch = pathname.match(/^\/api\/packs\/([^/]+)\/next$/u);
  if (packNextMatch && method === "POST") {
    const packId = decodeURIComponent(packNextMatch[1]);
    const payload = await readJsonBody(request);
    const stateKey = stateKeyForRequest(request);
    const state = await readState(stateKey);
    const result = setPackNextAction(state, packId, payload.next);
    await writeState(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packActionMatch = pathname.match(/^\/api\/packs\/([^/]+)\/actions$/u);
  if (packActionMatch && method === "POST") {
    const packId = decodeURIComponent(packActionMatch[1]);
    const payload = await readJsonBody(request);
    const stateKey = stateKeyForRequest(request);
    const state = await readState(stateKey);
    const result = runPackAction(state, packId, payload.action);
    await writeState(state, stateKey);
    sendJson(request, response, 200, result);
    return;
  }

  const packCommandMatch = pathname.match(/^\/api\/packs\/([^/]+)\/command$/u);
  if (packCommandMatch && method === "GET") {
    const packId = decodeURIComponent(packCommandMatch[1]);
    const state = await readState(stateKeyForRequest(request));
    const pack = findPackOrThrow(state, packId);
    sendJson(request, response, 200, packCommandPreview(pack));
    return;
  }

  const packMatch = pathname.match(/^\/api\/packs\/([^/]+)(?:\/memory)?$/u);
  if (packMatch) {
    const packId = decodeURIComponent(packMatch[1]);
    const isMemoryRoute = pathname.endsWith("/memory");
    if (method === "POST" && isMemoryRoute) {
      const payload = await readJsonBody(request);
      const stateKey = stateKeyForRequest(request);
      const state = await readState(stateKey);
      const result = addPackMemoryAction(state, packId, payload.note);
      await writeState(state, stateKey);
      sendJson(request, response, 200, result);
      return;
    }
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    sendJson(request, response, 404, { error: "Not found" });
    return;
  }

  if (method === "GET" || method === "HEAD") {
    await serveStaticRequest(request, response, url);
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
}

async function serveStaticRequest(request, response, url) {
  const file = await resolveStaticFile(url.pathname);
  const extension = path.extname(file).toLowerCase();
  const contentType = contentTypes[extension] || "application/octet-stream";

  if (isIndexFile(file)) {
    const nonce = crypto.randomBytes(16).toString("base64");
    const html = injectAppApiBase(await fs.readFile(file, "utf8"), nonce);
    response.writeHead(200, {
      ...securityHeaders,
      "content-security-policy": contentSecurityPolicy(nonce),
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
  return publicStaticFiles.has(pathname);
}

function isIndexFile(file) {
  return path.resolve(file) === path.join(ROOT_DIR, "index.html");
}

function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'none'"
  ].join("; ");
}

function injectAppApiBase(html, nonce) {
  const versionedHtml = html
    .replace(/(href="assets\/(?:app|demo)\.css\?v=)[^"]*/gu, `$1${ASSET_VERSION}`)
    .replace(/(src="assets\/demo\.js\?v=)[^"]*/u, `$1${ASSET_VERSION}`);
  const script = `<script nonce="${escapeHtmlAttribute(nonce)}">window.PROJECTS_API_BASE_URL = window.PROJECTS_API_BASE_URL || location.origin;</script>`;
  if (versionedHtml.includes("window.PROJECTS_API_BASE_URL")) {
    return versionedHtml.replace(/<script[^>]*>window\.PROJECTS_API_BASE_URL = window\.PROJECTS_API_BASE_URL \|\| location\.origin;<\/script>/u, script);
  }

  return versionedHtml.replace(
    /(\s*<script src="assets\/demo\.js[^>]*><\/script>)/u,
    `  ${script}\n$1`
  );
}

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
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

async function readFileState(stateKey = DEFAULT_STATE_KEY) {
  const stateFile = fileStatePathForKey(stateKey);
  try {
    const text = await fs.readFile(stateFile, "utf8");
    return sanitizeState(JSON.parse(text));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return defaultState();
  }
}

async function writeFileState(payload, stateKey = DEFAULT_STATE_KEY) {
  const stateFile = fileStatePathForKey(stateKey);
  const state = sanitizeState(payload);
  await fs.mkdir(STATE_DIR, { recursive: true });
  state.savedAt = new Date().toISOString();
  const tmpFile = path.join(STATE_DIR, `${path.basename(stateFile)}.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, stateFile);
  return state;
}

function fileStatePathForKey(stateKey = DEFAULT_STATE_KEY) {
  const normalized = normalizeText(stateKey, 120) || DEFAULT_STATE_KEY;
  if (normalized === DEFAULT_STATE_KEY) {
    return STATE_FILE;
  }

  const extension = path.extname(STATE_FILE) || ".json";
  const baseName = path.basename(STATE_FILE, extension);
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return path.join(STATE_DIR, `${baseName}.${digest}${extension}`);
}

function createPackFromPayload(state, payload) {
  const values = createPackValues(payload);
  const workflow = initialWorkflowForCreatedPack(values.title, values.owner, values.next);
  if (!workflow.canSave) {
    throw httpError(400, workflow.help);
  }

  const pack = sanitizePack({
    id: uniquePackId(state.packs, slugify(values.title || "sample-work")),
    title: values.title,
    type: normalizeText(payload?.type, 80) || state.copyProfile || "general",
    status: workflow.status,
    blocker: workflow.blocker,
    next: values.next,
    due: values.due,
    owner: values.owner,
    purpose: values.purpose || "Work created in the backend demo.",
    doneWhen: values.doneWhen || "Result is described.",
    sources: normalizeStringArray(payload?.sources, 50, 200),
    memory: normalizeStringArray(payload?.memory, 100, 2000),
    activity: [persistenceCreatedActivity()]
  });

  if (pack.sources.length === 0) {
    pack.sources = ["backend-state"];
  }
  state.packs.unshift(pack);
  state.selectedId = pack.id;
  const next = resolvePrimaryCommandForPack(pack);
  const receipt = actionReceiptForPack(
    pack,
    `Created ${workTitle(pack)}. State: ${workflowStateForPack(pack, next).label}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next.label}.`,
    next
  );
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  return {
    created: true,
    pack: sanitizePack(pack),
    receipt,
    state: sanitizeState(state)
  };
}

function createPackValues(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    title: normalizeText(source.title, 200),
    owner: normalizeText(source.owner, 120),
    next: normalizeText(source.next, 120),
    due: normalizeText(source.due, 40),
    purpose: normalizeText(source.purpose, 1000),
    doneWhen: normalizeText(source.doneWhen, 1000)
  };
}

function initialWorkflowForCreatedPack(title, owner, next) {
  if (!normalizeText(title, 200)) {
    return createBlockedWorkflow("missing title", "Fill title");
  }
  if (isPlaceholderNext(next)) {
    return createBlockedWorkflow("missing Button runs next", "Choose Button runs next");
  }
  if (isMissingOwnerValue(owner)) {
    return createBlockedWorkflow("missing owner", "Fill owner");
  }
  return {
    status: "active",
    blocker: DEMO_BLOCKER_NONE,
    canSave: true,
    help: "Where: Create. Blocker: None. Button runs next: save work."
  };
}

function createBlockedWorkflow(blocker, next) {
  return {
    status: "draft",
    blocker,
    canSave: false,
    help: `Where: Create. Blocker: ${blocker}. Button runs next: ${next}.`
  };
}

function persistenceCreatedActivity() {
  return "Created through backend API.";
}

function isMissingOwnerValue(value) {
  const owner = normalizeText(value, 120).toLowerCase();
  return !owner || owner === "no owner" || owner === "unassigned" || owner === "owner pending";
}

function setPackNextAction(state, packId, rawNext) {
  const pack = findPackOrThrow(state, packId);
  const next = normalizeText(rawNext, 120) || "Open";
  const before = packActionSignature(pack);
  const forwardPath = nextChoiceForwardPath(pack, next);
  pack.next = forwardPath.next;
  pack.blocker = forwardPath.blocker;
  pack.status = forwardPath.status;
  const changed = packActionSignature(pack) !== before;
  const label = buttonRunsNextDisplayLabel(pack.next);
  if (changed) {
    addPackActivity(pack, `Button runs next changed to ${label}.`);
  }

  state.selectedId = pack.id;
  const command = resolvePrimaryCommandForPack(pack);
  const summary = changed
    ? `Button runs next set to ${label} for ${workTitle(pack)}.`
    : `Button already runs ${label} for ${workTitle(pack)}.`;
  const receipt = actionReceiptForPack(pack, summary, command);
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  return {
    changed,
    next: pack.next,
    label,
    pack: sanitizePack(pack),
    receipt,
    state: sanitizeState(state)
  };
}

function addPackMemoryAction(state, packId, rawNote) {
  const pack = findPackOrThrow(state, packId);
  const note = normalizeText(rawNote, 2000);
  if (!note) {
    throw httpError(400, "Memory note is required.");
  }

  pack.memory = normalizeStringArray(pack.memory, 100, 2000);
  const added = !pack.memory.some((value) => normalizeText(value) === note);
  if (added) {
    pack.memory.unshift(note);
    addPackActivity(pack, "Memory note added.");
  }

  state.selectedId = pack.id;
  const command = resolvePrimaryCommandForPack(pack);
  const summary = added
    ? `Memory note added for ${workTitle(pack)}.`
    : `Memory note already exists for ${workTitle(pack)}.`;
  const receipt = actionReceiptForPack(pack, summary, command);
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  return {
    added,
    note,
    pack: sanitizePack(pack),
    receipt,
    state: sanitizeState(state)
  };
}

function savePackPathAction(state, packId, payload) {
  const pack = findPackOrThrow(state, packId);
  const before = packPathSnapshot(pack);
  const values = packPathValues(payload, pack);
  pack.title = values.title || pack.title;
  pack.status = values.status || pack.status;
  pack.blocker = values.blocker;
  pack.owner = values.owner || pack.owner;
  pack.due = values.due;
  pack.next = values.next || pack.next;
  pack.doneWhen = values.doneWhen || pack.doneWhen;
  pack.purpose = values.purpose || pack.purpose;
  pack.blocker = pack.status === "done" ? DEMO_BLOCKER_NONE : normalizeStoredBlocker(pack.blocker);
  if (pack.status === "blocked" && normalizeStoredBlocker(pack.blocker) === DEMO_BLOCKER_NONE) {
    pack.status = "active";
  }

  const after = packPathSnapshot(pack);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    addPackActivity(pack, "Work path changed.");
  }

  state.selectedId = pack.id;
  const changeSummary = packPathChangeSummary(before, after);
  const summary = changed
    ? `Work path saved for ${workTitle(pack)}. ${changeSummary}. ${proofTargetSentence(pack)}`
    : `No work path changes for ${workTitle(pack)}. ${proofTargetSentence(pack)}`;
  const receipt = actionReceiptForPack(pack, summary, resolvePrimaryCommandForPack(pack));
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  return {
    changed,
    summary: changeSummary,
    pack: sanitizePack(pack),
    receipt,
    state: sanitizeState(state)
  };
}

function packPathValues(payload, pack) {
  const source = payload && typeof payload === "object" ? payload : {};
  const requestedStatus = normalizeText(source.status, 40) || pack.status || "active";
  const next = normalizeText(source.next, 120) || pack.next || "Open";
  const sourceHasBlocker = Object.prototype.hasOwnProperty.call(source, "blocker");
  const rawBlocker = requestedStatus === "done"
    ? DEMO_BLOCKER_NONE
    : normalizeStoredBlocker(sourceHasBlocker ? source.blocker : pack.blocker);
  return {
    title: normalizeText(source.title, 200) || pack.title,
    status: forwardPathStatusForBlocker(requestedStatus, rawBlocker, next),
    blocker: rawBlocker,
    owner: normalizeText(source.owner, 120) || pack.owner,
    due: normalizeText(source.due, 40),
    next,
    doneWhen: normalizeText(source.doneWhen, 1000) || pack.doneWhen,
    purpose: normalizeText(source.purpose, 1000) || pack.purpose
  };
}

function packPathSnapshot(pack) {
  return {
    title: normalizeText(pack?.title, 200),
    status: normalizeText(pack?.status, 40),
    blocker: normalizeStoredBlocker(pack?.blocker),
    owner: normalizeText(pack?.owner, 120),
    due: normalizeText(pack?.due, 40),
    next: normalizeText(pack?.next, 120),
    doneWhen: normalizeText(pack?.doneWhen, 1000),
    purpose: normalizeText(pack?.purpose, 1000)
  };
}

function packPathChangeSummary(before, after) {
  const changes = FORWARD_PATH_CHANGE_FIELDS
    .map(([field, label]) => {
      const oldValue = normalizeText(before?.[field]);
      const newValue = normalizeText(after?.[field]);
      return oldValue === newValue ? "" : `${label} to ${sentenceValue(newValue || "blank")}`;
    })
    .filter(Boolean);

  if (changes.length === 0) {
    return "Edit a work path field before saving";
  }

  const visible = changes.slice(0, 3).join("; ");
  const remaining = changes.length - 3;
  return remaining > 0
    ? `Changed ${visible}; ${remaining} more`
    : `Changed ${visible}`;
}

function nextChoiceForwardPath(pack, value) {
  const next = normalizeText(value, 120) || "Open";
  const blocker = normalizeStoredBlocker(pack?.blocker) === "missing Button runs next"
    ? DEMO_BLOCKER_NONE
    : normalizeStoredBlocker(pack?.blocker);
  return {
    next,
    blocker,
    status: forwardPathStatusForBlocker(pack?.status, blocker, next)
  };
}

function forwardPathStatusForBlocker(status, blocker, next = "") {
  const normalizedStatus = normalizeText(status, 40) || "active";
  if (normalizedStatus === "done") {
    return "done";
  }
  if (isPlaceholderNext(next)) {
    return "draft";
  }
  if (normalizeStoredBlocker(blocker) !== DEMO_BLOCKER_NONE) {
    return "blocked";
  }
  return "active";
}

function buttonRunsNextDisplayLabel(value) {
  return commandActionForLabel(value || "Open").label;
}

function runPackAction(state, packId, rawAction) {
  const action = normalizeText(rawAction, 40).toLowerCase();
  if (!SERVER_PACK_ACTIONS.has(action)) {
    throw httpError(400, `Unsupported pack action: ${action || "missing"}`);
  }

  const pack = findPackOrThrow(state, packId);
  const before = packActionSignature(pack);
  let changed = false;

  if (action === "start") {
    pack.status = "active";
    pack.blocker = pack.blocker === "missing setup" ? DEMO_BLOCKER_NONE : pack.blocker;
    pack.next = isPlaceholderNext(pack.next) ? "Open" : pack.next;
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Started.");
    }
  } else if (action === "unblock") {
    pack.status = "active";
    pack.blocker = DEMO_BLOCKER_NONE;
    pack.next = "Open";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocker set to None.");
    }
  } else if (action === "block") {
    pack.status = "blocked";
    pack.blocker = "blocked in this demo";
    pack.next = "Set Blocker: None";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocked.");
    }
  } else if (action === "done") {
    pack.status = "done";
    pack.blocker = DEMO_BLOCKER_NONE;
    pack.next = "Open";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, proofSavedActivity(pack));
    }
  } else if (action === "open") {
    changed = addPackActivity(pack, "Opened.");
  }

  state.selectedId = pack.id;
  const next = resolvePrimaryCommandForPack(pack);
  const summary = packActionSummary(pack, action, actionLabelFromKey(action), changed);
  const receipt = actionReceiptForPack(pack, summary, next);
  state.status = receipt.summary;
  state.actionReceipt = receipt;

  return {
    action,
    changed,
    pack: sanitizePack(pack),
    receipt,
    state: sanitizeState(state)
  };
}

function packActionSummary(pack, action, actionLabel, changed) {
  const title = workTitle(pack);
  if (action === "done") {
    const proof = proofTargetSentence(pack);
    return changed
      ? `Done saved for ${title}. ${proof}`
      : `Done already saved for ${title}. ${proof}`;
  }

  if (action === "open") {
    return changed
      ? `Work path opened for ${title}.`
      : `Work path already open for ${title}.`;
  }

  if (action === "start") {
    return changed
      ? `Started ${title}.`
      : `${title} is already active.`;
  }

  if (action === "unblock") {
    return changed
      ? `Blocker cleared for ${title}.`
      : `Blocker already clear for ${title}.`;
  }

  if (action === "block") {
    return changed
      ? `Blocker added for ${title}.`
      : `${title} is already blocked.`;
  }

  return changed
    ? `${actionLabel} saved for ${title}.`
    : `${actionLabel} is already saved for ${title}.`;
}

function actionReceiptForPack(pack, summary, next = resolvePrimaryCommandForPack(pack)) {
  const workflow = workflowStateForPack(pack, next);
  const fullSummary = actionReceiptSummary(summary, pack, next);
  return {
    kind: "action",
    tone: "success",
    packId: pack.id,
    summary: fullSummary,
    visibleSummary: visibleText(summary || fullSummary, 96),
    where: `${workTitle(pack)} / ${workflow.label}`,
    blocker: blockerTextForPack(pack),
    next: next.label,
    proof: proofTargetForPack(pack)
  };
}

function packCommandPreview(pack) {
  const next = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, next);
  return {
    packId: pack.id,
    signature: packCommandSignature(pack),
    where: workTitle(pack),
    blocker: blockerTextForPack(pack),
    next: next.label,
    action: next.action,
    targetPackId: next.targetPackId,
    stateText: workflow.label,
    stateHelp: workflow.help || "",
    proof: proofTargetForPack(pack)
  };
}

function actionReceiptSummary(summary, pack, next) {
  return visibleText(`${summary} ${actionReceiptContext(pack, next)}`, 180);
}

function actionReceiptContext(pack, next) {
  return `Where: ${sentenceValue(workTitle(pack))}. Blocker: ${sentenceValue(blockerTextForPack(pack))}. Button runs next: ${sentenceValue(next.label)}. Proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function workflowStateForPack(pack, command = null) {
  const resolved = command || resolvePrimaryCommandForPack(pack);
  if (pack.status === "done") {
    return { label: "Done" };
  }
  if (isMissingNextAction(pack)) {
    return { label: "Needs setup" };
  }
  if (hasBlocker(pack)) {
    return { label: "Blocked" };
  }
  if (resolved.action === "done") {
    return { label: "Proof ready" };
  }
  if (pack.status === "draft") {
    return { label: "Draft" };
  }
  return { label: "Ready" };
}

function resolvePrimaryCommandForPack(pack) {
  if (isMissingNextAction(pack)) {
    return { label: "Set Button runs next", action: "set-next", targetPackId: pack.id };
  }

  const action = commandActionForLabel(pack.next || "Open");
  if (hasBlocker(pack)) {
    if (action.action === "unblock") {
      return { label: "Set Blocker: None", action: "unblock", targetPackId: pack.id };
    }
    return { label: "Review blocker", action: "review", targetPackId: pack.id };
  }

  return { ...action, targetPackId: pack.id };
}

function commandActionForLabel(label) {
  const value = normalizeText(label || "Open", 120) || "Open";
  const normalized = value.toLowerCase();
  if (normalized === "review blocker") {
    return { label: "Review blocker", action: "review" };
  }
  if (normalized === "review" || normalized === "review work") {
    return { label: "Review work", action: "review-work" };
  }
  if (normalized === "set next" || normalized === "set button runs next" || normalized === "choose next action") {
    return { label: "Set Button runs next", action: "set-next" };
  }
  if (normalized === "focus") {
    return { label: value, action: "focus" };
  }
  if (normalized === "unblock" || normalized === "set blocker: none" || normalized === "set blocker none") {
    return { label: "Set Blocker: None", action: "unblock" };
  }
  if (normalized === "start") {
    return { label: value, action: "start" };
  }
  if (normalized === "done" || normalized === "complete" || normalized === "finish with proof") {
    return { label: "Finish with proof", action: "done" };
  }
  return { label: value === "Open" ? "Open" : value, action: "open" };
}

function actionLabelFromKey(action) {
  const labels = {
    start: "Start",
    unblock: "Set Blocker: None",
    block: "Block",
    done: "Finish with proof",
    open: "Open"
  };
  return labels[action] || normalizeText(action, 40) || "Button";
}

function packActionSignature(pack) {
  return JSON.stringify({
    status: pack?.status || "",
    blocker: pack?.blocker || "",
    next: pack?.next || ""
  });
}

function packCommandSignature(pack) {
  return JSON.stringify({
    title: pack?.title || "",
    status: pack?.status || "",
    blocker: pack?.blocker || "",
    next: pack?.next || "",
    doneWhen: pack?.doneWhen || ""
  });
}

function addPackActivity(pack, message) {
  const copy = normalizeText(message, 400);
  if (!pack || !copy) {
    return false;
  }

  pack.activity = Array.isArray(pack.activity) ? pack.activity : [];
  if (pack.activity[0] === copy) {
    return false;
  }

  pack.activity.unshift(copy);
  return true;
}

function proofTargetForPack(pack) {
  return normalizeText(pack?.doneWhen, 1000) || DEMO_PROOF_TARGET_MISSING;
}

function proofTargetSentence(pack) {
  return `Proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function proofSavedActivity(pack) {
  return `Done saved with proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function sentenceValue(value) {
  return (normalizeText(value) || DEMO_PROOF_TARGET_MISSING).replace(/[.!?]+$/u, "");
}

function workTitle(pack) {
  return normalizeText(pack?.title, 200) || "selected work";
}

function blockerTextForPack(pack) {
  if (!pack) {
    return "choose work";
  }
  if (hasBlocker(pack)) {
    return normalizeStoredBlocker(pack.blocker) !== DEMO_BLOCKER_NONE
      ? normalizeStoredBlocker(pack.blocker)
      : "blocked";
  }
  if (isMissingNextAction(pack)) {
    return "missing Button runs next";
  }
  return DEMO_BLOCKER_NONE_LABEL;
}

function hasBlocker(pack) {
  if (!pack) {
    return false;
  }
  const storage = normalizeStoredBlocker(pack.blocker);
  return storage !== DEMO_BLOCKER_NONE || normalizeText(pack.status, 40).toLowerCase() === "blocked";
}

function isMissingNextAction(pack) {
  return isPlaceholderNext(pack?.next);
}

function isPlaceholderNext(label) {
  const value = normalizeText(label, 120).toLowerCase();
  return !value || value === "choose action" || value === "choose next action" || value === "set button runs next" || value === "set next";
}

function normalizeStoredBlocker(value) {
  const blocker = normalizeText(value, 200);
  return blocker && blocker.toLowerCase() !== DEMO_BLOCKER_NONE
    ? blocker
    : DEMO_BLOCKER_NONE;
}

function visibleText(value, limit) {
  const text = normalizeText(value, 2000);
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(1, limit - 3)).trimEnd()}...`;
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

function isCorsRequestAllowed(request) {
  const origin = normalizedCorsOrigin(request.headers.origin);
  return !origin || Boolean(allowedCorsOrigin(origin, request));
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
    "access-control-allow-methods": CORS_ALLOWED_METHODS,
    "access-control-allow-headers": CORS_ALLOWED_HEADERS,
    "access-control-max-age": "600"
  };
}

function allowedCorsOrigin(origin, request) {
  if (!origin) {
    return "";
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
    request.headers.host,
    request.headers["x-forwarded-host"]
  ];
  return values
    .flatMap((value) => String(value || "").split(","))
    .map((host) => normalizeText(host, 300).toLowerCase())
    .filter(Boolean);
}

function sendJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...corsHeadersForRequest(request),
    "content-type": "application/json; charset=utf-8",
    "vary": `Origin, ${API_CLIENT_HEADER}`
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendEmpty(requestOrResponse, responseOrStatusCode, maybeStatusCode) {
  const hasRequest = maybeStatusCode !== undefined;
  const request = hasRequest ? requestOrResponse : null;
  const response = hasRequest ? responseOrStatusCode : requestOrResponse;
  const statusCode = hasRequest ? maybeStatusCode : responseOrStatusCode;
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...corsHeadersForRequest(request),
    "vary": `Origin, ${API_CLIENT_HEADER}`
  });
  response.end();
}

function httpError(statusCode, message, detail) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.detail = detail;
  return error;
}
