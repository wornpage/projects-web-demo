#!/usr/bin/env node

// Project init: replaces __PLACEHOLDERS__ with real project values.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(resolve => rl.question(q, resolve)); }

console.log("SPA Template — project initialization\n");

const name = await ask("Project name (human-readable): ") || "My App";
const slug = await ask("Project slug (npm-safe, lowercase-hyphens): ") || "my-app";
const ns = await ask("Namespace (for localStorage keys, e.g. 'myapp'): ") || "myapp";
const description = await ask("Short description: ") || "A client-side SPA.";

rl.close();

const replacements = {
  "__PROJECT_NAME__": name,
  "__PROJECT_SLUG__": slug,
  "__PROJECT_NS__": ns,
  "__ASSET_VERSION__": Date.now().toString(36)
};

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      walk(full);
    } else if (entry.isFile()) {
      let content = fs.readFileSync(full, "utf8");
      let changed = false;
      for (const [from, to] of Object.entries(replacements)) {
        if (content.includes(from)) {
          content = content.replaceAll(from, to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, content, "utf8");
        console.log(`  Replaced placeholders in ${path.relative(repoRoot, full)}`);
      }
    }
  }
}

walk(repoRoot);
console.log(`\nDone! Project "${name}" is ready. Run:\n  npm install\n  npm run build\n  npm start`);
