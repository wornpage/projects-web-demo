const DEMO_STORAGE_KEY = "projects-static-demo-state-v6";
const LEGACY_DEMO_STORAGE_KEYS = [
  "projects-static-demo-state-v3",
  "projects-static-demo-state-v4",
  "projects-static-demo-state-v5"
];
const THEME_STORAGE_KEY = "projects-demo-theme-v2";
const DEMO_METADATA_FILE = "assets/demo-metadata.json";
const DEMO_REPO_URL = "https://github.com/jared-bidlow/projects-web-demo";
const DEMO_ISSUE_URL = `${DEMO_REPO_URL}/issues/new`;
const DEMO_RELEASE_NOTES_URL = `${DEMO_REPO_URL}/releases`;
const DEMO_DEFAULT_VERSION = "working";

const STYLE_AUDIT_ASSETS = [
  { id: "productCss", label: "Product CSS", path: "assets/app.css", type: "css" },
  { id: "demoCss", label: "Demo CSS", path: "assets/demo.css", type: "css" },
  { id: "demoJs", label: "Demo JS", path: "assets/demo.js", type: "js" }
];
const DEMO_COPY_LIMITS = Object.freeze({
  commandFlowVisible: 48,
  commandFlowHelp: 140,
  clipboardPayloadPreview: 1200,
  memoryVisible: 96,
  receiptVisible: 96,
  receiptHelp: 180,
  statusVisible: 96,
  statusHelp: 180
});

const state = {
  basePacks: [],
  packs: [],
  route: "home",
  selectedId: "",
  query: "",
  filter: "all",
  status: "Demo actions update this sample only.",
  copyProfile: "general",
  scenarioId: "default",
  metadata: null,
  styleAudit: null,
  pendingFocus: null,
  actionReceipt: null,
  clipboardReceipt: null,
  lastRenderedHash: "",
  memoryDraft: "",
  triageInput: "",
  triageRows: []
};

const ROUTE_CONTRACT = Object.freeze({
  home: { pattern: "#/home", title: "Command cockpit", commandSource: "route", navKey: "H", navLabel: "Home" },
  triage: { pattern: "#/triage", title: "Work triage tool", commandSource: "route", navKey: ">", navLabel: "Triage" },
  work: { pattern: "#/work/{packId}", title: "Work list", commandSource: "selected-work", acceptsPackId: true, navKey: "W", navLabel: "Work" },
  today: { pattern: "#/today/{packId}", title: "Today", commandSource: "selected-work", acceptsPackId: true, navKey: "T", navLabel: "Today" },
  board: { pattern: "#/board/{packId}", title: "Board", commandSource: "selected-work", acceptsPackId: true, navKey: "B", navLabel: "Board" },
  review: { pattern: "#/review/{packId}", title: "Review", commandSource: "selected-work", acceptsPackId: true, navKey: "R", navLabel: "Review" },
  focus: { pattern: "#/focus/{packId}", title: "Focus", commandSource: "selected-work", acceptsPackId: true, navKey: "F", navLabel: "Focus" },
  next: { pattern: "#/next/{packId}", title: "Next setup", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "N", navLabel: "Next" },
  check: { pattern: "#/check", title: "Check", commandSource: "route", navKey: "!", navLabel: "Check" },
  health: { pattern: "#/health", title: "Demo health", commandSource: "route", navKey: "L", navLabel: "Health" },
  search: { pattern: "#/search", title: "Search", commandSource: "route", navKey: "S", navLabel: "Search" },
  stats: { pattern: "#/stats", title: "Stats", commandSource: "route", navKey: "%", navLabel: "Stats" },
  notes: { pattern: "#/notes/{packId}", title: "Notes", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "N", navLabel: "Notes" },
  timeline: { pattern: "#/timeline", title: "Timeline", commandSource: "route", navKey: "-", navLabel: "Timeline" },
  files: { pattern: "#/files", title: "Files", commandSource: "route", navKey: "#", navLabel: "Files" },
  calendar: { pattern: "#/calendar/{packId}", title: "Calendar", commandSource: "selected-work", acceptsPackId: true, navKey: "D", navLabel: "Calendar" },
  create: { pattern: "#/create", title: "Create", commandSource: "route", navKey: "+", navLabel: "Create" },
  memory: { pattern: "#/memory/{packId}", title: "Memory", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "M", navLabel: "Memory" },
  lab: { pattern: "#/lab/{packId}", title: "Demo Lab", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "A", navLabel: "Lab" },
  meta: { pattern: "#/meta", title: "Meta", commandSource: "route", navKey: "I", navLabel: "Meta" },
  feedback: { pattern: "#/feedback", title: "Feedback", commandSource: "route", navKey: "?", navLabel: "Feedback" },
  settings: { pattern: "#/settings", title: "Settings", commandSource: "route", navKey: "...", navLabel: "Settings" },
  pack: { pattern: "#/pack/{packId}", title: "Work path", commandSource: "selected-work", acceptsPackId: true }
});

const NAV_ROUTE_IDS = Object.freeze([
  "home",
  "triage",
  "work",
  "today",
  "board",
  "review",
  "focus",
  "next",
  "check",
  "health",
  "search",
  "stats",
  "notes",
  "timeline",
  "files",
  "calendar",
  "create",
  "memory",
  "lab",
  "meta",
  "feedback",
  "settings"
]);

const navItems = Object.freeze(NAV_ROUTE_IDS.map((route) => {
  const contract = ROUTE_CONTRACT[route];
  return Object.freeze([route, contract.navKey, contract.navLabel]);
}));

const filters = [
  ["all", "All"],
  ["active", "Active"],
  ["blocked", "Blocked"],
  ["draft", "Draft"],
  ["done", "Done"],
  ["review", "Review"]
];

const copyProfiles = {
  general: { work: "work", newWork: "New work", result: "Result", sources: "Sources" },
  dj: { work: "gig", newWork: "Book gig", result: "Set recording", sources: "Sample packs" },
  developer: { work: "task", newWork: "New task", result: "PR or commit", sources: "Repos and docs" },
  climate: { work: "site check", newWork: "New check", result: "Finding", sources: "Datasets and notes" }
};

const DEMO_SCENARIOS = [
  {
    id: "default",
    label: "Default",
    description: "Balanced sample flow with mixed states, review and done states.",
    profile: "general",
    route: "home",
    filter: "all",
    transform: (packs) => structuredClone(packs)
  },
  {
    id: "review",
    label: "Review-first",
    description: "Focus this run on the review queue for validation testing.",
    profile: "developer",
    route: "review",
    filter: "review",
    transform: (packs) => packs.map((pack) => pack.status === "done"
      ? pack
      : {
          ...pack,
          blocker: pack.blocker === "none" ? "Needs review context" : pack.blocker,
          next: "Review",
          status: "blocked"
        })
  },
  {
    id: "healthy",
    label: "Healthy queue",
    description: "Normalize blockers and next actions to reduce friction in the demo.",
    profile: "general",
    route: "work",
    filter: "active",
    transform: (packs) => packs.map((pack) => pack.status === "done"
      ? pack
      : {
          ...pack,
          blocker: "none",
          next: pack.next === "Choose next action" || !pack.next ? "Open" : pack.next,
          status: pack.status === "draft" ? "active" : pack.status
        })
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Compact first-run sample set with clear labels and actions.",
    profile: "climate",
    route: "home",
    filter: "all",
    transform: (packs) => packs
      .slice()
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, 5)
      .map((pack) => ({
        ...pack,
        owner: pack.owner === "No owner" ? "Owner pending" : pack.owner
      }))
  },
  {
    id: "due-view",
    label: "Due today",
    description: "Shift active samples to today for calendar and today routes.",
    profile: "general",
    route: "today",
    filter: "active",
    transform: (packs) => packs.map((pack) => pack.status === "done"
      ? pack
      : {
          ...pack,
          due: todayIsoDate()
        })
  },
  {
    id: "empty",
    label: "Empty state",
    description: "Show how disabled controls explain what to do when no sample work is loaded.",
    profile: "general",
    route: "review",
    filter: "all",
    transform: () => []
  }
];

const DEMO_SCENARIO_BY_ID = Object.fromEntries(DEMO_SCENARIOS.map((scenario) => [scenario.id, scenario]));

const el = (id) => document.getElementById(id);
const launchParams = new URLSearchParams(location.search);

document.addEventListener("DOMContentLoaded", async () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  initTheme();
  purgeLegacyDemoState();
  bindShellControls();
  renderNav();

  try {
    const [metadata, packsResponse, styleAudit] = await Promise.all([
      fetch(DEMO_METADATA_FILE, { cache: "no-store" }).catch(() => null),
      fetch("data/demo-packs.json", { cache: "no-store" }),
      collectStyleAudit()
    ]);
    if (!packsResponse.ok) {
      throw new Error(`Demo data failed with ${packsResponse.status}`);
    }

    state.basePacks = await packsResponse.json();
    const parsedMetadata = metadata && safeJson(await metadata.text());
    state.metadata = buildMetadata(parsedMetadata);
    state.styleAudit = styleAudit;
    loadState();
    applyLaunchConfiguration();
    routeFromHash();
    render();
  } catch (error) {
    state.status = routeStatus("Demo", "static JSON could not load", "refresh");
    updateCommand({
      title: "Demo unavailable",
      where: "Demo",
      blocker: "static JSON could not load",
      next: "Refresh",
      stateText: "Offline",
      scope: "Scope: no sample work is visible."
    });
    el("screen-content").innerHTML = `<div class="demo-empty">${escapeHtml(error.message)}</div>`;
  }
});

window.addEventListener("hashchange", () => {
  routeFromHash();
  render();
});

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const dark = saved ? saved === "dark" : false;
  setTheme(dark);
  el("theme-toggle").addEventListener("click", () => {
    setTheme(!document.documentElement.classList.contains("dark"));
  });
}

function setTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  el("theme-toggle").textContent = dark ? "Light mode" : "Dark mode";
  el("theme-toggle").setAttribute("aria-pressed", String(dark));
  localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
}

function bindShellControls() {
  el("primary-action").addEventListener("click", (event) => {
    queueFocus(focusKindForAction(event.currentTarget.dataset.action), event.currentTarget.dataset.pack || state.selectedId);
    runPrimaryAction(event.currentTarget);
  });
  el("secondary-action").addEventListener("click", () => go("focus", state.selectedId, "where"));
  el("dock-next").addEventListener("click", (event) => {
    queueFocus(focusKindForAction(event.currentTarget.dataset.action), event.currentTarget.dataset.pack || state.selectedId);
    runPrimaryAction(event.currentTarget);
  });

  el("dock-where-item")?.addEventListener("click", (event) => {
    event.preventDefault();
    const pack = currentPack() || state.packs[0];
    go("work", pack?.id || "", "where");
  });

  el("dock-review-item")?.addEventListener("click", (event) => {
    event.preventDefault();
    const pack = currentPack() && isReview(currentPack())
      ? currentPack()
      : preferredReviewPack();
    go("review", pack?.id || "", "blocker");
  });
}

function loadState() {
  const saved = safeJson(localStorage.getItem(DEMO_STORAGE_KEY));
  state.packs = Array.isArray(saved?.packs) ? saved.packs : structuredClone(state.basePacks);
  state.copyProfile = saved?.copyProfile || "general";
  state.scenarioId = saved?.scenarioId || "default";
  state.filter = saved?.filter || "all";
  state.query = saved?.query || "";
  state.selectedId = saved?.selectedId || state.packs[0]?.id || "";
  state.status = saved?.status || state.status;
  state.actionReceipt = normalizeActionReceipt(saved?.actionReceipt);
  state.triageInput = typeof saved?.triageInput === "string" ? saved.triageInput : defaultTriageInput();
  state.triageRows = Array.isArray(saved?.triageRows) ? saved.triageRows : [];
}

function purgeLegacyDemoState() {
  for (const key of LEGACY_DEMO_STORAGE_KEYS) {
    try {
      if (key !== DEMO_STORAGE_KEY && localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    } catch {
      // LocalStorage access can be restricted in some embedded contexts.
    }
  }
}

function applyLaunchConfiguration() {
  const profileParam = launchParams.get("profile");
  if (profileParam && copyProfiles[profileParam]) {
    state.copyProfile = profileParam;
    state.status = profileStatus(profileParam, "URL");
  }

  const scenarioParam = launchParams.get("scenario");
  if (scenarioParam && DEMO_SCENARIO_BY_ID[scenarioParam]) {
    state.route = DEMO_SCENARIO_BY_ID[scenarioParam].route || state.route;
    applyScenario(DEMO_SCENARIO_BY_ID[scenarioParam], { force: true });
  } else if (!Array.isArray(state.packs) || state.packs.length === 0) {
    applyScenario(DEMO_SCENARIO_BY_ID.default);
  } else if (!DEMO_SCENARIO_BY_ID[state.scenarioId]) {
    state.scenarioId = "default";
  }

  if (!state.metadata) {
    state.metadata = buildMetadata(null);
  }
}

function applyScenario(scenario, options = {}) {
  const current = DEMO_SCENARIO_BY_ID[scenario?.id] || DEMO_SCENARIO_BY_ID.default;
  const force = options.force ?? false;

  const next = current.transform(structuredClone(state.basePacks));
  state.packs = next;
  state.scenarioId = current.id;
  state.filter = current.filter || "all";
  state.copyProfile = current.profile || state.copyProfile;
  state.query = "";
  state.selectedId = state.packs[0]?.id || "";
  state.actionReceipt = null;
  state.clipboardReceipt = null;
  if (force || options.skipSave) {
    state.status = scenarioStatus(current);
  }
  if (current.route && options.applyRoute) {
    state.route = current.route;
  }
  syncSearchParam("scenario", current.id);
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
    packs: state.packs,
    copyProfile: state.copyProfile,
    scenarioId: state.scenarioId,
    selectedId: state.selectedId,
    status: state.status,
    actionReceipt: state.actionReceipt,
    filter: state.filter,
    query: state.query,
    triageInput: state.triageInput,
    triageRows: state.triageRows
  }));
}

function resetState() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  purgeLegacyDemoState();
  state.packs = structuredClone(state.basePacks);
  state.copyProfile = "general";
  state.scenarioId = "default";
  state.selectedId = state.packs[0]?.id || "";
  state.query = "";
  state.filter = "all";
  state.triageInput = defaultTriageInput();
  state.triageRows = [];
  state.status = resetDemoStatus();
  state.actionReceipt = null;
  state.clipboardReceipt = null;
  syncSearchParam("scenario", null);
  render();
}

function profileStatus(profileKey, source = "Settings") {
  const value = copyProfiles[profileKey] || copyProfiles.general;
  const label = capitalize(copyProfiles[profileKey] ? profileKey : "general");
  return `Where: ${source}. Blocker: none. Button runs next: use ${label} copy labels for ${value.work}.`;
}

function scenarioStatus(scenario) {
  const current = DEMO_SCENARIO_BY_ID[scenario?.id] || DEMO_SCENARIO_BY_ID.default;
  const routeTitle = ROUTE_CONTRACT[current.route]?.title || "demo route";
  return `Where: Scenario ${current.label}. Blocker: none. Button runs next: open ${routeTitle}.`;
}

function resetDemoStatus() {
  return "Where: Settings. Blocker: none. Button runs next: review reset browser-only sample data.";
}

function routeStatus(where, blocker, next) {
  return `Where: ${where}. Blocker: ${blocker}. Button runs next: ${next}.`;
}

function renderNav() {
  el("demo-nav").innerHTML = navItems.map(([route, key, label]) => `
    <a class="demo-nav-item nav-rail-btn" href="${escapeAttribute(formatRouteHash(route))}" data-route="${route}">
      <span class="nav-rail-icon" aria-hidden="true">${escapeHtml(key)}</span>
      <strong>${escapeHtml(label)}</strong>
    </a>
  `).join("");
}

function routeFromHash() {
  const parsedRoute = parseHashRoute(location.hash);
  state.route = parsedRoute.route;

  if (parsedRoute.packId) {
    state.selectedId = parsedRoute.packId;
  } else if (state.route === "review") {
    state.selectedId = preferredReviewPack()?.id || state.selectedId;
  } else if (state.route === "next") {
    state.selectedId = preferredNextSetupPack()?.id || state.selectedId;
  }
}

function go(route, id = "", focusKind = "") {
  if (focusKind) {
    queueFocus(focusKind, id || state.selectedId);
  }

  const nextHash = formatRouteHash(route, id);
  if (location.hash === nextHash) {
    routeFromHash();
    render();
    return;
  }

  location.hash = nextHash;
}

