#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const status = git(["status", "--porcelain=v1"]);
if (status.stdout.trim()) {
  fail(`Ship check requires a clean working tree.\n${status.stdout.trim()}`);
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
if (!branch || branch === "HEAD") {
  fail(`Ship check requires a named branch, not ${branch || "unknown"}.`);
}

const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { allowFailure: true });
if (upstream.status !== 0 || !upstream.stdout.trim()) {
  fail(`Ship check requires ${branch} to track an upstream branch.`);
}

const counts = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"]).stdout.trim().split(/\s+/u).map(Number);
const behind = counts[0] || 0;
const ahead = counts[1] || 0;
if (behind > 0 || ahead > 0) {
  fail(`Ship check requires ${branch} to match ${upstream.stdout.trim()} exactly; behind ${behind}, ahead ${ahead}.`);
}

const head = git(["rev-parse", "--short", "HEAD"]).stdout.trim();
console.log(`PASS git ship state: ${branch} is clean and synced at ${head}.`);

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false
  });

  if (!options.allowFailure && result.status !== 0) {
    fail(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }

  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
