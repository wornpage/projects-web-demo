#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const liveArgs = process.argv.slice(2);
const steps = [
  {
    label: "frontend syntax",
    command: process.execPath,
    args: ["--check", "assets/demo.js"]
  },
  {
    label: "backend server syntax",
    command: process.execPath,
    args: ["--check", "server/server.js"]
  },
  {
    label: "backend preview syntax",
    command: process.execPath,
    args: ["--check", "server/static.js"]
  },
  {
    label: "protected frontend",
    command: process.execPath,
    args: ["scripts/check-protected-frontend.mjs"]
  },
  {
    label: "public boundary",
    command: process.execPath,
    args: ["scripts/check-public-boundary.mjs"]
  },
  {
    label: "diff whitespace",
    command: "git",
    args: ["diff", "--check"]
  },
  {
    label: "live Outplane deploy",
    command: process.execPath,
    args: ["scripts/check-live-deploy.mjs", ...liveArgs]
  }
];

for (const step of steps) {
  console.log(`\n== ${step.label} ==`);
  const result = spawnSync(step.command, step.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    console.error(`\nShip check failed at: ${step.label}`);
    break;
  }
}

if (!process.exitCode) {
  console.log("\nShip check passed: local gates and live Outplane verification are green.");
}
