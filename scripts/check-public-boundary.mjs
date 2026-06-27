#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

  const health = await jsonRequest(port, "/api/health");
  const appShell = await request(port, "/");
  for (const pathname of [
    "/",
    "/index.html",
    "/assets/demo.js",
    "/assets/demo.css",
    "/assets/app.css",
    "/assets/favicon.png",
    "/data/demo-packs.json"
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
    "/data/not-allowlisted.json"
  ]) {
    const response = await request(port, pathname);
    check(`private repo file blocked: ${pathname}`, response.status === 404, response.status);
  }

  for (const pathname of [
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
  const packTitle = `Boundary check ${Date.now().toString(36)}`;
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
  const defaultState = await jsonRequest(port, "/api/state");
  check("client A reads its created work", stateHasPackTitle(clientAState.body, packTitle), clientAState.status);
  check("client B does not read client A work", !stateHasPackTitle(clientBState.body, packTitle), clientBState.status);
  check("default local file row does not read client A work", !stateHasPackTitle(defaultState.body, packTitle), defaultState.status);

  const files = await fs.readdir(tmpDir);
  check("keyed local state uses hashed filenames", files.some((file) => /^state\.[a-f0-9]{32}\.json$/u.test(file)), files.join(", "));
  check("keyed local state filenames hide raw client keys", files.every((file) => !file.includes(clientA) && !file.includes(clientB)), files.join(", "));

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
