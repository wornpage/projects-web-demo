#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const publicTextAssets = [
  { pathname: "index.html", maxBytes: 12000 },
  { pathname: "landing.html", maxBytes: 12000 },
  // Bundle now includes the shared server/src/workflow-rules.js core (prepended
  // at build time) so the client carries the canonical blocker normalizer; +~950B.
  { pathname: "assets/demo.js", maxBytes: 258000 },
  { pathname: "assets/demo.css", maxBytes: 168000 },
  { pathname: "assets/landing.css", maxBytes: 16000 },
  { pathname: "data/demo-packs.json", maxBytes: 25000 },
  { pathname: "sw.js", maxBytes: 3000 }
];
const publicFileAllowlist = [
  "sw.js",
  "assets/demo.css",
  "assets/demo.js",
  "assets/landing.css",
  "assets/favicon.png",
  "data/demo-packs.json"
];
const totalPublicTextBudgetBytes = 484000;
const retiredPublicFiles = [
  "assets/app.css",
  "assets/demo-metadata.json"
];
const retiredRootFiles = [
  "render.yaml"
];
const forbiddenPatterns = [
  {
    name: "source map hints",
    pattern: /sourceMappingURL|sourceURL/iu
  },
  {
    name: "remote stylesheet imports",
    pattern: /@import\s+url\(["']?https?:/iu
  },
  {
    name: "local filesystem paths",
    pattern: /(?<![A-Za-z])(?:[A-Za-z]:[\\/]|\\\\\?\\[A-Za-z]:\\)/u
  },
  {
    name: "private repository URL",
    pattern: /github\.com\/jared-bidlow/iu
  },
  {
    name: "Git internals",
    pattern: /\.git[\\/]/iu
  },
  {
    name: "server source paths",
    pattern: /(?:server[\\/](?:server\.js|package-lock\.json|data)|node_modules[\\/])/iu
  },
  {
    name: "deployment secret names",
    pattern: /\b(?:DATABASE_URL|PGHOST|PGDATABASE|PGUSER|PGPASSWORD|PROJECTS_STATE_FILE|PROJECTS_STATE_STORAGE)\b/u
  }
];

const assetRows = [];
for (const asset of publicTextAssets) {
  const file = path.join(repoRoot, asset.pathname);
  const text = await fs.readFile(file, "utf8");
  const bytes = Buffer.byteLength(text, "utf8");
  assetRows.push({ ...asset, text, bytes });
  check(`${asset.pathname} stays under public asset budget`, bytes <= asset.maxBytes, `${bytes}/${asset.maxBytes} bytes`);

  for (const forbidden of forbiddenPatterns) {
    const match = text.match(forbidden.pattern);
    check(
      `${asset.pathname} has no ${forbidden.name}`,
      !match,
      match ? `matched ${JSON.stringify(match[0])}` : "absent"
    );
  }
}

const totalBytes = assetRows.reduce((sum, asset) => sum + asset.bytes, 0);
check("public text assets stay under total budget", totalBytes <= totalPublicTextBudgetBytes, `${totalBytes}/${totalPublicTextBudgetBytes} bytes`);

// The side-stripe card treatment (thick colored left borders) was removed
// deliberately; cards use full 1px borders with color carrying the state.
// Keep it from creeping back in via demo.css.
const demoCssRow = assetRows.find((asset) => asset.pathname === "assets/demo.css");
const sideStripeMatch = demoCssRow?.text.match(/border-left(?:-width)?:\s*(?:[2-9]|\d{2,})px/u);
check("demo.css avoids side-stripe left borders", !sideStripeMatch, sideStripeMatch ? `matched ${JSON.stringify(sideStripeMatch[0])}` : "full borders only");

const publicMapFiles = await findPublicMapFiles();
check("public asset tree contains no source map files", publicMapFiles.length === 0, publicMapFiles.join(", ") || "absent");
const publicAssetFiles = await findPublicAssetFiles();
const unexpectedPublicFiles = publicAssetFiles.filter((file) => !publicFileAllowlist.includes(file));
const missingPublicFiles = publicFileAllowlist.filter((file) => !publicAssetFiles.includes(file));
check("public asset tree contains only allowlisted files", unexpectedPublicFiles.length === 0, unexpectedPublicFiles.join(", ") || "allowlist only");
check("public asset allowlist files exist", missingPublicFiles.length === 0, missingPublicFiles.join(", ") || "complete");
for (const pathname of retiredPublicFiles) {
  check(`${pathname} is not shipped`, !(await fileExists(path.join(repoRoot, pathname))), "absent");
}
for (const pathname of retiredRootFiles) {
  check(`${pathname} retired deployment file is absent`, !(await fileExists(path.join(repoRoot, pathname))), "absent");
}

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nPublic asset disclosure check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

async function findPublicMapFiles() {
  return (await findPublicAssetFiles()).filter((file) => file.endsWith(".map"));
}

async function findPublicAssetFiles() {
  const roots = ["assets", "data"];
  const matches = [];
  for (const root of roots) {
    await walk(path.join(repoRoot, root), matches);
  }
  // Also include root-level allowlisted files (e.g. sw.js)
  for (const file of publicFileAllowlist) {
    if (!file.includes("/") && await fileExists(path.join(repoRoot, file))) {
      matches.push(path.join(repoRoot, file));
    }
  }
  return matches.map((file) => path.relative(repoRoot, file).replace(/\\/gu, "/"));
}

async function fileExists(file) {
  try {
    const stats = await fs.stat(file);
    return stats.isFile();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
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
