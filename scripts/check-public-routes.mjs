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
  "boardColumn",
  "boardMiniCard",
  "calendarCard",
  "copyFeedbackContext",
  "collectDiagnosticContext",
  "collectLabSnapshot",
  "collectStyleAudit",
  "dueTodayStatus",
  "feedbackIssueBody",
  "labSmokeChecks",
  "labNoPackReason",
  "labPackSelectReason",
  "labRunActionHelp",
  "labSetNextActionHelp",
  "refreshMetaDiagnostics",
  "sampleChecks",
  "sourceRow",
  "styleAuditChecks",
  "syncLabRenderedSmokeChecks",
  "setDueTodayState",
  "todayRow",
  "validateSampleHelp",
  "validateSampleState",
  "validationStatus"
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
check("create route surfaces readiness before the form", createReadinessContractOk(), "createReadinessPanel with required field checklist");
check("memory route exposes selected work chooser", memoryChooserContractOk(), "memoryWorkChooser with chip targets and create fallback");
check("create field help names only current public surfaces", source.includes("Optional date kept on the work path and searchable in the work list.") && !source.includes("Today and Calendar views"), "due help avoids retired screens");
check("runtime status copy avoids retired settings and check screens", !source.includes("Where: Settings") && !source.includes("Where: Check"), "status copy stays on public surfaces");
check("spotlight facts keep the command triad visible", spotlightFactsContractOk(), "Where / Blocker / Button runs next");
check("spotlight styles are responsive", spotlightStylesContractOk(), "desktop grid plus mobile single column");
check("home path reads as connected steps", homePathFlowStylesContractOk(), "desktop connector plus compact mobile step grid");
check("card support actions stay readable and tappable", cardSupportActionStylesContractOk(), "grid tiles plus single-column mobile actions");
check("card title buttons keep a readable hit area", cardTitleButtonStylesContractOk(), "title buttons keep padding and focus radius");
check("card state pills stay compact in headers", cardStatePillStylesContractOk(), "desktop badge cap plus mobile start alignment");
check("panel forms group labels controls and help", panelFormFieldStylesContractOk(), "field-card grouping plus focus state");
check("work filters stay scannable and tappable", workFilterStylesContractOk(), "equal-width chip grid plus compact mobile columns");
check("work search reports visible result context", source.includes('aria-describedby="demo-search-summary"') && source.includes('id="demo-search-summary" class="demo-status-line" role="status" aria-live="polite"') && source.includes("function workToolbarSummary()"), "search summary describes visible count and active filter");
check("empty states expose semantic context", source.includes('class="demo-empty" role="note" aria-label="${escapeAttribute(label)}"') && source.includes("Empty state: ${text}. Where: ${context.where}. Blocker: ${context.blocker}. Button runs next: ${context.next}."), "empty state note labels include triad");
check("mobile dock gives Button runs next a full row", mobileDockContractOk(), "two status cells plus full-width next action");
check("primary nav label stays compact and public-facing", html.includes('id="demo-nav"') && html.includes('aria-label="Demo screens"'), "Demo screens");
check("brand home link stays public-facing", html.includes('aria-label="Projects demo home"'), "Projects demo home");
check("skip link names the current screen target", html.includes('href="#demo-main">Skip to current screen</a>'), "Skip to current screen");
check("demo notice says no login or private data", html.includes("Demo data only. No login or private project data."), "no login/private data");
check("runtime notices keep no-login framing", source.includes("Saves in this browser; no login.") && source.includes("No login or private storage.") && source.includes("No private project data.") && !source.includes("not an account") && !source.includes("Do not enter private project data"), "no-login runtime notices");
check("demo data notice is exposed as supporting context", html.includes('id="demo-notice"') && html.includes('role="note"'), "demo notice role=note");
check("sidebar idea note is exposed as supporting context", html.includes('class="demo-sidebar-note card" role="note"'), "sidebar note role=note");
check("next action panel is labelled by its visible title", html.includes('class="demo-command-brief sidecar" aria-labelledby="command-title" aria-describedby="command-scope command-flow"'), "command-title labels next action panel");
check("next action panel exposes scope and flow summary", html.includes('aria-describedby="command-scope command-flow"') && html.includes('id="command-scope"') && html.includes('id="command-flow"'), "command-scope and command-flow describe next action panel");
check("next action state announces changes politely", html.includes('id="command-state" class="demo-command-state" role="status" aria-live="polite" aria-atomic="true"'), "command-state status region");
check("command receipt announces complete status updates", html.includes('id="command-receipt"') && html.includes('aria-atomic="true"'), "command receipt aria-atomic");
check("bottom dock label describes purpose instead of layout", html.includes('class="demo-bottom-brief" aria-label="Next action summary" aria-describedby="dock-where dock-blocker dock-next-label"'), "Next action summary");
check("bottom dock exposes where blocker and next labels", html.includes('aria-describedby="dock-where dock-blocker dock-next-label"') && html.includes('id="dock-where"') && html.includes('id="dock-blocker"') && html.includes('id="dock-next-label"'), "dock summary fields describe bottom dock");
check("next action controls declare the content region they update", html.includes('id="primary-action"') && html.includes('id="dock-where-item" class="demo-bottom-item" href="#/work" aria-controls="screen-content"') && html.includes('id="dock-review-item" class="demo-bottom-item" href="#/review" aria-controls="screen-content"') && html.includes('id="dock-next"') && html.includes('aria-controls="screen-content"'), "screen-content controlled by action controls");
check("pack-aware navigation keeps selected work context", source.includes("function routeLinkPackId(route)") && source.includes('item.setAttribute("href", formatRouteHash(item.dataset.route, routeLinkPackId(item.dataset.route)))') && source.includes('data-pack="${escapeAttribute(routeLinkPackId(route))}"'), "nav and route buttons preserve selected work ids");
check("browser title follows the current screen", source.includes("function updateDocumentTitle(screenTitle)") && source.includes('document.title = screenTitle === "Start" ? "Projects Demo" : `${screenTitle} - Projects Demo`;') && source.includes("updateDocumentTitle(screenTitle);"), "document title mirrors screen title");
check("skip target landmark is labelled by the visible title", html.includes('id="demo-main"') && html.includes('aria-labelledby="screen-title"'), "screen-title labels main landmark");
check("screen content region is labelled by the visible title", html.includes('id="screen-content"') && html.includes('aria-labelledby="screen-title"'), "screen-title labels live content");

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
    "supportActionButton(\"open\", \"Open work path\", pack, \"btn\")",
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
    "supportActionButton(\"set-next\", \"Set Button runs next\", firstReview, \"btn\")"
  ]);
}

