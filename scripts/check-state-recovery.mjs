#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "projects-state-recovery-"));
const stateFile = path.join(tmpDir, "state.json");
const port = await freePort();
const checks = [];
const server = spawn(process.execPath, ["server/server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    PROJECTS_STATE_STORAGE: "file",
    PROJECTS_STATE_FILE: stateFile
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let stdout = "";
let stderr = "";
server.stdout.on("data", (chunk) => {
  stdout += chunk;
});
server.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  await waitForHealth(port);

  const clientA = "recovery-check-client-a";
  const clientB = "recovery-check-client-b";
  const stamp = Date.now().toString(36);
  const snapshotTitle = `Recovery snapshot ${stamp}`;
  const overwriteTitle = `Recovery overwritten ${stamp}`;
  const clientAHeaders = {
    "x-projects-demo-client": clientA
  };
  const clientBHeaders = {
    "x-projects-demo-client": clientB
  };

  const initialState = await jsonRequest(port, "/api/state", {
    headers: clientAHeaders
  });
  const snapshotState = stateWithCheckPack(initialState.body, "recovery-snapshot-check", snapshotTitle);
  const savedSnapshot = await jsonRequest(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...clientAHeaders
    },
    body: JSON.stringify(snapshotState)
  });
  check("client A snapshot writes successfully", savedSnapshot.status === 200, savedSnapshot.status);
  check("client A snapshot receives savedAt", Boolean(savedSnapshot.body.savedAt), savedSnapshot.body.savedAt || "missing");

  const exportedSnapshot = await jsonRequest(port, "/api/state", {
    headers: clientAHeaders
  });
  check("client A can export saved snapshot", stateHasPackTitle(exportedSnapshot.body, snapshotTitle), exportedSnapshot.status);

  const overwrittenState = stateWithCheckPack(exportedSnapshot.body, "recovery-snapshot-check", overwriteTitle);
  const savedOverwrite = await jsonRequest(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...clientAHeaders
    },
    body: JSON.stringify(overwrittenState)
  });
  check("client A can overwrite its row before restore", stateHasPackTitle(savedOverwrite.body, overwriteTitle), savedOverwrite.status);

  const restoredState = await jsonRequest(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...clientAHeaders
    },
    body: JSON.stringify(exportedSnapshot.body)
  });
  check("client A can restore exported snapshot", stateHasPackTitle(restoredState.body, snapshotTitle), restoredState.status);
  check("client A restore removes later overwrite", !stateHasPackTitle(restoredState.body, overwriteTitle), restoredState.status);

  const clientBState = await jsonRequest(port, "/api/state", {
    headers: clientBHeaders
  });
  check("client B does not read client A restored snapshot", !stateHasPackTitle(clientBState.body, snapshotTitle), clientBState.status);
  check("client B does not read client A overwrite", !stateHasPackTitle(clientBState.body, overwriteTitle), clientBState.status);

  const files = await fs.readdir(tmpDir);
  check("recovery state stays in keyed local file", files.some((file) => /^state\.[a-f0-9]{32}\.json$/u.test(file)), files.join(", "));
  check("recovery filenames hide client keys", files.every((file) => !file.includes(clientA) && !file.includes(clientB)), files.join(", "));
  check("recovery does not write an unkeyed local state file", !files.includes("state.json"), files.join(", "));

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }
  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nState recovery check passed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (stdout.trim()) {
    console.error(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  process.exitCode = 1;
} finally {
  server.kill();
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
  await fs.rm(tmpDir, { recursive: true, force: true });
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function stateWithCheckPack(state, id, title) {
  const packs = Array.isArray(state?.packs) ? state.packs : [];
  const checkPack = {
    id,
    title,
    type: "recovery-check",
    status: "active",
    blocker: "none",
    next: "Open",
    due: "",
    owner: "state recovery verifier",
    purpose: "Verify a keyed demo state snapshot can be restored.",
    doneWhen: "The exported state can be written back to the same client row.",
    sources: ["state-recovery-check"],
    memory: [],
    activity: ["State recovery verifier wrote this check row."]
  };
  return {
    ...state,
    packs: [checkPack, ...packs.filter((pack) => pack?.id !== id)],
    selectedId: id,
    status: `State recovery verifier wrote ${title}.`,
    actionReceipt: null
  };
}

function stateHasPackTitle(state, title) {
  return Array.isArray(state?.packs) && state.packs.some((pack) => pack?.title === title);
}

async function waitForHealth(activePort) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const response = await request(activePort, "/api/health").catch(() => null);
    if (response?.status === 200) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local recovery check server did not become healthy.");
}

async function jsonRequest(activePort, pathname, options = {}) {
  const response = await request(activePort, pathname, options);
  try {
    return {
      ...response,
      body: JSON.parse(response.text)
    };
  } catch {
    throw new Error(`${pathname} returned invalid JSON with status ${response.status}.`);
  }
}

function request(activePort, pathname, options = {}) {
  const body = options.body || "";
  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: "127.0.0.1",
      port: activePort,
      path: pathname,
      method: options.method || "GET",
      headers: {
        ...(options.headers || {})
      }
    };
    if (body) {
      requestOptions.headers["content-length"] = Buffer.byteLength(body);
    }

    const req = http.request(requestOptions, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          text
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a local port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}
