#!/usr/bin/env node

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromServer = createRequire(new URL("../server/package.json", import.meta.url));
const acorn = requireFromServer("acorn");
const source = await fs.readFile(path.join(repoRoot, "assets/demo.js"), "utf8");
const styles = await fs.readFile(path.join(repoRoot, "assets/demo.css"), "utf8");
const ast = acorn.parse(source, {
  ecmaVersion: "latest",
  sourceType: "script"
});
const checks = [];
const expectedNavRoutes = ["home", "review", "work", "next", "memory", "create"];
const expectedContractRoutes = [...expectedNavRoutes, "pack"];
const expectedNavLabels = ["Start", "Review", "Work", "Next", "Memory", "Create"];
const blockedPublicRoutes = [
  "board",
  "calendar",
  "check",
  "feedback",
  "files",
  "focus",
  "health",
  "lab",
  "meta",
  "notes",
  "search",
  "settings",
  "stats",
  "timeline",
  "today"
];

const routeContract = extractRouteContract();
const navGroups = extractNavRouteGroups();
const contractRoutes = Object.keys(routeContract);
const navRoutes = navGroups.flatMap((group) => group.routes);
const navLabels = navRoutes.map((route) => routeContract[route]?.navLabel || "");
const publicRoutedPatterns = navRoutes.map((route) => routeContract[route]?.pattern || "");
const blockedInContract = blockedPublicRoutes.filter((route) => contractRoutes.includes(route));
const blockedInNav = blockedPublicRoutes.filter((route) => navRoutes.includes(route));
const blockedDispatchCases = blockedPublicRoutes.filter((route) => source.includes(`case "${route}":`));
const blockedGoCalls = blockedPublicRoutes.filter((route) => source.includes(`go("${route}"`));
const blockedRouteActions = [
  "choose-profile",
  "copy-feedback-context",
  "refresh-health",
  "refresh-meta",
  "search-demo",
  "validate-sample"
].filter((action) => source.includes(`action === "${action}"`) || source.includes(`action: "${action}"`));
const blockedRenderFunctions = [
  "renderBoard",
  "renderCalendar",
  "renderCheck",
  "renderFeedback",
  "renderFiles",
  "renderFocus",
  "renderHealth",
  "renderLab",
  "renderMeta",
  "renderNotes",
  "renderSearch",
  "renderSettings",
  "renderStats",
  "renderTimeline",
  "renderToday"
].filter((name) => source.includes(`function ${name}(`));
const blockedRetiredHelpers = [
  "bindLabControls",
  "copyFeedbackContext",
  "collectDiagnosticContext",
  "collectLabSnapshot",
  "collectStyleAudit",
  "feedbackIssueBody",
  "labSmokeChecks",
  "labNoPackReason",
  "labPackSelectReason",
  "labRunActionHelp",
  "labSetNextActionHelp",
  "refreshMetaDiagnostics",
  "styleAuditChecks",
  "syncLabRenderedSmokeChecks"
].filter((name) => source.includes(`function ${name}(`));

check("route contract contains only the public routes plus pack detail", arraysEqual(contractRoutes, expectedContractRoutes), contractRoutes.join(", "));
check("visible nav routes stay intentionally small", arraysEqual(navRoutes, expectedNavRoutes), navRoutes.join(", "));
check("visible nav labels stay portfolio-facing", arraysEqual(navLabels, expectedNavLabels), navLabels.join(", "));
check("pack detail route is not visible in nav", routeContract.pack && !navRoutes.includes("pack"), navRoutes.join(", "));
check("internal routes are absent from route contract", blockedInContract.length === 0, blockedInContract.join(", ") || "absent");
check("internal routes are absent from visible nav", blockedInNav.length === 0, blockedInNav.join(", ") || "absent");
check("internal routes are absent from render dispatch", blockedDispatchCases.length === 0, blockedDispatchCases.join(", ") || "absent");
check("internal routes are absent from go() entrypoints", blockedGoCalls.length === 0, blockedGoCalls.join(", ") || "absent");
check("retired route actions are absent", blockedRouteActions.length === 0, blockedRouteActions.join(", ") || "absent");
check("retired route render functions are absent", blockedRenderFunctions.length === 0, blockedRenderFunctions.join(", ") || "absent");
check("retired route helper functions are absent", blockedRetiredHelpers.length === 0, blockedRetiredHelpers.join(", ") || "absent");
check("public routes use hash patterns", publicRoutedPatterns.every((pattern) => pattern.startsWith("#/")), publicRoutedPatterns.join(", "));
check("pack route requires a work id", routeContract.pack?.acceptsPackId === true && routeContract.pack?.pattern === "#/pack/{packId}", routeContract.pack?.pattern || "missing");
check("home route surfaces a live sample spotlight", homeSpotlightContractOk(), "homeSpotlightPanel with facts and primary action");
check("review route surfaces an up-next queue spotlight", reviewSpotlightContractOk(), "reviewQueuePanel with queue stats and actions");
check("spotlight facts keep the command triad visible", spotlightFactsContractOk(), "Where / Blocker / Button runs next");
check("spotlight styles are responsive", spotlightStylesContractOk(), "desktop grid plus mobile single column");

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}