function parseHashRoute(hash) {
  const rawHash = (hash || "#/home").replace(/^#\/?/, "");
  const [rawRoute, rawPackId = "", ...extraSegments] = rawHash.split("/");
  const route = isKnownRoute(rawRoute) ? rawRoute : "home";
  const routeContract = ROUTE_CONTRACT[route] || ROUTE_CONTRACT.home;
  const decodedPackId = routeContract.acceptsPackId && rawPackId
    ? decodeRoutePackId(rawPackId)
    : { value: "", malformed: false };

  return {
    route,
    requestedRoute: rawRoute || "home",
    packId: decodedPackId.value,
    fallback: Boolean(rawRoute && rawRoute !== route),
    malformedPackId: decodedPackId.malformed,
    unexpectedPackId: Boolean(rawPackId && !routeContract.acceptsPackId),
    extraSegments,
    pattern: routeContract.pattern,
    commandSource: routeContract.commandSource
  };
}

function formatRouteHash(route, id = "") {
  const routeKey = isKnownRoute(route) ? route : "home";
  const routeContract = ROUTE_CONTRACT[routeKey] || ROUTE_CONTRACT.home;
  if (routeContract.acceptsPackId && id) {
    return routeContract.pattern.replace("{packId}", encodeURIComponent(id));
  }

  return routeContract.pattern.replace("/{packId}", "");
}

function isKnownRoute(route) {
  return Boolean(ROUTE_CONTRACT[route]);
}

function decodeRoutePackId(value) {
  try {
    return { value: decodeURIComponent(value), malformed: false };
  } catch {
    return { value: "", malformed: true };
  }
}

function render() {
  const previousHash = state.lastRenderedHash;
  const currentHash = location.hash || `#/${state.route}`;
  const shouldResetScroll = Boolean(previousHash !== currentHash && !state.pendingFocus);

  if (!state.packs.find((pack) => pack.id === state.selectedId)) {
    state.selectedId = state.packs[0]?.id || "";
  }

  const versionElement = el("demo-version");
  if (versionElement) {
    versionElement.textContent = stateVersionLabel();
  }
  const stateSchemaElement = el("demo-state-schema");
  if (stateSchemaElement) {
    stateSchemaElement.textContent = storageStateLabel();
  }
  const changelogElement = el("demo-changelog");
  if (changelogElement) {
    changelogElement.href = state.metadata?.releaseNotesUrl || DEMO_RELEASE_NOTES_URL;
    changelogElement.textContent = `Changelog (${state.metadata?.version || DEMO_DEFAULT_VERSION})`;
  }

  document.querySelectorAll(".demo-nav-item").forEach((item) => {
    const isActive = item.dataset.route === state.route;
    item.classList.toggle("active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  const screenTitle = screenTitleForRoute();
  el("screen-title").textContent = screenTitle;
  renderCommand(currentPack());

  switch (state.route) {
    case "health":
      renderHealth();
      break;
    case "home":
      renderHome();
      break;
    case "triage":
      renderTriage();
      break;
    case "today":
      renderToday();
      break;
    case "board":
      renderBoard();
      break;
    case "review":
      renderReview();
      break;
    case "focus":
      renderFocus();
      break;
    case "next":
      renderNext();
      break;
    case "check":
      renderCheck();
      break;
    case "search":
      renderSearch();
      break;
    case "stats":
      renderStats();
      break;
    case "notes":
      renderNotes();
      break;
    case "timeline":
      renderTimeline();
      break;
    case "files":
      renderFiles();
      break;
    case "calendar":
      renderCalendar();
      break;
    case "create":
      renderCreate();
      break;
    case "memory":
      renderMemory();
      break;
    case "lab":
      renderLab();
      break;
    case "settings":
      renderSettings();
      break;
    case "feedback":
      renderFeedback();
      break;
    case "meta":
      renderMeta();
      break;
    case "pack":
      renderPackDetail();
      break;
    case "work":
    default:
      renderWork();
      break;
  }

  bindClipboardReceiptControls();

  if (shouldResetScroll) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  applyPendingFocus();
  state.lastRenderedHash = currentHash;
  saveState();
}

function screenTitleForRoute() {
  const profile = copyProfiles[state.copyProfile] || copyProfiles.general;
  if (state.route === "create") {
    return profile.newWork;
  }

  return ROUTE_CONTRACT[state.route]?.title || ROUTE_CONTRACT.work.title;
}

function renderCommand(selected) {
  const visibleCount = filteredPacks().length;
  const reviewCount = state.packs.filter(isReview).length;
  const command = commandForRoute(selected, visibleCount, reviewCount);
  updateCommand(command);
}

function commandForRoute(selected, visibleCount, reviewCount) {
  const triageCount = state.triageRows.length;
  const triageBlockers = state.triageRows.filter((row) => row.blocker && row.blocker !== "none").length;
  const triageAction = triageCount > 0 ? "copy-triage" : "parse-triage";
  const triageNext = triageCount > 0 ? "Copy snapshot" : "Parse work";
  const reviewSummary = reviewCount > 0
    ? `${reviewCount} sample item(s) need review`
    : "none";
  const reviewTarget = preferredReviewPack();
  const selectedWorkCommand = selectedPackCommand(selected);
  const selectedWorkReadyCommand = {
    ...selectedWorkCommand,
    stateText: "Ready"
  };

  const routeCommands = {
    home: { title: "Command cockpit", where: "Home", blocker: reviewSummary, next: "Review work", stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" },
    triage: { title: "Triage tool command flow", where: "Triage tool", blocker: triageCount > 0 ? `${triageBlockers} blocker(s) visible in ${triageCount} row(s)` : "paste work to classify", next: triageNext, stateText: "Tool", action: triageAction, targetPackId: "" },
    work: { title: "Work list command flow", ...selectedWorkCommand },
    today: { title: "Today command flow", ...selectedWorkCommand },
    board: { title: "Board command flow", ...selectedWorkCommand },
    review: { title: "Review command flow", ...selectedWorkCommand },
    focus: { title: "Focus command flow", ...selectedWorkCommand, stateText: "Focus" },
    next: { title: "Next setup command flow", ...selectedWorkReadyCommand },
    check: { title: "Check command flow", where: "Check", blocker: `${reviewCount} sample item(s) still need decisions`, next: "Validate sample", stateText: "Ready", action: "validate-sample", targetPackId: "" },
    search: { title: "Search command flow", where: "Search", blocker: "type title, owner, next action, or due date", next: "Search", stateText: "Ready", action: "search-demo", targetPackId: "" },
    stats: { title: "Stats command flow", where: "Stats", blocker: "sample counts are calculated in this demo", next: "Review work", stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" },
    notes: { title: "Notes command flow", where: "Notes", blocker: "sample notes stay with this browser", next: "Add note", stateText: "Ready", action: "add-note", targetPackId: selectedWorkCommand.targetPackId },
    timeline: { title: "Timeline command flow", where: "Timeline", blocker: "sample activity stays with this browser", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    files: { title: "Files command flow", where: "Files", blocker: "sample sources are references only", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    calendar: { title: "Calendar command flow", ...selectedWorkCommand },
    create: { title: "Create command flow", where: "Create", blocker: "required fields are title, owner, and Button runs next", next: "Save sample", stateText: "Draft", action: "create-sample", targetPackId: "" },
    memory: { title: "Memory command flow", where: selectedWorkCommand.where, blocker: "sample notes stay with this browser", next: "Add note", stateText: "Ready", action: "add-note", targetPackId: selectedWorkCommand.targetPackId },
    lab: { title: "Demo Lab command flow", ...selectedWorkCommand, stateText: "Lab" },
    meta: { title: "Meta command flow", where: "Meta", blocker: "product view and diagnostics are computed locally", next: "Refresh", stateText: "Ready", action: "refresh-meta", targetPackId: "" },
    feedback: { title: "Feedback command flow", where: "Feedback", blocker: `Version ${stateVersionLabel()} is active`, next: "Report feedback", stateText: "Ready", action: "report-feedback", targetPackId: "" },
    health: { title: "Health command flow", where: "Health", blocker: "route, storage, data, and metadata checks are running", next: "Refresh", stateText: "Ready", action: "refresh-health", targetPackId: "" },
    settings: { title: "Settings command flow", where: "Settings", blocker: "copy profile changes labels only in this static demo", next: "Apply profile", stateText: "Ready", action: "apply-profile", targetPackId: "" },
    pack: { title: "Work path command flow", ...selectedWorkCommand }
  };

  const selectedFlow = selected ? `Flow: ${selected.title}` : "";
  const selectedBlocker = selected ? blockerTextForPack(selected) : "";
  const selectedAction = selected ? resolvePrimaryCommandForPack(selected).label : "";
  const selectedActionFlow = selectedFlow && selectedAction
    ? `${selectedFlow} -> ${selectedBlocker || "clear"} -> ${selectedAction}.`
    : "Flow: ";

  const routeCommandsHints = {
    home: "Flow: review work, then run the action.",
    work: selectedActionFlow ? `${selectedActionFlow}` : "Flow: choose work, then run action.",
    today: selectedActionFlow ? `${selectedActionFlow}` : "Flow: due work, then action.",
    board: selectedActionFlow ? `${selectedActionFlow}` : "Flow: status, work, action.",
    review: selectedActionFlow
      ? `${selectedFlow} -> resolve blocker.`
      : "Flow: resolve blockers first.",
    focus: selectedActionFlow
      ? `${selectedActionFlow}`
      : "Flow: confirm forward path, then act.",
    next: "Flow: set action, return, run.",
    check: "Flow: validate sample, fix gaps.",
    search: "Flow: search, open work, act.",
    stats: "Flow: summary, then work.",
    notes: selected
      ? `${selectedActionFlow}`
      : "Flow: note, then action.",
    timeline: selected
      ? `${selectedActionFlow}`
      : "Flow: activity, then action.",
    calendar: selected
      ? `${selectedActionFlow}`
      : "Flow: due date, then action.",
    files: selected
      ? `${selectedActionFlow}`
      : "Flow: sources, then action.",
    memory: selected
      ? `${selectedActionFlow}`
      : "Flow: memory, then action.",
    lab: selected
      ? `${selectedActionFlow}`
      : "Flow: compare, then action.",
    pack: selected ? `${selectedActionFlow}` : "Flow: review, then action.",
    create: "Flow: create, review, act.",
    meta: "Flow: inspect, copy diagnostics.",
    feedback: "Flow: copy context, report.",
    health: "Flow: verify, return to work.",
    settings: "Flow: choose profile, apply.",
    settingsProfile: "Flow: choose profile, apply.",
    settingsScenario: "Flow: choose scenario, continue."
  };

  const routeCommand = routeCommands[state.route] || routeCommands.work;
  return {
    ...routeCommand,
    stateText: capitalize(routeCommand.stateText),
    scope: `Scope: ${visibleCount} of ${state.packs.length} sample work items visible.`,
    targetPackId: routeCommand.targetPackId || "",
    flowHint: routeCommandsHints[state.route] || routeCommandsHints.work
  };
}

function selectedPackCommand(selected) {
  const resolvedAction = resolvePrimaryCommandForPack(selected);
  return {
    where: selected?.title || "No sample work selected",
    blocker: blockerTextForPack(selected),
    next: resolvedAction.label,
    stateText: selected?.status || "Ready",
    action: resolvedAction.action,
    targetPackId: resolvedAction.targetPackId,
    memory: latestRelevantMemory(selected)
  };
}

function resolvePrimaryCommandForPack(selected) {
  if (!selected) {
    return { label: "Open work list", action: "open-work-list", targetPackId: "" };
  }

  if (isMissingNextAction(selected)) {
    return { label: "Set Button runs next", action: "set-next", targetPackId: selected.id };
  }

  const action = commandActionForLabel(selected.next || "Open");
  if (hasBlocker(selected)) {
    if (action.action === "unblock") {
      return { label: "Unblock", action: "unblock", targetPackId: selected.id };
    }

    return { label: "Review blocker", action: "review", targetPackId: selected.id };
  }

  return { ...action, targetPackId: selected.id };
}

function updateCommand(command) {
  el("command-title").textContent = command.title;
  el("command-where").textContent = command.where;
  el("command-blocker").textContent = command.blocker;
  el("command-next").textContent = command.next;
  el("command-state").textContent = command.stateText;
  el("command-scope").textContent = command.scope;
  if (el("command-flow")) {
    const flowHint = command.flowHint || "Select work, then run action.";
    el("command-flow").textContent = visibleCopy(flowHint, DEMO_COPY_LIMITS.commandFlowVisible);
    el("command-flow").title = helpCopy(flowHint, DEMO_COPY_LIMITS.commandFlowHelp);
    el("command-flow").setAttribute("aria-label", helpCopy(flowHint, DEMO_COPY_LIMITS.commandFlowHelp));
  }
  updateCommandWorkPath(command);
  const commandMemory = normalizeCopy(command.memory);
  const commandMemoryElement = el("command-memory");
  if (commandMemoryElement) {
    commandMemoryElement.hidden = !commandMemory;
    commandMemoryElement.title = commandMemory ? `Relevant Memory: ${commandMemory}` : "";
    commandMemoryElement.setAttribute("aria-label", commandMemory ? `Relevant Memory: ${commandMemory}` : "No relevant memory for selected work.");
  }
  if (el("command-memory-text")) {
    el("command-memory-text").textContent = commandMemory ? visibleCopy(commandMemory, DEMO_COPY_LIMITS.memoryVisible) : "No memory yet.";
  }
  el("primary-action").textContent = command.next;
  el("primary-action").dataset.action = command.action || "";
  el("primary-action").dataset.pack = command.targetPackId || "";
  el("primary-action").setAttribute("aria-label", commandRunLabel(command));
  el("primary-action").title = commandRunLabel(command);
  el("secondary-action").setAttribute("aria-label", secondaryRunLabel(command));
  el("secondary-action").title = secondaryRunLabel(command);
  el("dock-where").textContent = command.where;
  el("dock-blocker").textContent = command.blocker;
  el("dock-next-label").textContent = command.next;
  el("dock-next").dataset.action = command.action || "";
  el("dock-next").dataset.pack = command.targetPackId || "";
  el("dock-next").setAttribute("aria-label", commandRunLabel(command));
  el("dock-next").title = commandRunLabel(command);
  updateActionReceipt();
}

function updateCommandWorkPath(command) {
  const path = el("command-work-path");
  if (!path) return;

  const steps = commandWorkPathSteps(command);
  if (!steps.length) {
    path.hidden = true;
    path.innerHTML = "";
    return;
  }

  const detail = commandWorkPathDetail(command, findPack(command.targetPackId) || currentPack());
  const aria = helpCopy(
    `Path now: ${steps.map((step) => `${step.label}${step.active ? " current" : ""}`).join(", ")}. ${detail}`,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
  path.hidden = false;
  path.title = aria;
  path.setAttribute("aria-label", aria);
  path.innerHTML = `
    <span class="section-label">Path now</span>
    <div class="demo-work-path-steps">
      ${steps.map((step) => `<span class="demo-work-path-step${step.active ? " active" : ""}" title="${escapeAttribute(step.help)}" aria-current="${step.active ? "step" : "false"}">${escapeHtml(step.label)}</span>`).join("")}
    </div>
    <strong>${escapeHtml(detail)}</strong>`;
}

function commandWorkPathSteps(command) {
  const pack = findPack(command.targetPackId) || currentPack();
  if (!pack) {
    return [
      { id: "where", label: "Where", active: true, help: `Where: ${command.where}.` },
      { id: "blocker", label: "Blocker", active: false, help: `Blocker: ${command.blocker}.` },
      { id: "next", label: "Run", active: false, help: `Button runs next: ${command.next}.` }
    ];
  }

  const stage = workPathStage(pack, { label: command.next, action: command.action, targetPackId: command.targetPackId });
  return workPathSteps().map((step) => ({
    ...step,
    active: step.id === stage
  }));
}

function commandWorkPathDetail(command, pack) {
  if (pack) {
    return `Proof: ${visibleCopy(proofTargetForPack(pack), DEMO_COPY_LIMITS.commandFlowVisible)}`;
  }

  return `Next: ${visibleCopy(command.next, DEMO_COPY_LIMITS.commandFlowVisible)}`;
}

function commandRunLabel(command) {
  const memory = normalizeCopy(command.memory);
  const memoryCopy = memory ? ` Relevant Memory: ${memory}.` : "";
  return helpCopy(
    `Where: ${command.where}. Blocker: ${command.blocker}. Button runs next: ${command.next}.${memoryCopy}`,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
}

function secondaryRunLabel(command) {
  return helpCopy(
    `Focus selected work. Where: ${command.where}. Blocker: ${command.blocker}.`,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
}

function queueFocus(kind, packId = "") {
  state.pendingFocus = {
    kind,
    packId: packId || state.selectedId || ""
  };
}

function applyPendingFocus() {
  if (!state.pendingFocus) {
    return;
  }

  const target = state.pendingFocus;
  state.pendingFocus = null;
  requestAnimationFrame(() => {
    focusCommandTarget(target.kind, target.packId);
  });
}

function focusCommandTarget(kind, packId = "") {
  const pack = findPack(packId) || currentPack();
  const id = pack?.id || packId || "";
  if (kind === "support-owner") {
    document.querySelector('[data-support-details="pack-detail"]')?.setAttribute("open", "");
  }

  const selectors = focusSelectors(kind, id);
  const target = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!target) {
    return;
  }

  focusAndPulse(target);
}

function focusSelectors(kind, packId) {
  const id = cssIdent(packId);
  if (kind === "where") {
    return [
      `.demo-work-card[data-pack-id="${id}"]`,
      `.demo-review-card[data-pack-id="${id}"]`,
      `.demo-row[data-pack-id="${id}"]`,
      "#command-where"
    ];
  }

  if (kind === "blocker") {
    return [
      `.demo-review-card[data-pack-id="${id}"] [data-command-field="blocker"]`,
      `.demo-review-card[data-pack-id="${id}"]`,
      "#command-blocker"
    ];
  }

  if (kind === "next") {
    return [
      "#next-action-choice",
      `#next-${id}`,
      `.demo-work-card[data-pack-id="${id}"] [data-action="run-next"]`,
      "#edit-next",
      "#primary-action",
      "#command-next"
    ];
  }

  if (kind === "card-result") {
    return [
      `[data-card-receipt="${id}"]`,
      `[data-route-receipt="${id}"]`,
      "#command-receipt",
      `.demo-work-card[data-pack-id="${id}"]`,
      `.demo-review-card[data-pack-id="${id}"]`
    ];
  }

  if (kind === "triage-input") {
    return ["#triage-input"];
  }

  if (kind === "triage-output") {
    return ["#triage-output", ".demo-triage-card", "#triage-snapshot"];
  }

  if (kind === "memory-note") {
    return ["#memory-note", "#memory-note-help", "#add-memory"];
  }

  if (kind === "pack-edit") {
    return [
      "#edit-title",
      "#pack-edit-form",
      "#edit-next",
      "#edit-status",
      ".demo-edit-panel"
    ];
  }

  if (kind === "pack-blocker") {
    return [
      "#edit-blocker",
      "#pack-edit-form",
      "#command-blocker"
    ];
  }

  if (kind === "support-owner") {
    return [
      "#edit-owner",
      '[data-support-details="pack-detail"]',
      "#pack-edit-form"
    ];
  }

  if (kind === "pack-detail") {
    return [
      "#pack-detail-title",
      "#pack-edit-form",
      ".demo-edit-panel"
    ];
  }

  return ["#primary-action"];
}

function focusAndPulse(target) {
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  if (!isFocusable(target)) {
    target.setAttribute("tabindex", "-1");
  }

  target.focus({ preventScroll: true });
  target.classList.remove("demo-focus-pulse");
  void target.offsetWidth;
  target.classList.add("demo-focus-pulse");
  window.setTimeout(() => {
    target.classList.remove("demo-focus-pulse");
  }, 1800);
}

function isFocusable(target) {
  return target.matches("a, button, input, select, textarea, [tabindex]");
}

function focusKindForAction(action) {
  if (action === "parse-triage" || action === "copy-triage") {
    return "triage-output";
  }

  if (action === "set-next" || action === "focus" || action === "start" || action === "done" || action === "unblock") {
    return "next";
  }

  if (action === "open") {
    return "pack-detail";
  }

  if (action === "review") {
    return "blocker";
  }

  if (action === "add-note") {
    return "memory-note";
  }

  if (action === "edit") {
    return "pack-edit";
  }

  return "where";
}

function renderHome() {
  const reviewCount = state.packs.filter(isReview).length;
  const doneCount = state.packs.filter((pack) => pack.status === "done").length;
  const scenario = DEMO_SCENARIO_BY_ID[state.scenarioId] || DEMO_SCENARIO_BY_ID.default;
  el("screen-content").innerHTML = `
    <div class="kpi-strip demo-grid demo-summary-strip">
      ${metricCard("Visible work", state.packs.length, "Sample packs in this demo.")}
      ${metricCard("Review", reviewCount, "Items with blockers or missing next actions.")}
      ${metricCard("Done", doneCount, "Finished sample work.")}
    </div>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Start here</span>
          <h2>Move from brief to action</h2>
        </div>
        ${navButton("review", "Review work", "btn btn-primary")}
      </div>
      <p>The demo shows the public-safe shape of Projects: pick work, read Where / Blocker / Button runs next, then run a simulated action.</p>
      <div class="demo-quick-actions">
        ${navButton("work", "Open work list")}
        ${navButton("triage", "Open triage tool")}
        ${navButton("today", "Open today")}
        ${navButton("lab", "Open lab")}
        ${navButton("meta", "Open meta")}
        ${navButton("create", "Create sample")}
        ${navButton("settings", "Change copy profile")}
        ${navButton("feedback", "Report feedback")}
      </div>
      <div class="demo-meta-row" aria-label="Active scenario">
        <span>Active scenario: <strong>${escapeHtml(scenario.label)}</strong></span>
        <span>${escapeHtml(scenario.description)}</span>
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Scenarios</span>
          <h2>Choose a quick start</h2>
        </div>
        <span class="demo-status">Scenario: ${escapeHtml(state.scenarioId)} / Profile: ${escapeHtml(state.copyProfile)}</span>
      </div>
      <div class="demo-scenario-grid">
        ${DEMO_SCENARIOS.map((item) => `
          <button type="button" class="demo-scenario-card" data-scenario="${escapeAttribute(item.id)}" aria-pressed="${state.scenarioId === item.id}"${controlLabelAttributes(scenarioCardHelp(item, state.scenarioId === item.id))}>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </button>
        `).join("")}
      </div>
    </section>
    ${recentActivityPanel()}
  `;
  bindGoButtons();
  bindScenarioCards();
}

function renderTriage() {
  const rows = normalizedTriageRows();
  const blockerCount = rows.filter((row) => row.blocker && row.blocker !== "none").length;
  const clearNextCount = rows.filter((row) => row.next && !isPlaceholderNext(row.next)).length;
  const snapshot = collectTriageSnapshot(rows);
  const parseHelp = triageParseHelp(rows);
  const addRowHelp = triageAddRowHelp();
  const resetHelp = triageResetHelp();
  const copyMarkdownHelp = triageCopyMarkdownHelp(rows);
  const copyJsonHelp = triageCopyJsonHelp(rows);

  el("screen-content").innerHTML = `
    <div class="kpi-strip demo-grid demo-summary-strip">
      ${metricCard("Rows", rows.length, "Work items shaped from pasted text.")}
      ${metricCard("Blockers", blockerCount, "Rows that need review before action.")}
      ${metricCard("Clear next", clearNextCount, "Rows with a concrete Button runs next.")}
    </div>
    <section class="demo-panel demo-triage-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Button Runs Next</span>
          <h2>Work triage tool</h2>
        </div>
        <span class="demo-status">browser-local</span>
      </div>
      <div class="demo-triage-layout">
        <div class="demo-triage-input">
          <label class="demo-field demo-field-wide" for="triage-input">
            <span>Messy work</span>
            <textarea id="triage-input" rows="10">${escapeHtml(state.triageInput || defaultTriageInput())}</textarea>
          </label>
          <div class="demo-card-actions">
            <span id="parse-triage-help" class="sr-only">${escapeHtml(parseHelp)}</span>
            <span id="add-triage-row-help" class="sr-only">${escapeHtml(addRowHelp)}</span>
            <span id="reset-triage-help" class="sr-only">${escapeHtml(resetHelp)}</span>
            <button id="parse-triage" class="btn btn-primary" type="button"${controlHelpAttributes(false, parseHelp, "parse-triage-help")}>Parse work</button>
            <button id="add-triage-row" class="btn" type="button"${controlHelpAttributes(false, addRowHelp, "add-triage-row-help")}>Add row</button>
            <button id="reset-triage" class="btn" type="button"${controlHelpAttributes(false, resetHelp, "reset-triage-help")}>Reset tool</button>
          </div>
        </div>
        <div class="demo-command-lines compact">
          ${factLine("Where", "Work triage tool")}
          ${factLine("Blocker", rows.length ? `${blockerCount} blocker(s) to review` : "paste work to classify")}
          ${factLine("Button runs next", rows.length ? "Copy snapshot" : "Parse work")}
        </div>
      </div>
    </section>
    <section id="triage-output" class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Triage rows</span>
          <h2>${rows.length ? `${rows.length} work item(s)` : "No rows yet"}</h2>
        </div>
        <span class="demo-status">${rows.length ? "editable" : "ready"}</span>
      </div>
      <div class="demo-triage-list">
        ${rows.length ? rows.map(triageCard).join("") : emptyState("Paste work or add a row to create a command brief.", "Paste task text, then choose Parse work.")}
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Readiness</span>
          <h2>Employer-friendly proof points</h2>
        </div>
        <span class="demo-status">local only</span>
      </div>
      <div class="demo-check-list">
        ${triageQualityChecks(rows).map(healthLine).join("")}
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Snapshot</span>
          <h2>Copy handoff</h2>
        </div>
        <span class="demo-status">${snapshot.rows.length} row(s)</span>
      </div>
      <div class="${copyPayloadClass("triage-snapshot")}">
        <label class="sr-only" for="triage-snapshot">Triage snapshot markdown</label>
        <textarea id="triage-snapshot" class="demo-search-input" rows="8" readonly>${escapeHtml(triageMarkdown(rows))}</textarea>
      </div>
      <div class="demo-card-actions">
        <span id="copy-triage-markdown-help" class="sr-only">${escapeHtml(copyMarkdownHelp)}</span>
        <span id="copy-triage-json-help" class="sr-only">${escapeHtml(copyJsonHelp)}</span>
        ${copyButton("copy-triage-markdown", "Copy Markdown", "btn btn-primary", copyMarkdownHelp, "copy-triage-markdown-help")}
        ${copyButton("copy-triage-json", "Copy JSON", "btn", copyJsonHelp, "copy-triage-json-help")}
        ${navButton("work", "Open work list")}
      </div>
      ${clipboardNoticePanel("copy-triage-markdown")}
      ${clipboardNoticePanel("copy-triage-json")}
    </section>
  `;

  bindTriageControls();
  bindGoButtons();
}

function triageParseHelp(rows) {
  return rows.length ? "Re-parse pasted work and replace current triage rows." : "Parse pasted work into editable work rows.";
}

function triageAddRowHelp() {
  return "Add a blank row to shape manually.";
}

function triageResetHelp() {
  return "Reset the triage tool to the default pasted sample.";
}

function triageCopyMarkdownHelp(rows) {
  return rows.length ? `Copy ${rows.length} triage row(s) as Markdown.` : "Copy the empty triage snapshot as Markdown.";
}

function triageCopyJsonHelp(rows) {
  return rows.length ? `Copy ${rows.length} triage row(s) as JSON.` : "Copy the empty triage snapshot as JSON.";
}

function defaultTriageInput() {
  return [
    "Finalize mobile demo polish - blocked by unclear bottom bar focus - evidence: mobile smoke in dark mode",
    "Write README employer story - needs concrete tool positioning",
    "Ship GitHub Pages update - run static export and live smoke",
    "Review issue backlog - choose next action for stale tasks"
  ].join("\n");
}

function normalizedTriageRows() {
  const rows = Array.isArray(state.triageRows)
    ? state.triageRows.map(normalizeTriageRow).filter((row) => row.work || row.blocker || row.next)
    : [];
  state.triageRows = rows;
  return rows;
}

function normalizeTriageRow(row = {}) {
  const work = String(row.work || row.title || "").trim();
  const blocker = String(row.blocker || "none").trim() || "none";
  const next = String(row.next || "Start").trim() || "Start";
  return {
    id: String(row.id || `triage-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    work,
    where: String(row.where || inferWhere(work)).trim() || "Inbox",
    blocker,
    next,
    evidence: String(row.evidence || inferEvidence(work, next)).trim(),
    doneWhen: String(row.doneWhen || inferDoneWhen(work, blocker, next)).trim()
  };
}

function parseTriageText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(cleanTriageLine)
    .filter(Boolean)
    .map((line, index) => inferTriageRow(line, index));
}

function cleanTriageLine(line) {
  return String(line || "")
    .trim()
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX-]\]\s+/, "")
    .trim();
}

function inferTriageRow(line, index) {
  const work = inferWorkTitle(line);
  const blocker = inferBlocker(line);
  const next = inferNextAction(line, blocker);
  return {
    id: `triage-${Date.now()}-${index}`,
    work,
    where: inferWhere(line),
    blocker,
    next,
    evidence: inferEvidence(line, next),
    doneWhen: inferDoneWhen(line, blocker, next)
  };
}

function inferWorkTitle(line) {
  const beforeSeparator = String(line || "").split(/\s[-–—]\s|:\s|;\s/)[0]?.trim();
  return beforeSeparator || String(line || "").trim() || "Untitled work";
}

function inferWhere(line) {
  const value = String(line || "");
  const bracket = value.match(/\[([^\]]+)\]/);
  if (bracket?.[1]) {
    return bracket[1].trim();
  }

  if (/github|issue|pr\b|pull request|repo/i.test(value)) return "GitHub";
  if (/demo|pages|route|mobile|css|style|visual/i.test(value)) return "Demo";
  if (/readme|doc|docs|copy|positioning/i.test(value)) return "Docs";
  if (/test|smoke|build|export|deploy|release/i.test(value)) return "Verification";
  return "Inbox";
}

function inferBlocker(line) {
  const value = String(line || "");
  const explicit = value.match(/\b(?:blocked by|blocker:|blocked:)\s*([^.;\n]+)/i);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const needs = value.match(/\b(?:needs?|missing|waiting for|depends on|requires?)\s+([^.;\n]+)/i);
  if (needs?.[1]) {
    return needs[0].trim();
  }

  if (/\?|decide|choose|unclear|unknown|stale/i.test(value)) return "decision needed";
  if (/fail|broken|bug|error|overflow|contrast|blank/i.test(value)) return "failure to investigate";
  if (/blocked|stuck|can't|cannot/i.test(value)) return "blocked";
  return "none";
}

function inferNextAction(line, blocker) {
  const value = String(line || "").toLowerCase();
  if (blocker && blocker !== "none") {
    return /unblock/.test(value) ? "Unblock" : "Review blocker";
  }

  if (/ship|deploy|publish|release|push/.test(value)) return "Ship";
  if (/test|smoke|verify|check|validate/.test(value)) return "Test";
  if (/write|draft|readme|docs|copy/.test(value)) return "Draft";
  if (/review|triage|audit/.test(value)) return "Review";
  if (/fix|bug|broken|error/.test(value)) return "Fix";
  if (/call|email|message/.test(value)) return "Contact";
  if (/open|start|begin/.test(value)) return "Start";
  return "Start";
}

function inferEvidence(line, next) {
  const value = String(line || "");
  if (/test|smoke|verify|check|validate/i.test(value) || next === "Test") return "Passing check output";
  if (/ship|deploy|publish|release|push/i.test(value) || next === "Ship") return "Published link or commit";
  if (/readme|doc|docs|copy/i.test(value) || next === "Draft") return "Reviewed text or doc diff";
  if (/demo|mobile|visual|css|style/i.test(value)) return "Before/after screenshot";
  if (/github|issue|pr|repo/i.test(value)) return "Issue, PR, or commit link";
  return "Visible result or handoff note";
}

function inferDoneWhen(line, blocker, next) {
  if (blocker && blocker !== "none") {
    return "Blocker is named, reviewed, and the next action is safe to run.";
  }

  if (next === "Ship") return "Published artifact is live and checked.";
  if (next === "Test") return "Relevant check passes with current output.";
  if (next === "Draft") return "Draft is ready for review or handoff.";
  return "Next action has a visible result.";
}

function triageCard(row) {
  const status = row.blocker && row.blocker !== "none" ? "blocked" : "ready";
  const removeHelp = triageRemoveHelp(row);
  const removeHelpId = `triage-remove-help-${row.id}`;
  return `<article class="demo-triage-card" data-triage-id="${escapeAttribute(row.id)}">
    <div class="demo-card-head">
      <label class="demo-field demo-triage-title" for="triage-work-${escapeAttribute(row.id)}">
        <span>Work</span>
        <input id="triage-work-${escapeAttribute(row.id)}" data-triage-field="work" type="text" value="${escapeAttribute(row.work)}">
      </label>
      <span class="demo-state-pill">${escapeHtml(status)}</span>
    </div>
    <div class="demo-triage-fields">
      ${triageTextInput(row, "where", "Where")}
      ${triageSelectInput(row, "next", "Button runs next")}
      ${triageTextInput(row, "blocker", "Blocker")}
      ${triageTextInput(row, "evidence", "Evidence needed")}
      ${triageTextInput(row, "doneWhen", "Proof target", true)}
    </div>
    <div class="demo-card-actions">
      <span id="${escapeAttribute(removeHelpId)}" class="sr-only">${escapeHtml(removeHelp)}</span>
      <button class="btn btn-sm" type="button" data-triage-remove="${escapeAttribute(row.id)}"${controlHelpAttributes(false, removeHelp, removeHelpId)}>Remove</button>
    </div>
  </article>`;
}

function triageRemoveHelp(row) {
  return `Remove ${row.work || row.where || "this row"} from the triage snapshot.`;
}

function triageTextInput(row, field, label, wide = false) {
  const id = `triage-${field}-${row.id}`;
  return `<label class="demo-field${wide ? " demo-field-wide" : ""}" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <input id="${escapeAttribute(id)}" data-triage-field="${escapeAttribute(field)}" type="text" value="${escapeAttribute(row[field] || "")}">
  </label>`;
}

function triageSelectInput(row, field, label) {
  const id = `triage-${field}-${row.id}`;
  const options = ["Review blocker", "Start", "Open", "Focus", "Draft", "Fix", "Test", "Ship", "Contact", "Unblock", "Done"];
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <select id="${escapeAttribute(id)}" data-triage-field="${escapeAttribute(field)}">
      ${options.map((option) => `<option value="${escapeAttribute(option)}"${option === row[field] ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
    </select>
  </label>`;
}

function bindTriageControls() {
  const input = el("triage-input");
  input?.addEventListener("input", () => {
    state.triageInput = input.value;
    saveState();
  });

  el("parse-triage")?.addEventListener("click", () => {
    state.triageInput = input?.value || "";
    state.triageRows = parseTriageText(state.triageInput);
    state.status = triageParsedStatus(state.triageRows.length);
    queueFocus("triage-output");
    render();
  });

  el("add-triage-row")?.addEventListener("click", () => {
    syncTriageRowsFromDom();
    state.triageRows.push(normalizeTriageRow({
      work: "Untitled work",
      where: "Inbox",
      blocker: "none",
      next: "Start",
      evidence: "Visible result or handoff note",
      doneWhen: "Next action has a visible result."
    }));
    state.status = triageStatus("none", "edit the new row");
    queueFocus("triage-output");
    render();
  });

  el("reset-triage")?.addEventListener("click", () => {
    state.triageInput = defaultTriageInput();
    state.triageRows = [];
    state.status = triageStatus("no parsed rows yet", "paste work and parse");
    queueFocus("triage-input");
    render();
  });

  el("copy-triage-markdown")?.addEventListener("click", () => {
    syncTriageRowsFromDom();
    copyToClipboard(triageMarkdown(state.triageRows), clipboardStatus("Triage", "paste Markdown into handoff"), {
      controlId: "copy-triage-markdown",
      targetId: "triage-snapshot",
      title: "Triage Markdown copied",
      detail: `${state.triageRows.length} triage row(s) are on the clipboard as Markdown.`
    });
  });

  el("copy-triage-json")?.addEventListener("click", () => {
    syncTriageRowsFromDom();
    copyToClipboard(JSON.stringify(collectTriageSnapshot(state.triageRows), null, 2), clipboardStatus("Triage", "paste JSON into handoff"), {
      controlId: "copy-triage-json",
      targetId: "triage-snapshot",
      title: "Triage JSON copied",
      detail: `${state.triageRows.length} triage row(s) are on the clipboard as JSON.`
    });
  });

  el("screen-content").querySelectorAll("[data-triage-field]").forEach((control) => {
    control.addEventListener("input", () => {
      syncTriageRowsFromDom();
      updateTriageSnapshotPreview();
      saveState();
    });
    control.addEventListener("change", () => {
      syncTriageRowsFromDom();
      updateTriageSnapshotPreview();
      saveState();
    });
  });

  el("screen-content").querySelectorAll("[data-triage-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      syncTriageRowsFromDom();
      state.triageRows = state.triageRows.filter((row) => row.id !== button.dataset.triageRemove);
      state.status = triageStatus("none", `review ${state.triageRows.length} parsed row(s)`);
      render();
    });
  });
}

function triageStatus(blocker, next) {
  return `Where: Triage. Blocker: ${blocker}. Button runs next: ${next}.`;
}

function triageParsedStatus(rowCount) {
  return rowCount > 0
    ? triageStatus("none", `review ${rowCount} parsed row(s)`)
    : triageStatus("no rows parsed", "paste work and parse");
}

function syncTriageRowsFromDom() {
  const rows = Array.from(document.querySelectorAll(".demo-triage-card")).map((card) => {
    const row = { id: card.dataset.triageId };
    card.querySelectorAll("[data-triage-field]").forEach((control) => {
      row[control.dataset.triageField] = control.value.trim();
    });
    return normalizeTriageRow(row);
  });
  state.triageRows = rows;
  const input = el("triage-input");
  if (input) {
    state.triageInput = input.value;
  }
  return rows;
}

function updateTriageSnapshotPreview() {
  const snapshot = el("triage-snapshot");
  if (snapshot) {
    snapshot.value = triageMarkdown(state.triageRows);
  }
}

function triageQualityChecks(rows) {
  const missingWork = rows.filter((row) => !row.work).length;
  const missingNext = rows.filter((row) => !row.next || isPlaceholderNext(row.next)).length;
  const missingEvidence = rows.filter((row) => !row.evidence).length;
  const blockerRows = rows.filter((row) => row.blocker && row.blocker !== "none").length;

  return [
    {
      label: "Rows are local",
      status: true,
      detail: "No backend, issue tracker, or local files are touched."
    },
    {
      label: "Work named",
      status: rows.length > 0 && missingWork === 0,
      detail: rows.length === 0 ? "No triage rows yet." : `${missingWork} row(s) missing work title.`
    },
    {
      label: "Button runs next",
      status: rows.length > 0 && missingNext === 0,
      detail: rows.length === 0 ? "Parse work to generate actions." : `${missingNext} row(s) still need a clear action.`
    },
    {
      label: "Blockers surfaced",
      status: rows.length > 0,
      detail: `${blockerRows} row(s) name a blocker for review.`
    },
    {
      label: "Evidence ready",
      status: rows.length > 0 && missingEvidence === 0,
      detail: rows.length === 0 ? "No evidence fields yet." : `${missingEvidence} row(s) missing evidence.`
    }
  ];
}

function collectTriageSnapshot(rows = normalizedTriageRows()) {
  return {
    tool: "Button Runs Next: Work Triage Tool",
    route: formatRouteHash("triage"),
    storage: "browser localStorage only",
    rows: rows.map((row) => ({
      work: row.work,
      where: row.where,
      blocker: row.blocker,
      buttonRunsNext: row.next,
      evidenceNeeded: row.evidence,
      proofTarget: row.doneWhen
    })),
    generatedAt: new Date().toISOString()
  };
}

function triageMarkdown(rows = normalizedTriageRows()) {
  if (!rows.length) {
    return "# Button Runs Next Triage\n\nNo work rows yet.";
  }

  const header = [
    "# Button Runs Next Triage",
    "",
    "| Work | Where | Blocker | Button runs next | Evidence needed | Proof target |",
    "|---|---|---|---|---|---|"
  ];
  const body = rows.map((row) => [
    row.work,
    row.where,
    row.blocker,
    row.next,
    row.evidence,
    row.doneWhen
  ].map(markdownCell).join(" | "));
  return [...header, ...body.map((line) => `| ${line} |`), "", `_Generated locally from the Projects static demo._`].join("\n");
}

function markdownCell(value) {
  return String(value || "none").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function renderWork() {
  const visible = filteredPacks();
  el("screen-content").innerHTML = `
    ${workToolbar("Work filters")}
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Work cards</span>
          <h2>${visible.length} visible</h2>
        </div>
        ${navButton("create", profile().newWork, "btn btn-primary")}
      </div>
      ${routeActionReceiptPanel(visible, "Work filters")}
      <div class="demo-work-list">${visible.length ? visible.map(workCard).join("") : emptyState("No sample work matches this filter.", "Clear search or choose another status filter.")}</div>
    </section>
  `;
  bindToolbar();
  bindWorkCards();
  bindGoButtons();
}

function renderToday() {
  const today = state.packs.filter((pack) => pack.due || pack.status === "active");
  const dueHelp = setDueTodayHelp();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Today</span>
          <h2>${today.length} sample item(s)</h2>
        </div>
        <span id="today-set-due-help" class="sr-only">${escapeHtml(dueHelp)}</span>
        <button class="btn" type="button" data-action="set-due-today"${controlHelpAttributes(false, dueHelp, "today-set-due-help")}>Set all due today</button>
      </div>
      <div class="demo-list">${today.map(todayRow).join("")}</div>
    </section>
  `;
  bindListActions();
}

function renderBoard() {
  const groups = ["draft", "active", "blocked", "done"];
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Board</span>
          <h2>Status lanes</h2>
        </div>
        ${navButton("next", "Set Button runs next", "btn btn-primary")}
      </div>
      <div class="demo-board-grid">
        ${groups.map((status) => boardColumn(status)).join("")}
      </div>
    </section>
  `;
  bindListActions();
  bindGoButtons();
}

function renderReview() {
  const review = state.packs.filter(isReview);
  const selected = currentPack();
  const firstReview = selected && review.some((pack) => pack.id === selected.id) ? selected : review[0] || null;
  const reviewCommand = firstReview ? resolvePrimaryCommandForPack(firstReview) : null;
  const reviewButtonLabel = reviewCommand?.label || "Review work";
  const reviewButtonReason = "Where: Review. Blocker: no sample work needs review. Button runs next: create or edit work.";
  const reviewButton = firstReview
    ? primaryCommandButton(firstReview)
    : `<button class="btn btn-primary" type="button" data-action="run-next" data-pack=""${disabledReasonAttributes(true, reviewButtonReason)}>${escapeHtml(reviewButtonLabel)}</button>`;
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Needs decision</span>
          <h2>${review.length} review item(s)</h2>
        </div>
        ${reviewButton}
      </div>
      ${disabledReasonNotice(!firstReview, reviewButtonReason)}
      ${routeActionReceiptPanel(review, "Review")}
      <div class="demo-review-list">${review.length ? review.map(reviewCard).join("") : emptyState("No sample work needs review.", "Choose a different scenario or add a blocker to sample work.")}</div>
    </section>
  `;
  bindListActions();
}

function renderNext() {
  const pack = currentPack() || state.packs.find(isReview) || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No sample work is available.", "Reset demo data or choose a scenario with sample work.");
    return;
  }

  state.selectedId = pack.id;
  const nextCommand = resolvePrimaryCommandForPack(pack);
  const saveNextHelp = saveNextChoiceHelp(pack);
  const nextPreviewHelp = nextChoicePreviewHelp(pack, nextCommand);
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Next setup</span>
          <h2>Choose what the main button runs</h2>
        </div>
        <span class="demo-status">${escapeHtml(pack.title)}</span>
      </div>
      <p>Pick the action to store for this work. The preview shows the button that will actually run after blocker rules apply.</p>
      <div class="demo-command-lines compact" data-next-preview>
        ${factLine("Where", pack.title)}
        ${factLine("Blocker", blockerTextForPack(pack))}
        ${factLine("Button runs next", nextCommand.label)}
      </div>
      <div class="demo-inline-form">
        <label class="sr-only" for="next-action-choice">Choose next action</label>
        <select id="next-action-choice" class="demo-search-input" aria-describedby="next-choice-preview-help">
          ${["Review", "Open", "Focus", "Unblock", "Start", "Done"].map((option) => `<option value="${escapeAttribute(option)}"${option === pack.next ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
        <span id="apply-next-action-help" class="sr-only">${escapeHtml(saveNextHelp)}</span>
        <p id="next-choice-preview-help" class="demo-field-help" aria-live="polite">${escapeHtml(nextPreviewHelp)}</p>
        <button id="apply-next-action" class="btn btn-primary" type="button"${controlHelpAttributes(false, saveNextHelp, "apply-next-action-help")}>Save Button runs next</button>
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Candidates</span>
          <h2>Work that needs a clearer button</h2>
        </div>
      </div>
      <div class="demo-list">${state.packs.filter(isReview).map(nextCandidateRow).join("") || emptyState("No sample work needs next setup.", "Open work, add a blocker, or clear Button runs next to create a candidate.")}</div>
    </section>
  `;
  el("next-action-choice").addEventListener("change", () => syncNextChoicePreview(pack));
  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));
  syncNextChoicePreview(pack);
  bindListActions();
}

function renderCheck() {
  const checks = sampleChecks();
  const validateHelp = validateSampleHelp();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Check</span>
          <h2>Sample readiness checks</h2>
        </div>
        <span id="validate-sample-help" class="sr-only">${escapeHtml(validateHelp)}</span>
        <button class="btn btn-primary" type="button" data-action="validate-sample"${controlHelpAttributes(false, validateHelp, "validate-sample-help")}>Validate sample</button>
      </div>
      <div class="demo-check-list">
        ${checks.map(checkRow).join("")}
      </div>
    </section>
  `;
  bindListActions();
}

function setDueTodayHelp() {
  return "Set every unfinished sample work item due today in this browser.";
}

function todayIsoDate(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function dueTodayStatus(date) {
  return `Where: Today. Blocker: none. Button runs next: review work due ${date}.`;
}

function validationStatus(attention) {
  return attention === 0
    ? "Where: Check. Blocker: none. Button runs next: keep sample ready."
    : `Where: Check. Blocker: ${attention} sample check item(s) need attention. Button runs next: fix check items.`;
}

function saveNextChoiceHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: Next setup / ${pack.title}. Blocker: ${blockerTextForPack(pack)}. Button runs next: save choice; preview resolves to ${command.label}.`;
}

function syncNextChoicePreview(pack) {
  if (!pack) {
    return;
  }

  const pending = nextChoicePreviewPack(pack);
  const command = resolvePrimaryCommandForPack(pending);
  const preview = document.querySelector("[data-next-preview]");
  const where = preview?.querySelector('[data-command-field="where"] strong');
  const blocker = preview?.querySelector('[data-command-field="blocker"] strong');
  const next = preview?.querySelector('[data-command-field="button-runs-next"] strong');
  if (where) where.textContent = pending.title;
  if (blocker) blocker.textContent = blockerTextForPack(pending);
  if (next) next.textContent = command.label;

  const previewHelp = el("next-choice-preview-help");
  if (previewHelp) {
    previewHelp.textContent = nextChoicePreviewHelp(pending, command);
  }

  const saveHelp = saveNextChoiceHelp(pending, command);
  const applyHelp = el("apply-next-action-help");
  const applyButton = el("apply-next-action");
  if (applyHelp) {
    applyHelp.textContent = saveHelp;
  }
  if (applyButton) {
    const copy = helpCopy(saveHelp, DEMO_COPY_LIMITS.commandFlowHelp);
    applyButton.title = copy;
    applyButton.setAttribute("aria-label", copy);
  }
}

function nextChoicePreviewPack(pack) {
  return {
    ...pack,
    next: valueOf("next-action-choice") || pack.next
  };
}

function nextChoicePreviewHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  const blocker = hasBlocker(pack) && command.action !== "unblock"
    ? " because this work is still blocked"
    : "";
  return `After save, Button runs next shows ${command.label}${blocker}.`;
}

function validateSampleHelp() {
  return "Run sample readiness checks and update demo status.";
}

function resetDemoHelp() {
  return "Reset sample work, profile, scenario, and browser-only edits.";
}

function renderFocus() {
  const pack = currentPack() || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No sample work is available.", "Reset demo data or choose a scenario with sample work.");
    return;
  }
  const focusCommand = resolvePrimaryCommandForPack(pack);
  const doneAction = focusCommand.action === "done"
    ? supportActionButton("done", "Finish with proof", pack)
    : "";

  state.selectedId = pack.id;
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-focus-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Focused work</span>
          <h2>${escapeHtml(pack.title)}</h2>
        </div>
        <span class="demo-state-pill">${escapeHtml(pack.status)}</span>
      </div>
      <div class="demo-focus-grid">
        ${factBlock("Where", `${profile().work}: ${pack.type}`)}
        ${factBlock("Blocker", blockerTextForPack(pack))}
        ${factBlock("Button runs next", focusCommand.label)}
        ${factBlock("Proof target", proofTargetForPack(pack))}
      </div>
      ${workPathStrip(pack, focusCommand)}
      ${relevantMemoryStrip(pack)}
      <p>${escapeHtml(pack.purpose)}</p>
      <div class="demo-card-actions">
        ${primaryCommandButton(pack)}
      </div>
      <details class="demo-card-support">
        <summary>
          <span>Support setup</span>
          <strong>Open, edit, or finish</strong>
        </summary>
        <div class="demo-card-actions compact">
          ${supportActionButton("open", "Open", pack)}
          ${supportActionButton("edit", "Edit sample", pack)}
          ${doneAction}
        </div>
      </details>
    </section>
    ${activityPanel(pack)}
  `;
  bindListActions();
}

function renderStats() {
  const counts = countByFilter();
  const total = Math.max(state.packs.length, 1);
  el("screen-content").innerHTML = `
    <div class="kpi-strip demo-grid demo-summary-strip">
      ${metricCard("Active", counts.active ?? 0, "Sample work currently moving.")}
      ${metricCard("Review", counts.review ?? 0, "Sample work with blockers or missing next actions.")}
      ${metricCard("Done", counts.done ?? 0, "Sample work marked complete.")}
    </div>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Stats</span>
          <h2>Browser-state counts</h2>
        </div>
        <span class="demo-status">${state.packs.length} sample item(s)</span>
      </div>
      <div class="demo-stat-list">
        ${["active", "blocked", "draft", "done", "review"].map((key) => statBar(key, counts[key] ?? 0, total)).join("")}
      </div>
    </section>
  `;
}

function renderNotes() {
  const rows = state.packs.flatMap((pack) => pack.memory.map((note) => ({ pack, note })));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Notes</span>
          <h2>Sample notes across work</h2>
        </div>
        ${navButton("memory", "Add note", "btn btn-primary")}
      </div>
      <div class="demo-list">
        ${rows.map(({ pack, note }) => `<div class="demo-note"><strong>${escapeHtml(pack.title)}</strong>${escapeHtml(note)}</div>`).join("") || emptyState("No sample notes exist.", "Open Memory and add a note to selected work.")}
      </div>
    </section>
  `;
  bindGoButtons();
}

function renderTimeline() {
  const rows = state.packs.flatMap((pack) => pack.activity.map((item, index) => ({ pack, item, index })));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Timeline</span>
          <h2>Sample activity log</h2>
        </div>
      </div>
      <div class="demo-list">
        ${rows.map(timelineRow).join("") || emptyState("No sample activity exists.", "Run a sample action to add activity.")}
      </div>
    </section>
  `;
}

function renderFiles() {
  const rows = state.packs.flatMap((pack) => pack.sources.map((source) => ({ pack, source })));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Files</span>
          <h2>Sample source references</h2>
        </div>
        <span class="demo-status">No local files are opened in the demo</span>
      </div>
      <div class="demo-source-list">
        ${rows.map(sourceRow).join("") || emptyState("No sample source references exist.", "Choose a scenario with sample source references.")}
      </div>
    </section>
  `;
  bindListActions();
}

function renderCalendar() {
  const rows = state.packs
    .filter((pack) => pack.due)
    .slice()
    .sort((left, right) => left.due.localeCompare(right.due));
  const dueHelp = setDueTodayHelp();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Calendar</span>
          <h2>Sample due dates</h2>
        </div>
        <span id="calendar-set-due-help" class="sr-only">${escapeHtml(dueHelp)}</span>
        <button class="btn" type="button" data-action="set-due-today"${controlHelpAttributes(false, dueHelp, "calendar-set-due-help")}>Set all due today</button>
      </div>
      <div class="demo-calendar-grid">
        ${rows.map(calendarCard).join("") || emptyState("No sample due dates exist.", "Use Set all due today or edit a work due date.")}
      </div>
    </section>
  `;
  bindListActions();
}

function renderSearch() {
  const visible = filteredPacks();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Search</span>
          <h2>Search every sample work item</h2>
        </div>
        <span class="demo-status">${visible.length} match(es)</span>
      </div>
      <label class="sr-only" for="screen-search">Search demo work</label>
      <input id="screen-search" class="demo-search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search title, owner, next action, source, or due date">
      <div class="demo-work-list demo-search-results">${visible.map(workCard).join("") || emptyState("No sample work matches the search.", "Clear search or try title, owner, due date, or next action.")}</div>
    </section>
  `;
  el("screen-search").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    render();
  });
  bindWorkCards();
}

function renderCreate() {
  const defaults = defaultCreateValues();
  const createState = createSaveState(defaults);
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Create</span>
          <h2>${escapeHtml(profile().newWork)}</h2>
        </div>
        <span class="demo-status">Browser state only</span>
      </div>
      <div class="demo-form-grid">
        ${inputField("new-title", "Title", defaults.title)}
        ${inputField("new-owner", "Owner", defaults.owner)}
        ${inputField("new-next", "Button runs next", defaults.next)}
        ${inputField("new-due", "Due", defaults.due)}
        ${textField("new-purpose", "Why it matters", defaults.purpose)}
      </div>
      <p id="create-save-help" class="demo-field-help" aria-live="polite">${escapeHtml(createState.help)}</p>
      <button id="create-sample" class="btn btn-primary" type="button" aria-describedby="create-save-help"${disabledReasonAttributes(!createState.canSave, createState.help)}>Save sample</button>
    </section>
  `;
  el("create-sample").addEventListener("click", createSamplePack);
  bindCreateValidation();
}

function renderPackDetail() {
  const pack = currentPack();
  if (!pack) {
    el("screen-content").innerHTML = emptyState("Choose sample work before opening the work path.", "Open Work or Review and choose a work card.");
    return;
  }
  const packCommand = resolvePrimaryCommandForPack(pack);
  const doneAction = packCommand.action === "done"
    ? supportActionButton("done", "Finish with proof", pack)
    : "";
  const saveState = packDetailSaveState(pack);
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-edit-panel" id="pack-edit-form" data-pack-id="${escapeAttribute(pack.id)}">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Selected work</span>
          <h2 id="pack-detail-title">${escapeHtml(pack.title)}</h2>
        </div>
        <span class="demo-status">Edits are browser-only</span>
      </div>
      <div class="demo-forward-panel" data-forward-motion="pack-detail">
        <div class="demo-forward-head">
          <span class="section-label">Forward path</span>
          <strong>${escapeHtml(packCommand.label)}</strong>
        </div>
        <div class="demo-command-lines compact">
          ${factLine("Where", `${pack.title} / ${pack.status}`)}
          ${factLine("Blocker", blockerTextForPack(pack))}
          ${factLine("Button runs next", packCommand.label)}
        </div>
        ${workPathStrip(pack, packCommand)}
        <div class="demo-form-grid demo-forward-fields">
          ${selectField("edit-status", "Status", ["draft", "active", "blocked", "done"], pack.status)}
          ${blockerStateField(pack)}
          ${inputField("edit-next", "Button runs next", pack.next)}
          ${inputField("edit-done-when", "Proof target", pack.doneWhen)}
        </div>
      </div>
      <details class="demo-support-details" data-support-details="pack-detail">
        <summary>
          <span>Support fields</span>
          <strong>Open only to clarify owner, due date, or purpose</strong>
        </summary>
        <div class="demo-form-grid">
        ${inputField("edit-title", "Title", pack.title)}
          ${inputField("edit-owner", "Owner", pack.owner)}
          ${inputField("edit-due", "Due", pack.due)}
          ${textField("edit-purpose", "Purpose", pack.purpose)}
        </div>
      </details>
      ${relevantMemoryStrip(pack)}
      <div class="demo-card-actions">
        <button id="save-pack" class="btn btn-primary" type="button" aria-describedby="pack-save-help"${disabledReasonAttributes(!saveState.canSave, saveState.help)}>Save forward path</button>
        ${doneAction}
      </div>
      <p id="pack-save-help" class="demo-field-help" aria-live="polite">${escapeHtml(saveState.help)}</p>
    </section>
    ${activityPanel(pack)}
  `;
  el("save-pack").addEventListener("click", () => savePackDetail(pack.id));
  bindPackDetailValidation(pack);
  bindListActions();
}

function renderMemory() {
  const pack = currentPack() || state.packs[0];
  const memoryState = memoryNoteSaveState(pack, "");
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Memory</span>
          <h2>${pack ? escapeHtml(pack.title) : "Sample memory"}</h2>
        </div>
        <span class="demo-status">Stored in this browser</span>
      </div>
      <div class="demo-list">${pack ? (pack.memory.map((note) => `<div class="demo-note">${escapeHtml(note)}</div>`).join("") || emptyState("No memory notes for this work.", "Add a note below to keep recall with the selected work.")) : emptyState("No memory available.", "Choose sample work before adding memory.")}</div>
      <div class="demo-inline-form">
        <label class="sr-only" for="memory-note">Add memory note</label>
        <input id="memory-note" class="demo-search-input" type="text" placeholder="Add a sample memory note">
        <p id="memory-note-help" class="demo-field-help" aria-live="polite">${escapeHtml(memoryState.help)}</p>
        <button id="add-memory" class="btn btn-primary" type="button" aria-describedby="memory-note-help"${disabledReasonAttributes(!memoryState.canSave, memoryState.help)}>Add note</button>
      </div>
    </section>
  `;
  bindMemoryValidation(pack);
  el("add-memory").addEventListener("click", () => {
    const memoryState = memoryNoteSaveState(pack, valueOf("memory-note"));
    if (!memoryState.canSave) {
      state.status = memoryState.help;
      syncMemoryValidation(pack);
      return;
    }

    const result = addPackMemoryNote(pack, valueOf("memory-note"));
    setMemoryConfirmation(pack, result);
    render();
  });
}

function blockerStateField(pack) {
  const hasBlocker = Boolean(pack && pack.blocker && pack.blocker !== "none");
  const blocker = hasBlocker ? pack.blocker : "";
  return `
    <fieldset class="demo-field demo-blocker-field" data-blocker-field>
      <legend>Blocker state</legend>
      <div class="demo-segmented-control" role="radiogroup" aria-label="Blocker state">
        <label class="demo-segment${hasBlocker ? "" : " active"}" data-blocker-mode-label="clear" for="edit-blocker-clear">
          <input id="edit-blocker-clear" name="edit-blocker-mode" type="radio" value="clear" data-blocker-mode="clear"${hasBlocker ? "" : " checked"}>
          <span>Unblocked</span>
        </label>
        <label class="demo-segment${hasBlocker ? " active" : ""}" data-blocker-mode-label="set" for="edit-blocker-set">
          <input id="edit-blocker-set" name="edit-blocker-mode" type="radio" value="set" data-blocker-mode="set"${hasBlocker ? " checked" : ""}>
          <span>Blocked</span>
        </label>
      </div>
      <div class="demo-blocker-reason" data-blocker-reason${hasBlocker ? "" : " hidden"}>
        <label for="edit-blocker">Why blocked?</label>
        <input id="edit-blocker" type="text" value="${escapeAttribute(blocker)}" placeholder="missing owner, source, approval..."${hasBlocker ? "" : " disabled"}>
      </div>
      <p class="demo-field-help" data-blocker-help>${hasBlocker ? "Describe what must be cleared before the next action." : "Unblocked stores Blocker: none automatically; no typing required."}</p>
    </fieldset>
  `;
}

function renderSettings() {
  const statusHelp = helpCopy(state.status, DEMO_COPY_LIMITS.statusHelp);
  const statusVisible = visibleCopy(statusHelp, DEMO_COPY_LIMITS.statusVisible);
  const resetHelp = resetDemoHelp();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Settings</span>
          <h2>Demo copy profile</h2>
        </div>
        <span id="reset-demo-help" class="sr-only">${escapeHtml(resetHelp)}</span>
        <button class="btn" type="button" id="reset-demo"${controlHelpAttributes(false, resetHelp, "reset-demo-help")}>Reset demo data</button>
      </div>
      <p>Copy profile changes labels in this static demo. Sample edits stay in this browser only; ontology, local methods, and real pack storage are untouched.</p>
      <p class="demo-status-line" title="${escapeAttribute(statusHelp)}" aria-label="${escapeAttribute(statusHelp)}">${escapeHtml(statusVisible)}</p>
      <h3>Profile</h3>
      <div class="demo-profile-grid">
        ${Object.entries(copyProfiles).map(([key, value]) => `
          <button type="button" class="demo-profile-card" data-profile="${escapeAttribute(key)}" aria-pressed="${state.copyProfile === key}"${controlLabelAttributes(profileCardHelp(key, value, state.copyProfile === key))}>
            <strong>${escapeHtml(capitalize(key))}</strong>
            <span>${escapeHtml(value.newWork)} / ${escapeHtml(value.work)} / ${escapeHtml(value.sources)}</span>
          </button>
        `).join("")}
      </div>
      <h3>Scenario presets</h3>
      <div class="demo-scenario-grid">
        ${DEMO_SCENARIOS.map((item) => `
          <button type="button" class="demo-scenario-card" data-scenario="${escapeAttribute(item.id)}" aria-pressed="${state.scenarioId === item.id}"${controlLabelAttributes(scenarioCardHelp(item, state.scenarioId === item.id))}>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
  document.querySelectorAll(".demo-profile-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.copyProfile = button.dataset.profile;
      syncSearchParam("profile", button.dataset.profile);
      state.status = profileStatus(state.copyProfile);
      render();
    });
  });
  bindScenarioCards();
  el("reset-demo").addEventListener("click", resetState);
}

function renderHealth() {
  const checks = buildHealthChecks();
  const healthy = checks.every((check) => check.status);
  const now = new Date().toLocaleString();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Live checks</span>
          <h2>Demo health</h2>
        </div>
        <span class="demo-status">${healthy ? "Passing" : "Needs attention"}</span>
      </div>
      <p>Route: <strong>${escapeHtml(state.route || "home")}</strong> · Theme: <strong>${document.documentElement.classList.contains("dark") ? "dark" : "light"}</strong> · Built: <strong>${escapeHtml(state.metadata.generatedAt ? new Date(state.metadata.generatedAt).toLocaleString() : "unknown")}</strong></p>
      <div class="demo-check-list">
        ${checks.map(healthLine).join("")}
      </div>
      <p><small>Snapshot generated: ${escapeHtml(now)}</small></p>
    </section>
    <div class="demo-grid">
      ${metricCard("Data", state.packs.length, "Loaded sample packs for this demo.")}
      ${metricCard("Checks", checks.filter((check) => check.status).length, "Passing health checks.")}
      ${metricCard("Checks total", checks.length, "All expected telemetry checks.")}
      ${metricCard("Scenario", state.scenarioId, "Current scenario library preset.")}
    </div>
  `;
}

function renderFeedback() {
  const context = collectDiagnosticContext();
  const issueTitle = `Projects static demo issue (${stateVersionLabel()})`;
  const issueBody = `Context:\n\n${JSON.stringify(context, null, 2)}`;
  const issueUrl = `${DEMO_ISSUE_URL}?title=${encodeURIComponent(issueTitle)}&labels=demo%2Cfeedback&body=${encodeURIComponent(issueBody)}`;
  const copyFeedbackHelp = clipboardStatus("Feedback", "copy diagnostic context into issue body");
  const openFeedbackHelp = routeStatus("Feedback", "none", "open the prefilled GitHub issue");
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Feedback</span>
          <h2>Report a demo issue</h2>
        </div>
        <span class="demo-status">${escapeHtml(stateVersionLabel())}</span>
      </div>
      <p>Attach pre-filled environment context, or copy it and paste into the issue body.</p>
      <div class="${copyPayloadClass("feedback-context")}">
        <label class="sr-only" for="feedback-context">Demo diagnostic context</label>
        <textarea id="feedback-context" class="demo-search-input" rows="10">${escapeHtml(issueBody)}</textarea>
      </div>
      <div class="demo-card-actions">
        <span id="copy-feedback-help" class="sr-only">${escapeHtml(copyFeedbackHelp)}</span>
        <span id="open-feedback-help" class="sr-only">${escapeHtml(openFeedbackHelp)}</span>
        ${copyButton("copy-feedback", "Copy context", "btn", copyFeedbackHelp, "copy-feedback-help")}
        <a class="btn btn-primary" id="open-feedback" href="${escapeAttribute(issueUrl)}" rel="noopener noreferrer" target="_blank"${controlHelpAttributes(false, openFeedbackHelp, "open-feedback-help")}>Open GitHub issue</a>
      </div>
      ${clipboardNoticePanel("copy-feedback")}
    </section>
  `;
  el("copy-feedback").addEventListener("click", () => copyToClipboard(issueBody, copyFeedbackHelp, {
    controlId: "copy-feedback",
    targetId: "feedback-context",
    title: "Feedback context copied",
    detail: "Diagnostic context is on the clipboard for the issue body."
  }));
  el("open-feedback").addEventListener("click", () => {
    state.status = routeStatus("Feedback", "none", "review the prefilled GitHub issue");
  });
}

function renderMeta() {
  const counts = countByFilter();
  const checks = buildHealthChecks();
  const passing = checks.filter((check) => check.status).length;
  const context = collectDiagnosticContext();
  const styleAudit = buildStyleAuditSnapshot();
  const now = new Date().toLocaleString();
  const copyMetaHelp = clipboardStatus("Meta", "copy metadata and command context");
  const copyStyleAuditHelp = clipboardStatus("Meta", "copy shipped asset style audit");

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Product telemetry</span>
          <h2>Demo meta dashboard</h2>
        </div>
        <span class="demo-status">${escapeHtml(context.version || stateVersionLabel())}</span>
      </div>
      <p>A compact product-like summary from this browser's sample state and runtime checks.</p>
      <div class="demo-grid">
        ${metricCard("Version", context.version || stateVersionLabel(), "Build label from demo metadata.")}
        ${metricCard("Scenario", state.scenarioId, "Active demo preset.")}
        ${metricCard("Review", counts.review, "Needs follow-up in current demo state.")}
        ${metricCard("Health", `${passing}/${checks.length}`, "Checks passing now.")}
      </div>
      <div class="demo-check-list">
        ${checks.map(healthLine).join("")}
      </div>
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Style audit</span>
          <h2>Shipped asset budget</h2>
        </div>
        <span class="demo-status">${escapeHtml(styleAudit.status)}</span>
      </div>
      <div class="demo-grid">
        ${metricCard("Demo CSS", styleAuditMetric("demoCss", "lines"), styleAuditDetail("demoCss"))}
        ${metricCard("Product CSS", styleAuditMetric("productCss", "lines"), styleAuditDetail("productCss"))}
        ${metricCard("CSS total", formatBytes(styleAudit.totals.cssBytes), `${styleAudit.totals.cssLines} CSS LOC shipped.`)}
        ${metricCard("Routes", styleAudit.routeCount, `${navItems.length} nav routes plus work path.`)}
      </div>
      <div class="demo-check-list">
        ${styleAuditChecks().map(healthLine).join("")}
      </div>
      <div class="demo-grid">
        ${metricCard("Active packs", counts.active, "Packs ready to act on.")}
        ${metricCard("Blocked packs", counts.blocked, "Packs requiring action or missing next step.")}
        ${metricCard("Done packs", counts.done, "Completed sample packs.")}
        ${metricCard("All packs", counts.all, "Total packs loaded.")}
      </div>
      <div class="${copyPayloadClass("meta-context")}">
        <label class="sr-only" for="meta-context">Meta context payload</label>
        <textarea id="meta-context" class="demo-search-input" rows="8">${escapeHtml(JSON.stringify(context, null, 2))}</textarea>
      </div>
      <div class="demo-card-actions">
        <span id="copy-meta-context-help" class="sr-only">${escapeHtml(copyMetaHelp)}</span>
        <span id="copy-style-audit-help" class="sr-only">${escapeHtml(copyStyleAuditHelp)}</span>
        ${copyButton("copy-meta-context", "Copy meta snapshot", "btn", copyMetaHelp, "copy-meta-context-help")}
        ${copyButton("copy-style-audit", "Copy style audit", "btn", copyStyleAuditHelp, "copy-style-audit-help")}
      </div>
      ${clipboardNoticePanel("copy-meta-context")}
      ${clipboardNoticePanel("copy-style-audit")}
      <p><small>Snapshot generated: ${escapeHtml(now)}</small></p>
    </section>
  `;
  el("copy-meta-context").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(context, null, 2), clipboardStatus("Meta", "share the meta snapshot"), {
      controlId: "copy-meta-context",
      targetId: "meta-context",
      title: "Meta snapshot copied",
      detail: "The current route, command context, metadata, and style audit summary are on the clipboard."
    });
  });
  el("copy-style-audit").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(styleAudit, null, 2), clipboardStatus("Meta", "share the style audit"), {
      controlId: "copy-style-audit",
      targetId: "meta-context",
      title: "Style audit copied",
      detail: "The shipped asset audit is on the clipboard."
    });
  });
}

function renderLab() {
  const pack = currentPack() || preferredReviewPack();
  const action = resolvePrimaryCommandForPack(pack);
  const styleAudit = buildStyleAuditSnapshot();
  const initialChecks = labSmokeChecks(pack, styleAudit);
  const snapshot = collectLabSnapshot(pack, action, styleAudit, initialChecks);
  const noPackReason = labNoPackReason();
  const labPackSelectHelp = labPackSelectReason(state.packs.length > 0);
  const labRunHelp = pack ? labRunActionHelp(pack, action) : noPackReason;
  const labSetNextHelp = pack ? labSetNextActionHelp(pack) : noPackReason;
  const copyLabSnapshotHelp = clipboardStatus("Demo Lab", "copy lab snapshot JSON");
  const labOptions = state.packs.length
    ? state.packs.map((item) => `<option value="${escapeAttribute(item.id)}"${item.id === pack?.id ? " selected" : ""}>${escapeHtml(item.title)} / ${escapeHtml(resolvePrimaryCommandForPack(item).label)}</option>`).join("")
    : `<option value="" selected>No sample work: reset demo data or choose a scenario</option>`;

  if (pack && pack.id !== state.selectedId) {
    state.selectedId = pack.id;
  }

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Demo Lab</span>
          <h2>Command simulator</h2>
        </div>
        <span class="demo-status">${escapeHtml(action.label)}</span>
      </div>
      <p>Pick sample work, inspect the blocker, then run the same Button-runs-next action shown in the command brief.</p>
      <div class="demo-grid">
        ${metricCard("Selected", pack?.title || "none", pack ? `${pack.status} / ${pack.owner}` : "No sample work selected.")}
        ${metricCard("Blocker", blockerTextForPack(pack), "The reason the work needs attention.")}
        ${metricCard("Runs next", action.label, "The primary action is resolved from selected work.")}
      </div>
      <div class="demo-inline-form">
        <label class="sr-only" for="lab-pack-select">Choose work for demo lab</label>
        <select id="lab-pack-select" class="demo-search-input"${disabledReasonAttributes(state.packs.length === 0, labPackSelectHelp)} aria-describedby="lab-pack-select-help">
           ${labOptions}
        </select>
        <p id="lab-pack-select-help" class="demo-field-help">${escapeHtml(labPackSelectHelp)}</p>
        <span id="lab-run-action-help" class="sr-only">${escapeHtml(labRunHelp)}</span>
        <span id="lab-set-next-help" class="sr-only">${escapeHtml(labSetNextHelp)}</span>
        <button id="lab-run-action" class="btn btn-primary" type="button"${controlHelpAttributes(!pack, labRunHelp, "lab-run-action-help")}>Run ${escapeHtml(action.label)}</button>
        <button id="lab-set-next" class="btn" type="button"${controlHelpAttributes(!pack, labSetNextHelp, "lab-set-next-help")}>Set Button runs next</button>
        ${disabledReasonNotice(!pack, noPackReason)}
      </div>
      <div class="demo-command-lines compact">
        ${factLine("Where", pack?.title || "No sample work selected")}
        ${factLine("Blocker", blockerTextForPack(pack))}
        ${factLine("Button runs next", action.label)}
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Budget graph</span>
          <h2>Static asset weight</h2>
        </div>
        <span class="demo-status">${escapeHtml(styleAudit.status)}</span>
      </div>
      <div class="demo-stat-list">
        ${styleAudit.assets.map((asset) => assetBudgetRow(asset, styleAudit.totals.bytes)).join("")}
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Smoke replay</span>
          <h2>What the demo proves now</h2>
        </div>
        <span class="demo-status">${escapeHtml(styleAudit.currentRoute)}</span>
      </div>
      <div id="lab-smoke-checks" class="demo-check-list">
        ${initialChecks.map(healthLine).join("")}
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Debug packet</span>
          <h2>Lab snapshot</h2>
        </div>
        <span class="demo-status">copyable</span>
      </div>
      <div class="${copyPayloadClass("lab-snapshot")}">
        <label class="sr-only" for="lab-snapshot">Lab snapshot payload</label>
        <textarea id="lab-snapshot" class="demo-search-input" rows="10">${escapeHtml(JSON.stringify(snapshot, null, 2))}</textarea>
      </div>
      <div class="demo-card-actions">
        <span id="copy-lab-snapshot-help" class="sr-only">${escapeHtml(copyLabSnapshotHelp)}</span>
        ${copyButton("copy-lab-snapshot", "Copy lab snapshot", "btn btn-primary", copyLabSnapshotHelp, "copy-lab-snapshot-help")}
        ${navButton("meta", "Open meta")}
      </div>
      ${clipboardNoticePanel("copy-lab-snapshot")}
    </section>
  `;

  bindLabControls();
  bindGoButtons();
  syncLabRenderedSmokeChecks(pack, action, styleAudit);
}

function syncLabRenderedSmokeChecks(pack, action, styleAudit) {
  const renderedChecks = labSmokeChecks(pack, styleAudit, disabledReasonCoverageStatus());
  const list = el("lab-smoke-checks");
  if (list) {
    list.innerHTML = renderedChecks.map(healthLine).join("");
  }

  const snapshot = el("lab-snapshot");
  if (snapshot) {
    snapshot.value = JSON.stringify(collectLabSnapshot(pack, action, styleAudit, renderedChecks), null, 2);
  }
}

function labPackSelectReason(hasWork) {
  return hasWork
    ? "Where: Demo Lab. Blocker: none. Button runs next: choose sample work to preview its next action."
    : "Where: Demo Lab. Blocker: no sample work is available. Button runs next: reset demo data or choose a scenario with work.";
}

function labNoPackReason() {
  return "Where: Demo Lab. Blocker: no sample work is selected. Button runs next: reset demo data or choose a scenario with work.";
}

function labRunActionHelp(pack, action) {
  return `Where: Demo Lab / ${pack.title}. Blocker: ${blockerTextForPack(pack)}. Button runs next: run ${action.label}.`;
}

function labSetNextActionHelp(pack) {
  return `Where: Demo Lab / ${pack.title}. Blocker: ${blockerTextForPack(pack)}. Button runs next: set Button runs next.`;
}

function workToolbar(label) {
  return `
    <section class="demo-toolbar" aria-label="${escapeAttribute(label)}">
      <label class="sr-only" for="demo-search">Search demo work</label>
      <input id="demo-search" class="demo-search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search work title, Button runs next, owner, or due date" autocomplete="off">
      <div id="status-chips" class="demo-chip-row" aria-label="Status filters">
        ${renderFilterChips()}
      </div>
    </section>
  `;
}

function renderFilterChips() {
  const counts = countByFilter();
  return filters.map(([key, label]) => {
    const count = counts[key] ?? 0;
    const active = state.filter === key;
    return `
      <button type="button" class="demo-chip" aria-pressed="${active}" data-filter="${key}"${controlLabelAttributes(filterChipHelp(label, count, active))}>
        ${escapeHtml(label)}<span class="demo-chip-count">${count}</span>
      </button>
    `;
  }).join("");
}

function filterChipHelp(label, count, active) {
  const prefix = active ? "Current filter" : "Apply filter";
  return `${prefix}: show ${count} ${label.toLowerCase()} sample work item(s).`;
}

function filterStatusMessage(filterKey) {
  return `${filterLabel(filterKey)} filter applied: ${filteredPacks().length} sample work item(s) visible.`;
}

function filterLabel(filterKey) {
  return filters.find(([key]) => key === filterKey)?.[1] || "All";
}

function noSelectedWorkStatus(next = "choose work") {
  return `Where: none. Blocker: no sample work selected. Button runs next: ${next}.`;
}

function selectedWorkStatus(surface, pack, next = resolvePrimaryCommandForPack(pack).label) {
  return `Where: ${surface} / ${pack.title}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next}.`;
}

function profileCardHelp(key, value, active) {
  const prefix = active ? "Current copy profile" : "Apply copy profile";
  return `${prefix}: ${capitalize(key)}. Labels use ${value.newWork}, ${value.work}, and ${value.sources}.`;
}

function scenarioCardHelp(scenario, active) {
  const prefix = active ? "Current scenario" : "Apply scenario";
  return `${prefix}: ${scenario.label}. ${scenario.description}`;
}

function boardColumn(status) {
  const packs = state.packs.filter((pack) => pack.status === status);
  return `<section class="demo-board-column">
    <div class="demo-board-head">
      <strong>${escapeHtml(capitalize(status))}</strong>
      <span>${packs.length}</span>
    </div>
    <div class="demo-list">
      ${packs.map(boardMiniCard).join("") || emptyState(`No ${status} sample work.`, "Change filters, choose another scenario, or edit work status.")}
    </div>
  </section>`;
}

function boardMiniCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  return `<article class="demo-mini-card">
    <button type="button" class="demo-card-title" data-action="focus" data-pack="${escapeAttribute(pack.id)}">${escapeHtml(pack.title)}</button>
    <span>${escapeHtml(pack.blocker === "none" ? command.label : pack.blocker)}</span>
  </article>`;
}

function nextCandidateRow(pack) {
  return `<div class="demo-row" data-pack-id="${escapeAttribute(pack.id)}">
    <div>
      <strong>${escapeHtml(pack.title)}</strong>
      <span>${escapeHtml(pack.blocker === "none" ? "Ready for a clearer next action." : pack.blocker)}</span>
    </div>
    <div class="demo-row-actions">
      ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
      ${supportActionButton("set-next", "Set Button runs next", pack, "btn btn-sm")}
    </div>
  </div>`;
}

function sampleChecks() {
  const missingOwner = state.packs.filter((pack) => !pack.owner || pack.owner === "No owner" || pack.owner === "unassigned").length;
  const missingNext = state.packs.filter((pack) => !pack.next || pack.next === "Choose next action").length;
  const blocked = state.packs.filter((pack) => pack.status === "blocked").length;
  const missingDue = state.packs.filter((pack) => !pack.due && pack.status !== "done").length;
  return [
    ["Owners", missingOwner, "Every moving sample item should name an owner."],
    ["Button runs next", missingNext, "Each sample item needs a clear main button action."],
    ["Blocked", blocked, "Blocked sample work should say what is blocking it."],
    ["Due dates", missingDue, "Unfinished sample work can optionally carry a date."]
  ];
}

function checkRow([label, count, note]) {
  return `<div class="demo-check-row">
    <div>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(note)}</span>
    </div>
    <span class="demo-state-pill">${count === 0 ? "clear" : `${count} attention`}</span>
  </div>`;
}

function statBar(label, count, total) {
  const percent = Math.round((count / total) * 100);
  return `<div class="demo-stat-row">
    <div>
      <strong>${escapeHtml(capitalize(label))}</strong>
      <span>${count} of ${total}</span>
    </div>
    <div class="demo-stat-track" aria-hidden="true"><span style="width:${percent}%"></span></div>
  </div>`;
}

function assetBudgetRow(asset, totalBytes) {
  const percent = totalBytes > 0 ? Math.max(3, Math.round((asset.bytes / totalBytes) * 100)) : 0;
  const detail = asset.status
    ? `${asset.lines} LOC / ${formatBytes(asset.bytes)}${asset.selectors ? ` / ${asset.selectors} selector block(s)` : ""}`
    : asset.error || "Asset not measured.";
  return `<div class="demo-stat-row">
    <div>
      <strong>${escapeHtml(asset.label)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    <div class="demo-stat-track" aria-hidden="true"><span style="width:${percent}%"></span></div>
  </div>`;
}

function timelineRow({ pack, item, index }) {
  return `<div class="demo-row">
    <div>
      <strong>${escapeHtml(pack.title)}</strong>
      <span>${escapeHtml(item)}</span>
    </div>
    <span class="demo-state-pill">${index === 0 ? "latest" : "earlier"}</span>
  </div>`;
}

function sourceRow({ pack, source }) {
  return `<div class="demo-row">
    <div>
      <strong>${escapeHtml(source)}</strong>
      <span>${escapeHtml(pack.title)} / ${escapeHtml(pack.type)}</span>
    </div>
    ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
  </div>`;
}

function calendarCard(pack) {
  return `<article class="demo-calendar-card">
    <span>${escapeHtml(pack.due)}</span>
    <strong>${escapeHtml(pack.title)}</strong>
    <small>${escapeHtml(pack.status)} / ${escapeHtml(pack.owner)}</small>
    ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
  </article>`;
}

function bindToolbar() {
  const search = el("demo-search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      render();
    });
  }

  document.querySelectorAll(".demo-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.status = filterStatusMessage(state.filter);
      render();
    });
  });
}

