#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStaticPublish, STATIC_PUBLISH_FILES } from "./build-static-publish.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "dist", "static-publish-check");
const checks = [];
const expectedFiles = [...STATIC_PUBLISH_FILES].sort();
const forbiddenRootFiles = [
  "Dockerfile",
  "README.md",
  "server/server.js",
  "server/package.json",
  "server/package-lock.json",
  "server/static.js",
  "docs/public-exposure-audit.md",
  "docs/deploy-outplane.md",
  "scripts/protect-frontend.mjs",
  "scripts/check-ship.mjs"
];
const protectedReadableTokens = Object.freeze([
  "runBackendPackAction",
  "saveBackendPackNextAction",
  "loadBackendSeedPacks",
  "loadBackendPackCommandPreview",
  "createBackendPack",
  "backendCommandPendingForPack",
  "backendCommandPendingReason",
  "backendCommandPendingFlowHint",
  "syncCommandActionButton",
  "loadBackendOwnedState",
  "prepareBackendWorkflowRequest",
  "backend-command-pending",
  "x-projects-demo-client",
  "/api/state/browser",
  "/api/state/reset",
  "/api/state"
]);

try {
  await buildStaticPublish(outputDir);
  const actualFiles = (await listFiles(outputDir)).sort();
  check("static publish artifact contains only the allowlist", sameList(actualFiles, expectedFiles), actualFiles.join(", "));

  for (const file of expectedFiles) {
    check(`static publish includes ${file}`, actualFiles.includes(file), file);
  }

  const forbiddenFilesPresent = forbiddenRootFiles.filter((file) => actualFiles.includes(file));
  check("static publish excludes repo root, server, docs, and scripts", forbiddenFilesPresent.length === 0, forbiddenFilesPresent.join(", ") || "absent");

  const mapFiles = actualFiles.filter((file) => file.endsWith(".map"));
  check("static publish has no source maps", mapFiles.length === 0, mapFiles.join(", ") || "absent");

  const demoScript = await fs.readFile(path.join(outputDir, "assets", "demo.js"), "utf8");
  const demoLineCount = demoScript.split(/\r?\n/u).length;
  const demoReadableTokens = protectedReadableTokens.filter((token) => demoScript.includes(token));
  check("static publish demo.js frontend is protected", demoLineCount < 200 && demoReadableTokens.length === 0, `${demoLineCount} line(s), ${demoReadableTokens.join(", ") || "protected tokens absent"}`);

  const demoAppScript = await fs.readFile(path.join(outputDir, "assets", "demo-app.js"), "utf8");
  const demoAppLineCount = demoAppScript.split(/\r?\n/u).length;
  const demoAppReadableTokens = protectedReadableTokens.filter((token) => demoAppScript.includes(token));
  check("static publish demo-app.js frontend is protected", demoAppLineCount < 200 && demoAppReadableTokens.length === 0, `${demoAppLineCount} line(s), ${demoAppReadableTokens.join(", ") || "protected tokens absent"}`);

  const seedData = await fs.readFile(path.join(outputDir, "data", "demo-packs.json"), "utf8");
  check("static publish keeps only sample data", !/customer|secret|DATABASE_URL|PGPASSWORD|server\/server\.js/iu.test(seedData), "sample data scan");

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }

  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nStatic publish artifact check passed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await fs.rm(outputDir, { recursive: true, force: true });
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

async function listFiles(root) {
  const matches = [];
  await walk(root, matches);
  return matches.map((file) => path.relative(root, file).replace(/\\/gu, "/"));
}

async function walk(directory, matches) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(child, matches);
      continue;
    }
    if (entry.isFile()) {
      matches.push(child);
    }
  }
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
