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
const RATE_LIMIT_STATE_WRITE_REQUESTS = 120;
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
  const securitySource = await fs.readFile(path.join(repoRoot, "server/src/security.js"), "utf8");
  const storageSource = await fs.readFile(path.join(repoRoot, "server/src/state-storage.js"), "utf8");
  const seedSource = await fs.readFile(path.join(repoRoot, "server/src/seed.js"), "utf8");
  const workflowSource = await fs.readFile(path.join(repoRoot, "server/src/workflow.js"), "utf8");
  const frontendSource = await fs.readFile(path.join(repoRoot, "src/demo/demo.js"), "utf8");
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
  check("runtime API config is served as same-origin JavaScript", runtimeConfig.text.startsWith("window.__projectsDemoConfig=") && runtimeConfig.text.includes(`"apiBase":"//127.0.0.1:${port}"`) && runtimeConfig.text.includes("window.PROJECTS_API_BASE_URL=") && !/https?:\/\//u.test(runtimeConfig.text), runtimeConfig.text.trim() || "missing");
  check("app shell contains no inline scripts", !hasInlineScript(appShell.text), "external scripts only");
  check("script policy avoids unsafe inline scripts", scriptSrcDirective(csp) === "script-src 'self'", scriptSrcDirective(csp) || "missing");
  check("style policy avoids unsafe inline styles", styleSrcDirective(csp) === "style-src 'self'", styleSrcDirective(csp) || "missing");
  check("content policy blocks unused loaders", cspBlocksUnusedLoaders(csp), unusedLoaderDirectiveDetail(csp));
  const healthText = JSON.stringify(health.body);
  check("health endpoint reports only storage kind", health.body?.ok === true && health.body?.storage === "file", healthText);
  check("health endpoint hides storage internals", !("stateStorage" in health.body) && !healthText.includes(stateFile) && !/state\.json|projects_demo_state|DATABASE_URL|PGHOST|PGPASSWORD/iu.test(healthText), healthText);
  check("invalid Host header stays inside normal request handling", invalidHostHealth.status === 200 && /projects-web-demo-api/u.test(invalidHostHealth.text), invalidHostHealth.status);
  check("API health sends shared security headers", sharedSecurityHeadersOk(health.headers), sharedSecurityHeaderDetail(health.headers));
  check("Postgres state keys are hashed before storage", /function postgresStateKey\(stateKey\)[\s\S]*v2:\$\{crypto\.createHash\("sha256"\)\.update\(normalized\)\.digest\("hex"\)\}/u.test(storageSource), "postgresStateKey");
  check("Postgres raw state-key fallback is retired", ![serverSource, storageSource].some((source) => source.includes("postgresStateKeys(") || source.includes("WHERE state_key = $1 OR state_key = $2") || source.includes("DELETE FROM projects_demo_state WHERE state_key = $1")), "digest-only state_key path");
  const declaredBodyLimit = declaredBodyLimitBeforeStream(serverSource);
  check("declared oversized body length is rejected before stream reading", declaredBodyLimit.ok, declaredBodyLimit.detail);
  check("state write rate limits are configured", stateWriteRateLimitConfigured(securitySource), "stateWriteKeyForRequest before body read");
  const writeRouteOrder = writeRoutesValidateKeyBeforeBody(serverSource);
  check("state-changing routes validate client keys and write limits before body parsing", writeRouteOrder.ok, writeRouteOrder.detail);
  const browserWritePreservesStatus = browserWriteRoutePreservesBackendStatus(serverSource, seedSource);
  check("browser-row write preserves backend-owned status", browserWritePreservesStatus.ok, browserWritePreservesStatus.detail);
  check("state reset validates client key before storage", resetRouteValidatesKey(serverSource), "stateWriteKeyForRequest required");
  check("state erase validates client key before deleting", eraseRouteValidatesKey(serverSource), "stateWriteKeyForRequest required");
  const recoveryRestore = frontendRecoveryRestoreUsesBackendEndpoint(frontendSource);
  check("hosted recovery restore uses named backend endpoint", recoveryRestore.ok, recoveryRestore.detail);
  const syncCopy = frontendSyncCopyUsesBackendEndpoint(frontendSource);
  check("hosted sync copy uses named backend endpoint", syncCopy.ok, syncCopy.detail);
  const browserRowSave = frontendBrowserRowSaveUsesNamedEndpoint(frontendSource);
  check("hosted browser-row save uses named backend endpoint", browserRowSave.ok, browserRowSave.detail);
  const hostedSearch = frontendSearchStaysLocalOnly(frontendSource);
  check("hosted search stays local-only", hostedSearch.ok, hostedSearch.detail);
  const hostedClipboard = frontendClipboardReceiptsStayLocalOnly(frontendSource);
  check("hosted clipboard receipts stay local-only", hostedClipboard.ok, hostedClipboard.detail);
  const hostedSyncShare = frontendSyncShareReceiptsStayLocalOnly(frontendSource);
  check("hosted sync share receipts stay local-only", hostedSyncShare.ok, hostedSyncShare.detail);
  const hostedFilterSave = frontendFilterUsesBackendEndpoint(frontendSource);
  check("hosted filter changes use named backend endpoint", hostedFilterSave.ok, hostedFilterSave.detail);
  const hostedSelectedSave = frontendSelectedWorkUsesBackendEndpoint(frontendSource);
  check("hosted selected-work changes use named backend endpoint", hostedSelectedSave.ok, hostedSelectedSave.detail);
  const hostedRouteOnly = frontendRouteOnlyNavigationStaysLocal(frontendSource);
  check("hosted route-only navigation stays local-only", hostedRouteOnly.ok, hostedRouteOnly.detail);
  const hostedScenarioSave = frontendScenarioUsesBackendEndpoint(frontendSource);
  check("hosted scenario changes use named backend endpoint", hostedScenarioSave.ok, hostedScenarioSave.detail);
  const hostedProfileSave = frontendProfileUsesBackendEndpoint(frontendSource);
  check("hosted profile changes use named backend endpoint", hostedProfileSave.ok, hostedProfileSave.detail);
  const hostedResetSave = frontendResetUsesBackendEndpoint(frontendSource);
  check("hosted reset uses named backend endpoint", hostedResetSave.ok, hostedResetSave.detail);
  const hostedStatusFailures = frontendHostedStatusFailuresStayLocalOnly(frontendSource);
  check("hosted status-only failures stay local-only", hostedStatusFailures.ok, hostedStatusFailures.detail);
  const backendPendingMarkers = backendCommandPendingMarkers(frontendSource);
  check("backend app mode waits for server command preview", backendPendingMarkers.ok, backendPendingMarkers.detail);
  const backendWaitFeedback = frontendBackendCommandWaitFeedbackStaysLocalOnly(frontendSource);
  check("hosted command-wait feedback stays local-only", backendWaitFeedback.ok, backendWaitFeedback.detail);
  const runNextBoundary = frontendRunNextUsesBackendCommandPreview(frontendSource);
  check("backend app mode runs next from server command preview", runNextBoundary.ok, runNextBoundary.detail);
  const cardRunNextBoundary = frontendHostedCardRunNextUsesGenericLabel(frontendSource);
  check("hosted card run-next buttons avoid browser command labels", cardRunNextBoundary.ok, cardRunNextBoundary.detail);
  const serverPreviewMarkers = serverCommandPreviewCopyMarkers(workflowSource);
  check("server command preview owns selected-work flow copy", serverPreviewMarkers.ok, serverPreviewMarkers.detail);
  const workflowPreflight = frontendWorkflowHelpersAvoidFullStatePreflight(frontendSource);
  check("server-owned workflow calls avoid full-state preflight writes", workflowPreflight.ok, workflowPreflight.detail);
  const backendOwnedLoads = frontendBackendOwnedLoadsSuppressGenericSave(frontendSource);
  check("backend-loaded state suppresses immediate generic re-save", backendOwnedLoads.ok, backendOwnedLoads.detail);
  const backendFailures = frontendBackendWorkflowFailuresStopStaticFallback(frontendSource);
  check("backend workflow failures stop before static fallback writes", backendFailures.ok, backendFailures.detail);

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
  const retiredStatePut = await request(port, "/api/state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": "demo-00000000-0000-4000-8000-000000000001"
    },
    body: JSON.stringify({ packs: [] })
  });
  check("generic state PUT route is retired", retiredStatePut.status === 404, retiredStatePut.status);

  const unkeyedSeedPacks = await request(port, "/api/demo-packs");
  const unkeyedPacks = await request(port, "/api/packs");
  const unkeyedCommandPreview = await request(port, "/api/packs/source-folder-audit/command");
  const keyedCommandPreview = await jsonRequest(port, "/api/packs/source-folder-audit/command", {
    headers: { "x-projects-demo-client": "demo-00000000-0000-4000-8000-000000000001" }
  });
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
  const unkeyedRestore = await request(port, "/api/state/restore", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ packs: [] })
  });
  const unkeyedSyncCopy = await request(port, "/api/state/sync", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ packs: [] })
  });
  const unkeyedNamedSyncCopy = await request(port, "/api/state/sync-copy", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ targetClientId: "sync-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
  });
  const unkeyedFilterWrite = await request(port, "/api/state/filter", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ filter: "review" })
  });
  const unkeyedSelectedWrite = await request(port, "/api/state/selected", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ selectedId: "source-folder-audit" })
  });
  const unkeyedScenarioWrite = await request(port, "/api/state/scenario", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ scenarioId: "empty" })
  });
  const unkeyedProfileWrite = await request(port, "/api/state/profile", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ profile: "developer" })
  });
  const unkeyedResetWrite = await request(port, "/api/state/reset", { method: "POST" });
  check("unkeyed API seed data is rejected", unkeyedSeedPacks.status === 400, unkeyedSeedPacks.status);
  check("unkeyed API pack list is rejected", unkeyedPacks.status === 400, unkeyedPacks.status);
  check("unkeyed API command preview is rejected", unkeyedCommandPreview.status === 400, unkeyedCommandPreview.status);
  check("keyed command preview owns flow and reason copy", commandPreviewOwnsCopy(keyedCommandPreview.body), `${keyedCommandPreview.body?.flowHint || "missing"} / ${keyedCommandPreview.body?.primaryReason || "missing"}`);
  check("unkeyed recovery restore rejects missing client key before body parsing", unkeyedRestore.status === 400, unkeyedRestore.status);
  check("retired whole-state sync route is not callable", unkeyedSyncCopy.status === 404, unkeyedSyncCopy.status);
  check("unkeyed named sync copy rejects missing client key before body parsing", unkeyedNamedSyncCopy.status === 400, unkeyedNamedSyncCopy.status);
  check("unkeyed filter write rejects missing client key before body parsing", unkeyedFilterWrite.status === 400, unkeyedFilterWrite.status);
  check("unkeyed selected-work write rejects missing client key before body parsing", unkeyedSelectedWrite.status === 400, unkeyedSelectedWrite.status);
  check("unkeyed scenario write rejects missing client key before body parsing", unkeyedScenarioWrite.status === 400, unkeyedScenarioWrite.status);
  check("unkeyed profile write rejects missing client key before body parsing", unkeyedProfileWrite.status === 400, unkeyedProfileWrite.status);
  check("unkeyed reset write rejects missing client key before storage", unkeyedResetWrite.status === 400, unkeyedResetWrite.status);
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
    "/src/demo/demo.js",
    "/docs/deploy-outplane.md",
    "/docs/public-exposure-audit.md",
    "/render.yaml",
    "/.git/config",
    "/assets/../server/server.js",
    "/assets/%2e%2e/server/server.js",
    "/assets/not-allowlisted.txt",
    "/assets/private/demo.js",
    "/data/not-allowlisted.json",
    "/server/src/security.js",
    "/server/src/state-storage.js"
  ]) {
    const response = await request(port, pathname);
    check(`non-public app file blocked: ${pathname}`, response.status === 404, response.status);
  }

  const seedDataResponse = await request(port, "/data/demo-packs.json");
  check("public seed data stays readable", seedDataResponse.status === 200, seedDataResponse.status);

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
  const scenarioClient = "demo-00000000-0000-4000-8000-000000000005";
  const resetClient = "demo-00000000-0000-4000-8000-000000000006";
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
  const syncCopyClient = "sync-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const validSyncCopy = await jsonRequest(port, "/api/state/sync-copy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ targetClientId: syncCopyClient })
  });
  const copiedSyncState = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": syncCopyClient }
  });
  const invalidSyncCopy = await request(port, "/api/state/sync-copy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ targetClientId: clientB })
  });
  check("server-owned sync copy can copy client A into a sync row", validSyncCopy.body?.copied === true && copiedSyncState.body?.packs?.some((pack) => pack.title === packTitle), `${validSyncCopy.status} / ${copiedSyncState.status}`);
  check("server-owned sync copy rejects non-sync targets", invalidSyncCopy.status === 400, invalidSyncCopy.status);
  const clientBState = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientB }
  });
  const clientBStateSeed = stateWithGeneratedPacks(1, "other-row-boundary");
  clientBStateSeed.packs[0].title = clientBTitle;
  const clientBWrite = await request(port, "/api/state/browser", {
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
  const unkeyedNonJsonStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "text/plain"
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "unkeyed-non-json-boundary"))
  });
  const nonJsonStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "text/plain",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "non-json-boundary"))
  });
  const oversizedBodyStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithOversizedBody("oversized-body-boundary"))
  });
  const declaredOversizedBodyStateWrite = await rawRequest(port, [
    "PUT /api/state/browser HTTP/1.1",
    `Host: 127.0.0.1:${port}`,
    "Content-Type: application/json",
    `Content-Length: ${1024 * 1024 + 1}`,
    `x-projects-demo-client: ${clientA}`,
    "Connection: close",
    "",
    ""
  ].join("\r\n"));
  const rateLimitedStateWriteStatuses = await Promise.all(
    Array.from({ length: RATE_LIMIT_STATE_WRITE_REQUESTS + 1 }, () => request(port, "/api/state/browser", {
    method: "PUT",
      headers: {
        "content-type": "text/plain",
        "x-projects-demo-client": "demo-00000000-0000-4000-8000-000000000004"
      }
    }).then((response) => response.status))
  );
  const nullStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(null)
  });
  const arrayStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify([])
  });
  const unsupportedBrowserStateKindWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({
      kind: "projects-state-v0",
      state: stateWithGeneratedPacks(1, "unsupported-browser-state-kind-boundary")
    })
  });
  const validFilterWrite = await jsonRequest(port, "/api/state/filter", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ filter: "review" })
  });
  const invalidFilterWrite = await request(port, "/api/state/filter", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ filter: "private-workflow" })
  });
  const clientAStateAfterFilter = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  const validSelectedWrite = await jsonRequest(port, "/api/state/selected", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ selectedId: "source-folder-audit" })
  });
  const invalidSelectedWrite = await request(port, "/api/state/selected", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ selectedId: "private-workflow" })
  });
  const clientAStateAfterSelected = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  const validScenarioWrite = await jsonRequest(port, "/api/state/scenario", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": scenarioClient
    },
    body: JSON.stringify({ scenarioId: "empty" })
  });
  const invalidScenarioWrite = await request(port, "/api/state/scenario", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": scenarioClient
    },
    body: JSON.stringify({ scenarioId: "private-roadmap" })
  });
  const scenarioStateAfterWrite = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": scenarioClient }
  });
  const validProfileWrite = await jsonRequest(port, "/api/state/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ profile: "developer", source: "URL" })
  });
  const invalidProfileWrite = await request(port, "/api/state/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ profile: "private" })
  });
  const clientAStateAfterProfile = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": clientA }
  });
  await jsonRequest(port, "/api/state/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": resetClient
    },
    body: JSON.stringify({ profile: "developer", source: "Boundary" })
  });
  const validResetWrite = await jsonRequest(port, "/api/state/reset", {
    method: "POST",
    headers: { "x-projects-demo-client": resetClient }
  });
  const resetStateAfterWrite = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": resetClient }
  });
  const browserStatusOverwriteState = stateWithGeneratedPacks(1, "browser-status-overwrite-boundary");
  browserStatusOverwriteState.status = "Browser status should not replace backend status.";
  const browserStatusOverwriteWrite = await jsonRequest(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": resetClient
    },
    body: JSON.stringify(browserStatusOverwriteState)
  });
  const resetStateAfterBrowserWrite = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": resetClient }
  });
  const missingPacksStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ status: "Missing packs boundary check." })
  });
  const emptyPacksStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ packs: [] })
  });
  const oversizedStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(MAX_STATE_PACKS + 1, "oversized-boundary"))
  });
  const duplicateIdStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithDuplicatePackIds("duplicate-id-boundary"))
  });
  const invalidPackStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithMissingPackTitle("missing-title-boundary"))
  });
  const invalidStatusStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidPackStatus("invalid-status-boundary"))
  });
  const invalidSelectedIdStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidSelectedId("invalid-selected-boundary"))
  });
  const invalidSelectedIdTypeStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidSelectedIdType("invalid-selected-type-boundary"))
  });
  const invalidStringListStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStringList("invalid-string-list-boundary"))
  });
  const invalidTextFieldStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidTextField("invalid-text-field-boundary"))
  });
  const overlongTextFieldStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithOverlongTextField("overlong-text-field-boundary"))
  });
  const invalidProfileStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateMetadata("invalid-profile-boundary", "copyProfile", "private"))
  });
  const invalidProfileTypeStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateMetadata("invalid-profile-type-boundary", "copyProfile", ["general"]))
  });
  const invalidScenarioStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateMetadata("invalid-scenario-boundary", "scenarioId", "private-roadmap"))
  });
  const invalidFilterStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateMetadata("invalid-filter-boundary", "filter", "private-workflow"))
  });
  const blankProfileStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateMetadata("blank-profile-boundary", "copyProfile", ""))
  });
  const invalidStateTextFieldWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateTextField("invalid-state-text-boundary", "query", { text: "not text" }))
  });
  const overlongStateTextFieldWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithInvalidStateTextField("overlong-state-text-boundary", "query", "x".repeat(201)))
  });
  const deepReceiptStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "deep-receipt-boundary", {
      actionReceipt: deepActionReceipt(MAX_PLAIN_VALUE_DEPTH + 1)
    }))
  });
  const malformedReceiptStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "malformed-receipt-boundary", {
      actionReceipt: ["not", "a", "plain", "object"]
    }))
  });
  const overlongReceiptTextStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "overlong-receipt-text-boundary", {
      actionReceipt: { summary: "x".repeat(2001) }
    }))
  });
  const wideReceiptStateWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify(stateWithGeneratedPacks(1, "wide-receipt-boundary", {
      actionReceipt: wideActionReceipt(MAX_PLAIN_OBJECT_KEYS + 1)
    }))
  });
  const limitStateWrite = await request(port, "/api/state/browser", {
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
  const invalidWorkPathStatusWrite = await request(port, "/api/packs/source-folder-audit/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({
      status: "private-workflow",
      next: "Open"
    })
  });
  const invalidWorkflowCreateSourcesWrite = await request(port, "/api/packs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({
      title: "Invalid workflow create source list",
      owner: "public-boundary-check",
      next: "Open",
      sources: [{ path: "not text" }]
    })
  });
  const invalidWorkflowNextWrite = await request(port, "/api/packs/source-folder-audit/next", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ next: { label: "Open" } })
  });
  const invalidWorkflowActionWrite = await request(port, "/api/packs/source-folder-audit/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ action: ["open"] })
  });
  const overlongWorkflowMemoryWrite = await request(port, "/api/packs/source-folder-audit/memory", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ note: "x".repeat(2001) })
  });
  const invalidWorkflowPathTextWrite = await request(port, "/api/packs/source-folder-audit/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({
      status: "active",
      next: { label: "Open" }
    })
  });
  const blockedByUnknownWrite = await request(port, "/api/packs/release-flyer-assets/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ blockedBy: "missing-work" })
  });
  const blockedBySelfWrite = await request(port, "/api/packs/source-folder-audit/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ blockedBy: "source-folder-audit" })
  });
  const blockedByDoneWrite = await request(port, "/api/packs/release-flyer-assets/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ blockedBy: "recording-export" })
  });
  const blockedByCycleWrite = await request(port, "/api/packs/source-folder-audit/path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": clientA
    },
    body: JSON.stringify({ blockedBy: "release-flyer-assets" })
  });
  const cascadeClient = "demo-00000000-0000-4000-8000-000000000007";
  const cascadeDoneWrite = await jsonRequest(port, "/api/packs/source-folder-audit/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": cascadeClient
    },
    body: JSON.stringify({ action: "done" })
  });
  const cascadeStateAfterDone = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": cascadeClient }
  });
  const blockedByEdgeClient = "demo-00000000-0000-4000-8000-000000000008";
  const blockedByEdgeWrite = await jsonRequest(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": blockedByEdgeClient
    },
    body: JSON.stringify(browserWritePayload(stateWithBlockedByEdge("blocked-by-boundary")))
  });
  const blockedByEdgeStateAfter = await jsonRequest(port, "/api/state", {
    headers: { "x-projects-demo-client": blockedByEdgeClient }
  });
  const danglingBlockedByWrite = await request(port, "/api/state/browser", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-projects-demo-client": blockedByEdgeClient
    },
    body: JSON.stringify(browserWritePayload(stateWithDanglingBlockedBy("dangling-blocked-by")))
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
  check("oversized JSON bodies are rejected before storage", oversizedBodyStateWrite.status === 413, oversizedBodyStateWrite.status);
  check("declared oversized JSON bodies are rejected before upload", declaredOversizedBodyStateWrite.status === 413, declaredOversizedBodyStateWrite.status);
  check("keyed state write rate limit rejects before content-type parsing", rateLimitStatusesOk(rateLimitedStateWriteStatuses), statusCounts(rateLimitedStateWriteStatuses));
  check("null state snapshots are rejected", nullStateWrite.status === 400, nullStateWrite.status);
  check("array state snapshots are rejected", arrayStateWrite.status === 400, arrayStateWrite.status);
  check("unsupported browser state envelope kinds are rejected", unsupportedBrowserStateKindWrite.status === 400, unsupportedBrowserStateKindWrite.status);
  check("named filter endpoint saves supported filters", validFilterWrite.status === 200 && validFilterWrite.body?.state?.filter === "review" && /Needs review filter applied:/u.test(validFilterWrite.body?.state?.status || ""), `${validFilterWrite.status} / ${validFilterWrite.body?.state?.filter || "missing"}`);
  check("named filter endpoint rejects unsupported filters", invalidFilterWrite.status === 400, invalidFilterWrite.status);
  check("named filter endpoint persists the keyed row", clientAStateAfterFilter.body?.filter === "review", clientAStateAfterFilter.body?.filter || "missing");
  check("named selected-work endpoint saves existing work", validSelectedWrite.status === 200 && validSelectedWrite.body?.state?.selectedId === "source-folder-audit", `${validSelectedWrite.status} / ${validSelectedWrite.body?.state?.selectedId || "missing"}`);
  check("named selected-work endpoint rejects unknown work", invalidSelectedWrite.status === 400, invalidSelectedWrite.status);
  check("named selected-work endpoint persists the keyed row", clientAStateAfterSelected.body?.selectedId === "source-folder-audit", clientAStateAfterSelected.body?.selectedId || "missing");
  check("named scenario endpoint saves empty scenario", validScenarioWrite.status === 200 && validScenarioWrite.body?.state?.scenarioId === "empty" && Array.isArray(validScenarioWrite.body?.state?.packs) && validScenarioWrite.body.state.packs.length === 0, `${validScenarioWrite.status} / ${validScenarioWrite.body?.state?.scenarioId || "missing"} / ${validScenarioWrite.body?.state?.packs?.length ?? "missing"}`);
  check("named scenario endpoint rejects unsupported scenarios", invalidScenarioWrite.status === 400, invalidScenarioWrite.status);
  check("named scenario endpoint persists the keyed row", scenarioStateAfterWrite.body?.scenarioId === "empty" && Array.isArray(scenarioStateAfterWrite.body?.packs) && scenarioStateAfterWrite.body.packs.length === 0, `${scenarioStateAfterWrite.body?.scenarioId || "missing"} / ${scenarioStateAfterWrite.body?.packs?.length ?? "missing"}`);
  check("named profile endpoint saves supported profile", validProfileWrite.status === 200 && validProfileWrite.body?.state?.copyProfile === "developer", `${validProfileWrite.status} / ${validProfileWrite.body?.state?.copyProfile || "missing"}`);
  check("named profile endpoint rejects unsupported profiles", invalidProfileWrite.status === 400, invalidProfileWrite.status);
  check("named profile endpoint persists the keyed row", clientAStateAfterProfile.body?.copyProfile === "developer", clientAStateAfterProfile.body?.copyProfile || "missing");
  check("named reset endpoint restores default row", validResetWrite.status === 200 && validResetWrite.body?.state?.copyProfile === "general" && validResetWrite.body?.state?.scenarioId === "default" && validResetWrite.body?.state?.filter === "all" && /backend row/u.test(validResetWrite.body?.state?.status || "") && Array.isArray(validResetWrite.body?.state?.packs) && validResetWrite.body.state.packs.length > 0, `${validResetWrite.status} / ${validResetWrite.body?.state?.copyProfile || "missing"} / ${validResetWrite.body?.state?.status || "missing"}`);
  check("named reset endpoint persists the keyed row", resetStateAfterWrite.body?.copyProfile === "general" && resetStateAfterWrite.body?.scenarioId === "default" && resetStateAfterWrite.body?.filter === "all", `${resetStateAfterWrite.body?.copyProfile || "missing"} / ${resetStateAfterWrite.body?.scenarioId || "missing"} / ${resetStateAfterWrite.body?.filter || "missing"}`);
  check("browser-row write preserves backend-owned status", browserStatusOverwriteWrite.status === 200 && /backend row/u.test(resetStateAfterBrowserWrite.body?.status || ""), `${browserStatusOverwriteWrite.status} / ${resetStateAfterBrowserWrite.body?.status || "missing"}`);
  check("state snapshots without packs are rejected", missingPacksStateWrite.status === 400, missingPacksStateWrite.status);
  check("empty state snapshots are rejected", emptyPacksStateWrite.status === 400, emptyPacksStateWrite.status);
  check("oversized keyed state snapshots are rejected", oversizedStateWrite.status === 400, oversizedStateWrite.status);
  check("duplicate work ids in keyed state snapshots are rejected", duplicateIdStateWrite.status === 400, duplicateIdStateWrite.status);
  check("invalid work items in keyed state snapshots are rejected", invalidPackStateWrite.status === 400, invalidPackStateWrite.status);
  check("invalid work status snapshots are rejected", invalidStatusStateWrite.status === 400, invalidStatusStateWrite.status);
  check("invalid selected work snapshots are rejected", invalidSelectedIdStateWrite.status === 400, invalidSelectedIdStateWrite.status);
  check("invalid selected work types are rejected", invalidSelectedIdTypeStateWrite.status === 400, invalidSelectedIdTypeStateWrite.status);
  check("invalid work string-list snapshots are rejected", invalidStringListStateWrite.status === 400, invalidStringListStateWrite.status);
  check("invalid work text-field snapshots are rejected", invalidTextFieldStateWrite.status === 400, invalidTextFieldStateWrite.status);
  check("overlong work text-field snapshots are rejected", overlongTextFieldStateWrite.status === 400, overlongTextFieldStateWrite.status);
  check("invalid copy profiles are rejected", invalidProfileStateWrite.status === 400, invalidProfileStateWrite.status);
  check("invalid copy profile types are rejected", invalidProfileTypeStateWrite.status === 400, invalidProfileTypeStateWrite.status);
  check("invalid scenarios are rejected", invalidScenarioStateWrite.status === 400, invalidScenarioStateWrite.status);
  check("invalid filters are rejected", invalidFilterStateWrite.status === 400, invalidFilterStateWrite.status);
  check("blank copy profiles are rejected", blankProfileStateWrite.status === 400, blankProfileStateWrite.status);
  check("invalid top-level state text fields are rejected", invalidStateTextFieldWrite.status === 400, invalidStateTextFieldWrite.status);
  check("overlong top-level state text fields are rejected", overlongStateTextFieldWrite.status === 400, overlongStateTextFieldWrite.status);
  check("malformed action receipts are rejected", malformedReceiptStateWrite.status === 400, malformedReceiptStateWrite.status);
  check("overlong action receipt text is rejected", overlongReceiptTextStateWrite.status === 400, overlongReceiptTextStateWrite.status);
  check("deep action receipts are rejected", deepReceiptStateWrite.status === 400, deepReceiptStateWrite.status);
  check("wide action receipts are rejected", wideReceiptStateWrite.status === 400, wideReceiptStateWrite.status);
  check("client A state survives rejected malformed snapshots", stateHasPackTitle(clientAStateAfterRejectedWrite.body, packTitle), clientAStateAfterRejectedWrite.status);
  check("client A state survives rejected oversized snapshot", stateHasPackTitle(clientAStateAfterRejectedWrite.body, packTitle), clientAStateAfterRejectedWrite.status);
  check("state rows can reach the documented work cap", limitStateWrite.status === 200, limitStateWrite.status);
  check("creating work past the state cap is rejected", overLimitCreate.status === 400, overLimitCreate.status);
  check("invalid work-path statuses are rejected", invalidWorkPathStatusWrite.status === 400, invalidWorkPathStatusWrite.status);
  check("malformed workflow create source lists are rejected", invalidWorkflowCreateSourcesWrite.status === 400, invalidWorkflowCreateSourcesWrite.status);
  check("malformed workflow next values are rejected", invalidWorkflowNextWrite.status === 400, invalidWorkflowNextWrite.status);
  check("malformed workflow actions are rejected", invalidWorkflowActionWrite.status === 400, invalidWorkflowActionWrite.status);
  check("overlong workflow memory notes are rejected", overlongWorkflowMemoryWrite.status === 400, overlongWorkflowMemoryWrite.status);
  check("malformed workflow path text fields are rejected", invalidWorkflowPathTextWrite.status === 400, invalidWorkflowPathTextWrite.status);
  check("work-path blockedBy must reference existing work", blockedByUnknownWrite.status === 400, blockedByUnknownWrite.status);
  check("work-path blockedBy rejects self reference", blockedBySelfWrite.status === 400, blockedBySelfWrite.status);
  check("work-path blockedBy rejects finished work", blockedByDoneWrite.status === 400, blockedByDoneWrite.status);
  check("work-path blockedBy rejects dependency loops", blockedByCycleWrite.status === 400, blockedByCycleWrite.status);
  check(
    "finishing work with proof reports unblocked dependents",
    cascadeDoneWrite.status === 200 && /Unblocked 1 work item\./u.test(cascadeDoneWrite.body?.receipt?.summary || ""),
    `${cascadeDoneWrite.status} / ${cascadeDoneWrite.body?.receipt?.summary || "missing"}`
  );
  const cascadedPack = (cascadeStateAfterDone.body?.packs || []).find((pack) => pack.id === "release-flyer-assets");
  check(
    "finish-with-proof cascade clears dependent blockers",
    cascadedPack?.blocker === "none"
      && cascadedPack?.blockedBy === ""
      && cascadedPack?.status === "active"
      && (cascadedPack?.activity || []).some((entry) => entry.includes("finished with proof.")),
    JSON.stringify({ blocker: cascadedPack?.blocker, blockedBy: cascadedPack?.blockedBy, status: cascadedPack?.status })
  );
  const savedBlockedByPack = (blockedByEdgeStateAfter.body?.packs || []).find((pack) => pack.blockedBy);
  check(
    "browser-row writes keep blockedBy edges",
    blockedByEdgeWrite.status === 200 && savedBlockedByPack?.blockedBy === "blocked-by-boundary-1",
    `${blockedByEdgeWrite.status} / ${savedBlockedByPack?.blockedBy || "missing"}`
  );
  check("dangling blockedBy snapshots are rejected", danglingBlockedByWrite.status === 400, danglingBlockedByWrite.status);
  check("unkeyed backend state erase is rejected", unkeyedErase.status === 400, unkeyedErase.status);
  check("current keyed backend state can be erased", eraseClientAState.status === 200 && eraseClientAState.text.includes("\"ok\":true"), eraseClientAState.status);
  check("erased keyed backend state no longer has client work", !stateHasPackTitle(clientAStateAfterErase.body, packTitle), clientAStateAfterErase.status);
  check("erasing one keyed state keeps another client row", stateHasPackTitle(clientBStateAfterErase.body, clientBTitle), clientBStateAfterErase.status);

  const files = await fs.readdir(tmpDir);
  check("keyed local state uses hashed filenames", files.some((file) => /^state.[a-f0-9]{64}.json$/u.test(file)), files.join(", "));
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

