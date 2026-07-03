const DEMO_STORAGE_KEY = "projects-static-demo-state-v6";
const LEGACY_DEMO_STORAGE_KEYS = [
  "projects-static-demo-state-v3",
  "projects-static-demo-state-v4",
  "projects-static-demo-state-v5"
];
const THEME_STORAGE_KEY = "projects-demo-theme-v3";
const THEMES = ["light", "dark", "forest", "ocean", "sepia"];
const THEME_LABELS = { light: "Light", dark: "Dark", forest: "Forest", ocean: "Ocean", sepia: "Sepia" };
const API_STATE_SAVE_DEBOUNCE_MS = 300;
const API_CLIENT_STORAGE_KEY = "projects-static-demo-api-client-v1";
const SYNC_CODE_STORAGE_KEY = "projects-static-demo-sync-code-v1";
const SYNC_CODE_QUERY_PARAM = "sync";
const SYNC_CODE_MIN_COMPACT_LENGTH = 12;
const SYNC_CODE_MAX_COMPACT_LENGTH = 24;
const SYNC_CODE_GENERATED_COMPACT_LENGTH = 20;
const SYNC_QR_VERSION = 5;
const SYNC_QR_SIZE = 21 + ((SYNC_QR_VERSION - 1) * 4);
const SYNC_QR_DATA_CODEWORDS = 108;
const SYNC_QR_ERROR_CODEWORDS = 26;
const SYNC_QR_QUIET_MODULES = 4;
const SYNC_QR_MAX_BYTES = 106;
const DEMO_STATE_MAX_PACKS = 50;
const RECOVERY_SNAPSHOT_VERSION = 1;
const SERVER_PACK_ACTIONS = new Set(["start", "unblock", "block", "done", "open"]);
const DEMO_BLOCKER_NONE = "none";
const DEMO_BLOCKER_NONE_LABEL = "None";
const DEMO_PROOF_TARGET_MISSING = "Add a proof target before finishing this work";
const BLOCKER_REASON_PRESETS = Object.freeze([
  "missing owner",
  "missing source",
  "needs decision",
  "waiting on approval"
]);

const DEMO_COPY_LIMITS = Object.freeze({
  commandFieldVisible: 72,
  commandButtonVisible: 36,
  commandFlowVisible: 48,
  commandFlowHelp: 140,
  compactButtonVisible: 32,
  compactBadgeVisible: 48,
  compactNavVisible: 16,
  compactHelp: 140,
  clipboardPayloadPreview: 1200,
  memoryVisible: 96,
  receiptVisible: 96,
  receiptHelp: 180,
  statusVisible: 96,
  statusHelp: 180
});

const FORWARD_PATH_CHANGE_FIELDS = Object.freeze([
  ["title", "title"],
  ["status", "status"],
  ["blocker", "blocker"],
  ["blockedBy", "blocked by work item"],
  ["owner", "owner"],
  ["due", "due date"],
  ["next", "Next action"],
  ["doneWhen", "proof target"],
  ["purpose", "purpose"]
]);

const state = {
  basePacks: [],
  packs: [],
  route: "home",
  selectedId: "",
  query: "",
  filter: "all",
  status: "Demo buttons update work in this browser only.",
  copyProfile: "general",
  scenarioId: "default",
  pendingFocus: null,
  actionReceipt: null,
  clipboardReceipt: null,
  lastRenderedHash: "",
  memoryDraft: "",
  workListView: "card",
  suppressNextSave: false,
  density: "card",
};

const backendPackCommandCache = new Map();
const pendingBackendPackCommandRequests = new Set();

const ROUTE_CONTRACT = Object.freeze({
  home: { pattern: "#/home", title: "Start", commandSource: "route", navKey: "1", navLabel: "Start" },
  review: { pattern: "#/review/{packId}", title: "Review", commandSource: "selected-work", acceptsPackId: true, navKey: "2", navLabel: "Review" },
  work: { pattern: "#/work/{packId}", title: "Work", commandSource: "selected-work", acceptsPackId: true, navKey: "3", navLabel: "Work" },
  next: { pattern: "#/next/{packId}", title: "Choose action", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "4", navLabel: "Choose action" },
  memory: { pattern: "#/memory/{packId}", title: "Memory", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "5", navLabel: "Memory" },
  create: { pattern: "#/create", title: "Create", commandSource: "route", navKey: "+", navLabel: "Create" },
  pack: { pattern: "#/pack/{packId}", title: "Work path", commandSource: "selected-work", acceptsPackId: true },
  compare: { pattern: "#/compare/{packId}/{packId}", title: "Compare", commandSource: "route", acceptsPackId: true },
  calendar: { pattern: "#/calendar", title: "Calendar", commandSource: "route", navKey: "📅", navLabel: "Calendar" },
  settings: { pattern: "#/settings", title: "Settings", commandSource: "route", navKey: "⚙", navLabel: "Settings" },
  insights: { pattern: "#/insights", title: "Insights", commandSource: "route", navKey: "📊", navLabel: "Insights" }
});

const NAV_ROUTE_GROUPS = Object.freeze([
  Object.freeze({
    id: "public",
    label: "Demo",
    routes: Object.freeze(["home", "review", "work", "next", "memory", "create", "calendar", "settings", "insights"])
  })
]);

const NAV_ROUTE_IDS = Object.freeze(NAV_ROUTE_GROUPS.flatMap((group) => group.routes));

const navItems = Object.freeze(NAV_ROUTE_IDS.map((route) => {
  const contract = ROUTE_CONTRACT[route];
  return Object.freeze({ route, key: contract.navKey, label: contract.navLabel, group: navGroupIdForRoute(route) });
}));

const NEXT_ACTION_CHOICES = Object.freeze(["Review", "Open", "Focus", "Set Blocker: None", "Start", "Finish with proof"]);

const filters = [
  ["all", "All"],
  ["active", "Active"],
  ["blocked", "Blocked"],
  ["draft", "Draft"],
  ["done", "Done"],
  ["review", "Review"]
];

const copyProfiles = {
  general: { work: "work", workOne: "work item", workMany: "work items", newWork: "New work", result: "Result", sources: "Sources" },
  dj: { work: "gig", workOne: "gig", workMany: "gigs", newWork: "Book gig", result: "Set recording", sources: "Source refs" },
  developer: { work: "task", workOne: "task", workMany: "tasks", newWork: "New task", result: "PR or commit", sources: "Repos and docs" },
  climate: { work: "site check", workOne: "site check", workMany: "site checks", newWork: "New check", result: "Finding", sources: "Datasets and notes" },
  ai: { work: "prompt", workOne: "prompt", workMany: "prompts", newWork: "New prompt", result: "Output", sources: "Model and docs" }
};

const PROFILE_LABELS = { general: "General", dj: "DJ", developer: "Developer", climate: "Climate", ai: "AI" };

const DEMO_SCENARIOS = [
  {
    id: "default",
    label: "Default",
    description: "Balanced work path with mixed states, review and done states.",
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
    transform: (packs) => packs.map(reviewScenarioPack)
  },
  {
    id: "healthy",
    label: "Healthy queue",
    description: "Normalize blockers and Next action values to reduce friction in the demo.",
    profile: "general",
    route: "work",
    filter: "active",
    transform: (packs) => packs.map((pack) => pack.status === "done"
      ? pack
      : {
          ...pack,
          blocker: DEMO_BLOCKER_NONE,
          blockedBy: "",
          next: isPlaceholderNext(pack.next) ? "Open" : pack.next,
          status: pack.status === "draft" ? "active" : pack.status
        })
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Compact first-run path with clear labels and Next action values.",
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
    description: "Shift active work to today while keeping the same small work path.",
    profile: "general",
    route: "work",
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
    description: "Show how disabled buttons explain what to do when no work is loaded.",
    profile: "general",
    route: "review",
    filter: "all",
    transform: () => []
  },
  {
    id: "ai-prompts",
    label: "Prompt library",
    description: "Explore and iterate on prompts with versioned memory and evaluation results.",
    profile: "ai",
    route: "review",
    filter: "all",
    transform: (packs) => packs.filter((p) => p.type === "prompt" || !p.type)
  },
  {
    id: "ai-evals",
    label: "Model evaluations",
    description: "Track eval runs and model comparisons with proof targets and pass/fail results.",
    profile: "ai",
    route: "review",
    filter: "all",
    transform: (packs) => packs.filter((p) => p.type === "eval" || !p.type)
  }
];

const DEMO_SCENARIO_BY_ID = Object.fromEntries(DEMO_SCENARIOS.map((scenario) => [scenario.id, scenario]));

function reviewScenarioPack(pack) {
  if (pack.status === "done") {
    return pack;
  }

  if (isMissingNextAction(pack)) {
    return {
      ...pack,
      blocker: "missing next action",
      next: "",
      status: "draft"
    };
  }

  return {
    ...pack,
    blocker: isUnblockedBlockerValue(pack.blocker) ? "Needs review context" : pack.blocker,
    next: "Review",
    status: "blocked"
  };
}

const el = (id) => document.getElementById(id);
const launchParams = new URLSearchParams(location.search);
let DEMO_API_BASE_URL = normalizeApiBaseUrl(window.PROJECTS_API_BASE_URL || (window.__projectsDemoConfig && window.__projectsDemoConfig.apiBase) || "");
const BACKEND_MODE = Boolean((window.__projectsDemoConfig && window.__projectsDemoConfig.backendMode) || DEMO_API_BASE_URL);
// On proxy deployments apiBase is empty but backend is active — use truthy sentinel for boolean gates
if (!DEMO_API_BASE_URL && BACKEND_MODE) {
  DEMO_API_BASE_URL = ".";
}
let apiSaveTimer = null;
let apiPendingSnapshot = null;
let apiSaveInFlight = false;
let apiSavePromise = null;
let apiSessionClientId = "";

document.addEventListener("DOMContentLoaded", async () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  initTheme();
  purgeLegacyDemoState();
  bindShellControls();
  bindDemoSyncControls();
  bindBottomDockVisibility();
  const launchedSyncCode = applyLaunchSyncCode();
  renderNav();
  updateServiceBoundaryNotice();

  try {
    const [seedPacks, backendState] = await loadInitialDemoState();
    state.basePacks = normalizeLegacyVisibleCopy(seedPacks);
    DEMO_API_BASE_URL ? loadBackendOwnedState(backendState) : loadState(backendState);
    await applyLaunchConfiguration();
    if (launchedSyncCode) {
      state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "review shared demo state");
      clearLaunchSyncCodeParam();
    }
    state.ready = true;
    routeFromHash();
    render();
    renderDemoSyncControls(launchedSyncCode ? "Sync link active. This device opens shared demo state." : "");
  } catch (error) {
    const blocker = DEMO_API_BASE_URL ? "backend API could not load" : "static JSON could not load";
    state.status = routeStatus("Demo", blocker, "refresh");
    updateCommand({
      title: "Demo unavailable",
      where: "Demo",
      blocker,
      next: "Refresh",
      stateText: "Offline",
      scope: "Scope: no work is visible."
    });
    el("screen-content").innerHTML = `<div class="demo-empty">${escapeHtml(error.message)}</div>`;
  }
});

async function loadInitialDemoState() {
  if (DEMO_API_BASE_URL) {
    const headers = await apiHeaders();
    return Promise.all([
      loadBackendSeedPacks(headers),
      loadBackendState(headers)
    ]);
  }

  return [await loadStaticSeedPacks(), null];
}

async function loadStaticSeedPacks() {
  const response = await fetch("data/demo-packs.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Demo data failed with ${response.status}`);
  }
  return response.json();
}

window.addEventListener("hashchange", () => {
  if (!state.ready) {
    return;
  }
  routeFromHash();
  render();
});

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = THEMES.includes(saved) ? saved : "light";
  applyTheme(theme);
  el("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    const idx = (THEMES.indexOf(current) + 1) % THEMES.length;
    applyTheme(THEMES[idx]);
  });
}

function applyTheme(theme) {
  const isDarkTheme = theme !== "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", isDarkTheme);
  const toggle = el("theme-toggle");
  const nextIdx = (THEMES.indexOf(theme) + 1) % THEMES.length;
  const nextTheme = THEMES[nextIdx];
  const help = `Switch to ${THEME_LABELS[nextTheme]} theme.`;
  toggle.textContent = "Theme";
  toggle.setAttribute("aria-pressed", String(theme !== "light"));
  toggle.setAttribute("title", help);
  toggle.setAttribute("aria-label", `Theme: ${THEME_LABELS[theme]}. ${help}`);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function bindShellControls() {
  el("primary-action").addEventListener("click", (event) => {
    const targetPackId = event.currentTarget.dataset.pack || state.selectedId;
    queueFocus(focusKindForAction(event.currentTarget.dataset.action, targetPackId), targetPackId);
    runPrimaryAction(event.currentTarget);
  });
  el("dock-next").addEventListener("click", (event) => {
    const targetPackId = event.currentTarget.dataset.pack || state.selectedId;
    queueFocus(focusKindForAction(event.currentTarget.dataset.action, targetPackId), targetPackId);
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

function loadState(backendState = null) {
  const saved = DEMO_API_BASE_URL
    ? normalizeStoredDemoState(backendState)
    : safeJson(localStorage.getItem(DEMO_STORAGE_KEY));
  state.packs = clearDanglingBlockedBy(normalizeLegacyVisibleCopy(Array.isArray(saved?.packs) ? saved.packs : structuredClone(state.basePacks)));
  state.copyProfile = saved?.copyProfile || "general";
  state.scenarioId = saved?.scenarioId || "default";
  state.filter = saved?.filter || "all";
  state.query = saved?.query || "";
  state.selectedId = saved?.selectedId || state.packs[0]?.id || "";
  state.status = normalizeLegacyVisibleCopy(saved?.status || state.status);
  state.actionReceipt = normalizeActionReceipt(normalizeLegacyVisibleCopy(saved?.actionReceipt));
  backendPackCommandCache.clear();
}

function loadBackendOwnedState(backendState){loadState(backendState);state.suppressNextSave=true}

function purgeLegacyDemoState() {
  for (const key of LEGACY_DEMO_STORAGE_KEYS) {
    try {
      if (key !== DEMO_STORAGE_KEY && localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    } catch {}
  }
}

async function applyLaunchConfiguration() {
  const profileParam = launchParams.get("profile");
  const hasProfileParam = Boolean(profileParam && copyProfiles[profileParam]);

  const scenarioParam = launchParams.get("scenario");
  if (scenarioParam && DEMO_SCENARIO_BY_ID[scenarioParam]) {
    state.route = DEMO_SCENARIO_BY_ID[scenarioParam].route || state.route;
    await applyScenario(DEMO_SCENARIO_BY_ID[scenarioParam], { force: true, preserveProfile: hasProfileParam });
  } else if (!Array.isArray(state.packs) || state.packs.length === 0) {
    await applyScenario(DEMO_SCENARIO_BY_ID.default, { preserveProfile: hasProfileParam });
  } else if (!DEMO_SCENARIO_BY_ID[state.scenarioId]) {
    state.scenarioId = "default";
  }

  if (hasProfileParam) {
    if (DEMO_API_BASE_URL) {
      await saveBackendProfile(profileParam, "URL");
    } else {
      state.copyProfile = profileParam;
      state.status = profileStatus(profileParam, "URL");
    }
    syncSearchParam("profile", profileParam);
  }

}

async function applyScenario(scenario, options = {}) {
  const current = DEMO_SCENARIO_BY_ID[scenario?.id] || DEMO_SCENARIO_BY_ID.default;
  const force = options.force ?? false;

  if (DEMO_API_BASE_URL) {
    try {
      await clearPendingBackendStateSave();
      const result = await saveBackendScenario(current.id, { preserveProfile: Boolean(options.preserveProfile) });
      if (current.route && options.applyRoute) {
        state.route = current.route;
      }
      syncSearchParam("scenario", result.scenarioId || current.id);
      syncSearchParam("profile", state.copyProfile);
      render();
      return result;
    } catch (error) {
      state.status = `Where: Scenario. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
      state.suppressNextSave=true;
      render();
      return null;
    }
  }

  const next = clearDanglingBlockedBy(current.transform(structuredClone(state.basePacks)));
  state.packs = next;
  state.scenarioId = current.id;
  state.filter = current.filter || "all";
  if (!options.preserveProfile) {
    state.copyProfile = current.profile || state.copyProfile;
  }
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
  syncSearchParam("profile", state.copyProfile);
  saveState();
  render();
}

function saveState(){if(state.suppressNextSave){state.suppressNextSave=false;return}if(DEMO_API_BASE_URL){scheduleBackendStateSave(browserRowStateSnapshot());return}localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(demoStateSnapshot()))}

function demoStateSnapshot(){return{packs:state.packs,copyProfile:state.copyProfile,scenarioId:state.scenarioId,selectedId:state.selectedId,status:state.status,actionReceipt:state.actionReceipt,filter:state.filter,query:state.query}}

function browserRowStateSnapshot(){const s=demoStateSnapshot();delete s.actionReceipt;delete s.query;delete s.status;return{kind:"projects-browser-state-v1",state:s}}

function recoverySnapshotText() {
  return JSON.stringify({
    projectsDemoRecovery: RECOVERY_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    state: demoStateSnapshot()
  }, null, 2);
}

async function resetState() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  purgeLegacyDemoState();
  syncSearchParam("scenario", null);
  syncSearchParam("profile", null);
  state.actionReceipt = null;
  state.clipboardReceipt = null;
  if (DEMO_API_BASE_URL) {
    try {
      await clearPendingBackendStateSave();
      await saveBackendResetState();
    } catch (error) {
      state.status=routeStatus("Backend reset",error.message||"reset failed","try again");state.suppressNextSave=true;
    }
    render();
    return;
  }
  state.packs = structuredClone(state.basePacks);
  state.copyProfile = "general";
  state.scenarioId = "default";
  state.selectedId = state.packs[0]?.id || "";
  state.query = "";
  state.filter = "all";
  state.status = resetDemoStatus();
  render();
}

function copyRecoverySnapshot() {
  const snapshot = recoverySnapshotText();
  const output = el("demo-recovery-output");
  if (output) {
    output.value = snapshot;
  }

  copyToClipboard(
    snapshot,
    clipboardStatus("Recovery", "save the copied demo backup"),
    {
      controlId: "copy-recovery-state",
      targetId: "demo-recovery-output",
      targetLabel: "Recovery JSON",
      title: "Recovery backup copied",
      detail: "The current demo snapshot is ready to save.",
      next: "Save the copied backup"
    }
  );
}

async function restoreRecoverySnapshot() {
  try {
    const snapshot = parseRecoverySnapshot(valueOf("demo-recovery-input"));
    const restoredStatus = routeStatus("Recovery", DEMO_BLOCKER_NONE, "review backup");
    snapshot.status = restoredStatus;
    snapshot.actionReceipt = null;
    if (DEMO_API_BASE_URL) {
      await clearPendingBackendStateSave();
      loadBackendOwnedState(await restoreBackendStateSnapshot(snapshot));
    } else {
      loadState(snapshot);
      saveState();
    }

    state.status = restoredStatus;
    state.clipboardReceipt = null;
    syncSearchParam("scenario", state.scenarioId === "default" ? null : state.scenarioId);
    syncSearchParam("profile", state.copyProfile === "general" ? null : state.copyProfile);
    render();
  } catch (error) {
    state.status = `Where: Recovery. Blocker: ${error.message || "invalid backup"}. Next action: paste a valid demo backup.`;
    if(DEMO_API_BASE_URL)state.suppressNextSave=true;
    render();
  }
}

async function eraseBackendState() {
  if (!DEMO_API_BASE_URL) {
    return;
  }

  try {
    await clearPendingBackendStateSave();
    const response = await fetch(apiUrl("/api/state/erase"), {
      method: "POST",
      headers: await apiHeaders()
    });
    if (!response.ok) {
      throw new Error(`Backend erase failed with ${response.status}`);
    }

    const result = await response.json();
    loadBackendOwnedState(result.state);
    state.status = routeStatus("Backend erase", DEMO_BLOCKER_NONE, "review sample state");
    state.clipboardReceipt = null;
    render();
  } catch (error) {
    state.status=routeStatus("Backend erase",error.message||"erase failed","try again");state.suppressNextSave=true;
    render();
  }
}

function parseRecoverySnapshot(value) {
  const parsed = safeJson(value);
  const source = parsed?.projectsDemoRecovery === RECOVERY_SNAPSHOT_VERSION
    ? parsed.state
    : parsed;
  return normalizeRecoveryState(source);
}

function normalizeRecoveryState(source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.packs)) {
    throw new Error("paste a Projects demo recovery JSON snapshot");
  }

  const packs = source.packs;
  if (packs.length > DEMO_STATE_MAX_PACKS) {
    throw new Error(`backup has more than ${DEMO_STATE_MAX_PACKS} work items`);
  }

  const normalizedPacks = packs.map(normalizeRecoveryPack);
  const packIds = new Set();
  for (const pack of normalizedPacks) {
    if (packIds.has(pack.id)) {
      throw new Error("backup work item ids must be unique");
    }
    packIds.add(pack.id);
  }
  clearDanglingBlockedBy(normalizedPacks);

  const selectedId = normalizeRecoveryText(source.selectedId, 120);
  const copyProfile = copyProfiles[source.copyProfile] ? source.copyProfile : "general";
  const scenarioId = DEMO_SCENARIO_BY_ID[source.scenarioId] ? source.scenarioId : "default";
  const filter = filters.some(([key]) => key === source.filter) ? source.filter : "all";

  return {
    packs: normalizedPacks,
    copyProfile,
    scenarioId,
    selectedId: normalizedPacks.some((pack) => pack.id === selectedId)
      ? selectedId
      : normalizedPacks[0]?.id || "",
    status: normalizeRecoveryText(source.status, 1000) || "Where: Recovery. Blocker: None. Next action: review restored demo state.",
    actionReceipt: normalizeActionReceipt(source.actionReceipt),
    filter,
    query: normalizeRecoveryText(source.query, 200)
  };
}

function normalizeRecoveryPack(source) {
  if (!source || typeof source !== "object") {
    throw new Error("backup contains an invalid work item");
  }

  const id = normalizeRecoveryText(source.id, 120);
  const title = normalizeRecoveryText(source.title, 200);
  if (!id || !title) {
    throw new Error("backup work items need an id and title");
  }

  return {
    id,
    title,
    type: normalizeRecoveryText(source.type, 80) || "general",
    status: normalizeRecoveryStatus(source.status),
    blocker: normalizeStoredBlocker(source.blocker),
    blockedBy: normalizeRecoveryText(source.blockedBy, 120),
    next: normalizeRecoveryText(source.next, 120),
    due: normalizeRecoveryText(source.due, 40),
    owner: normalizeRecoveryText(source.owner, 120),
    purpose: normalizeRecoveryText(source.purpose, 1000),
    doneWhen: normalizeRecoveryText(source.doneWhen, 1000),
    sources: normalizeRecoveryTextArray(source.sources, 50, 200),
    memory: normalizeRecoveryTextArray(source.memory, 100, 2000),
    activity: normalizeRecoveryTextArray(source.activity, 100, 400)
  };
}

function normalizeRecoveryStatus(value) {
  const status = normalizeRecoveryText(value, 40).toLowerCase();
  return ["active", "blocked", "draft", "done"].includes(status) ? status : "draft";
}

function normalizeRecoveryTextArray(value, maxItems, maxLength) {return Array.isArray(value)?value.map((entry) => normalizeRecoveryText(entry, maxLength)).filter(Boolean).slice(0, maxItems):[]}

function normalizeRecoveryText(value, maxLength) {return normalizeLegacyVisibleCopy(normalizeCopy(value)).slice(0, maxLength)}

function normalizeApiBaseUrl(value) {
  const text = normalizeCopy(value);
  return text ? text.replace(/\/+$/u, "") : "";
}

function apiUrl(path) {const base = DEMO_API_BASE_URL === "." ? "" : DEMO_API_BASE_URL;return `${base}${path.startsWith("/") ? path : `/${path}`}`}

async function loadBackendState(headers = null) {
  if (!DEMO_API_BASE_URL) {
    return null;
  }

  const response = await fetch(apiUrl("/api/state"), {
    cache: "no-store",
    headers: headers || await apiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Backend API failed with ${response.status}`);
  }

  return response.json();
}

async function loadBackendSeedPacks(headers = null) {
  if (!DEMO_API_BASE_URL) {
    return [];
  }

  const response = await fetch(apiUrl("/api/demo-packs"), {
    cache: "no-store",
    headers: headers || await apiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Backend demo data failed with ${response.status}`);
  }

  return response.json();
}

function normalizeStoredDemoState(value) {return value && typeof value === "object" ? value : {}}

function scheduleBackendStateSave(snapshot) {
  apiPendingSnapshot = structuredClone(snapshot);
  window.clearTimeout(apiSaveTimer);
  apiSaveTimer = window.setTimeout(flushBackendStateSave, API_STATE_SAVE_DEBOUNCE_MS);
}

function flushBackendStateSave() {
  if (apiSaveInFlight || !apiPendingSnapshot) {
    return;
  }

  const snapshot = apiPendingSnapshot;
  apiPendingSnapshot = null;
  apiSaveInFlight = true;
  apiSavePromise = persistBackendStateSnapshot(snapshot)
    .catch((error) => {
      apiPendingSnapshot = snapshot;
      console.error("Projects demo API save failed.", error);
    })
    .finally(() => {
      apiSaveInFlight = false;
      apiSavePromise = null;
      if (apiPendingSnapshot) {
        scheduleBackendStateSave(apiPendingSnapshot);
      }
    });
}

async function persistBackendStateSnapshot(snapshot) {
  await sendBackendStateSnapshot("/api/state/browser", "PUT", snapshot, "Save");
}

async function restoreBackendStateSnapshot(snapshot) {
  return sendBackendStateSnapshot("/api/state/restore", "POST", snapshot, "Restore");
}

async function sendBackendStateSnapshot(path, method, snapshot, label) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    throw new Error(`${label} ${response.status}`);
  }
  return response.json();
}

async function postBackendStateAction(path, payload, label) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Backend ${label} failed with ${response.status}`);
  const result = await response.json();
  loadBackendOwnedState(result.state);
  return result;
}

async function saveBackendStateFilter(filter) {
  await prepareBackendWorkflowRequest();
  return postBackendStateAction("/api/state/filter", { filter }, "filter");
}

async function saveBackendSelectedWork(selectedId) {
  return postBackendStateAction("/api/state/selected", { selectedId }, "selected work");
}

async function saveBackendScenario(scenarioId, options = {}) {
  return postBackendStateAction("/api/state/scenario", { scenarioId, preserveProfile: Boolean(options.preserveProfile) }, "scenario");
}

async function saveBackendProfile(profile, source = "Start") {
  return postBackendStateAction("/api/state/profile", { profile, source }, "profile");
}

async function saveBackendResetState() {
  return postBackendStateAction("/api/state/reset", {}, "reset");
}

async function runBackendPackAction(pack, action) {
  if (!DEMO_API_BASE_URL || !pack?.id || !SERVER_PACK_ACTIONS.has(action)) {
    return false;
  }

  await prepareBackendWorkflowRequest();
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/actions`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action })
  });
  if (!response.ok) {
    throw new Error(`Backend action failed with ${response.status}`);
  }

  const result = await response.json();
  loadBackendOwnedState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  if (action === "open") {
    queueFocus("pack-detail", state.selectedId);
  }
  go("pack", state.selectedId);
  return true;
}

async function saveBackendPackNextAction(pack, next) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  await prepareBackendWorkflowRequest();
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/next`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ next })
  });
  if (!response.ok) {
    throw new Error(`Backend next action failed with ${response.status}`);
  }

  const result = await response.json();
  loadBackendOwnedState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  return result;
}

async function createBackendPack(values) {
  if (!DEMO_API_BASE_URL) {
    return null;
  }

  await prepareBackendWorkflowRequest();
  const response = await fetch(apiUrl("/api/packs"), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(values)
  });
  if (!response.ok) {
    throw new Error(`Backend create failed with ${response.status}`);
  }

  const result = await response.json();
  loadBackendOwnedState(result.state);
  state.selectedId = result.pack?.id || state.selectedId;
  return result;
}

async function addBackendPackMemoryNote(pack, note) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  await prepareBackendWorkflowRequest();
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/memory`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ note })
  });
  if (!response.ok) {
    throw new Error(`Backend memory action failed with ${response.status}`);
  }

  const result = await response.json();
  loadBackendOwnedState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  return result;
}

async function saveBackendPackPath(pack, values) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  await prepareBackendWorkflowRequest();
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/path`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(values)
  });
  if (!response.ok) {
    throw new Error(`Backend work path action failed with ${response.status}`);
  }

  const result = await response.json();
  loadBackendOwnedState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  return result;
}

async function prepareBackendWorkflowRequest() {
  await clearPendingBackendStateSave();
}

