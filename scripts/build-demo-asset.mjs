#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const terser = require("../server/node_modules/terser");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "src", "demo", "demo.js");
const cssSourcePath = path.join(repoRoot, "assets", "demo.css");
const assetPath = path.join(repoRoot, "assets", "demo.js");
const checkOnly = process.argv.includes("--check");

assertSourceSyntax();

if (checkOnly) {
  const [source, asset] = await Promise.all([
    readGeneratedSource(),
    fs.readFile(assetPath, "utf8")
  ]);
  if (source !== asset) {
    throw new Error("assets/demo.js is stale. Run npm --prefix server run demo:build.");
  }
  console.log("PASS demo asset matches src/demo/demo.js.");
} else {
  await fs.writeFile(assetPath, await readGeneratedSource(), "utf8");
  console.log("Built assets/demo.js from src/demo/demo.js.");
}

async function readGeneratedSource() {
  const telemetryPath = path.join(repoRoot, "src", "demo", "telemetry.js");
  let telemetry = "";
  try {
    telemetry = await fs.readFile(telemetryPath, "utf8");
    telemetry = telemetry.replace(/\r\n?/gu, "\n") + "\n";
  } catch {
    // telemetry.js is optional — skip if not present
  }
  const source = await fs.readFile(sourcePath, "utf8");
  const combined = telemetry + source.replace(/\r\n?/gu, "\n");
  const result = await terser.minify(combined, {
    compress: true,
    mangle: false,
    output: { comments: false }
  });
  if (result.error) {
    throw new Error(`Terser minification failed: ${result.error}`);
  }
  return result.code || combined;
}

function assertSourceSyntax() {
  const result = spawnSync(process.execPath, ["--check", sourcePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`Demo source syntax check failed.\n${result.stderr || result.stdout}`);
  }
}
