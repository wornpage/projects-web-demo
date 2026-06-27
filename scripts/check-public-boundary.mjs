#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_STATE_PACKS = 50;
const MAX_PLAIN_VALUE_DEPTH = 6;
const MAX_PLAIN_OBJECT_KEYS = 40;
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
  const frontendSource = await fs.readFile(path.join(repoRoot, "assets/demo.js"), "utf8");
  const health = await jsonRequest(port, "/api/health");
  const appShell = await request(port, "/");
  const runtimeConfigPath = runtimeConfigPathFromHtml(appShell.text);
  const expectedAssetVersion = await contentAssetVersion();
  const runtimeConfig = await request(port, `/${runtimeConfigPath}`);
  const invalidHostHealth = await rawRequest(port, [
    "GET /api/health HTTP/1.1",
    "Host: bad host",
    "Connection: close",
    "",
    ""
  ].join("\r\n"));
  for (const pathname of [
    "/",
    "/index.html",
    "/assets/runtime-config.js",
    "/assets/demo.js",
    "/assets/demo.css",
    "/assets/favicon.png"
  ]) {
    const response = await request(port, pathname);
    check(`public asset allowed: ${pathname}`, response.status === 200, response.status);
  }
  const csp = appShell.headers["content-security-policy"] || "";
  check("app shell sends a content security policy", csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), csp || "missing");
  check("app shell blocks framing", csp.includes("frame-ancestors 'none'"), csp || "missing");
  check("app shell sends legacy frame deny header", appShell.headers["x-frame-options"] === "DENY", appShell.headers["x-frame-options"] || "missing");
  check("app shell limits cross-origin resource reuse", appShell.headers["cross-origin-resource-policy"] === "same-origin", appShell.headers["cross-origin-resource-policy"] || "missing");
  check("app shell isolates opener context", appShell.headers["cross-origin-opener-policy"] === "same-origin", appShell.headers["cross-origin-opener-policy"] || "missing");
  check("app shell requires cross-origin embedder policy", appShell.headers["cross-origin-embedder-policy"] === "require-corp", appShell.headers["cross-origin-embedder-policy"] || "missing");
  check("app shell disables sensitive browser permissions", permissionsPolicyDisables(appShell.headers["permissions-policy"], ["camera", "geolocation", "microphone", "payment", "usb"]), appShell.headers["permissions-policy"] || "missing");
  check("app shell opts out of search indexing", appShell.headers["x-robots-tag"] === "noindex, nofollow, noarchive", appShell.headers["x-robots-tag"] || "missing");
  check("app shell limits network calls to same origin", csp.includes("connect-src 'self'"), csp || "missing");
  check("runtime API config loads before the frontend script", runtimeConfigPath && appShell.text.indexOf("assets/runtime-config.js") < appShell.text.indexOf("assets/demo.js"), runtimeConfigPath || "missing");
  check("runtime asset version is content-derived", appShellUsesAssetVersion(appShell.text, expectedAssetVersion) && runtimeConfigPath === `assets/runtime-config.js?v=${expectedAssetVersion}`, runtimeConfigPath || "missing");
  check("runtime API config is served as same-origin JavaScript", runtimeConfig.text.includes("window.PROJECTS_API_BASE_URL = location.origin;"), runtimeConfig.text.trim() || "missing");
  check("app shell contains no inline scripts", !hasInlineScript(appShell.text), "external scripts only");
  check("script policy avoids unsafe inline scripts", scriptSrcDirective(csp) === "script-src 'self'", scriptSrcDirective(csp) || "missing");
  check("style policy avoids unsafe inline styles", styleSrcDirective(csp) === "style-src 'self'", styleSrcDirective(csp) || "missing");
  check("content policy blocks unused loaders", cspBlocksUnusedLoaders(csp), unusedLoaderDirectiveDetail(csp));
  const healthText = JSON.stringify(health.body);
  check("health endpoint reports only storage kind", health.body?.ok === true && health.body?.storage === "file", healthText);
  check("health endpoint hides storage internals", !("stateStorage" in health.body) && !healthText.includes(stateFile) && !/state\.json|projects_demo_state|DATABASE_URL|PGHOST|PGPASSWORD/iu.test(healthText), healthText);
  check("invalid Host header stays inside normal request handling", invalidHostHealth.status === 200 && /projects-web-demo-api/u.test(invalidHostHealth.text), invalidHostHealth.status);
  check("API health sends shared security headers", sharedSecurityHeadersOk(health.headers), sharedSecurityHeaderDetail(health.headers));
  check("Postgres state keys are hashed before storage", /function postgresStateKey\(stateKey\)[\s\S]*v2:\$\{crypto\.createHash\("sha256"\)\.update\(normalized\)\.digest\("hex"\)\}/u.test(serverSource), "postgresStateKey");
  check("Postgres raw state-key fallback is retired", !serverSource.includes("postgresStateKeys(") && !serverSource.includes("WHERE state_key = $1 OR state_key = $2") && !serverSource.includes("DELETE FROM projects_demo_state WHERE state_key = $1"), "digest-only state_key path");
  const writeRouteOrder = writeRoutesValidateKeyBeforeBody(serverSource);
  check("state-changing routes validate client keys before body parsing", writeRouteOrder.ok, writeRouteOrder.detail);
  check("state erase validates client key before deleting", eraseRouteValidatesKey(serverSource), "stateKeyForRequest required");
  const backendPendingMarkers = backendCommandPendingMarkers(frontendSource);
  check("backend app mode waits for server command preview", backendPendingMarkers.ok, backendPendingMarkers.detail);

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
  const blockedMethodPreflight = await request(port, "/api/state", {
    method: "OPTIONS",
    headers: {
      origin: sameOrigin,
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "content-type, x-projects-demo-client"
    }
  });
  const blockedHeaderPreflight = await request(port, "/api/state", {
    method: "OPTIONS",
    headers: {
      origin: sameOrigin,
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type, x-projects-demo-client, x-extra-demo-header"
    }
  });
  const spoofedForwardedCors = await request(port, "/api/health", {
    headers: {
      origin: "https://spoofed.example",
      "x-forwarded-host": "spoofed.example"
    }
  });
  check("same-origin API CORS is exact, not wildcard", sameOriginCors.headers["access-control-allow-origin"] === sameOrigin, sameOriginCors.headers["access-control-allow-origin"] || "missing");
  check("same-origin API CORS omits retired PATCH method", !String(sameOriginCors.headers["access-control-allow-methods"] || "").includes("PATCH"), sameOriginCors.headers["access-control-allow-methods"] || "missing");
  check("third-party API preflight is rejected", blockedPreflight.status === 403 && !blockedPreflight.headers["access-control-allow-origin"], `${blockedPreflight.status} / ${blockedPreflight.headers["access-control-allow-origin"] || "no cors"}`);
  check("disallowed API preflight method is rejected", blockedMethodPreflight.status === 403 && !blockedMethodPreflight.headers["access-control-allow-origin"], `${blockedMethodPreflight.status} / ${blockedMethodPreflight.headers["access-control-allow-origin"] || "no cors"}`);
  check("disallowed API preflight header is rejected", blockedHeaderPreflight.status === 403 && !blockedHeaderPreflight.headers["access-control-allow-origin"], `${blockedHeaderPreflight.status} / ${blockedHeaderPreflight.headers["access-control-allow-origin"] || "no cors"}`);
  check("forwarded host cannot authorize API CORS", !spoofedForwardedCors.headers["access-control-allow-origin"], spoofedForwardedCors.headers["access-control-allow-origin"] || "no cors");

  const retiredPatch = await request(port, "/api/packs/source-folder-audit", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": "demo-00000000-0000-4000-8000-000000000001"
    },
    body: JSON.stringify({ status: "done" })
  });
  check("generic pack PATCH route is retired", retiredPatch.status === 404, retiredPatch.status);

  const retiredStatePost = await request(port, "/api/state", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": "demo-00000000-0000-4000-8000-000000000001"
    },
    body: JSON.stringify({ packs: [] })
  });
  check("generic state POST route is retired", retiredStatePost.status === 404, retiredStatePost.status);

  const unkeyedSeedPacks = await request(port, "/api/demo-packs");
  const unkeyedPacks = await request(port, "/api/packs");
  const unkeyedCommandPreview = await request(port, "/api/packs/source-folder-audit/command");
  const unkeyedWorkflowWrites = await Promise.all([
    ["pack create", "/api/packs"],
    ["work path", "/api/packs/source-folder-audit/path"],
    ["next action", "/api/packs/source-folder-audit/next"],
    ["pack action", "/api/packs/source-folder-audit/actions"],
    ["memory action", "/api/packs/source-folder-audit/memory"]
  ].map(async ([name, pathname]) => {
    const response = await request(port, pathname, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ action: "open", next: "Open", note: "Missing-key boundary check." })
    });
    return [name, response.status];
  }));
  check("unkeyed API seed data is rejected", unkeyedSeedPacks.status === 400, unkeyedSeedPacks.status);
  check("unkeyed API pack list is rejected", unkeyedPacks.status === 400, unkeyedPacks.status);
  check("unkeyed API command preview is rejected", unkeyedCommandPreview.status === 400, unkeyedCommandPreview.status);
  check(
    "unkeyed API workflow writes reject missing client key before body parsing",
    unkeyedWorkflowWrites.every(([, status]) => status === 400),
    unkeyedWorkflowWrites.map(([name, status]) => `${name}:${status}`).join(", ")
  );

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

  const clientA = "demo-00000000-0000-4000-8000-000000000001";
  const clientB = "demo-00000000-0000-4000-8000-000000000002";
  const limitClient = "demo-00000000-0000-4000-8000-000000000003";
  const packTitle = `Boundary check ${Date.now().toString(36)}`;
  const clientBTitle = `Boundary other row ${Date.now().toString(36)}`;
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
  const clientBStateSeed = stateWithGeneratedPacks(1, "other-row-boundary");
  clientBStateSeed.packs[0].title = clientBTitle;
  const clientBWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientB
    },
    body: JSON.stringify(clientBStateSeed)
  });
  const unkeyedState = await request(port, "/api/state");
  const weakKeyedState = await request(port, "/api/state", {
    headers: { "x-projects-demo-client": "password1" }
  });
  const readableSyncKeyedState = await request(port, "/api/state", {
    headers: { "x-projects-demo-client": "sync-pass-word-pass" }
  });
  const unkeyedNonJsonStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "text/plain"
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "unkeyed-non-json-boundary"))
  });
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
  const duplicateIdStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithDuplicatePackIds("duplicate-id-boundary"))
  });
  const invalidPackStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithMissingPackTitle("missing-title-boundary"))
  });
  const deepReceiptStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "deep-receipt-boundary", {
      actionReceipt: deepActionReceipt(MAX_PLAIN_VALUE_DEPTH + 1)
    }))
  });
  const wideReceiptStateWrite = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "wide-receipt-boundary", {
      actionReceipt: wideActionReceipt(MAX_PLAIN_OBJECT_KEYS + 1)
    }))
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
  const unkeyedErase = await request(port, "/api/state/erase", {
    method: "POST"
  });
  const eraseClientAState = await request(port, "/api/state/erase", {
    method: "POST",
    headers: { "x-projects-demo-client": clientA }
  });
  const clientAStateAfterErase = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  const clientBStateAfterErase = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientB }
  });
  check("client A reads its created work", stateHasPackTitle(clientAState.body, packTitle), clientAState.status);
  check("client B does not read client A work", !stateHasPackTitle(clientBState.body, packTitle), clientBState.status);
  check("client B can write its own row", clientBWrite.status === 200, clientBWrite.status);
  check("unkeyed local API state is rejected", unkeyedState.status === 400, unkeyedState.status);
  check("weak manual API client keys are rejected", weakKeyedState.status === 400, weakKeyedState.status);
  check("readable sync-code API client keys are rejected", readableSyncKeyedState.status === 400, readableSyncKeyedState.status);
  check("unkeyed local API state writes are rejected before body parsing", unkeyedNonJsonStateWrite.status === 400, unkeyedNonJsonStateWrite.status);
  check("non-json state snapshots are rejected", nonJsonStateWrite.status === 415, nonJsonStateWrite.status);
  check("oversized keyed state snapshots are rejected", oversizedStateWrite.status === 400, oversizedStateWrite.status);
  check("duplicate work ids in keyed state snapshots are rejected", duplicateIdStateWrite.status === 400, duplicateIdStateWrite.status);
  check("invalid work items in keyed state snapshots are rejected", invalidPackStateWrite.status === 400, invalidPackStateWrite.status);
  check("deep action receipts are rejected", deepReceiptStateWrite.status === 400, deepReceiptStateWrite.status);
  check("wide action receipts are rejected", wideReceiptStateWrite.status === 400, wideReceiptStateWrite.status);
  check("client A state survives rejected oversized snapshot", stateHasPackTitle(clientAStateAfterRejectedWrite.body, packTitle), clientAStateAfterRejectedWrite.status);
  check("state rows can reach the documented work cap", limitStateWrite.status === 200, limitStateWrite.status);
  check("creating work past the state cap is rejected", overLimitCreate.status === 400, overLimitCreate.status);
  check("unkeyed backend state erase is rejected", unkeyedErase.status === 400, unkeyedErase.status);
  check("current keyed backend state can be erased", eraseClientAState.status === 200 && eraseClientAState.text.includes("\"ok\":true"), eraseClientAState.status);
  check("erased keyed backend state no longer has client work", !stateHasPackTitle(clientAStateAfterErase.body, packTitle), clientAStateAfterErase.status);
  check("erasing one keyed state keeps another client row", stateHasPackTitle(clientBStateAfterErase.body, clientBTitle), clientBStateAfterErase.status);

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