function backendPackCommandForSelected(pack) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  const key = backendPackCommandCacheKey(pack);
  if (backendPackCommandCache.has(key)) {
    const preview = backendPackCommandCache.get(key);
    if (!preview) {
      return null; // Failed previously — use local commands
    }
    const localCommand = resolvePrimaryCommandForPack(pack);
    const localWorkflow = workflowStateForPack(pack, localCommand);
    return {
      where: preview.where || workTitle(pack),
      blocker: preview.blocker || blockerTextForPack(pack),
      next: preview.next || localCommand.label,
      stateText: preview.stateText || localWorkflow.label,
      stateHelp: preview.stateHelp || localWorkflow.help,
      action: preview.action || localCommand.action,
      targetPackId: preview.targetPackId || localCommand.targetPackId,
      flowHint: preview.flowHint || selectedFlowHintForPack(pack, localCommand, preview.blocker || blockerTextForPack(pack)),
      primaryReason: preview.primaryReason || primaryCommandVisibleReason(pack, localCommand),
      memory: latestRelevantMemory(pack)
    };
  }

  const preview = backendPackCommandCache.get(key);
  if (!preview) {
    scheduleBackendPackCommandPreview(pack);
    return null;
  }

  const localCommand = resolvePrimaryCommandForPack(pack);
  const localWorkflow = workflowStateForPack(pack, localCommand);
  return {
    where: preview.where || workTitle(pack),
    blocker: preview.blocker || blockerTextForPack(pack),
    next: preview.next || localCommand.label,
    stateText: preview.stateText || localWorkflow.label,
    stateHelp: preview.stateHelp || localWorkflow.help,
    action: preview.action || localCommand.action,
    targetPackId: preview.targetPackId || localCommand.targetPackId,
    flowHint: preview.flowHint || selectedFlowHintForPack(pack, localCommand, preview.blocker || blockerTextForPack(pack)),
    primaryReason: preview.primaryReason || primaryCommandVisibleReason(pack, localCommand),
    memory: latestRelevantMemory(pack)
  };
}

function backendCommandPendingForPack(pack) {
  return {
    where: workTitle(pack),
    blocker: blockerTextForPack(pack),
    next: "Loading backend command",
    stateText: "Syncing",
    stateHelp: backendCommandPendingReason(),
    action: "backend-command-pending",
    targetPackId: pack.id,
    flowHint: backendCommandPendingFlowHint(),
    primaryReason: "Why: waiting for backend command.",
    memory: latestRelevantMemory(pack),
    backendPending: true
  };
}

function isBackendCommandPending(command) {
  return command?.backendPending === true || command?.action === "backend-command-pending";
}

function backendCommandPendingReason() {
  return "Waiting for the server-owned command preview.";
}

function backendCommandPendingFlowHint() {
  return "Flow: wait for the backend command preview, then do next.";
}

function scheduleBackendPackCommandPreview(pack) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return;
  }

  const key = backendPackCommandCacheKey(pack);
  if (backendPackCommandCache.has(key) || pendingBackendPackCommandRequests.has(key)) {
    return;
  }

  pendingBackendPackCommandRequests.add(key);
  loadBackendPackCommandPreview(pack, key)
    .catch(() => {
      state.status = routeStatus("Command preview", "backend unreachable", "retry or refresh");
      // Cache null to prevent repeated attempts — use local commands
      backendPackCommandCache.set(key, null);
    })
    .finally(() => {
      pendingBackendPackCommandRequests.delete(key);
    });
}

async function loadBackendPackCommandPreview(pack, key) {
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/command`), {
    cache: "no-store",
    headers: await apiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Backend command preview failed with ${response.status}`);
  }

  const preview = await response.json();
  const current = findPack(pack.id);
  if (!current || key !== backendPackCommandCacheKey(current) || preview.signature !== packCommandSignature(current)) {
    return;
  }

  backendPackCommandCache.set(key, preview);
  if (currentPack()?.id === current.id) {
    renderCommand(current);
  }
}

function backendPackCommandCacheKey(pack) {
  return `${pack.id}:${packCommandSignature(pack)}`;
}

function updateServiceBoundaryNotice() {
  const notice = el("demo-notice");
  if (!notice) {
    return;
  }

  const syncCode = readSyncCode();
  notice.textContent = DEMO_API_BASE_URL && syncCode
    ? "Sync code active. Anyone with the code can open this demo state. No private project data."
    : DEMO_API_BASE_URL
      ? "Demo data only. Saves to this backend row; no login. No private project data."
      : "Demo data only. Saves in this browser; no login. No private project data.";
  renderDemoSyncControls();
}

function bindDemoSyncControls() {
  el("sync-code-use")?.addEventListener("click", () => {
    withSyncControlsBusy(() => activateSyncCode(valueOf("sync-code-input"), { copyCurrentState: false }));
  });
  el("sync-code-new")?.addEventListener("click", () => {
    withSyncControlsBusy(() => {
      const code = generateSyncCode();
      const input = el("sync-code-input");
      if (input) {
        input.value = code;
      }
      return activateSyncCode(code, { copyCurrentState: true });
    });
  });
  el("sync-code-copy")?.addEventListener("click", () => {
    copySyncLink();
  });
  el("sync-code-copy-code")?.addEventListener("click", () => {
    copySyncCode();
  });
  el("sync-code-leave")?.addEventListener("click", () => {
    withSyncControlsBusy(leaveSyncCode);
  });
}

function applyLaunchSyncCode() {
  if (!DEMO_API_BASE_URL) {
    return "";
  }

  const code = normalizeSyncCode(launchParams.get(SYNC_CODE_QUERY_PARAM) || "");
  if (!code) {
    return "";
  }

  writeSyncCode(code);
  apiSessionClientId = "";
  return code;
}

function renderDemoSyncControls(message = "") {
  const panel = el("demo-sync");
  if (!panel) {
    return;
  }

  panel.hidden = !BACKEND_MODE;
  if (!BACKEND_MODE) {
    return;
  }

  const syncCode = readSyncCode();
  const input = el("sync-code-input");
  if (input && document.activeElement !== input) {
    input.value = syncCode;
  }
  if (el("sync-code-state")) {
    el("sync-code-state").textContent = syncCode
      ? `Using ${syncCode}. Other devices can use this code.`
      : "This device has its own demo state.";
  }
  if (el("sync-code-leave")) {
    el("sync-code-leave").hidden = !syncCode;
  }
  if (el("sync-code-copy")) {
    el("sync-code-copy").hidden = !syncCode;
  }
  if (el("sync-code-copy-code")) {
    el("sync-code-copy-code").hidden = !syncCode;
  }
  renderSyncShare(syncCode);
  const help = el("sync-code-help");
  if (help) {
    help.textContent = message || (syncCode
      ? "Share sample data only. Anyone with this code can open this state."
      : "Use a code to sync devices. No login or private storage.");
  }
}

function renderSyncShare(syncCode) {
  const share = el("sync-code-share");
  const link = el("sync-code-link");
  const qr = el("sync-code-qr");
  const shareUrl = syncShareUrl(syncCode);
  if (!share || !link || !qr) {
    return;
  }

  share.hidden = !shareUrl;
  if (!shareUrl) {
    link.removeAttribute("href");
    qr.replaceChildren();
    qr.removeAttribute("data-qr-value");
    return;
  }

  link.href = shareUrl;
  link.textContent = "Open sync link";
  qr.dataset.qrValue = shareUrl;
  renderSyncQr(qr, shareUrl);
}

function syncShareUrl(syncCode) {
  const code = normalizeSyncCode(syncCode);
  if (!code) {
    return "";
  }

  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set(SYNC_CODE_QUERY_PARAM, code);
  url.hash = "#/home";
  return url.toString();
}

async function copySyncLink() {
  const shareUrl = syncShareUrl(readSyncCode());
  if (!shareUrl) {
    renderDemoSyncControls("Make a sync code before copying a sync link.");
    return;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    state.status=routeStatus("Sync link",DEMO_BLOCKER_NONE,"open on another device");if(DEMO_API_BASE_URL)state.suppressNextSave=true;
    render();
    renderDemoSyncControls("Sync link copied. Anyone with it can open it.");
  } catch {
    renderDemoSyncControls("Copy blocked. Use the visible sync link or scan the QR code.");
  }
}

async function copySyncCode() {
  const syncCode = readSyncCode();
  if (!syncCode) {
    renderDemoSyncControls("Make a sync code before copying it.");
    return;
  }

  try {
    await navigator.clipboard.writeText(syncCode);
    state.status=routeStatus("Sync code",DEMO_BLOCKER_NONE,"enter code on another device");if(DEMO_API_BASE_URL)state.suppressNextSave=true;
    render();
    renderDemoSyncControls("Sync code copied. Anyone with it can open it.");
  } catch {
    renderDemoSyncControls("Copy blocked. Use the visible sync code or scan the QR code.");
  }
}

async function withSyncControlsBusy(action) {
  setSyncControlsBusy(true);
  try {
    await action();
  } catch (error) {
    console.error("Projects demo sync failed.", error);
    renderDemoSyncControls(error.message || "Sync code failed.");
  } finally {
    setSyncControlsBusy(false);
  }
}

function setSyncControlsBusy(busy) {
  ["sync-code-input", "sync-code-use", "sync-code-new", "sync-code-copy-code", "sync-code-copy", "sync-code-leave"].forEach((id) => {
    const control = el(id);
    if (control) {
      control.disabled = Boolean(busy);
    }
  });
}

async function activateSyncCode(value, options = {}) {
  if (!DEMO_API_BASE_URL) {
    renderDemoSyncControls("Sync codes need the backend app mode.");
    return;
  }

  const code = normalizeSyncCode(value);
  if (!code) {
    renderDemoSyncControls(`Enter at least ${SYNC_CODE_MIN_COMPACT_LENGTH} letters or numbers for a sync code.`);
    return;
  }

  await clearPendingBackendStateSave();
  if (options.copyCurrentState) {
    await postBackendStateAction("/api/state/sync-copy",{targetClientId:await syncClientId(code)},"sync copy");
    writeSyncCode(code);
    apiSessionClientId = "";
    state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "use code elsewhere");
  } else {
    apiSessionClientId = "";
    loadBackendOwnedState(await loadBackendState());
    writeSyncCode(code);
    state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "review shared demo state");
  }

  updateServiceBoundaryNotice();
  render();
  renderDemoSyncControls(options.copyCurrentState
    ? "New code active. Use it elsewhere to open this state."
    : "Code active. This device opens shared demo state.");
}

async function leaveSyncCode() {
  if (!DEMO_API_BASE_URL) {
    return;
  }

  await clearPendingBackendStateSave();
  clearSyncCode();
  clearLaunchSyncCodeParam();
  apiSessionClientId = "";
  loadBackendOwnedState(await loadBackendState());
  state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "use this device only");
  updateServiceBoundaryNotice();
  render();
  renderDemoSyncControls("Sync code left. This device is back to its own demo state.");
}

async function clearPendingBackendStateSave() {
  window.clearTimeout(apiSaveTimer);
  apiPendingSnapshot = null;
  if (apiSavePromise) {
    await apiSavePromise;
  }
  apiSaveInFlight = false;
}

function readSyncCode() {
  try {
    return normalizeSyncCode(localStorage.getItem(SYNC_CODE_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function writeSyncCode(code) {
  try {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, code);
  } catch {}
}

function clearSyncCode() {
  try {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch {}
}

function clearLaunchSyncCodeParam() {
  if (launchParams.has(SYNC_CODE_QUERY_PARAM)) {
    launchParams.delete(SYNC_CODE_QUERY_PARAM);
    syncSearchParam(SYNC_CODE_QUERY_PARAM, "");
  }
}

function normalizeSyncCode(value) {
  const compact = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "")
    .slice(0, SYNC_CODE_MAX_COMPACT_LENGTH);
  if (compact.length < SYNC_CODE_MIN_COMPACT_LENGTH) {
    return "";
  }

  return compact.match(/.{1,4}/gu).join("-");
}

function generateSyncCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random sync codes need Web Crypto in this browser.");
  }

  const bytes = new Uint8Array(SYNC_CODE_GENERATED_COMPACT_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  const compact = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return compact.match(/.{1,4}/gu).join("-");
}

function renderSyncQr(target, value) {
  try {
    target.innerHTML = syncQrSvg(value);
  } catch (error) {
    target.replaceChildren();
    target.textContent = "QR unavailable";
    target.title = error.message;
  }
}

function syncQrSvg(value) {
  const matrix = syncQrMatrix(value);
  const viewBoxSize = SYNC_QR_SIZE + (SYNC_QR_QUIET_MODULES * 2);
  const rects = [];
  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (dark) {
        rects.push(`<rect x="${columnIndex + SYNC_QR_QUIET_MODULES}" y="${rowIndex + SYNC_QR_QUIET_MODULES}" width="1" height="1"/>`);
      }
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#fff"/><g fill="#111">${rects.join("")}</g></svg>`;
}

function syncQrMatrix(value) {
  const dataCodewords = syncQrDataCodewords(value);
  const codewords = dataCodewords.concat(qrReedSolomonRemainder(dataCodewords, SYNC_QR_ERROR_CODEWORDS));
  const modules = Array.from({ length: SYNC_QR_SIZE }, () => Array(SYNC_QR_SIZE).fill(false));
  const reserved = Array.from({ length: SYNC_QR_SIZE }, () => Array(SYNC_QR_SIZE).fill(false));

  setupSyncQrFunctionPatterns(modules, reserved);
  placeSyncQrCodewords(modules, reserved, codewords);
  applySyncQrMask(modules, reserved);
  placeSyncQrFormatBits(modules, reserved);

  return modules;
}

function syncQrDataCodewords(value) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > SYNC_QR_MAX_BYTES) {
    throw new Error("Sync link is too long for the built-in QR code.");
  }

  const bits = [];
  pushQrBits(bits, 0b0100, 4);
  pushQrBits(bits, bytes.length, 8);
  bytes.forEach((byte) => pushQrBits(bits, byte, 8));

  const capacityBits = SYNC_QR_DATA_CODEWORDS * 8;
  const terminatorBits = Math.min(4, capacityBits - bits.length);
  for (let index = 0; index < terminatorBits; index += 1) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bits.slice(index, index + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  }

  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < SYNC_QR_DATA_CODEWORDS) {
    codewords.push(padBytes[padIndex % padBytes.length]);
    padIndex += 1;
  }

  return codewords;
}

function pushQrBits(bits, value, length) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function setupSyncQrFunctionPatterns(modules, reserved) {
  placeQrFinder(modules, reserved, 0, 0);
  placeQrFinder(modules, reserved, 0, SYNC_QR_SIZE - 7);
  placeQrFinder(modules, reserved, SYNC_QR_SIZE - 7, 0);
  placeQrAlignment(modules, reserved, 30, 30);
  placeQrTiming(modules, reserved);
  reserveQrFormatAreas(modules, reserved);
  setQrFunctionModule(modules, reserved, (4 * SYNC_QR_VERSION) + 9, 8, true);
}

function placeQrFinder(modules, reserved, top, left) {
  for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
      const row = top + rowOffset;
      const column = left + columnOffset;
      if (!isQrModuleInBounds(row, column)) {
        continue;
      }

      const separator = rowOffset === -1 || rowOffset === 7 || columnOffset === -1 || columnOffset === 7;
      const dark = !separator && (
        rowOffset === 0
        || rowOffset === 6
        || columnOffset === 0
        || columnOffset === 6
        || (rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4)
      );
      setQrFunctionModule(modules, reserved, row, column, dark);
    }
  }
}

function placeQrAlignment(modules, reserved, centerRow, centerColumn) {
  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
      const distance = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
      const dark = distance === 2 || distance === 0;
      setQrFunctionModule(modules, reserved, centerRow + rowOffset, centerColumn + columnOffset, dark);
    }
  }
}

function placeQrTiming(modules, reserved) {
  for (let index = 8; index < SYNC_QR_SIZE - 8; index += 1) {
    const dark = index % 2 === 0;
    setQrFunctionModule(modules, reserved, 6, index, dark);
    setQrFunctionModule(modules, reserved, index, 6, dark);
  }
}

function reserveQrFormatAreas(modules, reserved) {
  for (let index = 0; index <= 8; index += 1) {
    if (index !== 6) {
      setQrFunctionModule(modules, reserved, 8, index, false);
      setQrFunctionModule(modules, reserved, index, 8, false);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    setQrFunctionModule(modules, reserved, SYNC_QR_SIZE - 1 - index, 8, false);
    setQrFunctionModule(modules, reserved, 8, SYNC_QR_SIZE - 1 - index, false);
  }
}

function placeSyncQrCodewords(modules, reserved, codewords) {
  const bits = [];
  codewords.forEach((codeword) => pushQrBits(bits, codeword, 8));
  let bitIndex = 0;
  let upward = true;

  for (let rightColumn = SYNC_QR_SIZE - 1; rightColumn >= 1; rightColumn -= 2) {
    if (rightColumn === 6) {
      rightColumn -= 1;
    }

    for (let rowStep = 0; rowStep < SYNC_QR_SIZE; rowStep += 1) {
      const row = upward ? SYNC_QR_SIZE - 1 - rowStep : rowStep;
      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const column = rightColumn - columnOffset;
        if (!reserved[row][column]) {
          modules[row][column] = bitIndex < bits.length ? Boolean(bits[bitIndex]) : false;
          bitIndex += 1;
        }
      }
    }

    upward = !upward;
  }
}

function applySyncQrMask(modules, reserved) {
  for (let row = 0; row < SYNC_QR_SIZE; row += 1) {
    for (let column = 0; column < SYNC_QR_SIZE; column += 1) {
      if (!reserved[row][column] && (row + column) % 2 === 0) {
        modules[row][column] = !modules[row][column];
      }
    }
  }
}

function placeSyncQrFormatBits(modules, reserved) {
  const bits = qrFormatBits(0);

  for (let index = 0; index <= 5; index += 1) {
    setQrFunctionModule(modules, reserved, 8, index, qrBit(bits, index));
  }
  setQrFunctionModule(modules, reserved, 8, 7, qrBit(bits, 6));
  setQrFunctionModule(modules, reserved, 8, 8, qrBit(bits, 7));
  setQrFunctionModule(modules, reserved, 7, 8, qrBit(bits, 8));
  for (let index = 9; index < 15; index += 1) {
    setQrFunctionModule(modules, reserved, 14 - index, 8, qrBit(bits, index));
  }

  for (let index = 0; index < 8; index += 1) {
    setQrFunctionModule(modules, reserved, 8, SYNC_QR_SIZE - 1 - index, qrBit(bits, index));
  }
  for (let index = 8; index < 15; index += 1) {
    setQrFunctionModule(modules, reserved, SYNC_QR_SIZE - 15 + index, 8, qrBit(bits, index));
  }
  setQrFunctionModule(modules, reserved, (4 * SYNC_QR_VERSION) + 9, 8, true);
}

function qrFormatBits(mask) {
  const errorCorrectionLevelBits = 0b01;
  const data = (errorCorrectionLevelBits << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) {
      remainder ^= 0x537 << (bit - 10);
    }
  }
  return ((data << 10) | (remainder & 0x3ff)) ^ 0x5412;
}

function qrBit(value, index) {
  return Boolean((value >>> index) & 1);
}

function setQrFunctionModule(modules, reserved, row, column, dark) {
  if (!isQrModuleInBounds(row, column)) {
    return;
  }
  modules[row][column] = Boolean(dark);
  reserved[row][column] = true;
}

function isQrModuleInBounds(row, column) {
  return row >= 0 && row < SYNC_QR_SIZE && column >= 0 && column < SYNC_QR_SIZE;
}

function qrReedSolomonRemainder(dataCodewords, degree) {
  const generator = qrReedSolomonGenerator(degree);
  const result = Array(degree).fill(0);

  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= qrGaloisMultiply(coefficient, factor);
    });
  });

  return result;
}

function qrReedSolomonGenerator(degree) {
  let generator = [1];
  for (let factor = 0; factor < degree; factor += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= qrGaloisMultiply(coefficient, qrGaloisExponent(factor));
    });
    generator = next;
  }
  return generator;
}

function qrGaloisMultiply(left, right) {
  if (left === 0 || right === 0) {
    return 0;
  }
  return qrGaloisExponent(qrGaloisLog(left) + qrGaloisLog(right));
}

function qrGaloisExponent(exponent) {
  let normalized = exponent % 255;
  if (normalized < 0) {
    normalized += 255;
  }
  return qrGaloisTables().exponents[normalized];
}

function qrGaloisLog(value) {
  return qrGaloisTables().logs[value];
}

function qrGaloisTables() {
  if (qrGaloisTables.cache) {
    return qrGaloisTables.cache;
  }

  const exponents = Array(255).fill(0);
  const logs = Array(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exponents[index] = value;
    logs[value] = index;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11d;
    }
  }
  qrGaloisTables.cache = { exponents, logs };
  return qrGaloisTables.cache;
}

async function apiHeaders(values = {}) {
  const headers = { ...values };
  const clientId = await apiClientId();
  if (clientId) {
    headers["x-projects-demo-client"] = clientId;
  }
  return headers;
}

async function apiClientId() {
  if (!DEMO_API_BASE_URL) {
    return "";
  }

  const syncCode = readSyncCode();
  if (syncCode) {
    return syncClientId(syncCode);
  }

  const saved = readApiClientId();
  if (isApiClientId(saved)) {
    return saved;
  }
  if (isApiClientId(apiSessionClientId)) {
    return apiSessionClientId;
  }

  const next = generateApiClientId();
  apiSessionClientId = next;
  try {
    localStorage.setItem(API_CLIENT_STORAGE_KEY, next);
  } catch {}
  return next;
}

async function syncClientId(syncCode) {
  const normalized = normalizeSyncCode(syncCode);
  if (!normalized) {
    return "";
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Sync code sharing needs Web Crypto hashing in this browser.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`projects-web-demo-sync:${normalized}`)
  );
  return `sync-${base64Url(digest).slice(0, 64)}`;
}

function base64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function apiPersistenceLabel() {
  const syncCode = readSyncCode();
  return syncCode ? "Sync code" : "Backend API";
}

