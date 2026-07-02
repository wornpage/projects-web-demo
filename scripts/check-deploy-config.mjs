#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

const dockerfile = await readRepoFile("Dockerfile");
const gitignore = await readRepoFile(".gitignore");
const packageJson = JSON.parse(await readRepoFile("server/package.json"));
const readme = await readRepoFile("README.md");
const serverReadme = await readRepoFile("server/README.md");
const deployDoc = await readRepoFile("docs/deploy-outplane.md");
const liveVerifier = await readRepoFile("scripts/check-live-deploy.mjs");
const shipGate = await readRepoFile("scripts/check-ship.mjs");
const serverSource = await readRepoFile("server/server.js");
const securitySource = await readRepoFile("server/src/security.js");
const storageSource = await readRepoFile("server/src/state-storage.js");
const invalidStorageStartup = await invalidStorageModeStartupResult();

const liveUrl = liveVerifier.match(/const DEFAULT_URL = "([^"]+)"/u)?.[1] || "";
const environmentRows = tableRowsBetween(deployDoc, "## Environment", "## Checks");
const environmentVariables = new Map(environmentRows.map((row) => [stripTicks(row[0]), row]));

check("live verifier has one Outplane default URL", /^https:\/\/[^/]+\.outplane\.app$/u.test(liveUrl), liveUrl || "missing");
check("deploy doc current app matches live verifier", deployDoc.includes(liveUrl), liveUrl || "missing");
check("deploy doc uses Dockerfile build method", deployDoc.includes("| Build method | Dockerfile |"), "Dockerfile");
check("deploy doc pins root directory", deployDoc.includes("| Root directory | `/` |"), "root /");
check("deploy doc pins app port", deployDoc.includes("| App port | `5179`, or the value Outplane injects as `PORT` |"), "5179/PORT");
check("deploy doc pins health endpoint", deployDoc.includes("| Health check | `/api/health` |"), "/api/health");

const requiredEnvRows = new Map([
  ["NODE_ENV", "`production`"],
  ["PROJECTS_STATE_STORAGE", "`postgres`"],
  ["PGHOST", "Outplane-provided database host"],
  ["PGDATABASE", "Outplane-provided database name"],
  ["PGUSER", "Outplane-provided database role"],
  ["PGPASSWORD", "Outplane-provided database password"],
  ["PGSSLMODE", "`require`"]
]);

for (const [name, expectedValue] of requiredEnvRows.entries()) {
  const row = environmentVariables.get(name);
  check(`deploy env documents ${name}`, Boolean(row) && row[1] === expectedValue, row ? row.join(" | ") : "missing");
}

check("deploy env allows explicit public origin", environmentVariables.has("PROJECTS_PUBLIC_ORIGIN"), "PROJECTS_PUBLIC_ORIGIN");
for (const [name, expectedDefault] of new Map([
  ["PROJECTS_RATE_LIMIT_WINDOW_MS", "`60000`"],
  ["PROJECTS_RATE_LIMIT_API_REQUESTS", "`1200`"],
  ["PROJECTS_RATE_LIMIT_SOURCE_WRITE_REQUESTS", "`600`"],
  ["PROJECTS_RATE_LIMIT_STATE_WRITE_REQUESTS", "`120`"]
]).entries()) {
  const row = environmentVariables.get(name);
  check(`deploy env documents ${name}`, Boolean(row) && row[1].includes(expectedDefault), row ? row.join(" | ") : "missing");
}
check("hosted env table omits file-backed state path", !environmentVariables.has("PROJECTS_STATE_FILE"), "PROJECTS_STATE_FILE absent");
check("deploy doc forbids hosted PROJECTS_STATE_FILE", deployDoc.includes("Do not set `PROJECTS_STATE_FILE` for the hosted Postgres app."), "warning present");
check("deploy doc documents DATABASE_URL alternative", deployDoc.includes("`DATABASE_URL` in place of the `PG*` variables."), "DATABASE_URL alternative");
check("deploy doc documents allowed origin override", deployDoc.includes("`PROJECTS_ALLOWED_ORIGINS`"), "PROJECTS_ALLOWED_ORIGINS");

check("Docker runtime binds for hosted app", includesAll(dockerfile, [
  "ENV HOST=0.0.0.0",
  "ENV PORT=5179",
  "EXPOSE 5179"
]), "HOST/PORT/EXPOSE");
check("Docker runtime keeps file state only as local fallback", dockerfile.includes("ENV PROJECTS_STATE_FILE=/app/state/state.json"), "PROJECTS_STATE_FILE fallback");
check("Docker healthcheck probes API health", dockerfile.includes("/api/health"), "/api/health");
check("Docker runtime does not copy server/data", !/COPY\b[\s\S]*server\/data/u.test(dockerfile), "server/data absent");