function stateWithGeneratedPacks(count, prefix, options = {}) {
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
    actionReceipt: options.actionReceipt ?? null,
    filter: "all",
    query: ""
  };
}

function stateWithDuplicatePackIds(prefix) {
  const state = stateWithGeneratedPacks(2, prefix);
  state.packs[1].id = state.packs[0].id;
  return state;
}

function stateWithMissingPackTitle(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].title = "";
  return state;
}

function deepActionReceipt(depth) {
  let value = { summary: "Deep action receipt" };
  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }
  return value;
}

function wideActionReceipt(keyCount) {
  return Object.fromEntries(
    Array.from({ length: keyCount }, (_, index) => [`key${index + 1}`, index + 1])
  );
}

function runtimeConfigPathFromHtml(html) {
  const match = html.match(/<script src="(assets\/runtime-config\.js\?v=[^"]+)" defer><\/script>/u);
  return match?.[1] || "";
}

async function contentAssetVersion() {
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
    hash.update(await fs.readFile(path.join(repoRoot, relativePath)));
    hash.update("\0");
  }

  return `asset-${hash.digest("hex").slice(0, 12)}`;
}

function appShellUsesAssetVersion(html, version) {
  return html.includes(`href="assets/demo.css?v=${version}"`)
    && html.includes(`src="assets/runtime-config.js?v=${version}"`)
    && html.includes(`src="assets/demo.js?v=${version}"`);
}