function readApiClientId() {
  try {
    return localStorage.getItem(API_CLIENT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function generateApiClientId() {
  if (globalThis.crypto?.randomUUID) {
    return `demo-${globalThis.crypto.randomUUID()}`;
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Backend state isolation needs Web Crypto in this browser.");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `demo-${base64Url(bytes)}`;
}

function isApiClientId(value) {
  return /^demo-(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{22})$/iu.test(value);
}

function persistenceVerb() {
  return DEMO_API_BASE_URL ? "Save to backend" : "Save work";
}

function persistenceStatusText(browserText = "This browser only") {
  return DEMO_API_BASE_URL ? apiPersistenceLabel() : browserText;
}

function persistenceEditStatus(browserText) {
  return DEMO_API_BASE_URL ? `Edits save to ${apiPersistenceLabel().toLowerCase()}` : browserText;
}

function persistenceMemoryStatus(browserText) {
  return DEMO_API_BASE_URL ? `Stored in ${apiPersistenceLabel().toLowerCase()}` : browserText;
}

function persistenceCreatedActivity() {
  return DEMO_API_BASE_URL ? `Created through ${apiPersistenceLabel().toLowerCase()}.` : "Created in this browser.";
}

function profileStatus(profileKey, source = "Start") {
  const value = copyProfiles[profileKey] || copyProfiles.general;
  const label = capitalize(copyProfiles[profileKey] ? profileKey : "general");
  return `Where: ${source}. Blocker: None. Next action: use ${label} copy labels for ${value.work}.`;
}

function scenarioStatus(scenario) {
  const current = DEMO_SCENARIO_BY_ID[scenario?.id] || DEMO_SCENARIO_BY_ID.default;
  const routeTitle = ROUTE_CONTRACT[current.route]?.title || "demo route";
  return `Where: Scenario ${current.label}. Blocker: None. Next action: open ${routeTitle}.`;
}

function resetDemoStatus() {
  return "Where: Start. Blocker: None. Next action: review reset demo data in this browser.";
}

function routeStatus(where, blocker, next) {
  const visibleBlocker = blockerDisplayValue(blocker);
  return `Where: ${where}. Blocker: ${visibleBlocker}. Next action: ${next}.`;
}

function renderNav() {
  el("demo-nav").innerHTML = navItems.map((item) => navItemMarkup(item.route)).join("");
}

function syncNavGroupExpandedState(group) {
  const summary = group?.querySelector(".demo-nav-group-label");
  if (summary) {
    summary.setAttribute("aria-expanded", String(Boolean(group.open)));
  }
}

function navItemMarkup(route) {
  const contract = ROUTE_CONTRACT[route];
  return `
    <a class="demo-nav-item nav-rail-btn" href="${escapeAttribute(formatRouteHash(route))}" data-route="${route}">
      <span class="nav-rail-icon" aria-hidden="true">${escapeHtml(contract.navKey)}</span>
      <strong>${escapeHtml(contract.navLabel)}</strong>
    </a>
  `;
}

function navGroupIdForRoute(route) {
  const group = NAV_ROUTE_GROUPS.find((item) => item.routes.includes(route));
  return group?.id || "";
}

function routeFromHash() {
  const parsedRoute = parseHashRoute(location.hash);
  const previousSelectedId = state.selectedId;
  const previousRoute = state.route;
  state.route = parsedRoute.route;
  if (previousRoute !== state.route) {
    workListKeepOrder = false;
  }

  if (parsedRoute.malformedPackId || parsedRoute.unexpectedPackId) {
    state.status = routeStatus(
      ROUTE_CONTRACT[state.route]?.title || "Demo",
      DEMO_BLOCKER_NONE,
      `open ${state.route}`
    );
  }

  if (parsedRoute.fallback) {
    history.replaceState({}, "", `${location.pathname}${location.search}${formatRouteHash("home")}`);
  }

  if (parsedRoute.packId && findPack(parsedRoute.packId)) {
    state.selectedId = parsedRoute.packId;
  } else if (parsedRoute.packId) {
    state.selectedId = state.packs[0]?.id || "";
  } else if (state.route === "review") {
    state.selectedId = preferredReviewPack()?.id || state.selectedId;
  } else if (state.route === "next") {
    state.selectedId = preferredNextSetupPack()?.id || state.selectedId;
  }

  if ((state.route === "next" || state.route === "memory") && !findPack(state.selectedId)) {
    const fallback = state.packs[0];
    if (fallback) {
      state.selectedId = fallback.id;
    } else {
      state.route = "home";
      history.replaceState({}, "", `${location.pathname}${location.search}${formatRouteHash("home")}`);
      state.status = routeStatus("Demo", `no ${profile().work} to act on`, profile().newWork);
    }
  }

  const selectedWorkChanged = state.selectedId !== previousSelectedId && findPack(state.selectedId);
  if (DEMO_API_BASE_URL && selectedWorkChanged) {
    state.suppressNextSave=true;
    saveBackendSelectedWork(state.selectedId).catch((error) => {
      state.status = `Where: Selected work. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
      state.suppressNextSave=true;
      render();
    });
  } else if (DEMO_API_BASE_URL && (state.route !== previousRoute || parsedRoute.fallback)) {
    state.suppressNextSave=true;
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
  const isSameRoute = state.route === (state.lastRenderedRoute || "");
  const shouldResetScroll = Boolean(previousHash !== currentHash && !state.pendingFocus && !isSameRoute);

  if (!state.packs.find((pack) => pack.id === state.selectedId)) {
    state.selectedId = state.packs[0]?.id || "";
  }

  document.querySelectorAll(".demo-nav-item").forEach((item) => {
    const isActive = item.dataset.route === state.route;
    item.classList.toggle("active", isActive);
    item.setAttribute("href", formatRouteHash(item.dataset.route, routeLinkPackId(item.dataset.route)));
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
  document.querySelectorAll(".demo-nav-group").forEach((item) => {
    const group = NAV_ROUTE_GROUPS.find((candidate) => candidate.id === item.dataset.navGroup);
    if (!group) {
      return;
    }
    item.open = !group.collapsed || group.id === navGroupIdForRoute(state.route);
    syncNavGroupExpandedState(item);
  });

  const screenTitle = screenTitleForRoute();
  document.documentElement.dataset.demoRoute = state.route;
  if (state.route === "pack") {
    document.documentElement.dataset.demoRoute = "work";
  }
  el("screen-title").textContent = screenTitle;
  updateDocumentTitle(screenTitle);
  renderCommand(currentPack());

  switch (state.route) {
    case "home":
      renderHome();
      break;
    case "review":
      renderReview();
      break;
    case "next":
      renderNext();
      break;
    case "create":
      renderCreate();
      break;
    case "memory":
      renderMemory();
      break;
    case "pack":
      renderPackDetail();
      break;
    case "compare":
      renderCompare();
      break;
    case "calendar":
      renderCalendar();
      break;
    case "settings":
      renderSettings();
      break;
    case "insights":
      renderInsights();
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
  state.lastRenderedRoute = state.route;
  saveState();
}

function screenTitleForRoute() {
  const profile = copyProfiles[state.copyProfile] || copyProfiles.general;
  if (state.route === "create") {
    return profile.newWork;
  }

  if (state.route === "home") {
    return "Start";
  }

  if (state.route === "work") {
    return `${workNounTitle(2)} list`;
  }

  if (state.route === "pack") {
    return `${workLabelTitle()} path`;
  }

  return ROUTE_CONTRACT[state.route]?.title || ROUTE_CONTRACT.work.title;
}

function updateDocumentTitle(screenTitle) {
  document.title = screenTitle === "Start" ? "Projects Portfolio Demo" : `${screenTitle} - Projects Portfolio Demo`;
}

function routeLinkPackId(route) {
  if (!ROUTE_CONTRACT[route]?.acceptsPackId) {
    return "";
  }

  if (route === "review") {
    return preferredReviewPack()?.id || state.selectedId;
  }

  if (route === "next") {
    return preferredNextSetupPack()?.id || state.selectedId;
  }

  return state.selectedId;
}

function renderCommand(selected) {
  const visibleCount = filteredPacks().length;
  const reviewCount = state.packs.filter(isReview).length;
  const command = commandForRoute(selected, visibleCount, reviewCount);
  updateCommand(command);
}

function commandForRoute(selected, visibleCount, reviewCount) {
  const reviewWorkNoun = workNoun(reviewCount);
  const allWorkNoun = workNoun(state.packs.length);
  const workListTitle = `${workNounTitle(2)} list`;
  const workOverviewTitle = "Start";
  const reviewSummary = reviewCount > 0
    ? `${reviewCount} ${reviewWorkNoun} need review`
    : DEMO_BLOCKER_NONE_LABEL;
  const reviewTarget = preferredReviewPack();
  const selectedWorkCommand = selectedPackCommand(selected);
  const hasSampleWork = state.packs.length > 0;
  const noSampleWorkCommand = (title, where, stateHelp) => ({
    title,
    where,
    blocker: `no ${workNoun(2)} exist`,
    next: profile().newWork,
    stateText: `No ${profile().work}`,
    stateHelp,
    action: "open-create",
    targetPackId: ""
  });
  const homeCommand = hasSampleWork
    ? { title: workOverviewTitle, where: "Start", blocker: reviewSummary, next: `Review ${workNoun(2)}`, stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" }
    : noSampleWorkCommand(workOverviewTitle, "Start", `${profile().newWork} or reset demo data before reviewing.`);
  const createCommand = createRouteCommand();
  const memoryCommand = memoryRouteCommand(selected, selectedWorkCommand);

  const routeCommands = {
    home: homeCommand,
    work: { title: workListTitle, ...selectedWorkCommand },
    review: { title: "Review", ...selectedWorkCommand },
    next: { title: "Next setup", ...selectedWorkCommand },
    create: createCommand,
    memory: memoryCommand,
    pack: { title: `${workLabelTitle()} path`, ...selectedWorkCommand }
  };

  const selectedBlocker = selected ? blockerTextForPack(selected) : "";
  const selectedActionCommand = selected
    ? (isBackendCommandPending(selectedWorkCommand) ? selectedWorkCommand : resolvePrimaryCommandForPack(selected))
    : null;
  const selectedActionFlow = selected
    ? (selectedWorkCommand.flowHint || selectedFlowHintForPack(selected, selectedActionCommand, selectedBlocker))
    : "";

  const routeCommandsHints = {
    home: hasSampleWork ? "Review blocked work first." : "Create work, then review it.",
    work: selectedActionFlow ? `${selectedActionFlow}` : "Flow: choose work, do next.",
    review: selectedActionFlow
      ? `${selectedActionFlow}`
      : "Flow: resolve blockers first.",
    next: "Flow: set button, return, do next.",
    memory: selected
      ? memoryRouteFlowHint(selected)
      : (hasSampleWork ? "Flow: choose work, add memory." : "Flow: create work, add memory."),
    pack: selected ? `${selectedActionFlow}` : "Flow: review work, do next.",
    create: createRouteFlowHint(createCommand)
  };

  const routeCommand = routeCommands[state.route] || routeCommands.work;
  return {
    ...routeCommand,
    stateText: capitalize(routeCommand.stateText),
    scope: `${visibleCount} of ${state.packs.length} ${allWorkNoun} visible.`,
    targetPackId: routeCommand.targetPackId || "",
    flowHint: routeCommandsHints[state.route] || routeCommandsHints.work
  };
}

function createRouteCommand() {
  const values = currentCreateValues();
  const createState = createSaveState(values);
  return {
    title: "Create",
    where: "Create",
    blocker: blockerDisplayValue(createState.blocker),
    next: createState.canSave ? persistenceVerb() : createActionForBlocker(createState.blocker),
    stateText: createReadinessLabel(createState),
    stateHelp: createState.help,
    action: createState.canSave ? "create-sample" : createFocusActionForBlocker(createState.blocker),
    targetPackId: ""
  };
}

function currentCreateValues() {
  return document.getElementById("new-title")
    ? createFormValues()
    : defaultCreateValues();
}

function createFocusActionForBlocker(blocker) {
  if (blocker === "missing title") {
    return "focus-create-title";
  }

  if (blocker === "missing owner") {
    return "focus-create-owner";
  }

  if (blocker === "missing next action") {
    return "focus-create-next";
  }

  return "create-sample";
}

function createRouteFlowHint(command) {
  if (command?.action === "create-sample") {
    return "Flow: save work, review, do next.";
  }

  return `Flow: ${normalizeCopy(command?.next).toLowerCase()}, then save work.`;
}

function memoryRouteCommand(selected, selectedWorkCommand) {
  if (!selected) {
    return { title: "Memory", ...selectedWorkCommand };
  }

  const memoryState = memoryNoteSaveState(selected, valueOf("memory-note"));
  if (memoryState.canSave) {
    return {
      title: "Memory",
      ...selectedWorkCommand,
      next: "Add note",
      stateText: "Ready",
      stateHelp: memoryState.help,
      action: "add-note",
      targetPackId: selectedWorkCommand.targetPackId
    };
  }

  return {
    title: "Memory",
    ...selectedWorkCommand,
    next: "Type memory note",
    stateText: "Needs note",
    stateHelp: memoryState.help,
    action: "type-memory-note",
    targetPackId: selectedWorkCommand.targetPackId
  };
}

function memoryRouteFlowHint(selected) {
  const memoryState = memoryNoteSaveState(selected, valueOf("memory-note"));
  return memoryState.canSave
    ? "Flow: add memory note."
    : "Flow: type memory note, then add note.";
}

function selectedFlowHintForPack(pack, command = resolvePrimaryCommandForPack(pack), blocker = blockerTextForPack(pack)) {
  if (!pack) {
    return "Flow: choose work, do next.";
  }

  const title = workTitle(pack);
  if (isMissingNextAction(pack)) {
    return `Flow: set next action for ${title}.`;
  }

  if (hasBlocker(pack)) {
    const ownerFlow = ownerBlockerFlowHint(pack, title);
    if (ownerFlow) {
      return ownerFlow;
    }

    return command?.action === "unblock"
      ? `Flow: clear ${blocker || DEMO_BLOCKER_NONE_LABEL} on ${title}.`
      : `Flow: review ${blocker || DEMO_BLOCKER_NONE_LABEL} on ${title}.`;
  }

  return `Flow: run ${command?.label || "Open"} for ${title}.`;
}

function ownerBlockerFlowHint(pack, title = workTitle(pack)) {
  const blocker = blockerTextForPack(pack).toLowerCase();
  if (!blocker.includes("owner")) {
    return "";
  }

  return isMissingOwnerValue(pack?.owner)
    ? "Flow: fill Owner, then set Blocker: None."
    : "Flow: set Blocker: None.";
}

function selectedPackCommand(selected) {
  const backendCommand = backendPackCommandForSelected(selected);
  if (backendCommand) {
    return backendCommand;
  }

  const resolvedAction = resolvePrimaryCommandForPack(selected);
  const workflow = workflowStateForPack(selected, resolvedAction);
  const hasAnyWork = state.packs.length > 0;
  return {
    where: selected ? workTitle(selected) : (hasAnyWork ? `Choose ${profile().work}` : `No ${profile().work}`),
    blocker: selected ? blockerTextForPack(selected) : (hasAnyWork ? `choose a ${workNoun(1)}` : `create or reset ${profile().work}`),
    next: resolvedAction.label,
    stateText: workflow.label,
    stateHelp: workflow.help,
    action: resolvedAction.action,
    targetPackId: resolvedAction.targetPackId,
    memory: latestRelevantMemory(selected)
  };
}

function resolvePrimaryCommandForPack(selected) {
  if (!selected) {
    if (state.packs.length === 0) {
      return { label: profile().newWork, action: "open-create", targetPackId: "" };
    }

    return { label: `Open ${workNoun(2)} list`, action: "open-work-list", targetPackId: "" };
  }

  if (isMissingNextAction(selected)) {
    return { label: "Set next action", action: "set-next", targetPackId: selected.id };
  }

  const action = commandActionForLabel(selected.next || "Open");
  if (hasBlocker(selected)) {
    if (action.action === "unblock") {
      return { label: "Set Blocker: None", action: "unblock", targetPackId: selected.id };
    }

    return { label: "Review blocker", action: "review", targetPackId: selected.id };
  }

  return { ...action, targetPackId: selected.id };
}

function workflowStateForPack(pack, command = null) {
  if (!pack) {
    if (state.packs.length === 0) {
      return {
        id: "empty",
        label: `No ${profile().work}`,
        path: "draft",
        help: `${profile().newWork} or reset ${profile().work} to see its path.`
      };
    }

    return {
      id: "none",
      label: `Choose ${profile().work}`,
      path: "draft",
      help: `Choose a ${workNoun(1)} to see its path.`
    };
  }

  const resolved = command || resolvePrimaryCommandForPack(pack);

  if (pack.status === "done") {
    return {
      id: "done",
      label: "Done",
      path: "done",
      help: `Proof is saved for ${workTitle(pack)}.`
    };
  }

  if (isMissingNextAction(pack)) {
    return {
      id: "needs-action",
      label: "Needs next action",
      path: "draft",
      help: "Next action is missing."
    };
  }

  if (hasBlocker(pack)) {
    return {
      id: "blocked",
      label: "Blocked",
      path: "review",
      help: `Blocker: ${blockerTextForPack(pack)}.`
    };
  }

  if (resolved.action === "done") {
    return {
      id: "proof-ready",
      label: "Proof ready",
      path: "proof",
      help: `Ready to finish with proof: ${proofTargetForPack(pack)}.`
    };
  }

  if (pack.status === "draft") {
    return {
      id: "draft",
      label: "Draft",
      path: "draft",
      help: "Work path is still being set."
    };
  }

  return {
    id: "ready",
    label: "Ready",
    path: "review",
    help: `Next action: ${resolved.label}.`
  };
}

function updateCommand(command) {
  el("command-title").textContent = command.title;
  setCopySurface(el("command-where"), command.where, "Where", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("command-blocker"), command.blocker, "Blocker", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("command-next"), command.next, "Next action", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  el("command-state").textContent = command.stateText;
  el("command-state").title = command.stateHelp || `State: ${command.stateText}`;
  el("command-state").setAttribute("aria-label", command.stateHelp || `State: ${command.stateText}`);
  el("command-scope").textContent = command.scope;
  if (el("command-flow")) {
    const flowHint = commandFlowCopy(command.flowHint || "Flow: choose work, do next.");
    el("command-flow").textContent = visibleCopy(flowHint, DEMO_COPY_LIMITS.commandFlowVisible);
    el("command-flow").title = helpCopy(flowHint, DEMO_COPY_LIMITS.commandFlowHelp);
    el("command-flow").setAttribute("aria-label", helpCopy(flowHint, DEMO_COPY_LIMITS.commandFlowHelp));
  }
  updateCommandWorkPath(command);
  const commandMemory = normalizeCopy(command.memory);
  const hasCommandMemoryContext = Boolean(commandMemory || currentPack());
  const commandMemoryHelp = commandMemoryHelpText(command, commandMemory);
  const commandMemoryElement = el("command-memory");
  if (commandMemoryElement) {
    commandMemoryElement.hidden = !hasCommandMemoryContext;
    commandMemoryElement.classList.toggle("has-memory", Boolean(commandMemory));
    commandMemoryElement.classList.toggle("is-empty", hasCommandMemoryContext && !commandMemory);
    commandMemoryElement.title = hasCommandMemoryContext ? commandMemoryHelp : "";
    commandMemoryElement.setAttribute("aria-label", hasCommandMemoryContext ? commandMemoryHelp : "No selected work memory context.");
  }
  if (el("command-memory-text")) {
    el("command-memory-text").textContent = commandMemoryVisibleText(commandMemory);
  }
  setCopySurface(el("primary-action"), command.next, "Next action", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  syncCommandActionButton(el("primary-action"), command);
  setCopySurface(el("dock-where"), command.where, "Where", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("dock-blocker"), command.blocker, "Blocker", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("dock-next-label"), command.next, "Next action", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  syncCommandActionButton(el("dock-next"), command);
  updateActionReceipt();
  scheduleBottomDockVisibility();
}

function syncCommandActionButton(control, command) {
  if (!control) {
    return;
  }

  const pending = isBackendCommandPending(command);
  const copy = pending ? backendCommandPendingReason(command) : commandRunLabel(command);
  control.dataset.action = pending ? "" : command.action || "";
  control.dataset.pack = command.targetPackId || "";
  control.disabled = pending;
  control.setAttribute("aria-label", copy);
  if (pending) {
    syncDisabledReasonMetadata(control, true, copy);
    return;
  }

  syncDisabledReasonMetadata(control, false, "");
  control.title = copy;
}

function commandFlowCopy(flowHint) {
  const hint = normalizeCopy(flowHint) || "Flow: choose work, do next.";
  return hint.replace(/^Flow:\s*/iu, "Next step: ");
}

function commandMemoryHelpText(command, commandMemory) {
  const next = normalizeCopy(command?.next) || "choose work";
  if (commandMemory) {
    return `Relevant Memory: ${sentenceValue(commandMemory)}. Next action: ${next}.`;
  }

  if (!currentPack()) {
    return "No selected work memory context.";
  }

  return `Relevant Memory: No memory yet. Add memory on selected work or the Memory screen. Next action: ${next}.`;
}

function commandMemoryVisibleText(commandMemory) {
  return commandMemory
    ? visibleCopy(commandMemory, DEMO_COPY_LIMITS.memoryVisible)
    : "No memory yet";
}

function bindBottomDockVisibility() {
  window.addEventListener("scroll", scheduleBottomDockVisibility, { passive: true });
  window.addEventListener("resize", scheduleBottomDockVisibility);
}

function scheduleBottomDockVisibility() {
  if (scheduleBottomDockVisibility.pending) {
    return;
  }

  scheduleBottomDockVisibility.pending = true;
  requestAnimationFrame(() => {
    scheduleBottomDockVisibility.pending = false;
    updateBottomDockVisibility();
  });
}

function updateBottomDockVisibility() {
  const dock = document.querySelector(".demo-bottom-brief");
  const brief = document.querySelector(".demo-command-brief");
  if (!dock || !brief) {
    return;
  }

  const mobileDockApplies = window.matchMedia("(max-width: 700px)").matches;
  const briefRect = brief.getBoundingClientRect();
  const briefVisible = briefRect.bottom > 0 && briefRect.top < window.innerHeight;
  const suppressDock = mobileDockApplies && briefVisible;
  dock.hidden = suppressDock;
  dock.dataset.suppressedByBrief = suppressDock ? "true" : "false";
}

function updateCommandWorkPath(command) {
  const path = el("command-work-path");
  if (!path) return;

  const pack = commandWorkPathPack(command);
  const steps = commandWorkPathSteps(command, pack);
  if (!steps.length) {
    path.hidden = true;
    path.innerHTML = "";
    return;
  }

  const detail = commandWorkPathDetail(command, pack);
  const aria = helpCopy(
    `Current path: ${steps.map((step) => `${step.label}${step.active ? " current" : ""}`).join(", ")}. ${detail}`,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
  path.hidden = false;
  path.title = aria;
  path.setAttribute("aria-label", aria);
  path.innerHTML = `
    <span class="section-label">Current path</span>
    <div class="demo-work-path-steps">
      ${renderWorkPathStepTrail(steps)}
    </div>
    <strong>${escapeHtml(detail)}</strong>`;
}

function commandWorkPathSteps(command, pack = commandWorkPathPack(command)) {
  if (!pack) {
    return [
      { id: "where", label: "Where", active: true, help: `Where: ${command.where}.` },
      { id: "blocker", label: "Blocker", active: false, help: `Blocker: ${command.blocker}.` },
      { id: "next", label: "Run", active: false, help: `Next action: ${command.next}.` }
    ];
  }

  const stage = workPathStage(pack, { label: command.next, action: command.action, targetPackId: command.targetPackId });
  return workPathSteps().map((step) => ({
    ...step,
    active: step.id === stage
  }));
}

function commandWorkPathPack(command) {
  if (!command?.targetPackId || commandIsRouteIntentAction(command.action)) {
    return null;
  }

  return findPack(command.targetPackId) || currentPack();
}

function commandIsRouteIntentAction(action) {
  return [
    "route-review",
    "open-work-list",
    "open-create",
    "create-sample",
    "focus-create-title",
    "focus-create-owner",
    "focus-create-next",
    "memory",
    "add-note",
    "type-memory-note"
  ].includes(action || "");
}

function commandWorkPathDetail(command, pack) {
  if (pack) {
    const workflow = workflowStateForPack(pack, { label: command.next, action: command.action, targetPackId: command.targetPackId });
    return `${workflow.label}: ${visibleCopy(workflow.help, DEMO_COPY_LIMITS.commandFlowVisible)}`;
  }

  return `Next action: ${visibleCopy(command.next, DEMO_COPY_LIMITS.commandFlowVisible)}`;
}

function commandActionDisplayLabel(next = "") {
  const value = normalizeCopy(next).toLowerCase();
  if (value === "open") return "Open work path";
  if (value === "start") return "Start work";
  if (value === "set blocker: none" || value === "unblock") return "Clear blocker";
  if (value === "review" || value === "review blocker") return "Review blocker";
  if (value === "done" || value === "finish with proof") return "Mark done";
  if (value === "set next action") return "Pick what to do next";
  if (value === "loading backend command") return "Loading…";
  return next;
}

function commandRunLabel(command) {
  const runNote = normalizeCopy(command.runNote);
  const runCopy = runNote ? ` ${runNote}.` : "";
  return helpCopy(
    `Where: ${command.where}. Blocker: ${command.blocker}. Next action: ${command.next}.${runCopy}`,
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
    const details = document.querySelector('[data-support-details="pack-detail"]');
    if (details) {
      details.open = true;
      details.dataset.openedBy = "focus";
    }
  }

  const selectors = focusSelectors(kind, id);
  const target = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!target) {
    return;
  }

  if (kind === "selected-card") {
    focusAndPulse(target, { ensureTopVisible: true, behavior: "auto" });
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

  if (kind === "selected-card") {
    return [
      `.demo-work-card[data-pack-id="${id}"]`,
      `.demo-review-card[data-pack-id="${id}"]`,
      `.demo-work-card[data-pack-id="${id}"] .demo-card-title`,
      `.demo-review-card[data-pack-id="${id}"] .demo-card-title`,
      `.demo-row[data-pack-id="${id}"]`
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

  if (kind === "search-input") {
    return ["#screen-search", "#demo-search"];
  }

  if (kind === "memory-note") {
    return ["#memory-note", "#memory-note-help", "#add-memory"];
  }

  if (kind === "create-title") {
    return ["#new-title", "#create-save-help", "#create-sample"];
  }

  if (kind === "create-owner") {
    return ["#new-owner", "#create-save-help", "#create-sample"];
  }

  if (kind === "create-next") {
    return ["#new-next", "#create-save-help", "#create-sample"];
  }

  if (kind === "pack-edit") {
    return [
      "#edit-next",
      "#edit-owner",
      "#edit-done-when",
      "#edit-title",
      "#pack-edit-form",
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

function focusAndPulse(target, options = {}) {
  const behavior = options.behavior || "auto";
  const block = options.block || "center";
  target.scrollIntoView({ behavior, block, inline: "nearest" });
  if (options.ensureTopVisible) {
    ensureFocusTopVisible(target);
  }

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

function ensureFocusTopVisible(target) {
  const rect = target.getBoundingClientRect();
  const topInset = 24;
  if (rect.top < topInset) {
    window.scrollBy({ top: rect.top - topInset, left: 0, behavior: "auto" });
  }
}

function isFocusable(target) {
  return target.matches("a, button, input, select, textarea, [tabindex]");
}

function focusKindForAction(action, packId = "") {
  if (action === "focus-create-title") {
    return "create-title";
  }

  if (action === "focus-create-owner") {
    return "create-owner";
  }

  if (action === "focus-create-next") {
    return "create-next";
  }

  if (action === "set-next" || action === "focus" || action === "start" || action === "done" || action === "unblock" || action === "clear-owner-blocker" || action === "save-work-path") {
    return "next";
  }

  if (action === "open") {
    return "pack-detail";
  }

  if (action === "review") {
    const pack = findPack(packId) || currentPack();
    return pack ? reviewFocusKindForPack(pack) : "blocker";
  }

  if (action === "add-note" || action === "type-memory-note") {
    return "memory-note";
  }

  if (action === "edit") {
    return "pack-edit";
  }

  return "where";
}

function renderHome() {
  const reviewCount = state.packs.filter(isReview).length;
  const resetHelp = resetDemoHelp();
  const homeEmpty = state.packs.length === 0
    ? emptyState("No work is loaded.", "Create work or reset the browser-local sample.", emptyStateContextFor("Start", "no work exists in this browser", "create work or reset the sample"))
    : "";
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-home-hero">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Small portfolio demo</span>
          <h2>Pick work, see what blocks it, run the next action.</h2>
        </div>
      </div>
      <p>Projects keeps work honest: each item shows where it is, what blocks progress, and the button that runs next. This demo uses sample work so the value is visible without project history.</p>
      <p class="demo-home-counts">${state.packs.length} sample ${escapeHtml(workNoun(state.packs.length))}; ${reviewCount} need review.</p>
      ${homeSpotlightPanel()}
      ${homeEmpty}
      <div class="demo-start-path" aria-label="Primary demo path">
        <div class="demo-start-step">
          <span>1</span>
          <strong>Review</strong>
          <small>Start with blocked or unclear work.</small>
          ${navButton("review", "Review work", "btn btn-primary")}
        </div>
        <div class="demo-start-step">
          <span>2</span>
          <strong>Work</strong>
          <small>Choose an item and read its blocker.</small>
          ${navButton("work", "Open work list")}
        </div>
        <div class="demo-start-step">
          <span>3</span>
          <strong>Next</strong>
          <small>Set the action the main button will run.</small>
          ${navButton("next", "Set next action")}
        </div>
      </div>
      <div class="demo-quick-actions demo-secondary-paths" aria-label="Small demo actions">
        ${navButton("memory", "Add memory")}
        ${navButton("create", profile().newWork)}
        ${navButton("settings", "Settings")}
        <span id="reset-demo-home-help" class="sr-only">${escapeHtml(resetHelp)}</span>
        <button class="btn" type="button" id="reset-demo-home"${controlHelpAttributes(false, resetHelp, "reset-demo-home-help")}>Reset sample</button>
      </div>
    </section>
  `;
  bindGoButtons();
  bindListActions();
  el("reset-demo-home")?.addEventListener("click", resetState);
}

function homeSpotlightPanel() {
  const pack = homeSpotlightPack();
  if (!pack) {
    return "";
  }

  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  const purpose = normalizeCopy(pack.purpose) || `Review this sample ${workNoun(1)}.`;
  const reason = primaryCommandVisibleReason(pack, command);
  return `<article class="demo-home-spotlight" data-pack-id="${escapeAttribute(pack.id)}" aria-label="${escapeAttribute(`Sample work: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: ${command.label}.`)}">
    <div class="demo-home-spotlight-head">
      <div>
        <span class="section-label">Live sample</span>
        <h3>
          <button type="button" class="demo-card-title" data-action="select" data-pack="${escapeAttribute(pack.id)}"${cardTitleButtonAttributes(pack)}>${escapeHtml(workTitle(pack))}</button>
        </h3>
      </div>
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <p>${escapeHtml(purpose)}</p>
    ${homeSpotlightFacts(pack, command)}
    <div class="demo-home-spotlight-actions">
      ${primaryCommandButton(pack)}
      ${supportActionButton("open", "Open work path", pack, "btn")}
      ${navButton("work", "Work list")}
      <small>${escapeHtml(reason)}</small>
    </div>
  </article>`;
}

function homeSpotlightFacts(pack, command) {
  return `<div class="demo-home-spotlight-facts" aria-label="${escapeAttribute(`Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: ${command.label}.`)}">
    ${homeSpotlightFact("Where", workTitle(pack))}
    ${homeSpotlightFact("Blocker", blockerTextForPack(pack))}
    ${homeSpotlightFact("Next action", command.label)}
  </div>`;
}

function homeSpotlightFact(label, value, id = "") {
  const copy = copySurface(value || DEMO_BLOCKER_NONE_LABEL, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  const idAttribute = id ? ` id="${escapeAttribute(id)}"` : "";
  return `<div class="demo-home-spotlight-fact">
    <span>${escapeHtml(label)}</span>
    <strong${idAttribute}${copySurfaceAttributes(label, copy)}>${escapeHtml(copy.visible)}</strong>
  </div>`;
}

function homeSpotlightPack() {
  const selected = currentPack();
  if (selected && isReview(selected)) {
    return selected;
  }

  return state.packs.find(isReview) || selected || state.packs[0] || null;
}

function recoveryPanel() {
  const snapshot = recoverySnapshotText();
  const restoreHelp = "Restore a Projects demo recovery JSON snapshot into this browser or active sync row.";
  const eraseHelp = "Erase the current backend row selected by this browser or active sync code.";
  const backendEraseControl = DEMO_API_BASE_URL
    ? `<div class="demo-inline-form demo-recovery-erase">
        <label for="erase-backend-state">Erase hosted demo state</label>
        <p>This clears only the current browser or active sync row.</p>
        <button class="btn btn-sm" type="button" id="erase-backend-state"${controlLabelAttributes(eraseHelp)}>Erase backend row</button>
      </div>`
    : "";
  const shouldOpen = Boolean(
    clipboardReceiptFor("copy-recovery-state")
    || state.status.startsWith("Where: Recovery.")
    || state.status.startsWith("Where: Backend erase.")
  );
  return `<details class="demo-recovery-panel"${shouldOpen ? " open" : ""}>
    <summary>
      <span>Recovery</span>
      <small>Copy or restore demo JSON.</small>
    </summary>
    <p>Demo backup only. Do not paste private project data.</p>
    ${clipboardNoticePanel("copy-recovery-state")}
    <div class="demo-recovery-grid">
      <div class="${escapeAttribute(copyPayloadClass("demo-recovery-output"))}">
        <label for="demo-recovery-output">Current demo backup</label>
        <textarea id="demo-recovery-output" class="demo-search-input" readonly spellcheck="false">${escapeHtml(snapshot)}</textarea>
        <button class="btn btn-sm" type="button" id="copy-recovery-state">Copy backup</button>
      </div>
      <div class="demo-inline-form demo-recovery-restore">
        <label for="demo-recovery-input">Restore pasted backup</label>
        <textarea id="demo-recovery-input" class="demo-search-input" spellcheck="false" placeholder="Paste Projects demo recovery JSON here"></textarea>
        <button class="btn btn-sm btn-primary" type="button" id="restore-recovery-state"${controlLabelAttributes(restoreHelp)}>Restore backup</button>
      </div>
      ${backendEraseControl}
    </div>
  </details>`;
}

function bindRecoveryControls() {
  el("copy-recovery-state")?.addEventListener("click", copyRecoverySnapshot);
  el("restore-recovery-state")?.addEventListener("click", restoreRecoverySnapshot);
  el("erase-backend-state")?.addEventListener("click", eraseBackendState);
}

let workListOrderIds = [];
let workListKeepOrder = false;

function workListDisplayPacks(visible) {
  const keepOrder = workListKeepOrder;
  workListKeepOrder = false;
  if (keepOrder && workListOrderIds.length) {
    const byId = new Map(visible.map((pack) => [pack.id, pack]));
    const kept = workListOrderIds.map((id) => byId.get(id)).filter(Boolean);
    const keptIds = new Set(kept.map((pack) => pack.id));
    const ordered = [...kept, ...visible.filter((pack) => !keptIds.has(pack.id))];
    workListOrderIds = ordered.map((pack) => pack.id);
    return ordered;
  }

  const ordered = selectedFirstPacks(visible);
  workListOrderIds = ordered.map((pack) => pack.id);
  return ordered;
}

function renderWork() {
  const visible = filteredPacks();
  const orderedVisible = workListDisplayPacks(visible);
  const emptyWork = state.packs.length === 0
    ? emptyState(`No ${profile().work} is available.`, `${profile().newWork} or reset demo data.`, emptyStateContextFor(`${workLabelTitle()} filters`, `no ${workNoun(2)} exist in this browser`, `create or reset ${profile().work}`))
    : emptyState(`No ${profile().work} matches this filter.`, "Clear search or choose another status filter.", emptyStateContextFor(`${workLabelTitle()} filters`, `current search or status filter hides every ${workNoun(1)}`, "clear search or choose another status filter"));
  el("screen-content").innerHTML = `
    ${workToolbar(`${workLabelTitle()} filters`)}
    <section class="demo-panel demo-list-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">${escapeHtml(workNounTitle(2))}</span>
          <h2>${visible.length} visible</h2>
        </div>
        ${navButton("create", profile().newWork, "btn btn-primary")}
      </div>
      ${routeActionReceiptPanel(visible, `${workLabelTitle()} filters`)}
      <div class="demo-work-list">${orderedVisible.length ? orderedVisible.map(workCard).join("") : emptyWork}</div>
    </section>
  `;
  bindToolbar();
  bindWorkCards();
  bindGoButtons();
}

function renderReview() {
  const review = state.packs.filter(isReview);
  const orderedReview = selectedFirstPacks(review);
  const selected = currentPack();
  const firstReview = selected && review.some((pack) => pack.id === selected.id) ? selected : review[0] || null;
  const reviewButtonReason = "Where: Review. Blocker: no work needs review. Next action: create or edit work.";
  const reviewState = firstReview ? `${review.length} needs decision` : "clear";
  const emptyReview = state.packs.length === 0
    ? emptyState(`No ${profile().work} is available.`, `${profile().newWork}, reset demo data, or choose a scenario with ${profile().work}.`, emptyStateContextFor("Review", `no ${workNoun(2)} exist in this browser`, `${profile().newWork.toLowerCase()}, reset demo data, or choose a scenario with ${profile().work}`))
    : emptyState(`No ${profile().work} needs review.`, `Choose a different scenario or add a blocker to ${profile().work}.`, emptyStateContextFor("Review", `no blockers or missing next action items are visible`, `create or edit ${profile().work}`));
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-list-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Needs decision</span>
          <h2>${review.length} ${escapeHtml(workNoun(review.length))} to review</h2>
        </div>
        <span class="demo-status">${escapeHtml(reviewState)}</span>
      </div>
      ${disabledReasonNotice(!firstReview, reviewButtonReason)}
      ${reviewQueuePanel(review, firstReview)}
      ${routeActionReceiptPanel(review, "Review")}
      <div class="demo-review-list">${orderedReview.length ? orderedReview.map(reviewCard).join("") : emptyReview}</div>
    </section>
  `;
  bindListActions();
}

function reviewQueuePanel(review, firstReview) {
  if (!firstReview) {
    return "";
  }

  const command = resolvePrimaryCommandForPack(firstReview);
  const workflow = workflowStateForPack(firstReview, command);
  const blockedCount = review.filter(hasBlocker).length;
  const missingNextCount = review.filter(isMissingNextAction).length;
  const ownerGapCount = review.filter((pack) => ownerSupportNeededForPack(pack)).length;
  const reason = primaryCommandVisibleReason(firstReview, command);
  return `<article class="demo-home-spotlight demo-review-spotlight" data-pack-id="${escapeAttribute(firstReview.id)}" aria-label="${escapeAttribute(`Up next: ${workTitle(firstReview)}. Blocker: ${blockerTextForPack(firstReview)}. Next action: ${command.label}.`)}">
    <div class="demo-home-spotlight-head demo-review-spotlight-head">
      <div>
        <span class="section-label">Up next</span>
        <h3>
          <button type="button" class="demo-card-title" data-action="select" data-pack="${escapeAttribute(firstReview.id)}"${cardTitleButtonAttributes(firstReview)}>${escapeHtml(workTitle(firstReview))}</button>
        </h3>
      </div>
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-review-queue-stats" aria-label="Review queue status">
      ${reviewQueueStat("Blocked", blockedCount, "Needs blocker decision")}
      ${reviewQueueStat("Missing action", missingNextCount, "Needs next action")}
      ${reviewQueueStat("Owner gaps", ownerGapCount, "Needs owner")}
    </div>
    <div class="demo-home-spotlight-actions demo-review-spotlight-actions">
      ${primaryCommandButton(firstReview)}
      ${supportActionButton("open", "Open work path", firstReview, "btn")}
      ${supportActionButton("set-next", "Set next action", firstReview, "btn")}
      <small>${escapeHtml(reason)}</small>
    </div>
  </article>`;
}

function reviewQueueStat(label, value, note) {
  return `<div class="demo-review-queue-stat">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(String(value))}</strong>
    <small>${escapeHtml(note)}</small>
  </div>`;
}

function renderNext() {
  const pack = currentPack() || state.packs.find(isReview) || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No work is available.", "Create work, reset demo data, or choose a scenario with work.", emptyStateContextFor("Next setup", "no work exists in this browser", "create work, reset demo data, or choose a scenario with work"));
    return;
  }

  state.selectedId = pack.id;
  const nextCommand = resolvePrimaryCommandForPack(pack);
  const saveNextHelp = saveNextChoiceHelp(pack);
  const nextPreviewHelp = nextChoicePreviewHelp(pack, nextCommand);
  const nextSelectHelp = nextChoiceSelectHelp(pack, nextCommand);
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Next setup</span>
          <h2>Choose what the main button runs</h2>
        </div>
        <span class="demo-status">${escapeHtml(workTitle(pack))}</span>
      </div>
      <p>Choose the next action for this work. If a blocker is set, the main button keeps running the blocker review until it clears, so the preview below shows what will really run.</p>
      <div class="demo-command-lines compact" data-next-preview>
        ${factLine("Where", workTitle(pack))}
        ${factLine("Blocker", blockerTextForPack(pack))}
        ${factLine("Next action", nextCommand.label)}
      </div>
      <div class="demo-inline-form">
        <label class="demo-field" for="next-action-choice">
          <span>Next action</span>
          <select id="next-action-choice" class="demo-search-input" aria-describedby="next-choice-preview-help" title="${escapeAttribute(nextSelectHelp)}">
            ${NEXT_ACTION_CHOICES.map((option) => {
              const selected = option === pack.next || (option === "Set Blocker: None" && commandActionForLabel(pack.next).action === "unblock");
              return `<option value="${escapeAttribute(option)}"${selected ? " selected" : ""}>${escapeHtml(option)}</option>`;
            }).join("")}
          </select>
          <small id="next-choice-preview-help" class="demo-field-help" aria-live="polite">${escapeHtml(nextPreviewHelp)}</small>
        </label>
        <span id="apply-next-action-help" class="sr-only">${escapeHtml(saveNextHelp)}</span>
        <button id="apply-next-action" class="btn btn-primary" type="button"${controlHelpAttributes(false, saveNextHelp, "apply-next-action-help")}>Save next action</button>
      </div>
    </section>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Candidates</span>
          <h2>Work that needs a clearer button</h2>
        </div>
      </div>
      <p>Set next action saves a choice for that row. The Focus action under a row opens the work without changing it.</p>
      <div class="demo-list">${state.packs.filter(isReview).map(nextCandidateRow).join("") || emptyState("No work needs next setup.", "Open work, add a blocker, or clear next action to create a candidate.", emptyStateContextFor("Next setup", "every visible work item already has a clear next action path", "open work or create a review candidate"))}</div>
    </section>
  `;
  el("next-action-choice").addEventListener("change", () => syncNextChoicePreview(pack));
  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));
  syncNextChoicePreview(pack);
  bindListActions();
}

function todayIsoDate(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function saveNextChoiceHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: Next setup / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: save choice; preview shows ${command.label}.`;
}

function nextChoiceSelectHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  const blocker = hasBlocker(pack) && command.action !== "unblock"
    ? "; the blocker keeps the main button on review until it clears"
    : "";
  return `Choose the next action to save on this work${blocker}.`;
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
  if (where) where.textContent = workTitle(pending);
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
  const forwardPath = nextChoiceForwardPath(pack, valueOf("next-action-choice") || pack.next);
  return {
    ...pack,
    ...forwardPath
  };
}

function nextChoicePreviewHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  return hasBlocker(pack) && command.action !== "unblock"
    ? `Your choice saves, but the main button runs ${command.label} until the blocker clears.`
    : `After save, the main button runs ${command.label}.`;
}

function resetDemoHelp() {
  return DEMO_API_BASE_URL ? "Reset demo work, profile, scenario, and edits in this backend row." : "Reset demo work, profile, scenario, and edits in this browser.";
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
        <span class="demo-status">${escapeHtml(persistenceStatusText())}</span>
      </div>
      ${createReadinessPanel(defaults, createState)}
      <div class="demo-form-grid">
        ${inputField("new-title", `Title ${helpTip("A short, descriptive name for this work. Keep it specific so you know what it is at a glance.")}`, defaults.title, `Name the ${profile().work} before Save can run.`)}
        ${inputField("new-owner", `Owner ${helpTip("Who is responsible for moving this forward. Leave blank or write 'unassigned' if unknown.")}`, defaults.owner, "Name the person, team, or role responsible for the next step.")}
        ${nextActionSelectField("new-next", `Next action ${helpTip("The first thing the main button will do. 'Choose action' means the button is paused.")}`, defaults.next, "Choose the first action. Choose action means Save work stays paused.")}
        ${dateField("new-due", "Due", defaults.due, "Optional date kept on the work path and searchable in the work list.")}
        ${textField("new-purpose", "Why it matters", defaults.purpose, `Optional context for why this ${profile().work} exists.`)}
      </div>
      <p id="create-save-help" class="demo-field-help" aria-live="polite">${escapeHtml(createState.help)}</p>
      <button id="create-sample" class="btn btn-primary" type="button" aria-describedby="create-save-help"${disabledReasonAttributes(!createState.canSave, createState.help)}>${escapeHtml(persistenceVerb())}</button>
    </section>
  `;
  el("create-sample").addEventListener("click", createSamplePack);
  bindCreateValidation();
  bindListActions();
}

function createReadinessPanel(values, createState) {
  const action = createReadinessAction(createState);
  const help = helpCopy(createState.help, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<article class="demo-home-spotlight demo-create-spotlight" aria-label="${escapeAttribute(createState.help)}">
    <div class="demo-home-spotlight-head demo-create-spotlight-head">
      <div>
        <span class="section-label">Ready to save</span>
        <h3>Create path</h3>
      </div>
      <span id="create-readiness-state" class="demo-state-pill" title="${escapeAttribute(createState.help)}">${escapeHtml(createReadinessLabel(createState))}</span>
    </div>
    <div class="demo-home-spotlight-facts" aria-label="${escapeAttribute(createState.help)}">
      ${homeSpotlightFact("Where", profile().newWork, "create-readiness-where")}
      ${homeSpotlightFact("Blocker", blockerDisplayValue(createState.blocker), "create-readiness-blocker")}
      ${homeSpotlightFact("Next action", action.label, "create-readiness-next")}
    </div>
    <div class="demo-create-readiness-list" aria-label="Required create fields">
      ${createReadinessStep("Title", values.title, "create-readiness-title")}
      ${createReadinessStep("Owner", values.owner, "create-readiness-owner")}
      ${createReadinessStep("Button", values.next, "create-readiness-button")}
    </div>
    <div class="demo-home-spotlight-actions demo-create-spotlight-actions">
      <button id="create-readiness-action" class="btn" type="button" data-action="${escapeAttribute(action.key)}" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">${escapeHtml(action.label)}</button>
      <small id="create-readiness-note">${escapeHtml(createState.help)}</small>
    </div>
  </article>`;
}

function createReadinessStep(label, value, id) {
  const ready = Boolean(normalizeCopy(value));
  return `<div id="${escapeAttribute(id)}" class="demo-create-readiness-step" data-ready="${ready ? "true" : "false"}">
    <span>${escapeHtml(label)}</span>
    <strong>${ready ? "Ready" : "Missing"}</strong>
  </div>`;
}

function createReadinessAction(createState) {
  return {
    key: createState.canSave ? "create-sample" : createFocusActionForBlocker(createState.blocker),
    label: createState.canSave ? persistenceVerb() : createActionForBlocker(createState.blocker)
  };
}

function renderPackDetail() {
  const pack = currentPack();
  if (!pack) {
    el("screen-content").innerHTML = state.packs.length === 0
      ? emptyState("No work is available.", "Create work or reset demo data.", emptyStateContextFor("Work path", "no work exists in this browser", "create or reset work"))
      : emptyState("Choose work before opening the work path.", "Open Work or Review and choose a work card.", emptyStateContextFor("Work path", "no work is selected", "open Work or Review and choose a work card"));
    return;
  }
  const packCommand = resolvePrimaryCommandForPack(pack);
  const routeCommand = commandForRoute(pack, filteredPacks().length, state.packs.filter(isReview).length);
  const workflow = workflowStateForPack(pack, packCommand);
  const saveState = packDetailSaveState(pack);
  const saveNote = packDetailSaveNote(saveState);
  const showOwnerInline = ownerSupportNeededForPack(pack);
  const detailSubtitle = copySurface(workDetailSubtitle(pack, packCommand), DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-edit-panel" id="pack-edit-form" data-pack-id="${escapeAttribute(pack.id)}">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">${escapeHtml(workLabelTitle())} path</span>
          <h2 id="pack-detail-title">${escapeHtml(workTitle(pack))}</h2>
          <p class="demo-pack-subtitle"${copySurfaceAttributes("Work path summary", detailSubtitle)}>${escapeHtml(detailSubtitle.visible)}</p>
          ${pack.purpose ? `<p class="demo-pack-purpose">${escapeHtml(pack.purpose)}</p>` : ""}
          ${packGuidanceLine(pack, packCommand, workflow)}
        </div>
        <span class="demo-status">${escapeHtml(persistenceEditStatus("Edits stay in this browser"))}</span>
      </div>
      <div class="demo-forward-panel" data-forward-motion="pack-detail">
        <div class="demo-forward-head">
          <span class="section-label">What to do ${helpTip("The button that advances this work. When blocked, the button helps clear the blocker first.")}</span>
          <strong>${escapeHtml(commandActionDisplayLabel(packCommand.next))}</strong>
        </div>
        ${workPathStrip(pack, packCommand)}
        ${selectedWorkTriad(pack, packCommand)}
        <div class="demo-form-grid demo-forward-fields">
          ${blockerStateField(pack)}
          ${showOwnerInline ? inputField("edit-owner", "Owner", pack.owner, "Fill owner to clear this owner-related blocker.") : ""}
          ${nextActionSelectField("edit-next", `Next action ${helpTip("What the main button does. When this work is ready, the button runs this action.")}`, editableNextActionValue(pack.next), "Choose the action the main button runs for the selected work.")}
          ${inputField("edit-done-when", `Proof target ${helpTip("The evidence that proves this work is truly done. Describe what 'finished' looks like.")}`, pack.doneWhen, "Describe the evidence needed before this work is done.")}
        </div>
      </div>
      <details class="demo-support-details" data-support-details="pack-detail">
        <summary>
          <span>More fields</span>
          <strong>${escapeHtml(supportDetailsSummary(showOwnerInline, pack))}</strong>
        </summary>
        <div class="demo-form-grid">
          ${inputField("edit-title", "Title", pack.title, "Renames this work item.")}
          ${showOwnerInline ? "" : inputField("edit-owner", "Owner", pack.owner, "Changing owner can resolve owner-related blockers.")}
          ${dateField("edit-due", "Due", pack.due, "Optional date kept on the work path and searchable in the work list.")}
          ${textField("edit-purpose", "Purpose", pack.purpose, "Extra context; keep the main work path above focused.")}
        </div>
      </details>
      ${relevantMemoryStrip(pack)}
      <div class="demo-card-actions demo-forward-actions">
        ${packPrimaryActionButton(routeCommand)}
        <p id="pack-save-help" class="demo-field-help demo-forward-save-note" aria-live="polite"${saveNote ? "" : " hidden"}>${escapeHtml(saveNote)}</p>
      </div>
      ${actionReceiptCard(pack)}
    </section>
    ${activityPanel(pack)}
  `;
  el("pack-primary-action")?.addEventListener("click", (event) => {
    queueFocus(focusKindForAction(event.currentTarget.dataset.action), event.currentTarget.dataset.pack || pack.id);
    runPrimaryAction(event.currentTarget);
  });
  bindPackDetailValidation(pack);
  bindListActions();
}

function renderMemory() {
  const pack = currentPack() || state.packs[0];
  const memoryState = memoryNoteSaveState(pack, "");
  el("screen-content").innerHTML = `
    ${memoryWorkChooser(pack)}
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Memory</span>
          <h2>${pack ? escapeHtml(workTitle(pack)) : "Work memory"}</h2>
        </div>
        <span class="demo-status">${escapeHtml(persistenceMemoryStatus("Stored in this browser"))}</span>
      </div>
      <div class="demo-list">${pack ? (pack.memory.map((note) => `<div class="demo-note">${escapeHtml(note)}</div>`).join("") || emptyState("No memory notes for this work.", "Add a note below to keep recall with the selected work.", emptyStateContextFor(`Memory / ${workTitle(pack)}`, "no saved memory note yet", "type a note below"))) : emptyState("No memory available.", "Create work or reset demo data before adding memory.", emptyStateContextFor("Memory", "no work exists in this browser", "create or reset work"))}</div>
      <div class="demo-inline-form">
        <label class="sr-only" for="memory-note">Add memory note</label>
        <input id="memory-note" class="demo-search-input" type="text" placeholder="Capture decision, source, or proof" autocomplete="off" aria-describedby="memory-note-help">
        <p id="memory-note-help" class="demo-field-help" aria-live="polite">${escapeHtml(memoryState.help)}</p>
        <button id="add-memory" class="btn btn-primary" type="button" aria-describedby="memory-note-help"${disabledReasonAttributes(!memoryState.canSave, memoryState.help)}>Add note</button>
      </div>
      ${actionReceiptCard(pack)}
    </section>
  `;
  bindMemoryValidation(pack);
  bindGoButtons();
  el("add-memory").addEventListener("click", async () => {
    const memoryState = memoryNoteSaveState(pack, valueOf("memory-note"));
    if (!memoryState.canSave) {
      state.status = memoryState.help;
      syncMemoryValidation(pack);
      return;
    }

    await savePackMemoryNote(pack, valueOf("memory-note"));
    render();
  });
}

function memoryWorkChooser(selected) {
  if (state.packs.length === 0) {
    return `<section class="demo-toolbar" aria-label="Memory work selector"><div class="demo-panel-head"><div><span class="section-label">Selected work</span><h2>Choose memory target</h2></div><span class="demo-status">No work loaded</span></div><p id="memory-work-summary" class="demo-status-line" role="status" aria-live="polite">Create work before adding memory notes.</p>${navButton("create", profile().newWork)}</section>`;
  }

  const summary = selected
    ? `Memory note will save to ${workTitle(selected)}.`
    : `Choose a ${workNoun(1)} before adding memory.`;
  return `<section class="demo-toolbar" aria-label="Memory work selector"><div class="demo-panel-head"><div><span class="section-label">Selected work</span><h2>Choose memory target</h2></div><span class="demo-status">${state.packs.length} ${workNoun(state.packs.length)}</span></div><p id="memory-work-summary" class="demo-status-line" role="status" aria-live="polite">${escapeHtml(summary)}</p><div class="demo-chip-row" aria-label="Work for memory" aria-describedby="memory-work-summary">${state.packs.map((pack) => memoryWorkChoiceButton(pack, selected)).join("")}</div></section>`;
}

function memoryWorkChoiceButton(pack, selected) {
  const active = pack.id === selected?.id;
  const label = active ? "Selected" : "Choose";
  const help = active
    ? `Current memory target: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: add memory note.`
    : `Use ${workTitle(pack)} as the memory target. Blocker: ${blockerTextForPack(pack)}. Next action: add memory note.`;
  return `<button type="button" class="demo-chip" aria-pressed="${active}" data-action="memory" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(help)}>${escapeHtml(workTitle(pack))}<span class="demo-chip-count">${escapeHtml(label)}</span></button>`;
}

function blockerStateField(pack) {
  const blockerState = blockerStateForPack(pack);
  const hasBlocker = blockerState.hasBlocker;
  const blocker = hasBlocker ? blockerState.reason : "";
  return `
      <fieldset class="demo-field demo-blocker-field" data-blocker-field>
      <legend>Blocker ${helpTip("What's stopping this work from moving forward. Can be a missing person, missing information, or waiting on something else. Clear it to unblock.")}</legend>
      <div class="demo-segmented-control" role="radiogroup" aria-label="Blocker value">
        <label class="demo-segment${hasBlocker ? "" : " active"}" data-blocker-mode-label="clear" for="edit-blocker-clear">
          <input id="edit-blocker-clear" name="edit-blocker-mode" type="radio" value="clear" data-blocker-mode="clear" aria-describedby="edit-blocker-clear-help" title="Stores Blocker: None so Next action can run after saving."${hasBlocker ? "" : " checked"}>
          <span>None</span>
          <small id="edit-blocker-clear-help" class="sr-only">Stores Blocker: None so Next action can run after saving.</small>
        </label>
        <label class="demo-segment${hasBlocker ? " active" : ""}" data-blocker-mode-label="set" for="edit-blocker-set">
          <input id="edit-blocker-set" name="edit-blocker-mode" type="radio" value="set" data-blocker-mode="set" aria-describedby="edit-blocker-set-help" title="Names the blocker reason; Next action stays paused until it clears."${hasBlocker ? " checked" : ""}>
          <span>Blocked</span>
          <small id="edit-blocker-set-help" class="sr-only">Names the blocker reason; Next action stays paused until it clears.</small>
        </label>
      </div>
      ${ownerBlockerGuide(pack)}
      <div class="demo-blocker-reason" data-blocker-reason${hasBlocker ? "" : " hidden"}>
        ${blockedBySelectField(pack)}
        <label for="edit-blocker">Why blocked?</label>
        <small class="demo-field-help">Choose a common reason, or write the reason that must clear before the button can run.</small>
        ${blockerPresetButtons(blocker)}
        <input id="edit-blocker" type="text" value="${escapeAttribute(blocker)}" placeholder="missing owner, source, approval..." aria-describedby="edit-blocker-help"${hasBlocker ? "" : disabledReasonAttributes(true, blockerInputDisabledReason())}>
      </div>
      <p id="edit-blocker-help" class="demo-field-help" data-blocker-help>${hasBlocker ? "Blocked pauses Next action until this reason clears." : "None stores Blocker: None automatically; no typing required."}</p>
      <div class="demo-blocker-resolution" data-blocker-resolution hidden aria-live="polite">
        <span data-blocker-resolution-copy></span>
        <button class="btn btn-sm" type="button" data-clear-owner-blocker>Set Blocker: None</button>
      </div>
    </fieldset>
  `;
}

function ownerBlockerGuide(pack) {
  if (!normalizeCopy(pack?.blocker).toLowerCase().includes("owner")) {
    return "";
  }

  const ownerFilled = !isMissingOwnerValue(pack?.owner);
  const blockerClear = isUnblockedBlockerValue(pack?.blocker);
  const summary = ownerBlockerGuideSummary(ownerFilled, blockerClear);
  return `<div class="demo-owner-blocker-guide" data-owner-blocker-guide data-state="${escapeAttribute(ownerBlockerGuideState(ownerFilled, blockerClear))}" aria-label="${escapeAttribute(summary)}">
    <span class="section-label">Owner blocker path</span>
    <strong data-owner-blocker-summary>${escapeHtml(summary)}</strong>
    <ol>
      ${ownerBlockerGuideStep("owner", "1", "Fill Owner", ownerFilled ? "Owner filled." : "Owner is unassigned.", ownerFilled ? "done" : "active")}
      ${ownerBlockerGuideStep("clear", "2", "Set Blocker: None", blockerClear ? "Blocker is None. Save work path is next." : "Saves this blocker fix after Owner is filled.", ownerFilled ? (blockerClear ? "done" : "active") : "waiting")}
    </ol>
  </div>`;
}

function ownerBlockerGuideStep(id, index, label, copy, stateName) {
  return `<li class="demo-owner-blocker-step ${escapeAttribute(stateName)}" data-owner-step="${escapeAttribute(id)}">
    <span class="demo-owner-step-index">${escapeHtml(index)}</span>
    <span class="demo-owner-step-copy">
      <strong>${escapeHtml(label)}</strong>
      <small data-owner-step-copy="${escapeAttribute(id)}">${escapeHtml(copy)}</small>
    </span>
  </li>`;
}

function ownerBlockerGuideSummary(ownerFilled, blockerClear) {
  if (!ownerFilled) {
    return "Fill Owner to clear this owner blocker.";
  }

  if (!blockerClear) {
    return "Owner filled. Next action: Set Blocker: None.";
  }

  return "Blocker is None. Next action: Save work path.";
}

function ownerBlockerGuideState(ownerFilled, blockerClear) {
  if (!ownerFilled) {
    return "fill-owner";
  }

  return blockerClear ? "ready-to-save" : "clear-blocker";
}

function blockedBySelectField(pack) {
  const choices = blockedByChoices(pack);
  const current = normalizeCopy(pack?.blockedBy);
  return `<label for="edit-blocked-by">Blocked by work item (optional)</label>
        <select id="edit-blocked-by" aria-describedby="edit-blocked-by-help">
          <option value=""${current ? "" : " selected"}>None — describe the reason below</option>
          ${choices.map((candidate) => `<option value="${escapeAttribute(candidate.id)}"${candidate.id === current ? " selected" : ""}>${escapeHtml(workTitle(candidate))}</option>`).join("")}
        </select>
        <small id="edit-blocked-by-help" class="demo-field-help">Choosing work fills the reason and clears it automatically when that work finishes with proof.</small>`;
}

function blockerPresetButtons(currentBlocker = "") {
  const current = normalizeCopy(currentBlocker).toLowerCase();
  return `<div class="demo-blocker-presets" aria-label="Common blocker reasons">
    ${BLOCKER_REASON_PRESETS.map((preset) => {
      const active = normalizeCopy(preset).toLowerCase() === current;
      const help = active
        ? `Current blocker reason is ${preset}. Next action stays paused until this clears.`
        : `Set blocker reason to ${preset}. Next action stays paused until this clears.`;
      return `<button class="demo-blocker-preset${active ? " active" : ""}" type="button" data-blocker-preset="${escapeAttribute(preset)}" aria-pressed="${active}" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">${escapeHtml(preset)}</button>`;
    }).join("")}
  </div>`;
}

function workflowStatePreviewField(workflow) {
  const label = workflow?.label || "Choose work";
  const help = workflow?.help || "Choose work before editing the work path.";
  return `<div class="demo-field demo-state-preview" data-workflow-state-preview-field>
    <span>State</span>
    <strong data-workflow-state-preview title="${escapeAttribute(help)}">${escapeHtml(label)}</strong>
    <small data-workflow-state-help>${escapeHtml(help)}</small>
  </div>`;
}

function blockerInputDisabledReason() {
  return "Where: Blocker. Blocker: None is selected. Next action: choose Blocked before typing a blocker reason.";
}

function workToolbar(label) {
  const currentWork = profile().work;
  const summary = workToolbarSummary();
  return `
    <section class="demo-toolbar" aria-label="${escapeAttribute(label)}">
      <label class="sr-only" for="demo-search">Search demo ${escapeHtml(currentWork)}</label>
      <input id="demo-search" class="demo-search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search ${escapeAttribute(currentWork)} title, blocker, Next action, owner, or due date" autocomplete="off" aria-describedby="demo-search-summary">
      <p id="demo-search-summary" class="demo-status-line" role="status" aria-live="polite">${escapeHtml(summary)}</p>
      <div id="status-chips" class="demo-chip-row" aria-label="Status filters">
        ${renderFilterChips()}
      </div>
      <button id="density-toggle" class="demo-view-toggle" type="button" title="Switch between card and compact list view" aria-label="Toggle list density" aria-pressed="false">☰ List</button>
    </section>
  `;
}

function workToolbarSummary() {
  const visibleCount = filteredPacks().length;
  const query = normalizeCopy(state.query);
  const filter = filterLabel(state.filter).toLowerCase();
  const queryPart = query ? ` matching "${query}"` : "";
  return `${visibleCount} ${workNoun(visibleCount)} visible${queryPart}; ${filter} filter active.`;
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
  return `${prefix}: show ${count} ${label.toLowerCase()} ${workNoun(count)}.`;
}

function filterStatusMessage(filterKey) {
  const visibleCount = filteredPacks().length;
  return `${filterLabel(filterKey)} filter applied: ${visibleCount} ${workNoun(visibleCount)} visible.`;
}

function filterLabel(filterKey) {
  return filters.find(([key]) => key === filterKey)?.[1] || "All";
}

function noSelectedWorkStatus(next = "choose work") {
  if (state.packs.length === 0) {
    const emptyNext = next === "choose work" ? `create or reset ${profile().work}` : next;
    return `Where: No ${profile().work} loaded. Blocker: no ${workNoun(2)} exist. Next action: ${emptyNext}.`;
  }

  return `Where: No ${profile().work} selected. Blocker: choose a ${workNoun(1)}. Next action: ${next}.`;
}

function setBackendCommandWaitStatus(){state.status=routeStatus("Backend command","waiting for server-owned command preview","try again after it loads");state.suppressNextSave=true}

function selectedWorkStatus(surface, pack, next = resolvePrimaryCommandForPack(pack).label) {
  return `Where: ${surface} / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: ${next}.`;
}

function profileCardHelp(key, value, active) {
  const prefix = active ? "Current copy profile" : "Apply copy profile";
  return `${prefix}: ${PROFILE_LABELS[key] || capitalize(key)}. Labels use ${value.newWork}, ${value.work}, and ${value.sources}.`;
}

function scenarioCardHelp(scenario, active) {
  const prefix = active ? "Current scenario" : "Apply scenario";
  return `${prefix}: ${scenario.label}. ${scenario.description}`;
}

function cardTitleButtonHelp(pack, action = "select") {
  const verb = action === "focus" ? "Focus" : "Select";
  const command = resolvePrimaryCommandForPack(pack);
  return `${verb} ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: ${command.label}.`;
}

function cardTitleButtonAttributes(pack, action = "select") {
  const copy = helpCopy(cardTitleButtonHelp(pack, action), DEMO_COPY_LIMITS.commandFlowHelp);
  return ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}"`;
}

function nextCandidateRow(pack) {
  return `<div class="demo-row has-row-support" data-pack-id="${escapeAttribute(pack.id)}">
    <div>
      <strong>${escapeHtml(workTitle(pack))}</strong>
      <span>${escapeHtml(isUnblockedBlockerValue(pack.blocker) ? "Ready for a clearer Next action." : blockerDisplayValue(pack.blocker))}</span>
    </div>
    <div class="demo-row-actions">
      ${supportActionButton("set-next", "Set next action", pack, "btn btn-sm btn-primary")}
    </div>
    ${compactRowSupport("Focus", supportActionButton("focus", "Focus", pack, "btn btn-sm"))}
  </div>`;
}

function compactRowSupport(summary, content) {
  return `<details class="demo-row-support">
    <summary>
      <span>Other action</span>
      <strong>${escapeHtml(summary)}</strong>
    </summary>
    <div class="demo-row-actions compact">
      ${content}
    </div>
  </details>`;
}

function optionalDetails(label, summary, content, className = "", attributes = "") {
  const extraClass = className ? ` ${className}` : "";
  const extraAttributes = attributes ? ` ${attributes}` : "";
  return `<details class="demo-support-details demo-site-details${extraClass}"${extraAttributes}>
    <summary>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(summary)}</strong>
    </summary>
    <div class="demo-detail-body">
      ${content}
    </div>
  </details>`;
}

function detailsOpenAttribute(...targetIds) {
  return targetIds.some((targetId) => clipboardTargetIsActive(targetId)) ? "open" : "";
}

function bindToolbar() {
  const search = el("demo-search");
  if (search) {
    let searchTimer = null;
    search.addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      state.suppressNextSave = true;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const summaryEl = el("demo-search-summary");
        if (summaryEl) {
          summaryEl.textContent = workToolbarSummary();
        }
        const listContainer = document.querySelector(".demo-work-list, .demo-work-table");
        if (listContainer) {
          const visible = filteredPacks();
          const orderedVisible = workListDisplayPacks(visible);
          const emptyHtml = state.packs.length === 0
            ? emptyState(`No ${profile().work} is available.`, `${profile().newWork} or reset demo data.`, emptyStateContextFor(`${workLabelTitle()} filters`, `no ${workNoun(2)} exist in this browser`, `create or reset ${profile().work}`))
            : emptyState(`No ${profile().work} matches this filter.`, "Clear search or choose another status filter.", emptyStateContextFor(`${workLabelTitle()} filters`, `current search or status filter hides every ${workNoun(1)}`, "clear search or choose another status filter"));
          const itemsHtml = orderedVisible.length ? orderedVisible.map(renderWorkItemHtml).join("") : emptyHtml;
          if (state.workListView === "table") {
            listContainer.className = "demo-work-table";
            listContainer.innerHTML = `<div class="demo-table-header"><span>Title</span><span>Owner</span><span>Status</span><span>Blocker</span><span>Next action</span><span></span></div>${itemsHtml}`;
          } else {
            listContainer.className = "demo-work-list";
            listContainer.innerHTML = itemsHtml;
          }
          bindWorkCards();
          bindTableRows();
        }
        const scopeEl = el("command-scope");
        if (scopeEl) {
          const visibleCount = filteredPacks().length;
          scopeEl.textContent = `${visibleCount} of ${state.packs.length} ${workNoun(state.packs.length)} visible.`;
        }
        updateActionReceipt();
      }, 150);
    });
  }

  document.querySelectorAll(".demo-chip").forEach((button) => {
    button.addEventListener("click", async () => {
      const filter = button.dataset.filter;
      if (DEMO_API_BASE_URL) {
        try {
          await saveBackendStateFilter(filter);
        } catch (error) {
          state.filter = filter;
          state.status = `Where: Filters. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
        }
        // Targeted update: chips + list, no full re-render
        document.querySelectorAll(".demo-chip").forEach((chip) => {
          chip.setAttribute("aria-pressed", String(chip.dataset.filter === state.filter));
        });
        document.querySelector(".demo-chip[data-filter=\"" + state.filter + "\"]")?.classList.add("active");
        updateWorkListAfterFilter();
        return;
      }

      state.filter = filter;
      state.status = filterStatusMessage(state.filter);
      // Targeted update: chips + list, no full re-render
      document.querySelectorAll(".demo-chip").forEach((chip) => {
        chip.setAttribute("aria-pressed", String(chip.dataset.filter === state.filter));
      });
      updateWorkListAfterFilter();
    });
  });

  const densityToggle = el("density-toggle");
  if (densityToggle) {
    densityToggle.addEventListener("click", () => {
      state.workListView = state.workListView === "card" ? "table" : "card";
      densityToggle.textContent = state.workListView === "card" ? "☰ List" : "▦ Cards";
      densityToggle.setAttribute("aria-pressed", String(state.workListView === "table"));
      updateWorkListAfterFilter();
    });
  }
}

function updateWorkListAfterFilter() {
  const listContainer = document.querySelector(".demo-work-list, .demo-work-table");
  if (listContainer) {
    const visible = filteredPacks();
    const orderedVisible = workListDisplayPacks(visible);
    const emptyHtml = state.packs.length === 0
      ? emptyState(`No ${profile().work} is available.`, `${profile().newWork} or reset demo data.`, emptyStateContextFor(`${workLabelTitle()} filters`, `no ${workNoun(2)} exist in this browser`, `create or reset ${profile().work}`))
      : emptyState(`No ${profile().work} matches this filter.`, "Clear search or choose another status filter.", emptyStateContextFor(`${workLabelTitle()} filters`, `current search or status filter hides every ${workNoun(1)}`, "clear search or choose another status filter"));
    const itemsHtml = orderedVisible.length ? orderedVisible.map(renderWorkItemHtml).join("") : emptyHtml;
    if (state.workListView === "table") {
      listContainer.className = "demo-work-table";
      listContainer.innerHTML = `<div class="demo-table-header">
        <span>Title</span>
        <span>Owner</span>
        <span>Status</span>
        <span>Blocker</span>
        <span>Next action</span>
        <span></span>
      </div>${itemsHtml}`;
    } else {
      listContainer.className = "demo-work-list";
      listContainer.innerHTML = itemsHtml;
    }
    bindWorkCards();
    bindTableRows();
    bindListActions();
  }
  const scopeEl = el("command-scope");
  if (scopeEl) {
    const visibleCount = filteredPacks().length;
    scopeEl.textContent = `${visibleCount} of ${state.packs.length} ${workNoun(state.packs.length)} visible.`;
  }
  updateActionReceipt();
  renderCommand(currentPack());
}

function renderWorkItemHtml(pack) {
  return state.workListView === "table" ? workRow(pack) : workCard(pack);
}

function workListContainerHtml(itemsHtml) {
  if (state.workListView === "table") {
    return `<div class="demo-work-table">
      <div class="demo-table-header">
        <span>Title</span>
        <span>Owner</span>
        <span>Status</span>
        <span>Blocker</span>
        <span>Next action</span>
        <span></span>
      </div>
      ${itemsHtml}
    </div>`;
  }
  return `<div class="demo-work-list">${itemsHtml}</div>`;
}

function workCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  const cardClass = workflowCardClass("demo-work-card", pack, workflow, pack.id === state.selectedId);
  const blockerAction = hasBlocker(pack)
    ? supportActionButton("unblock", "Clear blocker", pack, "btn btn-sm")
    : supportActionButton("block", "Mark blocked", pack, "btn btn-sm");
  return `<article class="${escapeAttribute(cardClass)}" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-card-head">
      <button type="button" class="demo-card-title" data-action="select"${cardTitleButtonAttributes(pack)}>${escapeHtml(workTitle(pack))}</button>
      ${pack.type && pack.type !== "general" ? `<span class="demo-type-badge" data-type="${escapeAttribute(pack.type)}">${escapeHtml(pack.type)}</span>` : ""}
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-card-facts" aria-label="${escapeAttribute(`Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. ${dueDateLabel(pack.due) || "No due date"}.`)}">
      ${cardFact("Where", workTitle(pack))}
      ${cardFact("Blocker", blockerTextForPack(pack))}
    </div>
    <div class="demo-command-row">
      <div>
        <span>Next action</span>
        <strong>${escapeHtml(command.label)}</strong>
      </div>
      ${primaryCommandButton(pack)}
      ${primaryCommandReasonNote(pack, command)}
    </div>
    <div class="demo-card-meta">
      ${dueDateMeta(pack)}
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    ${relevantMemoryCardStrip(pack)}
    ${actionReceiptCard(pack)}
    <details class="demo-card-support" data-support-actions="work-card">
      <summary>
        <span>Other actions</span>
        <strong>Extra tools for opening, focusing, clearing blockers, or saving proof.</strong>
      </summary>
      <div class="demo-card-actions">
        ${supportActionButton("open", "Open", pack, "btn btn-sm")}
        ${supportActionButton("focus", "Focus", pack, "btn btn-sm")}
        ${supportActionButton("compare", "Compare", pack, "btn btn-sm")}
        ${blockerAction}
        ${supportActionButton("done", "Finish with proof", pack, "btn btn-sm")}
      </div>
    </details>
  </article>`;
}

function workRow(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  const cellClass = `demo-table-row ${pack.id === state.selectedId ? "demo-table-row-selected" : ""}`;
  return `<button type="button" class="${escapeAttribute(cellClass)}" data-action="select" data-pack="${escapeAttribute(pack.id)}">
    <span class="demo-table-cell demo-table-title">${escapeHtml(workTitle(pack))}${pack.type && pack.type !== "general" ? ` <span class="demo-type-badge" data-type="${escapeAttribute(pack.type)}">${escapeHtml(pack.type)}</span>` : ""}</span>
    <span class="demo-table-cell demo-table-owner">${escapeHtml(pack.owner)}</span>
    <span class="demo-table-cell demo-table-status" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.statusLabel || workflow.label)}</span>
    <span class="demo-table-cell demo-table-blocker">${escapeHtml(blockerTextForPack(pack))}</span>
    <span class="demo-table-cell demo-table-next">${escapeHtml(command.label)}</span>
    <span class="demo-table-cell demo-table-action">${primaryCommandButton(pack, "btn btn-sm btn-primary")}</span>
  </button>`;
}

function reviewCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  const cardClass = workflowCardClass("demo-review-card", pack, workflow, pack.id === state.selectedId);
  const blockerAction = hasBlocker(pack)
    ? supportActionButton("unblock", "Clear blocker", pack)
    : supportActionButton("block", "Mark blocked", pack);
  const nextHelpId = `next-${pack.id}-help`;
  const nextHelp = `Set the exact Next action value for ${workTitle(pack)}.`;

  return `<article class="${escapeAttribute(cardClass)}" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-card-head demo-review-card-head">
      <button type="button" class="demo-card-title" data-action="select" data-pack="${escapeAttribute(pack.id)}"${cardTitleButtonAttributes(pack)}>${escapeHtml(workTitle(pack))}</button>
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-review-card-main">
      <div class="demo-card-facts">
        ${cardFact("Blocker", blockerTextForPack(pack))}
        ${cardFact("Next action", command.label)}
      </div>
      <div class="demo-review-card-actions">
        ${primaryCommandButton(pack)}
        ${primaryCommandReasonNote(pack, command)}
      </div>
    </div>
    <div class="demo-card-meta">
      ${dueDateMeta(pack)}
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    ${relevantMemoryCardStrip(pack)}
    ${actionReceiptCard(pack)}
    <details class="demo-card-support" data-support-actions="review-card">
      <summary>
        <span>Other actions</span>
        <strong>Extra tools for focusing, editing, clearing blockers, or setting Next action.</strong>
      </summary>
      <div class="demo-card-actions">
        ${supportActionButton("focus", "Focus", pack)}
        ${supportActionButton("edit", "Edit", pack)}
        ${blockerAction}
      </div>
      <div class="demo-inline-form">
        ${nextActionSelectField(`next-${pack.id}`, "Next action", editableNextActionValue(pack.next), nextHelp)}
        ${supportActionButton("set-next", "Save next action", pack)}
      </div>
    </details>
  </article>`;
}

function workflowCardClass(baseClass, pack, workflow, selected = false) {
  const classes = [baseClass, `is-${workflow.id}`];
  if (selected) classes.push("selected");
  if (hasBlocker(pack)) classes.push("has-blocker");
  if (isMissingNextAction(pack)) classes.push("needs-next");
  return classes.join(" ");
}

function cardFact(label, value) {
  return `<div class="demo-card-fact">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function primaryCommandButton(pack, className = "btn btn-primary") {
  const command = DEMO_API_BASE_URL ? null : resolvePrimaryCommandForPack(pack);
  const label = command ? (commandActionDisplayLabel(command.label) || command.label) : "Do next";
  const reason = command
    ? primaryCommandReason(pack, command)
    : `Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: server preview before running.`;
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<button class="${escapeAttribute(className)}" type="button" data-action="run-next" data-pack="${escapeAttribute(pack.id)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(label)}</button>`;
}

function primaryCommandReason(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: ${command.label}.`;
}

function primaryCommandReasonNote(pack, command = resolvePrimaryCommandForPack(pack)) {
  const reason = normalizeCopy(command?.primaryReason) || primaryCommandVisibleReason(pack, command);
  const copy = copySurface(reason, DEMO_COPY_LIMITS.commandFlowVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<small class="demo-primary-reason" data-primary-action-reason title="${escapeAttribute(copy.help)}" aria-label="${escapeAttribute(copy.help)}">${escapeHtml(copy.visible)}</small>`;
}

function primaryCommandVisibleReason(pack, command = resolvePrimaryCommandForPack(pack)) {
  if (isBackendCommandPending(command)) {
    return "Why: waiting for backend command.";
  }

  if (isMissingNextAction(pack)) {
    return "Why: setup comes first.";
  }

  if (hasBlocker(pack)) {
    return `Why: ${blockerTextForPack(pack)} blocks it.`;
  }

  if (command.action === "done") {
    return "Why: proof is ready.";
  }

  return `Why: no blocker; ${command.label} can run.`;
}

function packPrimaryActionButton(command) {
  const pending = isBackendCommandPending(command);
  const copy = pending ? backendCommandPendingReason(command) : commandRunLabel(command);
  const label = commandActionDisplayLabel(command.next) || command.next || "Open work list";
  const stateAttributes = pending
    ? `${disabledReasonAttributes(true, copy)} aria-label="${escapeAttribute(copy)}"`
    : ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}"`;
  return `<button id="pack-primary-action" class="btn btn-primary demo-pack-primary-action" type="button" data-action="${escapeAttribute(pending ? "" : command.action || "")}" data-pack="${escapeAttribute(command.targetPackId || "")}"${stateAttributes}>${escapeHtml(label)}</button>`;
}

function syncPackPrimaryAction(command) {
  const button = el("pack-primary-action");
  if (!button) {
    return;
  }

  setCopySurface(button, command.next, "Next action", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  syncCommandActionButton(button, command);
}

function supportActionButton(action, label, pack, className = "btn") {
  const disabledReason = supportActionDisabledReason(action, pack);
  const reason = disabledReason || supportActionReason(action, pack);
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  const visibleReason = disabledReason
    ? supportActionDisabledVisibleReason(action, pack)
    : supportActionVisibleReason(action);
  const buttonClass = `${className} demo-support-action`;
  const stateAttributes = disabledReason
    ? `${disabledReasonAttributes(true, disabledReason)} aria-label="${escapeAttribute(copy)}"`
    : ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}"`;
  return `<button class="${escapeAttribute(buttonClass)}" type="button" data-action="${escapeAttribute(action)}" data-pack="${escapeAttribute(pack.id)}" data-support-reason="${escapeAttribute(visibleReason)}"${stateAttributes}><span class="demo-support-label">${escapeHtml(label)}</span><small class="demo-support-reason" aria-hidden="true">${escapeHtml(visibleReason)}</small></button>`;
}

function supportActionReason(action, pack) {
  const where = pack?.title || "selected work";
  const blocker = blockerTextForPack(pack) || "No blocker";
  const commandForSupportAction = resolvePrimaryCommandForPack(pack);
  const current = isMissingNextAction(pack) ? "Next action is missing" : `Next action is ${commandForSupportAction.label || "set"}`;
  const reasons = {
    open: `Open ${where} to inspect it without changing where Blocker is ${blocker}.`,
    focus: `Open ${where} focus view only; this does not run the main button.`,
    block: `Mark ${where} blocked to pause work while blocker details are confirmed.`,
    unblock: `Clear blocker for ${where}; this allows Next action to continue when set.`,
    done: `Finish ${where} and capture proof when workflow is ready to close.`,
    edit: `Edit ${where} path fields used by Next action.`,
    "set-next": `Set next action for ${where} so the next action is deterministic. Current state: ${current}.`,
    review: `Review path evidence for ${where}.`,
    "review-work": `Review all work items and confirm where the next action should go.`,
    start: `Start ${where} from the current state.`
  };
  const base = reasons[action] || `Run ${actionLabelFromKey(action)} for ${where}.`;
  return commandForSupportAction?.action === "done" && action !== "done"
    ? `${base} Next action for ${where} is ${normalizeCopy(commandForSupportAction?.next) || "open"} before proof is closed.`
    : base;
}

function supportActionDisabledReason(action, pack) {
  const where = pack?.title || "selected work";
  if (action !== "done") {
    return "";
  }

  if (pack?.status === "done") {
    return `Where: ${where} / done. Blocker: proof is already saved. Next action: Open to inspect this work.`;
  }

  const command = resolvePrimaryCommandForPack(pack);
  if (command.action === "done") {
    if (!normalizeCopy(pack?.doneWhen)) {
      return `Where: ${where}. Blocker: proof target is missing. Next action: add proof target before finishing with proof.`;
    }

    return "";
  }

  if (isMissingNextAction(pack)) {
    return `Where: ${where}. Blocker: Next action is missing. Next action: set next action before finishing with proof.`;
  }

  if (hasBlocker(pack)) {
    return `Where: ${where}. Blocker: ${blockerTextForPack(pack)}. Next action: clear blocker before finishing with proof.`;
  }

  return `Where: ${where}. Blocker: Next action is ${command.label}. Next action: choose Finish with proof before saving proof.`;
}

function supportActionDisabledVisibleReason(action, pack) {
  const where = pack?.title || "selected work";
  if (action !== "done") {
    return "No disabled reason; this button should stay enabled.";
  }

  if (pack?.status === "done") {
    return `Already done for ${where}; use Open to inspect it.`;
  }

  if (isMissingNextAction(pack)) {
    return "Set next action for this work before finishing with proof.";
  }

  if (hasBlocker(pack)) {
    return `Clear blocker (${where}) before finishing with proof.`;
  }

  const command = resolvePrimaryCommandForPack(pack);
  if (command.action === "done" && !normalizeCopy(pack?.doneWhen)) {
    return "Add proof target first before finishing with proof.";
  }

  return "Choose Finish with proof as Next action.";
}

function supportActionVisibleReason(action) {
  const reasons = {
    open: "Open fields without running next.",
    focus: "Inspect without changing status.",
    block: "Add a blocker for review.",
    unblock: "Stores Blocker: None.",
    done: "Finish with proof visible.",
    edit: "Edit work path fields.",
    "set-next": "Choose the exact Next action value."
  };
  return reasons[action] || "Other button.";
}

function bindWorkCards() {
  document.querySelectorAll(".demo-work-card button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".demo-work-card");
      workListKeepOrder = true;
      handlePackAction(card.dataset.packId, button.dataset.action);
    });
  });
}