function stateWithBlockedByEdge(prefix) {
  const state = stateWithGeneratedPacks(2, prefix);
  state.packs[1].blockedBy = state.packs[0].id;
  state.packs[1].blocker = `waiting on ${state.packs[0].title}`;
  state.packs[1].status = "blocked";
  return state;
}

function stateWithDanglingBlockedBy(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].blockedBy = `${prefix}-missing`;
  return state;
}

function stateWithOversizedBody(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.status = "x".repeat(1024 * 1024);
  return state;
}

function stateWithMissingPackTitle(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].title = "";
  return state;
}

function stateWithInvalidPackStatus(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].status = "waiting-for-private-workflow";
  return state;
}

function stateWithInvalidSelectedId(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.selectedId = `${prefix}-missing`;
  return state;
}

function stateWithInvalidSelectedIdType(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.selectedId = [state.packs[0].id];
  return state;
}

function stateWithInvalidStringList(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].memory = [{ note: "not text" }];
  return state;
}

function stateWithInvalidTextField(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].owner = { name: "not text" };
  return state;
}

function stateWithOverlongTextField(prefix) {
  const state = stateWithGeneratedPacks(1, prefix);
  state.packs[0].owner = "x".repeat(121);
  return state;
}

function stateWithInvalidStateMetadata(prefix, key, value) {
  const state = stateWithGeneratedPacks(1, prefix);
  state[key] = value;
  return state;
}