function bindLabControls() {
  const select = el("lab-pack-select");
  if (select) {
    select.addEventListener("change", () => {
      const pack = findPack(select.value);
      if (!pack) return;
      state.selectedId = pack.id;
      state.status = selectedWorkStatus("Demo Lab", pack);
      render();
    });
  }

  const run = el("lab-run-action");
  if (run) {
    run.addEventListener("click", () => {
      queueFocus("next", state.selectedId);
      runPrimaryAction(el("primary-action"));
    });
  }

  const setNext = el("lab-set-next");
  if (setNext) {
    setNext.addEventListener("click", () => {
      const pack = currentPack();
      if (!pack) return;
      go("next", pack.id);
    });
  }

  const copy = el("copy-lab-snapshot");
  if (copy) {
    copy.addEventListener("click", () => copyToClipboard(valueOf("lab-snapshot"), clipboardStatus("Demo Lab", "share the lab snapshot"), {
      controlId: "copy-lab-snapshot",
      targetId: "lab-snapshot",
      title: "Lab snapshot copied",
      detail: "The command simulator snapshot is on the clipboard."
    }));
  }
}

function workCard(pack) {
  const selected = pack.id === state.selectedId ? " selected" : "";
  const command = resolvePrimaryCommandForPack(pack);
  return `<article class="demo-work-card${selected}" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-card-head">
      <button type="button" class="demo-card-title" data-action="select">${escapeHtml(pack.title)}</button>
      <span class="demo-state-pill">${escapeHtml(pack.status)}</span>
    </div>
    <div class="demo-command-row">
      <div>
        <span>Button runs next</span>
        <strong>${escapeHtml(command.label)}</strong>
      </div>
      ${primaryCommandButton(pack)}
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(pack.blocker === "none" ? "Blocker: none" : pack.blocker)}</span>
      <span>${escapeHtml(formatDue(pack))}</span>
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    ${relevantMemoryCardStrip(pack)}
    ${actionReceiptCard(pack)}
    <details class="demo-card-support" data-support-actions="work-card">
      <summary>
        <span>Support actions</span>
        <strong>Inspect or change path without replacing Button runs next</strong>
      </summary>
      <div class="demo-card-actions">
        ${supportActionButton("open", "Open", pack, "btn btn-sm")}
        ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
        ${supportActionButton("block", "Block", pack, "btn btn-sm")}
        ${supportActionButton("done", "Finish with proof", pack, "btn btn-sm")}
      </div>
    </details>
  </article>`;
}