function hasInlineScript(html) {
  return /<script(?![^>]*\bsrc=)[^>]*>/iu.test(html);
}

function scriptSrcDirective(csp) {
  return csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) || "";
}

function styleSrcDirective(csp) {
  return cspDirective(csp, "style-src");
}

function cspBlocksUnusedLoaders(csp) {
  return cspDirective(csp, "frame-src") === "frame-src 'none'"
    && cspDirective(csp, "worker-src") === "worker-src 'none'"
    && cspDirective(csp, "font-src") === "font-src 'self'"
    && cspDirective(csp, "media-src") === "media-src 'none'"
    && cspDirective(csp, "manifest-src") === "manifest-src 'none'";
}

function unusedLoaderDirectiveDetail(csp) {
  return ["frame-src", "worker-src", "font-src", "media-src", "manifest-src"]
    .map((name) => cspDirective(csp, name) || `${name}=missing`)
    .join("; ");
}

function cspDirective(csp, name) {
  return csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(name)) || "";
}

function permissionsPolicyDisables(value, features) {
  const policy = String(value || "");
  return features.every((feature) => policy.includes(`${feature}=()`));
}

function sharedSecurityHeadersOk(headers) {
  return getHeader(headers, "cache-control") === "no-store"
    && getHeader(headers, "referrer-policy") === "no-referrer"
    && getHeader(headers, "x-content-type-options") === "nosniff"
    && getHeader(headers, "x-frame-options") === "DENY"
    && getHeader(headers, "cross-origin-embedder-policy") === "require-corp"
    && getHeader(headers, "cross-origin-resource-policy") === "same-origin"
    && getHeader(headers, "cross-origin-opener-policy") === "same-origin"
    && getHeader(headers, "origin-agent-cluster") === "?1"
    && getHeader(headers, "strict-transport-security") === "max-age=31536000; includeSubDomains"
    && getHeader(headers, "x-permitted-cross-domain-policies") === "none"
    && getHeader(headers, "x-robots-tag") === "noindex, nofollow, noarchive"
    && permissionsPolicyDisables(getHeader(headers, "permissions-policy"), ["camera", "geolocation", "microphone", "payment", "usb"]);
}

