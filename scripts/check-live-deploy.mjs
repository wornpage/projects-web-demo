#!/usr/bin/env node

const DEFAULT_URL = "https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app";

const baseUrl = normalizeBaseUrl(process.argv[2] || DEFAULT_URL);

const checks = [];

try {
  const health = await readJson("/api/health");
  const htmlResponse = await readResponse("/");
  const html = htmlResponse.text;
  const csp = htmlResponse.headers.get("content-security-policy") || "";
  const sameOriginCors = await readResponse("/api/health", { origin: baseUrl.origin });
  const blockedCorsPreflightStatus = await readStatus("/api/state", {
    origin: "https://untrusted.example",
    "access-control-request-method": "PUT",
    "access-control-request-headers": "content-type, x-projects-demo-client"
  }, "OPTIONS");
  const cspNonce = nonceFromCsp(csp);
  const htmlNonce = nonceFromHtml(html);
  const assetMatch = html.match(/assets\/demo\.js\?v=([^"']+)/u);
  const assetVersion = assetMatch?.[1] || "";
  const scriptPath = assetVersion
    ? `/assets/demo.js?v=${encodeURIComponent(assetVersion)}`
    : "/assets/demo.js";
  const script = await readText(scriptPath);
  const publicAssetTexts = [
    { pathname: "/", text: html },
    { pathname: scriptPath, text: script },
    { pathname: "/assets/demo.css", text: await readText("/assets/demo.css") },
    { pathname: "/assets/app.css", text: await readText("/assets/app.css") },
    { pathname: "/data/demo-packs.json", text: await readText("/data/demo-packs.json") }
  ];
  const lineCount = script.split(/\r?\n/u).length;
  const liveClientKey = `live-check-${Date.now().toString(36)}`;
  const apiHeaders = { "x-projects-demo-client": liveClientKey };
  const liveState = await readJson("/api/state", apiHeaders);
  const commandPreview = await readJson("/api/packs/source-folder-audit/command", apiHeaders);
  const unkeyedStateStatus = await readStatus("/api/state");
  const isolationStamp = Date.now().toString(36);
  const clientAKey = "live-check-browser-a";
  const clientBKey = "live-check-browser-b";
  const sharedKey = "sync-live-check-shared";
  const recoveryKey = "live-check-recovery";
  const clientATitle = `Live isolation check ${isolationStamp}`;
  const sharedTitle = `Live shared sync check ${isolationStamp}`;
  const recoverySnapshotTitle = `Live recovery snapshot ${isolationStamp}`;
  const recoveryOverwriteTitle = `Live recovery overwritten ${isolationStamp}`;
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
  const backendHelperNames = [
    "runBackendPackAction",
    "saveBackendPackNextAction",
    "loadBackendPackCommandPreview",
    "createBackendPack",
    "addBackendPackMemoryNote",
    "saveBackendPackPath"
  ];
  const internalFrontendStrings = [
    "/api/packs",
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
    "/assets/app.css.map",
    "/assets/demo-metadata.json",
    "/assets/not-allowlisted.txt",
    "/assets/private/demo.js",
    "/data/not-allowlisted.json",
    "/render.yaml"
  ].map(async (pathname) => [pathname, await readStatus(pathname)]));
  const healthText = JSON.stringify(health);

  check("health endpoint reports ok", health.ok === true, health.ok);
  check("hosted state uses Postgres", health.storage === "postgres", health.storage || "missing");
  check("health endpoint hides storage internals", !("stateStorage" in health) && !/projects_demo_state|DATABASE_URL|PGHOST|PGPASSWORD|state\.json|\/app\/state/iu.test(healthText), healthText);
  check("app shell sends CSP", csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), csp || "missing");
  check("app shell blocks framing", csp.includes("frame-ancestors 'none'"), csp || "missing");
  check("app shell limits network calls to same origin", csp.includes("connect-src 'self'"), csp || "missing");
  check("runtime API script nonce matches CSP", Boolean(cspNonce) && cspNonce === htmlNonce, htmlNonce || "missing");
  check("script policy avoids unsafe inline scripts", csp.includes(`script-src 'self' 'nonce-${cspNonce}'`) && !scriptSrcDirective(csp).includes("'unsafe-inline'"), scriptSrcDirective(csp));
  check("live API CORS is same-origin only", sameOriginCors.headers.get("access-control-allow-origin") === baseUrl.origin, sameOriginCors.headers.get("access-control-allow-origin") || "missing");
  check("live API rejects third-party preflight", blockedCorsPreflightStatus === 403, blockedCorsPreflightStatus);
  check("HTML points at versioned demo.js", Boolean(assetVersion), assetVersion || "missing");
  check("production JS is minified", lineCount < 200, `${lineCount} line(s)`);
  check("weak random fallback is absent", !script.includes("Math.random"), script.includes("Math.random") ? "Math.random" : "absent");
  check("backend helper names are not readable", readableBackendHelpers.length === 0, readableBackendHelpers.join(", ") || "hidden");
  check("internal API strings are encoded", readableInternalStrings.length === 0, readableInternalStrings.join(", ") || "hidden");
  check("API base cannot be overridden from the query string", readableApiQueryOverride.length === 0, readableApiQueryOverride.join(", ") || "absent");
  check("retired browser diagnostics are absent", retiredDiagnosticTokens.length === 0, retiredDiagnosticTokens.join(", ") || "absent");
  check("public assets have no source map references", publicSourceMapReferences.length === 0, publicSourceMapReferences.join(", ") || "absent");
  check("public assets hide private paths", publicPrivatePathReferences.length === 0, publicPrivatePathReferences.join(", ") || "absent");
  check("source map, retired metadata, unlisted public files, and retired provider config are not served", sourceMapStatuses.every(([, status]) => status === 404), sourceMapStatuses.map(([pathname, status]) => `${pathname}:${status}`).join(", "));
  check("API state route returns demo packs", Array.isArray(liveState.packs) && liveState.packs.length > 0, `${liveState.packs?.length || 0} pack(s)`);
  check("hosted state rejects missing client key", unkeyedStateStatus === 400, unkeyedStateStatus);
  check("hosted client A reads its own state", stateHasPackTitle(clientAState, clientATitle), clientATitle);
  check("hosted client B does not read client A state", !stateHasPackTitle(clientBState, clientATitle), clientATitle);
  check("hosted sync key is readable from another request", stateHasPackTitle(sharedStateFromSecondRequest, sharedTitle), sharedTitle);
  check("hosted state can restore an exported snapshot", stateHasPackTitle(restoredRecoveryState, recoverySnapshotTitle), recoverySnapshotTitle);
  check("hosted state restore removes later overwrite", !stateHasPackTitle(restoredRecoveryState, recoveryOverwriteTitle), recoveryOverwriteTitle);
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

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
