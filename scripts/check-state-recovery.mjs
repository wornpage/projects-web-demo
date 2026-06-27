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

  await checkDefaultStatePath();

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
  await stopServer(server);
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

async function checkDefaultStatePath() {
  const defaultRoot = path.join(tmpDir, "default-user-data");
  const defaultPort = await freePort();
  const expectedPrefix = expectedDefaultStatePrefix();
  const defaultServer = spawn(process.execPath, ["server/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      APPDATA: path.join(defaultRoot, "app-data"),
      HOME: path.join(defaultRoot, "home"),
      HOST: "127.0.0.1",
      LOCALAPPDATA: path.join(defaultRoot, "local-app-data"),
      PORT: String(defaultPort),
      PROJECTS_STATE_FILE: "",
      PROJECTS_STATE_STORAGE: "file",
      XDG_DATA_HOME: path.join(defaultRoot, "xdg-data"),
      XDG_STATE_HOME: path.join(defaultRoot, "xdg-state")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let defaultStdout = "";
  let defaultStderr = "";
  defaultServer.stdout.on("data", (chunk) => {
    defaultStdout += chunk;
  });
  defaultServer.stderr.on("data", (chunk) => {
    defaultStderr += chunk;
  });

  try {
    await waitForHealth(defaultPort);
    const defaultClient = "default-state-path-check";
    const initialState = await jsonRequest(defaultPort, "/api/state", {
      headers: { "x-projects-demo-client": defaultClient }
    });
    const savedState = await jsonRequest(defaultPort, "/api/state", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-projects-demo-client": defaultClient
      },
      body: JSON.stringify(stateWithCheckPack(initialState.body, "default-state-path-check", "Default state path check"))
    });
    const files = (await listFiles(defaultRoot))
      .map((file) => path.relative(defaultRoot, file).replace(/\\/gu, "/"));
    check("default file state writes successfully", savedState.status === 200, savedState.status);
    check("default file state uses user data directory", files.some((file) => file.startsWith(expectedPrefix) && /state\.[a-f0-9]{32}\.json$/u.test(file)), files.join(", ") || "none");
    check("default file state avoids the repo data directory", !files.some((file) => file.startsWith("server/data/")), files.join(", ") || "none");
  } catch (error) {
    if (defaultStdout.trim()) {
      console.error(defaultStdout.trim());
    }
    if (defaultStderr.trim()) {
      console.error(defaultStderr.trim());
    }
    throw error;
  } finally {
    await stopServer(defaultServer);
  }
}

function expectedDefaultStatePrefix() {
  if (process.platform === "win32") {
    return "local-app-data/projects-web-demo/";
  }
  if (process.platform === "darwin") {
    return "home/Library/Application Support/projects-web-demo/";
  }
  return "xdg-state/projects-web-demo/";
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(file));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }
  return files;
}

async function stopServer(activeServer) {
  activeServer.kill();
  await new Promise((resolve) => {
    activeServer.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
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