function sharedSecurityHeaderDetail(headers) {
  return [
    "cache-control",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy",
    "cross-origin-opener-policy",
    "origin-agent-cluster",
    "strict-transport-security",
    "x-permitted-cross-domain-policies",
    "x-robots-tag",
    "permissions-policy"
  ].map((name) => `${name}=${getHeader(headers, name) || "missing"}`).join("; ");
}

function getHeader(headers, name) {
  return headers?.[name] || "";
}

function writeRoutesValidateKeyBeforeBody(source) {
  const anchors = [
    "if (method === \"PUT\" && pathname === \"/api/state\")",
    "if (method === \"POST\" && pathname === \"/api/packs\")",
    "if (packPathMatch && method === \"POST\")",
    "if (packNextMatch && method === \"POST\")",
    "if (packActionMatch && method === \"POST\")",
    "if (method === \"POST\" && isMemoryRoute)"
  ];
  const failed = anchors.filter((anchor) => {
    const start = source.indexOf(anchor);
    const keyIndex = source.indexOf("stateKeyForRequest(request)", start);
    const bodyIndex = source.indexOf("readJsonBody(request)", start);
    return start < 0 || keyIndex < 0 || bodyIndex < 0 || keyIndex > bodyIndex;
  });
  return {
    ok: failed.length === 0,
    detail: failed.length === 0 ? "stateKeyForRequest before readJsonBody" : failed.join(", ")
  };
}

