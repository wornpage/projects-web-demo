#!/usr/bin/env node

// Build script: minify app.js and app.css, copy to assets/

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { minify } = require("terser");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "src", "app", "app.js");
const cssPath = path.join(repoRoot, "assets", "app.css");
const assetPath = path.join(repoRoot, "assets", "app.js");
const checkOnly = process.argv.includes("--check");

assertSourceSyntax();

if (checkOnly) {
  const [source, asset] = await Promise.all([
    readGeneratedSource(),
    fs.readFile(assetPath, "utf8")
  ]);
  if (source !== asset) {
    throw new Error("assets/app.js is stale. Run npm --prefix server run build.");
  }
  console.log("PASS app asset matches src/app/app.js.");
} else {
  await fs.writeFile(assetPath, await readGeneratedSource(), "utf8");
  console.log("Built assets/app.js from src/app/app.js.");
}

async function readGeneratedSource() {
  const source = await fs.readFile(sourcePath, "utf8");
  const normalized = source.replace(/\r\n?/gu, "\n");
  const result = await minify(normalized, {
    compress: true,
    mangle: false,
    output: { comments: false }
  });
  if (result.error) {
    throw new Error(`Terser minification failed: ${result.error}`);
  }
  return result.code || normalized;
}

function assertSourceSyntax() {
  const result = spawnSync(process.execPath, ["--check", sourcePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`App source syntax check failed.\n${result.stderr || result.stdout}`);
  }
}
