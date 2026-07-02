#!/usr/bin/env node

// Ship check: run all pre-ship gates. Non-zero exit = block ship.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function run(name, command, args = []) {
  process.stdout.write(`== ${name} ==\n`);
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", shell: true });
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.stdout.write(`FAIL ${name}\n`);
    failed = true;
  } else {
    process.stdout.write(`PASS ${name}\n`);
  }
}

// Gates
run("frontend syntax", "node", ["--check", "src/app/app.js"]);
run("build check", "node", ["scripts/build.mjs", "--check"]);

if (failed) {
  process.stderr.write("\nShip check failed.\n");
  process.exit(1);
}
process.stdout.write("\nShip check passed.\n");
