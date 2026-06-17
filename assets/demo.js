const DEMO_STORAGE_KEY = "projects-static-demo-state-v5";
const LEGACY_DEMO_STORAGE_KEYS = [
  "projects-static-demo-state-v3",
  "projects-static-demo-state-v4"
];
const THEME_STORAGE_KEY = "projects-demo-theme";
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

const state = {
  basePacks: [],
  packs: [],
  route: "home",
  selectedId: "",
  query: "",
  filter: "all",
  status: "Demo actions update browser state only.",
  copyProfile: "general",
  scenarioId: "default",
  metadata: null,
  styleAudit: null,
  pendingFocus: null,
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
  pack: { pattern: "#/pack/{packId}", title: "Pack detail", commandSource: "selected-work", acceptsPackId: true }
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
          due: "2026-06-16"
        })
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
    state.status = "Demo data failed to load.";
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
  const dark = saved ? saved === "dark" : true;
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
    queueFocus("next", event.currentTarget.dataset.pack || state.selectedId);
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
    state.status = `${capitalize(profileParam)} profile applied from URL.`;
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
  if (force || options.skipSave) {
    state.status = current.statusMessage || `${current.label} scenario loaded.`;
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
  state.status = "Demo data reset. Browser state only.";
  syncSearchParam("scenario", null);
  render();
}