function stateWithInvalidStateTextField(prefix, key, value) {
  const state = stateWithGeneratedPacks(1, prefix);
  state[key] = value;
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
    && getHeader(headers, "clear-site-data") === "\"cookies\""
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
    "clear-site-data",
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
    "if (method === \"PUT\" && pathname === \"/api/state/browser\")",
    "if (method === \"POST\" && pathname === \"/api/state/restore\")",
    "if (method === \"POST\" && pathname === \"/api/state/sync-copy\")",
    "if (method === \"POST\" && pathname === \"/api/state/filter\")",
    "if (method === \"POST\" && pathname === \"/api/state/selected\")",
    "if (method === \"POST\" && pathname === \"/api/state/scenario\")",
    "if (method === \"POST\" && pathname === \"/api/state/profile\")",
    "if (method === \"POST\" && pathname === \"/api/packs\")",
    "if (packPathMatch && method === \"POST\")",
    "if (packNextMatch && method === \"POST\")",
    "if (packActionMatch && method === \"POST\")",
    "if (method === \"POST\" && isMemoryRoute)"
  ];
  const failed = anchors.filter((anchor) => {
    const start = source.indexOf(anchor);
    const keyIndex = source.indexOf("stateWriteKeyForRequest(request)", start);
    const bodyIndex = source.indexOf("readJsonBody(request)", start);
    return start < 0 || keyIndex < 0 || bodyIndex < 0 || keyIndex > bodyIndex;
  });
  return {
    ok: failed.length === 0,
    detail: failed.length === 0 ? "stateWriteKeyForRequest before readJsonBody" : failed.join(", ")
  };
}

