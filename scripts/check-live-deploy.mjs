#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app";
const MAX_STATE_PACKS = 50;
const MAX_PLAIN_VALUE_DEPTH = 6;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const baseUrl = normalizeBaseUrl(process.argv[2] || DEFAULT_URL);

const checks = [];

try {
  const expectedFrontend = await expectedFrontendAssets();
  const health = await readJson("/api/health");
  const htmlResponse = await readResponse("/");
  const html = htmlResponse.text;
  const appShellHash = sha256(canonicalAppShellHtml(html));
  const csp = htmlResponse.headers.get("content-security-policy") || "";
  const sameOriginCors = await readResponse("/api/health", { origin: baseUrl.origin });
  const spoofedForwardedCors = await readResponse("/api/health", {
    origin: "https://spoofed.example",
    "x-forwarded-host": "spoofed.example"
  });
  const blockedCorsPreflightStatus = await readStatus("/api/state", {
    origin: "https://untrusted.example",
    "access-control-request-method": "PUT",
    "access-control-request-headers": "content-type, x-projects-demo-client"
  }, "OPTIONS");
  const blockedMethodPreflightStatus = await readStatus("/api/state", {
    origin: baseUrl.origin,
    "access-control-request-method": "PATCH",
    "access-control-request-headers": "content-type, x-projects-demo-client"
  }, "OPTIONS");
  const blockedHeaderPreflightStatus = await readStatus("/api/state", {
    origin: baseUrl.origin,
    "access-control-request-method": "PUT",
    "access-control-request-headers": "content-type, x-projects-demo-client, x-extra-demo-header"
  }, "OPTIONS");
  const runtimeConfigPath = runtimeConfigPathFromHtml(html);
  const assetMatch = html.match(/assets\/demo\.js\?v=([^"']+)/u);
  const assetVersion = assetMatch?.[1] || "";
  const scriptPath = assetVersion
    ? `/assets/demo.js?v=${encodeURIComponent(assetVersion)}`
    : "/assets/demo.js";
  const runtimeConfig = await readText(`/${runtimeConfigPath}`);
  const script = await readText(scriptPath);
  const css = await readText("/assets/demo.css");
  const scriptHash = sha256(script);
  const cssHash = sha256(normalizeDeployText(css));
  const publicAssetTexts = [
    { pathname: "/", text: html },
    { pathname: `/${runtimeConfigPath}`, text: runtimeConfig },
    { pathname: scriptPath, text: script },
    { pathname: "/assets/demo.css", text: css }
  ];
  const lineCount = script.split(/\r?\n/u).length;
  const liveClientKey = "demo-00000000-0000-4000-8000-000000000201";
  const apiHeaders = { "x-projects-demo-client": liveClientKey };
  const liveSeedPacks = await readJson("/api/demo-packs", apiHeaders);
  const liveSeedPacksHash = sha256(canonicalJson(liveSeedPacks));
  const liveState = await readJson("/api/state", apiHeaders);
  const commandPreview = await readJson("/api/packs/source-folder-audit/command", apiHeaders);
  const unkeyedStateStatus = await readStatus("/api/state");
  const weakKeyedStateStatus = await readStatus("/api/state", { "x-projects-demo-client": "password1" });
  const readableSyncKeyedStateStatus = await readStatus("/api/state", { "x-projects-demo-client": "sync-pass-word-pass" });
  const retiredGenericPatchStatus = await readStatus("/api/packs/source-folder-audit", {
    ...apiHeaders,
    "content-type": "application/json"
  }, "PATCH");
  const retiredStatePostStatus = await writeStatus("/api/state", { packs: [] }, {
    ...apiHeaders,
    "content-type": "application/json"
  }, "POST");
  const isolationStamp = Date.now().toString(36);
  const clientAKey = "demo-00000000-0000-4000-8000-000000000202";
  const clientBKey = "demo-00000000-0000-4000-8000-000000000203";
  const sharedKey = "sync-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const recoveryKey = "demo-00000000-0000-4000-8000-000000000204";
  const limitKey = "demo-00000000-0000-4000-8000-000000000205";
  const clientATitle = `Live isolation check ${isolationStamp}`;
  const sharedTitle = `Live shared sync check ${isolationStamp}`;
  const recoverySnapshotTitle = `Live recovery snapshot ${isolationStamp}`;
  const recoveryOverwriteTitle = `Live recovery overwritten ${isolationStamp}`;
  const unkeyedNonJsonStateWriteStatus = await writeStatus("/api/state", stateWithGeneratedPacks(1, "live-unkeyed-non-json-state"), {
    "content-type": "text/plain"
  }, "PUT");
  const nonJsonStateStatus = await writeStatus("/api/state", stateWithGeneratedPacks(1, "live-non-json-state"), {
    "x-projects-demo-client": limitKey,
    "content-type": "text/plain"
  }, "PUT");
  const oversizedStateStatus = await writeStatus("/api/state", stateWithGeneratedPacks(MAX_STATE_PACKS + 1, "live-oversized-state"), {
    "x-projects-demo-client": limitKey,
    "content-type": "application/json"
  }, "PUT");
  const duplicateIdStateStatus = await writeStatus("/api/state", stateWithDuplicatePackIds("live-duplicate-id-state"), {
    "x-projects-demo-client": limitKey,
    "content-type": "application/json"
  }, "PUT");
  const invalidPackStateStatus = await writeStatus("/api/state", stateWithMissingPackTitle("live-missing-title-state"), {
    "x-projects-demo-client": limitKey,
    "content-type": "application/json"
  }, "PUT");
  const deepReceiptStateStatus = await writeStatus("/api/state", stateWithGeneratedPacks(1, "live-deep-receipt-state", {
    actionReceipt: deepActionReceipt(MAX_PLAIN_VALUE_DEPTH + 1)
  }), {
    "x-projects-demo-client": limitKey,
    "content-type": "application/json"
  }, "PUT");
  await writeJson("/api/state", stateWithCheckPack(liveState, "live-isolation-check", clientATitle), {
    "x-projects-demo-client": clientAKey
  });
  await writeJson("/api/state", stateWithCheckPack(liveState, "live-shared-sync-check", sharedTitle), {
    "x-projects-demo-client": sharedKey
  });
  await writeJson("/api/state", stateWithCheckPack(liveState, "live-recovery-check", recoverySnapshotTitle), {
    "x-projects-demo-client": recoveryKey
  });
  const exportedRecoveryState = await readJson("/api/state", { "x-projects-demo-client": recoveryKey });
  await writeJson("/api/state", stateWithCheckPack(exportedRecoveryState, "live-recovery-check", recoveryOverwriteTitle), {
    "x-projects-demo-client": recoveryKey
  });
  await writeJson("/api/state", exportedRecoveryState, { "x-projects-demo-client": recoveryKey });
  const restoredRecoveryState = await readJson("/api/state", { "x-projects-demo-client": recoveryKey });
  const clientAState = await readJson("/api/state", { "x-projects-demo-client": clientAKey });
  const clientBState = await readJson("/api/state", { "x-projects-demo-client": clientBKey });
  const sharedStateFromSecondRequest = await readJson("/api/state", { "x-projects-demo-client": sharedKey });
  const unkeyedEraseStatus = await readStatus("/api/state/erase", {}, "POST");
  const eraseClientAStateStatus = await readStatus("/api/state/erase", { "x-projects-demo-client": clientAKey }, "POST");
  const clientAStateAfterErase = await readJson("/api/state", { "x-projects-demo-client": clientAKey });
  const sharedStateAfterErase = await readJson("/api/state", { "x-projects-demo-client": sharedKey });
  const eraseSharedStateStatus = await readStatus("/api/state/erase", { "x-projects-demo-client": sharedKey }, "POST");
  const sharedStateAfterCleanup = await readJson("/api/state", { "x-projects-demo-client": sharedKey });
  const eraseRecoveryStateStatus = await readStatus("/api/state/erase", { "x-projects-demo-client": recoveryKey }, "POST");
  const recoveryStateAfterCleanup = await readJson("/api/state", { "x-projects-demo-client": recoveryKey });
  const backendHelperNames = [
    "runBackendPackAction",
    "saveBackendPackNextAction",
    "loadBackendSeedPacks",
    "loadBackendPackCommandPreview",
    "createBackendPack",
    "addBackendPackMemoryNote",
    "saveBackendPackPath"
  ];
  const internalFrontendStrings = [
    "/api/packs",
    "/api/demo-packs",
    "/api/state",
    "x-projects-demo-client",
    "projects-static-demo-api-client-v1"
  ];
  const readableBackendHelpers = backendHelperNames.filter((name) => script.includes(name));
  const readableInternalStrings = internalFrontendStrings.filter((value) => script.includes(value));
  const readableApiQueryOverride = [
    "DEMO_API_QUERY_PARAM",
    ".get(\"api\")",
    ".get('api')"
  ].filter((value) => script.includes(value));
  const retiredDiagnosticTokens = [
    "assets/demo-metadata.json",
    "Build snapshot",
    "Demo script measured",
    "File check",
    "style audit"
  ].filter((value) => script.includes(value));
  const publicSourceMapReferences = publicAssetTexts
    .filter((asset) => /sourceMappingURL|sourceURL/iu.test(asset.text))
    .map((asset) => asset.pathname);
  const publicPrivatePathReferences = publicAssetTexts
    .filter((asset) => /(?:github\.com\/jared-bidlow|(?<![A-Za-z])(?:[A-Za-z]:[\\/]|\\\\\?\\[A-Za-z]:\\)|\.git[\\/]|server[\\/]server\.js|server[\\/]package-lock\.json|node_modules[\\/])/iu.test(asset.text))
    .map((asset) => asset.pathname);
  const sourceMapStatuses = await Promise.all([
    "/assets/demo.js.map",
    "/assets/demo.css.map",
    "/assets/app.css",
    "/assets/app.css.map",
    "/assets/demo-metadata.json",
    "/assets/not-allowlisted.txt",
    "/assets/private/demo.js",
    "/data/demo-packs.json",
    "/data/not-allowlisted.json",
    "/render.yaml"
  ].map(async (pathname) => [pathname, await readStatus(pathname)]));
  const healthText = JSON.stringify(health);

  check("health endpoint reports ok", health.ok === true, health.ok);
  check("hosted state uses Postgres", health.storage === "postgres", health.storage || "missing");
  check("health endpoint hides storage internals", !("stateStorage" in health) && !/projects_demo_state|DATABASE_URL|PGHOST|PGPASSWORD|state\.json|\/app\/state/iu.test(healthText), healthText);
  check("live API health sends shared security headers", sharedSecurityHeadersOk(sameOriginCors.headers), sharedSecurityHeaderDetail(sameOriginCors.headers));
  check("app shell sends CSP", csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), csp || "missing");
  check("app shell blocks framing", csp.includes("frame-ancestors 'none'"), csp || "missing");
  check("app shell sends legacy frame deny header", htmlResponse.headers.get("x-frame-options") === "DENY", htmlResponse.headers.get("x-frame-options") || "missing");
  check("app shell limits cross-origin resource reuse", htmlResponse.headers.get("cross-origin-resource-policy") === "same-origin", htmlResponse.headers.get("cross-origin-resource-policy") || "missing");
  check("app shell isolates opener context", htmlResponse.headers.get("cross-origin-opener-policy") === "same-origin", htmlResponse.headers.get("cross-origin-opener-policy") || "missing");
  check("app shell requires cross-origin embedder policy", htmlResponse.headers.get("cross-origin-embedder-policy") === "require-corp", htmlResponse.headers.get("cross-origin-embedder-policy") || "missing");
  check("app shell disables sensitive browser permissions", permissionsPolicyDisables(htmlResponse.headers.get("permissions-policy"), ["camera", "geolocation", "microphone", "payment", "usb"]), htmlResponse.headers.get("permissions-policy") || "missing");
  check("app shell opts out of search indexing", htmlResponse.headers.get("x-robots-tag") === "noindex, nofollow, noarchive", htmlResponse.headers.get("x-robots-tag") || "missing");
  check("app shell limits network calls to same origin", csp.includes("connect-src 'self'"), csp || "missing");
  check("runtime API config loads before the frontend script", runtimeConfigPath && html.indexOf("assets/runtime-config.js") < html.indexOf("assets/demo.js"), runtimeConfigPath || "missing");
  check("runtime API config is served as same-origin JavaScript", runtimeConfig.includes("window.PROJECTS_API_BASE_URL = location.origin;"), runtimeConfig.trim() || "missing");
  check("sync copy-code control is deployed", html.includes('id="sync-code-copy-code"') && html.includes("Copy code"), "sync-code-copy-code");
  check("app shell contains no inline scripts", !hasInlineScript(html), "external scripts only");
  check("script policy avoids unsafe inline scripts", scriptSrcDirective(csp) === "script-src 'self'", scriptSrcDirective(csp) || "missing");
  check("style policy avoids unsafe inline styles", styleSrcDirective(csp) === "style-src 'self'", styleSrcDirective(csp) || "missing");
  check("content policy blocks unused loaders", cspBlocksUnusedLoaders(csp), unusedLoaderDirectiveDetail(csp));
  check("live API CORS is same-origin only", sameOriginCors.headers.get("access-control-allow-origin") === baseUrl.origin, sameOriginCors.headers.get("access-control-allow-origin") || "missing");
  check("live API CORS omits retired PATCH method", !String(sameOriginCors.headers.get("access-control-allow-methods") || "").includes("PATCH"), sameOriginCors.headers.get("access-control-allow-methods") || "missing");
  check("live API rejects forwarded-host CORS spoofing", !spoofedForwardedCors.headers.get("access-control-allow-origin"), spoofedForwardedCors.headers.get("access-control-allow-origin") || "no cors");
  check("live API rejects third-party preflight", blockedCorsPreflightStatus === 403, blockedCorsPreflightStatus);
  check("live API rejects disallowed preflight method", blockedMethodPreflightStatus === 403, blockedMethodPreflightStatus);
  check("live API rejects disallowed preflight header", blockedHeaderPreflightStatus === 403, blockedHeaderPreflightStatus);
  check("HTML points at versioned demo.js", Boolean(assetVersion), assetVersion || "missing");
  check("live app shell matches this checkout", appShellHash === expectedFrontend.appShellHash, `live=${appShellHash} expected=${expectedFrontend.appShellHash}`);
  check("live protected JS matches this checkout", scriptHash === expectedFrontend.scriptHash, `live=${scriptHash} expected=${expectedFrontend.scriptHash}`);
  check("live CSS content matches this checkout", cssHash === expectedFrontend.cssHash, `live=${cssHash} expected=${expectedFrontend.cssHash}`);
  check("production JS is minified", lineCount < 200, `${lineCount} line(s)`);
  check("weak random fallback is absent", !script.includes("Math.random"), script.includes("Math.random") ? "Math.random" : "absent");
  check("backend helper names are not readable", readableBackendHelpers.length === 0, readableBackendHelpers.join(", ") || "hidden");
  check("internal API strings are encoded", readableInternalStrings.length === 0, readableInternalStrings.join(", ") || "hidden");
  check("API base cannot be overridden from the query string", readableApiQueryOverride.length === 0, readableApiQueryOverride.join(", ") || "absent");
  check("retired browser diagnostics are absent", retiredDiagnosticTokens.length === 0, retiredDiagnosticTokens.join(", ") || "absent");
  check("recovery controls are deployed", script.includes("copy-recovery-state") && script.includes("restore-recovery-state"), "copy/restore recovery controls");
  check("public assets have no source map references", publicSourceMapReferences.length === 0, publicSourceMapReferences.join(", ") || "absent");
  check("public assets hide private paths", publicPrivatePathReferences.length === 0, publicPrivatePathReferences.join(", ") || "absent");
  check("source map, retired metadata, unlisted public files, direct seed JSON, and retired provider config are not served", sourceMapStatuses.every(([, status]) => status === 404), sourceMapStatuses.map(([pathname, status]) => `${pathname}:${status}`).join(", "));
  check("API state route returns demo packs", Array.isArray(liveState.packs) && liveState.packs.length > 0, `${liveState.packs?.length || 0} pack(s)`);
  check("API seed data route returns demo packs", Array.isArray(liveSeedPacks) && liveSeedPacks.length > 0, `${liveSeedPacks?.length || 0} pack(s)`);
  check("API seed data matches this checkout", liveSeedPacksHash === expectedFrontend.seedPacksHash, `live=${liveSeedPacksHash} expected=${expectedFrontend.seedPacksHash}`);
  check("generic pack PATCH route is retired", retiredGenericPatchStatus === 404, retiredGenericPatchStatus);
  check("generic state POST route is retired", retiredStatePostStatus === 404, retiredStatePostStatus);
  check("hosted state rejects missing client key", unkeyedStateStatus === 400, unkeyedStateStatus);
  check("hosted state rejects weak manual client keys", weakKeyedStateStatus === 400, weakKeyedStateStatus);
  check("hosted state rejects readable sync-code client keys", readableSyncKeyedStateStatus === 400, readableSyncKeyedStateStatus);
  check("hosted state writes reject missing client key before body parsing", unkeyedNonJsonStateWriteStatus === 400, unkeyedNonJsonStateWriteStatus);
  check("hosted state rejects non-json snapshots", nonJsonStateStatus === 415, nonJsonStateStatus);
  check("hosted state rejects oversized snapshots", oversizedStateStatus === 400, oversizedStateStatus);
  check("hosted state rejects duplicate work ids", duplicateIdStateStatus === 400, duplicateIdStateStatus);
  check("hosted state rejects invalid work items", invalidPackStateStatus === 400, invalidPackStateStatus);
  check("hosted state rejects deep action receipts", deepReceiptStateStatus === 400, deepReceiptStateStatus);
  check("hosted client A reads its own state", stateHasPackTitle(clientAState, clientATitle), clientATitle);
  check("hosted client B does not read client A state", !stateHasPackTitle(clientBState, clientATitle), clientATitle);
  check("hosted sync key is readable from another request", stateHasPackTitle(sharedStateFromSecondRequest, sharedTitle), sharedTitle);
  check("hosted state erase rejects missing client key", unkeyedEraseStatus === 400, unkeyedEraseStatus);
  check("hosted state erase accepts current client key", eraseClientAStateStatus === 200, eraseClientAStateStatus);
  check("hosted erased state no longer has client work", !stateHasPackTitle(clientAStateAfterErase, clientATitle), clientATitle);
  check("hosted state erase keeps shared row", stateHasPackTitle(sharedStateAfterErase, sharedTitle), sharedTitle);
  check("hosted state can restore an exported snapshot", stateHasPackTitle(restoredRecoveryState, recoverySnapshotTitle), recoverySnapshotTitle);
  check("hosted state restore removes later overwrite", !stateHasPackTitle(restoredRecoveryState, recoveryOverwriteTitle), recoveryOverwriteTitle);
  check("hosted verifier cleanup erases shared row", eraseSharedStateStatus === 200 && !stateHasPackTitle(sharedStateAfterCleanup, sharedTitle), `${eraseSharedStateStatus} / ${sharedTitle}`);
  check("hosted verifier cleanup erases recovery row", eraseRecoveryStateStatus === 200 && !stateHasPackTitle(recoveryStateAfterCleanup, recoverySnapshotTitle), `${eraseRecoveryStateStatus} / ${recoverySnapshotTitle}`);
  check("API command route resolves selected work", commandPreview.action === "unblock" && commandPreview.next === "Set Blocker: None", `${commandPreview.action || "missing"} / ${commandPreview.next || "missing"}`);
  check("retired triage surface is absent", !/triage|parse-triage|copy-triage/iu.test(script), "triage");
  check("private repo and local path strings are absent", !/(github\.com\/jared-bidlow|C:\\|C:\/|\.git\/config|server\/server\.js)/iu.test(script), "private path scan");

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }

  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    console.error(`\n${baseUrl} is not serving the protected current frontend yet.`);
    process.exitCode = 1;
  } else {
    console.log(`\n${baseUrl} is serving the protected current frontend.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

async function readText(pathname, headers = {}) {
  return (await readResponse(pathname, headers)).text;
}

async function readResponse(pathname, headers = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: { "cache-control": "no-cache", ...headers }
  });
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }
  return {
    headers: response.headers,
    text: await response.text()
  };
}

async function readJson(pathname, headers = {}) {
  return JSON.parse(await readText(pathname, headers));
}

async function writeJson(pathname, payload, headers = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: "PUT",
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }
  return response.json();
}

async function readStatus(pathname, headers = {}, method = "GET") {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: { "cache-control": "no-cache", ...headers }
  });
  return response.status;
}

async function writeStatus(pathname, payload, headers = {}, method = "PUT") {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });
  return response.status;
}

function stateWithCheckPack(state, id, title) {
  const packs = Array.isArray(state?.packs) ? state.packs : [];
  const checkPack = {
    id,
    title,
    type: "live-check",
    status: "active",
    blocker: "none",
    next: "Open",
    due: "",
    owner: "live verifier",
    purpose: "Verify hosted demo state separation.",
    doneWhen: "Live verifier can read this state only through the intended key.",
    sources: ["live-deploy-check"],
    memory: [],
    activity: ["Live deploy verifier wrote this check row."]
  };
  return {
    ...state,
    packs: [checkPack, ...packs.filter((pack) => pack?.id !== id)],
    selectedId: id,
    status: `Live verifier wrote ${title}.`,
    actionReceipt: null
  };
}

function stateHasPackTitle(state, title) {
  return Array.isArray(state?.packs) && state.packs.some((pack) => pack?.title === title);
}

function stateWithGeneratedPacks(count, prefix, options = {}) {
  const packs = Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `Generated live work ${index + 1}`,
    type: "limit-check",
    status: "active",
    blocker: "none",
    next: "Open",
    due: "",
    owner: "live verifier",
    purpose: "Verify hosted state row limits.",
    doneWhen: "The hosted backend rejects oversized state rows.",
    sources: ["live-deploy-check"],
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

function runtimeConfigPathFromHtml(html) {
  const match = html.match(/<script src="(assets\/runtime-config\.js\?v=[^"]+)" defer><\/script>/u);
  return match?.[1] || "";
}

async function expectedFrontendAssets() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "projects-live-frontend-"));
  const protectedScriptPath = path.join(tmpDir, "demo.js");
  try {
    const result = spawnSync(process.execPath, ["scripts/protect-frontend.mjs", "assets/demo.js", protectedScriptPath], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(`Local protected frontend build failed.\n${result.stderr || result.stdout}`);
    }

    const [script, css, appShell, seedPacks] = await Promise.all([
      fs.readFile(protectedScriptPath, "utf8"),
      fs.readFile(path.join(repoRoot, "assets/demo.css"), "utf8"),
      fs.readFile(path.join(repoRoot, "index.html"), "utf8"),
      fs.readFile(path.join(repoRoot, "data/demo-packs.json"), "utf8")
    ]);

    return {
      appShellHash: sha256(canonicalAppShellHtml(appShell)),
      scriptHash: sha256(script),
      cssHash: sha256(normalizeDeployText(css)),
      seedPacksHash: sha256(canonicalJson(JSON.parse(seedPacks)))
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function canonicalAppShellHtml(html) {
  return normalizeDeployText(html)
    .replace(/\s*<script[^>]*src="assets\/runtime-config\.js[^"]*"[^>]*><\/script>\s*/gu, "\n  ")
    .replace(/(href="assets\/demo\.css\?v=)[^"]*/gu, "$1<asset-version>")
    .replace(/(src="assets\/demo\.js\?v=)[^"]*/gu, "$1<asset-version>");
}

function normalizeDeployText(value) {
  return String(value).replace(/\r\n/gu, "\n");
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
  return typeof headers?.get === "function" ? headers.get(name) || "" : headers?.[name] || "";
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
