#!/usr/bin/env node

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromServer = createRequire(new URL("../server/package.json", import.meta.url));
const acorn = requireFromServer("acorn");
const html = await fs.readFile(path.join(repoRoot, "index.html"), "utf8");
const source = await fs.readFile(path.join(repoRoot, "assets/demo.js"), "utf8");
const styles = await fs.readFile(path.join(repoRoot, "assets/demo.css"), "utf8");
const ast = acorn.parse(source, {
  ecmaVersion: "latest",
  sourceType: "script"
});
const checks = [];

const requiredHtmlIds = [
  "demo-sync",
  "sync-code-state",
  "sync-code-input",
  "sync-code-use",
  "sync-code-new",
  "sync-code-copy-code",
  "sync-code-copy",
  "sync-code-leave",
  "sync-code-share",
  "sync-code-link",
  "sync-code-qr",
  "sync-code-help"
];

const expectedConstants = new Map([
  ["SYNC_CODE_STORAGE_KEY", "projects-static-demo-sync-code-v1"],
  ["SYNC_CODE_QUERY_PARAM", "sync"],
  ["SYNC_CODE_MIN_COMPACT_LENGTH", 12],
  ["SYNC_CODE_MAX_COMPACT_LENGTH", 24],
  ["SYNC_CODE_GENERATED_COMPACT_LENGTH", 20],
  ["SYNC_QR_VERSION", 5],
  ["SYNC_QR_DATA_CODEWORDS", 108],
  ["SYNC_QR_ERROR_CODEWORDS", 26],
  ["SYNC_QR_QUIET_MODULES", 4],
  ["SYNC_QR_MAX_BYTES", 106]
]);

const requiredFunctions = [
  "bindDemoSyncControls",
  "applyLaunchSyncCode",
  "renderDemoSyncControls",
  "renderSyncShare",
  "syncShareUrl",
  "copySyncCode",
  "copySyncLink",
  "activateSyncCode",
  "leaveSyncCode",
  "readSyncCode",
  "writeSyncCode",
  "clearSyncCode",
  "clearLaunchSyncCodeParam",
  "normalizeSyncCode",
  "generateSyncCode",
  "renderSyncQr",
  "syncQrSvg",
  "syncQrMatrix",
  "syncQrDataCodewords",
  "apiHeaders",
  "apiClientId",
  "syncClientId",
  "generateApiClientId"
];

for (const id of requiredHtmlIds) {
  check(`HTML keeps #${id}`, html.includes(`id="${id}"`), id);
}

for (const [name, expected] of expectedConstants.entries()) {
  check(`${name} stays fixed`, literalConstant(name) === expected, detailConstant(name));
}

for (const name of requiredFunctions) {
  check(`${name} exists`, Boolean(findFunctionDeclaration(name)), name);
}

const bindSyncControls = functionSource("bindDemoSyncControls");
const applyLaunchSync = functionSource("applyLaunchSyncCode");
const renderControls = functionSource("renderDemoSyncControls");
const renderShare = functionSource("renderSyncShare");
const shareUrl = functionSource("syncShareUrl");
const copyCode = functionSource("copySyncCode");
const copyLink = functionSource("copySyncLink");
const activateCode = functionSource("activateSyncCode");
const leaveCode = functionSource("leaveSyncCode");
const normalizeCode = functionSource("normalizeSyncCode");
const generateCode = functionSource("generateSyncCode");
const qrData = functionSource("syncQrDataCodewords");
const apiHeaders = functionSource("apiHeaders");
const apiClient = functionSource("apiClientId");
const syncClient = functionSource("syncClientId");
const apiClientIdGenerator = functionSource("generateApiClientId");
const startupSource = source.slice(
  source.indexOf('document.addEventListener("DOMContentLoaded"'),
  source.indexOf("async function loadInitialDemoState()")
);

check(
  "backend API base comes only from the server-injected setting",
  includesAll(source, [
    "const DEMO_API_BASE_URL = normalizeApiBaseUrl(window.PROJECTS_API_BASE_URL || \"\")"
  ]) && !source.includes("DEMO_API_QUERY_PARAM") && !source.includes("launchParams.get(\"api\")") && !source.includes("launchParams.get('api')"),
  "window.PROJECTS_API_BASE_URL only"
);

check(
  "sync controls wire use, new, copy code, copy link, and leave actions",
  includesAll(bindSyncControls, [
    'activateSyncCode(valueOf("sync-code-input"), { copyCurrentState: false })',
    "generateSyncCode()",
    "activateSyncCode(code, { copyCurrentState: true })",
    "copySyncCode()",
    "copySyncLink()",
    "withSyncControlsBusy(leaveSyncCode)"
  ]),
  "use/new/copy-code/copy-link/leave"
);

