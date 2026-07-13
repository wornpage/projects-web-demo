#!/usr/bin/env node

// Custom build wrangler runs before `wrangler dev`/`wrangler deploy` (wired up
// via "build.command" in wrangler.jsonc). Cloudflare Workers Builds clones the
// repo fresh and runs plain `npx wrangler deploy` from the root, so this
// installs the server dependencies when they are missing (terser and acorn are
// needed by the protected-frontend build) and then produces dist/static-publish.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(repoRoot, "server");

if (!existsSync(path.join(serverDir, "node_modules", "terser"))) {
  // npm is npm.cmd on Windows, so run it through the shell on both platforms.
  run("npm ci --no-audit --no-fund", [], serverDir, {
    shell: true,
    // The build only needs terser/acorn from devDependencies; keep playwright
    // from pulling browser binaries into the deploy environment.
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" }
  });
}

run(process.execPath, [path.join(repoRoot, "scripts", "build-static-publish.mjs")], repoRoot);

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