check("git ignores local server state", gitignoreLineExists(gitignore, "server/data/"), "server/data/");
check("git ignores generated static artifacts", gitignoreLineExists(gitignore, "dist/"), "dist/");
check("server package exposes deploy check", packageJson.scripts?.["deploy:check"] === "node ../scripts/check-deploy-config.mjs", packageJson.scripts?.["deploy:check"] || "missing");
check("ship gate runs deploy config before live", sourceOrder(shipGate, [
  'label: "deploy config"',
  'label: "git ship state"',
  'label: "live Outplane deploy"'
]), "deploy config and git state before live");
check("ship gate verifies clean synced git state", shipGate.includes('args: ["scripts/check-git-ship-state.mjs"]'), "check-git-ship-state.mjs");
check("server asset fallback is content-derived", serverSource.includes("|| storage.contentAssetVersion()") && includesAll(storageSource, [
  "function contentAssetVersion()",
  "crypto.createHash(\"sha256\")",
  "\"data/demo-packs.json\""
]), "contentAssetVersion");
check("server asset fallback avoids startup-random keys", assetVersionAvoidsRandomFallback(), "no timestamp/random fallback");
const declaredBodyLimit = declaredBodyLimitBeforeStream(serverSource);
check("server rejects declared oversized bodies before reading", declaredBodyLimit.ok, declaredBodyLimit.detail);
const apiRateLimit = apiRateLimitConfigured(serverSource);
check("server rate limits API and state writes before body parsing", apiRateLimit.ok, apiRateLimit.detail);
check(
  "server rejects invalid state storage mode",
  invalidStorageStartup.exited
    && invalidStorageStartup.code !== 0
    && invalidStorageStartup.output.includes("PROJECTS_STATE_STORAGE must be \"file\" or \"postgres\"."),
  invalidStorageStartup.detail
);
check("live verifier rebuilds expected protected frontend", includesAll(liveVerifier, [
  "function expectedFrontendAssets()",
  "scripts/protect-frontend.mjs",
  "assets/demo.js"
]), "expectedFrontendAssets");
check("live verifier compares deployed frontend hashes", includesAll(liveVerifier, [
  "live app shell matches this checkout",
  "live protected JS matches this checkout",
  "live CSS content matches this checkout",
  "canonicalAppShellHtml(appShell)",
  "sha256(script)",
  "normalizeDeployText(css)"
]), "live app shell/JS/CSS hash match");
check("live verifier compares API seed data to checkout", includesAll(liveVerifier, [
  "API seed data matches this checkout",
  "data/demo-packs.json",
  "seedPacksHash",
  "canonicalJson(liveSeedPacks)"
]), "live seed data hash match");
check("live verifier blocks non-public repo files", includesAll(liveVerifier, [
  "hosted non-public repo files are not served",
  "/server/server.js",
  "/src/demo/demo.js",
  "/.git/config",
  "/docs/public-exposure-audit.md"
]), "live non-public repo file rejection");
check("live verifier rejects unkeyed API seed data", includesAll(liveVerifier, [
  "unkeyedSeedPacksStatus",
  "hosted seed data rejects missing client key"
]), "unkeyed seed data rejection");
check("live verifier rejects unkeyed pack reads", includesAll(liveVerifier, [
  "unkeyedPacksStatus",
  "unkeyedCommandPreviewStatus",
  "hosted pack list rejects missing client key",
  "hosted command preview rejects missing client key"
]), "unkeyed pack read rejection");
check("live verifier rejects unkeyed workflow writes before body parsing", includesAll(liveVerifier, [
  "unkeyedWorkflowWriteStatuses",
  "hosted workflow writes reject missing client key before body parsing"
]), "unkeyed workflow write rejection");
check("live verifier rejects unkeyed recovery restore before body parsing", includesAll(liveVerifier, [
  "unkeyedRestoreStatus",
  "hosted recovery restore rejects missing client key before body parsing",
  "\"/api/state/restore\""
]), "unkeyed recovery restore rejection");
check("live verifier rejects unkeyed sync copy before body parsing", includesAll(liveVerifier, [
  "unkeyedSyncCopyStatus",
  "hosted sync copy rejects missing client key before body parsing",
  "\"/api/state/sync-copy\""
]), "unkeyed sync copy rejection");
check("live verifier rejects unkeyed filter writes before body parsing", includesAll(liveVerifier, [
  "unkeyedFilterWriteStatus",
  "hosted filter write rejects missing client key before body parsing",
  "\"/api/state/filter\""
]), "unkeyed filter write rejection");
check("live verifier rejects unkeyed selected-work writes before body parsing", includesAll(liveVerifier, [
  "unkeyedSelectedWriteStatus",
  "hosted selected-work write rejects missing client key before body parsing",
  "\"/api/state/selected\""
]), "unkeyed selected-work write rejection");
check("live verifier rejects unkeyed scenario writes before body parsing", includesAll(liveVerifier, [
  "unkeyedScenarioWriteStatus",
  "hosted scenario write rejects missing client key before body parsing",
  "\"/api/state/scenario\""
]), "unkeyed scenario write rejection");
check("live verifier rejects unkeyed profile writes before body parsing", includesAll(liveVerifier, [
  "unkeyedProfileWriteStatus",
  "hosted profile write rejects missing client key before body parsing",
  "\"/api/state/profile\""
]), "unkeyed profile write rejection");
check("live verifier rejects unkeyed reset writes before storage", includesAll(liveVerifier, [
  "unkeyedResetWriteStatus",
  "hosted reset write rejects missing client key before storage",
  "\"/api/state/reset\""
]), "unkeyed reset write rejection");
check("live verifier handles hosted reset", includesAll(liveVerifier, [
  "validResetWrite",
  "hosted named reset endpoint restores default row",
  "\"/api/state/reset\""
]), "hosted reset");
check("live verifier proves browser-row status preservation", includesAll(liveVerifier, [
  "browserStatusOverwriteWrite",
  "hosted browser-row write preserves backend-owned status"
]), "browser-row status preservation");
check("live verifier rejects invalid work-path status writes", includesAll(liveVerifier, [
  "invalidWorkPathStatus",
  "hosted work-path rejects invalid statuses"
]), "invalid work-path status rejection");
check("live verifier handles hosted oversized upload rejection", includesAll(liveVerifier, [
  "hosted state rejects oversized JSON uploads before storage",
  "hostedOversizedBodyRejected",
  "stateHasPackId(limitStateAfterRejectedWrites, \"live-oversized-body-state-1\")"
]), "hosted oversized upload rejection");
check(
  "live verifier avoids process-local hosted write-rate assertion",
  !liveVerifier.includes("hosted state write rate limit rejects before content-type parsing")
    && !liveVerifier.includes("rateLimitWriteStatuses"),
  "covered by local boundary/source-order checks"
);
check("live verifier cleans temporary hosted rows", includesAll(liveVerifier, [
  "eraseSharedStateStatus",
  "eraseRecoveryStateStatus",
  "erasePathStatusStateStatus",
  "eraseSelectedStateStatus",
  "eraseScenarioStateStatus",
  "eraseProfileStateStatus",
  "eraseResetStateStatus",
  "hosted verifier cleanup erases shared row",
  "hosted verifier cleanup erases recovery row",
  "hosted verifier cleanup erases path-status row",
  "hosted verifier cleanup erases selected-work row",
  "hosted verifier cleanup erases scenario row",
  "hosted verifier cleanup erases profile row",
  "hosted verifier cleanup erases reset row"
]), "live verifier cleanup");
check("README lists deploy config check", readme.includes("`scripts/check-deploy-config.mjs`"), "README file table");
check("README ship summary includes deploy config", /Docker deploy-boundary, deploy-config,\s+North Star audit, whitespace, clean git state, and live/u.test(readme), "README ship summary");
check("README documents live app-shell matching", /app shell and\s+protected frontend content matching/u.test(readme), "app shell matching");
check("README documents live seed-data matching", /seed-data matching/u.test(readme), "seed-data matching");
check("README documents unkeyed seed-data rejection", /unkeyed seed data\s+rejection/u.test(readme), "unkeyed seed data rejection");
check("README documents content-derived asset fallback", readme.includes("content-derived asset fallback"), "content-derived asset fallback");
check("README documents invalid storage fail-fast", readme.includes("Invalid `PROJECTS_STATE_STORAGE` values fail startup"), "invalid storage fail-fast");
check("README documents API write rate limits", readme.includes("State-write throttling runs after client-key validation but before JSON"), "API write rate limits");
check("server README ship summary includes deploy config", /Docker\s+deploy-boundary, deploy-config, North Star audit, whitespace, clean git state,\s+and live/u.test(serverReadme), "server README ship summary");
check("server README documents unkeyed seed-data rejection", /unkeyed seed data\s+rejection/u.test(serverReadme), "unkeyed seed data rejection");
check("server README documents invalid storage fail-fast", serverReadme.includes("Invalid `PROJECTS_STATE_STORAGE` values fail startup"), "invalid storage fail-fast");
check("server README documents API write rate limits", serverReadme.includes("State-write throttling runs after client-key validation but before JSON"), "API write rate limits");
check("deploy doc documents content-derived asset fallback", deployDoc.includes("content-derived asset fallback"), "content-derived asset fallback");
check("deploy doc documents live app-shell matching", /app shell content,\s+protected JS, or CSS content/u.test(deployDoc), "app shell matching");
check("deploy doc documents live seed-data matching", /hosted seed data does not match this checkout/u.test(deployDoc), "seed-data matching");
check("deploy doc documents live verifier cleanup", /erases the temporary\s+verifier rows/u.test(deployDoc), "live verifier cleanup");
check("deploy doc documents invalid storage fail-fast", /any\s+other value fails startup/u.test(deployDoc), "invalid storage fail-fast");
check("deploy doc documents API write rate limits", deployDoc.includes("State-write throttling runs after the browser key is validated but"), "API write rate limits");

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nDeploy config check passed.");
}

