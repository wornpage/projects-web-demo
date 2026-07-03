#!/usr/bin/env node

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromServer = createRequire(new URL("../server/package.json", import.meta.url));
const acorn = requireFromServer("acorn");
const html = await fs.readFile(path.join(repoRoot, "index.html"), "utf8");
const source = await fs.readFile(path.join(repoRoot, "src/demo/demo.js"), "utf8");
const styles = await fs.readFile(path.join(repoRoot, "assets/demo.css"), "utf8");
const ast = acorn.parse(source, {
  ecmaVersion: "latest",
  sourceType: "script"
});
const checks = [];
const expectedNavRoutes = ["home", "review", "work", "next", "memory", "create", "calendar", "settings"];
const expectedContractRoutes = ["home", "review", "work", "next", "memory", "create", "pack", "compare", "calendar", "settings"];
const expectedNavLabels = ["Start", "Review", "Work", "Choose action", "Memory", "Create", "Calendar", "Settings"];
const expectedRouteTitles = { home: "Start", review: "Review", work: "Work", next: "Choose action", memory: "Memory", create: "Create", pack: "Work path", calendar: "Calendar", settings: "Settings" };
const blockedPublicRoutes = [
  "board",
  "check",
  "feedback",
  "files",
  "focus",
  "health",
  "lab",
  "meta",
  "notes",
  "search",
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
  "renderCheck",
  "renderFeedback",
  "renderFiles",
  "renderFocus",
  "renderHealth",
  "renderLab",
  "renderMeta",
  "renderNotes",
  "renderSearch",
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
check("route titles stay aligned with visible nav labels", routeTitlesContractOk(), expectedNavRoutes.map((route) => `${route}:${routeContract[route]?.title || ""}`).join(", "));
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
check("memory note input exposes live save guidance", memoryNoteInputContractOk(), "memory note placeholder names useful note types and describes live help");
check("create field help names only current public surfaces", source.includes("Optional date kept on the work path and searchable in the work list.") && !source.includes("Today and Calendar views"), "due help avoids retired screens");
check("due fields use native date pickers", dueDatePickerContractOk(), "new-due and edit-due render through dateField with type=date");
check("due dates stay visible and readable after save", dueDateDisplayContractOk(), "cards render semantic dates and Work path summary names saved due date");
check("runtime status copy avoids retired check screens", !source.includes("Where: Check"), "status copy stays on public surfaces");
check("spotlight facts keep the command triad visible", spotlightFactsContractOk(), "Where / Blocker / Next action");
check("spotlight styles are responsive", spotlightStylesContractOk(), "desktop grid plus mobile single column");
check("home path reads as connected steps", homePathFlowStylesContractOk(), "desktop connector plus compact mobile step grid");
check("work cards expose where and blocker before the next button", workCardTriadContractOk(), "structured work-card facts precede Next action");
check("blocked-by select keeps dependency contract", blockedBySelectContractOk(), "edit-blocked-by select offers safe targets and derives the reason");
check("card support actions stay readable and tappable", cardSupportActionStylesContractOk(), "grid tiles plus single-column mobile actions");
check("card title buttons keep a readable hit area", cardTitleButtonStylesContractOk(), "title buttons keep padding and focus radius");
check("card state pills stay compact in headers", cardStatePillStylesContractOk(), "desktop badge cap plus mobile start alignment");
check("panel forms group labels controls and help", panelFormFieldStylesContractOk(), "field-card grouping plus focus state");
check("work filters stay scannable and tappable", workFilterStylesContractOk(), "equal-width chip grid plus compact mobile columns");
check("work search reports visible result context", workSearchContractOk(), "search summary describes visible count and active filter; placeholder advertises searchable blocker");
check("empty states expose semantic context", source.includes('class="demo-empty" role="note" aria-label="${escapeAttribute(label)}"') && source.includes("Empty state: ${text}. Where: ${context.where}. Blocker: ${context.blocker}. Next action: ${context.next}."), "empty state note labels include triad");
check("mobile dock gives Next action a full row", mobileDockContractOk(), "two status cells plus full-width next action");
check("disabled buttons look inactive", disabledButtonAffordanceContractOk(), "disabled button styling removes pointer affordance and hover accent");
check("primary nav label stays compact and portfolio-facing", html.includes('id="demo-nav"') && html.includes('aria-label="Portfolio demo screens"'), "Portfolio demo screens");
check("sidebar landmark label keeps portfolio framing", html.includes('class="demo-sidebar nav-rail" aria-label="Portfolio demo navigation"'), "Portfolio demo navigation");
check("header kicker keeps portfolio framing", html.includes('<div class="demo-kicker">Portfolio demo</div>'), "Portfolio demo");
check("brand home link stays portfolio-facing", brandHomeLinkContractOk(), "Projects portfolio demo home");
check("metadata preview copy stays public and truthful", metadataPreviewContractOk(), "description omits browser-local-only framing and names no-login demo data");
check("skip link names the current screen target", html.includes('href="#demo-main">Skip to current screen</a>'), "Skip to current screen");
check("demo notice gives a starting cue and privacy boundary", demoNoticeContractOk(), "start with Review plus no-login/private-data boundary");
check("sync help keeps sample-data boundary", html.includes('<p id="sync-code-help">Share sample data only. Anyone with this code can open this state.</p>'), "Share sample data only");
check("runtime notices keep no-login framing", source.includes("Saves in this browser; no login.") && source.includes("Saves to this backend row; no login.") && source.includes("No login or private storage.") && source.includes("No private project data.") && !source.includes("not an account") && !source.includes("Do not enter private project data"), "no-login runtime notices");
check("demo data notice is exposed as supporting context", html.includes('id="demo-notice"') && html.includes('role="note"') && html.includes('aria-label="Starting point and demo data notice"'), "demo notice role=note with specific label");
check("sidebar idea note is exposed as supporting context", sidebarNoteContractOk(), "sidebar note names the idea and starting point");
check("next action label matches screen naming", html.includes('<span class="demo-command-label">Now</span>'), "Now");
check("next action panel is labelled by its visible title", html.includes('class="demo-command-brief sidecar" aria-labelledby="command-title" aria-describedby="command-scope command-flow"'), "command-title labels next action panel");
check("next action panel exposes scope and flow summary", html.includes('aria-describedby="command-scope command-flow"') && html.includes('id="command-scope"') && html.includes('id="command-flow"'), "command-scope and command-flow describe next action panel");
check("next action state announces changes politely", html.includes('id="command-state" class="demo-command-state" role="status" aria-live="polite" aria-atomic="true"'), "command-state status region");
check("command receipt announces complete status updates", html.includes('id="command-receipt"') && html.includes('aria-atomic="true"'), "command receipt aria-atomic");
check("empty memory placeholders use sentence-case visible copy", emptyMemoryPlaceholderContractOk(), "No memory yet");
check("bottom dock label describes purpose instead of layout", html.includes('class="demo-bottom-brief" aria-label="Now summary" aria-describedby="dock-where dock-blocker dock-next-label"'), "Now summary");
check("bottom dock exposes where blocker and next labels", html.includes('aria-describedby="dock-where dock-blocker dock-next-label"') && html.includes('id="dock-where"') && html.includes('id="dock-blocker"') && html.includes('id="dock-next-label"'), "dock summary fields describe bottom dock");
check("next action controls declare the content region they update", html.includes('id="primary-action"') && html.includes('id="dock-where-item" class="demo-bottom-item" href="#/work" aria-controls="screen-content"') && html.includes('id="dock-review-item" class="demo-bottom-item" href="#/review" aria-controls="screen-content"') && html.includes('id="dock-next"') && html.includes('aria-controls="screen-content"'), "screen-content controlled by action controls");
check("primary button resolver keeps setup and blocker precedence", primaryCommandResolverContractOk(), "empty -> create/list; missing next -> setup; blocked -> unblock/review; ready -> stored action");
check("pack-aware navigation keeps selected work context", source.includes("function routeLinkPackId(route)") && source.includes('item.setAttribute("href", formatRouteHash(item.dataset.route, routeLinkPackId(item.dataset.route)))') && source.includes('data-pack="${escapeAttribute(routeLinkPackId(route))}"'), "nav and route buttons preserve selected work ids");
check("browser title follows the current screen", source.includes("function updateDocumentTitle(screenTitle)") && source.includes('document.title = screenTitle === "Start" ? "Projects Portfolio Demo" : `${screenTitle} - Projects Portfolio Demo`;') && source.includes("updateDocumentTitle(screenTitle);"), "document title mirrors screen title with portfolio framing");
check("theme toggle keeps a stable pressed-button name", themeToggleContractOk(), "Dark mode name stays stable while title describes next action");
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

function routeTitlesContractOk() {
  return Object.entries(expectedRouteTitles).every(([route, title]) => routeContract[route]?.title === title);
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
    "reviewQueueStat(\"Missing action\", missingNextCount, \"Needs next action\")",
    "reviewQueueStat(\"Owner gaps\", ownerGapCount, \"Needs owner\")",
    "primaryCommandButton(firstReview)",
    "supportActionButton(\"set-next\", \"Set next action\", firstReview, \"btn\")"
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

function memoryNoteInputContractOk() {
  return includesAll(source, [
    'id="memory-note" class="demo-search-input" type="text"',
    'placeholder="Capture decision, source, or proof"',
    'autocomplete="off" aria-describedby="memory-note-help"',
    'id="memory-note-help" class="demo-field-help" aria-live="polite"',
    'button id="add-memory" class="btn btn-primary" type="button" aria-describedby="memory-note-help"'
  ]);
}

function dueDatePickerContractOk() {
  return includesAll(source, [
    'dateField("new-due", "Due", defaults.due',
    'dateField("edit-due", "Due", pack.due',
    'function dateField(id, label, value, help = "")',
    'type="date"',
    "dateFieldValue(value)"
  ]);
}

function dueDateDisplayContractOk() {
  const supportSummary = functionSource("supportDetailsSummary");
  const workSubtitle = functionSource("workDetailSubtitle");
  return includesAll(source, [
    "function dueDateMeta(pack)",
    "function dueDateLabel(value)",
    'const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");',
    '<time datetime="${date}">${dueDateLabel(date)}</time>',
    "supportDetailsSummary(showOwnerInline, pack)",
    "${dueDateMeta(pack)}"
  ]) && includesAll(supportSummary, [
    "const due = dueDateLabel(pack?.due);",
    "Open for optional ${ownerIsInline ? \"title\" : \"owner\"}, due date, and purpose."
  ]) && includesAll(workSubtitle, [
    "const due = dueDateLabel(pack.due);",
    "${duePrefix}Ready. Next action: ${command.label}."
  ]) && includesAll(styles, [
    ".demo-card-meta time"
  ]);
}

function sidebarNoteContractOk() {
  return includesAll(html, [
    'class="demo-sidebar-note card" role="note" aria-label="Demo idea and starting point"',
    "<strong>Review first.</strong>",
    "Start with Review. Pick a work item, see its blocker, run the next action."
  ]);
}

function brandHomeLinkContractOk() {
  return includesAll(html, [
    'class="demo-brand nav-rail-brand-link" href="#/home" aria-label="Projects portfolio demo home"',
    "<strong>Projects</strong>",
    "<small>Portfolio demo</small>"
  ]);
}

function metadataPreviewContractOk() {
  return html.includes('<meta name="description" content="Projects portfolio demo: pick work, see blockers, run the next action. Sample data only; no login or private project data.">')
    && html.includes("<title>Projects Portfolio Demo</title>")
    && !html.includes("Small Projects demo")
    && !html.includes("Small browser-local Projects demo")
    && !html.includes("browser-local Projects demo");
}

function demoNoticeContractOk() {
  return html.includes('<section id="demo-notice" class="demo-notice card" role="note" aria-label="Starting point and demo data notice">')
    && html.includes("Start with Review. Everything here is sample data. No login or private project data.");
}

function themeToggleContractOk() {
  return includesAll(html, [
    'id="theme-toggle"',
    'aria-pressed="false"'
  ]) && includesAll(source, [
    'THEMES = ["light", "dark", "forest", "ocean", "sepia"]',
    'toggle.textContent = "Theme"',
    'toggle.setAttribute("aria-pressed", String(theme !== "light"))'
  ]) && !source.includes('"Light mode"');
}

function emptyMemoryPlaceholderContractOk() {
  return html.includes('<strong id="command-memory-text">No memory yet</strong>')
    && (source.match(/: "No memory yet";/gu) || []).length === 3
    && !html.includes(">none yet")
    && !source.includes(': "none yet"')
    && !source.includes(': "none yet - add from Memory"')
    && !source.includes("Relevant Memory: none yet");
}

function blockedBySelectContractOk() {
  return includesAll(source, [
    'id="edit-blocked-by"',
    "Blocked by work item (optional)",
    "function blockedByChoices(",
    "candidate.id !== pack.id",
    'candidate.status !== "done"',
    "!createsBlockedByCycle(state.packs, pack.id, candidate.id)",
    "blockedByBlockerText(",
    "Choosing work fills the reason and clears it automatically when that work finishes with proof."
  ]);
}

function spotlightFactsContractOk() {
  return includesAll(source, [
    "function homeSpotlightFacts(pack, command)",
    "homeSpotlightFact(\"Where\", workTitle(pack))",
    "homeSpotlightFact(\"Blocker\", blockerTextForPack(pack))",
    "homeSpotlightFact(\"Next action\", command.label)",
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

function workCardTriadContractOk() {
  const start = source.indexOf("function workCard(pack)");
  const end = source.indexOf("\nfunction reviewCard(pack)", start);
  const body = start >= 0 ? source.slice(start, end > start ? end : undefined) : "";
  const factsIndex = body.indexOf("demo-card-facts");
  const commandIndex = body.indexOf("demo-command-row");
  return factsIndex >= 0
    && commandIndex > factsIndex
    && includesAll(body, [
      "cardFact(\"Where\", workTitle(pack))",
      "cardFact(\"Blocker\", blockerTextForPack(pack))",
      '`Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. ${dueDateLabel(pack.due) || "No due date"}.`',
      "${dueDateMeta(pack)}",
      "<span>${escapeHtml(pack.owner)}</span>"
    ])
    && !body.includes("`Blocker: ${blockerDisplayValue(pack.blocker)}`")
    && includesAll(styles, [
      ".demo-work-card .demo-card-facts",
      "margin-bottom: 12px;"
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

function workSearchContractOk() {
  return includesAll(source, [
    'aria-describedby="demo-search-summary"',
    'id="demo-search-summary" class="demo-status-line" role="status" aria-live="polite"',
    "function workToolbarSummary()",
    "placeholder=\"Search ${escapeAttribute(currentWork)} title, blocker, Next action, owner, or due date\"",
    "const haystack = `${pack.title} ${pack.next} ${pack.owner} ${pack.due} ${pack.blocker} ${pack.sources.join(\" \")}`.toLowerCase();"
  ]);
}

function mobileDockContractOk() {
  const mobileDockStart = styles.indexOf("scroll-padding-bottom: calc(156px + env(safe-area-inset-bottom));");
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
    "scroll-padding-bottom: calc(156px + env(safe-area-inset-bottom));",
    ".demo-bottom-brief",
    "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ".demo-bottom-next",
    "grid-column: 1 / -1;",
    ".demo-card-actions",
    ".demo-forward-actions",
    "scroll-margin-bottom: calc(156px + env(safe-area-inset-bottom));",
    "overflow-wrap: anywhere;",
    "white-space: normal;"
  ]);
}

function disabledButtonAffordanceContractOk() {
  return includesAll(styles, [
    '.btn:is(:disabled,[aria-disabled="true"])',
    "cursor: not-allowed;",
    '.btn-primary:is(:disabled,[aria-disabled="true"])'
  ]);
}

function primaryCommandResolverContractOk() {
  return includesInOrder(functionSource("resolvePrimaryCommandForPack"), [
    "if (!selected)",
    "state.packs.length === 0",
    'action: "open-create"',
    'action: "open-work-list"',
    "if (isMissingNextAction(selected))",
    'label: "Set next action"',
    'const action = commandActionForLabel(selected.next || "Open");',
    "if (hasBlocker(selected))",
    'action.action === "unblock"',
    'label: "Set Blocker: None"',
    'label: "Review blocker"',
    "return { ...action, targetPackId: selected.id };"
  ]);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function includesInOrder(text, needles) {
  let index = 0;
  for (const needle of needles) {
    index = text.indexOf(needle, index);
    if (index === -1) {
      return false;
    }
    index += needle.length;
  }
  return true;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function functionSource(name) {
  let match = null;
  visit(ast, (node) => {
    if (node.type === "FunctionDeclaration" && node.id?.name === name) {
      match = node;
    }
  });
  if (!match) {
    return "";
  }
  return source.slice(match.start, match.end);
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
  // Handle terser-minified booleans: !0 → true, !1 → false
  if (node?.type === "UnaryExpression" && node.operator === "!" && node.argument?.type === "Literal") {
    return !node.argument.value;
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
