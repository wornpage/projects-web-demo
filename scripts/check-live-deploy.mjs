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

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