function renderNav() {
  el("demo-nav").innerHTML = navItems.map(([route, key, label]) => `
    <a class="demo-nav-item" href="${escapeAttribute(formatRouteHash(route))}" data-route="${route}">
      <span>${escapeHtml(key)}</span>
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
    item.classList.toggle("active", item.dataset.route === state.route);
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
    stats: { title: "Stats command flow", where: "Stats", blocker: "sample counts are calculated in browser state", next: "Review work", stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" },
    notes: { title: "Notes command flow", where: "Notes", blocker: "sample notes are browser-only", next: "Add note", stateText: "Ready", action: "add-note", targetPackId: selectedWorkCommand.targetPackId },
    timeline: { title: "Timeline command flow", where: "Timeline", blocker: "sample activity is browser-only", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    files: { title: "Files command flow", where: "Files", blocker: "sample sources are references only", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    calendar: { title: "Calendar command flow", ...selectedWorkCommand },
    create: { title: "Create command flow", where: "Create", blocker: "required fields are title and Button runs next", next: "Save sample", stateText: "Draft", action: "create-sample", targetPackId: "" },
    memory: { title: "Memory command flow", where: selectedWorkCommand.where, blocker: "sample notes are browser-only", next: "Add note", stateText: "Ready", action: "add-note", targetPackId: selectedWorkCommand.targetPackId },
    lab: { title: "Demo Lab command flow", ...selectedWorkCommand, stateText: "Lab" },
    meta: { title: "Meta command flow", where: "Meta", blocker: "product view and diagnostics are computed locally", next: "Refresh", stateText: "Ready", action: "refresh-meta", targetPackId: "" },
    feedback: { title: "Feedback command flow", where: "Feedback", blocker: `Version ${stateVersionLabel()} is active`, next: "Report feedback", stateText: "Ready", action: "report-feedback", targetPackId: "" },
    health: { title: "Health command flow", where: "Health", blocker: "route, storage, data, and metadata checks are running", next: "Refresh", stateText: "Ready", action: "refresh-health", targetPackId: "" },
    settings: { title: "Settings command flow", where: "Settings", blocker: "copy profile changes labels only in this static demo", next: "Apply profile", stateText: "Ready", action: "apply-profile", targetPackId: "" },
    pack: { title: "Pack detail command flow", ...selectedWorkCommand }
  };

  const routeCommand = routeCommands[state.route] || routeCommands.work;
  return {
    ...routeCommand,
    stateText: capitalize(routeCommand.stateText),
    scope: `Scope: ${visibleCount} of ${state.packs.length} sample work items visible.`,
    targetPackId: routeCommand.targetPackId || ""
  };
}

function selectedPackCommand(selected) {
  const resolvedAction = resolvePrimaryCommandForSelectedPack(selected);
  return {
    where: selected?.title || "No sample work selected",
    blocker: blockerTextForPack(selected),
    next: resolvedAction.label,
    stateText: selected?.status || "Ready",
    action: resolvedAction.action,
    targetPackId: resolvedAction.targetPackId
  };
}

function resolvePrimaryCommandForSelectedPack(selected) {
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
  el("primary-action").textContent = command.next;
  el("primary-action").dataset.action = command.action || "";
  el("primary-action").dataset.pack = command.targetPackId || "";
  el("primary-action").setAttribute("aria-label", `Run ${command.next}`);
  el("dock-where").textContent = command.where;
  el("dock-blocker").textContent = command.blocker;
  el("dock-next-label").textContent = command.next;
  el("dock-next").dataset.action = command.action || "";
  el("dock-next").dataset.pack = command.targetPackId || "";
  el("dock-next").setAttribute("aria-label", `Run ${command.next}`);
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

  if (kind === "triage-input") {
    return ["#triage-input"];
  }

  if (kind === "triage-output") {
    return ["#triage-output", ".demo-triage-card", "#triage-snapshot"];
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

  if (action === "set-next" || action === "open" || action === "focus" || action === "start" || action === "done" || action === "unblock") {
    return "next";
  }

  if (action === "review") {
    return "blocker";
  }

  return "where";
}

function renderHome() {
  const reviewCount = state.packs.filter(isReview).length;
  const doneCount = state.packs.filter((pack) => pack.status === "done").length;
  const scenario = DEMO_SCENARIO_BY_ID[state.scenarioId] || DEMO_SCENARIO_BY_ID.default;
  el("screen-content").innerHTML = `
    <div class="demo-grid">
      ${metricCard("Visible work", state.packs.length, "Sample packs in browser state.")}
      ${metricCard("Review", reviewCount, "Items with blockers or missing next actions.")}
      ${metricCard("Done", doneCount, "Finished sample work.")}
    </div>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Start here</span>
          <h2>Move from brief to action</h2>
        </div>
        <button class="btn btn-primary" type="button" data-go="review">Review work</button>
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
          <button type="button" class="demo-scenario-card" data-scenario="${escapeAttribute(item.id)}" aria-pressed="${state.scenarioId === item.id}">
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

  el("screen-content").innerHTML = `
    <div class="demo-grid">
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
            <button id="parse-triage" class="btn btn-primary" type="button">Parse work</button>
            <button id="add-triage-row" class="btn" type="button">Add row</button>
            <button id="reset-triage" class="btn" type="button">Reset tool</button>
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
        ${rows.length ? rows.map(triageCard).join("") : emptyState("Paste work or add a row to create a command brief.")}
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
      <div class="demo-inline-form">
        <label class="sr-only" for="triage-snapshot">Triage snapshot markdown</label>
        <textarea id="triage-snapshot" class="demo-search-input" rows="8" readonly>${escapeHtml(triageMarkdown(rows))}</textarea>
      </div>
      <div class="demo-card-actions">
        <button id="copy-triage-markdown" class="btn btn-primary" type="button">Copy Markdown</button>
        <button id="copy-triage-json" class="btn" type="button">Copy JSON</button>
        <button class="btn" type="button" data-go="work">Open work list</button>
      </div>
    </section>
  `;

  bindTriageControls();
  bindGoButtons();
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
      ${triageTextInput(row, "doneWhen", "Done when", true)}
    </div>
    <div class="demo-card-actions">
      <button class="btn btn-sm" type="button" data-triage-remove="${escapeAttribute(row.id)}">Remove</button>
    </div>
  </article>`;
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
    state.status = `${state.triageRows.length} work item(s) parsed in browser state.`;
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
    state.status = "Blank triage row added in browser state.";
    queueFocus("triage-output");
    render();
  });

  el("reset-triage")?.addEventListener("click", () => {
    state.triageInput = defaultTriageInput();
    state.triageRows = [];
    state.status = "Triage tool reset in browser state.";
    queueFocus("triage-input");
    render();
  });

  el("copy-triage-markdown")?.addEventListener("click", () => {
    syncTriageRowsFromDom();
    copyToClipboard(triageMarkdown(state.triageRows), "Triage Markdown copied to clipboard.");
  });

  el("copy-triage-json")?.addEventListener("click", () => {
    syncTriageRowsFromDom();
    copyToClipboard(JSON.stringify(collectTriageSnapshot(state.triageRows), null, 2), "Triage JSON copied to clipboard.");
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
      state.status = "Triage row removed in browser state.";
      render();
    });
  });
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
      doneWhen: row.doneWhen
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
    "| Work | Where | Blocker | Button runs next | Evidence needed | Done when |",
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
        <button class="btn btn-primary" type="button" data-go="create">${escapeHtml(profile().newWork)}</button>
      </div>
      <div class="demo-work-list">${visible.length ? visible.map(workCard).join("") : emptyState("No sample work matches this filter.")}</div>
    </section>
  `;
  bindToolbar();
  bindWorkCards();
  bindGoButtons();
}

function renderToday() {
  const today = state.packs.filter((pack) => pack.due || pack.status === "active");
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Today</span>
          <h2>${today.length} sample item(s)</h2>
        </div>
        <button class="btn" type="button" data-action="set-due-today">Set all due today</button>
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
        <button class="btn btn-primary" type="button" data-go="next">Next setup</button>
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
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Needs decision</span>
          <h2>${review.length} review item(s)</h2>
        </div>
        <button class="btn btn-primary" type="button" data-action="review-first">Review first</button>
      </div>
      <div class="demo-review-list">${review.length ? review.map(reviewCard).join("") : emptyState("No sample work needs review.")}</div>
    </section>
  `;
  bindListActions();
}

function renderNext() {
  const pack = currentPack() || state.packs.find(isReview) || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No sample work is available.");
    return;
  }

  state.selectedId = pack.id;
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Next setup</span>
          <h2>Choose what the main button runs</h2>
        </div>
        <span class="demo-status">${escapeHtml(pack.title)}</span>
      </div>
      <p>In the real app, this fills the work item's Button-runs-next field. In this static demo, it changes the sample text in browser state.</p>
      <div class="demo-command-lines compact">
        ${factLine("Where", pack.title)}
        ${factLine("Blocker", pack.blocker)}
        ${factLine("Button runs next", pack.next)}
      </div>
      <div class="demo-inline-form">
        <label class="sr-only" for="next-action-choice">Choose next action</label>
        <select id="next-action-choice" class="demo-search-input">
          ${["Review", "Open", "Focus", "Unblock", "Start", "Done"].map((option) => `<option value="${escapeAttribute(option)}"${option === pack.next ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
        <button id="apply-next-action" class="btn btn-primary" type="button">Apply to sample</button>
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Candidates</span>
          <h2>Work that needs a clearer button</h2>
        </div>
      </div>
      <div class="demo-list">${state.packs.filter(isReview).map(nextCandidateRow).join("") || emptyState("No sample work needs next setup.")}</div>
    </section>
  `;
  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));
  bindListActions();
}

function renderCheck() {
  const checks = sampleChecks();
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Check</span>
          <h2>Sample readiness checks</h2>
        </div>
        <button class="btn btn-primary" type="button" data-action="validate-sample">Validate sample</button>
      </div>
      <div class="demo-check-list">
        ${checks.map(checkRow).join("")}
      </div>
    </section>
  `;
  bindListActions();
}

function renderFocus() {
  const pack = currentPack() || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No sample work is available.");
    return;
  }
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
        ${factBlock("Blocker", pack.blocker)}
        ${factBlock("Button runs next", pack.next)}
        ${factBlock("Done when", pack.doneWhen)}
      </div>
      <p>${escapeHtml(pack.purpose)}</p>
      <div class="demo-card-actions">
        <button class="btn btn-primary" type="button" data-action="open" data-pack="${escapeHtml(pack.id)}">${escapeHtml(pack.next)}</button>
        <button class="btn" type="button" data-action="done" data-pack="${escapeHtml(pack.id)}">Mark done</button>
        <button class="btn" type="button" data-go="pack" data-pack="${escapeHtml(pack.id)}">Edit sample</button>
      </div>
    </section>
    ${activityPanel(pack)}
  `;
  bindListActions();
  bindGoButtons();
}

function renderStats() {
  const counts = countByFilter();
  const total = Math.max(state.packs.length, 1);
  el("screen-content").innerHTML = `
    <div class="demo-grid">
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
        <button class="btn btn-primary" type="button" data-go="memory">Add note</button>
      </div>
      <div class="demo-list">
        ${rows.map(({ pack, note }) => `<div class="demo-note"><strong>${escapeHtml(pack.title)}</strong>${escapeHtml(note)}</div>`).join("") || emptyState("No sample notes exist.")}
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
        ${rows.map(timelineRow).join("") || emptyState("No sample activity exists.")}
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
        ${rows.map(sourceRow).join("") || emptyState("No sample source references exist.")}
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
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Calendar</span>
          <h2>Sample due dates</h2>
        </div>
        <button class="btn" type="button" data-action="set-due-today">Set all due today</button>
      </div>
      <div class="demo-calendar-grid">
        ${rows.map(calendarCard).join("") || emptyState("No sample due dates exist.")}
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
      <div class="demo-work-list demo-search-results">${visible.map(workCard).join("") || emptyState("No sample work matches the search.")}</div>
    </section>
  `;
  el("screen-search").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    render();
  });
  bindWorkCards();
}

function renderCreate() {
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
        ${inputField("new-title", "Title", "New sample work")}
        ${inputField("new-owner", "Owner", "unassigned")}
        ${inputField("new-next", "Button runs next", "Review")}
        ${inputField("new-due", "Due", "2026-06-30")}
        ${textField("new-purpose", "Why it matters", "Describe why this sample work matters.")}
      </div>
      <button id="create-sample" class="btn btn-primary" type="button">Save sample</button>
    </section>
  `;
  el("create-sample").addEventListener("click", createSamplePack);
}

function renderPackDetail() {
  const pack = currentPack();
  if (!pack) {
    el("screen-content").innerHTML = emptyState("Choose sample work before opening detail.");
    return;
  }
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Pack detail</span>
          <h2>${escapeHtml(pack.title)}</h2>
        </div>
        <span class="demo-status">Edits are browser-only</span>
      </div>
      <div class="demo-form-grid">
        ${inputField("edit-title", "Title", pack.title)}
        ${selectField("edit-status", "Status", ["draft", "active", "blocked", "done"], pack.status)}
        ${inputField("edit-owner", "Owner", pack.owner)}
        ${inputField("edit-due", "Due", pack.due)}
        ${inputField("edit-next", "Button runs next", pack.next)}
        ${textField("edit-purpose", "Purpose", pack.purpose)}
      </div>
      <div class="demo-card-actions">
        <button id="save-pack" class="btn btn-primary" type="button">Save sample changes</button>
        <button class="btn" type="button" data-action="done" data-pack="${escapeHtml(pack.id)}">Mark done</button>
      </div>
    </section>
    ${activityPanel(pack)}
  `;
  el("save-pack").addEventListener("click", () => savePackDetail(pack.id));
  bindListActions();
}

function renderMemory() {
  const pack = currentPack() || state.packs[0];
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Memory</span>
          <h2>${pack ? escapeHtml(pack.title) : "Sample memory"}</h2>
        </div>
        <span class="demo-status">Stored in browser state</span>
      </div>
      <div class="demo-list">${pack ? pack.memory.map((note) => `<div class="demo-note">${escapeHtml(note)}</div>`).join("") : emptyState("No memory available.")}</div>
      <div class="demo-inline-form">
        <label class="sr-only" for="memory-note">Add memory note</label>
        <input id="memory-note" class="demo-search-input" type="text" placeholder="Add a sample memory note">
        <button id="add-memory" class="btn btn-primary" type="button">Add note</button>
      </div>
    </section>
  `;
  el("add-memory").addEventListener("click", () => {
    if (!pack) return;
    const value = el("memory-note").value.trim();
    if (!value) {
      state.status = "Memory note needs text.";
      render();
      return;
    }
    pack.memory.unshift(value);
    pack.activity.unshift("Memory note added in browser state.");
    state.status = "Memory note added in browser state only.";
    render();
  });
}

function renderSettings() {
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Settings</span>
          <h2>Demo copy profile</h2>
        </div>
        <button class="btn" type="button" id="reset-demo">Reset demo data</button>
      </div>
      <p>Copy profile changes labels in this static demo. It does not change ontology, local methods, or real pack storage.</p>
      <p class="demo-status-line">${escapeHtml(state.status)}</p>
      <h3>Profile</h3>
      <div class="demo-profile-grid">
        ${Object.entries(copyProfiles).map(([key, value]) => `
          <button type="button" class="demo-profile-card" data-profile="${escapeHtml(key)}" aria-pressed="${state.copyProfile === key}">
            <strong>${escapeHtml(capitalize(key))}</strong>
            <span>${escapeHtml(value.newWork)} / ${escapeHtml(value.work)} / ${escapeHtml(value.sources)}</span>
          </button>
        `).join("")}
      </div>
      <h3>Scenario presets</h3>
      <div class="demo-scenario-grid">
        ${DEMO_SCENARIOS.map((item) => `
          <button type="button" class="demo-scenario-card" data-scenario="${escapeAttribute(item.id)}" aria-pressed="${state.scenarioId === item.id}">
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
      state.status = `${capitalize(state.copyProfile)} copy profile applied in demo state.`;
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
      ${metricCard("Data", state.packs.length, "Loaded sample packs in browser state.")}
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
      <div class="demo-inline-form">
        <label class="sr-only" for="feedback-context">Demo diagnostic context</label>
        <textarea id="feedback-context" class="demo-search-input" rows="10">${escapeHtml(JSON.stringify(context, null, 2))}</textarea>
      </div>
      <div class="demo-card-actions">
        <button id="copy-feedback" class="btn" type="button">Copy context</button>
        <a class="btn btn-primary" id="open-feedback" href="${escapeAttribute(issueUrl)}" rel="noopener noreferrer" target="_blank">Open GitHub issue</a>
      </div>
    </section>
  `;
  el("copy-feedback").addEventListener("click", () => copyToClipboard(issueBody));
  el("open-feedback").addEventListener("click", () => {
    state.status = "Opening demo feedback issue form.";
  });
}

function renderMeta() {
  const counts = countByFilter();
  const checks = buildHealthChecks();
  const passing = checks.filter((check) => check.status).length;
  const context = collectDiagnosticContext();
  const styleAudit = buildStyleAuditSnapshot();
  const now = new Date().toLocaleString();

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Product telemetry</span>
          <h2>Demo meta dashboard</h2>
        </div>
        <span class="demo-status">${escapeHtml(context.version || stateVersionLabel())}</span>
      </div>
      <p>A compact product-like summary from browser-only state and runtime checks.</p>
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
        ${metricCard("Routes", styleAudit.routeCount, `${navItems.length} nav routes plus pack detail.`)}
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
      <div class="demo-inline-form">
        <label class="sr-only" for="meta-context">Meta context payload</label>
        <textarea id="meta-context" class="demo-search-input" rows="8">${escapeHtml(JSON.stringify(context, null, 2))}</textarea>
      </div>
      <div class="demo-card-actions">
        <button id="copy-meta-context" class="btn" type="button">Copy meta snapshot</button>
        <button id="copy-style-audit" class="btn" type="button">Copy style audit</button>
      </div>
      <p><small>Snapshot generated: ${escapeHtml(now)}</small></p>
    </section>
  `;
  el("copy-meta-context").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(context, null, 2), "Meta snapshot copied to clipboard.");
  });
  el("copy-style-audit").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(styleAudit, null, 2), "Style audit copied to clipboard.");
  });
}

function renderLab() {
  const pack = currentPack() || preferredReviewPack();
  const action = commandActionForPack(pack);
  const styleAudit = buildStyleAuditSnapshot();
  const snapshot = collectLabSnapshot(pack, action, styleAudit);

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
        <select id="lab-pack-select" class="demo-search-input">
          ${state.packs.map((item) => `<option value="${escapeAttribute(item.id)}"${item.id === pack?.id ? " selected" : ""}>${escapeHtml(item.title)} / ${escapeHtml(commandActionForPack(item).label)}</option>`).join("")}
        </select>
        <button id="lab-run-action" class="btn btn-primary" type="button"${pack ? "" : " disabled"}>Run ${escapeHtml(action.label)}</button>
        <button id="lab-set-next" class="btn" type="button"${pack ? "" : " disabled"}>Set next</button>
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
      <div class="demo-check-list">
        ${labSmokeChecks(pack, styleAudit).map(healthLine).join("")}
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
      <div class="demo-inline-form">
        <label class="sr-only" for="lab-snapshot">Lab snapshot payload</label>
        <textarea id="lab-snapshot" class="demo-search-input" rows="10">${escapeHtml(JSON.stringify(snapshot, null, 2))}</textarea>
      </div>
      <div class="demo-card-actions">
        <button id="copy-lab-snapshot" class="btn btn-primary" type="button">Copy lab snapshot</button>
        <button class="btn" type="button" data-go="meta">Open meta</button>
      </div>
    </section>
  `;

  bindLabControls();
  bindGoButtons();
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
  return filters.map(([key, label]) => `
    <button type="button" class="demo-chip" aria-pressed="${state.filter === key}" data-filter="${key}">
      ${escapeHtml(label)}<span class="demo-chip-count">${counts[key] ?? 0}</span>
    </button>
  `).join("");
}

function boardColumn(status) {
  const packs = state.packs.filter((pack) => pack.status === status);
  return `<section class="demo-board-column">
    <div class="demo-board-head">
      <strong>${escapeHtml(capitalize(status))}</strong>
      <span>${packs.length}</span>
    </div>
    <div class="demo-list">
      ${packs.map((pack) => `<article class="demo-mini-card">
        <button type="button" class="demo-card-title" data-action="focus" data-pack="${escapeAttribute(pack.id)}">${escapeHtml(pack.title)}</button>
        <span>${escapeHtml(pack.blocker === "none" ? pack.next : pack.blocker)}</span>
      </article>`).join("") || emptyState(`No ${status} sample work.`)}
    </div>
  </section>`;
}

function nextCandidateRow(pack) {
  return `<div class="demo-row" data-pack-id="${escapeAttribute(pack.id)}">
    <div>
      <strong>${escapeHtml(pack.title)}</strong>
      <span>${escapeHtml(pack.blocker === "none" ? "Ready for a clearer next action." : pack.blocker)}</span>
    </div>
    <div class="demo-row-actions">
      <button class="btn btn-sm" type="button" data-action="focus" data-pack="${escapeAttribute(pack.id)}">Focus</button>
      <button class="btn btn-sm btn-primary" type="button" data-action="set-next" data-pack="${escapeAttribute(pack.id)}">Choose next</button>
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
    <button class="btn btn-sm" type="button" data-action="focus" data-pack="${escapeAttribute(pack.id)}">Focus</button>
  </div>`;
}

function calendarCard(pack) {
  return `<article class="demo-calendar-card">
    <span>${escapeHtml(pack.due)}</span>
    <strong>${escapeHtml(pack.title)}</strong>
    <small>${escapeHtml(pack.status)} / ${escapeHtml(pack.owner)}</small>
    <button class="btn btn-sm" type="button" data-action="focus" data-pack="${escapeAttribute(pack.id)}">Focus</button>
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
      state.status = `${button.textContent.trim()} filter applied.`;
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
      state.status = `${pack.title} loaded in Demo Lab.`;
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
    copy.addEventListener("click", () => copyToClipboard(valueOf("lab-snapshot"), "Lab snapshot copied to clipboard."));
  }
}

function workCard(pack) {
  const selected = pack.id === state.selectedId ? " selected" : "";
  const command = commandActionForPack(pack);
  return `<article class="demo-work-card${selected}" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-card-head">
      <button type="button" class="demo-card-title" data-action="select">${escapeHtml(pack.title)}</button>
      <span class="demo-state-pill">${escapeHtml(pack.status)}</span>
    </div>
    <div class="demo-command-row">
      <div>
        <span>Button runs next</span>
        <strong>${escapeHtml(pack.next)}</strong>
      </div>
      <button type="button" class="btn btn-primary" data-action="run-next">${escapeHtml(command.label)}</button>
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(pack.blocker === "none" ? "Blocker: none" : pack.blocker)}</span>
      <span>${escapeHtml(formatDue(pack))}</span>
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    <div class="demo-card-actions">
      <button type="button" class="btn btn-sm btn-primary" data-action="open">Open</button>
      <button type="button" class="btn btn-sm" data-action="focus">Focus</button>
      <button type="button" class="btn btn-sm" data-action="block">Block</button>
      <button type="button" class="btn btn-sm" data-action="done">Done</button>
    </div>
  </article>`;
}

function todayRow(pack) {
  return `<div class="demo-row">
    <div>
      <strong>${escapeHtml(pack.title)}</strong>
      <span>${escapeHtml(formatDue(pack))} / ${escapeHtml(pack.owner)}</span>
    </div>
    <div class="demo-row-actions">
      <button class="btn btn-sm" type="button" data-action="focus" data-pack="${escapeAttribute(pack.id)}">Focus</button>
      <button class="btn btn-sm btn-primary" type="button" data-action="done" data-pack="${escapeAttribute(pack.id)}">Done</button>
    </div>
  </div>`;
}

function reviewCard(pack) {
  return `<article class="demo-review-card" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-command-lines compact">
      ${factLine("Where", pack.title)}
      ${factLine("Blocker", pack.blocker)}
      ${factLine("Button runs next", pack.next)}
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(pack.status)}</span>
      <span>${escapeHtml(formatDue(pack))}</span>
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    <div class="demo-inline-form">
      <label class="sr-only" for="next-${escapeAttribute(pack.id)}">Choose next action</label>
      <input id="next-${escapeAttribute(pack.id)}" class="demo-search-input" type="text" value="${escapeAttribute(pack.next)}">
      <button class="btn btn-primary" type="button" data-action="set-next" data-pack="${escapeAttribute(pack.id)}">Set</button>
    </div>
    <div class="demo-card-actions">
      <button class="btn btn-primary" type="button" data-action="done" data-pack="${escapeAttribute(pack.id)}">Done</button>
      <button class="btn" type="button" data-action="focus" data-pack="${escapeAttribute(pack.id)}">Focus</button>
      <button class="btn" type="button" data-action="edit" data-pack="${escapeAttribute(pack.id)}">Edit</button>
    </div>
  </article>`;
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
        state.packs.forEach((pack) => { if (pack.status !== "done") pack.due = "2026-06-16"; });
        state.status = "All unfinished sample work is due today in browser state.";
      } else if (action === "review-first") {
        const first = preferredReviewPack();
        if (first) {
          state.selectedId = first.id;
          state.status = `${first.title} selected for review.`;
        }
      } else if (action === "validate-sample") {
        const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
        state.status = attention === 0
          ? "Sample data passed the browser-state checks."
          : `${attention} sample check item(s) still need attention.`;
      } else if (action === "set-next") {
        const pack = findPack(button.dataset.pack);
        if (pack) {
          const input = el(`next-${pack.id}`);
          state.selectedId = pack.id;
          if (input) {
            pack.next = input.value.trim() || "Open";
            pack.blocker = pack.blocker === "missing Button runs next" ? "none" : pack.blocker;
            pack.activity.unshift("Button runs next changed in browser state.");
            state.status = `${pack.title} next action updated in browser state.`;
          } else {
            state.status = `${pack.title} selected for next-action setup.`;
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

function applyNextChoice(id) {
  const pack = findPack(id);
  if (!pack) return;

  const choice = valueOf("next-action-choice") || "Open";
  pack.next = choice;
  if (pack.blocker === "missing Button runs next") {
    pack.blocker = "none";
  }

  pack.activity.unshift(`Button runs next changed to ${choice} in browser state.`);
  state.selectedId = pack.id;
  state.status = `${pack.title} will now run ${choice} in the static demo.`;
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
    state.status = `${pack.title} selected.`;
  } else if (action === "run-next") {
    handlePackAction(pack.id, commandActionForPack(pack).action);
    return;
  } else if (action === "review") {
    state.status = `${pack.title} opened in the review queue.`;
    go("review", pack.id);
    return;
  } else if (action === "set-next") {
    state.status = `${pack.title} opened for next-action setup.`;
    go("next", pack.id);
    return;
  } else if (action === "start") {
    pack.status = "active";
    pack.blocker = pack.blocker === "missing setup" ? "none" : pack.blocker;
    pack.next = pack.next === "Choose next action" ? "Open" : pack.next;
    pack.activity.unshift("Started in browser state.");
    state.status = `${pack.title} is active in browser state only.`;
  } else if (action === "unblock") {
    pack.status = "active";
    pack.blocker = "none";
    pack.next = "Open";
    pack.activity.unshift("Unblocked in browser state.");
    state.status = `${pack.title} is unblocked in browser state only.`;
  } else if (action === "block") {
    pack.status = "blocked";
    pack.blocker = "blocked in demo state";
    pack.next = "Unblock";
    pack.activity.unshift("Blocked in browser state.");
    state.status = `${pack.title} is blocked in browser state only.`;
  } else if (action === "done") {
    pack.status = "done";
    pack.blocker = "none";
    pack.next = "Open";
    pack.activity.unshift("Marked done in browser state.");
    state.status = `${pack.title} is marked done in browser state only.`;
  } else if (action === "focus") {
    go("focus", pack.id);
    return;
  } else if (action === "edit") {
    go("pack", pack.id);
    return;
  } else if (action === "open") {
    pack.activity.unshift("Opened in browser state.");
    state.status = `${pack.title} opened in browser state.`;
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
  if (runRouteAction(action, targetPackId)) {
    return;
  }

  const pack = findPack(targetPackId) || currentPack();
  if (!pack) {
    state.status = "No sample work is selected.";
    render();
    return;
  }

  handlePackAction(pack.id, action || commandActionForPack(pack).action);
}

function runRouteAction(action, targetPackId) {
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

  if (action === "parse-triage") {
    if (state.route !== "triage") {
      go("triage");
      return true;
    }

    const input = el("triage-input");
    state.triageInput = input?.value || state.triageInput || "";
    state.triageRows = parseTriageText(state.triageInput);
    state.status = `${state.triageRows.length} work item(s) parsed in browser state.`;
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
      state.status = "No triage rows are ready to copy.";
      render();
      return true;
    }

    copyToClipboard(triageMarkdown(state.triageRows), "Triage Markdown copied to clipboard.");
    return true;
  }

  if (action === "create-sample") {
    createSamplePack();
    return true;
  }

  if (action === "search-demo") {
    state.status = "Search checks browser-state sample data only.";
    render();
    return true;
  }

  if (action === "validate-sample") {
    const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
    state.status = attention === 0
      ? "Sample data passed the browser-state checks."
      : `${attention} sample check item(s) still need attention.`;
    render();
    return true;
  }

  if (action === "add-note") {
    const pack = findPack(targetPackId) || currentPack();
    const input = el("memory-note");
    if (state.route !== "memory") {
      go("memory", pack?.id || "");
      return true;
    }
    if (pack && input?.value.trim()) {
      pack.memory.unshift(input.value.trim());
      pack.activity.unshift("Memory note added in browser state.");
      state.status = "Memory note added in browser state only.";
    } else {
      state.status = "Add a note from the Memory screen input.";
    }
    render();
    return true;
  }

  if (action === "apply-profile") {
    state.status = `${capitalize(state.copyProfile)} profile is active in demo state.`;
    render();
    return true;
  }

  if (action === "refresh-health") {
    state.status = "Health checks refreshed.";
    render();
    return true;
  }

  if (action === "report-feedback") {
    if (state.route !== "feedback") {
      go("feedback");
      return true;
    }
    state.status = "Feedback context refreshed for this snapshot.";
    render();
    return true;
  }

  if (action === "refresh-meta") {
    refreshMetaDiagnostics();
    return true;
  }

  return false;
}

function commandActionForPack(pack) {
  if (!pack) {
    return { label: "Open work list", action: "open-work-list", targetPackId: "" };
  }

  const rawLabel = (pack.next || "").trim();
  if (isMissingNextAction(pack)) {
    return { label: "Set Button runs next", action: "set-next", targetPackId: pack.id };
  }

  if (hasBlocker(pack)) {
    const action = commandActionForLabel(rawLabel);
    if (action.action === "unblock") {
      return { label: "Unblock", action: "unblock", targetPackId: pack.id };
    }

    return { label: "Review blocker", action: "review", targetPackId: pack.id };
  }

  const action = commandActionForLabel(rawLabel || "Open");
  return { ...action, targetPackId: pack.id };
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

  if (normalized === "done" || normalized === "complete") {
    return { label, action: "done" };
  }

  return { label: label === "Open" ? "Open" : label, action: "open" };
}

function createSamplePack() {
  const title = valueOf("new-title") || "new-sample-work";
  const id = slugify(title);
  const pack = {
    id,
    title,
    type: state.copyProfile,
    status: "draft",
    blocker: "missing setup",
    next: valueOf("new-next") || "Review",
    due: valueOf("new-due"),
    owner: valueOf("new-owner") || "unassigned",
    purpose: valueOf("new-purpose") || "Sample work created in the static demo.",
    doneWhen: "Sample result is described.",
    sources: ["browser-state"],
    memory: ["Created in the static demo. Nothing was saved to local files."],
    activity: ["Created in browser state."]
  };
  state.packs.unshift(pack);
  state.selectedId = pack.id;
  state.status = `${pack.title} created in browser state only.`;
  go("pack", pack.id);
}

function savePackDetail(id) {
  const pack = findPack(id);
  if (!pack) return;
  pack.title = valueOf("edit-title") || pack.title;
  pack.status = valueOf("edit-status") || pack.status;
  pack.owner = valueOf("edit-owner") || pack.owner;
  pack.due = valueOf("edit-due");
  pack.next = valueOf("edit-next") || pack.next;
  pack.purpose = valueOf("edit-purpose") || pack.purpose;
  pack.blocker = pack.status === "done" ? "none" : pack.blocker;
  pack.activity.unshift("Sample detail saved in browser state.");
  state.status = `${pack.title} saved in browser state only.`;
  render();
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
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
  </section>`;
}

function navButton(route, label) {
  return `<button class="btn" type="button" data-go="${escapeAttribute(route)}">${escapeHtml(label)}</button>`;
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
  state.status = "Meta diagnostics refreshing.";
  render();
  collectStyleAudit().then((styleAudit) => {
    state.styleAudit = styleAudit;
    state.status = "Meta diagnostics recomputed for this session.";
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
    commandSync: commandSyncStatus(),
    currentOverflow: currentOverflowStatus(),
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
      status: DEMO_STORAGE_KEY.endsWith("-v5"),
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
      label: "Export metadata",
      status: Boolean(state.metadata?.generatedAt),
      detail: state.metadata?.generatedAt
        ? `Generated ${new Date(state.metadata.generatedAt).toLocaleString()}.`
        : "Generated timestamp not available."
    }
  ];
}

function collectLabSnapshot(pack, action, styleAudit) {
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
    smokeReplay: labSmokeChecks(pack, styleAudit).map((check) => ({
      label: check.label,
      status: check.status,
      detail: check.detail
    })),
    timestamp: new Date().toISOString()
  };
}

function labSmokeChecks(pack, styleAudit) {
  const action = commandActionForPack(pack);
  const sync = commandSyncStatus();
  const overflow = currentOverflowStatus();

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

function copyToClipboard(value, successMessage = "Feedback context copied to clipboard.") {
  navigator.clipboard?.writeText(value).then(
    () => {
      state.status = successMessage;
      render();
    },
    () => {
      state.status = "Clipboard blocked; use the text area to copy manually.";
      render();
    }
  );
}

function emptyState(text) {
  return `<div class="demo-empty">${escapeHtml(text)}</div>`;
}

function valueOf(id) {
  const input = el(id);
  return input ? input.value.trim() : "";
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
