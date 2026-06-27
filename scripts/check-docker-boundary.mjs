#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfile = await fs.readFile(path.join(repoRoot, "Dockerfile"), "utf8");
const lines = dockerfile.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
const normalized = dockerfile.replace(/\r\n/gu, "\n");
const checks = [];
const copyLines = lines.filter((line) => line.startsWith("COPY "));
const allowedCopyLines = [
  "COPY server/package*.json ./server/",
  "COPY index.html ./",
  "COPY assets ./assets",
  "COPY data ./data",
  "COPY scripts/protect-frontend.mjs ./scripts/protect-frontend.mjs",
  "COPY server/server.js ./server/server.js"
];
const forbiddenCopyPatterns = [
  /^COPY\s+\.\s+/u,
  /^COPY\s+README\.md\b/u,
  /^COPY\s+docs\b/u,
  /^COPY\s+render\.yaml\b/u,
  /^COPY\s+server\/data\b/u,
  /^COPY\s+server\/package-lock\.json\s+(?!\.\/server\/)/u,
  /^COPY\s+scripts\s+/u
];
const unexpectedCopies = copyLines.filter((line) => !allowedCopyLines.includes(line));
const forbiddenCopies = copyLines.filter((line) => forbiddenCopyPatterns.some((pattern) => pattern.test(line)));

check("Docker base image is pinned to Node Alpine", lines.includes("FROM node:24-alpine"), firstLine("FROM"));
check("Docker build installs from package lock", normalized.includes("RUN npm --prefix server ci --include=dev"), "npm ci --include=dev");
check("Docker copy list is allowlisted", unexpectedCopies.length === 0, unexpectedCopies.join(" | ") || "allowlist only");
check("Dockerfile does not copy repo root or docs", forbiddenCopies.length === 0, forbiddenCopies.join(" | ") || "absent");
check("Docker image copies only the app server source", copyLines.includes("COPY server/server.js ./server/server.js"), copyLines.join(" | "));
check("Docker build protects frontend before prune", normalized.includes("RUN node scripts/protect-frontend.mjs assets/demo.js assets/demo.js \\\n  && npm --prefix server prune --omit=dev"), "protect then prune");
check("Docker runtime defaults to hosted app port", lines.includes("ENV HOST=0.0.0.0") && lines.includes("ENV PORT=5179") && lines.includes("EXPOSE 5179"), "HOST/PORT/EXPOSE");
check("Docker runtime creates non-root app user", normalized.includes("adduser -S app -G app") && lines.includes("USER app"), "USER app");
check("Docker image has an API healthcheck", normalized.includes("/api/health") && normalized.includes("HEALTHCHECK "), "HEALTHCHECK /api/health");
check("Docker command runs the single backend app", lines.includes('CMD ["node", "server/server.js"]'), lastLine("CMD"));

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nDocker boundary check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function firstLine(prefix) {
  return lines.find((line) => line.startsWith(prefix)) || "missing";
}

function lastLine(prefix) {
  return [...lines].reverse().find((line) => line.startsWith(prefix)) || "missing";
}
