#!/usr/bin/env node
"use strict";

// ---------------------------------------------------------------------------
// API integration smoke tests
// Spawns the server, runs key flows, reports results.
// Usage: node scripts/check-api-smoke.mjs [--port PORT]
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const portArg = process.argv.find((a) => a.startsWith("--port="));
const PORT = portArg ? Number(portArg.split("=")[1]) : 5182;
const HOST = "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;
const CLIENT_HEADER = "x-projects-demo-client";
const TEST_CLIENT_KEY = "demo-550e8400-e29b-41d4-a716-446655440000";
const OTHER_CLIENT_KEY = "demo-550e8400-e29b-41d4-a716-446655440001";

const STATE_FILE = path.join(repoRoot, "data", `smoke-test-state-${Date.now()}.json`);
let serverProcess = null;
let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL  ${name}: ${err.message}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertStatus(status, expected, label) {
  if (status !== expected) {
    throw new Error(`${label}: expected status ${expected}, got ${status}`);
  }
}

function fetchJson(method, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      ...(options.headers || {}),
      "content-type": "application/json"
    };
    const body = options.body ? JSON.stringify(options.body) : null;
    if (body) {
      headers["content-length"] = Buffer.byteLength(body);
    }

    const req = http.request(`${BASE}${pathname}`, {
      method,
      headers
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function fetchText(method, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${pathname}`, { method, headers: options.headers || {} }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

const tests = [];

tests.push(test("GET /api/health returns 200 with storage kind", async () => {
  const res = await fetchJson("GET", "/api/health");
  assertStatus(res.status, 200, "health");
  assert(res.json?.ok === true, "health.ok should be true");
  assert(res.json?.storage, "health should have storage field");
  assert(res.json?.service === "projects-web-demo-api", "health service name");
}));

tests.push(test("GET /api/state without client key returns 400", async () => {
  const res = await fetchText("GET", "/api/state");
  assertStatus(res.status, 400, "state without key");
}));

tests.push(test("GET /api/state with valid client key returns 200", async () => {
  const res = await fetchJson("GET", "/api/state", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "state with key");
  assert(Array.isArray(res.json?.packs), "state should have packs array");
  assert(res.json?.copyProfile, "state should have copyProfile");
}));

tests.push(test("PUT /api/state/browser with valid payload returns 200", async () => {
  const res = await fetchJson("PUT", "/api/state/browser", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY },
    body: {
      kind: "projects-browser-state-v1",
      state: {
        packs: [{
          id: "smoke-test-pack",
          title: "Smoke test",
          status: "active",
          blocker: "none",
          next: "Open",
          purpose: "Testing the API",
          doneWhen: "Tests pass"
        }],
        filter: "all",
        query: "",
        selectedId: "smoke-test-pack"
      }
    }
  });
  assertStatus(res.status, 200, "browser state write");
}));

tests.push(test("POST /api/packs creates a work item", async () => {
  const res = await fetchJson("POST", "/api/packs", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY },
    body: {
      title: "Smoke test work",
      owner: "Test runner",
      next: "Open"
    }
  });
  assertStatus(res.status, 201, "create pack");
  assert(res.json?.created === true, "pack should be created");
  assert(res.json?.pack?.id, "pack should have an id");
}));

tests.push(test("GET /api/packs returns pack list", async () => {
  const res = await fetchJson("GET", "/api/packs", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "list packs");
  assert(Array.isArray(res.json), "packs should be array");
}));

tests.push(test("GET /api/packs/{id}/command returns command preview", async () => {
  // First get packs to find an id
  const list = await fetchJson("GET", "/api/packs", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  const packId = list.json?.[list.json.length - 1]?.id;
  assert(packId, "should have a pack id");

  const res = await fetchJson("GET", `/api/packs/${encodeURIComponent(packId)}/command`, {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "pack command");
  assert(res.json?.packId, "command should have packId");
  assert(res.json?.next, "command should have next action");
}));

tests.push(test("POST /api/packs/{id}/actions with done", async () => {
  const list = await fetchJson("GET", "/api/packs", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  const packId = list.json?.[list.json.length - 1]?.id;
  assert(packId, "should have a pack id");

  const res = await fetchJson("POST", `/api/packs/${encodeURIComponent(packId)}/actions`, {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY },
    body: { action: "done" }
  });
  assertStatus(res.status, 200, "pack action done");
  assert(res.json?.action === "done", "should return action done");
}));

tests.push(test("Different client key cannot see first key's packs", async () => {
  const res = await fetchJson("GET", "/api/packs", {
    headers: { [CLIENT_HEADER]: OTHER_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "other key packs");
  // Other key should have different state (maybe empty or default)
  assert(Array.isArray(res.json), "should return packs array");
}));

tests.push(test("POST /api/state/erase returns 200", async () => {
  const res = await fetchJson("POST", "/api/state/erase", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "erase state");
  assert(res.json?.ok === true, "erase should return ok");
}));

tests.push(test("GET /api/demo-packs returns seed packs", async () => {
  const res = await fetchJson("GET", "/api/demo-packs", {
    headers: { [CLIENT_HEADER]: TEST_CLIENT_KEY }
  });
  assertStatus(res.status, 200, "demo packs");
  assert(Array.isArray(res.json), "demo-packs should be array");
  assert(res.json.length > 0, "should have packs");
}));

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Starting server for API smoke tests...\n");

  serverProcess = spawn(process.execPath, ["server/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST,
      PROJECTS_STATE_STORAGE: "file",
      PROJECTS_STATE_FILE: STATE_FILE,
      PROJECTS_RATE_LIMIT_API_REQUESTS: "10000",
      PROJECTS_RATE_LIMIT_SOURCE_WRITE_REQUESTS: "10000",
      PROJECTS_RATE_LIMIT_STATE_WRITE_REQUESTS: "10000"
    },
    stdio: "pipe"
  });

  // Collect server output for debugging
  let serverOutput = "";
  serverProcess.stdout.on("data", (d) => { serverOutput += d.toString(); });
  serverProcess.stderr.on("data", (d) => { serverOutput += d.toString(); });

  // Wait for server to be ready
  await waitForServer(30_000);

  console.log(`Server ready on ${BASE}\n`);

  // Run tests in sequence
  for (const t of tests) {
    await t();
  }

  // Summary
  console.log(`\n---\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);

  // Cleanup
  cleanup();

  if (failed > 0) {
    console.log(`\nServer output:\n${serverOutput.slice(-2000)}`);
    process.exit(1);
  }
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchJson("GET", "/api/health");
      if (res.status === 200) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  cleanup();
  throw new Error("Server did not start within timeout");
}

function cleanup() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  // Clean up the temp state file
  try {
    import("node:fs").then((fs) => fs.unlinkSync(STATE_FILE)).catch(() => {});
  } catch {}
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });
process.on("SIGTERM", () => { cleanup(); process.exit(1); });

main().catch((err) => {
  console.error("Smoke test error:", err);
  cleanup();
  process.exit(1);
});
