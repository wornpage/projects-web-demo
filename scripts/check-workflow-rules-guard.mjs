#!/usr/bin/env node

// Guards the shared workflow-rules extraction: keeps engine parity STRUCTURAL.
// Fails if either engine (the static client src/demo/demo.js or the backend
// server/src/*) re-implements a shared rule locally instead of delegating to
// server/src/workflow-rules.js — the drift that this module exists to prevent.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const checks = [];

// The shared module must export exactly this surface (both engines depend on it).
const expectedExports = [
  "DEMO_BLOCKER_NONE",
  "VALID_PACK_STATUSES",
  "normalizeText",
  "normalizeLegacyBlockerCopy",
  "normalizeStoredBlocker",
  "isUnblockedBlockerValue",
  "isPlaceholderNext",
  "forwardPathStatusForBlocker",
  "createsBlockedByCycle",
  "packActionEffect",
  "blockedByBlockerText",
  "unblockPacksBlockedBy"
];

// Names fully removed from both engines — must never be re-declared as a local
// `function <name>(` in an engine file (a `const <name> = rules/WR.<name>` alias
// is fine).
const noLocalDeclaration = [
  "forwardPathStatusForBlocker",
  "normalizeStoredBlocker",
  "normalizeLegacyBlockerCopy",
  "isPlaceholderNext",
  "isUnblockedBlockerValue",
  "createsBlockedByCycle",
  "packActionEffect"
];

// Names that keep a thin wrapper on each engine — the wrapper must delegate to
// the shared module, not re-implement the loop.
const mustDelegate = ["unblockPacksBlockedBy", "blockedByBlockerText"];

const engineFiles = [
  "src/demo/demo.js",
  "server/src/workflow.js",
  "server/src/validation.js"
];

const rules = require(path.join(repoRoot, "server", "src", "workflow-rules.js"));
const actualExports = Object.keys(rules).sort();
check(
  "workflow-rules exports the expected shared surface",
  expectedExports.slice().sort().join(",") === actualExports.join(","),
  actualExports.join(", ")
);

const sources = {};
for (const rel of engineFiles) {
  sources[rel] = await fs.readFile(path.join(repoRoot, rel), "utf8");
}

// Both engines must reference the shared module.
check("client references the shared module", sources["src/demo/demo.js"].includes("window.__workflowRules"), "window.__workflowRules");
check("backend workflow requires the shared module", sources["server/src/workflow.js"].includes('require("./workflow-rules.js")'), "require");
check("backend validation requires the shared module", sources["server/src/validation.js"].includes('require("./workflow-rules.js")'), "require");

// No engine may re-declare a fully-shared rule as a local function.
for (const rel of engineFiles) {
  for (const name of noLocalDeclaration) {
    const pattern = new RegExp(`function\\s+${name}\\s*\\(`, "u");
    check(
      `${rel} does not re-implement ${name}`,
      !pattern.test(sources[rel]),
      pattern.test(sources[rel]) ? "local re-declaration found" : "delegates"
    );
  }
}

// Wrapper functions must delegate to rules.*/WR.* rather than re-implement.
for (const rel of ["src/demo/demo.js", "server/src/workflow.js"]) {
  const token = rel.startsWith("server/") ? "rules" : "WR";
  for (const name of mustDelegate) {
    const declared = new RegExp(`function\\s+${name}\\s*\\(`, "u").test(sources[rel]);
    const delegates = sources[rel].includes(`${token}.${name}`);
    check(
      `${rel} delegates ${name} to the shared module`,
      !declared || delegates,
      declared ? (delegates ? `calls ${token}.${name}` : "wrapper does not delegate") : "no local wrapper"
    );
  }
}

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

if (checks.some((row) => !row.ok)) {
  process.exitCode = 1;
} else {
  console.log("\nWorkflow-rules guard check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}