function todayRow(pack) {
  return `<div class="demo-row">
    <div>
      <strong>${escapeHtml(pack.title)}</strong>
      <span>${escapeHtml(formatDue(pack))} / ${escapeHtml(pack.owner)}</span>
    </div>
    <div class="demo-row-actions">
      ${primaryCommandButton(pack, "btn btn-sm btn-primary")}
      ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
    </div>
  </div>`;
}

function reviewCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  const doneAction = command.action === "done"
    ? supportActionButton("done", "Finish with proof", pack)
    : "";
  const blockerAction = hasBlocker(pack)
    ? supportActionButton("unblock", "Clear blocker", pack)
    : supportActionButton("block", "Mark blocked", pack);

  return `<article class="demo-review-card" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-command-lines compact">
      ${factLine("Where", pack.title)}
      ${factLine("Blocker", blockerTextForPack(pack))}
      ${factLine("Button runs next", command.label)}
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(pack.status)}</span>
      <span>${escapeHtml(formatDue(pack))}</span>
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    ${relevantMemoryCardStrip(pack)}
    ${actionReceiptCard(pack)}
    <div class="demo-card-actions">
      ${primaryCommandButton(pack)}
      ${supportActionButton("focus", "Focus", pack)}
      ${supportActionButton("edit", "Edit", pack)}
      ${doneAction}
    </div>
    <details class="demo-card-support">
      <summary>
        <span>Support setup</span>
        <strong>Clear blocker or set Button runs next</strong>
      </summary>
      <div class="demo-card-actions">
        ${blockerAction}
      </div>
      <div class="demo-inline-form">
        <label class="sr-only" for="next-${escapeAttribute(pack.id)}">Button runs next</label>
        <input id="next-${escapeAttribute(pack.id)}" class="demo-search-input" type="text" value="${escapeAttribute(pack.next)}">
        ${supportActionButton("set-next", "Save Button runs next", pack)}
      </div>
    </details>
  </article>`;
}

