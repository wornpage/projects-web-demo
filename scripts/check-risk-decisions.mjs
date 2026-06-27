#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = path.join(repoRoot, "docs", "public-exposure-audit.md");
const allowedStatuses = new Set(["Fixed", "True", "Not observed"]);
const checks = [];

try {
  const auditText = await fs.readFile(auditPath, "utf8");
  const rows = parseRiskRows(auditText);
  const byRisk = new Map(rows.map((row) => [row.risk, row]));

  check("risk table is present", rows.length > 0, `${rows.length} row(s)`);

  const undecidedRows = rows.filter((row) => /^(Possible|Reduced)$/u.test(row.status));
  check(
    "risk table has no tentative statuses",
    undecidedRows.length === 0,
    formatRows(undecidedRows) || "none"
  );

  const unexpectedStatuses = rows.filter((row) => !allowedStatuses.has(row.status));
  check(
    "risk table uses explicit allowed statuses",
    unexpectedStatuses.length === 0,
    formatRows(unexpectedStatuses) || [...allowedStatuses].join(", ")
  );

  const missingDecisions = rows.filter((row) => row.decision.length < 8);
  check("risk rows include decisions", missingDecisions.length === 0, formatRows(missingDecisions) || "complete");

  requireRiskStatus(byRisk, "Browser JS is visible", "True");
  requireRiskStatus(byRisk, "Static sample data is visible on static targets", "True");
  requireRiskStatus(byRisk, "Private repo files served by Outplane", "Not observed");
  requireRiskStatus(byRisk, "GitHub Pages root publish could expose repo files", "Fixed");

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }

  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nRisk decision check passed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseRiskRows(text) {
  const rows = [];
  let inRiskTable = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "## Risk Decisions") {
      inRiskTable = true;
      continue;
    }
    if (inRiskTable && line.startsWith("## ")) {
      break;
    }
    if (!inRiskTable || !line.startsWith("|") || line.includes("|---")) {
      continue;
    }

    const cells = line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length !== 3 || cells[0] === "Risk") {
      continue;
    }

    rows.push({
      risk: cells[0],
      status: cells[1],
      decision: cells[2]
    });
  }

  return rows;
}

function requireRiskStatus(byRisk, risk, expectedStatus) {
  const row = byRisk.get(risk);
  check(`${risk} is ${expectedStatus}`, row?.status === expectedStatus, row?.status ?? "missing");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function formatRows(rows) {
  return rows.map((row) => `${row.risk}: ${row.status}`).join(", ");
}