function browserWriteRoutePreservesBackendStatus(source, seedSource) {
  const routeStart = source.indexOf('if (method === "PUT" && pathname === "/api/state/browser")');
  const routeEnd = source.indexOf("\n  }\n\n", routeStart);
  const routeSource = routeStart >= 0
    ? source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined)
    : "";
  const helperBody = functionBody(seedSource, "browserStatePayload");
  const ok = routeSource.includes("const current = await stateStorage.read(stateKey)")
    && routeSource.includes("seed.browserStatePayload(payload, current)")
    && helperBody.includes("validateStatePayload(payload.state)")
    && helperBody.includes("status: currentState.status || \"\"")
    && helperBody.includes("actionReceipt: null")
    && helperBody.includes("query: \"\"");
  return {
    ok,
    detail: ok
      ? "browser row validates payload then preserves status and clears transient fields"
      : "browser row still replaces server-owned status or transient fields"
  };
}

function frontendRecoveryRestoreUsesBackendEndpoint(source) {
  const body = functionBody(source, "restoreRecoverySnapshot");
  if (!body) {
    return { ok: false, detail: "restoreRecoverySnapshot:missing" };
  }

  const required = [
    "if (DEMO_API_BASE_URL)",
    "clearPendingBackendStateSave();",
    "loadBackendOwnedState(await restoreBackendStateSnapshot(snapshot));",
    "loadState(snapshot);",
    "saveState();"
  ];
  const missing = required.filter((needle) => !body.includes(needle));
  const backendIndex = body.indexOf("if (DEMO_API_BASE_URL)");
  const restoreIndex = body.indexOf("restoreBackendStateSnapshot(snapshot)");
  const staticLoadIndex = body.indexOf("loadState(snapshot)");
  const staticSaveIndex = body.indexOf("saveState();");
  const orderOk = backendIndex >= 0
    && restoreIndex > backendIndex
    && staticLoadIndex > restoreIndex
    && staticSaveIndex > staticLoadIndex;
  const helperBody = functionBody(source, "restoreBackendStateSnapshot");
  if (!helperBody.includes('sendBackendStateSnapshot("/api/state/restore", "POST", snapshot, "Restore")')) {
    missing.push("restoreBackendStateSnapshot:missing restore endpoint");
  }

  return {
    ok: missing.length === 0 && orderOk,
    detail: missing.length === 0 && orderOk
      ? "hosted restore posts to /api/state/restore while static restore keeps local save"
      : `missing ${missing.join(", ") || "correct order"}`
  };
}