function primaryCommandButton(pack, className = "btn btn-primary") {
  const command = resolvePrimaryCommandForPack(pack);
  const copy = helpCopy(primaryCommandReason(pack, command), DEMO_COPY_LIMITS.commandFlowHelp);
  return `<button class="${escapeAttribute(className)}" type="button" data-action="run-next" data-pack="${escapeAttribute(pack.id)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(command.label)}</button>`;
}

function primaryCommandReason(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: ${pack.title}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${command.label}.`;
}

function supportActionButton(action, label, pack, className = "btn") {
  const reason = supportActionReason(action, pack);
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  const visibleReason = supportActionVisibleReason(action);
  const buttonClass = `${className} demo-support-action`;
  return `<button class="${escapeAttribute(buttonClass)}" type="button" data-action="${escapeAttribute(action)}" data-pack="${escapeAttribute(pack.id)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}" data-support-reason="${escapeAttribute(visibleReason)}"><span class="demo-support-label">${escapeHtml(label)}</span><small class="demo-support-reason">${escapeHtml(visibleReason)}</small></button>`;
}

function supportActionReason(action, pack) {
  const where = pack?.title || "selected work";
  const reasons = {
    open: `Open the work path for ${where} without running the main button.`,
    focus: `Show ${where} in the Focus view without changing status.`,
    block: `Mark ${where} blocked for this sample.`,
    unblock: `Clear the blocker for ${where}; the demo stores Blocker: none automatically.`,
    done: `Finish ${where} and keep the proof target in the receipt.`,
    edit: `Open the work path fields for ${where}.`,
    "set-next": `Choose the exact Button runs next action for ${where}.`
  };
  return reasons[action] || `Run ${actionLabelFromKey(action)} for ${where}.`;
}

function supportActionVisibleReason(action) {
  const reasons = {
    open: "Open fields without running next.",
    focus: "Inspect without changing status.",
    block: "Add a blocker for review.",
    unblock: "Stores Blocker: none.",
    done: "Finish with proof visible.",
    edit: "Edit forward path fields.",
    "set-next": "Choose the exact next button."
  };
  return reasons[action] || "Secondary action.";
}

function bindWorkCards() {
  document.querySelectorAll(".demo-work-card button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".demo-work-card");
      handlePackAction(card.dataset.packId, button.dataset.action);
    });
  });
}

function bindListActions() {
  el("screen-content").querySelectorAll("[data-action]").forEach((button) => {
    if (button.closest(".demo-work-card")) {
      return;
    }

    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "set-due-today") {
        const today = todayIsoDate();
        state.packs.forEach((pack) => { if (pack.status !== "done") pack.due = today; });
        state.status = dueTodayStatus(today);
      } else if (action === "validate-sample") {
        const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
        state.status = validationStatus(attention);
      } else if (action === "set-next") {
        const pack = findPack(button.dataset.pack);
        if (pack) {
          const input = el(`next-${pack.id}`);
          state.selectedId = pack.id;
          if (input) {
            const result = setPackNextAction(pack, input.value);
            setNextConfirmation(pack, result);
          } else {
            state.status = selectedWorkStatus("Next setup", pack, "choose Button runs next");
            go("next", pack.id);
            return;
          }
        }
      } else {
        handlePackAction(button.dataset.pack, action);
        return;
      }
      render();
    });
  });
}

function actionLabelFromKey(action) {
  const labels = {
    select: "Select",
    "run-next": "Run next",
    review: "Review",
    "set-next": "Set Button runs next",
    start: "Start",
    unblock: "Unblock",
    block: "Block",
    done: "Finish with proof",
    focus: "Focus",
    edit: "Open",
    open: "Open"
  };

  return labels[action] || (typeof action === "string" ? capitalize(action) : "Action");
}

function setActionConfirmation(pack, action) {
  if (!pack) return;

  const next = resolvePrimaryCommandForPack(pack);
  const actionLabel = actionLabelFromKey(action);
  setActionReceipt(
    pack,
    `${actionLabel} finished for ${pack.title}.`,
    next
  );
}

function setPackActionConfirmation(pack, action, changed) {
  if (!pack) return;

  const actionLabel = actionLabelFromKey(action);
  const summary = packActionSummary(pack, action, actionLabel, changed);
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function packActionSummary(pack, action, actionLabel, changed) {
  if (action === "done") {
    const proof = proofTargetSentence(pack);
    return changed
      ? `Done for ${pack.title}. ${proof}`
      : `No done change for ${pack.title}. ${proof}`;
  }

  return changed
    ? `${actionLabel} updated ${pack.title}.`
    : `No ${actionLabel.toLowerCase()} change for ${pack.title}.`;
}

function setSaveConfirmation(pack, changed) {
  if (!pack) return;

  const proof = proofTargetSentence(pack);
  const summary = changed
    ? `Work path saved for ${pack.title}. ${proof}`
    : `No work path changes for ${pack.title}. ${proof}`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setNextConfirmation(pack, result) {
  if (!pack) return;

  const summary = result.changed
    ? `Button runs next set to ${result.next} for ${pack.title}.`
    : `Button already runs ${result.next} for ${pack.title}.`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setCreateConfirmation(pack) {
  if (!pack) return;

  const next = resolvePrimaryCommandForPack(pack);
  setActionReceipt(
    pack,
    `Created ${pack.title}. Where: ${pack.status}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next.label}.`,
    next
  );
}

function setMemoryConfirmation(pack, result) {
  if (!pack) return;

  const summary = result.added
    ? `Memory note added for ${pack.title}.`
    : `Memory note already exists for ${pack.title}.`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setActionReceipt(pack, summary, next = resolvePrimaryCommandForPack(pack)) {
  const outcomeSummary = normalizeCopy(summary);
  const fullSummary = actionReceiptSummary(outcomeSummary, pack, next);
  const receipt = {
    packId: pack.id,
    summary: fullSummary,
    visibleSummary: visibleCopy(outcomeSummary || fullSummary, DEMO_COPY_LIMITS.receiptVisible),
    where: `${pack.title} / ${pack.status}`,
    blocker: blockerTextForPack(pack),
    next: next.label,
    proof: proofTargetForPack(pack)
  };

  state.status = receipt.summary;
  state.actionReceipt = receipt;
  queueFocus("card-result", pack.id);
}

function actionReceiptSummary(summary, pack, next) {
  return helpCopy(`${summary} ${actionReceiptContext(pack, next, summary)}`, DEMO_COPY_LIMITS.receiptHelp);
}

function actionReceiptContext(pack, next, summary = "") {
  const proof = /(^|\s)Proof target:/iu.test(summary)
    ? ""
    : ` Proof target: ${proofTargetForPack(pack)}.`;
  return `Where: ${pack.title} / ${pack.status}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next.label}.${proof}`;
}

function updateActionReceipt() {
  const receiptElement = el("command-receipt");
  if (!receiptElement) return;

  const receipt = normalizeActionReceipt(state.actionReceipt);
  if (!receipt) {
    receiptElement.hidden = true;
    receiptElement.innerHTML = "";
    delete receiptElement.dataset.receiptKind;
    delete receiptElement.dataset.receiptTone;
    return;
  }

  receiptElement.hidden = false;
  receiptElement.dataset.receiptKind = receipt.kind || "action";
  receiptElement.dataset.receiptTone = receipt.tone || "success";
  const fullSummary = helpCopy(receipt.summary, DEMO_COPY_LIMITS.receiptHelp);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  const eyebrow = receipt.kind === "clipboard"
    ? receipt.tone === "blocked" ? "Clipboard blocked" : "Clipboard ready"
    : "Last result";
  receiptElement.innerHTML = `
    <div class="demo-command-receipt-head" title="${escapeAttribute(fullSummary)}" aria-label="${escapeAttribute(fullSummary)}">
      <span>${escapeHtml(eyebrow)}</span>
      <strong>${escapeHtml(visibleSummary)}</strong>
    </div>
    <div class="demo-command-receipt-lines">
      ${receiptLine("Where", receipt.where)}
      ${receiptLine("Blocker", receipt.blocker)}
      ${receiptLine("Button runs next", receipt.next)}
      ${receiptLine("Proof target", receipt.proof)}
    </div>`;
}

function actionReceiptCard(pack) {
  const receipt = normalizeActionReceipt(state.actionReceipt);
  if (!pack || !receipt || receipt.packId !== pack.id) {
    return "";
  }

  const fullSummary = helpCopy(receipt.summary, DEMO_COPY_LIMITS.receiptHelp);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  const nextLine = visibleCopy(`Now: Blocker ${receipt.blocker}. Button runs next ${receipt.next}.`, DEMO_COPY_LIMITS.commandFlowVisible);
  return `<div class="demo-card-receipt" data-card-receipt="${escapeAttribute(pack.id)}" role="status" tabindex="-1" title="${escapeAttribute(fullSummary)}" aria-label="${escapeAttribute(fullSummary)}">
    <span>Last result</span>
    <strong>${escapeHtml(visibleSummary)}</strong>
    <small>${escapeHtml(nextLine)}</small>
  </div>`;
}

function routeActionReceiptPanel(visiblePacks, routeLabel) {
  const receipt = normalizeActionReceipt(state.actionReceipt);
  const visibleIds = new Set((visiblePacks || []).map((pack) => pack.id));
  if (!receipt?.packId || visibleIds.has(receipt.packId)) {
    return "";
  }

  const pack = findPack(receipt.packId);
  if (!pack) {
    return "";
  }

  const fullSummary = helpCopy(receipt.summary, DEMO_COPY_LIMITS.receiptHelp);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  const nextLine = visibleCopy(`Out of ${routeLabel}. Blocker ${receipt.blocker}. Next ${receipt.next}.`, DEMO_COPY_LIMITS.commandFlowVisible);
  return `<div class="demo-card-receipt demo-route-receipt" data-route-receipt="${escapeAttribute(pack.id)}" role="status" tabindex="-1" title="${escapeAttribute(fullSummary)}" aria-label="${escapeAttribute(fullSummary)}">
    <span>Last result</span>
    <strong>${escapeHtml(visibleSummary)}</strong>
    <small>${escapeHtml(nextLine)}</small>
  </div>`;
}

function receiptLine(label, value) {
  return `<div>
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function latestRelevantMemory(pack) {
  return normalizeCopy(pack?.memory?.find((note) => normalizeCopy(note)));
}

function normalizeActionReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return null;
  }

  const summary = normalizeCopy(receipt.summary);
  const visibleSummary = normalizeCopy(receipt.visibleSummary);
  const packId = normalizeCopy(receipt.packId);
  const where = normalizeCopy(receipt.where);
  const blocker = normalizeCopy(receipt.blocker);
  const next = normalizeCopy(receipt.next);
  const proof = normalizeCopy(receipt.proof) || normalizeCopy(receipt.doneWhen) || "No proof target set.";
  if (!summary || !where || !blocker || !next) {
    return null;
  }

  return {
    kind: normalizeCopy(receipt.kind) || "action",
    tone: normalizeCopy(receipt.tone) || "success",
    packId,
    summary,
    visibleSummary: visibleSummary || visibleCopy(summary, DEMO_COPY_LIMITS.receiptVisible),
    where,
    blocker,
    next,
    proof
  };
}

function proofTargetForPack(pack) {
  return normalizeCopy(pack?.doneWhen) || "No proof target set.";
}