check(
  "sync code input keeps mobile-friendly entry hints",
  includesAll(html, [
    'id="sync-code-input"',
    'inputmode="text"',
    'enterkeyhint="go"',
    'autocomplete="off"',
    'autocapitalize="characters"',
    'spellcheck="false"',
    'aria-describedby="sync-code-help"'
  ]),
  "text input, go key, no autocomplete, character caps, no spellcheck"
);

check(
  "sync buttons keep clear accessible names",
  includesAll(html, [
    'id="sync-code-use" class="btn btn-sm" type="button" aria-label="Use sync code"',
    'id="sync-code-new" class="btn btn-sm" type="button" aria-label="Create sync code"',
    'id="sync-code-copy-code" class="btn btn-sm" type="button" aria-label="Copy sync code"',
    'id="sync-code-copy" class="btn btn-sm" type="button" aria-label="Copy sync link"',
    'id="sync-code-leave" class="btn btn-sm" type="button" aria-label="Leave sync code"'
  ]),
  "sync button aria-labels"
);

check(
  "sync help keeps short private-data warning",
  html.includes("Anyone with this code can open this demo state. No private data.") &&
    source.includes("Anyone with this code can open this demo state. No private data.") &&
    !html.includes("Do not use it for private data") &&
    !source.includes("Do not use it for private data"),
  "short sync privacy warning"
);

check(
  "launch sync code comes from ?sync= only in backend app mode",
  includesAll(applyLaunchSync, [
    "!DEMO_API_BASE_URL",
    "launchParams.get(SYNC_CODE_QUERY_PARAM)",
    "writeSyncCode(code)",
    "apiSessionClientId = \"\""
  ]),
  "applyLaunchSyncCode"
);

check(
  "launch sync code is cleared after shared state loads",
  sourceOrder(startupSource, [
    "const launchedSyncCode = applyLaunchSyncCode()",
    "await loadInitialDemoState()",
    "if (launchedSyncCode)",
    "clearLaunchSyncCodeParam()",
    "routeFromHash()"
  ]),
  "startup clears ?sync after load"
);

check(
  "sync controls render only when backend app mode exists",
  includesAll(renderControls, [
    "panel.hidden = !DEMO_API_BASE_URL",
    "const syncCode = readSyncCode()",
    "renderSyncShare(syncCode)"
  ]),
  "renderDemoSyncControls"
);

check(
  "sync share link and QR use the same generated URL",
  includesAll(renderShare, [
    "const shareUrl = syncShareUrl(syncCode)",
    "link.href = shareUrl",
    "qr.dataset.qrValue = shareUrl",
    "renderSyncQr(qr, shareUrl)"
  ]),
  "renderSyncShare"
);

check(
  "sync share URL uses ?sync= and lands on home",
  includesAll(shareUrl, [
    "new URL(location.href)",
    "url.search = \"\"",
    "url.searchParams.set(SYNC_CODE_QUERY_PARAM, code)",
    "url.hash = \"#/home\""
  ]),
  "syncShareUrl"
);

check(
  "copy code action copies the normalized sync code",
  includesAll(copyCode, [
    "const syncCode = readSyncCode()",
    "navigator.clipboard.writeText(syncCode)",
    "enter code on another device"
  ]),
  "copySyncCode"
);

check(
  "copy action copies the sync URL to the clipboard",
  includesAll(copyLink, [
    "const shareUrl = syncShareUrl(readSyncCode())",
    "navigator.clipboard.writeText(shareUrl)"
  ]),
  "copySyncLink"
);

check(
  "new sync code can copy the current state into the shared row",
  includesAll(activateCode, [
    "writeSyncCode(code)",
    "apiSessionClientId = \"\"",
    "options.copyCurrentState",
    "sendBackendStateSnapshot(\"/api/state/sync\", \"POST\", demoStateSnapshot(), \"Sync\")",
    "loadBackendOwnedState(await loadBackendState())"
  ]),
  "activateSyncCode"
);

check(
  "leaving a sync code returns the browser to its own state row",
  includesAll(leaveCode, [
    "clearSyncCode()",
    "clearLaunchSyncCodeParam()",
    "apiSessionClientId = \"\"",
    "loadBackendOwnedState(await loadBackendState())"
  ]),
  "leaveSyncCode"
);

check(
  "sync codes are compact alphanumeric codes with bounded length",
  includesAll(normalizeCode, [
    ".toUpperCase()",
    ".replace(/[^A-Z0-9]/gu, \"\")",
    ".slice(0, SYNC_CODE_MAX_COMPACT_LENGTH)",
    "compact.length < SYNC_CODE_MIN_COMPACT_LENGTH"
  ]),
  "normalizeSyncCode"
);

check(
  "generated sync codes use Web Crypto with no weak random fallback",
  includesAll(generateCode, [
    "!globalThis.crypto?.getRandomValues",
    "throw new Error(\"Secure random sync codes need Web Crypto in this browser.\")",
    "new Uint8Array(SYNC_CODE_GENERATED_COMPACT_LENGTH)",
    "globalThis.crypto.getRandomValues(bytes)"
  ]) && !generateCode.includes("Math.random"),
  "generateSyncCode"
);