function bindTableRows() {
  document.querySelectorAll(".demo-table-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      // Ignore clicks on nested buttons (run-next)
      if (event.target.closest("[data-action]") && event.target.closest("[data-action]") !== row) {
        return;
      }
      workListKeepOrder = true;
      handlePackAction(row.dataset.pack, "select");
    });
  });
}

function bindListActions() {
  el("screen-content").querySelectorAll("[data-action]").forEach((button) => {
    if (button.closest(".demo-work-card") || button.id === "pack-primary-action" || button.matches(".demo-table-row")) {
      return;
    }

    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "set-next") {
        const pack = findPack(button.dataset.pack);
        if (pack) {
          const input = el(`next-${pack.id}`);
          state.selectedId = pack.id;
          if (input) {
            try {
              const backendResult = await saveBackendPackNextAction(pack, input.value);
              if (!backendResult) {
                const result = setPackNextAction(pack, input.value);
                setNextConfirmation(pack, result);
              }
            } catch (error) {
              console.error("Projects demo backend next action failed.", error);
              state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
            }
          } else {
            state.status = selectedWorkStatus("Next setup", pack, "choose next action");
            queueFocus("next", pack.id);
            go("next", pack.id);
            return;
          }
        } else {
          state.status = noSelectedWorkStatus("choose work before setting Next action");
        }
      } else {
        if (runRouteAction(action, button.dataset.pack || "")) {
          return;
        }

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
    "run-next": "Do next",
    review: "Review",
    "set-next": "Set next action",
    "review-work": "Review work",
    start: "Start",
    unblock: "Set Blocker: None",
    block: "Block",
    done: "Finish with proof",
    focus: "Focus",
    edit: "Open",
    open: "Open"
  };

  return labels[action] || (typeof action === "string" ? capitalize(action) : "Button");
}

function setActionConfirmation(pack, action) {
  if (!pack) return;

  const next = resolvePrimaryCommandForPack(pack);
  const actionLabel = actionLabelFromKey(action);
  setActionReceipt(
    pack,
    routeActionSummary(pack, action, actionLabel),
    next
  );
}

function setPackActionConfirmation(pack, action, changed, unblockedCount = 0) {
  if (!pack) return;

  const actionLabel = actionLabelFromKey(action);
  const summary = packActionSummary(pack, action, actionLabel, changed, unblockedCount);
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function burstConfetti() {
  const emojis = ["🎉", "✨", "🎊", "✅", "🌟"];
  const container = document.createElement("div");
  container.className = "demo-confetti-burst";
  container.setAttribute("aria-hidden", "true");
  const randomBytes = new Uint8Array(60);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  }
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement("span");
    const leftClass = `demo-confetti-left-${randomBytes[i * 3] % 10}`;
    const delayClass = `demo-confetti-delay-${randomBytes[i * 3 + 1] % 5}`;
    const durClass = `demo-confetti-dur-${randomBytes[i * 3 + 2] % 4}`;
    particle.className = `demo-confetti-particle ${leftClass} ${delayClass} ${durClass}`;
    particle.textContent = emojis[i % emojis.length];
    container.appendChild(particle);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3000);
}

