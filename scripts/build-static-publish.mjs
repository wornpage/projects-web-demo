#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");
export const DEFAULT_STATIC_PUBLISH_DIR = path.join(distRoot, "static-publish");
export const STATIC_PUBLISH_FILES = Object.freeze([
  "index.html",
  ".nojekyll",
  "assets/demo.css",
  "assets/demo.js",
  "assets/favicon.png",
  "data/demo-packs.json"
]);

if (isMainModule()) {
  const outputDir = path.resolve(process.argv[2] || DEFAULT_STATIC_PUBLISH_DIR);
  await buildStaticPublish(outputDir);
  console.log(`Built static publish artifact: ${path.relative(repoRoot, outputDir)}`);
}

export async function buildStaticPublish(outputDir, options = {}) {
  const resolvedOutputDir = path.resolve(outputDir);
  assertSafeOutputDir(resolvedOutputDir);

  await fs.rm(resolvedOutputDir, { recursive: true, force: true });
  for (const relativeFile of STATIC_PUBLISH_FILES) {
    const source = path.join(repoRoot, relativeFile);
    const target = path.join(resolvedOutputDir, relativeFile);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  const protectResult = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts", "protect-frontend.mjs"),
    path.join(resolvedOutputDir, "assets", "demo.js"),
    path.join(resolvedOutputDir, "assets", "demo.js")
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (protectResult.status !== 0) {
    throw new Error(`Static publish frontend protection failed.\n${protectResult.stderr || protectResult.stdout}`);
  }

  if (!options.keepLogs && protectResult.stdout?.trim()) {
    return protectResult.stdout.trim();
  }
  return "";
}

function assertSafeOutputDir(outputDir) {
  const relativeToDist = path.relative(distRoot, outputDir);
  if (!relativeToDist || relativeToDist.startsWith("..") || path.isAbsolute(relativeToDist)) {
    throw new Error("Static publish output must be inside dist/ and not dist/ itself.");
  }
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