check(
  "built-in QR rejects links beyond its encoded capacity",
  includesAll(qrData, [
    "new TextEncoder().encode(value)",
    "bytes.length > SYNC_QR_MAX_BYTES",
    "throw new Error(\"Sync link is too long for the built-in QR code.\")"
  ]),
  "syncQrDataCodewords"
);

check(
  "API requests carry the current browser or sync client key",
  includesAll(apiHeaders, [
    "const clientId = await apiClientId()",
    "headers[\"x-projects-demo-client\"] = clientId"
  ]),
  "apiHeaders"
);

check(
  "anonymous browser client keys use Web Crypto with no weak random fallback",
  includesAll(apiClientIdGenerator, [
    "globalThis.crypto?.randomUUID",
    "globalThis.crypto.randomUUID()",
    "!globalThis.crypto?.getRandomValues",
    "throw new Error(\"Backend state isolation needs Web Crypto in this browser.\")",
    "globalThis.crypto.getRandomValues(bytes)",
    "return `demo-${base64Url(bytes)}`"
  ]) && !source.includes("Math.random"),
  "generateApiClientId"
);

check(
  "sync code client key wins before anonymous browser storage",
  sourceOrder(apiClient, [
    "const syncCode = readSyncCode()",
    "return syncClientId(syncCode)",
    "const saved = readApiClientId()"
  ]),
  "apiClientId"
);

check(
  "sync client keys are namespaced and hashed",
  includesAll(syncClient, [
    "globalThis.crypto?.subtle",
    "globalThis.crypto.subtle.digest",
    "projects-web-demo-sync:${normalized}",
    "return `sync-${base64Url(digest).slice(0, 64)}`"
  ]) && !syncClient.includes("normalized.toLowerCase()"),
  "syncClientId"
);

check(
  "sync client keys fail without Web Crypto hashing",
  includesAll(syncClient, [
    "!globalThis.crypto?.subtle",
    "throw new Error(\"Sync code sharing needs Web Crypto hashing in this browser.\")"
  ]) && !syncClient.includes("return `sync-${normalized.toLowerCase()"),
  "syncClientId"
);

check(
  "sync controls stay usable on mobile",
  syncMobileStylesOk(),
  "full-width input, centered buttons, compact share grid"
);

check(
  "sync share link keeps visible keyboard focus",
  includesAll(styles, [
    ".demo-sync-share a",
    "display: inline-flex;",
    "min-height: 34px;",
    ".demo-sync-share a:focus-visible",
    "outline: 3px solid var(--demo-focus-ring);",
    "outline-offset: 2px;"
  ]),
  "focus ring on generated share link"
);

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nSync surface check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function syncMobileStylesOk() {
  const mobileStart = styles.indexOf("@media (max-width: 560px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  const narrowStart = styles.indexOf("@media (max-width: 420px)");
  const narrowEnd = narrowStart < 0 ? -1 : styles.indexOf("@media", narrowStart + 1);
  const narrowStyles = narrowStart < 0 ? "" : styles.slice(narrowStart, narrowEnd > narrowStart ? narrowEnd : undefined);
  return includesAll(mobileStyles, [
    ".demo-sync-controls",
    ".demo-sync-share",
    "align-items: stretch;",
    ".demo-sync-controls input",
    "max-width: none;",
    "width: 100%;",
    ".demo-sync-controls .btn",
    "flex: 1 1 120px;",
    "justify-content: center;",
    "grid-template-columns: minmax(0, 1fr) auto;"
  ]) && includesAll(narrowStyles, [
    ".demo-sync-share",
    "grid-template-columns: 1fr;",
    ".demo-sync-qr",
    "justify-self: start;"
  ]);
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

function literalConstant(name) {
  const declarator = findVariableDeclarator(name);
  if (declarator?.init?.type !== "Literal") {
    return undefined;
  }
  return declarator.init.value;
}

function detailConstant(name) {
  const value = literalConstant(name);
  return value === undefined ? "missing" : JSON.stringify(value);
}

function functionSource(name) {
  const node = findFunctionDeclaration(name);
  if (!node) {
    return "";
  }
  return source.slice(node.start, node.end);
}

function findFunctionDeclaration(name) {
  let match = null;
  visit(ast, (node) => {
    if (node.type === "FunctionDeclaration" && node.id?.type === "Identifier" && node.id.name === name) {
      match = node;
    }
  });
  return match;
}

function findVariableDeclarator(name) {
  let match = null;
  visit(ast, (node) => {
    if (node.type === "VariableDeclarator" && node.id?.type === "Identifier" && node.id.name === name) {
      match = node;
    }
  });
  return match;
}

function visit(node, onNode) {
  if (!node || typeof node !== "object") {
    return;
  }

  onNode(node);
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, onNode));
      continue;
    }
    visit(value, onNode);
  }
}
