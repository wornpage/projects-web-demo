#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

const auditDoc = await readRepoFile("docs/compliance-audit.md");
const readme = await readRepoFile("README.md");
const serverReadme = await readRepoFile("server/README.md");
const packageJson = JSON.parse(await readRepoFile("server/package.json"));
const shipGate = await readRepoFile("scripts/check-ship.mjs");

const allowedStatuses = new Set(["Proven", "Accepted demo tradeoff", "Needs next slice"]);
const requiredRows = [
  {
    id: "portfolio-scope",
    evidence: ["README.md", "scripts/check-public-routes.mjs", "scripts/check-risk-decisions.mjs"]
  },
  {
    id: "public-surface",
    evidence: [
      "scripts/check-public-assets.mjs",
      "scripts/check-static-publish.mjs",
      "scripts/check-static-preview.mjs",
      "scripts/check-docker-boundary.mjs"
    ]
  },
  {
    id: "private-value",
    evidence: [
      "docs/public-exposure-audit.md",
      "scripts/check-live-deploy.mjs",
      "scripts/check-public-assets.mjs",
      "scripts/check-docker-boundary.mjs"
    ]
  },
  {
    id: "backend-boundaries",
    evidence: [
      "server/server.js",
      "scripts/check-public-boundary.mjs",
      "scripts/check-live-deploy.mjs",
      "scripts/check-deploy-config.mjs"
    ]
  },
  {
    id: "frontend-protection",
    evidence: [
      "scripts/protect-frontend.mjs",
      "scripts/check-protected-frontend.mjs",
      "scripts/check-live-deploy.mjs",
      "docs/public-exposure-audit.md"
    ]
  },
  {
    id: "data-separation",
    evidence: [
      "scripts/check-public-boundary.mjs",
      "scripts/check-state-recovery.mjs",
      "scripts/check-live-deploy.mjs",
      "server/server.js"
    ]
  },
  {
    id: "recovery",
    evidence: ["scripts/check-state-recovery.mjs", "scripts/check-live-deploy.mjs", "README.md"]
  },
  {
    id: "sync-sharing",
    evidence: ["scripts/check-sync-surface.mjs", "scripts/check-live-deploy.mjs", "docs/deploy-outplane.md"]
  },
  {
    id: "outplane-reproducible",
    evidence: ["Dockerfile", "docs/deploy-outplane.md", "scripts/check-deploy-config.mjs", "scripts/check-live-deploy.mjs"]
  },
  {
    id: "ship-gate",
    evidence: ["scripts/check-ship.mjs", "scripts/check-git-ship-state.mjs", "scripts/check-live-deploy.mjs", "server/package.json"]
  }
];

const rows = requirementRows(auditDoc);
const rowsById = new Map(rows.map((row) => [row.ID, row]));
const unexpectedRows = rows.filter((row) => !requiredRows.some((required) => required.id === row.ID));
const needsNextSliceRows = rows.filter((row) => row.Status === "Needs next slice");

check("audit doc declares public-demo completion status", auditDoc.includes("Overall status: Complete for the public demo scope."), "complete for public demo scope");
check("audit doc defines completion boundary", includesAll(auditDoc, [
  "private",
  "account-grade storage",
  "no remaining",
  "`Needs next slice` rows",
  "Accepted demo tradeoffs must",
  "remain explicit"
]), "public demo completion boundary");
check("audit table has no unexpected rows", unexpectedRows.length === 0, unexpectedRows.map((row) => row.ID).join(", ") || "none");
check("audit table has no remaining Needs next slice rows", needsNextSliceRows.length === 0, needsNextSliceRows.map((row) => row.ID).join(", ") || "none");

for (const required of requiredRows) {
  const row = rowsById.get(required.id);
  check(`audit row exists: ${required.id}`, Boolean(row), row ? "present" : "missing");
  if (!row) {
    continue;
  }
  check(`audit row status is explicit: ${required.id}`, allowedStatuses.has(row.Status), row.Status || "missing");
  check(`audit row has next slice: ${required.id}`, Boolean(row["Next slice"]), row["Next slice"] || "missing");
  check(
    `audit row evidence is mapped: ${required.id}`,
    required.evidence.every((needle) => row.Evidence.includes(needle)),
    missingNeedles(row.Evidence, required.evidence)
  );
}

check(
  "server package exposes compliance audit check",
  packageJson.scripts?.["compliance:check"] === "node ../scripts/check-compliance-audit.mjs",
  packageJson.scripts?.["compliance:check"] || "missing"
);
check("README lists compliance audit doc", readme.includes("`docs/compliance-audit.md`"), "docs/compliance-audit.md");
check("README lists compliance audit check", readme.includes("`scripts/check-compliance-audit.mjs`"), "scripts/check-compliance-audit.mjs");
check("README ship summary includes compliance audit", readme.includes("Compliance audit"), "Compliance audit");
check("server README ship summary includes compliance audit", serverReadme.includes("Compliance audit"), "Compliance audit");
check("ship gate runs compliance audit", includesAll(shipGate, [
  'label: "Compliance audit"',
  'args: ["scripts/check-compliance-audit.mjs"]'
]), "check-compliance-audit.mjs");
check("ship gate runs compliance audit before live", sourceOrder(shipGate, [
  'label: "deploy config"',
  'label: "Compliance audit"',
  'label: "diff whitespace"',
  'label: "git ship state"',
  'label: "live Outplane deploy"'
]), "deploy config -> Compliance audit -> clean git -> live");

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nCompliance audit check passed.");
}

async function readRepoFile(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function requirementRows(markdown) {
  const section = sectionBetween(markdown, "## Requirement Audit", "## Completion Rule");
  return section
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !line.includes("|---"))
    .map((line) => line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length === 5 && cells[0] !== "ID")
    .map(([ID, Requirement, Evidence, Status, NextSlice]) => ({
      ID,
      Requirement,
      Evidence,
      Status,
      "Next slice": NextSlice
    }));
}

function sectionBetween(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  if (start === -1) {
    return "";
  }
  const end = text.indexOf(endHeading, start + startHeading.length);
  return text.slice(start, end === -1 ? undefined : end);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function missingNeedles(text, needles) {
  const missing = needles.filter((needle) => !text.includes(needle));
  return missing.length === 0 ? "complete" : `missing ${missing.join(", ")}`;
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