function proofTargetSentence(pack) {
  return `Proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function sentenceValue(value) {
  return (normalizeCopy(value) || "No proof target set").replace(/[.!?]+$/u, "");
}

function addPackActivity(pack, message) {
  const copy = normalizeCopy(message);
  if (!pack || !copy) {
    return false;
  }

  pack.activity = Array.isArray(pack.activity) ? pack.activity : [];
  if (pack.activity[0] === copy) {
    return false;
  }

  pack.activity.unshift(copy);
  return true;
}

function addPackMemoryNote(pack, note) {
  const copy = normalizeCopy(note);
  if (!pack || !copy) {
    return { added: false, note: copy };
  }

  pack.memory = Array.isArray(pack.memory) ? pack.memory : [];
  const duplicate = pack.memory.some((existing) => normalizeCopy(existing) === copy);
  if (duplicate) {
    return { added: false, note: copy };
  }

  pack.memory.unshift(copy);
  addPackActivity(pack, "Memory note added.");
  return { added: true, note: copy };
}

function setPackNextAction(pack, value) {
  const next = normalizeCopy(value) || "Open";
  const beforeNext = normalizeCopy(pack?.next);
  const beforeBlocker = normalizeCopy(pack?.blocker);

  if (!pack) {
    return { changed: false, next };
  }

  pack.next = next;
  if (pack.blocker === "missing Button runs next") {
    pack.blocker = "none";
  }

  const changed = beforeNext !== next || beforeBlocker !== normalizeCopy(pack.blocker);
  if (changed) {
    addPackActivity(pack, `Button runs next changed to ${next}.`);
  }

  return { changed, next };
}

function packActionSignature(pack) {
  return JSON.stringify({
    status: pack?.status || "",
    blocker: pack?.blocker || "",
    next: pack?.next || ""
  });
}

function applyNextChoice(id) {
  const pack = findPack(id);
  if (!pack) return;

  const choice = valueOf("next-action-choice") || "Open";
  const result = setPackNextAction(pack, choice);
  state.selectedId = pack.id;
  setNextConfirmation(pack, result);
  go("work", pack.id);
}

function bindGoButtons() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      go(button.dataset.go, button.dataset.pack || "");
    });
  });
}

function handlePackAction(id, action) {
  const pack = findPack(id);
  if (!pack) return;
  state.selectedId = pack.id;

  if (action === "select") {
    state.status = selectedWorkStatus("Work list", pack);
  } else if (action === "run-next") {
    runResolvedPackAction(pack);
    return;
  } else if (action === "review") {
    state.status = selectedWorkStatus("Review", pack);
    go("review", pack.id);
    return;
  } else if (action === "set-next") {
    state.status = selectedWorkStatus("Next setup", pack, "choose Button runs next");
    go("next", pack.id);
    return;
  } else if (action === "start") {
    const before = packActionSignature(pack);
    pack.status = "active";
    pack.blocker = pack.blocker === "missing setup" ? "none" : pack.blocker;
    pack.next = pack.next === "Choose next action" ? "Open" : pack.next;
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Started.");
    }
    setPackActionConfirmation(pack, "start", changed);
  } else if (action === "unblock") {
    const before = packActionSignature(pack);
    pack.status = "active";
    pack.blocker = "none";
    pack.next = "Open";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Unblocked.");
    }
    setPackActionConfirmation(pack, "unblock", changed);
  } else if (action === "block") {
    const before = packActionSignature(pack);
    pack.status = "blocked";
    pack.blocker = "blocked in this sample";
    pack.next = "Unblock";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocked.");
    }
    setPackActionConfirmation(pack, "block", changed);
  } else if (action === "done") {
    const before = packActionSignature(pack);
    pack.status = "done";
    pack.blocker = "none";
    pack.next = "Open";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Marked done.");
    }
    setPackActionConfirmation(pack, "done", changed);
  } else if (action === "focus") {
    setActionConfirmation(pack, "focus");
    go("focus", pack.id);
    return;
  } else if (action === "edit") {
    queueFocus("pack-edit", pack.id);
    setActionConfirmation(pack, "edit");
    go("pack", pack.id);
    return;
  } else if (action === "memory") {
    queueFocus("memory-note", pack.id);
    state.status = memoryRouteStatus(pack);
    go("memory", pack.id);
    return;
  } else if (action === "open") {
    queueFocus("pack-detail", pack.id);
    const changed = addPackActivity(pack, "Opened.");
    setPackActionConfirmation(pack, "open", changed);
    go("pack", pack.id);
    return;
  } else {
    go("pack", pack.id);
    return;
  }

  render();
}

function runPrimaryAction(control = el("primary-action")) {
  const action = control?.dataset.action || el("primary-action").dataset.action;
  const targetPackId = control?.dataset.pack || el("primary-action").dataset.pack;
  if (pendingForwardPathBlocksAction(targetPackId)) {
    return;
  }
  applyPendingForwardPathForAction(targetPackId);
  if (action === "run-next") {
    runResolvedPackAction(findPack(targetPackId) || currentPack());
    return;
  }

  if (runRouteAction(action, targetPackId)) {
    return;
  }

  const pack = findPack(targetPackId) || currentPack();
  if (!pack) {
    state.status = noSelectedWorkStatus();
    render();
    return;
  }

  const resolved = resolvePrimaryCommandForPack(pack);
  handlePackAction(pack.id, action || resolved.action);
}

function runResolvedPackAction(pack) {
  if (!pack) {
    state.status = noSelectedWorkStatus();
    render();
    return;
  }

  const resolved = resolvePrimaryCommandForPack(pack);
  if (runRouteAction(resolved.action, resolved.targetPackId)) {
    return;
  }

  handlePackAction(pack.id, resolved.action);
}

function pendingPackForAction(targetPackId) {
  const pack = findPack(targetPackId) || currentPack();
  const form = el("pack-edit-form");
  if (!pack || !form || form.dataset.packId !== pack.id) {
    return null;
  }

  return pendingPackFromForwardPathForm(pack);
}

function applyPendingForwardPathForAction(targetPackId) {
  const pack = findPack(targetPackId) || currentPack();
  const form = el("pack-edit-form");
  if (!pack || !form || form.dataset.packId !== pack.id) {
    return false;
  }

  if (blockerModeIssue()) {
    return false;
  }

  return applyPackForwardPathFormValues(pack);
}

function pendingForwardPathBlocksAction(targetPackId) {
  const pack = findPack(targetPackId) || currentPack();
  const form = el("pack-edit-form");
  if (!pack || !form || form.dataset.packId !== pack.id) {
    return false;
  }

  const issue = blockerModeIssue();
  if (!issue) {
    return false;
  }

  state.status = `Where: Forward path. Blocker: ${issue} Button runs next: choose Unblocked or enter a blocker reason.`;
  syncPackDetailValidation(pack);
  requestAnimationFrame(() => focusCommandTarget("pack-blocker", pack.id));
  return true;
}

function runRouteAction(action, targetPackId) {
  if (action === "fix-blocker-mode") {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      queueFocus("pack-blocker", selected.id);
      state.status = "Where: Forward path. Blocker: blocked mode needs a real blocker. Button runs next: choose Unblocked or enter a blocker reason.";
      render();
    }
    return true;
  }

  if (action === "route-review") {
    const pack = findPack(targetPackId) || preferredReviewPack();
    if (pack) {
      state.selectedId = pack.id;
      go("review", pack.id);
    } else {
      go("review");
    }
    return true;
  }

  if (action === "open-work-list") {
    go("work", targetPackId || "");
    return true;
  }

  if (action === "set-next") {
    const selected = findPack(targetPackId) || currentPack();
    if (state.route === "next") {
      if (!selected) {
        state.status = noSelectedWorkStatus("choose work before setting Button runs next");
        render();
        return true;
      }
      applyNextChoice(selected.id);
      return true;
    }

    if (selected) {
      state.selectedId = selected.id;
      go("next", selected.id);
      return true;
    }

    go("next");
    return true;
  }

  if (action === "review") {
    const selected = findPack(targetPackId) || currentPack();
    if (!selected) {
      const review = preferredReviewPack();
      if (review) {
        state.selectedId = review.id;
        go("review", review.id);
      } else {
        go("review");
      }
      return true;
    }

    if (state.route === "pack") {
      state.selectedId = selected.id;
      queueFocus(reviewFocusKindForPack(selected), selected.id);
      state.status = selectedWorkStatus("Work path", selected, "edit blocker fields");
      render();
      return true;
    }

    if (state.route !== "review") {
      state.selectedId = selected.id;
      go("review", selected.id);
      return true;
    }

    const routeCommand = resolvePrimaryCommandForPack(selected);
    if (routeCommand.action !== "review") {
      return runRouteAction(routeCommand.action, routeCommand.targetPackId);
    }

    go("pack", selected.id);
    return true;
  }

  if (action === "open" && state.route === "pack") {
    const pack = findPack(targetPackId) || currentPack();
    go("work", pack?.id || "");
    return true;
  }

  if (action === "focus" && state.route === "focus") {
    const pack = findPack(targetPackId) || currentPack();
    go("work", pack?.id || "");
    return true;
  }

  if (action === "parse-triage") {
    if (state.route !== "triage") {
      go("triage");
      return true;
    }

    const input = el("triage-input");
    state.triageInput = input?.value || state.triageInput || "";
    state.triageRows = parseTriageText(state.triageInput);
    state.status = triageParsedStatus(state.triageRows.length);
    queueFocus("triage-output");
    render();
    return true;
  }

  if (action === "copy-triage") {
    if (state.route !== "triage") {
      go("triage");
      return true;
    }

    syncTriageRowsFromDom();
    if (!state.triageRows.length && state.triageInput.trim()) {
      state.triageRows = parseTriageText(state.triageInput);
    }

    if (!state.triageRows.length) {
      state.status = triageStatus("no rows are ready to copy", "parse or add a row");
      render();
      return true;
    }

    copyToClipboard(triageMarkdown(state.triageRows), clipboardStatus("Triage", "paste Markdown into handoff"), {
      controlId: "copy-triage-markdown",
      targetId: "triage-snapshot",
      title: "Triage Markdown copied",
      detail: `${state.triageRows.length} triage row(s) are on the clipboard as Markdown.`
    });
    return true;
  }

  if (action === "create-sample") {
    createSamplePack();
    return true;
  }

  if (action === "search-demo") {
    state.status = routeStatus("Search", "browser-local sample data only", "review filtered work");
    render();
    return true;
  }

  if (action === "validate-sample") {
    const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
    state.status = validationStatus(attention);
    render();
    return true;
  }

  if (action === "add-note") {
    const pack = findPack(targetPackId) || currentPack();
    const input = el("memory-note");
    if (state.route !== "memory") {
      queueFocus("memory-note", pack?.id || "");
      state.status = memoryRouteStatus(pack);
      go("memory", pack?.id || "");
      return true;
    }
    if (pack && input?.value.trim()) {
      const result = addPackMemoryNote(pack, input.value);
      setMemoryConfirmation(pack, result);
    } else {
      state.status = memoryRouteStatus(pack);
    }
    render();
    return true;
  }

  if (action === "apply-profile") {
    state.status = profileStatus(state.copyProfile);
    render();
    return true;
  }

  if (action === "refresh-health") {
    state.status = routeStatus("Health", "none", "review current demo checks");
    render();
    return true;
  }

  if (action === "report-feedback") {
    if (state.route !== "feedback") {
      go("feedback");
      return true;
    }
    state.status = routeStatus("Feedback", "none", "copy context or open issue");
    render();
    return true;
  }

  if (action === "refresh-meta") {
    refreshMetaDiagnostics();
    return true;
  }

  return false;
}

function reviewFocusKindForPack(pack) {
  const blocker = blockerTextForPack(pack).toLowerCase();
  if (blocker.includes("owner")) {
    return "support-owner";
  }

  if (blocker.includes("button runs next")) {
    return "next";
  }

  return "pack-blocker";
}

function commandActionForLabel(label) {
  label = (label || "Open").trim() || "Open";
  const normalized = label.toLowerCase();

  if (normalized === "review" || normalized === "review work" || normalized === "review blocker") {
    return { label: normalized === "review blocker" ? "Review blocker" : "Review work", action: "review" };
  }

  if (normalized === "set next" || normalized === "set button runs next" || normalized === "choose next action") {
    return { label: "Set Button runs next", action: "set-next" };
  }

  if (normalized === "validate sample") {
    return { label, action: "validate-sample" };
  }

  if (normalized === "focus") {
    return { label, action: "focus" };
  }

  if (normalized === "unblock") {
    return { label, action: "unblock" };
  }

  if (normalized === "start") {
    return { label, action: "start" };
  }

  if (normalized === "done" || normalized === "complete" || normalized === "finish with proof") {
    return { label: "Finish with proof", action: "done" };
  }

  return { label: label === "Open" ? "Open" : label, action: "open" };
}

function defaultCreateValues() {
  return {
    title: "New sample work",
    owner: "Sample owner",
    next: "Open",
    due: "2026-06-30",
    purpose: "Describe why this sample work matters."
  };
}

function createFormValues() {
  return {
    title: valueOf("new-title"),
    owner: valueOf("new-owner"),
    next: valueOf("new-next"),
    due: valueOf("new-due"),
    purpose: valueOf("new-purpose")
  };
}

function createSaveState(values) {
  const workflow = initialWorkflowForCreatedPack(values.title, values.owner, values.next);
  const canSave = workflow.blocker === "none";
  const next = canSave ? "Save sample" : createActionForBlocker(workflow.blocker);

  return {
    ...workflow,
    canSave,
    help: `Where: Create. Blocker: ${workflow.blocker}. Button runs next: ${next}.`
  };
}

function createActionForBlocker(blocker) {
  if (blocker === "missing title") {
    return "fill title";
  }

  if (blocker === "missing owner") {
    return "fill owner";
  }

  if (blocker === "missing Button runs next") {
    return "fill Button runs next";
  }

  return "Save sample";
}

function bindCreateValidation() {
  ["new-title", "new-owner", "new-next"].forEach((id) => {
    el(id)?.addEventListener("input", syncCreateValidation);
  });
  syncCreateValidation();
}

function syncCreateValidation() {
  const button = el("create-sample");
  const help = el("create-save-help");
  if (!button || !help) {
    return;
  }

  const stateForSave = createSaveState(createFormValues());
  help.textContent = stateForSave.help;
  syncValidatedActionButton(button, stateForSave);
}

function memoryNoteSaveState(pack, note) {
  if (!pack) {
    return {
      canSave: false,
      help: "Where: Memory. Blocker: no sample work is selected. Button runs next: choose work before adding memory."
    };
  }

  if (!String(note || "").trim()) {
    return {
      canSave: false,
      help: `Where: Memory. Blocker: memory note is empty. Button runs next: type a note for ${pack.title}.`
    };
  }

  return {
    canSave: true,
    help: `Where: Memory. Blocker: none. Button runs next: add memory note to ${pack.title}.`
  };
}

function memoryRouteStatus(pack) {
  return pack
    ? `Where: Memory / ${pack.title}. Blocker: memory note is empty. Button runs next: type a note for ${pack.title}.`
    : "Where: Memory. Blocker: no sample work is selected. Button runs next: choose work before adding memory.";
}

function bindMemoryValidation(pack) {
  el("memory-note")?.addEventListener("input", () => syncMemoryValidation(pack));
  syncMemoryValidation(pack);
}

function syncMemoryValidation(pack) {
  const button = el("add-memory");
  const help = el("memory-note-help");
  if (!button || !help) {
    return;
  }

  const stateForSave = memoryNoteSaveState(pack, valueOf("memory-note"));
  help.textContent = stateForSave.help;
  syncValidatedActionButton(button, stateForSave);
}

function packDetailSaveState(pack) {
  if (!pack) {
    return {
      canSave: false,
      help: "Where: Forward path. Blocker: no sample work is selected. Button runs next: choose work before saving."
    };
  }

  const blockerIssue = blockerModeIssue();
  if (blockerIssue) {
    return {
      canSave: false,
      help: `Where: Forward path. Blocker: ${blockerIssue} Button runs next: choose Unblocked or enter a blocker reason.`
    };
  }

  const changed = packForwardPathFormSignature(pack) !== packForwardPathSignature(pack);
  if (!changed) {
    return {
      canSave: false,
      help: "Where: Forward path. Blocker: no changes to save. Button runs next: edit a field first."
    };
  }

  const pending = pendingPackFromForwardPathForm(pack);
  return {
    canSave: true,
    help: `Where: Forward path. Blocker: ${blockerTextForPack(pending)}. Button runs next: save forward path for ${pending.title}.`
  };
}

function bindPackDetailValidation(pack) {
  ["edit-title", "edit-status", "edit-blocker", "edit-owner", "edit-due", "edit-next", "edit-done-when", "edit-purpose"].forEach((id) => {
    const input = el(id);
    input?.addEventListener("input", () => syncPackDetailValidation(pack));
    input?.addEventListener("change", () => {
      if (id === "edit-status") {
        syncBlockerModeFromStatus();
      }
      syncPackDetailValidation(pack);
    });
  });
  document.querySelectorAll("[data-blocker-mode]").forEach((button) => {
    button.addEventListener("change", () => {
      setBlockerMode(button.value === "set");
      syncPackDetailValidation(pack);
    });
  });
  syncPackDetailValidation(pack);
}

function syncBlockerModeFromStatus() {
  const status = valueOf("edit-status");
  if (status === "blocked") {
    setBlockerMode(true);
    return;
  }
  if (status === "active" || status === "done") {
    setBlockerMode(false);
  }
}

function setBlockerMode(hasBlocker) {
  const clear = el("edit-blocker-clear");
  const set = el("edit-blocker-set");
  const input = el("edit-blocker");
  const status = el("edit-status");
  const next = el("edit-next");
  const help = document.querySelector("[data-blocker-help]");
  const reason = document.querySelector("[data-blocker-reason]");
  const clearLabel = document.querySelector('[data-blocker-mode-label="clear"]');
  const setLabel = document.querySelector('[data-blocker-mode-label="set"]');
  if (clear) clear.checked = !hasBlocker;
  if (set) set.checked = hasBlocker;
  clearLabel?.classList.toggle("active", !hasBlocker);
  setLabel?.classList.toggle("active", hasBlocker);
  if (status && hasBlocker && valueOf("edit-status") !== "blocked") {
    status.value = "blocked";
  }
  if (status && !hasBlocker && valueOf("edit-status") === "blocked") {
    status.value = "active";
  }
  if (!hasBlocker && next && isBlockerReviewAction(next.value)) {
    next.value = "Open";
  }
  if (input) {
    input.disabled = !hasBlocker;
    if (hasBlocker && !normalizeCopy(input.value)) {
      input.value = "needs review";
    }
    if (hasBlocker) {
      input.focus();
    }
  }
  if (reason) {
    reason.hidden = !hasBlocker;
  }
  syncBlockerFieldHelp();
}

function isBlockerReviewAction(value) {
  const normalized = normalizeCopy(value).toLowerCase();
  return normalized === "review"
    || normalized === "review work"
    || normalized === "review blocker"
    || normalized === "unblock";
}

function syncPackDetailValidation(pack) {
  const button = el("save-pack");
  const help = el("pack-save-help");
  if (!button || !help) {
    return;
  }

  const stateForSave = packDetailSaveState(pack);
  syncBlockerFieldHelp();
  syncPackDetailForwardPanel(pack);
  help.textContent = stateForSave.help;
  syncValidatedActionButton(button, stateForSave);
}

function blockerModeIssue() {
  const field = document.querySelector("[data-blocker-field]");
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const blocker = normalizeCopy(el("edit-blocker")?.value).toLowerCase();
  if (!field || selected?.value !== "set" || blocker !== "none") {
    return "";
  }

  return "Blocked mode needs a real blocker; use Unblocked to store Blocker: none.";
}

function syncBlockerFieldHelp() {
  const field = document.querySelector("[data-blocker-field]");
  const input = el("edit-blocker");
  const help = document.querySelector("[data-blocker-help]");
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const hasBlocker = selected?.value === "set";
  const issue = blockerModeIssue();
  field?.classList.toggle("invalid", Boolean(issue));
  if (input) {
    if (issue) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
  if (help) {
    help.textContent = issue || (hasBlocker
      ? "Describe what must be cleared before the next action."
      : "Unblocked stores Blocker: none automatically; no typing required.");
  }
}

function syncPackDetailForwardPanel(pack) {
  if (!pack) {
    return;
  }

  const pending = pendingPackFromForwardPathForm(pack);
  const command = resolvePrimaryCommandForPack(pending);
  const issue = blockerModeIssue();
  const panel = document.querySelector('[data-forward-motion="pack-detail"]');
  const head = panel?.querySelector(".demo-forward-head strong");
  const where = panel?.querySelector('[data-command-field="where"] strong');
  const blocker = panel?.querySelector('[data-command-field="blocker"] strong');
  const next = panel?.querySelector('[data-command-field="button-runs-next"] strong');
  if (where) where.textContent = `${pending.title} / ${pending.status}`;
  if (issue) {
    if (head) head.textContent = "Choose Unblocked";
    if (blocker) blocker.textContent = issue;
    if (next) next.textContent = "Choose Unblocked";
    const invalidCommand = commandForRoute(pending, filteredPacks().length, state.packs.filter(isReview).length);
    invalidCommand.blocker = issue;
    invalidCommand.next = "Choose Unblocked";
    invalidCommand.action = "fix-blocker-mode";
    invalidCommand.targetPackId = pending.id;
    invalidCommand.stateText = "Fix blocker";
    invalidCommand.flowHint = "Flow: fix blocker state, then save.";
    updateCommand(invalidCommand);
    return;
  }

  if (head) head.textContent = command.label;
  if (blocker) blocker.textContent = blockerTextForPack(pending);
  if (next) next.textContent = command.label;
  updateCommand(commandForRoute(pending, filteredPacks().length, state.packs.filter(isReview).length));
}

function pendingPackFromForwardPathForm(pack) {
  return {
    ...pack,
    ...packForwardPathFormValues(pack)
  };
}

function syncValidatedActionButton(button, stateForAction) {
  const copy = helpCopy(stateForAction.help, DEMO_COPY_LIMITS.commandFlowHelp);
  button.disabled = !stateForAction.canSave;
  button.title = copy;
  button.setAttribute("aria-description", copy);
  button.removeAttribute("aria-label");
  if (stateForAction.canSave) {
    delete button.dataset.disabledReason;
    return;
  }

  button.dataset.disabledReason = copy;
}

function createSamplePack() {
  const values = createFormValues();
  const stateForSave = createSaveState(values);
  if (!stateForSave.canSave) {
    state.status = stateForSave.help;
    syncCreateValidation();
    return;
  }

  const title = values.title;
  const owner = values.owner;
  const next = values.next;
  const workflow = initialWorkflowForCreatedPack(title, owner, next);
  const id = uniquePackId(slugify(title));
  const pack = {
    id,
    title,
    type: state.copyProfile,
    status: workflow.status,
    blocker: workflow.blocker,
    next,
    due: values.due,
    owner,
    purpose: values.purpose || "Sample work created in the static demo.",
    doneWhen: "Sample result is described.",
    sources: ["browser-state"],
    memory: ["Created in the static demo. Nothing was saved to local files."],
    activity: ["Created."]
  };
  state.packs.unshift(pack);
  state.selectedId = pack.id;
  setCreateConfirmation(pack);
  go("pack", pack.id);
}

function initialWorkflowForCreatedPack(title, owner, next) {
  if (!normalizeCopy(title)) {
    return { status: "draft", blocker: "missing title" };
  }

  if (isPlaceholderNext(next)) {
    return { status: "draft", blocker: "missing Button runs next" };
  }

  const normalizedOwner = normalizeCopy(owner).toLowerCase();
  if (!normalizedOwner || normalizedOwner === "unassigned" || normalizedOwner === "no owner") {
    return { status: "draft", blocker: "missing owner" };
  }

  return { status: "active", blocker: "none" };
}

function uniquePackId(baseId) {
  const root = baseId || "new-sample-work";
  let id = root;
  let suffix = 2;
  while (findPack(id)) {
    id = `${root}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function savePackDetail(id) {
  const pack = findPack(id);
  if (!pack) return;
  const stateForSave = packDetailSaveState(pack);
  if (!stateForSave.canSave) {
    state.status = stateForSave.help;
    render();
    return;
  }
  const changed = applyPackForwardPathFormValues(pack);
  setSaveConfirmation(pack, changed);
  render();
}

function applyPackForwardPathFormValues(pack) {
  const before = packForwardPathSignature(pack);
  const values = packForwardPathFormValues(pack);
  pack.title = values.title || pack.title;
  pack.status = values.status || pack.status;
  pack.blocker = values.blocker;
  pack.owner = values.owner || pack.owner;
  pack.due = values.due;
  pack.next = values.next || pack.next;
  pack.doneWhen = values.doneWhen || pack.doneWhen;
  pack.purpose = values.purpose || pack.purpose;
  pack.blocker = pack.status === "done" ? "none" : pack.blocker;
  if (pack.status === "blocked" && pack.blocker === "none") {
    pack.status = "active";
  }
  const changed = packForwardPathSignature(pack) !== before;
  if (changed) {
    addPackActivity(pack, "Forward path changed.");
  }
  return changed;
}

function packForwardPathSignature(pack) {
  return JSON.stringify({
    title: pack.title || "",
    status: pack.status || "",
    blocker: pack.blocker || "",
    owner: pack.owner || "",
    due: pack.due || "",
    next: pack.next || "",
    doneWhen: pack.doneWhen || "",
    purpose: pack.purpose || ""
  });
}

function packForwardPathFormSignature(pack) {
  return JSON.stringify(packForwardPathFormValues(pack));
}

function packForwardPathFormValues(pack) {
  const fieldValue = (id, fallback = "") => {
    const input = el(id);
    return input ? valueOf(id) : (fallback || "");
  };
  const blockerInput = el("edit-blocker");
  const rawStatus = fieldValue("edit-status", pack.status) || pack.status || "";
  const blockerMode = document.querySelector('input[name="edit-blocker-mode"]:checked')?.value === "set" ? "set" : "clear";
  const rawBlocker = blockerMode === "set"
    ? normalizeCopy(blockerInput?.value || "") || "needs review"
    : "none";
  const blocker = rawStatus === "done" ? "none" : rawBlocker;
  const status = forwardPathStatusForBlocker(rawStatus, blocker);

  return {
    title: fieldValue("edit-title", pack.title) || pack.title || "",
    status,
    blocker,
    owner: fieldValue("edit-owner", pack.owner) || pack.owner || "",
    due: fieldValue("edit-due", pack.due),
    next: fieldValue("edit-next", pack.next) || pack.next || "",
    doneWhen: fieldValue("edit-done-when", pack.doneWhen) || pack.doneWhen || "",
    purpose: fieldValue("edit-purpose", pack.purpose) || pack.purpose || ""
  };
}

function forwardPathStatusForBlocker(status, blocker) {
  const normalizedStatus = normalizeCopy(status) || "active";
  if (normalizedStatus === "done") {
    return "done";
  }
  if (normalizedStatus === "draft") {
    return "draft";
  }
  if (blocker && blocker !== "none") {
    return "blocked";
  }
  if (normalizedStatus === "blocked") {
    return "active";
  }
  return normalizedStatus;
}

function filteredPacks() {
  const query = state.query.trim().toLowerCase();
  return state.packs.filter((pack) => {
    const filterMatch =
      state.filter === "all" ||
      (state.filter === "review" && isReview(pack)) ||
      pack.status === state.filter;
    const haystack = `${pack.title} ${pack.next} ${pack.owner} ${pack.due} ${pack.blocker} ${pack.sources.join(" ")}`.toLowerCase();
    return filterMatch && (!query || haystack.includes(query));
  });
}

function countByFilter() {
  const counts = Object.fromEntries(filters.map(([key]) => [key, 0]));
  counts.all = state.packs.length;
  for (const pack of state.packs) {
    counts[pack.status] = (counts[pack.status] ?? 0) + 1;
    if (isReview(pack)) counts.review += 1;
  }
  return counts;
}

function currentPack() {
  return findPack(state.selectedId);
}

function findPack(id) {
  return state.packs.find((pack) => pack.id === id);
}

function isReview(pack) {
  return hasBlocker(pack) || isMissingNextAction(pack) || commandActionForLabel(pack?.next).action === "review";
}

function isMissingNextAction(pack) {
  const label = (pack?.next || "").trim().toLowerCase();
  return isPlaceholderNext(label);
}

function isPlaceholderNext(label) {
  const value = String(label || "").trim().toLowerCase();
  return !value || value === "choose next action" || value === "set button runs next" || value === "set next";
}

function hasBlocker(pack) {
  return Boolean(pack && (pack.status === "blocked" || (pack.blocker && pack.blocker !== "none")));
}

function blockerTextForPack(pack) {
  if (!pack) {
    return "choose sample work";
  }

  if (pack.blocker && pack.blocker !== "none") {
    return pack.blocker;
  }

  if (isMissingNextAction(pack)) {
    return "missing Button runs next";
  }

  if (pack.status === "blocked") {
    return "blocked";
  }

  return "none";
}

function preferredReviewPack() {
  return state.packs.find((pack) => isReview(pack) && isMissingNextAction(pack))
    || state.packs.find((pack) => isReview(pack) && hasBlocker(pack))
    || state.packs.find(isReview)
    || state.packs[0]
    || null;
}

function preferredNextSetupPack() {
  return state.packs.find(isMissingNextAction) || preferredReviewPack();
}

function formatDue(pack) {
  return pack.due ? `Due ${pack.due}` : "No due date";
}

function profile() {
  return copyProfiles[state.copyProfile] || copyProfiles.general;
}

function metricCard(label, value, note) {
  return `<section class="demo-metric">
    <span class="kpi-label">${escapeHtml(label)}</span>
    <strong class="kpi-value">${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
  </section>`;
}

function navButton(route, label, className = "btn") {
  const reason = routeButtonReason(route, label);
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<button class="${escapeAttribute(className)}" type="button" data-go="${escapeAttribute(route)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(label)}</button>`;
}

function routeButtonReason(route, label) {
  const reasons = {
    work: "Open the work list to choose one sample pack.",
    triage: "Open triage to turn pasted work into Where, Blocker, and Button runs next.",
    today: "Open dated work and run the next action from due items.",
    review: "Open review work and resolve the next blocker.",
    next: "Open Button runs next setup for review work.",
    lab: "Open Demo Lab to inspect the selected command state.",
    meta: "Open Meta to inspect routes, assets, and build metadata.",
    create: "Create sample work with required forward-motion fields.",
    memory: "Open Memory to add recall notes to selected work.",
    settings: "Change the static demo copy profile.",
    feedback: "Open feedback with the current demo context."
  };
  return reasons[route] || `Open ${label}.`;
}

function factBlock(label, value) {
  return `<div class="demo-fact">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value || "none")}</strong>
  </div>`;
}

function factLine(label, value) {
  return `<div class="demo-command-line" data-command-field="${escapeAttribute(fieldKey(label))}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value || "none")}</strong>
  </div>`;
}

function relevantMemoryStrip(pack) {
  const latest = latestRelevantMemory(pack);
  const visible = latest
    ? visibleCopy(latest, DEMO_COPY_LIMITS.memoryVisible)
    : "none yet";
  const help = latest
    ? `Relevant Memory: ${latest}`
    : "Relevant Memory: none yet. How to fill: add a memory note from the Memory route.";
  const actionHelp = memoryStripActionHelp(pack);

  return `<div class="demo-memory-strip" data-memory-strip="selected-work" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      ${latest ? "" : `<small>How to fill: add a memory note from here or from the Memory route.</small>`}
    </div>
    <button class="btn btn-sm demo-memory-action" type="button" data-action="memory" data-pack="${escapeAttribute(pack?.id || "")}"${controlLabelAttributes(actionHelp)}>Add note</button>
  </div>`;
}

function relevantMemoryCardStrip(pack) {
  if (!pack || pack.id !== state.selectedId) {
    return "";
  }

  const latest = latestRelevantMemory(pack);
  const visible = latest
    ? visibleCopy(latest, DEMO_COPY_LIMITS.memoryVisible)
    : "none yet";
  const help = latest
    ? `Relevant Memory: ${latest}`
    : "Relevant Memory: none yet. Add a memory note from the selected work path.";
  const actionHelp = memoryStripActionHelp(pack);

  return `<div class="demo-memory-strip compact" data-memory-strip="selected-card" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      ${latest ? "" : `<small>How to fill: open Memory or selected work to add recall.</small>`}
    </div>
    <button class="btn btn-sm demo-memory-action" type="button" data-action="memory" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(actionHelp)}>Add note</button>
  </div>`;
}

function memoryStripActionHelp(pack) {
  return pack
    ? `Where: Relevant Memory / ${pack.title}. Blocker: memory note is empty. Button runs next: add memory note.`
    : "Where: Relevant Memory. Blocker: no sample work is selected. Button runs next: choose work before adding memory.";
}

function workPathStrip(pack, command = resolvePrimaryCommandForPack(pack)) {
  const current = workPathStage(pack, command);
  const steps = workPathSteps();

  return `<div class="demo-work-path" data-work-path="selected-work" aria-label="${escapeAttribute(`Work path: ${current}. Next: ${command.label}.`)}">
    <span class="section-label">Work path</span>
    <div class="demo-work-path-steps">
      ${steps.map((step) => `<span class="demo-work-path-step${step.id === current ? " active" : ""}" title="${escapeAttribute(step.help)}" aria-current="${step.id === current ? "step" : "false"}">${escapeHtml(step.label)}</span>`).join("")}
    </div>
    <strong>Next: ${escapeHtml(command.label)}</strong>
  </div>`;
}

function workPathSteps() {
  return [
    { id: "draft", label: "Draft", help: "Set the forward path." },
    { id: "review", label: "Review", help: "Clear the blocker or run the next action." },
    { id: "proof", label: "Proof", help: "Run the next action and keep the proof target visible." },
    { id: "done", label: "Done", help: "Finish when proof is ready." }
  ];
}

function workPathStage(pack, command = resolvePrimaryCommandForPack(pack)) {
  if (!pack) {
    return "draft";
  }

  if (pack.status === "done") {
    return "done";
  }

  if (pack.status === "draft" || isMissingNextAction(pack)) {
    return "draft";
  }

  if (hasBlocker(pack)) {
    return "review";
  }

  return command.action === "done" || normalizeCopy(pack.doneWhen) ? "proof" : "review";
}

function inputField(id, label, value) {
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <input id="${escapeAttribute(id)}" type="text" value="${escapeAttribute(value || "")}">
  </label>`;
}

function textField(id, label, value) {
  return `<label class="demo-field demo-field-wide" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <textarea id="${escapeAttribute(id)}" rows="4">${escapeHtml(value || "")}</textarea>
  </label>`;
}

function selectField(id, label, options, selected) {
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <select id="${escapeAttribute(id)}">
      ${options.map((option) => `<option value="${escapeAttribute(option)}"${option === selected ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
    </select>
  </label>`;
}

function disabledReasonAttributes(disabled, reason) {
  if (!disabled) {
    return "";
  }

  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return ` disabled title="${escapeAttribute(copy)}" aria-description="${escapeAttribute(copy)}" data-disabled-reason="${escapeAttribute(copy)}"`;
}

function controlHelpAttributes(disabled, reason, describedById) {
  if (disabled) {
    return disabledReasonAttributes(true, reason);
  }

  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}" aria-describedby="${escapeAttribute(describedById)}"`;
}

function controlLabelAttributes(reason) {
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}"`;
}

function disabledReasonNotice(disabled, reason) {
  if (!disabled) {
    return "";
  }

  const copy = visibleCopy(reason, DEMO_COPY_LIMITS.commandFlowVisible);
  const help = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<p class="demo-disabled-reason" title="${escapeAttribute(help)}">Blocked: ${escapeHtml(copy)}</p>`;
}

function recentActivityPanel() {
  const rows = state.packs.flatMap((pack) => pack.activity.slice(0, 2).map((item) => ({ pack, item }))).slice(0, 6);
  return `<section class="demo-panel">
    <div class="demo-panel-head">
      <div>
        <span class="section-label">Activity</span>
        <h2>Recent simulated changes</h2>
      </div>
    </div>
    <div class="demo-list">${rows.map(({ pack, item }) => `<div class="demo-row"><div><strong>${escapeHtml(pack.title)}</strong><span>${escapeHtml(item)}</span></div></div>`).join("")}</div>
  </section>`;
}

function activityPanel(pack) {
  return `<section class="demo-panel">
    <div class="demo-panel-head">
      <div>
        <span class="section-label">Activity</span>
        <h2>Sample activity record</h2>
      </div>
    </div>
    <div class="demo-list">${pack.activity.map((item) => `<div class="demo-note">${escapeHtml(item)}</div>`).join("")}</div>
  </section>`;
}

async function collectStyleAudit() {
  const assets = await Promise.all(STYLE_AUDIT_ASSETS.map(readAuditAsset));
  const cssAssets = assets.filter((asset) => asset.type === "css");
  const jsAssets = assets.filter((asset) => asset.type === "js");
  const ok = assets.every((asset) => asset.status);

  return {
    status: ok ? "ready" : "partial",
    generatedAt: new Date().toISOString(),
    assets,
    totals: {
      cssBytes: sumBy(cssAssets, "bytes"),
      cssLines: sumBy(cssAssets, "lines"),
      jsBytes: sumBy(jsAssets, "bytes"),
      jsLines: sumBy(jsAssets, "lines"),
      bytes: sumBy(assets, "bytes"),
      lines: sumBy(assets, "lines")
    }
  };
}

async function readAuditAsset(asset) {
  try {
    const response = await fetch(asset.path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const text = await response.text();
    return {
      ...asset,
      status: true,
      bytes: new Blob([text]).size,
      lines: countTextLines(text),
      selectors: asset.type === "css" ? countCssSelectors(text) : 0
    };
  } catch (error) {
    return {
      ...asset,
      status: false,
      bytes: 0,
      lines: 0,
      selectors: 0,
      error: error.message || "asset fetch failed"
    };
  }
}

function refreshMetaDiagnostics() {
  state.status = routeStatus("Meta", "diagnostics are refreshing", "wait for updated checks");
  render();
  collectStyleAudit().then((styleAudit) => {
    state.styleAudit = styleAudit;
    state.status = routeStatus("Meta", "none", "review recomputed diagnostics");
    if (state.route === "meta") {
      render();
    }
  });
}

function buildMetadata(rawMetadata = {}) {
  const fallbackVersion = DEMO_DEFAULT_VERSION;
  const releaseNotesUrl = rawMetadata?.releaseNotesUrl || DEMO_RELEASE_NOTES_URL;
  return {
    version: rawMetadata?.version || fallbackVersion,
    commit: rawMetadata?.commit || "unknown",
    generatedAt: rawMetadata?.generatedAt || rawMetadata?.generated || new Date().toISOString(),
    releaseNotesUrl,
    repository: rawMetadata?.repository || DEMO_REPO_URL,
    profileApplied: rawMetadata?.profileApplied || state.copyProfile,
    scenario: rawMetadata?.scenario || state.scenarioId
  };
}

function stateVersionLabel() {
  const version = state.metadata?.version || DEMO_DEFAULT_VERSION;
  const source = state.metadata?.commit && state.metadata.commit !== "unknown"
    ? ` (${state.metadata.commit.slice(0, 7)})`
    : "";
  return `${version}${source}`;
}

function storageStateLabel() {
  const match = /-v(\d+)$/u.exec(DEMO_STORAGE_KEY);
  return match ? `v${match[1]}` : "v?";
}

function bindScenarioCards() {
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      const scenario = DEMO_SCENARIO_BY_ID[button.dataset.scenario];
      if (!scenario) return;
      syncSearchParam("scenario", scenario.id);
      applyScenario(scenario, { force: true, applyRoute: true });
      if (scenario.route) {
        go(scenario.route);
      }
    });
  });
}

function syncSearchParam(key, value) {
  const params = new URLSearchParams(location.search);
  if (value == null || value === "") {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const suffix = params.toString();
  const next = `${location.pathname}${suffix ? `?${suffix}` : ""}${location.hash}`;
  history.replaceState({}, "", next);
}

function buildHealthChecks() {
  const routeContract = routeContractStatus();
  const disabledReasons = disabledReasonCoverageStatus();
  const checks = [
    {
      label: "Demo metadata loaded",
      status: Boolean(state.metadata && state.metadata.version),
      detail: state.metadata?.version ? `Version ${state.metadata.version}` : "Metadata not available."
    },
    {
      label: "Theme system",
      status: Boolean(state.metadata),
      detail: document.documentElement.classList.contains("dark") ? "Dark mode active." : "Light mode active."
    },
    {
      label: "Local storage state",
      status: canUseLocalStorage(DEMO_STORAGE_KEY),
      detail: "localStorage state persisted for demo actions."
    },
    {
      label: "Scenario selected",
      status: Boolean(DEMO_SCENARIO_BY_ID[state.scenarioId]),
      detail: `Scenario ${state.scenarioId} applied.`
    },
    {
      label: "Route resolved",
      status: isKnownRoute(state.route),
      detail: `Current route: ${state.route}.`
    },
    {
      label: "Route contract",
      status: routeContract.status,
      detail: routeContract.detail
    },
    {
      label: "Disabled control reasons",
      status: disabledReasons.status,
      detail: disabledReasons.detail
    },
    {
      label: "Pack list loaded",
      status: Array.isArray(state.packs) && state.packs.length > 0,
      detail: `${state.packs.length} sample packs available.`
    },
    {
      label: "Style audit assets",
      status: state.styleAudit?.status === "ready",
      detail: styleAuditSummary()
    }
  ];
  return checks;
}

function styleAuditSummary() {
  const audit = state.styleAudit;
  if (!audit) {
    return "Asset budget is still loading.";
  }

  const failed = audit.assets.filter((asset) => !asset.status);
  if (failed.length > 0) {
    return `${failed.length} style audit asset(s) could not be measured.`;
  }

  return `${audit.totals.cssLines} CSS LOC and ${formatBytes(audit.totals.cssBytes)} measured.`;
}

function copyLimitStatus() {
  const limits = copyLimitsSnapshot();
  const status = limits.commandFlow.visible > 0
    && limits.commandFlow.help >= limits.commandFlow.visible
    && limits.receipt.help >= limits.receipt.visible
    && limits.status.help >= limits.status.visible;
  return {
    status,
    detail: `Visible/help budgets: command ${limits.commandFlow.visible}/${limits.commandFlow.help}, receipt ${limits.receipt.visible}/${limits.receipt.help}, status ${limits.status.visible}/${limits.status.help}.`
  };
}

function copyLimitsSnapshot() {
  return {
    commandFlow: {
      visible: DEMO_COPY_LIMITS.commandFlowVisible,
      help: DEMO_COPY_LIMITS.commandFlowHelp
    },
    memory: {
      visible: DEMO_COPY_LIMITS.memoryVisible
    },
    receipt: {
      visible: DEMO_COPY_LIMITS.receiptVisible,
      help: DEMO_COPY_LIMITS.receiptHelp
    },
    status: {
      visible: DEMO_COPY_LIMITS.statusVisible,
      help: DEMO_COPY_LIMITS.statusHelp
    }
  };
}

function routeContractStatus() {
  const navRouteIds = navItems.map(([id]) => id);
  const routeIds = Object.keys(ROUTE_CONTRACT);
  const missingContracts = navRouteIds.filter((route) => !ROUTE_CONTRACT[route]);
  const missingNavEntries = routeIds.filter((route) => route !== "pack" && !navRouteIds.includes(route));
  const invalidPackPatterns = routeIds.filter((route) => {
    const contract = ROUTE_CONTRACT[route];
    return Boolean(contract.acceptsPackId) !== contract.pattern.includes("{packId}");
  });
  const parsed = parseHashRoute(location.hash);
  const unknownPackId = Boolean(parsed.packId && state.packs.length > 0 && !findPack(parsed.packId));
  const status = missingContracts.length === 0
    && missingNavEntries.length === 0
    && invalidPackPatterns.length === 0
    && !unknownPackId
    && !parsed.malformedPackId
    && !parsed.unexpectedPackId
    && parsed.extraSegments.length === 0;

  if (!status) {
    const issues = [
      missingContracts.length ? `missing contracts: ${missingContracts.join(", ")}` : "",
      missingNavEntries.length ? `missing nav: ${missingNavEntries.join(", ")}` : "",
      invalidPackPatterns.length ? `invalid pack patterns: ${invalidPackPatterns.join(", ")}` : "",
      unknownPackId ? `unknown pack id: ${parsed.packId}` : "",
      parsed.malformedPackId ? "malformed pack id fragment" : "",
      parsed.unexpectedPackId ? `unexpected pack id for ${parsed.route}` : "",
      parsed.extraSegments.length ? `extra route segments: ${parsed.extraSegments.join("/")}` : ""
    ].filter(Boolean);

    return {
      status: false,
      routeCount: routeIds.length,
      currentRoute: parsed.route,
      currentPattern: parsed.pattern,
      detail: issues.join("; ")
    };
  }

  return {
    status: true,
    routeCount: routeIds.length,
    currentRoute: parsed.route,
    currentPattern: parsed.pattern,
    detail: parsed.fallback
      ? `${routeIds.length} hash route contract(s) aligned; unknown route ${parsed.requestedRoute} resolved to #/home.`
      : `${routeIds.length} hash route contract(s) aligned; current pattern ${parsed.pattern}.`
  };
}

