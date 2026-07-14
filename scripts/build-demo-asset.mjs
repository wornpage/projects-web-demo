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
const rulesPath = path.join(repoRoot, "server", "src", "workflow-rules.js");
const appRulesPath = path.join(repoRoot, "src", "demo", "workflow-rules-client.js");
const cssSourcePath = path.join(repoRoot, "assets", "demo.css");
const isAppMode = process.argv.includes("--app");
const assetPath = isAppMode
  ? path.join(repoRoot, "assets", "demo-app.js")
  : path.join(repoRoot, "assets", "demo.js");
const checkOnly = process.argv.includes("--check");

assertSourceSyntax();

const assetLabel = isAppMode ? "assets/demo-app.js" : "assets/demo.js";
if (checkOnly) {
  const [source, asset] = await Promise.all([
    readGeneratedSource(),
    fs.readFile(assetPath, "utf8")
  ]);
  if (source !== asset) {
    throw new Error(`${assetLabel} is stale. Run npm --prefix server run demo:build${isAppMode ? "-app" : ""}.`);
  }
  console.log(`PASS ${assetLabel} matches src/demo/demo.js.`);
} else {
  await fs.writeFile(assetPath, await readGeneratedSource(), "utf8");
  console.log(`Built ${assetLabel} from src/demo/demo.js.`);
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
  // App mode uses the thin client subset (no packActionEffect / unblockPacksBlockedBy);
  // static mode uses the full shared module from server/src (so the backend can
  // require it and the Docker runtime, which excludes src/, still ships it).
  const rulesFile = isAppMode ? appRulesPath : rulesPath;
  const rules = (await fs.readFile(rulesFile, "utf8")).replace(/\r\n?/gu, "\n") + "\n";
  const source = await fs.readFile(sourcePath, "utf8");
  const combined = telemetry + rules + source.replace(/\r\n?/gu, "\n");
  const result = await terser.minify(combined, {
    compress: true,
    // Mangle function-scoped locals only. toplevel stays false so global
    // function names (e.g. buildStandupText, render) survive — the behavior
    // smoke gate and telemetry hook reference them by name in the browser.
    mangle: true,
    output: { comments: false }
  });
  if (result.error) {
    throw new Error(`Terser minification failed: ${result.error}`);
  }
  return result.code || combined;
}

function assertSourceSyntax() {
  const rulesFile = isAppMode ? appRulesPath : rulesPath;
  for (const file of [rulesFile, sourcePath]) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    if (result.status !== 0) {
      throw new Error(`Demo source syntax check failed.\n${result.stderr || result.stdout}`);
    }
  }
}
