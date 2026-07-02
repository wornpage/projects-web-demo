"use strict";

// ---------------------------------------------------------------------------
// Module: state-storage
// Postgres and file-based state storage implementations
// ---------------------------------------------------------------------------

const crypto = require("node:crypto");
const fileSystem = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const constants = require("./constants.js");
const validation = require("./validation.js");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5179);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SEED_PACKS_FILE = path.join(ROOT_DIR, "data", "demo-packs.json");
const STATE_FILE = process.env.PROJECTS_STATE_FILE || defaultStateFile();
const STATE_DIR = path.dirname(STATE_FILE);

function createStateStorage(seedModule) {
  const mode = normalizeStateStorageMode(
    process.env.PROJECTS_STATE_STORAGE || (hasPostgresConfig() ? "postgres" : "file")
  );

  if (mode === "postgres") {
    return createPostgresStateStorage(seedModule);
  }

  return createFileStateStorage(seedModule);
}

// --- File-based storage ---

function createFileStateStorage(seedModule) {
  return {
    label: `file:${STATE_FILE}`,
    ready: Promise.resolve(),
    close: async () => {},
    read: readFileState,
    write: writeFileState,
    erase: eraseFileState,
    ...seedModule ? { defaultState: seedModule.defaultState } : {}
  };
}

function defaultStateFile() {
  return path.join(defaultStateDir(), "state.json");
}

function defaultStateDir() {
  if (process.platform === "win32") {
    const appData = process.env.LOCALAPPDATA || process.env.APPDATA;
    if (appData) {
      return path.join(appData, "projects-web-demo");
    }
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "projects-web-demo");
  }

  const stateHome = process.env.XDG_STATE_HOME || process.env.XDG_DATA_HOME;
  if (stateHome) {
    return path.join(stateHome, "projects-web-demo");
  }

  return path.join(os.homedir(), ".local", "state", "projects-web-demo");
}

async function readFileState(stateKey) {
  const stateFile = fileStatePathForKey(stateKey);
  try {
    const text = await fs.readFile(stateFile, "utf8");
    return validation.sanitizeState(JSON.parse(text));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    const { defaultState } = require("./seed.js");
    return defaultState();
  }
}

async function writeFileState(payload, stateKey) {
  const stateFile = fileStatePathForKey(stateKey);
  const state = validation.sanitizeState(payload);
  await fs.mkdir(STATE_DIR, { recursive: true });
  state.savedAt = new Date().toISOString();
  const tmpFile = path.join(STATE_DIR, `${path.basename(stateFile)}.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, stateFile);
  return state;
}

async function eraseFileState(stateKey) {
  const stateFile = fileStatePathForKey(stateKey);
  await fs.unlink(stateFile).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
  const { defaultState } = require("./seed.js");
  return { ok: true, state: await defaultState() };
}

function fileStatePathForKey(stateKey) {
  const digest = crypto.createHash("sha256").update(validation.normalizeText(stateKey, 120)).digest("hex");
  const baseName = path.basename(STATE_FILE, ".json");
  const extension = path.extname(STATE_FILE) || ".json";
  return path.join(STATE_DIR, `${baseName}.${digest}${extension}`);
}

// --- Postgres storage ---

const DATABASE_URL = process.env.DATABASE_URL || "";

function createPostgresStateStorage(seedModule) {
  const poolOptions = postgresPoolOptions();
  if (!poolOptions) {
    throw new Error("DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD is required when PROJECTS_STATE_STORAGE=postgres.");
  }

  const { Pool } = require("pg");
  const pool = new Pool(poolOptions);

  pool.on("error", (error) => {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "Postgres pool error.",
      detail: error.message
    }));
  });

  pool.on("connect", (client) => {
    client.query("SET statement_timeout = '15s'").catch((err) => {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "Failed to set statement_timeout.",
        detail: err.message
      }));
    });
  });

  return {
    label: "postgres:projects_demo_state",
    ready: pool.query(`
      CREATE TABLE IF NOT EXISTS projects_demo_state (
        state_key text PRIMARY KEY,
        state_json jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now()
      )
    `),
    async close() {
      await pool.end();
    },
    async read(stateKey) {
      const key = postgresStateKey(stateKey);
      const result = await pool.query(
        `SELECT state_json
         FROM projects_demo_state
         WHERE state_key = $1
         LIMIT 1`,
        [key]
      );
      return result.rows[0]?.state_json ? validation.sanitizeState(result.rows[0].state_json) : seedModule.defaultState();
    },
    async write(payload, stateKey) {
      const key = postgresStateKey(stateKey);
      const state = validation.sanitizeState(payload);
      state.savedAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO projects_demo_state (state_key, state_json, saved_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (state_key) DO UPDATE
         SET state_json = EXCLUDED.state_json,
             saved_at = EXCLUDED.saved_at`,
        [key, JSON.stringify(state), state.savedAt]
      );
      return state;
    },
    async erase(stateKey) {
      const key = postgresStateKey(stateKey);
      await pool.query(
        `DELETE FROM projects_demo_state
         WHERE state_key = $1`,
        [key]
      );
      return { ok: true, state: await seedModule.defaultState() };
    }
  };
}

