#!/usr/bin/env node

const DEFAULT_URL = "https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app";

const baseUrl = normalizeBaseUrl(process.argv[2] || DEFAULT_URL);

const checks = [];

try {
  const health = await readJson("/api/health");
  const html = await readText("/");
  const assetMatch = html.match(/assets\/demo\.js\?v=([^"']+)/u);
  const assetVersion = assetMatch?.[1] || "";
  const scriptPath = assetVersion
    ? `/assets/demo.js?v=${encodeURIComponent(assetVersion)}`
    : "/assets/demo.js";
  const script = await readText(scriptPath);
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
  const clientATitle = `Live isolation check ${isolationStamp}`;
  const sharedTitle = `Live shared sync check ${isolationStamp}`;
  await writeJson("/api/state", stateWithCheckPack(liveState, "live-isolation-check", clientATitle), {
    "x-projects-demo-client": clientAKey
  });
  await writeJson("/api/state", stateWithCheckPack(liveState, "live-shared-sync-check", sharedTitle), {
    "x-projects-demo-client": sharedKey
  });
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

  check("health endpoint reports ok", health.ok === true, health.ok);
  check("hosted state uses Postgres", String(health.stateStorage || "").startsWith("postgres:"), health.stateStorage);
  check("HTML points at versioned demo.js", Boolean(assetVersion), assetVersion || "missing");
  check("production JS is minified", lineCount < 200, `${lineCount} line(s)`);
  check("backend helper names are not readable", readableBackendHelpers.length === 0, readableBackendHelpers.join(", ") || "hidden");
  check("internal API strings are encoded", readableInternalStrings.length === 0, readableInternalStrings.join(", ") || "hidden");
  check("API state route returns demo packs", Array.isArray(liveState.packs) && liveState.packs.length > 0, `${liveState.packs?.length || 0} pack(s)`);
  check("hosted state rejects missing client key", unkeyedStateStatus === 400, unkeyedStateStatus);
  check("hosted client A reads its own state", stateHasPackTitle(clientAState, clientATitle), clientATitle);
  check("hosted client B does not read client A state", !stateHasPackTitle(clientBState, clientATitle), clientATitle);
  check("hosted sync key is readable from another request", stateHasPackTitle(sharedStateFromSecondRequest, sharedTitle), sharedTitle);
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
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: { "cache-control": "no-cache", ...headers }
  });
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }
  return response.text();
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

async function readStatus(pathname, headers = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
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

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