const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nPublic route contract check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

function homeSpotlightContractOk() {
  return includesAll(source, [
    "${homeSpotlightPanel()}",
    "function homeSpotlightPanel()",
    "Live sample",
    "homeSpotlightFacts(pack, command)",
    "primaryCommandButton(pack)",
    "supportActionButton(\"open\", \"Open path\", pack, \"btn\")",
    "function homeSpotlightPack()"
  ]);
}

function reviewSpotlightContractOk() {
  return includesAll(source, [
    "${reviewQueuePanel(review, firstReview)}",
    "function reviewQueuePanel(review, firstReview)",
    "Up next",
    "reviewQueueStat(\"Blocked\", blockedCount, \"Needs blocker decision\")",
    "reviewQueueStat(\"Missing button\", missingNextCount, \"Needs Button runs next\")",
    "reviewQueueStat(\"Owner gaps\", ownerGapCount, \"Needs owner\")",
    "primaryCommandButton(firstReview)",
    "supportActionButton(\"set-next\", \"Set button\", firstReview, \"btn\")"
  ]);
}

function spotlightFactsContractOk() {
  return includesAll(source, [
    "function homeSpotlightFacts(pack, command)",
    "homeSpotlightFact(\"Where\", workTitle(pack))",
    "homeSpotlightFact(\"Blocker\", blockerTextForPack(pack))",
    "homeSpotlightFact(\"Button runs next\", command.label)",
    "function homeSpotlightFact(label, value)"
  ]);
}

function spotlightStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 700px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-home-spotlight",
    ".demo-review-spotlight",
    ".demo-home-spotlight-facts",
    "grid-template-columns: repeat(3, minmax(0, 1fr));",
    ".demo-review-queue-stats"
  ]) && includesAll(mobileStyles, [
    ".demo-home-spotlight-facts",
    ".demo-review-queue-stats",
    "grid-template-columns: 1fr;"
  ]);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function extractRouteContract() {
  const declarator = findVariableDeclarator("ROUTE_CONTRACT");
  const objectExpression = unwrapObjectFreeze(declarator?.init);
  if (!objectExpression || objectExpression.type !== "ObjectExpression") {
    throw new Error("ROUTE_CONTRACT must be Object.freeze({ ... }).");
  }

  return Object.fromEntries(objectExpression.properties.map((property) => {
    const route = propertyKey(property);
    const contract = objectValue(property.value);
    return [route, contract];
  }));
}

function extractNavRouteGroups() {
  const declarator = findVariableDeclarator("NAV_ROUTE_GROUPS");
  const arrayExpression = unwrapObjectFreeze(declarator?.init);
  if (!arrayExpression || arrayExpression.type !== "ArrayExpression") {
    throw new Error("NAV_ROUTE_GROUPS must be Object.freeze([...]).");
  }

  return arrayExpression.elements.map((item) => {
    const groupObject = unwrapObjectFreeze(item);
    if (!groupObject || groupObject.type !== "ObjectExpression") {
      throw new Error("NAV_ROUTE_GROUPS entries must be Object.freeze({ ... }).");
    }
    return objectValue(groupObject);
  });
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

function unwrapObjectFreeze(node) {
  if (node?.type !== "CallExpression") {
    return null;
  }
  const callee = node.callee;
  if (callee?.type !== "MemberExpression"
    || callee.object?.type !== "Identifier"
    || callee.object.name !== "Object"
    || callee.property?.type !== "Identifier"
    || callee.property.name !== "freeze") {
    return null;
  }
  return node.arguments[0] || null;
}

function objectValue(node) {
  if (node?.type !== "ObjectExpression") {
    throw new Error("Expected object expression in route contract.");
  }
  return Object.fromEntries(node.properties.map((property) => [propertyKey(property), literalValue(property.value)]));
}

function literalValue(node) {
  if (node?.type === "Literal") {
    return node.value;
  }
  const arrayExpression = unwrapObjectFreeze(node);
  if (arrayExpression?.type === "ArrayExpression") {
    return arrayExpression.elements.map(literalValue);
  }
  if (node?.type === "ArrayExpression") {
    return node.elements.map(literalValue);
  }
  throw new Error("Expected literal value in public route contract.");
}

function propertyKey(property) {
  if (property.key?.type === "Identifier") {
    return property.key.name;
  }
  if (property.key?.type === "Literal") {
    return String(property.key.value);
  }
  throw new Error("Expected simple property key in public route contract.");
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
