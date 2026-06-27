"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5179);
const ROOT_DIR = path.resolve(__dirname, "..");
const SEED_PACKS_FILE = path.join(ROOT_DIR, "data", "demo-packs.json");
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = process.env.PROJECTS_STATE_FILE || path.join(DATA_DIR, "state.json");
const MAX_BODY_BYTES = 1024 * 1024;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type"
};

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

server.listen(PORT, HOST, () => {
  console.log(`Projects demo API listening at http://${HOST}:${PORT}`);
  console.log(`State file: ${STATE_FILE}`);
});

async function routeRequest(request, response, url) {
  const pathname = url.pathname.replace(/\/+$/u, "") || "/";
  const method = request.method || "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "projects-web-demo-api",
      stateFile: STATE_FILE,
      time: new Date().toISOString()
    });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, await readState());
    return;
  }

  if ((method === "PUT" || method === "POST") && pathname === "/api/state") {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await writeState(payload));
    return;
  }

  if (method === "GET" && pathname === "/api/packs") {
    const state = await readState();
    sendJson(response, 200, state.packs);
    return;
  }

  if (method === "POST" && pathname === "/api/packs") {
    const payload = await readJsonBody(request);
    const state = await readState();
    const pack = sanitizePack(payload);
    if (!pack.id) {
      pack.id = uniquePackId(state.packs, slugify(pack.title || "sample-work"));
    }
    if (state.packs.some((item) => item.id === pack.id)) {
      throw httpError(409, `Pack already exists: ${pack.id}`);
    }
    state.packs.unshift(pack);
    await writeState(state);
    sendJson(response, 201, pack);
    return;
  }

  const packMatch = pathname.match(/^\/api\/packs\/([^/]+)(?:\/memory)?$/u);
  if (packMatch) {
    const packId = decodeURIComponent(packMatch[1]);
    const isMemoryRoute = pathname.endsWith("/memory");
    if (method === "PATCH" && !isMemoryRoute) {
      const payload = await readJsonBody(request);
      const state = await readState();
      const pack = findPackOrThrow(state, packId);
      const updated = sanitizePack({ ...pack, ...payload, id: pack.id });
      Object.assign(pack, updated, { id: pack.id });
      await writeState(state);
      sendJson(response, 200, pack);
      return;
    }

    if (method === "POST" && isMemoryRoute) {
      const payload = await readJsonBody(request);
      const state = await readState();
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
      await writeState(state);
      sendJson(response, 200, pack);
      return;
    }
  }

  sendJson(response, 404, { error: "Not found" });
}

async function readState() {
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

async function writeState(payload) {
  const state = sanitizeState(payload);
  await fs.mkdir(DATA_DIR, { recursive: true });
  state.savedAt = new Date().toISOString();
  const tmpFile = path.join(DATA_DIR, `state.${crypto.randomUUID()}.tmp`);
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
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, corsHeaders);
  response.end();
}

function httpError(statusCode, message, detail) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.detail = detail;
  return error;
}