function buildStyleAuditSnapshot() {
  const audit = state.styleAudit || emptyStyleAudit();
  const routeContract = routeContractStatus();
  return {
    status: audit.status,
    generatedAt: audit.generatedAt,
    storageKey: DEMO_STORAGE_KEY,
    routeCount: routeContract.routeCount,
    currentRoute: state.route,
    routeContract,
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    copyLimits: copyLimitsSnapshot(),
    commandSync: commandSyncStatus(),
    currentOverflow: currentOverflowStatus(),
    disabledReasonCoverage: disabledReasonCoverageStatus(),
    metadata: {
      version: state.metadata?.version || DEMO_DEFAULT_VERSION,
      commit: state.metadata?.commit || "unknown",
      generatedAt: state.metadata?.generatedAt || ""
    },
    assets: audit.assets.map((asset) => ({
      id: asset.id,
      label: asset.label,
      path: asset.path,
      type: asset.type,
      status: asset.status,
      lines: asset.lines,
      bytes: asset.bytes,
      selectors: asset.selectors,
      error: asset.error || ""
    })),
    totals: audit.totals
  };
}

function emptyStyleAudit() {
  return {
    status: "loading",
    generatedAt: "",
    assets: STYLE_AUDIT_ASSETS.map((asset) => ({
      ...asset,
      status: false,
      lines: 0,
      bytes: 0,
      selectors: 0
    })),
    totals: {
      cssBytes: 0,
      cssLines: 0,
      jsBytes: 0,
      jsLines: 0,
      bytes: 0,
      lines: 0
    }
  };
}

