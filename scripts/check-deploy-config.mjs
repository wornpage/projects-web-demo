#!/usr/bin/env node

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
check("server asset fallback is content-derived", includesAll(serverSource, [
  "|| contentAssetVersion());",
  "function contentAssetVersion()",
  "crypto.createHash(\"sha256\")",
  "\"data/demo-packs.json\""
]), "contentAssetVersion");
check("server asset fallback avoids startup-random keys", !serverSource.includes("Date.now().toString(36)") && !serverSource.includes("crypto.randomUUID().slice(0, 8)"), "no timestamp/random fallback");
check("live verifier rebuilds expected protected frontend", includesAll(liveVerifier, [
  "function expectedFrontendAssets()",
  "scripts/protect-frontend.mjs",
  "assets/demo.js"
]), "expectedFrontendAssets");
check("live verifier compares deployed frontend hashes", includesAll(liveVerifier, [
  "live protected JS matches this checkout",
  "live CSS content matches this checkout",
  "sha256(script)",
  "normalizeDeployText(css)"
]), "live JS/CSS hash match");
check("README lists deploy config check", readme.includes("`scripts/check-deploy-config.mjs`"), "README file table");
check("README ship summary includes deploy config", /Docker deploy-boundary, deploy-config,\s+whitespace, clean git state, and live/u.test(readme), "README ship summary");
check("README documents content-derived asset fallback", readme.includes("content-derived asset fallback"), "content-derived asset fallback");
check("server README ship summary includes deploy config", /Docker\s+deploy-boundary, deploy-config, whitespace, clean git state, and live/u.test(serverReadme), "server README ship summary");
check("deploy doc documents content-derived asset fallback", deployDoc.includes("content-derived asset fallback"), "content-derived asset fallback");

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