function postgresStateKey(stateKey) {
  const normalized = validation.normalizeText(stateKey, 120);
  if (!normalized) {
    throw new Error("State key is required.");
  }

  return `v2:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function postgresPoolOptions() {
  const ssl = postgresSslOption();
  const poolConfig = {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  };

  if (DATABASE_URL) {
    poolConfig.connectionString = DATABASE_URL;
    if (ssl !== undefined) {
      poolConfig.ssl = ssl;
    }
    return poolConfig;
  }

  if (!hasPostgresConfig()) {
    return null;
  }

  poolConfig.host = process.env.PGHOST;
  poolConfig.database = process.env.PGDATABASE;
  poolConfig.user = process.env.PGUSER;
  poolConfig.password = process.env.PGPASSWORD;

  const port = Number(process.env.PGPORT || 5432);
  if (Number.isInteger(port) && port > 0) {
    poolConfig.port = port;
  }
  if (ssl !== undefined) {
    poolConfig.ssl = ssl;
  }

  return poolConfig;
}

function postgresSslOption() {
  const mode = validation.normalizeText(process.env.PROJECTS_POSTGRES_SSL || process.env.PGSSLMODE, 20).toLowerCase();
  if (mode === "require" || mode === "prefer") {
    return { rejectUnauthorized: false };
  }
  if (mode === "disable") {
    return false;
  }
  return undefined;
}

function hasPostgresConfig() {
  return Boolean(DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD));
}

function normalizeStateStorageMode(value) {
  const mode = validation.normalizeText(value, 40).toLowerCase();
  if (!mode || mode === "file") {
    return "file";
  }
  if (mode === "postgres") {
    return "postgres";
  }
  throw new Error("PROJECTS_STATE_STORAGE must be \"file\" or \"postgres\".");
}

async function readState(stateKey, seedModule, storage) {
  if (storage) {
    return storage.read(stateKey);
  }
  // Fallback direct call
  const stateFile = fileStatePathForKey(stateKey);
  try {
    const text = await fs.readFile(stateFile, "utf8");
    return validation.sanitizeState(JSON.parse(text));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return seedModule.defaultState();
  }
}

async function writeState(payload, stateKey, options, storage) {
  if (storage) {
    return storage.write(payload, stateKey);
  }
  return writeFileState(payload, stateKey);
}

async function eraseState(stateKey, storage) {
  if (storage) {
    return storage.erase(stateKey);
  }
  return eraseFileState(stateKey);
}

function normalizeAssetVersion(value) {
  return validation.normalizeText(value, 120).replace(/[^A-Za-z0-9._-]/gu, "-") || "app";
}

function contentAssetVersion() {
  const hash = crypto.createHash("sha256");
  for (const relativePath of [
    "index.html",
    "assets/demo.css",
    "assets/demo.js",
    "assets/favicon.png",
    "data/demo-packs.json"
  ]) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(fileSystem.readFileSync(path.join(ROOT_DIR, relativePath)));
    hash.update("\0");
  }

  return `asset-${hash.digest("hex").slice(0, 12)}`;
}

module.exports = {
  createStateStorage,
  createFileStateStorage,
  createPostgresStateStorage,
  postgresStateKey,
  postgresPoolOptions,
  postgresSslOption,
  hasPostgresConfig,
  normalizeStateStorageMode,
  readFileState,
  writeFileState,
  eraseFileState,
  fileStatePathForKey,
  readState,
  writeState,
  eraseState,
  defaultStateFile,
  defaultStateDir,
  contentAssetVersion,
  normalizeAssetVersion,
  HOST,
  PORT,
  ROOT_DIR,
  SEED_PACKS_FILE,
  STATE_FILE,
  STATE_DIR
};