function frontendSyncCopyUsesBackendEndpoint(source) {
  const body = functionBody(source, "activateSyncCode");
  if (!body) {
    return { ok: false, detail: "activateSyncCode:missing" };
  }

  const required = [
    "options.copyCurrentState",
    "postBackendStateAction(\"/api/state/sync-copy\"",
    "targetClientId:await syncClientId(code)",
    "\"sync copy\")",
    "loadBackendOwnedState(await loadBackendState())"
  ];
  const missing = required.filter((needle) => !body.includes(needle));
  if (body.includes("persistBackendStateSnapshot(demoStateSnapshot())")) {
    missing.push("generic state snapshot still used for sync copy");
  }
  if (body.includes("sendBackendStateSnapshot(\"/api/state/sync\"")) {
    missing.push("whole-state sync snapshot route still used");
  }

  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? "new sync-code copy posts to /api/state/sync-copy instead of sending a browser-defined state snapshot"
      : missing.join(", ")
  };
}

function frontendBrowserRowSaveUsesNamedEndpoint(source) {
  const body = functionBody(source, "persistBackendStateSnapshot");
  const snapshotBody = functionBody(source, "browserRowStateSnapshot");
  if (!body || !snapshotBody) {
    return { ok: false, detail: "persistBackendStateSnapshot/browserRowStateSnapshot:missing" };
  }

  const ok = body.includes('sendBackendStateSnapshot("/api/state/browser", "PUT", snapshot, "Save")')
    && !body.includes('sendBackendStateSnapshot("/api/state", "PUT"')
    && snapshotBody.includes('"projects-browser-state-v1"')
    && snapshotBody.includes("state:s")
    && snapshotBody.includes("delete s.actionReceipt")
    && snapshotBody.includes("delete s.query")
    && snapshotBody.includes("delete s.status");
  return {
    ok,
    detail: ok
      ? "browser-row snapshots save through /api/state/browser without transient receipt/query/status"
      : "browser-row save still uses the generic or full recovery snapshot"
  };
}

