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

  check("health endpoint reports ok", health.ok === true, health.ok);
  check("hosted state uses Postgres", String(health.stateStorage || "").startsWith("postgres:"), health.stateStorage);
  check("HTML points at versioned demo.js", Boolean(assetVersion), assetVersion || "missing");
  check("production JS is minified", lineCount < 200, `${lineCount} line(s)`);
  check("backend create helper is present", script.includes("createBackendPack"), "createBackendPack");
  check("backend memory helper is present", script.includes("addBackendPackMemoryNote"), "addBackendPackMemoryNote");
  check("backend path helper is present", script.includes("saveBackendPackPath"), "saveBackendPackPath");
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

async function readText(pathname) {
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: { "cache-control": "no-cache" }
  });
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }
  return response.text();
}

async function readJson(pathname) {
  return JSON.parse(await readText(pathname));
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
