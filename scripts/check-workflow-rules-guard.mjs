#!/usr/bin/env node

// Guards the shared workflow-rules extraction: keeps engine parity STRUCTURAL.
// Fails if either engine (the static client src/demo/demo.js or the backend
// server/src/*) re-implements a shared rule locally instead of delegating to
// server/src/workflow-rules.js — the drift that this module exists to prevent.
//
// Also guards the app-mode thin client module (src/demo/workflow-rules-client.js)
// which strips the server-authoritative packActionEffect / unblockPacksBlockedBy.
// The thin module must export the same function signatures as the full module
// for every name they share.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const checks = [];

// The full shared module must export exactly this surface.
const expectedFullExports = [
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
  "unblockPacksBlockedBy",
  "unblockedReceiptSentence"
];

// The app-mode thin client module exports only the subset needed for client-local
// form previews, cycle checking, and receipt rendering — packActionEffect and
// unblockPacksBlockedBy are server-authoritative in app mode.
const expectedThinExports = [
  "DEMO_BLOCKER_NONE",
  "VALID_PACK_STATUSES",
  "normalizeText",
  "normalizeLegacyBlockerCopy",
  "normalizeStoredBlocker",
  "isUnblockedBlockerValue",
  "isPlaceholderNext",
  "forwardPathStatusForBlocker",
  "createsBlockedByCycle",
  "blockedByBlockerText",
  "unblockedReceiptSentence"
];

// The thin module must NOT export these (server-authoritative, stripped from
// the app-mode build).
const forbiddenThinExports = ["packActionEffect", "unblockPacksBlockedBy"];

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
  "packActionEffect",
  "unblockedReceiptSentence"
];

// Names that keep a thin wrapper on each engine — the wrapper must delegate to
// the shared module, not re-implement the loop.
const mustDelegate = ["unblockPacksBlockedBy", "blockedByBlockerText"];

const engineFiles = [
  "src/demo/demo.js",
  "server/src/workflow.js",
  "server/src/validation.js"
];

// ---- Full shared module checks ----

const fullRules = require(path.join(repoRoot, "server", "src", "workflow-rules.js"));
const fullActualExports = Object.keys(fullRules).sort();
check(
  "workflow-rules exports the expected shared surface",
  expectedFullExports.slice().sort().join(",") === fullActualExports.join(","),
  fullActualExports.join(", ")
);

// ---- Thin client module checks ----

const thinRulesPath = path.join(repoRoot, "src", "demo", "workflow-rules-client.js");
const thinRules = require(thinRulesPath);
const thinActualExports = Object.keys(thinRules).sort();
check(
  "workflow-rules-client exports the app-mode subset",
  expectedThinExports.slice().sort().join(",") === thinActualExports.join(","),
  thinActualExports.join(", ")
);

for (const name of forbiddenThinExports) {
  check(
    `workflow-rules-client does not export ${name}`,
    !thinActualExports.includes(name),
    thinActualExports.includes(name) ? `exported: ${name}` : "absent"
  );
}

// Each function shared between the full and thin modules must have the same
// parameter count (a basic structural drift check).
for (const name of expectedThinExports) {
  if (typeof fullRules[name] === "function" && typeof thinRules[name] === "function") {
    check(
      `workflow-rules-client ${name} has same arity as full module`,
      fullRules[name].length === thinRules[name].length,
      `full: ${fullRules[name].length}, thin: ${thinRules[name].length}`
    );
  }
}

// ---- Engine file checks ----

const sources = {};
for (const rel of engineFiles) {
  sources[rel] = await fs.readFile(path.join(repoRoot, rel), "utf8");
}

// Every engine must reference the shared module.
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