function packActionSummary(pack, action, actionLabel, changed, unblockedCount = 0) {
  const title = workTitle(pack);
  if (action === "done") {
    const proof = proofTargetSentence(pack);
    const base = changed
      ? `Done saved for ${title}.`
      : `Done already saved for ${title}.`;
    if (changed) {
      requestAnimationFrame(() => burstConfetti());
    }
    return [base, unblockedReceiptSentence(unblockedCount), proof].filter(Boolean).join(" ");
  }

  if (action === "open") {
    return changed
      ? `Work path opened for ${title}.`
      : `Work path already open for ${title}.`;
  }

  if (action === "focus") {
    return changed
      ? `Focus opened for ${title}.`
      : `Focus is already open for ${title}.`;
  }

  if (action === "edit") {
    return changed
      ? `Work path fields opened for ${title}.`
      : `Work path fields are already open for ${title}.`;
  }

  if (action === "review") {
    return changed
      ? `Review opened for ${title}.`
      : `Review is already open for ${title}.`;
  }

  if (action === "start") {
    return changed
      ? `Started ${title}.`
      : `${title} is already active.`;
  }

  if (action === "unblock") {
    return changed
      ? `Blocker cleared for ${title}.`
      : `Blocker already clear for ${title}.`;
  }

  if (action === "block") {
    return changed
      ? `Blocker added for ${title}.`
      : `${title} is already blocked.`;
  }

  return changed
    ? `${actionLabel} saved for ${title}.`
    : `${actionLabel} is already saved for ${title}.`;
}

function routeActionSummary(pack, action, actionLabel) {
  const title = workTitle(pack);
  if (action === "focus") {
    return `Focus opened for ${title}.`;
  }

  if (action === "review-work") {
    return `Review work opened for ${title}.`;
  }

  if (action === "edit") {
    return `Work path opened for ${title}.`;
  }

  return `Button ran for ${title}: ${actionLabel}.`;
}

