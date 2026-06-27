#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_STATE_PACKS = 50;
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "projects-public-boundary-"));
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

  const serverSource = await fs.readFile(path.join(repoRoot, "server/server.js"), "utf8");
  const health = await jsonRequest(port, "/api/health");
  const appShell = await request(port, "/");
  for (const pathname of [
    "/",
    "/index.html",
    "/assets/demo.js",
    "/assets/demo.css",
    "/assets/favicon.png"
  ]) {
    const response = await request(port, pathname);
    check(`public asset allowed: ${pathname}`, response.status === 200, response.status);
  }
  const csp = appShell.headers["content-security-policy"] || "";
  const cspNonce = nonceFromCsp(csp);
  const htmlNonce = nonceFromHtml(appShell.text);
  check("app shell sends a content security policy", csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), csp || "missing");
  check("app shell blocks framing", csp.includes("frame-ancestors 'none'"), csp || "missing");
  check("app shell limits network calls to same origin", csp.includes("connect-src 'self'"), csp || "missing");
  check("runtime API script uses CSP nonce", Boolean(cspNonce) && cspNonce === htmlNonce, htmlNonce || "missing");
  check("script policy avoids unsafe inline scripts", csp.includes(`script-src 'self' 'nonce-${cspNonce}'`) && !scriptSrcDirective(csp).includes("'unsafe-inline'"), scriptSrcDirective(csp));
  const healthText = JSON.stringify(health.body);
  check("health endpoint reports only storage kind", health.body?.ok === true && health.body?.storage === "file", healthText);
  check("health endpoint hides storage internals", !("stateStorage" in health.body) && !healthText.includes(stateFile) && !/state\.json|projects_demo_state|DATABASE_URL|PGHOST|PGPASSWORD/iu.test(healthText), healthText);
  check("Postgres state keys are hashed before storage", /function postgresStateKey\(stateKey\)[\s\S]*v2:\$\{crypto\.createHash\("sha256"\)\.update\(normalized\)\.digest\("hex"\)\}/u.test(serverSource), "postgresStateKey");
  check("Postgres raw state-key path is migration-only", serverSource.includes("WHERE state_key = $1 OR state_key = $2") && serverSource.includes("DELETE FROM projects_demo_state WHERE state_key = $1"), "legacy read fallback plus delete");

  const sameOrigin = `http://127.0.0.1:${port}`;
  const sameOriginCors = await request(port, "/api/health", {
    headers: { origin: sameOrigin }
  });
  const blockedPreflight = await request(port, "/api/state", {
    method: "OPTIONS",
    headers: {
      origin: "https://untrusted.example",
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type, x-projects-demo-client"
    }
  });
  check("same-origin API CORS is exact, not wildcard", sameOriginCors.headers["access-control-allow-origin"] === sameOrigin, sameOriginCors.headers["access-control-allow-origin"] || "missing");
  check("same-origin API CORS omits retired PATCH method", !String(sameOriginCors.headers["access-control-allow-methods"] || "").includes("PATCH"), sameOriginCors.headers["access-control-allow-methods"] || "missing");
  check("third-party API preflight is rejected", blockedPreflight.status === 403 && !blockedPreflight.headers["access-control-allow-origin"], `${blockedPreflight.status} / ${blockedPreflight.headers["access-control-allow-origin"] || "no cors"}`);

  const retiredPatch = await request(port, "/api/packs/source-folder-audit", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": "local-check-client-a"
    },
    body: JSON.stringify({ status: "done" })
  });
  check("generic pack PATCH route is retired", retiredPatch.status === 404, retiredPatch.status);

  const retiredStatePost = await request(port, "/api/state", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": "local-check-client-a"
    },
    body: JSON.stringify({ packs: [] })
  });
  check("generic state POST route is retired", retiredStatePost.status === 404, retiredStatePost.status);

  const unkeyedSeedPacks = await request(port, "/api/demo-packs");
  check("unkeyed API seed data is rejected", unkeyedSeedPacks.status === 400, unkeyedSeedPacks.status);

  for (const pathname of [
    "/README.md",
    "/Dockerfile",
    "/server/server.js",
    "/server/package-lock.json",
    "/docs/deploy-outplane.md",
    "/docs/public-exposure-audit.md",
    "/render.yaml",
    "/.git/config",
    "/assets/../server/server.js",
    "/assets/%2e%2e/server/server.js",
    "/assets/not-allowlisted.txt",
    "/assets/private/demo.js",
    "/data/demo-packs.json",
    "/data/not-allowlisted.json"
  ]) {
    const response = await request(port, pathname);
    check(`non-public app file blocked: ${pathname}`, response.status === 404, response.status);
  }

  for (const pathname of [
    "/assets/app.css",
    "/assets/demo.js.map",
    "/assets/demo.css.map",
    "/assets/app.css.map",
    "/assets/demo-metadata.json"
  ]) {
    const response = await request(port, pathname);
    check(`retired public asset not served: ${pathname}`, response.status === 404, response.status);
  }

  const clientA = "local-check-client-a";
  const clientB = "local-check-client-b";
  const limitClient = "local-check-limit-client";
  const packTitle = `Boundary check ${Date.now().toString(36)}`;
  const seedPacks = await jsonRequest(port, "/api/demo-packs", {
    headers: { "x-projects-demo-client": clientA }
  });
  check("client A can load keyed API seed data", Array.isArray(seedPacks.body) && seedPacks.body.length > 0, seedPacks.status);
  const createResponse = await request(port, "/api/packs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({
      title: packTitle,
      owner: "public-boundary-check",
      next: "Open",
      purpose: "Verify keyed local state does not mix.",
      doneWhen: "Only client A can read this created work."
    })
  });
  check("client A can create keyed work", createResponse.status === 201, createResponse.status);

  const clientAState = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  const clientBState = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientB }
  });
  const unkeyedState = await request(port, "/api/state");
  const nonJsonStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "text/plain",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "non-json-boundary"))
  });
  const oversizedStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(MAX_STATE_PACKS + 1, "oversized-boundary"))
  });
  const limitStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": limitClient
    },
    body: JSON.stringify(stateWithGeneratedPacks(MAX_STATE_PACKS, "limit-boundary"))
  });
  const overLimitCreate = await request(port, "/api/packs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": limitClient
    },
    body: JSON.stringify({
      title: "Extra boundary work",
      owner: "public-boundary-check",
      next: "Open",
      purpose: "Verify capped state rows do not grow past the backend limit.",
      doneWhen: "The backend rejects the create request."
    })
  });
  const clientAStateAfterRejectedWrite = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  check("client A reads its created work", stateHasPackTitle(clientAState.body, packTitle), clientAState.status);
  check("client B does not read client A work", !stateHasPackTitle(clientBState.body, packTitle), clientBState.status);
  check("unkeyed local API state is rejected", unkeyedState.status === 400, unkeyedState.status);
  check("non-json state snapshots are rejected", nonJsonStateWrite.status === 415, nonJsonStateWrite.status);
  check("oversized keyed state snapshots are rejected", oversizedStateWrite.status === 400, oversizedStateWrite.status);
  check("client A state survives rejected oversized snapshot", stateHasPackTitle(clientAStateAfterRejectedWrite.body, packTitle), clientAStateAfterRejectedWrite.status);
  check("state rows can reach the documented work cap", limitStateWrite.status === 200, limitStateWrite.status);
  check("creating work past the state cap is rejected", overLimitCreate.status === 400, overLimitCreate.status);

  const files = await fs.readdir(tmpDir);
  check("keyed local state uses hashed filenames", files.some((file) => /^state\.[a-f0-9]{32}\.json$/u.test(file)), files.join(", "));
  check("keyed local state filenames hide raw client keys", files.every((file) => !file.includes(clientA) && !file.includes(clientB)), files.join(", "));
  check("unkeyed local state file is not written", !files.includes("state.json"), files.join(", "));

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }
  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nPublic boundary check passed.");
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

function stateHasPackTitle(state, title) {
  return Array.isArray(state?.packs) && state.packs.some((pack) => pack?.title === title);
}

function stateWithGeneratedPacks(count, prefix) {
  const packs = Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `Generated boundary work ${index + 1}`,
    type: "limit-check",
    status: "active",
    blocker: "none",
    next: "Open",
    due: "",
    owner: "public-boundary-check",
    purpose: "Verify backend state row limits.",
    doneWhen: "The backend accepts only bounded state rows.",
    sources: ["public-boundary-check"],
    memory: [],
    activity: []
  }));
  return {
    packs,
    selectedId: packs[0]?.id || "",
    copyProfile: "general",
    scenarioId: "default",
    status: "Generated state limit check.",
    actionReceipt: null,
    filter: "all",
    query: ""
  };
}

function nonceFromCsp(csp) {
  const match = csp.match(/script-src[^;]*'nonce-([^']+)'/u);
  return match?.[1] || "";
}

function nonceFromHtml(html) {
  const match = html.match(/<script nonce="([^"]+)">window\.PROJECTS_API_BASE_URL/u);
  return match?.[1] || "";
}

function scriptSrcDirective(csp) {
  return csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) || "";
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
  throw new Error("Local boundary check server did not become healthy.");
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