async function readRepoFile(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function tableRowsBetween(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  if (start === -1) {
    return [];
  }
  const end = text.indexOf(endHeading, start + startHeading.length);
  const section = text.slice(start, end === -1 ? undefined : end);
  return section
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !line.includes("|---"))
    .map((line) => line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length === 2 && cells[0] !== "Variable");
}

function stripTicks(value) {
  return value.replace(/^`|`$/gu, "");
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function assetVersionAvoidsRandomFallback() {
  const declarationStart = serverSource.indexOf("const ASSET_VERSION = storage.normalizeAssetVersion(");
  const declarationEnd = serverSource.indexOf(");", declarationStart);
  const declaration = declarationStart >= 0 && declarationEnd > declarationStart
    ? serverSource.slice(declarationStart, declarationEnd)
    : "";
  return noRandomSource(declaration)
    && noRandomSource(functionBody(storageSource, "function contentAssetVersion()"))
    && noRandomSource(functionBody(storageSource, "function normalizeAssetVersion(value)"));
}

function functionBody(text, header) {
  const start = text.indexOf(header);
  if (start === -1) {
    return "";
  }
  const nextFunction = text.indexOf("\nfunction ", start + header.length);
  const nextExports = text.indexOf("\nmodule.exports", start + header.length);
  const stops = [nextFunction, nextExports].filter((index) => index !== -1);
  return text.slice(start, stops.length ? Math.min(...stops) : undefined);
}

function noRandomSource(text) {
  return Boolean(text) && !text.includes("Date.now()") && !text.includes("randomUUID") && !text.includes("Math.random");
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

function apiRateLimitConfigured(source) {
  const required = [
    "const RATE_LIMIT_WINDOW_MS",
    "const RATE_LIMIT_API_REQUESTS",
    "const RATE_LIMIT_SOURCE_WRITE_REQUESTS",
    "const RATE_LIMIT_STATE_WRITE_REQUESTS",
    "function enforceApiSourceRateLimit(request)",
    "function enforceStateWriteRateLimit(request, stateKey)",
    "function enforceRateLimit(bucketKey, limit, message)"
  ];
  const missing = required.filter((needle) => !securitySource.includes(needle));
  const writeKeyFn = securitySource.indexOf("function stateWriteKeyForRequest(request)");
  const enforceInKeyFn = securitySource.indexOf("enforceStateWriteRateLimit(request, stateKey)", writeKeyFn);
  const keyFnReturn = securitySource.indexOf("return stateKey;", writeKeyFn);
  const writeRoute = source.indexOf('if (method === "PUT" && pathname === "/api/state/browser")');
  const routeWriteKey = source.indexOf("security.stateWriteKeyForRequest(request)", writeRoute);
  const bodyRead = source.indexOf("readJsonBody(request)", writeRoute);
  return {
    ok: missing.length === 0
      && writeKeyFn >= 0
      && enforceInKeyFn > writeKeyFn
      && keyFnReturn > enforceInKeyFn
      && source.includes("security.enforceApiSourceRateLimit(request)")
      && writeRoute >= 0
      && routeWriteKey > writeRoute
      && bodyRead > routeWriteKey,
    detail: missing.length === 0 ? "rate limit inside stateWriteKeyForRequest before readJsonBody" : `missing ${missing.join(", ")}`
  };
}

function invalidStorageModeStartupResult() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["server/server.js"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "0",
        PROJECTS_STATE_STORAGE: "memory"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill();
      resolve({
        exited: false,
        code: null,
        output,
        detail: `still running; output=${compactDetail(output)}`
      });
    }, 3000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve({
        exited: true,
        code,
        output,
        detail: `code=${code}; output=${compactDetail(output)}`
      });
    });
  });
}

function compactDetail(value) {
  return String(value || "").replace(/\s+/gu, " ").trim().slice(0, 240) || "empty";
}

function gitignoreLineExists(text, expectedLine) {
  return text.split(/\r?\n/u).map((line) => line.trim()).includes(expectedLine);
}

function sourceOrder(text, needles) {
  let lastIndex = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle);
    if (index <= lastIndex) {
      return false;
    }
    lastIndex = index;
  }
  return true;
}
