#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(os.tmpdir(), `projects-demo-protected-${process.pid}.js`);
const protect = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts/protect-frontend.mjs"),
  path.join(repoRoot, "assets/demo.js"),
  outputPath
], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (protect.status !== 0) {
  await fs.rm(outputPath, { force: true });
  throw new Error(`Frontend protection failed.\n${protect.stderr || protect.stdout}`);
}

const script = await fs.readFile(outputPath, "utf8");
await fs.rm(outputPath, { force: true });

const leakedTokens = [
  "runBackendPackAction",
  "saveBackendPackNextAction",
  "saveBackendSelectedWork",
  "loadBackendSeedPacks",
  "loadBackendPackCommandPreview",
  "createBackendPack",
  "addBackendPackMemoryNote",
  "saveBackendPackPath",
  "backendCommandPendingForPack",
  "isBackendCommandPending",
  "backendCommandPendingReason",
  "backendCommandPendingFlowHint",
  "syncCommandActionButton",
  "loadBackendOwnedState",
  "prepareBackendWorkflowRequest",
  "backend-command-pending",
  "/api/packs",
  "/api/demo-packs",
  "/api/state/browser",
  "/api/state",
  "projects-static-demo-api-client-v1",
  "x-projects-demo-client"
].filter((value) => script.includes(value));

if (leakedTokens.length > 0) {
  throw new Error(`Protected frontend still exposes readable tokens: ${leakedTokens.join(", ")}`);
}

const lines = script.split(/\r?\n/u).length;
if (lines >= 200) {
  throw new Error(`Protected frontend is not minified enough: ${lines} lines.`);
}

console.log(`PASS protected frontend check: ${Buffer.byteLength(script, "utf8")} bytes, ${lines} line(s), no readable protected tokens.`);