function styleAuditChecks() {
  const audit = buildStyleAuditSnapshot();
  const cssAssets = audit.assets.filter((asset) => asset.type === "css");
  const jsAsset = audit.assets.find((asset) => asset.id === "demoJs");

  return [
    ...cssAssets.map((asset) => ({
      label: `${asset.label} measured`,
      status: asset.status,
      detail: asset.status
        ? `${asset.lines} LOC, ${formatBytes(asset.bytes)}, ${asset.selectors} selector block(s).`
        : asset.error || "Could not measure asset."
    })),
    {
      label: "Demo JS measured",
      status: Boolean(jsAsset?.status),
      detail: jsAsset?.status
        ? `${jsAsset.lines} LOC, ${formatBytes(jsAsset.bytes)}.`
        : jsAsset?.error || "Could not measure demo script."
    },
    {
      label: "State key reset",
      status: DEMO_STORAGE_KEY.endsWith("-v6"),
      detail: DEMO_STORAGE_KEY
    },
    {
      label: "Route contract",
      status: audit.routeContract.status,
      detail: audit.routeContract.detail
    },
    {
      label: "Command controls sync",
      status: audit.commandSync.status,
      detail: audit.commandSync.detail
    },
    {
      label: "Current route overflow",
      status: audit.currentOverflow.status,
      detail: audit.currentOverflow.detail
    },
    {
      label: "Disabled control reasons",
      status: audit.disabledReasonCoverage.status,
      detail: audit.disabledReasonCoverage.detail
    },
    {
      label: "Copy budgets",
      status: copyLimitStatus().status,
      detail: copyLimitStatus().detail
    },
    {
      label: "Export metadata",
      status: Boolean(state.metadata?.generatedAt),
      detail: state.metadata?.generatedAt
        ? `Generated ${new Date(state.metadata.generatedAt).toLocaleString()}.`
        : "Generated timestamp not available."
    }
  ];
}

function collectLabSnapshot(pack, action, styleAudit, smokeChecks = labSmokeChecks(pack, styleAudit)) {
  return {
    route: state.route,
    routeHash: location.hash,
    selectedWork: pack
      ? {
          id: pack.id,
          title: pack.title,
          status: pack.status,
          blocker: blockerTextForPack(pack),
          buttonRunsNext: pack.next,
          resolvedLabel: action.label,
          resolvedAction: action.action
        }
      : null,
    commandBrief: {
      where: el("command-where")?.textContent.trim() || "",
      blocker: el("command-blocker")?.textContent.trim() || "",
      buttonRunsNext: el("command-next")?.textContent.trim() || "",
      primaryAction: el("primary-action")?.dataset.action || "",
      primaryPack: el("primary-action")?.dataset.pack || ""
    },
    focusTargets: {
      where: formatRouteHash("work", pack?.id || ""),
      blocker: pack && isReview(pack) ? formatRouteHash("review", pack.id) : formatRouteHash("review"),
      buttonRunsNext: pack && isMissingNextAction(pack) ? formatRouteHash("next", pack.id) : "current command action"
    },
    styleAudit: {
      status: styleAudit.status,
      cssLines: styleAudit.totals.cssLines,
      cssBytes: styleAudit.totals.cssBytes,
      routeCount: styleAudit.routeCount
    },
    smokeReplay: smokeChecks.map((check) => ({
      label: check.label,
      status: check.status,
      detail: check.detail
    })),
    timestamp: new Date().toISOString()
  };
}

function labSmokeChecks(pack, styleAudit, disabledReasons = null) {
  const action = resolvePrimaryCommandForPack(pack);
  const sync = commandSyncStatus();
  const overflow = currentOverflowStatus();
  const disabledReasonCheck = disabledReasons ? [{
    label: "Disabled control reasons",
    status: disabledReasons.status,
    detail: disabledReasons.detail
  }] : [];

  return [
    {
      label: "Selected work",
      status: Boolean(pack),
      detail: pack ? `${pack.title} is loaded into the lab.` : "No sample work is selected."
    },
    {
      label: "Blocker visible",
      status: Boolean(pack),
      detail: blockerTextForPack(pack)
    },
    {
      label: "Button resolves",
      status: Boolean(pack && action.action),
      detail: pack ? `${action.label} resolves to ${action.action}.` : "No action resolved."
    },
    {
      label: "Bottom bar focus",
      status: true,
      detail: "Where, Blocker, and Button runs next scroll to active targets."
    },
    {
      label: "Header and dock sync",
      status: sync.status,
      detail: sync.detail
    },
    {
      label: "Current route overflow",
      status: overflow.status,
      detail: overflow.detail
    },
    ...disabledReasonCheck,
    {
      label: "Style audit ready",
      status: styleAudit.status === "ready",
      detail: `${styleAudit.totals.cssLines} CSS LOC measured.`
    }
  ];
}

function styleAuditMetric(assetId, field) {
  const asset = (state.styleAudit || emptyStyleAudit()).assets.find((item) => item.id === assetId);
  if (!asset?.status) {
    return "n/a";
  }

  return asset[field] ?? "n/a";
}

function styleAuditDetail(assetId) {
  const asset = (state.styleAudit || emptyStyleAudit()).assets.find((item) => item.id === assetId);
  if (!asset?.status) {
    return asset?.error || "Asset not measured yet.";
  }

  return `${formatBytes(asset.bytes)} / ${asset.selectors || 0} selector block(s).`;
}

function commandSyncStatus() {
  const primary = el("primary-action");
  const dock = el("dock-next");
  const dockLabel = el("dock-next-label");
  const primaryLabel = primary?.textContent.trim() || "";
  const bottomLabel = dockLabel?.textContent.trim() || "";
  const labelsMatch = primaryLabel === bottomLabel;
  const actionMatches = (primary?.dataset.action || "") === (dock?.dataset.action || "");
  const packMatches = (primary?.dataset.pack || "") === (dock?.dataset.pack || "");
  const status = Boolean(primary && dock && labelsMatch && actionMatches && packMatches);

  return {
    status,
    detail: status
      ? `${primaryLabel} is wired to the same action in header and dock.`
      : "Header and dock action wiring do not match."
  };
}

function currentOverflowStatus() {
  const width = document.documentElement.clientWidth;
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
  const overflow = Math.max(0, scrollWidth - width);

  return {
    status: overflow <= 1,
    overflow,
    detail: overflow <= 1
      ? "No current horizontal overflow."
      : `${overflow}px horizontal overflow on this route.`
  };
}

function disabledReasonCoverageStatus() {
  const controls = Array.from(document.querySelectorAll("button:disabled, select:disabled, input:disabled, textarea:disabled, [aria-disabled='true']"))
    .filter(isDisabledAuditCandidate);
  const missing = controls.filter((control) => !disabledControlReason(control));

  return {
    status: missing.length === 0,
    count: controls.length,
    missing: missing.map(disabledControlLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${controls.length} disabled control(s) on this route explain why.`
      : `${missing.length} disabled control(s) need a reason: ${missing.map(disabledControlLabel).slice(0, 3).join(", ")}.`
  };
}

function isDisabledAuditCandidate(control) {
  if (control.hidden || control.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(control);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return control.getClientRects().length > 0;
}

function disabledControlReason(control) {
  const direct = [
    control.getAttribute("data-disabled-reason"),
    control.getAttribute("title"),
    control.getAttribute("aria-description"),
    control.getAttribute("aria-label")
  ].find((value) => normalizeCopy(value));
  if (direct) {
    return direct;
  }

  const describedBy = (control.getAttribute("aria-describedby") || "")
    .split(/\s+/u)
    .map((id) => document.getElementById(id)?.textContent || "")
    .find((value) => normalizeCopy(value));
  if (describedBy) {
    return describedBy;
  }

  const nearby = control.closest(".demo-panel, .demo-card, .demo-work-card, .demo-command-brief")
    ?.querySelector(".demo-disabled-reason")?.textContent;
  return normalizeCopy(nearby) ? nearby : "";
}

function disabledControlLabel(control) {
  return control.id
    || control.getAttribute("data-action")
    || control.getAttribute("data-go")
    || control.textContent.trim()
    || control.tagName.toLowerCase();
}

function healthLine(check) {
  return `<div class="demo-row">
    <div>
      <strong>${escapeHtml(check.label)}</strong>
      <span>${escapeHtml(check.detail)}</span>
    </div>
    <span class="demo-state-pill">${check.status ? "pass" : "attention"}</span>
  </div>`;
}

function canUseLocalStorage(storageKey) {
  try {
    const key = `__projects_demo_health_${storageKey}`;
    localStorage.setItem(key, "1");
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value === "1";
  } catch {
    return false;
  }
}

function collectDiagnosticContext() {
  return {
    profile: state.copyProfile,
    scenario: state.scenarioId,
    route: state.route,
    routeHash: location.hash,
    search: location.search,
    version: stateVersionLabel(),
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    metricSource: state.metadata,
    styleAudit: buildStyleAuditSnapshot(),
    packCount: state.packs.length,
    reviewCount: state.packs.filter(isReview).length,
    timestamp: new Date().toISOString()
  };
}

function copyButton(controlId, label, className, help, describedById) {
  const receipt = clipboardReceiptFor(controlId);
  const stateClass = receipt
    ? receipt.kind === "success" ? " is-copied" : " is-blocked"
    : "";
  const visibleLabel = receipt
    ? receipt.kind === "success" ? "Copied - paste ready" : "Copy manually"
    : label;
  return `<button id="${escapeAttribute(controlId)}" class="${escapeAttribute(`${className}${stateClass}`)}" type="button"${controlHelpAttributes(false, help, describedById)}>${escapeHtml(visibleLabel)}</button>`;
}

function copyPayloadClass(targetId) {
  const targetState = clipboardTargetState(targetId);
  return `demo-inline-form demo-copy-payload${targetState ? ` ${targetState}` : ""}`;
}

function clipboardNoticePanel(controlId) {
  const receipt = clipboardReceiptFor(controlId);
  if (!receipt) {
    return "";
  }

  const eyebrow = receipt.kind === "success" ? "Clipboard ready" : "Manual copy needed";
  const targetLabel = receipt.targetLabel || clipboardTargetLabel(receipt.targetId);
  const stepOne = receipt.kind === "success" ? "Copied" : "Blocked";
  const stepTwo = receipt.kind === "success" ? "Preview opened" : `${targetLabel} visible`;
  const stepThree = receipt.kind === "success" ? "Paste ready" : "Copy manually";
  const targetActionLabel = receipt.kind === "success" ? "Select copied text" : "Select visible text";
  const targetAction = receipt.targetId
    ? `<button class="btn btn-sm demo-clipboard-target-action" type="button" data-copy-target="${escapeAttribute(receipt.targetId)}">${escapeHtml(targetActionLabel)}</button>`
    : "";
  return `<div id="clipboard-notice-${escapeAttribute(controlId)}" class="demo-clipboard-notice ${escapeAttribute(receipt.kind)}" role="status" tabindex="-1">
    <div class="demo-clipboard-notice-head">
      <span>${escapeHtml(eyebrow)}</span>
      <strong>${escapeHtml(receipt.title)}</strong>
    </div>
    <div class="demo-clipboard-steps" aria-label="${escapeAttribute(eyebrow)}">
      <span class="demo-clipboard-step active">${escapeHtml(stepOne)}</span>
      <span class="demo-clipboard-step active">${escapeHtml(stepTwo)}</span>
      <span class="demo-clipboard-step">${escapeHtml(stepThree)}</span>
    </div>
    <span class="demo-clipboard-detail">${escapeHtml(receipt.detail)}</span>
    <div class="demo-clipboard-next">
      <span>Button runs next</span>
      <strong>${escapeHtml(receipt.next)}</strong>
    </div>
    ${clipboardPayloadPreviewPanel(receipt)}
    ${targetAction ? `<div class="demo-clipboard-actions">${targetAction}</div>` : ""}
    <small>${escapeHtml(receipt.at)}</small>
  </div>`;
}

function clipboardReceiptFor(controlId) {
  const receipt = state.clipboardReceipt;
  if (!receipt || receipt.route !== state.route || receipt.controlId !== controlId) {
    return null;
  }

  return receipt;
}

function clipboardTargetIsActive(targetId) {
  const receipt = state.clipboardReceipt;
  return Boolean(receipt && receipt.route === state.route && receipt.targetId === targetId);
}

function clipboardTargetState(targetId) {
  const receipt = state.clipboardReceipt;
  if (!receipt || receipt.route !== state.route || receipt.targetId !== targetId) {
    return "";
  }

  return receipt.kind === "success" ? "is-copied" : "is-blocked";
}

function setClipboardReceipt(kind, options = {}) {
  const success = kind === "success";
  const title = options.title || (success ? "Copied to clipboard" : "Clipboard blocked");
  const detail = options.detail || (success
    ? "The selected snapshot is on the clipboard."
    : "Browser clipboard access was blocked. Select the visible text and copy it manually.");
  const next = options.next || (success ? "Paste where needed" : "Copy visible text manually");
  const proof = options.proof || (success
    ? "Clipboard contains the copied demo payload."
    : "The visible payload remains available for manual selection.");
  const targetLabel = options.targetLabel || clipboardTargetLabel(options.targetId);
  const payloadPreview = normalizeClipboardPayload(options.payloadPreview);
  state.clipboardReceipt = {
    kind: success ? "success" : "blocked",
    route: state.route,
    controlId: options.controlId || "",
    targetId: options.targetId || "",
    targetLabel,
    title,
    detail,
    next,
    proof,
    payloadPreview,
    payloadTruncated: Boolean(options.payloadTruncated),
    at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
  };
  setClipboardCommandReceipt(state.clipboardReceipt);
}

function setClipboardCommandReceipt(receipt) {
  const routeCommand = commandForRoute(currentPack(), filteredPacks().length, state.packs.filter(isReview).length);
  const success = receipt.kind === "success";
  const summary = normalizeCopy(`${receipt.title}. ${receipt.detail}`);
  const where = `${routeCommand.where || screenTitleForRoute()} / clipboard`;
  const blocker = success ? "none" : "browser blocked clipboard access";
  const next = receipt.next || (success ? "Paste where needed" : "Copy visible text manually");
  const proof = receipt.proof || (success
    ? "Clipboard contains the copied demo payload."
    : "The visible payload remains available for manual selection.");
  state.actionReceipt = {
    kind: "clipboard",
    tone: receipt.kind,
    summary: helpCopy(`${summary} Where: ${where}. Blocker: ${blocker}. Button runs next: ${next}. Proof target: ${proof}.`, DEMO_COPY_LIMITS.receiptHelp),
    visibleSummary: visibleCopy(summary, DEMO_COPY_LIMITS.receiptVisible),
    where,
    blocker,
    next,
    proof
  };
}

function focusClipboardNotice(controlId) {
  if (!controlId) {
    return;
  }

  requestAnimationFrame(() => {
    const notice = el(`clipboard-notice-${controlId}`);
    if (!notice) return;
    notice.focus({ preventScroll: true });
    notice.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function bindClipboardReceiptControls() {
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => {
      selectClipboardTarget(button.dataset.copyTarget || "");
    });
  });

  document.querySelectorAll("[data-clipboard-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      selectClipboardTarget(button.dataset.clipboardPreview || "");
    });
  });
}

function selectClipboardTarget(targetId) {
  const target = targetId ? el(targetId) : null;
  if (!target) {
    return;
  }

  const payload = target.closest(".demo-copy-payload");
  if (payload) {
    payload.classList.remove("is-pulsing");
    void payload.offsetWidth;
    payload.classList.add("is-pulsing");
  }

  target.scrollIntoView({ block: "center", inline: "nearest" });
  if (typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
  if (typeof target.select === "function") {
    target.select();
  }
  if (typeof target.setSelectionRange === "function" && typeof target.value === "string") {
    target.setSelectionRange(0, target.value.length);
  }
}

function copyToClipboard(value, successMessage = clipboardStatus("Feedback", "paste diagnostic context into issue"), options = {}) {
  const targetMatchesPayload = clipboardTargetMatchesValue(value, options.targetId);
  const receiptOptions = {
    ...options,
    targetId: targetMatchesPayload ? options.targetId : "",
    targetLabel: options.targetLabel || clipboardTargetLabel(options.targetId),
    ...clipboardPreviewOptions(value)
  };

  if (copyWithSelectionFallback(value, options.targetId)) {
    state.status = successMessage;
    setClipboardReceipt("success", receiptOptions);
    render();
    focusClipboardNotice(options.controlId);
    return;
  }

  const write = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(value)
    : Promise.reject(new Error("Clipboard API unavailable"));
  write.then(
    () => {
      state.status = successMessage;
      setClipboardReceipt("success", receiptOptions);
      render();
      focusClipboardNotice(options.controlId);
    },
    () => {
      state.status = clipboardBlockedStatus();
      setClipboardReceipt("blocked", {
        ...receiptOptions,
        title: "Clipboard blocked",
        detail: "Browser clipboard access was blocked. Select the visible text and copy it manually."
      });
      render();
      focusClipboardNotice(options.controlId);
    }
  );
}

function clipboardTargetMatchesValue(value, targetId = "") {
  const visibleTarget = targetId ? el(targetId) : null;
  return Boolean(visibleTarget
    && typeof visibleTarget.value === "string"
    && visibleTarget.value === value);
}

function clipboardTargetLabel(targetId = "") {
  const labels = {
    "feedback-context": "Feedback context",
    "lab-snapshot": "Lab snapshot",
    "meta-context": "Meta snapshot",
    "triage-snapshot": "Triage snapshot"
  };
  return labels[targetId] || "Copied payload";
}

function clipboardPreviewOptions(value) {
  const normalized = normalizeClipboardPayload(value);
  const limit = DEMO_COPY_LIMITS.clipboardPayloadPreview;
  return {
    payloadPreview: normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}...` : normalized,
    payloadTruncated: normalized.length > limit
  };
}

function clipboardPayloadPreviewPanel(receipt) {
  const preview = normalizeClipboardPayload(receipt.payloadPreview);
  if (!preview) {
    return "";
  }

  const previewId = `clipboard-preview-${receipt.controlId}`;
  const summary = receipt.payloadTruncated ? "Copied text preview (truncated)" : "Copied text preview";
  return `<details class="demo-clipboard-payload" open>
    <summary>${escapeHtml(summary)}</summary>
    <label class="sr-only" for="${escapeAttribute(previewId)}">${escapeHtml(summary)}</label>
    <textarea id="${escapeAttribute(previewId)}" class="demo-search-input" rows="4" readonly>${escapeHtml(preview)}</textarea>
    <button class="btn btn-sm demo-clipboard-target-action" type="button" data-clipboard-preview="${escapeAttribute(previewId)}">Select preview</button>
  </details>`;
}

function normalizeClipboardPayload(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function copyWithSelectionFallback(value, targetId = "") {
  const visibleTarget = targetId ? el(targetId) : null;
  const canUseVisibleTarget = visibleTarget
    && typeof visibleTarget.select === "function"
    && typeof visibleTarget.value === "string"
    && visibleTarget.value === value;
  const target = canUseVisibleTarget ? visibleTarget : document.createElement("textarea");
  const temporary = target !== visibleTarget;

  if (temporary) {
    target.value = value;
    target.setAttribute("readonly", "");
    target.style.position = "fixed";
    target.style.inset = "0 auto auto -9999px";
    target.style.width = "1px";
    target.style.height = "1px";
    target.style.opacity = "0";
    document.body.appendChild(target);
  }

  try {
    target.focus();
    target.select();
    if (typeof target.setSelectionRange === "function") {
      target.setSelectionRange(0, target.value.length);
    }
    return Boolean(document.execCommand?.("copy"));
  } catch {
    return false;
  } finally {
    if (temporary) {
      target.remove();
    }
  }
}

function clipboardStatus(where, next) {
  return `Where: ${where}. Blocker: none. Button runs next: ${next}.`;
}

function clipboardBlockedStatus() {
  return "Where: Clipboard. Blocker: browser blocked clipboard access. Button runs next: copy from the visible text area.";
}

function emptyState(text, help = "Use the nearby controls or reset demo data.") {
  const context = emptyStateContext();
  return `<div class="demo-empty">
    <strong>${escapeHtml(text)}</strong>
    <span><b>How to fill:</b> ${escapeHtml(help)}</span>
    <small><b>Where:</b> ${escapeHtml(context.where)}</small>
    <small><b>Blocker:</b> ${escapeHtml(context.blocker)}</small>
    <small><b>Button runs next:</b> ${escapeHtml(context.next)}</small>
  </div>`;
}

function emptyStateContext() {
  const command = commandForRoute(currentPack(), filteredPacks().length, state.packs.filter(isReview).length);
  return {
    where: command.where,
    blocker: command.blocker,
    next: command.next
  };
}

function valueOf(id) {
  const input = el(id);
  return input ? input.value.trim() : "";
}

function visibleCopy(value, limit) {
  const normalized = normalizeCopy(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  const hardLimit = Math.max(4, limit);
  const boundary = normalized.lastIndexOf(" ", hardLimit - 4);
  const sliceAt = boundary >= Math.floor(hardLimit * 0.55) ? boundary : hardLimit - 3;
  return `${normalized.slice(0, sliceAt).trimEnd()}...`;
}

function helpCopy(value, limit) {
  return visibleCopy(value, limit);
}

function normalizeCopy(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function countTextLines(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) {
    return 0;
  }

  return normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n").length
    : normalized.split("\n").length;
}

function countCssSelectors(text) {
  return (String(text || "").match(/\{/g) || []).length;
}

function fieldKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cssIdent(value) {
  return window.CSS?.escape
    ? window.CSS.escape(String(value || ""))
    : String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sumBy(items, field) {
  return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(value >= 1024 * 100 ? 0 : 1)} KB`;
}

function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let candidate = slug || "sample-work";
  let suffix = 2;
  while (findPack(candidate)) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
