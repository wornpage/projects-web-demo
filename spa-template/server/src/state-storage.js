// State storage: Postgres (DATABASE_URL) or local file (STATE_DIR).

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

function createStateStorage(env = process.env) {
  if (env.DATABASE_URL) {
    return createPostgresStorage(env.DATABASE_URL);
  }
  return createFileStorage(env);
}

// ---- Postgres ----
function createPostgresStorage(databaseUrl) {
  let pool = null;
  const ready = (async () => {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: databaseUrl, max: 4, idleTimeoutMillis: 30_000 });
    await pool.query("SELECT 1");
  })();

  return {
    label: "postgres",
    ready,
    async get(key) {
      const result = await pool.query("SELECT value FROM app_state WHERE key = $1", [key]);
      return result.rows[0] ? JSON.parse(result.rows[0].value) : null;
    },
    async set(key, value) {
      await pool.query(
        "INSERT INTO app_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
        [key, JSON.stringify(value)]
      );
    },
    async close() {
      if (pool) await pool.end();
    }
  };
}

// ---- File ----
function createFileStorage(env) {
  const dir = env.STATE_DIR || path.join(process.env.LOCALAPPDATA || path.join(require("node:os").homedir(), ".local"), "__PROJECT_SLUG__");
  const key = env.STATE_KEY || "default";
  const hashed = crypto.createHash("sha256").update(key).digest("hex");
  const filePath = path.join(dir, `state.${hashed}.json`);

  return {
    label: `file:${filePath}`,
    ready: (async () => {
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "{}", "utf8");
      }
    })(),
    async get(_key) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
      } catch {
        return {};
      }
    },
    async set(_key, value) {
      fs.writeFileSync(filePath, JSON.stringify(value), "utf8");
    },
    async close() {
      // no-op for file storage
    }
  };
}

module.exports = { createStateStorage };