function eraseRouteValidatesKey(source) {
  const routeStart = source.indexOf('if (method === "POST" && pathname === "/api/state/erase")');
  if (routeStart < 0) {
    return false;
  }

  const routeEnd = source.indexOf("\n  }\n\n", routeStart);
  const routeSource = source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined);
  return routeSource.includes("eraseState(stateKeyForRequest(request))");
}

function backendCommandPendingMarkers(source) {
  const markers = [
    "function backendCommandPendingForPack(pack)",
    "return backendCommandPendingForPack(pack);",
    "function isBackendCommandPending(command)",
    "action: \"backend-command-pending\"",
    "syncCommandActionButton(el(\"primary-action\"), command);",
    "syncCommandActionButton(el(\"dock-next\"), command);",
    "syncCommandActionButton(button, command);",
    "control.disabled = pending;",
    "data-action=\"${escapeAttribute(pending ? \"\" : command.action || \"\")}\""
  ];
  const missing = markers.filter((marker) => !source.includes(marker));
  return {
    ok: missing.length === 0,
    detail: missing.length === 0 ? "selected work controls wait while preview loads" : missing.join(", ")
  };
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

function rawRequest(activePort, message) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: activePort }, () => {
      socket.end(message);
    });
    let text = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      text += chunk;
    });
    socket.on("end", () => {
      resolve(parseRawResponse(text));
    });
    socket.on("error", reject);
    socket.setTimeout(5000, () => {
      socket.destroy(new Error("Raw HTTP request timed out."));
    });
  });
}

function parseRawResponse(text) {
  const [headersText, body = ""] = String(text || "").split(/\r?\n\r?\n/u);
  const status = Number(headersText.match(/^HTTP\/\d\.\d\s+(\d+)/u)?.[1] || 0);
  return {
    status,
    text: body
  };
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
