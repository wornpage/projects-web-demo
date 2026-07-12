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
    label: "demo source syntax",
    command: process.execPath,
    args: ["--check", "src/demo/demo.js"]
  },
  {
    label: "demo asset generated",
    command: process.execPath,
    args: ["scripts/build-demo-asset.mjs", "--check"]
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
    label: "workflow rules guard",
    command: process.execPath,
    args: ["scripts/check-workflow-rules-guard.mjs"]
  },
  {
    label: "protected frontend",
    command: process.execPath,
    args: ["scripts/check-protected-frontend.mjs"]
  },
  {
    label: "public asset disclosure",
    command: process.execPath,
    args: ["scripts/check-public-assets.mjs"]
  },
  {
    label: "APCA contrast",
    command: process.execPath,
    args: ["scripts/check-contrast-apca.mjs"]
  },
  {
    label: "public risk decisions",
    command: process.execPath,
    args: ["scripts/check-risk-decisions.mjs"]
  },
  {
    label: "static publish artifact",
    command: process.execPath,
    args: ["scripts/check-static-publish.mjs"]
  },
  {
    label: "static preview boundary",
    command: process.execPath,
    args: ["scripts/check-static-preview.mjs"]
  },
  {
    label: "public route contract",
    command: process.execPath,
    args: ["scripts/check-public-routes.mjs"]
  },
  {
    label: "sync sharing surface",
    command: process.execPath,
    args: ["scripts/check-sync-surface.mjs"]
  },
  {
    label: "state recovery",
    command: process.execPath,
    args: ["scripts/check-state-recovery.mjs"]
  },
  {
    label: "public boundary",
    command: process.execPath,
    args: ["scripts/check-public-boundary.mjs"]
  },
  {
    label: "Docker deploy boundary",
    command: process.execPath,
    args: ["scripts/check-docker-boundary.mjs"]
  },
  {
    label: "deploy config",
    command: process.execPath,
    args: ["scripts/check-deploy-config.mjs"]
  },
  {
    label: "Compliance audit",
    command: process.execPath,
    args: ["scripts/check-compliance-audit.mjs"]
  },
  {
    label: "diff whitespace",
    command: "git",
    args: ["diff", "--check"]
  },
  {
    label: "git ship state",
    command: process.execPath,
    args: ["scripts/check-git-ship-state.mjs"]
  },
  {
    label: "live Outplane deploy",
    command: process.execPath,
    args: ["scripts/check-live-deploy.mjs", ...liveArgs],
    skip: liveArgs.length === 0
      ? "no live URL given; the deployed product is the static artifact and the app-mode backend is dormant (docs/deploy-cloudflare.md). Pass a hosted backend URL to verify one: node scripts/check-ship.mjs <live-url>"
      : ""
  }
];

let ranLiveCheck = false;

for (const step of steps) {
  console.log(`\n== ${step.label} ==`);
  if (step.skip) {
    console.log(`SKIP ${step.skip}`);
    continue;
  }
  if (step.label === "live Outplane deploy") {
    ranLiveCheck = true;
  }
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
  console.log(ranLiveCheck
    ? "\nShip check passed: local gates and live deploy verification are green."
    : "\nShip check passed: local gates are green. Live deploy verification was skipped; pass a hosted backend URL to include it.");
}