function firstExistingIndex(body, needles) {
  const indexes = needles.map((needle) => body.indexOf(needle)).filter((index) => index >= 0);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

function suppressNextSaveIndex(body) {
  return firstExistingIndex(body, [
    "state.suppressNextSave=true",
    "state.suppressNextSave = true"
  ]);
}

function hostedSuppressNextSaveIndex(body) {
  return firstExistingIndex(body, [
    "if(DEMO_API_BASE_URL)state.suppressNextSave=true",
    "if (DEMO_API_BASE_URL) state.suppressNextSave = true"
  ]);
}

function frontendSearchStaysLocalOnly(source) {
  const toolbarBody = functionBody(source, "bindToolbar");
  if (!toolbarBody) {
    return { ok: false, detail: "bindToolbar:missing" };
  }

  const inputIndex = toolbarBody.indexOf('search.addEventListener("input"');
  const filterIndex = toolbarBody.indexOf('document.querySelectorAll(".demo-chip")');
  const searchBody = inputIndex < 0
    ? ""
    : toolbarBody.slice(inputIndex, filterIndex > inputIndex ? filterIndex : undefined);
  const queryIndex = searchBody.indexOf("state.query = event.currentTarget.value");
  const suppressIndex = suppressNextSaveIndex(searchBody);
  const debounceIndex = searchBody.indexOf("searchTimer = setTimeout(");
  const ok = queryIndex >= 0
    && suppressIndex > queryIndex
    && debounceIndex > suppressIndex
    && !searchBody.includes("saveBackend")
    && !searchBody.includes("scheduleBackendStateSave")
    && !searchBody.includes("saveState();");

  return {
    ok,
    detail: ok
      ? "search input re-renders as transient browser UI without scheduling backend persistence"
      : "search input can still reach backend or durable state save path"
  };
}

function frontendClipboardReceiptsStayLocalOnly(source) {
  const receiptBody = functionBody(source, "setClipboardReceipt");
  const copyBody = functionBody(source, "copyToClipboard");
  if (!receiptBody || !copyBody) {
    return { ok: false, detail: "setClipboardReceipt/copyToClipboard:missing" };
  }

  const ok = hostedSuppressNextSaveIndex(receiptBody) >= 0
    && receiptBody.includes("state.clipboardReceipt =")
    && copyBody.includes('setClipboardReceipt("success"')
    && copyBody.includes('setClipboardReceipt("blocked"')
    && !copyBody.includes("saveBackend")
    && !copyBody.includes("scheduleBackendStateSave")
    && !copyBody.includes("saveState();");

  return {
    ok,
    detail: ok
      ? "clipboard receipt renders are transient UI and do not schedule hosted backend persistence"
      : "clipboard receipt flow can still reach backend or durable state save path"
  };
}

function frontendSyncShareReceiptsStayLocalOnly(source) {
  const contracts = [
    {
      name: "copySyncLink",
      status: 'routeStatus("Sync link"',
      feedback: "Sync link copied."
    },
    {
      name: "copySyncCode",
      status: 'routeStatus("Sync code"',
      feedback: "Sync code copied."
    }
  ];
  const failures = [];
  for (const contract of contracts) {
    const body = functionBody(source, contract.name);
    if (!body) {
      failures.push(`${contract.name}:missing`);
      continue;
    }
    const statusIndex = body.indexOf(contract.status);
    const suppressIndex = hostedSuppressNextSaveIndex(body);
    const renderIndex = body.indexOf("render();", statusIndex);
    if (statusIndex < 0 || suppressIndex < statusIndex || renderIndex < suppressIndex) {
      failures.push(`${contract.name}:missing transient hosted suppression`);
    }
    if (!body.includes(contract.feedback)) {
      failures.push(`${contract.name}:missing feedback`);
    }
    if (body.includes("saveBackend") || body.includes("scheduleBackendStateSave") || body.includes("saveState();")) {
      failures.push(`${contract.name}:durable save path`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0
      ? "sync link/code copy confirmations render as transient UI without scheduling hosted backend persistence"
      : failures.join(", ")
  };
}

function frontendPostStateHelper(source) {
  const helperBody = functionBody(source, "postBackendStateAction");
  return Boolean(helperBody
    && helperBody.includes("fetch(apiUrl(path)")
    && helperBody.includes('method: "POST"')
    && helperBody.includes("JSON.stringify(payload)")
    && helperBody.includes("loadBackendOwnedState(result.state)"));
}

function frontendFilterUsesBackendEndpoint(source) {
  const helperBody = functionBody(source, "saveBackendStateFilter");
  const toolbarBody = functionBody(source, "bindToolbar");
  if (!helperBody || !toolbarBody) {
    return { ok: false, detail: "saveBackendStateFilter/bindToolbar:missing" };
  }

  const ok = frontendPostStateHelper(source)
    && helperBody.includes('postBackendStateAction("/api/state/filter", { filter }, "filter")')
    && helperBody.includes("prepareBackendWorkflowRequest()")
    && toolbarBody.includes("await saveBackendStateFilter(filter)")
    && suppressNextSaveIndex(toolbarBody) >= 0
    && !toolbarBody.includes("scheduleBackendStateSave(browserRowStateSnapshot())");
  return {
    ok,
    detail: ok
      ? "hosted filter changes post to /api/state/filter without falling back to browser-row saves"
      : "hosted filter changes still rely on browser-row snapshot persistence"
  };
}

function frontendSelectedWorkUsesBackendEndpoint(source) {
  const helperBody = functionBody(source, "saveBackendSelectedWork");
  const routeBody = functionBody(source, "routeFromHash");
  if (!helperBody || !routeBody) {
    return { ok: false, detail: "saveBackendSelectedWork/routeFromHash:missing" };
  }

  const ok = frontendPostStateHelper(source)
    && helperBody.includes('postBackendStateAction("/api/state/selected", { selectedId }, "selected work")')
    && routeBody.includes("saveBackendSelectedWork(state.selectedId)")
    && suppressNextSaveIndex(routeBody) >= 0
    && !routeBody.includes("scheduleBackendStateSave(browserRowStateSnapshot())");
  return {
    ok,
    detail: ok
      ? "hosted selected-work navigation posts to /api/state/selected without falling back to browser-row saves"
      : "hosted selected-work navigation still relies on browser-row snapshot persistence"
  };
}

function frontendRouteOnlyNavigationStaysLocal(source) {
  const routeBody = functionBody(source, "routeFromHash");
  if (!routeBody) {
    return { ok: false, detail: "routeFromHash:missing" };
  }

  const previousRouteIndex = routeBody.indexOf("const previousRoute = state.route");
  const routeSetIndex = routeBody.indexOf("state.route = parsedRoute.route");
  const selectedChangeIndex = routeBody.indexOf("const selectedWorkChanged = state.selectedId !== previousSelectedId && findPack(state.selectedId)");
  const selectedSaveIndex = routeBody.indexOf("saveBackendSelectedWork(state.selectedId)");
  const routeOnlyIndex = routeBody.indexOf("state.route !== previousRoute || parsedRoute.fallback");
  const suppressTail = routeBody.slice(routeOnlyIndex);
  const ok = previousRouteIndex >= 0
    && routeSetIndex > previousRouteIndex
    && selectedChangeIndex > routeSetIndex
    && selectedSaveIndex > selectedChangeIndex
    && routeOnlyIndex > selectedSaveIndex
    && suppressNextSaveIndex(suppressTail) >= 0
    && !suppressTail.includes("saveBackendSelectedWork")
    && !suppressTail.includes("scheduleBackendStateSave")
    && !suppressTail.includes("saveState();");

  return {
    ok,
    detail: ok
      ? "route-only hash navigation suppresses generic browser-row persistence while selected work keeps the named endpoint"
      : "route-only navigation can still reach generic backend persistence"
  };
}

function frontendScenarioUsesBackendEndpoint(source) {
  const helperBody = functionBody(source, "saveBackendScenario");
  const applyBody = functionBody(source, "applyScenario");
  if (!helperBody || !applyBody) {
    return { ok: false, detail: "saveBackendScenario/applyScenario:missing" };
  }

  const ok = frontendPostStateHelper(source)
    && helperBody.includes('postBackendStateAction("/api/state/scenario"')
    && helperBody.includes("scenarioId")
    && helperBody.includes("preserveProfile")
    && applyBody.includes("await saveBackendScenario(current.id")
    && applyBody.includes("clearPendingBackendStateSave()")
    && !applyBody.includes("scheduleBackendStateSave(browserRowStateSnapshot())");
  return {
    ok,
    detail: ok
      ? "hosted scenario changes post to /api/state/scenario without falling back to browser-row saves"
      : "hosted scenario changes still rely on browser-row snapshot persistence"
  };
}

function frontendProfileUsesBackendEndpoint(source) {
  const helperBody = functionBody(source, "saveBackendProfile");
  const launchBody = functionBody(source, "applyLaunchConfiguration");
  if (!helperBody || !launchBody) {
    return { ok: false, detail: "saveBackendProfile/applyLaunchConfiguration:missing" };
  }

  const ok = frontendPostStateHelper(source)
    && helperBody.includes('postBackendStateAction("/api/state/profile", { profile, source }, "profile")')
    && launchBody.includes("await saveBackendProfile(profileParam, \"URL\")")
    && !launchBody.includes("scheduleBackendStateSave(browserRowStateSnapshot())");
  return {
    ok,
    detail: ok
      ? "hosted profile launch changes post to /api/state/profile without falling back to browser-row saves"
      : "hosted profile launch changes still rely on browser-row snapshot persistence"
  };
}

function frontendResetUsesBackendEndpoint(source) {
  const helperBody = functionBody(source, "saveBackendResetState");
  const resetBody = functionBody(source, "resetState");
  if (!helperBody || !resetBody) {
    return { ok: false, detail: "saveBackendResetState/resetState:missing" };
  }

  const ok = frontendPostStateHelper(source)
    && helperBody.includes('postBackendStateAction("/api/state/reset", {}, "reset")')
    && resetBody.includes("await saveBackendResetState()")
    && resetBody.includes("clearPendingBackendStateSave()")
    && resetBody.includes("state.packs = structuredClone(state.basePacks)")
    && !resetBody.includes("scheduleBackendStateSave(browserRowStateSnapshot())");
  return {
    ok,
    detail: ok
      ? "hosted reset posts to /api/state/reset while static reset keeps local data"
      : "hosted reset still relies on browser-row snapshot persistence"
  };
}

function frontendHostedStatusFailuresStayLocalOnly(source) {
  const contracts = [
    {
      name: "resetState",
      status: 'routeStatus("Backend reset"',
      suppress: "state.suppressNextSave=true"
    },
    {
      name: "restoreRecoverySnapshot",
      status: "invalid backup",
      suppress: "if(DEMO_API_BASE_URL)state.suppressNextSave=true"
    },
    {
      name: "eraseBackendState",
      status: 'routeStatus("Backend erase"',
      suppress: "state.suppressNextSave=true"
    }
  ];
  const failures = [];
  for (const contract of contracts) {
    const body = functionBody(source, contract.name);
    if (!body) {
      failures.push(`${contract.name}:missing`);
      continue;
    }
    const catchIndex = body.lastIndexOf("catch (error)");
    const catchBody = catchIndex < 0 ? "" : body.slice(catchIndex);
    const statusIndex = catchBody.indexOf(contract.status);
    const suppressIndex = catchBody.indexOf(contract.suppress);
    const renderIndex = catchBody.indexOf("render();", statusIndex);
    if (statusIndex < 0 || suppressIndex < statusIndex || renderIndex < suppressIndex) {
      failures.push(`${contract.name}:status failure can schedule browser-row save`);
    }
    if (catchBody.includes("scheduleBackendStateSave") || catchBody.includes("saveState();")) {
      failures.push(`${contract.name}:durable save path`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0
      ? "hosted reset, recovery, and erase failure messages render without scheduling browser-row persistence"
      : failures.join(", ")
  };
}

function resetRouteValidatesKey(source) {
  const routeStart = source.indexOf('if (method === "POST" && pathname === "/api/state/reset")');
  if (routeStart < 0) {
    return false;
  }

  const routeEnd = source.indexOf("\n  }\n\n", routeStart);
  const routeSource = source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined);
  return routeSource.includes("const stateKey = security.stateWriteKeyForRequest(request)")
    && routeSource.includes("await stateStorage.write(result.state, stateKey)");
}

function eraseRouteValidatesKey(source) {
  const routeStart = source.indexOf('if (method === "POST" && pathname === "/api/state/erase")');
  if (routeStart < 0) {
    return false;
  }

  const routeEnd = source.indexOf("\n  }\n\n", routeStart);
  const routeSource = source.slice(routeStart, routeEnd > routeStart ? routeEnd : undefined);
  return routeSource.includes("stateStorage.erase(security.stateWriteKeyForRequest(request))");
}

function stateWriteRateLimitConfigured(source) {
  const needlesOk = [
    "const RATE_LIMIT_WINDOW_MS",
    "const RATE_LIMIT_API_REQUESTS",
    "const RATE_LIMIT_SOURCE_WRITE_REQUESTS",
    "const RATE_LIMIT_STATE_WRITE_REQUESTS",
    "function stateWriteKeyForRequest(request)",
    "enforceStateWriteRateLimit(request, stateKey)",
    "function enforceRateLimit(bucketKey, limit, message)"
  ].every((needle) => source.includes(needle));
  const writeKeyFn = source.indexOf("function stateWriteKeyForRequest(request)");
  const enforceInKeyFn = source.indexOf("enforceStateWriteRateLimit(request, stateKey)", writeKeyFn);
  const keyFnReturn = source.indexOf("return stateKey;", writeKeyFn);
  return needlesOk && writeKeyFn >= 0 && enforceInKeyFn > writeKeyFn && keyFnReturn > enforceInKeyFn;
}

function rateLimitStatusesOk(statuses) {
  return statuses.filter((status) => status === 415).length === RATE_LIMIT_STATE_WRITE_REQUESTS
    && statuses.filter((status) => status === 429).length === 1;
}

function statusCounts(statuses) {
  return [...new Set(statuses)]
    .sort((left, right) => left - right)
    .map((status) => `${status}:${statuses.filter((entry) => entry === status).length}`)
    .join(", ");
}

function declaredBodyLimitBeforeStream(source) {
  const bodyStart = source.indexOf("async function readJsonBody(request)");
  const guardIndex = source.indexOf("rejectOversizedContentLength(request)", bodyStart);
  const streamIndex = source.indexOf("for await (const chunk of request)", bodyStart);
  return {
    ok: bodyStart >= 0 && guardIndex > bodyStart && streamIndex > guardIndex,
    detail: bodyStart >= 0 && guardIndex > bodyStart && streamIndex > guardIndex
      ? "content-length guard before stream read"
      : "missing guard before stream read"
  };
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

function frontendBackendCommandWaitFeedbackStaysLocalOnly(source) {
  const helperBody = functionBody(source, "setBackendCommandWaitStatus");
  const contracts = [
    "runPrimaryAction",
    "runResolvedPackAction",
    "runRouteAction"
  ];
  const failures = [];
  if (!helperBody) {
    failures.push("setBackendCommandWaitStatus:missing");
  } else {
    if (!helperBody.includes('routeStatus("Backend command","waiting for server-owned command preview","try again after it loads")')) {
      failures.push("setBackendCommandWaitStatus:missing wait status");
    }
    if (!helperBody.includes("state.suppressNextSave=true")) {
      failures.push("setBackendCommandWaitStatus:no suppress");
    }
  }
  for (const helperName of contracts) {
    const body = functionBody(source, helperName);
    if (!body) {
      failures.push(`${helperName}:missing`);
      continue;
    }
    const waitIndex = body.indexOf("setBackendCommandWaitStatus();");
    const renderIndex = body.indexOf("render();", waitIndex);
    if (waitIndex < 0 || renderIndex < waitIndex) {
      failures.push(`${helperName}:wait feedback can persist`);
    }
    if (body.includes('routeStatus("Backend command", "waiting for server-owned command preview"')) {
      failures.push(`${helperName}:inline wait status`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0
      ? "server command wait feedback suppresses browser-row persistence before render"
      : failures.join(", ")
  };
}

function frontendRunNextUsesBackendCommandPreview(source) {
  const body = functionBody(source, "runResolvedPackAction");
  if (!body) {
    return { ok: false, detail: "runResolvedPackAction:missing" };
  }

  const required = [
    "backendPackCommandForSelected(pack) || resolvePrimaryCommandForPack(pack)",
    "if (isBackendCommandPending(resolved))",
    "scheduleBackendPackCommandPreview(pack);",
    "setBackendCommandWaitStatus();",
    "return;"
  ];
  const missing = required.filter((needle) => !body.includes(needle));
  const backendIndex = body.indexOf("backendPackCommandForSelected(pack)");
  const localIndex = body.indexOf("resolvePrimaryCommandForPack(pack)");
  const routeIndex = body.indexOf("runRouteAction(resolved.action, resolved.targetPackId)");
  const actionIndex = body.indexOf("handlePackAction(pack.id, resolved.action)");
  const orderOk = backendIndex >= 0
    && localIndex > backendIndex
    && routeIndex > localIndex
    && actionIndex > routeIndex;

  return {
    ok: missing.length === 0 && orderOk,
    detail: missing.length === 0 && orderOk
      ? "run-next waits for API-owned command before local route/action dispatch"
      : `missing ${missing.join(", ") || "correct order"}`
  };
}

function frontendHostedCardRunNextUsesGenericLabel(source) {
  const body = functionBody(source, "primaryCommandButton");
  if (!body) {
    return { ok: false, detail: "primaryCommandButton:missing" };
  }

  const required = [
    "const command = DEMO_API_BASE_URL ? null : resolvePrimaryCommandForPack(pack);",
    "const label = command?.label || \"Run next\";",
    "backendCardRunNextReason(pack)",
    "${escapeHtml(label)}"
  ];
  const missing = required.filter((needle) => !body.includes(needle));
  if (body.includes("${escapeHtml(command.label)}")) {
    missing.push("direct command label still rendered");
  }

  const helperBody = functionBody(source, "backendCardRunNextReason");
  if (!helperBody.includes("server preview before running")) {
    missing.push("backendCardRunNextReason:missing server-preview copy");
  }

  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? "hosted card buttons stay generic and defer command choice to preview-backed run-next"
      : missing.join(", ")
  };
}

function serverCommandPreviewCopyMarkers(source) {
  const markers = [
    "flowHint: selectedFlowHintForPack(pack, next, blocker)",
    "primaryReason: primaryCommandVisibleReason(pack, next)",
    "function selectedFlowHintForPack(pack",
    "function primaryCommandVisibleReason(pack"
  ];
  const missing = markers.filter((marker) => !source.includes(marker));
  return {
    ok: missing.length === 0,
    detail: missing.length === 0 ? "server preview includes selected-work flow and why copy" : missing.join(", ")
  };
}

function frontendWorkflowHelpersAvoidFullStatePreflight(source) {
  const helperNames = [
    "runBackendPackAction",
    "saveBackendPackNextAction",
    "createBackendPack",
    "addBackendPackMemoryNote",
    "saveBackendPackPath"
  ];
  const failures = [];
  for (const helperName of helperNames) {
    const body = functionBody(source, helperName);
    if (!body) {
      failures.push(`${helperName}:missing`);
      continue;
    }
    if (!body.includes("prepareBackendWorkflowRequest();")) {
      failures.push(`${helperName}:no prepare`);
    }
    if (body.includes("persistBackendStateSnapshot(demoStateSnapshot())")) {
      failures.push(`${helperName}:full-state preflight`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0 ? "workflow endpoints call specific APIs without pre-sending PUT /api/state" : failures.join(", ")
  };
}

function frontendBackendOwnedLoadsSuppressGenericSave(source) {
  const failures = [];
  const bootstrapStart = source.indexOf('document.addEventListener("DOMContentLoaded"');
  const bootstrapEnd = source.indexOf("async function loadInitialDemoState", bootstrapStart);
  const bootstrapBody = bootstrapStart >= 0 && bootstrapEnd > bootstrapStart
    ? source.slice(bootstrapStart, bootstrapEnd)
    : "";
  if (!bootstrapBody.includes("DEMO_API_BASE_URL ? loadBackendOwnedState(backendState) : loadState(backendState);")) {
    failures.push("startup backend state:plain loadState");
  }

  const loaderBody = functionBody(source, "loadBackendOwnedState");
  if (!loaderBody) {
    failures.push("loadBackendOwnedState:missing");
  } else {
    if (!loaderBody.includes("loadState(backendState);")) {
      failures.push("loadBackendOwnedState:no loadState");
    }
    if (!loaderBody.includes("state.suppressNextSave=true") && !loaderBody.includes("state.suppressNextSave = true;")) {
      failures.push("loadBackendOwnedState:no suppress");
    }
  }

  const resultStateHelpers = [
    "eraseBackendState",
    "runBackendPackAction",
    "saveBackendPackNextAction",
    "createBackendPack",
    "addBackendPackMemoryNote",
    "saveBackendPackPath"
  ];
  for (const helperName of resultStateHelpers) {
    const body = functionBody(source, helperName);
    if (!body) {
      failures.push(`${helperName}:missing`);
      continue;
    }
    if (!body.includes("loadBackendOwnedState(result.state);")) {
      failures.push(`${helperName}:not backend-owned`);
    }
    if (body.includes("loadState(result.state);")) {
      failures.push(`${helperName}:plain loadState`);
    }
  }

  const backendStateLoadHelpers = [
    "activateSyncCode",
    "leaveSyncCode"
  ];
  for (const helperName of backendStateLoadHelpers) {
    const body = functionBody(source, helperName);
    if (!body) {
      failures.push(`${helperName}:missing`);
      continue;
    }
    if (!body.includes("loadBackendOwnedState(await loadBackendState())")) {
      failures.push(`${helperName}:not backend-owned`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0 ? "backend endpoint responses render without immediately scheduling PUT /api/state" : failures.join(", ")
  };
}

function frontendBackendWorkflowFailuresStopStaticFallback(source) {
  const failures = [];
  const contracts = [
    {
      name: "createSamplePack",
      request: "await createBackendPack(values)",
      catchNeedles: ["Projects demo backend create failed.", "retry or refresh", "render();", "return;"],
      fallback: "state.packs.unshift(pack);"
    },
    {
      name: "savePackForwardPathFromForm",
      request: "await saveBackendPackPath(pack, values)",
      catchNeedles: ["Projects demo backend work path action failed.", "retry or refresh", "return false;"],
      fallback: "const changed = applyPackForwardPathFormValues(pack);"
    },
    {
      name: "savePackMemoryNote",
      request: "await addBackendPackMemoryNote(pack, note)",
      catchNeedles: ["Projects demo backend memory action failed.", "retry or refresh", "return null;"],
      fallback: "const result = addPackMemoryNote(pack, note);"
    },
    {
      name: "applyNextChoice",
      request: "await saveBackendPackNextAction(pack, choice)",
      catchNeedles: ["Projects demo backend next action failed.", "retry or refresh", "render();", "return;"],
      fallback: "const result = setPackNextAction(pack, choice);"
    },
    {
      name: "bindListActions",
      request: "await saveBackendPackNextAction(pack, input.value)",
      catchNeedles: ["Projects demo backend next action failed.", "retry or refresh"],
      fallback: "const result = setPackNextAction(pack, input.value);"
    },
    {
      name: "handlePackAction",
      request: "await runBackendPackAction(pack, action)",
      catchNeedles: ["Projects demo backend action failed.", "retry or refresh", "render();", "return;"],
      fallback: "if (action === \"start\")"
    }
  ];

  for (const contract of contracts) {
    const body = functionBody(source, contract.name);
    if (!body) {
      failures.push(`${contract.name}:missing`);
      continue;
    }

    const requestIndex = body.indexOf(contract.request);
    const catchIndex = requestIndex < 0 ? -1 : body.indexOf("catch (error)", requestIndex);
    const fallbackIndex = body.indexOf(contract.fallback);
    if (requestIndex < 0) {
      failures.push(`${contract.name}:missing backend request`);
      continue;
    }
    if (catchIndex < 0) {
      failures.push(`${contract.name}:missing catch`);
      continue;
    }
    if (fallbackIndex < 0) {
      failures.push(`${contract.name}:missing static fallback`);
      continue;
    }

    const catchSource = body.slice(catchIndex);
    const missingCatchNeedles = contract.catchNeedles.filter((needle) => !catchSource.includes(needle));
    if (missingCatchNeedles.length > 0) {
      failures.push(`${contract.name}:catch missing ${missingCatchNeedles.join(", ")}`);
    }

    const fallbackAfterCatch = body.indexOf(contract.fallback, catchIndex);
    if (fallbackAfterCatch >= 0) {
      const returnIndex = body.indexOf("return", catchIndex);
      if (returnIndex < 0 || returnIndex > fallbackAfterCatch) {
        failures.push(`${contract.name}:catch can fall through to static fallback`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length === 0 ? "backend catch paths show retry/refresh and do not continue into local workflow writes" : failures.join(", ")
  };
}

function functionBody(source, name) {
  const start = source.search(new RegExp(`(?:^|\\n)(?:async\\s+)?function\\s+${name}\\(`, "u"));
  if (start < 0) {
    return "";
  }

  const nextDeclaration = source.slice(start + 1).search(/\n(?:async\s+)?function\s+\w+\(/u);
  return nextDeclaration < 0
    ? source.slice(start)
    : source.slice(start, start + 1 + nextDeclaration);
}

function commandPreviewOwnsCopy(preview) {
  return typeof preview?.flowHint === "string"
    && preview.flowHint.startsWith("Flow:")
    && typeof preview?.primaryReason === "string"
    && preview.primaryReason.startsWith("Why:");
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
  const body = requestBodyFor(pathname, options);
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

function requestBodyFor(pathname, options) {
  const body = options.body || "";
  if (pathname !== "/api/state/browser" || (options.method || "GET") !== "PUT") {
    return body;
  }
  if (!String(options.headers?.["content-type"] || "").includes("application/json")) {
    return body;
  }
  try {
    const payload = JSON.parse(body);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.prototype.hasOwnProperty.call(payload, "kind")) {
      return body;
    }
    return JSON.stringify(browserWritePayload(payload));
  } catch {
    return body;
  }
}

function browserWritePayload(state) {
  return {
    kind: "projects-browser-state-v1",
    state
  };
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