function setSaveConfirmation(pack, result) {
  if (!pack) return;

  const proof = proofTargetSentence(pack);
  const title = workTitle(pack);
  const summary = result?.changed
    ? `Work path saved for ${title}. ${result.summary}. ${proof}`
    : `No work path changes for ${title}. ${proof}`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setNextConfirmation(pack, result) {
  if (!pack) return;

  const nextLabel = result?.label || nextActionDisplayLabel(result?.next);
  const summary = result.changed
    ? `Next action set to ${nextLabel} for ${workTitle(pack)}.`
    : `Button already runs ${nextLabel} for ${workTitle(pack)}.`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setCreateConfirmation(pack) {
  if (!pack) return;

  const next = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, next);
  setActionReceipt(
    pack,
    `Created ${workTitle(pack)}. State: ${workflow.label}. Blocker: ${blockerTextForPack(pack)}. Next action: ${next.label}.`,
    next
  );
}

function setMemoryConfirmation(pack, result) {
  if (!pack) return;

  const summary = result.added
    ? `Memory note added for ${workTitle(pack)}.`
    : `Memory note already exists for ${workTitle(pack)}.`;
  setActionReceipt(
    pack,
    summary,
    resolvePrimaryCommandForPack(pack)
  );
}

function setActionReceipt(pack, summary, next = resolvePrimaryCommandForPack(pack)) {
  const workflow = workflowStateForPack(pack, next);
  const outcomeSummary = normalizeCopy(summary);
  const fullSummary = actionReceiptSummary(outcomeSummary, pack, next);
  const receipt = {
    packId: pack.id,
    summary: fullSummary,
    visibleSummary: visibleCopy(outcomeSummary || fullSummary, DEMO_COPY_LIMITS.receiptVisible),
    where: `${workTitle(pack)} / ${workflow.label}`,
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
  const workflow = workflowStateForPack(pack, next);
  const proof = /(^|\s)Proof target:/iu.test(summary)
    ? ""
    : ` Proof target: ${proofTargetForPack(pack)}.`;
  return `Where: ${workTitle(pack)} / ${workflow.label}. Blocker: ${blockerTextForPack(pack)}. Next action: ${next.label}.${proof}`;
}

function updateActionReceipt() {
  const receiptElement = el("command-receipt");
  if (!receiptElement) return;

  const receipt = commandActionReceipt();
  if (!receipt) {
    receiptElement.hidden = true;
    receiptElement.innerHTML = "";
    delete receiptElement.dataset.receiptKind;
    delete receiptElement.dataset.receiptTone;
    delete receiptElement.dataset.receiptSurface;
    receiptElement.removeAttribute("aria-label");
    receiptElement.removeAttribute("title");
    return;
  }

  receiptElement.hidden = false;
  receiptElement.dataset.receiptSurface = receipt.kind === "clipboard" ? "clipboard" : "command";
  receiptElement.dataset.receiptKind = receipt.kind || "action";
  receiptElement.dataset.receiptTone = receipt.tone || "success";
  const fullSummary = receiptAccessibleSummary(receipt);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  receiptElement.setAttribute("aria-label", fullSummary);
  receiptElement.setAttribute("title", fullSummary);
  const eyebrow = receipt.kind === "clipboard"
    ? receipt.tone === "blocked" ? "Clipboard blocked" : "Clipboard ready"
    : "Last result";
  receiptElement.innerHTML = `
    <div class="demo-command-receipt-head">
      <span>${escapeHtml(eyebrow)}</span>
      <strong>${escapeHtml(visibleSummary)}</strong>
    </div>
    <div class="demo-command-receipt-lines">
      ${receiptLine("Where", receipt.where)}
      ${receiptLine("Blocker", receipt.blocker)}
      ${receiptLine("Next action", receipt.next)}
      ${receiptLine("Proof target", receipt.proof)}
    </div>
    ${commandReceiptFollowUpAction(receipt)}`;
  bindCommandReceiptActions(receiptElement);
}

function commandActionReceipt() {
  const receipt = normalizeActionReceipt(state.actionReceipt);
  if (!receipt) {
    return null;
  }

  if (receipt.kind === "clipboard" || !receipt.packId) {
    return receipt;
  }

  const selected = currentPack();
  return selected?.id === receipt.packId ? receipt : null;
}

function actionReceiptCard(pack) {
  const receipt = normalizeActionReceipt(state.actionReceipt);
  if (!pack || !receipt || receipt.packId !== pack.id) {
    return "";
  }

  const fullSummary = receiptAccessibleSummary(receipt);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  return `<div class="demo-card-receipt" data-receipt-surface="card" data-card-receipt="${escapeAttribute(pack.id)}" role="status" tabindex="-1" title="${escapeAttribute(fullSummary)}" aria-label="${escapeAttribute(fullSummary)}">
    <span>Last result</span>
    <strong>${escapeHtml(visibleSummary)}</strong>
    ${receiptCardLines(receipt)}
    ${receiptFollowUpAction(pack, receipt)}
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

  const routeReceipt = {
    ...receipt,
    where: `${routeLabel} / ${workTitle(pack)}`
  };
  const fullSummary = receiptAccessibleSummary(routeReceipt);
  const visibleSummary = visibleCopy(receipt.visibleSummary || receipt.summary, DEMO_COPY_LIMITS.receiptVisible);
  return `<div class="demo-card-receipt demo-route-receipt" data-receipt-surface="route" data-route-receipt="${escapeAttribute(pack.id)}" role="status" tabindex="-1" title="${escapeAttribute(fullSummary)}" aria-label="${escapeAttribute(fullSummary)}">
    <span>Last result</span>
    <strong>${escapeHtml(visibleSummary)}</strong>
    ${receiptCardLines(routeReceipt)}
  </div>`;
}

function receiptCardLines(receipt) {
  return `<div class="demo-card-receipt-lines">
    ${receiptLine("Where", receipt.where)}
    ${receiptLine("Blocker", receipt.blocker)}
    ${receiptLine("Next action", receipt.next)}
    ${receiptLine("Proof target", receipt.proof)}
  </div>`;
}

function receiptLine(label, value) {
  const copy = copySurface(value || DEMO_BLOCKER_NONE_LABEL, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<div>
    <span>${escapeHtml(label)}</span>
    <strong${copySurfaceAttributes(label, copy)}>${escapeHtml(copy.visible)}</strong>
  </div>`;
}

function receiptFollowUpAction(pack, receipt) {
  if (state.route !== "memory" || !pack || receipt?.packId !== pack.id) {
    return "";
  }

  const next = resolvePrimaryCommandForPack(pack);
  const help = `Where: Memory / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: continue work; next action is ${next.label}.`;
  return `<div class="demo-card-receipt-actions">
    <button class="btn btn-sm btn-primary" type="button" data-go="pack" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(help)}>Continue work</button>
    <small>${escapeHtml(`Returns to selected work. Next action stays ${next.label}.`)}</small>
  </div>`;
}

function commandReceiptFollowUpAction(receipt) {
  if (state.route !== "memory" || !receipt?.packId) {
    return "";
  }

  const pack = findPack(receipt.packId);
  if (!pack) {
    return "";
  }

  const next = resolvePrimaryCommandForPack(pack);
  const help = `Where: Memory / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: continue work; next action is ${next.label}.`;
  return `<div class="demo-command-receipt-actions">
    <button class="btn btn-sm btn-primary" type="button" data-go="pack" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(help)}>Continue work</button>
    <small>${escapeHtml(`Returns to selected work. Next action stays ${next.label}.`)}</small>
  </div>`;
}

function bindCommandReceiptActions(receiptElement) {
  receiptElement.querySelectorAll("[data-go]").forEach(bindGoButton);
}

function receiptAccessibleSummary(receipt) {
  const context = `Where: ${sentenceValue(receipt.where)}. Blocker: ${sentenceValue(receipt.blocker)}. Next action: ${sentenceValue(receipt.next)}. Proof target: ${sentenceValue(receipt.proof)}.`;
  const result = normalizeCopy(receipt.visibleSummary || receipt.summary);
  return helpCopy(`${context}${result ? ` Result: ${sentenceValue(result)}.` : ""}`, DEMO_COPY_LIMITS.receiptHelp);
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
  const proof = normalizeCopy(receipt.proof) || normalizeCopy(receipt.doneWhen) || DEMO_PROOF_TARGET_MISSING;
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
  return normalizeCopy(pack?.doneWhen) || DEMO_PROOF_TARGET_MISSING;
}

function proofTargetSentence(pack) {
  return `Proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function proofSavedActivity(pack) {
  return `Done saved with proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

function sentenceValue(value) {
  return (normalizeCopy(value) || DEMO_PROOF_TARGET_MISSING).replace(/[.!?]+$/u, "");
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

async function savePackMemoryNote(pack, note) {
  try {
    const backendResult = await addBackendPackMemoryNote(pack, note);
    if (backendResult) {
      return backendResult;
    }

    const result = addPackMemoryNote(pack, note);
    setMemoryConfirmation(pack, result);
    return result;
  } catch (error) {
    console.error("Projects demo backend memory action failed.", error);
    state.status = `Where: Backend memory. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
    return null;
  }
}

function setPackNextAction(pack, value) {
  const next = normalizeCopy(value) || "Open";
  const beforeStatus = normalizeCopy(pack?.status);
  const beforeNext = normalizeCopy(pack?.next);
  const beforeBlocker = normalizeCopy(pack?.blocker);

  if (!pack) {
    return { changed: false, next };
  }

  const forwardPath = nextChoiceForwardPath(pack, next);
  pack.next = forwardPath.next;
  pack.blocker = forwardPath.blocker;
  pack.status = forwardPath.status;

  const changed = beforeStatus !== normalizeCopy(pack.status)
    || beforeNext !== normalizeCopy(pack.next)
    || beforeBlocker !== normalizeCopy(pack.blocker);
  const label = nextActionDisplayLabel(pack.next);
  if (changed) {
    addPackActivity(pack, `Next action changed to ${label}.`);
  }

  return { changed, next: pack.next, label };
}

function nextChoiceForwardPath(pack, value) {
  const next = normalizeCopy(value) || "Open";
  const blocker = normalizeCopy(pack?.blocker) === "missing next action"
    ? DEMO_BLOCKER_NONE
    : normalizeStoredBlocker(pack?.blocker);
  return {
    next,
    blocker,
    status: forwardPathStatusForBlocker(pack?.status, blocker, next)
  };
}

function packActionSignature(pack) {
  return JSON.stringify({
    status: pack?.status || "",
    blocker: pack?.blocker || "",
    next: pack?.next || ""
  });
}

function packCommandSignature(pack) {
  const status = normalizeCopy(pack?.status).slice(0, 40) || "unknown";
  const blocker = normalizeStoredBlocker(normalizeCopy(pack?.blocker).slice(0, 200));
  const next = normalizeCopy(pack?.next).slice(0, 200);
  return `${status}|${blocker}|${next}`;
}

async function applyNextChoice(id) {
  const pack = findPack(id);
  if (!pack) return;

  const choice = valueOf("next-action-choice") || "Open";
  try {
    const backendResult = await saveBackendPackNextAction(pack, choice);
    if (backendResult?.pack?.id) {
      go("work", backendResult.pack.id);
      return;
    }
  } catch (error) {
    console.error("Projects demo backend next action failed.", error);
    state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
    render();
    return;
  }

  const result = setPackNextAction(pack, choice);
  state.selectedId = pack.id;
  setNextConfirmation(pack, result);
  go("work", pack.id);
}

function bindGoButtons() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    bindGoButton(button);
  });
}

function bindGoButton(button) {
  if (!button || button.dataset.goBound === "true") {
    return;
  }

  button.dataset.goBound = "true";
  button.addEventListener("click", () => {
    go(button.dataset.go, button.dataset.pack || "");
  });
}

async function handlePackAction(id, action) {
  const pack = findPack(id);
  if (!pack) return;
  state.selectedId = pack.id;

  if (action === "select") {
    state.status = selectedWorkStatus("Work list", pack);
    go("work", pack.id);
    return;
  } else if (action === "run-next") {
    runResolvedPackAction(pack);
    return;
  } else if (action === "review") {
    openReviewFixPath(pack);
    return;
  } else if (action === "set-next") {
    state.status = selectedWorkStatus("Next setup", pack, "choose next action");
    queueFocus("next", pack.id);
    go("next", pack.id);
    return;
  }

  if (SERVER_PACK_ACTIONS.has(action)) {
    try {
      if (await runBackendPackAction(pack, action)) {
        return;
      }
    } catch (error) {
      console.error("Projects demo backend action failed.", error);
      state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
      render();
      return;
    }
  }

  if (action === "start") {
    const before = packActionSignature(pack);
    pack.status = "active";
    pack.blocker = pack.blocker === "missing setup" ? DEMO_BLOCKER_NONE : pack.blocker;
    pack.next = isPlaceholderNext(pack.next) ? "Open" : pack.next;
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Started.");
    }
    setPackActionConfirmation(pack, "start", changed);
    go("pack", pack.id);
    return;
  } else if (action === "unblock") {
    const before = packActionSignature(pack);
    pack.status = "active";
    pack.blocker = DEMO_BLOCKER_NONE;
    pack.next = "Open";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocker set to None.");
    }
    setPackActionConfirmation(pack, "unblock", changed);
    go("pack", pack.id);
    return;
  } else if (action === "block") {
    const before = packActionSignature(pack);
    pack.status = "blocked";
    pack.blocker = "blocked in this demo";
    pack.next = "Set Blocker: None";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocked.");
    }
    setPackActionConfirmation(pack, "block", changed);
    go("pack", pack.id);
    return;
  } else if (action === "compare") {
    go("compare", pack.id);
    return;
  } else if (action === "done") {
    const before = packActionSignature(pack);
    const wasDone = pack.status === "done";
    pack.status = "done";
    pack.blocker = DEMO_BLOCKER_NONE;
    pack.blockedBy = "";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, proofSavedActivity(pack));
    }
    const unblocked = wasDone ? [] : unblockPacksBlockedBy(pack);
    setPackActionConfirmation(pack, "done", changed, unblocked.length);
    go("pack", pack.id);
    return;
  } else if (action === "focus") {
    setActionConfirmation(pack, "focus");
    go("pack", pack.id);
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
  const targetPackId = control?.dataset.pack || el("primary-action").dataset.pack;
  if (control?.disabled) {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      scheduleBackendPackCommandPreview(selected);
    }
    setBackendCommandWaitStatus();
    render();
    return;
  }

  const action = control?.dataset.action || el("primary-action").dataset.action;
  if (pendingForwardPathBlocksAction(targetPackId)) {
    return;
  }
  if (action === "clear-owner-blocker") {
    if (runRouteAction(action, targetPackId)) {
      return;
    }
  }
  if (savePendingForwardPathForAction(targetPackId)) {
    return;
  }
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

  const resolved = backendPackCommandForSelected(pack) || resolvePrimaryCommandForPack(pack);
  if (isBackendCommandPending(resolved)) {
    scheduleBackendPackCommandPreview(pack);
    // Fall through to local command if backend preview isn't ready after 3s
    // (the pending state clears when the preview loads)
    if (pendingBackendPackCommandRequests.has(backendPackCommandCacheKey(pack))) {
      setBackendCommandWaitStatus();
      render();
      return;
    }
  }

  if (runRouteAction(resolved.action, resolved.targetPackId)) {
    return;
  }

  handlePackAction(pack.id, resolved.action);
}

function openReviewFixPath(pack) {
  if (!pack) {
    return false;
  }

  const focusKind = reviewFocusKindForPack(pack);
  state.selectedId = pack.id;
  state.status = selectedWorkStatus("Work path", pack, reviewFixNextForPack(pack));
  go("pack", pack.id, focusKind);
  return true;
}

function reviewFixNextForPack(pack) {
  const focusKind = reviewFocusKindForPack(pack);
  if (focusKind === "support-owner") {
    return "fill owner";
  }

  if (focusKind === "next") {
    return "set next action";
  }

  return "choose None or describe blocker";
}

function pendingPackForAction(targetPackId) {
  const pack = findPack(targetPackId) || currentPack();
  const form = el("pack-edit-form");
  if (!pack || !form || form.dataset.packId !== pack.id) {
    return null;
  }

  return pendingPackFromForwardPathForm(pack);
}

function savePendingForwardPathForAction(targetPackId) {
  const pack = findPack(targetPackId) || currentPack();
  const form = el("pack-edit-form");
  if (!pack || !form || form.dataset.packId !== pack.id) {
    return false;
  }

  const hasPendingChanges = packForwardPathFormSignature(pack) !== packForwardPathSignature(pack);
  if (!hasPendingChanges) {
    return false;
  }

  const stateForSave = packDetailSaveState(pack);
  if (!stateForSave.canSave) {
    state.status = stateForSave.help;
    syncPackDetailValidation(pack);
    return true;
  }

  savePackForwardPathFromForm(pack).then(() => render()).catch(() => render());
  return true;
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

  state.status = `Where: Work path. Blocker: ${issue}. Next action: ${blockerModeFixNext(issue)}.`;
  syncPackDetailValidation(pack);
  requestAnimationFrame(() => focusCommandTarget(blockerModeFocusKind(issue), pack.id));
  return true;
}

function runRouteAction(action, targetPackId) {
  if (action === "backend-command-pending") {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      scheduleBackendPackCommandPreview(selected);
    }
    setBackendCommandWaitStatus();
    render();
    return true;
  }

  if (action === "clear-owner-blocker") {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      setBlockerMode(false);
      syncPackDetailValidation(selected);
      const stateForSave = packDetailSaveState(selected);
      if (!stateForSave.canSave) {
        state.status = stateForSave.help;
        syncPackDetailValidation(selected);
        focusAndPulse(el("pack-primary-action") || el("primary-action"));
        return true;
      }

      savePackForwardPathFromForm(selected).then(() => render());
    }
    return true;
  }

  if (action === "fix-blocker-mode") {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      const issue = blockerModeIssue() || "blocked mode needs a real blocker";
      queueFocus(blockerModeFocusKind(issue), selected.id);
      state.status = `Where: Work path. Blocker: ${issue}. Next action: ${blockerModeFixNext(issue)}.`;
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

  if (action === "open-create") {
    queueFocus("create-title");
    go("create");
    return true;
  }

  if (action === "set-next") {
    const selected = findPack(targetPackId) || currentPack();
    if (state.route === "next") {
      if (!selected) {
        state.status = noSelectedWorkStatus("choose work before setting Next action");
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

    const routeCommand = resolvePrimaryCommandForPack(selected);
    if (routeCommand.action !== "review") {
      return runRouteAction(routeCommand.action, routeCommand.targetPackId);
    }

    return openReviewFixPath(selected);
  }

  if (action === "review-work") {
    const selected = findPack(targetPackId) || currentPack();
    if (!selected) {
      const review = preferredReviewPack();
      if (review) {
        state.selectedId = review.id;
        go("pack", review.id);
      } else {
        go("work");
      }
      return true;
    }

    if (hasBlocker(selected) || isMissingNextAction(selected)) {
      return openReviewFixPath(selected);
    }

    state.selectedId = selected.id;
    setActionConfirmation(selected, "review-work");
    go("pack", selected.id);
    return true;
  }

  if (action === "create-sample") {
    createSamplePack();
    return true;
  }

  if (action === "focus-create-title" || action === "focus-create-owner" || action === "focus-create-next") {
    if (state.route !== "create") {
      queueFocus(focusKindForAction(action));
      go("create");
      return true;
    }

    state.status = createSaveState(createFormValues()).help;
    state.pendingFocus = null;
    focusCommandTarget(focusKindForAction(action));
    return true;
  }

  if (action === "memory") {
    const pack = findPack(targetPackId) || currentPack();
    if (pack) {
      state.selectedId = pack.id;
    }

    queueFocus("memory-note", pack?.id || "");
    state.status = memoryRouteStatus(pack);
    go("memory", pack?.id || "");
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
      savePackMemoryNote(pack, input.value).then(() => render());
    } else {
      state.status = memoryRouteStatus(pack);
      render();
    }
    return true;
  }

  if (action === "type-memory-note") {
    const pack = findPack(targetPackId) || currentPack();
    if (pack) {
      state.selectedId = pack.id;
    }

    state.status = memoryRouteStatus(pack);
    if (state.route !== "memory") {
      queueFocus("memory-note", pack?.id || "");
      go("memory", pack?.id || "");
      return true;
    }

    syncMemoryValidation(pack);
    focusCommandTarget("memory-note", pack?.id || "");
    return true;
  }

  return false;
}

function reviewFocusKindForPack(pack) {
  const blocker = blockerTextForPack(pack).toLowerCase();
  if (blocker.includes("owner")) {
    return "support-owner";
  }

  if (blocker.includes("next action") || blocker.includes("button runs next")) {
    return "next";
  }

  return "pack-blocker";
}

function commandActionForLabel(label) {
  label = (label || "Open").trim() || "Open";
  const normalized = label.toLowerCase();

  if (normalized === "review blocker") {
    return { label: "Review blocker", action: "review" };
  }

  if (normalized === "review" || normalized === "review work") {
    return { label: "Review work", action: "review-work" };
  }

  if (normalized === "set next" || normalized === "set next action" || normalized === "set button runs next" || normalized === "choose next action") {
    return { label: "Set next action", action: "set-next" };
  }

  if (normalized === "focus") {
    return { label, action: "focus" };
  }

  if (normalized === "unblock" || normalized === "set blocker: none" || normalized === "set blocker none") {
    return { label: "Set Blocker: None", action: "unblock" };
  }

  if (normalized === "start") {
    return { label, action: "start" };
  }

  if (normalized === "done" || normalized === "complete" || normalized === "finish with proof") {
    return { label: "Finish with proof", action: "done" };
  }

  return { label: label === "Open" ? "Open" : label, action: "open" };
}

function nextActionDisplayLabel(value) {
  return commandActionForLabel(value || "Open").label;
}

function defaultCreateValues() {
  return {
    title: "",
    owner: "",
    next: "",
    due: "",
    purpose: ""
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
  const canSave = isUnblockedBlockerValue(workflow.blocker);
  const next = canSave ? persistenceVerb() : createActionForBlocker(workflow.blocker);

  return {
    ...workflow,
    canSave,
    help: `Where: Create. Blocker: ${blockerDisplayValue(workflow.blocker)}. Next action: ${next}.`
  };
}

function createReadinessLabel(createState) {
  return createState.canSave
    ? "Ready"
    : `Needs ${normalizeCopy(createState.blocker).replace(/^missing /, "")}`;
}

function createActionForBlocker(blocker) {
  if (blocker === "missing title") {
    return "Fill title";
  }

  if (blocker === "missing owner") {
    return "Fill owner";
  }

  if (blocker === "missing next action") {
    return "Choose next action";
  }

  return persistenceVerb();
}

function bindCreateValidation() {
  ["new-title", "new-owner", "new-next"].forEach((id) => {
    const control = el(id);
    control?.addEventListener("input", syncCreateValidation);
    control?.addEventListener("change", syncCreateValidation);
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
  syncCreateReadinessPanel(createFormValues(), stateForSave);
  syncCreateRouteCommand();
}

function syncCreateReadinessPanel(values, createState) {
  const action = createReadinessAction(createState);
  const statePill = el("create-readiness-state");
  const blocker = el("create-readiness-blocker");
  const next = el("create-readiness-next");
  const actionButton = el("create-readiness-action");
  const note = el("create-readiness-note");

  if (statePill) {
    statePill.textContent = createReadinessLabel(createState);
    statePill.title = createState.help;
  }
  if (blocker) {
    blocker.textContent = blockerDisplayValue(createState.blocker);
  }
  if (next) {
    next.textContent = action.label;
  }
  if (actionButton) {
    const copy = helpCopy(createState.help, DEMO_COPY_LIMITS.commandFlowHelp);
    actionButton.dataset.action = action.key;
    actionButton.textContent = action.label;
    actionButton.title = copy;
    actionButton.setAttribute("aria-label", copy);
  }
  if (note) {
    note.textContent = createState.help;
  }

  syncCreateReadinessStep("create-readiness-title", values.title);
  syncCreateReadinessStep("create-readiness-owner", values.owner);
  syncCreateReadinessStep("create-readiness-button", values.next);
}

function syncCreateReadinessStep(id, value) {
  const step = el(id);
  const label = step?.querySelector("strong");
  const ready = Boolean(normalizeCopy(value));
  if (!step || !label) {
    return;
  }

  step.dataset.ready = ready ? "true" : "false";
  label.textContent = ready ? "Ready" : "Missing";
}

function syncCreateRouteCommand() {
  if (state.route !== "create") {
    return;
  }

  updateCommand(commandForRoute(currentPack(), filteredPacks().length, state.packs.filter(isReview).length));
}

function memoryNoteSaveState(pack, note) {
  if (!pack) {
    return {
      canSave: false,
      help: state.packs.length === 0
        ? "Where: Memory. Blocker: no work exists. Next action: create or reset work before adding memory."
        : "Where: Memory. Blocker: no work is selected. Next action: choose work before adding memory."
    };
  }

  if (!String(note || "").trim()) {
    return {
      canSave: false,
      help: `Where: Memory. Blocker: ${blockerTextForPack(pack)}. Next action: type a note for ${workTitle(pack)}.`
    };
  }

  return {
    canSave: true,
    help: `Where: Memory. Blocker: ${blockerTextForPack(pack)}. Next action: add memory note to ${workTitle(pack)}.`
  };
}

function memoryRouteStatus(pack) {
  if (pack) {
    return `Where: Memory / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Next action: type a note for ${workTitle(pack)}.`;
  }

  return state.packs.length === 0
    ? "Where: Memory. Blocker: no work exists. Next action: create or reset work before adding memory."
    : "Where: Memory. Blocker: no work is selected. Next action: choose work before adding memory.";
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
  syncMemoryRouteCommand(pack);
}

function syncMemoryRouteCommand(pack) {
  if (state.route !== "memory") {
    return;
  }

  updateCommand(commandForRoute(pack || currentPack(), filteredPacks().length, state.packs.filter(isReview).length));
}

function packDetailSaveState(pack) {
  if (!pack) {
    return {
      canSave: false,
      help: state.packs.length === 0
        ? "Where: Work path. Blocker: no work exists. Next action: create or reset work before saving."
        : "Where: Work path. Blocker: no work is selected. Next action: choose work before saving."
    };
  }

  const blockerIssue = blockerModeIssue();
  if (blockerIssue) {
    return {
      canSave: false,
      help: `Where: Work path. Blocker: ${blockerIssue}. Next action: ${blockerModeFixNext(blockerIssue)}.`
    };
  }

  if (ownerBlockerNeedsClear()) {
    return {
      canSave: false,
      help: "Where: Work path. Blocker: owner is filled but Blocker is still set. Next action: Set Blocker: None."
    };
  }

  const changed = packForwardPathFormSignature(pack) !== packForwardPathSignature(pack);
  if (!changed) {
    return {
      canSave: false,
      help: "Where: Work path. Blocker: no changes to save. Next action: edit a field first."
    };
  }

  const pending = pendingPackFromForwardPathForm(pack);
  return {
    canSave: true,
    help: `Where: Work path. Blocker: ${blockerTextForPack(pending)}. Next action: save work path for ${workTitle(pending)}.`
  };
}

function packDetailSaveNote(stateForSave) {
  const help = normalizeCopy(stateForSave?.help);
  if (!help) {
    return "";
  }

  if (stateForSave.canSave) {
    return "Unsaved work-path changes. Next action saves them first.";
  }

  if (help.includes("no changes to save")) {
    return "";
  }

  if (help.includes("owner is filled but Blocker is still set")) {
    return "Owner is filled. Next action saves Blocker: None.";
  }

  return help.replace(/^Where: Work path\. /, "");
}

function bindPackDetailValidation(pack) {
  ["edit-title", "edit-blocker", "edit-owner", "edit-due", "edit-next", "edit-done-when", "edit-purpose"].forEach((id) => {
    const input = el(id);
    input?.addEventListener("input", () => {
      if (id === "edit-owner") {
        syncOwnerBlockerResolutionPreview();
      }
      syncPackDetailValidation(pack);
    });
    input?.addEventListener("change", () => {
      if (id === "edit-owner") {
        syncOwnerBlockerResolutionPreview();
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
  document.querySelectorAll("[data-blocker-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      setBlockerMode(true);
      const input = el("edit-blocker");
      if (input) {
        input.value = button.dataset.blockerPreset || "";
      }
      const blockedBySelect = el("edit-blocked-by");
      if (blockedBySelect) {
        blockedBySelect.value = "";
      }
      syncPackDetailValidation(pack);
      input?.focus();
    });
  });
  el("edit-blocked-by")?.addEventListener("change", () => {
    const target = findPack(valueOf("edit-blocked-by"));
    const input = el("edit-blocker");
    if (target && input) {
      setBlockerMode(true);
      input.value = blockedByBlockerText(target);
    }
    syncPackDetailValidation(pack);
  });
  el("edit-blocker")?.addEventListener("input", () => {
    const blockedBySelect = el("edit-blocked-by");
    if (!blockedBySelect || !blockedBySelect.value) {
      return;
    }
    const target = findPack(blockedBySelect.value);
    if (!target || normalizeCopy(el("edit-blocker")?.value) !== blockedByBlockerText(target)) {
      blockedBySelect.value = "";
    }
  });
  document.querySelector("[data-clear-owner-blocker]")?.addEventListener("click", () => {
    runRouteAction("clear-owner-blocker", pack.id);
  });
  syncPackDetailValidation(pack);
}

function setBlockerMode(hasBlocker) {
  const clear = el("edit-blocker-clear");
  const set = el("edit-blocker-set");
  const input = el("edit-blocker");
  const next = el("edit-next");
  const help = document.querySelector("[data-blocker-help]");
  const reason = document.querySelector("[data-blocker-reason]");
  const clearLabel = document.querySelector('[data-blocker-mode-label="clear"]');
  const setLabel = document.querySelector('[data-blocker-mode-label="set"]');
  if (clear) clear.checked = !hasBlocker;
  if (set) set.checked = hasBlocker;
  clearLabel?.classList.toggle("active", !hasBlocker);
  setLabel?.classList.toggle("active", hasBlocker);
  if (!hasBlocker && next && isBlockerReviewAction(next.value)) {
    // Keep the current next action — don't force "Open" after done/unblock
  }
  if (input) {
    input.disabled = !hasBlocker;
    syncDisabledReasonMetadata(input, !hasBlocker, blockerInputDisabledReason());
    if (hasBlocker && !normalizeCopy(input.value)) {
      input.value = "needs review";
    }
    if (hasBlocker) {
      input.focus();
    }
  }
  if (!hasBlocker) {
    const blockedBySelect = el("edit-blocked-by");
    if (blockedBySelect) {
      blockedBySelect.value = "";
    }
  }
  if (reason) {
    reason.hidden = !hasBlocker;
  }
  syncBlockerFieldHelp();
  focusBlockingSupportFieldIfNeeded();
}

function isBlockerReviewAction(value) {
  const normalized = normalizeCopy(value).toLowerCase();
  return normalized === "review"
    || normalized === "review work"
    || normalized === "review blocker"
    || normalized === "unblock";
}

function syncOwnerBlockerResolutionPreview() {
  syncBlockerFieldHelp();
}

function ownerFixClearsBlocker(blocker, owner) {
  return normalizeCopy(blocker).toLowerCase().includes("owner") && !isMissingOwnerValue(owner);
}

function ownerBlockerNeedsClear() {
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  return selected?.value === "set" && ownerFixClearsBlocker(el("edit-blocker")?.value, valueOf("edit-owner"));
}

function isMissingOwnerValue(owner) {
  const normalizedOwner = normalizeCopy(owner).toLowerCase();
  return !normalizedOwner || normalizedOwner === "unassigned" || normalizedOwner === "no owner";
}

function syncPackDetailValidation(pack) {
  const help = el("pack-save-help");
  if (!help) {
    return;
  }

  const stateForSave = packDetailSaveState(pack);
  syncBlockerFieldHelp();
  syncPackDetailForwardPanel(pack);
  const saveNote = packDetailSaveNote(stateForSave);
  help.textContent = saveNote;
  help.hidden = !saveNote;
}

function blockerModeIssue() {
  const field = document.querySelector("[data-blocker-field]");
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const blocker = normalizeCopy(el("edit-blocker")?.value).toLowerCase();
  if (!field) {
    return "";
  }

  if (selected?.value === "set" && isUnblockedBlockerValue(blocker)) {
    return "Blocked needs a reason; choose None to store Blocker: None";
  }

  if (selected?.value === "clear" && blocker.includes("owner") && isMissingOwnerValue(valueOf("edit-owner"))) {
    return "Owner is still unassigned; fill Owner before clearing this blocker";
  }

  return "";
}

function blockerModeFixNext(issue) {
  return normalizeCopy(issue).toLowerCase().includes("owner")
    ? "fill owner"
    : "choose None or enter a blocker reason";
}

function blockerModeFocusKind(issue) {
  return normalizeCopy(issue).toLowerCase().includes("owner")
    ? "support-owner"
    : "pack-blocker";
}

function focusBlockingSupportFieldIfNeeded() {
  const issue = blockerModeIssue();
  if (!issue || blockerModeFocusKind(issue) !== "support-owner") {
    return;
  }

  requestAnimationFrame(() => focusCommandTarget("support-owner", currentPack()?.id || ""));
}

function syncBlockerFieldHelp() {
  const field = document.querySelector("[data-blocker-field]");
  const input = el("edit-blocker");
  const help = document.querySelector("[data-blocker-help]");
  const resolution = document.querySelector("[data-blocker-resolution]");
  const resolutionCopy = document.querySelector("[data-blocker-resolution-copy]");
  const resolutionButton = document.querySelector("[data-clear-owner-blocker]");
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const hasBlocker = selected?.value === "set";
  const issue = blockerModeIssue();
  const ownerResolvedBlocker = hasBlocker && ownerFixClearsBlocker(input?.value, valueOf("edit-owner"));
  syncBlockerPresetButtons();
  field?.classList.toggle("invalid", Boolean(issue));
  if (input) {
    if (issue) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
  if (resolution) {
    resolution.hidden = !ownerResolvedBlocker;
  }
  if (resolutionCopy) {
    resolutionCopy.textContent = ownerResolvedBlocker ? ownerBlockerResolutionHelp() : "";
  }
  if (resolutionButton) {
    const disabledReason = ownerBlockerResolutionDisabledReason(input?.value, valueOf("edit-owner"));
    resolutionButton.hidden = !ownerResolvedBlocker;
    resolutionButton.disabled = !ownerResolvedBlocker;
    syncDisabledReasonMetadata(resolutionButton, !ownerResolvedBlocker, disabledReason);
    if (ownerResolvedBlocker) {
      const copy = helpCopy("Set Blocker: None saves this blocker fix.", DEMO_COPY_LIMITS.commandFlowHelp);
      resolutionButton.title = copy;
      resolutionButton.setAttribute("aria-label", copy);
    } else {
      resolutionButton.removeAttribute("aria-label");
    }
  }
  if (help) {
    const clearHelp = ownerResolvedBlocker
      ? "Owner filled; Set Blocker: None saves this fix."
      : "None stores Blocker: None automatically; no typing required.";
    help.textContent = issue || (hasBlocker && !ownerResolvedBlocker ? "Blocked pauses Next action until this reason clears." : clearHelp);
  }
  syncOwnerBlockerGuide();
}

function syncOwnerBlockerGuide() {
  const guide = document.querySelector("[data-owner-blocker-guide]");
  if (!guide) {
    return;
  }

  const ownerFilled = !isMissingOwnerValue(valueOf("edit-owner"));
  const selected = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const blockerClear = selected?.value === "clear";
  const summary = ownerBlockerGuideSummary(ownerFilled, blockerClear);
  guide.dataset.state = ownerBlockerGuideState(ownerFilled, blockerClear);
  guide.setAttribute("aria-label", summary);
  const summaryElement = guide.querySelector("[data-owner-blocker-summary]");
  if (summaryElement) {
    summaryElement.textContent = summary;
  }

  syncOwnerBlockerGuideStep("owner", ownerFilled ? "done" : "active", ownerFilled ? "Owner filled." : "Owner is unassigned.");
  syncOwnerBlockerGuideStep(
    "clear",
    ownerFilled ? (blockerClear ? "done" : "active") : "waiting",
    blockerClear ? "Blocker is None. Save work path is next." : (ownerFilled ? "Next: Set Blocker: None." : "Wait until Owner is filled.")
  );
}

function syncOwnerBlockerGuideStep(id, stateName, copy) {
  const step = document.querySelector(`[data-owner-step="${id}"]`);
  const copyElement = document.querySelector(`[data-owner-step-copy="${id}"]`);
  if (!step) {
    return;
  }

  step.classList.toggle("active", stateName === "active");
  step.classList.toggle("done", stateName === "done");
  step.classList.toggle("waiting", stateName === "waiting");
  if (copyElement) {
    copyElement.textContent = copy;
  }
}

function syncBlockerPresetButtons() {
  const current = normalizeCopy(el("edit-blocker")?.value).toLowerCase();
  document.querySelectorAll("[data-blocker-preset]").forEach((button) => {
    const active = normalizeCopy(button.dataset.blockerPreset).toLowerCase() === current;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function ownerBlockerResolutionHelp() {
  return "Owner filled. Set Blocker: None saves this fix.";
}

function ownerBlockerResolutionDisabledReason(blocker, owner) {
  if (!normalizeCopy(blocker).toLowerCase().includes("owner")) {
    return "Where: Blocker. Blocker: not owner-related. Next action: choose None or edit the blocker reason.";
  }

  if (isMissingOwnerValue(owner)) {
    return "Where: Blocker. Blocker: owner is still missing. Next action: fill Owner before setting Blocker: None.";
  }

  return "Where: Blocker. Blocker: no owner blocker to clear. Next action: choose Blocked with an owner blocker first.";
}

function syncPackDetailForwardPanel(pack) {
  if (!pack) {
    return;
  }

  const pending = pendingPackFromForwardPathForm(pack);
  const actionCommand = resolvePrimaryCommandForPack(pending);
  const command = commandForRoute(pending, filteredPacks().length, state.packs.filter(isReview).length);
  const workflow = workflowStateForPack(pending, actionCommand);
  const issue = blockerModeIssue();
  const panel = document.querySelector('[data-forward-motion="pack-detail"]');
  const head = panel?.querySelector(".demo-forward-head strong");
  const stateLabel = panel?.querySelector("[data-workflow-state-preview]");
  const stateHelp = panel?.querySelector("[data-workflow-state-help]");
  setWorkDetailSubtitle(workDetailSubtitle(pending, actionCommand));
  syncSelectedWorkTriad(panel, pending, actionCommand);
  if (stateLabel) {
    stateLabel.textContent = workflow.label;
    stateLabel.title = workflow.help;
  }
  if (stateHelp) {
    stateHelp.textContent = workflow.help;
  }
  syncWorkPathStrip(panel, pending, actionCommand, workflow);
  if (issue) {
    if (head) head.textContent = blockerModeFixNext(issue);
    setWorkDetailSubtitle(`Fix ${issue}. Next action: ${blockerModeFixNext(issue)}.`);
    syncSelectedWorkTriad(panel, pending, { label: blockerModeFixNext(issue) });
    if (stateLabel) stateLabel.textContent = "Fix blocker";
    if (stateHelp) stateHelp.textContent = issue;
    const invalidCommand = commandForRoute(pending, filteredPacks().length, state.packs.filter(isReview).length);
    invalidCommand.blocker = issue;
    invalidCommand.next = blockerModeFixNext(issue);
    invalidCommand.action = "fix-blocker-mode";
    invalidCommand.targetPackId = pending.id;
    invalidCommand.stateText = "Fix blocker";
    invalidCommand.flowHint = normalizeCopy(issue).toLowerCase().includes("owner")
      ? "Flow: fill owner, then set Blocker: None."
      : "Flow: fix blocker state, then save.";
    updateCommand(invalidCommand);
    syncPackPrimaryAction(invalidCommand);
    return;
  }

  if (ownerBlockerNeedsClear()) {
    if (head) head.textContent = "Set Blocker: None";
    setWorkDetailSubtitle("Owner filled. Next action: Set Blocker: None.");
    syncSelectedWorkTriad(panel, pending, { label: "Set Blocker: None" });
    if (stateLabel) stateLabel.textContent = "Fix blocker";
    if (stateHelp) stateHelp.textContent = "Owner is filled; Set Blocker: None saves this blocker fix.";
    command.next = "Set Blocker: None";
    command.action = "clear-owner-blocker";
    command.targetPackId = pending.id;
    command.stateText = "Fix blocker";
    command.stateHelp = "Owner is filled; Set Blocker: None saves this blocker fix.";
    command.flowHint = "Flow: set Blocker: None.";
    command.runNote = "Sets Blocker to None and saves this blocker fix.";
    updateCommand(command);
    syncPackPrimaryAction(command);
    return;
  }

  const hasPendingChanges = packForwardPathFormSignature(pack) !== packForwardPathSignature(pack);
  if (hasPendingChanges) {
    const nextAfterSave = command.next;
    const saveAction = "Save work path";
    command.next = saveAction;
    command.action = "save-work-path";
    command.targetPackId = pending.id;
    const editedWorkflow = { ...workflow, label: "Edited", help: "Unsaved work path changes." };
    command.stateText = "Edited";
    command.stateHelp = `Unsaved work path changes. Next action saves them first. After save, the button shows ${nextAfterSave}.`;
    command.flowHint = `Flow: save work path, then ${nextAfterSave}.`;
    command.runNote = `Saves pending work path changes. After save, ${nextAfterSave} is visible.`;
    if (head) head.textContent = saveAction;
    setWorkDetailSubtitle(`Unsaved changes. Next action: ${saveAction}.`);
    syncSelectedWorkTriad(panel, pending, { label: saveAction });
    syncWorkPathStrip(panel, pending, { label: saveAction }, editedWorkflow);
  } else if (head) {
    head.textContent = actionCommand.label;
  }

  updateCommand(command);
  syncPackPrimaryAction(command);
}

function syncWorkPathStrip(panel, pack, command = resolvePrimaryCommandForPack(pack), workflow = workflowStateForPack(pack, command)) {
  const strip = panel?.querySelector('[data-work-path="selected-work"]');
  if (!strip || !pack) {
    return;
  }

  const label = command?.label || command?.next || "Open";
  const current = workflow?.path || workPathStage(pack, { label });
  const stateLabel = workflow?.label || "Ready";
  const pathCopy = copySurface(
    `${stateLabel}. Next: ${label}.`,
    DEMO_COPY_LIMITS.commandFieldVisible,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
  const aria = helpCopy(
    `Work state: ${stateLabel}. Work path: ${current}. Next action: ${label}.`,
    DEMO_COPY_LIMITS.commandFlowHelp
  );
  strip.setAttribute("aria-label", aria);
  strip.innerHTML = `
    <span class="section-label">Work path</span>
    <div class="demo-work-path-steps">
      ${renderWorkPathStepTrail(workPathSteps().map((step) => ({ ...step, active: step.id === current })))}
    </div>
    <strong${copySurfaceAttributes("Work path", pathCopy)}>${escapeHtml(pathCopy.visible)}</strong>`;
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

async function createSamplePack() {
  const values = createFormValues();
  const stateForSave = createSaveState(values);
  if (!stateForSave.canSave) {
    state.status = stateForSave.help;
    syncCreateValidation();
    return;
  }

  try {
    const backendResult = await createBackendPack(values);
    if (backendResult?.pack?.id) {
      go("pack", backendResult.pack.id);
      return;
    }
  } catch (error) {
    console.error("Projects demo backend create failed.", error);
    state.status = `Where: Backend create. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
    render();
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
    purpose: values.purpose || "Work created in the static demo.",
    doneWhen: "Result is described.",
    sources: ["browser-state"],
    memory: [],
    activity: [persistenceCreatedActivity()]
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
    return { status: "draft", blocker: "missing next action" };
  }

  if (isMissingOwnerValue(owner)) {
    return { status: "draft", blocker: "missing owner" };
  }

  return { status: "active", blocker: DEMO_BLOCKER_NONE };
}

function uniquePackId(baseId) {
  const root = baseId || "new-work";
  let id = root;
  let suffix = 2;
  while (findPack(id)) {
    id = `${root}-${suffix}`;
    suffix += 1;
  }

  return id;
}

async function savePackForwardPathFromForm(pack) {
  const before = packForwardPathSnapshot(pack);
  const values = packForwardPathFormValues(pack);
  try {
    const backendResult = await saveBackendPackPath(pack, values);
    if (backendResult) {
      return backendResult.changed;
    }
  } catch (error) {
    console.error("Projects demo backend work path action failed.", error);
    state.status = `Where: Backend work path. Blocker: ${error.message || "API failed"}. Next action: retry or refresh.`;
    return false;
  }

  const changed = applyPackForwardPathFormValues(pack);
  const after = packForwardPathSnapshot(pack);
  setSaveConfirmation(pack, {
    changed,
    summary: forwardPathChangeSummary(before, after)
  });
  return changed;
}

function applyPackForwardPathFormValues(pack) {
  const before = packForwardPathSignature(pack);
  const statusBefore = normalizeCopy(pack.status) || "active";
  const values = packForwardPathFormValues(pack);
  pack.title = values.title || pack.title;
  pack.status = values.status || pack.status;
  pack.blocker = values.blocker;
  pack.blockedBy = values.blockedBy;
  pack.owner = values.owner || pack.owner;
  pack.due = values.due;
  pack.next = values.next || pack.next;
  pack.doneWhen = values.doneWhen || pack.doneWhen;
  pack.purpose = values.purpose || pack.purpose;
  pack.blocker = pack.status === "done" ? DEMO_BLOCKER_NONE : pack.blocker;
  if (pack.status === "done") {
    pack.blockedBy = "";
  }
  if (pack.status === "blocked" && isUnblockedBlockerValue(pack.blocker)) {
    pack.status = "active";
  }
  if (statusBefore !== "done" && pack.status === "done") {
    unblockPacksBlockedBy(pack);
  }
  const changed = packForwardPathSignature(pack) !== before;
  if (changed) {
    addPackActivity(pack, "Work path changed.");
  }
  return changed;
}

function packForwardPathSnapshot(pack) {
  return {
    title: normalizeCopy(pack?.title),
    status: normalizeCopy(pack?.status),
    blocker: normalizeCopy(pack?.blocker),
    blockedBy: normalizeCopy(pack?.blockedBy),
    owner: normalizeCopy(pack?.owner),
    due: normalizeCopy(pack?.due),
    next: normalizeCopy(pack?.next),
    doneWhen: normalizeCopy(pack?.doneWhen),
    purpose: normalizeCopy(pack?.purpose)
  };
}

function forwardPathChangeSummary(before, after) {
  const changes = FORWARD_PATH_CHANGE_FIELDS
    .map(([field, label]) => {
      const oldValue = normalizeCopy(before?.[field]);
      const newValue = normalizeCopy(after?.[field]);
      if (oldValue === newValue) {
        return "";
      }

      return `${label} to ${sentenceValue(newValue || "blank")}`;
    })
    .filter(Boolean);

  if (changes.length === 0) {
    return "Edit a work path field before saving";
  }

  const visible = changes.slice(0, 3).join("; ");
  const remaining = changes.length - 3;
  return remaining > 0
    ? `Changed ${visible}; ${remaining} more`
    : `Changed ${visible}`;
}

function packForwardPathSignature(pack) {
  return JSON.stringify(packForwardPathSnapshot(pack));
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
  const currentStatus = pack.status || "";
  const owner = fieldValue("edit-owner", pack.owner) || pack.owner || "";
  const requestedNext = fieldValue("edit-next", pack.next) || pack.next || "";
  const selectedBlockerMode = document.querySelector('input[name="edit-blocker-mode"]:checked');
  const blockerMode = selectedBlockerMode
    ? (selectedBlockerMode.value === "set" ? "set" : "clear")
    : (isUnblockedBlockerValue(pack.blocker) ? "clear" : "set");
  const blockedBySelect = el("edit-blocked-by");
  const requestedBlockedBy = blockedBySelect ? normalizeCopy(valueOf("edit-blocked-by")) : normalizeCopy(pack.blockedBy);
  const blockedByTarget = blockerMode === "set" && currentStatus !== "done" && requestedBlockedBy
    ? findPack(requestedBlockedBy)
    : null;
  const blockedBy = blockedByTarget ? blockedByTarget.id : "";
  const rawBlocker = blockerMode === "set"
    ? (blockedByTarget
      ? blockedByBlockerText(blockedByTarget)
      : normalizeCopy(blockerInput ? blockerInput.value : pack.blocker) || "needs review")
    : DEMO_BLOCKER_NONE;
  const blocker = currentStatus === "done" ? DEMO_BLOCKER_NONE : rawBlocker;
  const status = forwardPathStatusForBlocker(currentStatus, blocker, requestedNext);

  return {
    title: fieldValue("edit-title", pack.title) || pack.title || "",
    status,
    blocker,
    blockedBy,
    owner,
    due: fieldValue("edit-due", pack.due),
    next: requestedNext,
    doneWhen: fieldValue("edit-done-when", pack.doneWhen) || pack.doneWhen || "",
    purpose: fieldValue("edit-purpose", pack.purpose) || pack.purpose || ""
  };
}

function forwardPathStatusForBlocker(status, blocker, next = "") {
  const normalizedStatus = normalizeCopy(status) || "active";
  if (normalizedStatus === "done") {
    return "done";
  }
  if (isPlaceholderNext(next)) {
    return "draft";
  }
  if (!isUnblockedBlockerValue(blocker)) {
    return "blocked";
  }
  return "active";
}

function blockedByBlockerText(targetPack) {
  return normalizeCopy(`waiting on ${workTitle(targetPack)}`).slice(0, 200);
}

function createsBlockedByCycle(packs, packId, targetId) {
  let currentId = targetId;
  for (let hops = 0; hops < packs.length && currentId; hops++) {
    if (currentId === packId) {
      return true;
    }
    currentId = packs.find((pack) => pack.id === currentId)?.blockedBy || "";
  }
  return false;
}

function clearDanglingBlockedBy(packs) {
  if (!Array.isArray(packs)) {
    return packs;
  }
  const ids = new Set(packs.map((pack) => pack?.id));
  for (const pack of packs) {
    if (pack && pack.blockedBy && (pack.blockedBy === pack.id || !ids.has(pack.blockedBy))) {
      pack.blockedBy = "";
    }
  }
  return packs;
}

function unblockPacksBlockedBy(finishedPack) {
  const unblocked = [];
  for (const pack of state.packs) {
    if (pack.id !== finishedPack.id && pack.blockedBy === finishedPack.id) {
      pack.blockedBy = "";
      pack.blocker = DEMO_BLOCKER_NONE;
      pack.status = forwardPathStatusForBlocker(pack.status, DEMO_BLOCKER_NONE, pack.next);
      addPackActivity(pack, `Unblocked: ${workTitle(finishedPack)} finished with proof.`);
      unblocked.push(pack);
    }
  }
  return unblocked;
}

function unblockedReceiptSentence(count) {
  if (!count) {
    return "";
  }
  return `Unblocked ${count} work item${count === 1 ? "" : "s"}.`;
}

function blockedByChoices(pack) {
  return state.packs.filter((candidate) => candidate.id !== pack.id
    && candidate.status !== "done"
    && !createsBlockedByCycle(state.packs, pack.id, candidate.id));
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

function selectedFirstPacks(packs) {
  const selectedId = state.selectedId;
  if (!selectedId || !Array.isArray(packs) || packs.length < 2) {
    return packs;
  }

  const selectedIndex = packs.findIndex((pack) => pack.id === selectedId);
  if (selectedIndex <= 0) {
    return packs;
  }

  const selected = packs[selectedIndex];
  return [selected, ...packs.slice(0, selectedIndex), ...packs.slice(selectedIndex + 1)];
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
  return !value || value === "choose action" || value === "choose next action" || value === "set next action" || value === "set button runs next" || value === "set next";
}

function editableNextActionValue(value) {
  return isPlaceholderNext(value) ? "" : normalizeCopy(value);
}

function hasBlocker(pack) {
  return blockerStateForPack(pack).hasBlocker;
}

function isUnblockedBlockerValue(value) {
  return normalizeStoredBlocker(value) === DEMO_BLOCKER_NONE;
}

function normalizeStoredBlocker(value) {
  const blocker = normalizeCopy(value);
  return blocker && blocker.toLowerCase() !== DEMO_BLOCKER_NONE
    ? blocker
    : DEMO_BLOCKER_NONE;
}

function blockerDisplayValue(value) {
  const blocker = normalizeStoredBlocker(value);
  return blocker === DEMO_BLOCKER_NONE ? DEMO_BLOCKER_NONE_LABEL : blocker;
}

function blockerStateForPack(pack) {
  if (!pack) {
    return {
      hasBlocker: false,
      mode: "none",
      storage: "",
      label: "choose work",
      reason: ""
    };
  }

  const storage = normalizeStoredBlocker(pack.blocker);
  const statusBlocked = normalizeCopy(pack.status).toLowerCase() === "blocked";
  const hasStoredBlocker = storage !== DEMO_BLOCKER_NONE;
  const reason = hasStoredBlocker ? storage : (statusBlocked ? "blocked" : "");

  return {
    hasBlocker: Boolean(reason),
    mode: reason ? "set" : "clear",
    storage,
    label: reason || DEMO_BLOCKER_NONE_LABEL,
    reason
  };
}

function blockerTextForPack(pack) {
  if (!pack) {
    return "choose work";
  }

  const blockerState = blockerStateForPack(pack);
  if (blockerState.reason) {
    return blockerState.reason;
  }

  if (isMissingNextAction(pack)) {
    return "missing next action";
  }

  return blockerState.label;
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

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function dueDateMeta(pack) {
  const date = dateFieldValue(pack?.due);
  return date ? `<time datetime="${date}">${dueDateLabel(date)}</time>` : "<span>No due date</span>";
}

function dueDateLabel(value) {
  const [year, month, day] = dateFieldValue(value).split("-").map(Number);
  return year ? `Due ${MONTHS[month - 1]} ${day}, ${year}` : "";
}

function profile() {
  return copyProfiles[state.copyProfile] || copyProfiles.general;
}

function workNoun(count = 1) {
  const current = profile();
  return count === 1 ? (current.workOne || current.work) : (current.workMany || `${current.work}s`);
}

function workNounTitle(count = 1) {
  return capitalize(workNoun(count));
}

function workLabelTitle() {
  return capitalize(profile().work);
}

function metricCard(label, value, note) {
  return `<section class="demo-metric">
    <span class="demo-summary-label">${escapeHtml(label)}</span>
    <strong class="demo-summary-value">${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
  </section>`;
}

function navButton(route, label, className = "btn") {
  const reason = routeButtonReason(route, label);
  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<button class="${escapeAttribute(className)}" type="button" data-go="${escapeAttribute(route)}" data-pack="${escapeAttribute(routeLinkPackId(route))}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(label)}</button>`;
}

function homeSecondaryAction(route, label, reason) {
  return `<div class="demo-home-action">
    ${navButton(route, label)}
    <small>${escapeHtml(reason)}</small>
  </div>`;
}

function routeButtonReason(route, label) {
  const reasons = {
    home: "Return to the simplified demo start.",
    work: `Open the ${workNoun(2)} list to choose one ${workNoun(1)}.`,
    review: `Open review ${profile().work} and resolve the next blocker.`,
    next: "Open Next action setup for review work.",
    create: `Create ${profile().work} with title, owner, and Next action.`,
    memory: `Open Memory to add recall notes to selected ${profile().work}.`,
    settings: "Open Settings for profile, scenario, theme, reset, and backups."
  };
  return reasons[route] || `Open ${label}.`;
}

function factBlock(label, value) {
  const copy = copySurface(value || DEMO_BLOCKER_NONE_LABEL, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<div class="demo-fact">
    <span>${escapeHtml(label)}</span>
    <strong${copySurfaceAttributes(label, copy)}>${escapeHtml(copy.visible)}</strong>
  </div>`;
}

function factLine(label, value) {
  const copy = copySurface(value || DEMO_BLOCKER_NONE_LABEL, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<div class="demo-command-line" data-command-field="${escapeAttribute(fieldKey(label))}">
    <span>${escapeHtml(label)}</span>
    <strong${copySurfaceAttributes(label, copy)}>${escapeHtml(copy.visible)}</strong>
  </div>`;
}

function selectedWorkTriad(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `<div class="demo-command-lines compact demo-forward-triad" data-selected-work-triad>
    ${selectedWorkTriadLine("Where", workTitle(pack), "where")}
    ${selectedWorkTriadLine("Blocker", blockerTextForPack(pack), "blocker")}
    ${selectedWorkTriadLine("Next action", command.label, "next")}
  </div>`;
}

function selectedWorkTriadLine(label, value, key) {
  const copy = copySurface(value || DEMO_BLOCKER_NONE_LABEL, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  const isWhere = key === "where";
  const labelCopy = isWhere ? "Where / selected work" : label;
  const className = isWhere ? "demo-command-line selected-work-where" : "demo-command-line";
  return `<div class="${className}" data-selected-work-field="${escapeAttribute(key)}" data-command-field="${escapeAttribute(fieldKey(label))}" data-selected-work-title="${isWhere ? "true" : "false"}">
    <span>${escapeHtml(labelCopy)}</span>
    <strong${copySurfaceAttributes(label, copy)}>${escapeHtml(copy.visible)}</strong>
  </div>`;
}

function syncSelectedWorkTriad(panel, pack, command = resolvePrimaryCommandForPack(pack)) {
  const fields = {
    where: workTitle(pack),
    blocker: blockerTextForPack(pack),
    next: command.label
  };
  Object.entries(fields).forEach(([key, value]) => {
    const field = panel?.querySelector(`[data-selected-work-field="${key}"] strong`);
    const label = key === "next" ? "Next action" : capitalize(key);
    setCopySurface(field, value, label, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  });
}

function packGuidanceLine(pack, command, workflow) {
  if (!pack) return "";
  const title = workTitle(pack);
  if (pack.status === "done") {
    return `<p class="demo-pack-guidance">${escapeHtml(title)} is marked done — proof saved.</p>`;
  }
  if (isMissingNextAction(pack)) {
    return `<p class="demo-pack-guidance">👉 ${escapeHtml(title)} needs a next action. Pick what the button should do below.</p>`;
  }
  if (hasBlocker(pack)) {
    return `<p class="demo-pack-guidance">⛔ ${escapeHtml(title)} is blocked by "${blockerTextForPack(pack)}". Clear the blocker to continue.</p>`;
  }
  return `<p class="demo-pack-guidance">✅ ${escapeHtml(title)} is ready. Next: ${escapeHtml(commandActionDisplayLabel(command.label) || command.label || "Open work path")}.</p>`;
}

function workDetailSubtitle(pack, command = resolvePrimaryCommandForPack(pack)) {
  const blocker = blockerTextForPack(pack);
  const due = dueDateLabel(pack.due);
  const duePrefix = due ? `${due}. ` : "";
  if (isMissingNextAction(pack)) {
    return `${duePrefix}Needs next action. Choose what the main button should do.`;
  }

  return hasBlocker(pack)
    ? `${duePrefix}Blocked by ${blocker}. Next action: ${command.label}.`
    : `${duePrefix}Ready. Next action: ${command.label}.`;
}

function setWorkDetailSubtitle(value) {
  const subtitle = document.querySelector(".demo-pack-subtitle");
  if (!subtitle) {
    return;
  }

  const copy = copySurface(value, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  subtitle.textContent = copy.visible;
  subtitle.title = copy.help;
  subtitle.setAttribute("aria-label", copy.help);
  subtitle.dataset.copySurface = fieldKey("Work path summary");
  subtitle.dataset.copyVisibleLimit = String(copy.visibleLimit);
  subtitle.dataset.copyHelpLimit = String(copy.helpLimit);
  subtitle.dataset.copyTruncated = String(copy.truncated);
}

function ownerSupportNeededForPack(pack) {
  return normalizeCopy(pack?.blocker).toLowerCase().includes("owner") && isMissingOwnerValue(pack?.owner);
}

function supportDetailsSummary(ownerIsInline, pack) {
  const due = dueDateLabel(pack?.due);
  return `${due ? `${due}. ` : ""}Open for optional ${ownerIsInline ? "title" : "owner"}, due date, and purpose.`;
}

function relevantMemoryStrip(pack) {
  const latest = latestRelevantMemory(pack);
  const stateClass = latest ? "has-memory" : "is-empty";
  const visible = latest
    ? visibleCopy(latest, DEMO_COPY_LIMITS.memoryVisible)
    : "No memory yet";
  const help = latest
    ? `Relevant Memory: ${sentenceValue(latest)}. ${memoryStripNextLine(pack)}.`
    : `Relevant Memory: No memory yet. Add a memory note from the Memory screen. ${memoryStripNextLine(pack)}.`;
  const actionLabel = memoryStripActionLabel(pack, latest);
  const actionHelp = memoryStripActionHelp(pack, latest);

  return `<div class="demo-memory-strip ${escapeAttribute(stateClass)}" data-memory-strip="selected-work" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      <small class="demo-memory-next">${escapeHtml(memoryStripNextLine(pack))}</small>
      ${latest ? "" : `<small>Add a memory note here or from the Memory screen.</small>`}
    </div>
    <button class="btn btn-sm demo-memory-action" type="button" data-action="memory" data-pack="${escapeAttribute(pack?.id || "")}"${controlLabelAttributes(actionHelp)}>${escapeHtml(actionLabel)}</button>
  </div>`;
}

function relevantMemoryCardStrip(pack) {
  if (!pack || pack.id !== state.selectedId) {
    return "";
  }

  const latest = latestRelevantMemory(pack);
  const stateClass = latest ? "has-memory" : "is-empty";
  const visible = latest
    ? visibleCopy(latest, DEMO_COPY_LIMITS.memoryVisible)
    : "No memory yet";
  const help = latest
    ? `Relevant Memory: ${sentenceValue(latest)}. ${memoryStripNextLine(pack)}.`
    : `Relevant Memory: No memory yet. Add a memory note from the selected work path. ${memoryStripNextLine(pack)}.`;
  const actionLabel = memoryStripActionLabel(pack, latest);
  const actionHelp = memoryStripActionHelp(pack, latest);

  return `<div class="demo-memory-strip compact ${escapeAttribute(stateClass)}" data-memory-strip="selected-card" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      <small class="demo-memory-next">${escapeHtml(memoryStripNextLine(pack))}</small>
      ${latest ? "" : `<small>Open Memory or selected work to add recall.</small>`}
    </div>
    <button class="btn btn-sm demo-memory-action" type="button" data-action="memory" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(actionHelp)}>${escapeHtml(actionLabel)}</button>
  </div>`;
}

function memoryStripActionLabel(pack, latest = latestRelevantMemory(pack)) {
  if (!pack) {
    return "Choose work";
  }

  return latest ? "Open memory" : "Add memory";
}

function memoryStripNextLine(pack) {
  if (!pack) {
    return state.packs.length === 0
      ? "Next action: create or reset work"
      : "Next action: choose work";
  }

  return `Next action: ${resolvePrimaryCommandForPack(pack).label}`;
}

function memoryStripActionHelp(pack, latest = latestRelevantMemory(pack)) {
  if (!pack) {
    return state.packs.length === 0
      ? "Where: Relevant Memory. Blocker: no work exists. Next action: create or reset work before adding memory."
      : "Where: Relevant Memory. Blocker: no work is selected. Next action: choose work before adding memory.";
  }

  return latest
    ? `Where: Relevant Memory / ${workTitle(pack)}. Blocker: None. Next action: open saved memory for this work.`
    : `Where: Relevant Memory / ${workTitle(pack)}. Blocker: no saved memory note yet. Next action: add memory note.`;
}

function workPathStrip(pack, command = resolvePrimaryCommandForPack(pack)) {
  const workflow = workflowStateForPack(pack, command);
  const current = workflow.path;
  const steps = workPathSteps();
  const pathCopy = copySurface(
    `${workflow.label}. Next: ${command.label}.`,
    DEMO_COPY_LIMITS.commandFieldVisible,
    DEMO_COPY_LIMITS.commandFlowHelp
  );

  return `<div class="demo-work-path" data-work-path="selected-work" aria-label="${escapeAttribute(`Work state: ${workflow.label}. Work path: ${current}. Next action: ${command.label}.`)}">
    <span class="section-label">Work path ${helpTip("Draft → Review → Proof → Done. Each stage has a specific job: pick an action, clear blockers, provide evidence.")}</span>
    <div class="demo-work-path-steps">
      ${renderWorkPathStepTrail(steps.map((step) => ({ ...step, active: step.id === current })))}
    </div>
    <strong${copySurfaceAttributes("Work path", pathCopy)}>${escapeHtml(pathCopy.visible)}</strong>
  </div>`;
}

function renderWorkPathStepTrail(steps) {
  return steps.map((step, index) => {
    const current = Boolean(step.active);
    const separator = index > 0
      ? `<span class="demo-work-path-separator" aria-hidden="true">&gt;</span>`
      : "";
    const label = `${step.label}${current ? " current" : ""}. ${step.help}`;
    return `${separator}<span class="demo-work-path-step${current ? " active" : ""}" title="${escapeAttribute(step.help)}" aria-label="${escapeAttribute(label)}" aria-current="${current ? "step" : "false"}">${escapeHtml(step.label)}</span>`;
  }).join("");
}

function workPathSteps() {
  return [
    { id: "draft", label: "Draft", help: "Set the work path." },
    { id: "review", label: "Review", help: "Clear the blocker or use the Do next button." },
    { id: "proof", label: "Proof", help: "Use the Do next button and keep the proof target visible." },
    { id: "done", label: "Done", help: "Finish when proof is ready." }
  ];
}

function workPathStage(pack, command = resolvePrimaryCommandForPack(pack)) {
  return workflowStateForPack(pack, command).path;
}

function inputField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  const labelHtml = label.includes("<") ? label : escapeHtml(label);
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${labelHtml}</span>
    <input id="${escapeAttribute(id)}" type="text" value="${escapeAttribute(value || "")}"${fieldHelpAttributes(describedBy, help)}>
    ${fieldHelp(id, help)}
  </label>`;
}

function dateField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  const labelHtml = label.includes("<") ? label : escapeHtml(label);
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${labelHtml}</span>
    <input id="${escapeAttribute(id)}" type="date" value="${escapeAttribute(dateFieldValue(value))}"${fieldHelpAttributes(describedBy, help)}>
    ${fieldHelp(id, help)}
  </label>`;
}

function dateFieldValue(value) {
  const date = normalizeCopy(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : "";
}

function nextActionSelectField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  const labelHtml = label.includes("<") ? label : escapeHtml(label);
  return `<label class="demo-field demo-action-choice-field" for="${escapeAttribute(id)}">
    <span>${labelHtml}</span>
    <select id="${escapeAttribute(id)}" class="demo-search-input"${fieldHelpAttributes(describedBy, help)}>
      ${nextActionOptions(value).map((option) => `<option value="${escapeAttribute(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
    </select>
    ${fieldHelp(id, help)}
  </label>`;
}

function nextActionOptions(value) {
  const current = normalizedNextActionChoice(value);
  const options = current && !NEXT_ACTION_CHOICES.includes(current)
    ? [current, ...NEXT_ACTION_CHOICES]
    : [...NEXT_ACTION_CHOICES];

  return [
    { value: "", label: "Choose action (required)", selected: !current },
    ...options.map((option) => ({ value: option, label: option, selected: option === current }))
  ];
}

function normalizedNextActionChoice(value) {
  const current = normalizeCopy(value);
  return current.toLowerCase() === "done" ? "Finish with proof" : current;
}

function textField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  return `<label class="demo-field demo-field-wide" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <textarea id="${escapeAttribute(id)}" rows="4"${fieldHelpAttributes(describedBy, help)}>${escapeHtml(value || "")}</textarea>
    ${fieldHelp(id, help)}
  </label>`;
}

function fieldHelpAttributes(describedBy, help) {
  if (!help) {
    return "";
  }

  return ` aria-describedby="${escapeAttribute(describedBy)}" title="${escapeAttribute(help)}"`;
}

function fieldHelp(id, help) {
  if (!help) {
    return "";
  }

  return `<small id="${escapeAttribute(id)}-help" class="demo-field-help">${escapeHtml(help)}</small>`;
}

function disabledReasonAttributes(disabled, reason, describedById = "") {
  if (!disabled) {
    return "";
  }

  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  const describedBy = normalizeCopy(describedById);
  const describedByAttribute = describedBy
    ? ` aria-describedby="${escapeAttribute(describedBy)}"`
    : "";
  return ` disabled title="${escapeAttribute(copy)}" aria-description="${escapeAttribute(copy)}"${describedByAttribute} data-disabled-reason="${escapeAttribute(copy)}"`;
}

function syncDisabledReasonMetadata(control, disabled, reason) {
  if (!control) {
    return;
  }

  if (!disabled) {
    control.removeAttribute("title");
    control.removeAttribute("aria-description");
    delete control.dataset.disabledReason;
    return;
  }

  const copy = helpCopy(reason, DEMO_COPY_LIMITS.commandFlowHelp);
  control.title = copy;
  control.setAttribute("aria-description", copy);
  control.dataset.disabledReason = copy;
}

function controlHelpAttributes(disabled, reason, describedById) {
  if (disabled) {
    return disabledReasonAttributes(true, reason, describedById);
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
  return `<p class="demo-disabled-reason" role="note" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(`Disabled reason: ${help}`)}">Why disabled: ${escapeHtml(copy)}</p>`;
}

function activityPanel(pack) {
  return `<section class="demo-panel">
    <div class="demo-panel-head">
      <div>
        <span class="section-label">Activity</span>
        <h2>Activity record</h2>
      </div>
    </div>
    <div class="demo-list">${pack.activity.map((item) => `<div class="demo-note">${escapeHtml(item)}</div>`).join("")}</div>
  </section>`;
}

function bindScenarioCards() {
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", async () => {
      const scenario = DEMO_SCENARIO_BY_ID[button.dataset.scenario];
      if (!scenario) return;
      syncSearchParam("scenario", scenario.id);
      await applyScenario(scenario, { force: true, applyRoute: true });
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

function copyButton(controlId, label, className, help, describedById) {
  const receipt = clipboardReceiptFor(controlId);
  const stateClass = receipt
    ? receipt.kind === "success" ? " is-copied" : " is-blocked"
    : "";
  const visibleLabel = receipt
    ? receipt.kind === "success" ? "Copied - paste ready" : "Copy manually"
    : label;
  const stateHint = receipt
    ? receipt.kind === "success" ? "Clipboard updated" : "Browser blocked clipboard"
    : "";
  const content = receipt
    ? `<span class="demo-copy-button-label">${escapeHtml(visibleLabel)}</span><small>${escapeHtml(stateHint)}</small>`
    : escapeHtml(visibleLabel);
  return `<button id="${escapeAttribute(controlId)}" class="${escapeAttribute(`${className}${stateClass}`)}" type="button" data-copy-state="${escapeAttribute(receipt?.kind || "idle")}"${controlHelpAttributes(false, help, describedById)}>${content}</button>`;
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

  const success = receipt.kind === "success";
  const eyebrow = success ? "Clipboard ready" : "Manual copy needed";
  const targetLabel = receipt.targetLabel || clipboardTargetLabel(receipt.targetId);
  const stepOne = success ? "Copied" : "Blocked";
  const stepTwo = success ? "Preview opened" : `${targetLabel} visible`;
  const stepThree = success ? "Paste ready" : "Copy manually";
  const targetActionLabel = success ? "Select copied text" : "Select visible text";
  const confirmationTitle = success ? "Clipboard updated" : "Clipboard not updated";
  const confirmationDetail = success
    ? `${targetLabel} is ready to paste.`
    : `${targetLabel} is visible below for manual copy.`;
  const targetAction = receipt.targetId
    ? `<button class="btn btn-sm demo-clipboard-target-action" type="button" data-copy-target="${escapeAttribute(receipt.targetId)}">${escapeHtml(targetActionLabel)}</button>`
    : "";
  return `<div id="clipboard-notice-${escapeAttribute(controlId)}" class="demo-clipboard-notice ${escapeAttribute(receipt.kind)}" role="status" tabindex="-1">
    <div class="demo-clipboard-notice-head">
      <span>${escapeHtml(eyebrow)}</span>
      <strong>${escapeHtml(receipt.title)}</strong>
    </div>
    <div class="demo-clipboard-confirmation">
      <strong>${escapeHtml(confirmationTitle)}</strong>
      <span>${escapeHtml(confirmationDetail)}</span>
    </div>
    <div class="demo-clipboard-steps" aria-label="${escapeAttribute(eyebrow)}">
      <span class="demo-clipboard-step active">${escapeHtml(stepOne)}</span>
      <span class="demo-clipboard-step active">${escapeHtml(stepTwo)}</span>
      <span class="demo-clipboard-step${success ? " active" : ""}">${escapeHtml(stepThree)}</span>
    </div>
    <span class="demo-clipboard-detail">${escapeHtml(receipt.detail)}</span>
    <div class="demo-clipboard-next">
      <span>Next action</span>
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
  if(DEMO_API_BASE_URL)state.suppressNextSave=true;
  const success = kind === "success";
  const title = options.title || (success ? "Copied to clipboard" : "Clipboard blocked");
  const detail = options.detail || (success
    ? "The selected snapshot is on the clipboard."
    : "Browser clipboard access was blocked. Select the visible text and copy it manually.");
  const next = options.next || (success ? "Paste where needed" : "Copy visible text manually");
  const proof = options.proof || (success
    ? "Clipboard contains the copied text."
    : "The visible text remains available for manual selection.");
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
  const blocker = success ? DEMO_BLOCKER_NONE_LABEL : "browser blocked clipboard access";
  const next = receipt.next || (success ? "Paste where needed" : "Copy visible text manually");
  const proof = receipt.proof || (success
    ? "Clipboard contains the copied text."
    : "The visible text remains available for manual selection.");
  state.actionReceipt = {
    kind: "clipboard",
    tone: receipt.kind,
    summary: helpCopy(`${summary} Where: ${where}. Blocker: ${blocker}. Next action: ${next}. Proof target: ${proof}.`, DEMO_COPY_LIMITS.receiptHelp),
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

  const details = target.closest("details");
  if (details) {
    details.open = true;
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

function copyToClipboard(value, successMessage = clipboardStatus("Feedback", "paste issue context into issue"), options = {}) {
  const targetMatchesText = clipboardTargetMatchesValue(value, options.targetId);
  const receiptOptions = {
    ...options,
    targetId: targetMatchesText ? options.targetId : "",
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

function clipboardTargetLabel() {
  return "Copied text";
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
    target.className = "demo-clipboard-hidden-target";
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
  return `Where: ${where}. Blocker: None. Next action: ${next}.`;
}

function clipboardBlockedStatus() {
  return "Where: Clipboard. Blocker: browser blocked clipboard access. Next action: copy from the visible text area.";
}

function emptyState(text, help = "Use the nearby controls or reset demo data.", context = emptyStateContext()) {
  const label = `Empty state: ${text}. Where: ${context.where}. Blocker: ${context.blocker}. Next action: ${context.next}.`;
  return `<div class="demo-empty" role="note" aria-label="${escapeAttribute(label)}">
    <strong>${escapeHtml(text)}</strong>
    <span><b>How to fill:</b> ${escapeHtml(help)}</span>
    <small><b>Where:</b> ${escapeHtml(context.where)}</small>
    <small><b>Blocker:</b> ${escapeHtml(context.blocker)}</small>
    <small><b>Next action:</b> ${escapeHtml(context.next)}</small>
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

function emptyStateContextFor(where, blocker, next) {
  return { where, blocker, next };
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

function copySurface(value, visibleLimit, helpLimit = visibleLimit) {
  const full = normalizeCopy(value) || DEMO_BLOCKER_NONE_LABEL;
  const visible = visibleCopy(full, visibleLimit);
  const help = helpCopy(full, helpLimit);
  return {
    full,
    visible,
    help,
    visibleLimit,
    helpLimit,
    truncated: visible !== full || help !== full
  };
}

function setCopySurface(element, value, label, visibleLimit, helpLimit = visibleLimit) {
  if (!element) {
    return;
  }

  const copy = copySurface(value, visibleLimit, helpLimit);
  element.textContent = copy.visible;
  element.title = copySurfaceLabel(label, copy.help);
  element.setAttribute("aria-label", copySurfaceLabel(label, copy.help));
  element.dataset.copySurface = fieldKey(label || element.id || "copy");
  element.dataset.copyVisibleLimit = String(copy.visibleLimit);
  element.dataset.copyHelpLimit = String(copy.helpLimit);
  element.dataset.copyTruncated = String(copy.truncated);
}

function copySurfaceAttributes(label, copy) {
  return ` title="${escapeAttribute(copySurfaceLabel(label, copy.help))}" aria-label="${escapeAttribute(copySurfaceLabel(label, copy.help))}" data-copy-surface="${escapeAttribute(fieldKey(label))}" data-copy-visible-limit="${escapeAttribute(String(copy.visibleLimit))}" data-copy-help-limit="${escapeAttribute(String(copy.helpLimit))}" data-copy-truncated="${escapeAttribute(String(copy.truncated))}"`;
}

function copySurfaceLabel(label, value) {
  const copy = normalizeCopy(value) || DEMO_BLOCKER_NONE_LABEL;
  return label ? `${label}: ${copy}` : copy;
}

function normalizeCopy(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeLegacyVisibleCopy(value) {
  if (typeof value === "string") {
    return value
      .replace(/Button-runs-next/g, "Button runs next")
      .replace(/Button Runs Next/g, "Button runs next")
      .replace(/missing Button runs next/g, "missing next action")
      .replace(/Set Button runs next/g, "Set next action")
      .replace(/set Button runs next/g, "set next action")
      .replace(/Needs Button runs next/g, "Needs next action")
      .replace(/Choose Button runs next/g, "Choose next action")
      .replace(/choose Button runs next/g, "choose next action")
      .replace(/Button runs next/g, "Next action")
      .replace(/button runs next/g, "next action");
  }

  if (Array.isArray(value)) {
    return value.map(normalizeLegacyVisibleCopy);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeLegacyVisibleCopy(entry)]));
  }

  return value;
}

function workTitle(packOrTitle) {
  const raw = typeof packOrTitle === "string"
    ? packOrTitle
    : packOrTitle?.title;
  const rawText = normalizeCopy(raw);
  if (!rawText) {
    return "";
  }

  if (!/[-_]/.test(rawText)) {
    return rawText;
  }

  const text = rawText.replace(/[-_]+/g, " ");
  return text
    .split(" ")
    .filter(Boolean)
    .map((token, index) => workTitleToken(token, index))
    .join(" ");
}

function workTitleToken(token, index) {
  const lower = token.toLowerCase();
  const acronyms = {
    api: "API",
    css: "CSS",
    gh: "GitHub",
    github: "GitHub",
    html: "HTML",
    iso: "ISO",
    js: "JS",
    pdf: "PDF",
    ui: "UI",
    ux: "UX"
  };

  if (acronyms[lower]) {
    return acronyms[lower];
  }

  return index === 0 ? capitalize(lower) : lower;
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function fieldKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cssIdent(value) {
  return window.CSS?.escape
    ? window.CSS.escape(String(value || ""))
    : String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function helpTip(text) {
  return `<span class="demo-help-tip" title="${escapeAttribute(text)}" aria-label="${escapeAttribute(text)}" role="tooltip" tabindex="0">?</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCompare() {
  const ids = (state.routeParam || "").split("/").filter(Boolean);
  const packA = ids.length > 0 ? findPack(ids[0]) : null;
  const packB = ids.length > 1 ? findPack(ids[1]) : null;

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Compare</span>
          <h2>Side by side</h2>
        </div>
        <span class="demo-status">${packA && packB ? "2 selected" : "Choose two"}</span>
      </div>
      <div class="demo-compare-grid">
        ${renderCompareColumn("A", packA, ids[0])}
        ${renderCompareColumn("B", packB, ids[1])}
      </div>
      ${!packA || !packB ? `<div class="demo-compare-picker">
        <div class="demo-panel-head"><h3>${!packA ? "Pick first" : "Pick second"} item</h3></div>
        <div class="demo-work-list">${state.packs.map((p) => `<button class="demo-compare-chip" type="button" data-action="compare-pick" data-slot="${!packA ? "a" : "b"}" data-pack="${escapeAttribute(p.id)}">${escapeHtml(workTitle(p))} <small>${escapeHtml(p.owner)}</small></button>`).join("")}</div>
      </div>` : ""}
      ${packA && packB ? compareDiffSummary(packA, packB) : ""}
    </section>
  `;
  bindComparePickers();
  bindListActions();
}

function renderCompareColumn(slot, pack, id) {
  if (!pack) {
    return `<article class="demo-compare-col demo-compare-empty">
      <div class="demo-panel-head"><h3>${slot}</h3></div>
      <p>Select an item to compare.</p>
    </article>`;
  }
  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  return `<article class="demo-compare-col">
    <div class="demo-panel-head">
      <div><span class="section-label">${slot}</span><h3>${escapeHtml(workTitle(pack))}</h3></div>
      <span class="demo-state-pill">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-compare-fields">
      <div class="demo-compare-field"><span>Status</span><strong>${escapeHtml(pack.status)}</strong></div>
      <div class="demo-compare-field"><span>Owner</span><strong>${escapeHtml(pack.owner)}</strong></div>
      <div class="demo-compare-field"><span>Blocker</span><strong>${escapeHtml(blockerTextForPack(pack))}</strong></div>
      <div class="demo-compare-field"><span>Next action</span><strong>${escapeHtml(command.label)}</strong></div>
      <div class="demo-compare-field"><span>Due</span><strong>${escapeHtml(pack.due || "—")}</strong></div>
      <div class="demo-compare-field"><span>Purpose</span><strong>${escapeHtml(pack.purpose || "—")}</strong></div>
      <div class="demo-compare-field"><span>Proof target</span><strong>${escapeHtml(pack.doneWhen || "—")}</strong></div>
      <div class="demo-compare-field"><span>Sources</span><strong>${escapeHtml((pack.sources || []).join(", ") || "—")}</strong></div>
      <div class="demo-compare-field"><span>Memory</span><strong>${escapeHtml((pack.memory || []).join("; ") || "—")}</strong></div>
    </div>
    ${primaryCommandButton(pack)}
  </article>`;
}

function compareDiffSummary(a, b) {
  const diffs = [];
  if (a.status !== b.status) diffs.push("status");
  if (a.blocker !== b.blocker) diffs.push("blocker");
  if (a.owner !== b.owner) diffs.push("owner");
  if (a.next !== b.next) diffs.push("next action");
  if (a.due !== b.due) diffs.push("due date");
  if (!diffs.length) return `<p class="demo-field-help">These two items are identical across key fields.</p>`;
  return `<p class="demo-field-help">Differs on: ${diffs.join(", ")}.</p>`;
}

function bindComparePickers() {
  document.querySelectorAll("[data-action=compare-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = btn.dataset.slot;
      const packId = btn.dataset.pack;
      const ids = (state.routeParam || "").split("/").filter(Boolean);
      if (slot === "a") { ids[0] = packId; } else { ids[1] = packId; }
      go("compare", ids.filter(Boolean).join("/"));
    });
  });
}

function renderCalendar() {
  const params = (state.routeParam || "").split("/").filter(Boolean);
  const now = new Date();
  let year = parseInt(params[0], 10) || now.getFullYear();
  let month = parseInt(params[1], 10);
  if (isNaN(month) || month < 0 || month > 11) month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dueMap = {};
  state.packs.forEach((p) => {
    if (p.due) {
      const d = p.due.slice(0, 10);
      dueMap[d] = dueMap[d] || [];
      dueMap[d].push(p);
    }
  });
  const today = now.toISOString().slice(0, 10);
  const selectedDate = params[2] || "";
  const selectedItems = dueMap[selectedDate] || [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const monthLabel = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const monthOptions = Array.from({ length: 12 }, (_, i) => `<option value="${i}"${i === month ? " selected" : ""}>${new Date(2000, i, 1).toLocaleString("default", { month: "long" })}</option>`).join("");
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`;
  }).join("");

  let cells = "";
  for (let i = 0; i < firstDay; i++) cells += `<div class="demo-cal-cell demo-cal-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const items = dueMap[date] || [];
    const isToday = date === today;
    const isSelected = date === selectedDate;
    cells += `<button class="demo-cal-cell${isToday ? " demo-cal-today" : ""}${items.length ? " demo-cal-has-items" : ""}${isSelected ? " demo-cal-selected" : ""}" type="button" data-action="calendar-day" data-date="${date}">
      <span class="demo-cal-day">${d}</span>
      ${items.length ? `<span class="demo-cal-count">${items.length}</span>` : ""}
    </button>`;
  }

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Calendar</span>
          <h2>${monthLabel}</h2>
        </div>
        <span class="demo-status">${Object.keys(dueMap).length} days with due items</span>
      </div>
      <div class="demo-cal-nav">
        <button class="btn btn-sm" type="button" data-action="calendar-nav" data-date="${prevYear}/${prevMonth}">←</button>
        <select class="demo-cal-select" data-action="calendar-month">${monthOptions}</select>
        <select class="demo-cal-select" data-action="calendar-year">${yearOptions}</select>
        <button class="btn btn-sm" type="button" data-action="calendar-nav" data-date="${nextYear}/${nextMonth}">→</button>
        <button class="btn btn-sm" type="button" data-action="calendar-nav" data-date="${now.getFullYear()}/${now.getMonth()}" style="margin-left:auto">Today</button>
      </div>
      <div class="demo-calendar-grid">
        ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => `<div class="demo-cal-header">${d}</div>`).join("")}
        ${cells}
      </div>
      ${selectedDate ? `
        <div class="demo-cal-detail">
          <h3>${new Date(selectedDate + "T00:00:00").toLocaleString("default", { weekday: "long", month: "long", day: "numeric" })}</h3>
          ${selectedItems.length ? selectedItems.map((p) => {
            const command = resolvePrimaryCommandForPack(p);
            return `<div class="demo-cal-item-detail">
              <button class="demo-card-title" type="button" data-action="select" data-pack="${escapeAttribute(p.id)}">${escapeHtml(workTitle(p))}</button>
              <span class="demo-state-pill">${escapeHtml(p.status)}</span>
              <small>${escapeHtml(command.label)}</small>
            </div>`;
          }).join("") : `<p class="demo-field-help">No items due this day.</p>`}
        </div>
      ` : `<p class="demo-field-help">Click a day to see what is due.</p>`}
    </section>
  `;
  bindCalendarNav();
  bindListActions();
}

function bindCalendarNav() {
  document.querySelectorAll("[data-action=calendar-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      go("calendar", btn.dataset.date);
    });
  });
  document.querySelectorAll("[data-action=calendar-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const params = (state.routeParam || "").split("/").filter(Boolean);
      go("calendar", `${params[0] || new Date().getFullYear()}/${params[1] || new Date().getMonth()}/${btn.dataset.date}`);
    });
  });
  const monthSel = document.querySelector("[data-action=calendar-month]");
  const yearSel = document.querySelector("[data-action=calendar-year]");
  if (monthSel && yearSel) {
    const jump = () => {
      const params = (state.routeParam || "").split("/").filter(Boolean);
      go("calendar", `${yearSel.value}/${monthSel.value}${params[2] ? "/" + params[2] : ""}`);
    };
    monthSel.addEventListener("change", jump);
    yearSel.addEventListener("change", jump);
  }
}

function renderSettings() {
  const resetHelp = resetDemoHelp();
  const profileChoices = Object.entries(copyProfiles).map(([key, value]) => {
    const active = key === state.copyProfile;
    const help = profileCardHelp(key, value, active);
    return `<button class="demo-profile-card" type="button" data-profile="${escapeAttribute(key)}" aria-pressed="${String(active)}" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
      <strong>${escapeHtml(PROFILE_LABELS[key] || capitalize(key))}</strong>
      <span>${escapeHtml(`${value.newWork} / ${value.workMany}`)}</span>
    </button>`;
  }).join("");
  const scenarioChoices = DEMO_SCENARIOS.map((scenario) => {
    const active = scenario.id === state.scenarioId;
    const help = scenarioCardHelp(scenario, active);
    return `<button class="demo-profile-card" type="button" data-scenario="${escapeAttribute(scenario.id)}" aria-pressed="${String(active)}" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
      <strong>${escapeHtml(scenario.label)}</strong>
      <span>${escapeHtml(scenario.description)}</span>
    </button>`;
  }).join("");
  const currentTheme = document.documentElement.dataset.theme || "light";
  const themeChoices = THEMES.map((theme) => {
    const active = theme === currentTheme;
    return `<button class="demo-profile-card" type="button" data-theme-choice="${escapeAttribute(theme)}" aria-pressed="${String(active)}" title="${escapeAttribute(themeChoiceHelp(theme, active))}" aria-label="${escapeAttribute(themeChoiceHelp(theme, active))}">
      <strong>${escapeHtml(THEME_LABELS[theme])}</strong>
    </button>`;
  }).join("");

  el("screen-content").innerHTML = `
    <section class="demo-panel demo-settings">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Demo preferences</span>
          <h2>Profile, scenario, theme, and backups in one place.</h2>
        </div>
      </div>
      <div class="demo-settings-section" role="group" aria-label="Copy profile">
        <h3>Copy profile</h3>
        <p class="demo-field-help">Changes the vocabulary the demo uses for ${escapeHtml(workNoun(2))}.</p>
        <div class="demo-chip-row demo-profile-grid">${profileChoices}</div>
      </div>
      <div class="demo-settings-section" role="group" aria-label="Scenario">
        <h3>Scenario</h3>
        <p class="demo-field-help">Loads a sample work set and opens its starting screen.</p>
        <div class="demo-chip-row demo-profile-grid">${scenarioChoices}</div>
      </div>
      <div class="demo-settings-section" role="group" aria-label="Theme">
        <h3>Theme</h3>
        <p class="demo-field-help">Saved in this browser only.</p>
        <div class="demo-chip-row">${themeChoices}</div>
      </div>
      <div class="demo-settings-section" role="group" aria-label="Reset demo data">
        <h3>Reset</h3>
        <p class="demo-field-help">${escapeHtml(resetHelp)}</p>
        <button class="btn" type="button" id="reset-demo-settings"${controlLabelAttributes(resetHelp)}>Reset sample</button>
      </div>
      ${recoveryPanel()}
    </section>
  `;
  bindProfileChoices();
  bindScenarioCards();
  bindThemeChoices();
  el("reset-demo-settings")?.addEventListener("click", resetState);
  bindRecoveryControls();
}

function themeChoiceHelp(theme, active) {
  return active ? `Current theme: ${THEME_LABELS[theme]}.` : `Switch to ${THEME_LABELS[theme]} theme.`;
}

function bindProfileChoices() {
  document.querySelectorAll("[data-profile]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.profile;
      if (!copyProfiles[key] || key === state.copyProfile) {
        return;
      }
      if (DEMO_API_BASE_URL) {
        try {
          await clearPendingBackendStateSave();
          await saveBackendProfile(key, "Settings");
        } catch (error) {
          state.status = routeStatus("Settings", error.message || "profile change failed", "retry or refresh");
          state.suppressNextSave = true;
        }
        syncSearchParam("profile", state.copyProfile === "general" ? null : state.copyProfile);
        render();
        return;
      }
      state.copyProfile = key;
      state.status = profileStatus(key, "Settings");
      syncSearchParam("profile", key === "general" ? null : key);
      render();
    });
  });
}

function renderInsights() {
  const total = state.packs.length;
  const done = state.packs.filter((p) => p.status === "done").length;
  const active = state.packs.filter((p) => p.status === "active").length;
  const blocked = state.packs.filter((p) => p.status === "blocked").length;
  const draft = state.packs.filter((p) => p.status === "draft").length;
  const rate = total ? Math.round((done / total) * 100) : 0;

  const owners = {};
  state.packs.forEach((p) => { const o = p.owner || "unassigned"; owners[o] = (owners[o] || 0) + 1; });
  const topOwner = Object.entries(owners).sort((a, b) => b[1] - a[1])[0] || ["none", 0];

  const types = {};
  state.packs.forEach((p) => { const t = p.type || "other"; types[t] = (types[t] || 0) + 1; });

  const memoryCount = state.packs.reduce((sum, p) => sum + (p.memory?.length || 0), 0);
  const withDue = state.packs.filter((p) => p.due).length;
  const dueSoon = state.packs.filter((p) => {
    if (!p.due) return false;
    const days = (new Date(p.due + "T00:00:00") - new Date()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Insights</span>
          <h2>${total} ${workNoun(total)} across the demo</h2>
        </div>
        <span class="demo-status">${done} complete</span>
      </div>

      <div class="demo-insights-grid">
        ${insightCard("Completion", `${rate}%`, `${done} of ${total} ${workNoun(total)} done`, rate >= 80 ? "good" : rate >= 40 ? "warn" : "low")}
        ${insightCard("Active", String(active), `${active} in progress`, "neutral")}
        ${insightCard("Blocked", String(blocked), `${blocked} need attention`, blocked > 0 ? "warn" : "good")}
        ${insightCard("Draft", String(draft), `${draft} not started`, "neutral")}
      </div>

      <div class="demo-insights-section">
        <h3>Owner activity</h3>
        <div class="demo-insights-bars">
          ${Object.entries(owners).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `
            <div class="demo-insight-bar">
              <span class="demo-insight-bar-label">${escapeHtml(name)}</span>
              <span class="demo-insight-bar-track"><span class="demo-insight-bar-fill" style="width:${Math.round((count / total) * 100)}%"></span></span>
              <span class="demo-insight-bar-value">${count}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="demo-insights-grid demo-insights-grid-3">
        ${insightCard("With due date", String(withDue), `${total ? Math.round((withDue / total) * 100) : 0}% of total`, "neutral")}
        ${insightCard("Due within 7 days", String(dueSoon), `${dueSoon} upcoming`, dueSoon > 0 ? "warn" : "good")}
        ${insightCard("Memory notes", String(memoryCount), `${total ? Math.round(memoryCount / total) : 0} per item avg`, memoryCount > 10 ? "good" : "neutral")}
      </div>

      <div class="demo-insights-section">
        <h3>Type breakdown</h3>
        <div class="demo-chip-row">
          ${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
            <span class="demo-chip" aria-pressed="true">${escapeHtml(type)}: ${count}</span>
          `).join("")}
        </div>
      </div>
    </section>
  `;
  bindListActions();
}

function insightCard(label, value, detail, tone) {
  return `<div class="demo-insight-card demo-insight-${tone}">
    <span class="demo-insight-value">${escapeHtml(value)}</span>
    <strong>${escapeHtml(label)}</strong>
    <small>${escapeHtml(detail)}</small>
  </div>`;
}

function bindThemeChoices() {
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeChoice);
      syncThemeChoices();
    });
  });
}

function syncThemeChoices() {
  const currentTheme = document.documentElement.dataset.theme || "light";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === currentTheme;
    const help = themeChoiceHelp(button.dataset.themeChoice, active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("title", help);
    button.setAttribute("aria-label", help);
  });
}

function truncateTitle(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
