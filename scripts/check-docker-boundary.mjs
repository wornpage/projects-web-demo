#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfile = await fs.readFile(path.join(repoRoot, "Dockerfile"), "utf8");
const lines = dockerfile.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
const checks = [];
const buildLines = stageLines("build");
const runtimeLines = stageLines("runtime");
const buildText = buildLines.join("\n");
const runtimeText = runtimeLines.join("\n");
const buildCopyLines = buildLines.filter((line) => line.startsWith("COPY "));
const runtimeCopyLines = runtimeLines.filter((line) => line.startsWith("COPY "));
const allowedBuildCopyLines = [
  "COPY server/package*.json ./server/",
  "COPY index.html ./",
  "COPY assets/demo.css ./assets/demo.css",
  "COPY assets/demo.js ./assets/demo.js",
  "COPY assets/favicon.png ./assets/favicon.png",
  "COPY data/demo-packs.json ./data/demo-packs.json",
  "COPY scripts/protect-frontend.mjs ./scripts/protect-frontend.mjs",
  "COPY server/server.js ./server/server.js"
];
const allowedRuntimeCopyLines = [
  "COPY --from=build /app/server/node_modules ./server/node_modules",
  "COPY --from=build /app/index.html ./",
  "COPY --from=build /app/assets/demo.css ./assets/demo.css",
  "COPY --from=build /app/assets/demo.js ./assets/demo.js",
  "COPY --from=build /app/assets/favicon.png ./assets/favicon.png",
  "COPY --from=build /app/data/demo-packs.json ./data/demo-packs.json",
  "COPY --from=build /app/server/server.js ./server/server.js"
];
const forbiddenRuntimeCopyPatterns = [
  /^COPY\s+\.\s+/u,
  /^COPY\s+--from=build\s+\/app\/\.\s+/u,
  /^COPY\s+assets\s+/u,
  /^COPY\s+data\s+/u,
  /^COPY\s+README\.md\b/u,
  /^COPY\s+--from=build\s+\/app\/README\.md\b/u,
  /^COPY\s+docs\b/u,
  /^COPY\s+--from=build\s+\/app\/docs\b/u,
  /^COPY\s+render\.yaml\b/u,
  /^COPY\s+--from=build\s+\/app\/render\.yaml\b/u,
  /^COPY\s+server\/data\b/u,
  /^COPY\s+--from=build\s+\/app\/server\/data\b/u,
  /^COPY\s+server\/package-lock\.json\s+(?!\.\/server\/)/u,
  /^COPY\s+--from=build\s+\/app\/server\/package/u,
  /^COPY\s+scripts\s+/u,
  /^COPY\s+--from=build\s+\/app\/scripts\b/u
];
const unexpectedBuildCopies = buildCopyLines.filter((line) => !allowedBuildCopyLines.includes(line));
const unexpectedRuntimeCopies = runtimeCopyLines.filter((line) => !allowedRuntimeCopyLines.includes(line));
const forbiddenRuntimeCopies = runtimeCopyLines.filter((line) => forbiddenRuntimeCopyPatterns.some((pattern) => pattern.test(line)));

check("Docker build stage is pinned to Node Alpine", lines.includes("FROM node:24-alpine AS build"), firstLine("FROM"));
check("Docker runtime stage is pinned to Node Alpine", lines.includes("FROM node:24-alpine AS runtime"), lastFromLine());
check("Docker build installs from package lock", buildText.includes("RUN npm --prefix server ci --include=dev"), "npm ci --include=dev");
check("Docker build creates named public asset directories", buildLines.includes("RUN mkdir -p assets data scripts"), "assets/data/scripts");
check("Docker build copy list is allowlisted", unexpectedBuildCopies.length === 0, unexpectedBuildCopies.join(" | ") || "allowlist only");
check("Docker runtime copy list is allowlisted", unexpectedRuntimeCopies.length === 0, unexpectedRuntimeCopies.join(" | ") || "allowlist only");
check("Docker runtime does not copy repo root, docs, package manifests, or build scripts", forbiddenRuntimeCopies.length === 0, forbiddenRuntimeCopies.join(" | ") || "absent");
check("Docker runtime omits build-only helpers", !runtimeText.includes("/app/scripts") && !runtimeText.includes("package*.json") && !runtimeText.includes("protect-frontend.mjs"), "scripts/package manifests absent");
check("Docker image copies only named frontend and seed files", [
  "COPY --from=build /app/assets/demo.css ./assets/demo.css",
  "COPY --from=build /app/assets/demo.js ./assets/demo.js",
  "COPY --from=build /app/assets/favicon.png ./assets/favicon.png",
  "COPY --from=build /app/data/demo-packs.json ./data/demo-packs.json"
].every((line) => runtimeCopyLines.includes(line)), runtimeCopyLines.join(" | "));
check("Docker runtime copies only the app server source", runtimeCopyLines.includes("COPY --from=build /app/server/server.js ./server/server.js"), runtimeCopyLines.join(" | "));
check("Docker runtime copies pruned production dependencies", runtimeCopyLines.includes("COPY --from=build /app/server/node_modules ./server/node_modules"), runtimeCopyLines.join(" | "));
check("Docker build protects frontend before prune", sourceOrder(buildText, [
  "RUN node scripts/protect-frontend.mjs assets/demo.js assets/demo.js",
  "npm --prefix server prune --omit=dev"
]), "protect then prune");
check("Docker runtime defaults to hosted app port", runtimeLines.includes("ENV HOST=0.0.0.0") && runtimeLines.includes("ENV PORT=5179") && runtimeLines.includes("EXPOSE 5179"), "HOST/PORT/EXPOSE");
check("Docker runtime creates non-root app user", runtimeText.includes("adduser -S app -G app") && runtimeLines.includes("USER app"), "USER app");
check("Docker runtime image has an API healthcheck", runtimeText.includes("/api/health") && runtimeText.includes("HEALTHCHECK "), "HEALTHCHECK /api/health");
check("Docker command runs the single backend app", runtimeLines.includes('CMD ["node", "server/server.js"]'), lastLine("CMD"));

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

function lastFromLine() {
  return [...lines].reverse().find((line) => line.startsWith("FROM")) || "missing";
}

function lastLine(prefix) {
  return [...lines].reverse().find((line) => line.startsWith(prefix)) || "missing";
}

function stageLines(stageName) {
  const startIndex = lines.findIndex((line) => line.toLowerCase() === `from node:24-alpine as ${stageName}`);
  if (startIndex === -1) {
    return [];
  }

  const nextStageIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith("FROM "));
  return lines.slice(startIndex, nextStageIndex === -1 ? lines.length : nextStageIndex);
}

function sourceOrder(text, needles) {
  let lastIndex = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle);
    if (index <= lastIndex) {
      return false;
    }
    lastIndex = index;
  }
  return true;
}