function createReadinessContractOk() {
  return includesAll(source, [
    "${createReadinessPanel(defaults, createState)}",
    "function createReadinessPanel(values, createState)",
    "Ready to save",
    "homeSpotlightFact(\"Where\", profile().newWork, \"create-readiness-where\")",
    "function createReadinessStep(label, value, id)",
    "function syncCreateReadinessPanel(values, createState)",
    "syncCreateReadinessStep(\"create-readiness-title\", values.title)",
    "syncCreateReadinessStep(\"create-readiness-owner\", values.owner)",
    "syncCreateReadinessStep(\"create-readiness-button\", values.next)",
    "if (runRouteAction(action, button.dataset.pack || \"\"))",
    "bindListActions();"
  ]);
}

function memoryChooserContractOk() {
  return includesAll(source, [
    "${memoryWorkChooser(pack)}",
    "function memoryWorkChooser(selected)",
    "aria-label=\"Memory work selector\"",
    "id=\"memory-work-summary\" class=\"demo-status-line\" role=\"status\" aria-live=\"polite\"",
    "aria-label=\"Work for memory\" aria-describedby=\"memory-work-summary\"",
    "function memoryWorkChoiceButton(pack, selected)",
    "data-action=\"memory\"",
    "Current memory target:",
    "Use ${workTitle(pack)} as the memory target.",
    "Create work before adding memory notes.",
    "navButton(\"create\", profile().newWork)"
  ]);
}

function spotlightFactsContractOk() {
  return includesAll(source, [
    "function homeSpotlightFacts(pack, command)",
    "homeSpotlightFact(\"Where\", workTitle(pack))",
    "homeSpotlightFact(\"Blocker\", blockerTextForPack(pack))",
    "homeSpotlightFact(\"Button runs next\", command.label)",
    "function homeSpotlightFact(label, value"
  ]);
}

function spotlightStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 700px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-home-spotlight",
    ".demo-review-spotlight",
    ".demo-create-spotlight",
    ".demo-home-spotlight-facts",
    "grid-template-columns: repeat(3, minmax(0, 1fr));",
    ".demo-review-queue-stats",
    ".demo-create-readiness-list"
  ]) && includesAll(mobileStyles, [
    ".demo-home-spotlight-facts",
    ".demo-review-queue-stats",
    ".demo-create-readiness-list",
    "grid-template-columns: 1fr;"
  ]);
}

function homePathFlowStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 700px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-start-step:not(:last-child)::after",
    "right: -11px;",
    "top: 23px;"
  ]) && includesAll(mobileStyles, [
    ".demo-start-step",
    "grid-template-columns: auto minmax(0, 1fr);",
    ".demo-start-step:not(:last-child)::after",
    "bottom: -11px;",
    ".demo-start-step > small",
    "grid-column: 2;"
  ]);
}

function cardSupportActionStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 560px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-support-action",
    "min-height: 46px;",
    ".demo-card-support > .demo-card-actions",
    "grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));",
    ".demo-card-support > .demo-card-actions .demo-support-action",
    "width: 100%;",
    ".demo-card-support summary:focus-visible",
    ".demo-row-support summary:focus-visible",
    "outline: 3px solid var(--demo-focus-ring);"
  ]) && includesAll(mobileStyles, [
    ".demo-card-support > .demo-card-actions",
    "grid-template-columns: 1fr;"
  ]);
}

function cardTitleButtonStylesContractOk() {
  return includesAll(styles, [
    ".demo-card-title",
    "border-radius: var(--cockpit-radius-sm);",
    "min-height: 30px;",
    "padding: 3px 0;",
    ".demo-card-title:focus-visible",
    "outline: 3px solid var(--demo-focus-ring);"
  ]);
}

function cardStatePillStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 560px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-state-pill",
    "justify-content: center;",
    "line-height: 1.2;",
    "white-space: normal;",
    ".demo-card-head > .demo-state-pill",
    "max-width: min(100%, 180px);"
  ]) && includesAll(mobileStyles, [
    ".demo-card-head > .demo-state-pill",
    "justify-self: start;",
    "max-width: 100%;"
  ]);
}

function panelFormFieldStylesContractOk() {
  return includesAll(styles, [
    ".demo-panel > .demo-form-grid > .demo-field:not(.demo-state-preview):not(.demo-blocker-field)",
    ".demo-panel > .demo-inline-form > .demo-field:not(.demo-state-preview):not(.demo-blocker-field)",
    "background: var(--demo-form-field-bg);",
    "box-shadow: var(--demo-form-inner-shadow);",
    ".demo-panel > .demo-form-grid > .demo-field:not(.demo-state-preview):not(.demo-blocker-field):focus-within",
    ".demo-panel > .demo-inline-form > .demo-field:not(.demo-state-preview):not(.demo-blocker-field):focus-within",
    ".demo-panel > .demo-form-grid > .demo-field:not(.demo-state-preview):not(.demo-blocker-field) .demo-field-help",
    "margin: 0;"
  ]);
}

function workFilterStylesContractOk() {
  const mobileStart = styles.indexOf("@media (max-width: 560px)");
  const mobileEnd = mobileStart < 0 ? -1 : styles.indexOf("@media", mobileStart + 1);
  const mobileStyles = mobileStart < 0 ? "" : styles.slice(mobileStart, mobileEnd > mobileStart ? mobileEnd : undefined);
  return includesAll(styles, [
    ".demo-toolbar:focus-within",
    "border-color: var(--cockpit-accent);",
    "box-shadow: var(--demo-panel-hover-shadow);",
    ".demo-chip-row",
    "grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));",
    ".demo-chip",
    "justify-content: space-between;",
    "min-height: 42px;",
    "width: 100%;",
    ".demo-chip[aria-pressed=\"true\"] .demo-chip-count",
    "flex: 0 0 auto;",
    "background: var(--cockpit-bg);",
    "color: var(--cockpit-text);"
  ]) && includesAll(mobileStyles, [
    ".demo-chip-row",
    "grid-template-columns: repeat(2, minmax(0, 1fr));"
  ]);
}

function mobileDockContractOk() {
  const mobileDockStart = styles.indexOf("Mobile dock gives the primary next action a full row");
  const mobileDock = mobileDockStart < 0 ? "" : styles.slice(mobileDockStart);
  return includesAll(styles, [
    ".demo-bottom-item:focus-visible",
    "outline: 3px solid var(--demo-focus-ring);",
    ".demo-bottom-brief",
    "overflow: hidden;",
    ".demo-shell button.btn",
    "touch-action: manipulation;",
    ".demo-bottom-item"
  ]) && includesAll(mobileDock, [
    ".demo-bottom-brief",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ".demo-bottom-next",
    "grid-column: 1 / -1;",
    "overflow-wrap: anywhere;",
    "white-space: normal;"
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
