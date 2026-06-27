const DEMO_STORAGE_KEY = "projects-static-demo-state-v6";
const LEGACY_DEMO_STORAGE_KEYS = [
  "projects-static-demo-state-v3",
  "projects-static-demo-state-v4",
  "projects-static-demo-state-v5"
];
const THEME_STORAGE_KEY = "projects-demo-theme-v2";
const DEMO_METADATA_FILE = "assets/demo-metadata.json";
const DEMO_DEFAULT_VERSION = "working";
const DEMO_API_QUERY_PARAM = "api";
const API_STATE_SAVE_DEBOUNCE_MS = 300;
const API_CLIENT_STORAGE_KEY = "projects-static-demo-api-client-v1";
const SYNC_CODE_STORAGE_KEY = "projects-static-demo-sync-code-v1";
const SYNC_CODE_QUERY_PARAM = "sync";
const SYNC_CODE_MIN_COMPACT_LENGTH = 8;
const SYNC_CODE_MAX_COMPACT_LENGTH = 16;
const SYNC_QR_VERSION = 5;
const SYNC_QR_SIZE = 21 + ((SYNC_QR_VERSION - 1) * 4);
const SYNC_QR_DATA_CODEWORDS = 108;
const SYNC_QR_ERROR_CODEWORDS = 26;
const SYNC_QR_QUIET_MODULES = 4;
const SYNC_QR_MAX_BYTES = 106;
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

const STYLE_AUDIT_ASSETS = [
  { id: "productCss", label: "Product CSS", path: "assets/app.css", type: "css" },
  { id: "demoCss", label: "Demo CSS", path: "assets/demo.css", type: "css" },
  { id: "demoJs", label: "Demo JS", path: "assets/demo.js", type: "js" }
];
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
  ["owner", "owner"],
  ["due", "due date"],
  ["next", "Button runs next"],
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
  home: { pattern: "#/home", title: "Start", commandSource: "route", navKey: "1", navLabel: "Start" },
  review: { pattern: "#/review/{packId}", title: "Review", commandSource: "selected-work", acceptsPackId: true, navKey: "2", navLabel: "Review" },
  work: { pattern: "#/work/{packId}", title: "Work", commandSource: "selected-work", acceptsPackId: true, navKey: "3", navLabel: "Work" },
  next: { pattern: "#/next/{packId}", title: "Next action", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "4", navLabel: "Next" },
  memory: { pattern: "#/memory/{packId}", title: "Memory", commandSource: "route-and-selected-work", acceptsPackId: true, navKey: "5", navLabel: "Memory" },
  create: { pattern: "#/create", title: "Create", commandSource: "route", navKey: "+", navLabel: "Create" },
  pack: { pattern: "#/pack/{packId}", title: "Work path", commandSource: "selected-work", acceptsPackId: true }
});

const NAV_ROUTE_GROUPS = Object.freeze([
  Object.freeze({
    id: "public",
    label: "Demo",
    routes: Object.freeze(["home", "review", "work", "next", "memory", "create"])
  })
]);

const NAV_ROUTE_IDS = Object.freeze(NAV_ROUTE_GROUPS.flatMap((group) => group.routes));

const navItems = Object.freeze(NAV_ROUTE_IDS.map((route) => {
  const contract = ROUTE_CONTRACT[route];
  return Object.freeze({ route, key: contract.navKey, label: contract.navLabel, group: navGroupIdForRoute(route) });
}));

const BUTTON_RUNS_NEXT_CHOICES = Object.freeze(["Review", "Open", "Focus", "Set Blocker: None", "Start", "Finish with proof"]);

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
  climate: { work: "site check", workOne: "site check", workMany: "site checks", newWork: "New check", result: "Finding", sources: "Datasets and notes" }
};

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
    description: "Normalize blockers and Button runs next values to reduce friction in the demo.",
    profile: "general",
    route: "work",
    filter: "active",
    transform: (packs) => packs.map((pack) => pack.status === "done"
      ? pack
      : {
          ...pack,
          blocker: DEMO_BLOCKER_NONE,
          next: isPlaceholderNext(pack.next) ? "Open" : pack.next,
          status: pack.status === "draft" ? "active" : pack.status
        })
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Compact first-run path with clear labels and Button runs next values.",
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
      blocker: "missing Button runs next",
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
const DEMO_API_BASE_URL = normalizeApiBaseUrl(launchParams.get(DEMO_API_QUERY_PARAM) || window.PROJECTS_API_BASE_URL || "");
let apiSaveTimer = null;
let apiPendingSnapshot = null;
let apiSaveInFlight = false;
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
    const [metadata, packsResponse, backendState, styleAudit] = await Promise.all([
      fetch(DEMO_METADATA_FILE, { cache: "no-store" }).catch(() => null),
      fetch("data/demo-packs.json", { cache: "no-store" }),
      loadBackendState(),
      collectStyleAudit()
    ]);
    if (!packsResponse.ok) {
      throw new Error(`Demo data failed with ${packsResponse.status}`);
    }

    state.basePacks = normalizeLegacyVisibleCopy(await packsResponse.json());
    const parsedMetadata = metadata && safeJson(await metadata.text());
    state.metadata = buildMetadata(parsedMetadata);
    state.styleAudit = styleAudit;
    loadState(backendState);
    applyLaunchConfiguration();
    if (launchedSyncCode) {
      state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "review shared demo state");
    }
    routeFromHash();
    render();
    if (launchedSyncCode) {
      renderDemoSyncControls("Sync link is active. This device now opens the shared demo state.");
    }
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
  const toggle = el("theme-toggle");
  const label = dark ? "Light mode" : "Dark mode";
  const help = dark ? "Switch this demo to light mode." : "Switch this demo to dark mode.";
  toggle.textContent = label;
  toggle.setAttribute("aria-pressed", String(dark));
  toggle.setAttribute("title", help);
  toggle.setAttribute("aria-label", help);
  localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
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
  state.packs = normalizeLegacyVisibleCopy(Array.isArray(saved?.packs) ? saved.packs : structuredClone(state.basePacks));
  state.copyProfile = saved?.copyProfile || "general";
  state.scenarioId = saved?.scenarioId || "default";
  state.filter = saved?.filter || "all";
  state.query = saved?.query || "";
  state.selectedId = saved?.selectedId || state.packs[0]?.id || "";
  state.status = normalizeLegacyVisibleCopy(saved?.status || state.status);
  state.actionReceipt = normalizeActionReceipt(normalizeLegacyVisibleCopy(saved?.actionReceipt));
  state.triageInput = normalizeLegacyVisibleCopy(typeof saved?.triageInput === "string" ? saved.triageInput : defaultTriageInput());
  state.triageRows = normalizeLegacyVisibleCopy(Array.isArray(saved?.triageRows) ? saved.triageRows : []);
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
  const hasProfileParam = Boolean(profileParam && copyProfiles[profileParam]);

  const scenarioParam = launchParams.get("scenario");
  if (scenarioParam && DEMO_SCENARIO_BY_ID[scenarioParam]) {
    state.route = DEMO_SCENARIO_BY_ID[scenarioParam].route || state.route;
    applyScenario(DEMO_SCENARIO_BY_ID[scenarioParam], { force: true, preserveProfile: hasProfileParam });
  } else if (!Array.isArray(state.packs) || state.packs.length === 0) {
    applyScenario(DEMO_SCENARIO_BY_ID.default, { preserveProfile: hasProfileParam });
  } else if (!DEMO_SCENARIO_BY_ID[state.scenarioId]) {
    state.scenarioId = "default";
  }

  if (hasProfileParam) {
    state.copyProfile = profileParam;
    syncSearchParam("profile", profileParam);
    state.status = profileStatus(profileParam, "URL");
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

function saveState() {
  const snapshot = demoStateSnapshot();
  if (DEMO_API_BASE_URL) {
    scheduleBackendStateSave(snapshot);
    return;
  }

  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snapshot));
}

function demoStateSnapshot() {
  return {
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
  };
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

function normalizeApiBaseUrl(value) {
  const text = normalizeCopy(value);
  return text ? text.replace(/\/+$/u, "") : "";
}

function apiUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${DEMO_API_BASE_URL}${suffix}`;
}

async function loadBackendState() {
  if (!DEMO_API_BASE_URL) {
    return null;
  }

  const response = await fetch(apiUrl("/api/state"), {
    cache: "no-store",
    headers: await apiHeaders()
  });
  if (!response.ok) {
    throw new Error(`Backend API failed with ${response.status}`);
  }

  return response.json();
}

function normalizeStoredDemoState(value) {
  return value && typeof value === "object" ? value : {};
}

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
  persistBackendStateSnapshot(snapshot)
    .catch((error) => {
      apiPendingSnapshot = snapshot;
      console.error("Projects demo API save failed.", error);
    })
    .finally(() => {
      apiSaveInFlight = false;
      if (apiPendingSnapshot) {
        scheduleBackendStateSave(apiPendingSnapshot);
      }
    });
}

async function persistBackendStateSnapshot(snapshot) {
  const response = await fetch(apiUrl("/api/state"), {
    method: "PUT",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    throw new Error(`Backend API save failed with ${response.status}`);
  }
}

async function runBackendPackAction(pack, action) {
  if (!DEMO_API_BASE_URL || !pack?.id || !SERVER_PACK_ACTIONS.has(action)) {
    return false;
  }

  clearPendingBackendStateSave();
  await persistBackendStateSnapshot(demoStateSnapshot());
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/actions`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action })
  });
  if (!response.ok) {
    throw new Error(`Backend action failed with ${response.status}`);
  }

  const result = await response.json();
  loadState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  if (action === "open") {
    queueFocus("pack-detail", state.selectedId);
    go("pack", state.selectedId);
    return true;
  }

  render();
  return true;
}

async function saveBackendPackNextAction(pack, next) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  clearPendingBackendStateSave();
  await persistBackendStateSnapshot(demoStateSnapshot());
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/next`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ next })
  });
  if (!response.ok) {
    throw new Error(`Backend next action failed with ${response.status}`);
  }

  const result = await response.json();
  loadState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  return result;
}

async function createBackendPack(values) {
  if (!DEMO_API_BASE_URL) {
    return null;
  }

  clearPendingBackendStateSave();
  await persistBackendStateSnapshot(demoStateSnapshot());
  const response = await fetch(apiUrl("/api/packs"), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(values)
  });
  if (!response.ok) {
    throw new Error(`Backend create failed with ${response.status}`);
  }

  const result = await response.json();
  loadState(result.state);
  state.selectedId = result.pack?.id || state.selectedId;
  return result;
}

async function addBackendPackMemoryNote(pack, note) {
  if (!DEMO_API_BASE_URL || !pack?.id) {
    return null;
  }

  clearPendingBackendStateSave();
  await persistBackendStateSnapshot(demoStateSnapshot());
  const response = await fetch(apiUrl(`/api/packs/${encodeURIComponent(pack.id)}/memory`), {
    method: "POST",
    headers: await apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ note })
  });
  if (!response.ok) {
    throw new Error(`Backend memory action failed with ${response.status}`);
  }

  const result = await response.json();
  loadState(result.state);
  state.selectedId = result.pack?.id || pack.id;
  return result;
}

function updateServiceBoundaryNotice() {
  const notice = el("demo-notice");
  if (!notice) {
    return;
  }

  const syncCode = readSyncCode();
  notice.textContent = DEMO_API_BASE_URL && syncCode
    ? "Sync code active. Anyone with the code can open this demo state. Do not enter private project data."
    : DEMO_API_BASE_URL
      ? "Demo data only. Saves through the API for this browser, not an account. Do not enter private project data."
      : "Demo data only. Saves in this browser, not an account. Do not enter private project data.";
  renderDemoSyncControls();
}

function bindDemoSyncControls() {
  el("sync-code-use")?.addEventListener("click", () => {
    withSyncControlsBusy(() => activateSyncCode(valueOf("sync-code-input"), { copyCurrentState: false }));
  });
  el("sync-code-new")?.addEventListener("click", () => {
    const code = generateSyncCode();
    const input = el("sync-code-input");
    if (input) {
      input.value = code;
    }
    withSyncControlsBusy(() => activateSyncCode(code, { copyCurrentState: true }));
  });
  el("sync-code-copy")?.addEventListener("click", () => {
    copySyncLink();
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

  panel.hidden = !DEMO_API_BASE_URL;
  if (!DEMO_API_BASE_URL) {
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
  renderSyncShare(syncCode);
  const help = el("sync-code-help");
  if (help) {
    help.textContent = message || (syncCode
      ? "Anyone with this code can open the same demo state. Do not use it for private data."
      : "Use a code to sync this demo across devices. This is not an account or private storage.");
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
  link.textContent = "Sync link";
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
    state.status = routeStatus("Sync link", DEMO_BLOCKER_NONE, "open on another device");
    render();
    renderDemoSyncControls("Sync link copied. Anyone with it can open this demo state.");
  } catch {
    renderDemoSyncControls("Copy blocked. Use the visible sync link or scan the QR code.");
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
  ["sync-code-input", "sync-code-use", "sync-code-new", "sync-code-copy", "sync-code-leave"].forEach((id) => {
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

  clearPendingBackendStateSave();
  writeSyncCode(code);
  apiSessionClientId = "";
  if (options.copyCurrentState) {
    await persistBackendStateSnapshot(demoStateSnapshot());
    state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "use code on another device");
  } else {
    loadState(await loadBackendState());
    state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "review shared demo state");
  }

  updateServiceBoundaryNotice();
  render();
  renderDemoSyncControls(options.copyCurrentState
    ? "New code is active. Use it on another device to open this demo state."
    : "Code is active. This device now opens the shared demo state.");
}

async function leaveSyncCode() {
  if (!DEMO_API_BASE_URL) {
    return;
  }

  clearPendingBackendStateSave();
  clearSyncCode();
  clearLaunchSyncCodeParam();
  apiSessionClientId = "";
  loadState(await loadBackendState());
  state.status = routeStatus("Sync code", DEMO_BLOCKER_NONE, "use this device only");
  updateServiceBoundaryNotice();
  render();
  renderDemoSyncControls("Sync code left. This device is back to its own demo state.");
}

function clearPendingBackendStateSave() {
  window.clearTimeout(apiSaveTimer);
  apiPendingSnapshot = null;
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
  } catch {
    // LocalStorage access can be restricted in some embedded contexts.
  }
}

function clearSyncCode() {
  try {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch {
    // LocalStorage access can be restricted in some embedded contexts.
  }
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
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

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
  } catch {
    // LocalStorage access can be restricted in some embedded contexts.
  }
  return next;
}

async function syncClientId(syncCode) {
  const normalized = normalizeSyncCode(syncCode);
  if (!normalized) {
    return "";
  }

  if (!globalThis.crypto?.subtle) {
    return `sync-${normalized.toLowerCase().replace(/[^a-z0-9._-]/gu, "-")}`;
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
  const randomValue = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `demo-${randomValue}`;
}

function isApiClientId(value) {
  return /^demo-[A-Za-z0-9._-]{8,120}$/u.test(value);
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

function profileStatus(profileKey, source = "Settings") {
  const value = copyProfiles[profileKey] || copyProfiles.general;
  const label = capitalize(copyProfiles[profileKey] ? profileKey : "general");
  return `Where: ${source}. Blocker: None. Button runs next: use ${label} copy labels for ${value.work}.`;
}

function scenarioStatus(scenario) {
  const current = DEMO_SCENARIO_BY_ID[scenario?.id] || DEMO_SCENARIO_BY_ID.default;
  const routeTitle = ROUTE_CONTRACT[current.route]?.title || "demo route";
  return `Where: Scenario ${current.label}. Blocker: None. Button runs next: open ${routeTitle}.`;
}

function resetDemoStatus() {
  return "Where: Settings. Blocker: None. Button runs next: review reset demo data in this browser.";
}

function routeStatus(where, blocker, next) {
  const visibleBlocker = blockerDisplayValue(blocker);
  return `Where: ${where}. Blocker: ${visibleBlocker}. Button runs next: ${next}.`;
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
  state.route = parsedRoute.route;

  if (parsedRoute.fallback) {
    history.replaceState({}, "", `${location.pathname}${location.search}${formatRouteHash("home")}`);
  }

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

  document.querySelectorAll(".demo-nav-item").forEach((item) => {
    const isActive = item.dataset.route === state.route;
    item.classList.toggle("active", isActive);
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

  if (state.route === "home") {
    return "Start";
  }

  if (state.route === "work") {
    return `${workNounTitle(2)} list`;
  }

  if (state.route === "pack") {
    return `${workLabelTitle()} path`;
  }

  if (state.route === "files") {
    return profile.sources;
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
  const reviewWorkNoun = workNoun(reviewCount);
  const allWorkNoun = workNoun(state.packs.length);
  const workListTitle = `${workNounTitle(2)} list`;
  const workOverviewTitle = "Start";
  const triageCount = state.triageRows.length;
  const triageBlockers = state.triageRows.filter((row) => !isUnblockedBlockerValue(row.blocker)).length;
  const triageAction = triageCount > 0 ? "copy-triage" : "parse-triage";
  const triageNext = triageCount > 0 ? "Copy Markdown" : `Parse ${profile().work}`;
  const reviewSummary = reviewCount > 0
    ? `${reviewCount} ${reviewWorkNoun} need review`
    : DEMO_BLOCKER_NONE_LABEL;
  const reviewTarget = preferredReviewPack();
  const selectedWorkCommand = selectedPackCommand(selected);
  const searchQuery = normalizeCopy(state.query);
  const searchNext = searchQuery ? "Refine search" : "Focus search";
  const searchBlocker = searchQuery
    ? `${visibleCount} match(es) for ${searchQuery}`
    : "type title, owner, Button runs next, or due date";
  const validateState = validateSampleState();
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
  const checkCommand = validateState.canRun
    ? { title: "Check", where: "Check", blocker: `${reviewCount} ${reviewWorkNoun} still need decisions`, next: `Check ${profile().work}`, stateText: "Ready", action: "validate-sample", targetPackId: "" }
    : noSampleWorkCommand("Check", "Check", validateState.help);
  const homeCommand = hasSampleWork
    ? { title: workOverviewTitle, where: "Start", blocker: reviewSummary, next: `Review ${workNoun(2)}`, stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" }
    : noSampleWorkCommand(workOverviewTitle, "Start", `${profile().newWork} or reset demo data before reviewing.`);
  const searchCommand = hasSampleWork
    ? { title: "Search", where: "Search", blocker: searchBlocker, next: searchNext, stateText: searchQuery ? "Filtering" : "Ready", action: "search-demo", targetPackId: "" }
    : noSampleWorkCommand("Search", "Search", `${profile().newWork} or reset demo data before searching.`);
  const statsCommand = hasSampleWork
    ? { title: "Stats", where: "Stats", blocker: "counts are calculated in this browser", next: `Review ${workNoun(2)}`, stateText: "Ready", action: "route-review", targetPackId: reviewTarget?.id || "" }
    : noSampleWorkCommand("Stats", "Stats", `${profile().newWork} or reset demo data before reviewing stats.`);
  const notesCommand = selected
    ? { title: "Notes", ...selectedWorkCommand, blocker: "notes stay with this browser", next: "Open memory", stateText: "Ready", stateHelp: `Saved notes for ${workTitle(selected)} stay in this browser.`, action: "memory", targetPackId: selectedWorkCommand.targetPackId }
    : { title: "Notes", ...selectedWorkCommand };
  const createCommand = createRouteCommand();
  const memoryCommand = memoryRouteCommand(selected, selectedWorkCommand);

  const routeCommands = {
    home: homeCommand,
    triage: { title: "Triage tool", where: "Triage tool", blocker: triageCount > 0 ? `${triageBlockers} blocker(s) visible in ${triageCount} row(s)` : `paste ${profile().work} to classify`, next: triageNext, stateText: "Tool", action: triageAction, targetPackId: "" },
    work: { title: workListTitle, ...selectedWorkCommand },
    today: { title: "Today", ...selectedWorkCommand },
    board: { title: "Board", ...selectedWorkCommand },
    review: { title: "Review", ...selectedWorkCommand },
    focus: { title: "Focus", ...selectedWorkCommand },
    next: { title: "Next setup", ...selectedWorkCommand },
    check: checkCommand,
    search: searchCommand,
    stats: statsCommand,
    notes: notesCommand,
    timeline: { title: "Timeline", where: "Timeline", blocker: "activity stays with this browser", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    files: { title: profile().sources, where: profile().sources, blocker: "source links are references only", next: selectedWorkCommand.next, stateText: "Ready", action: selectedWorkCommand.action, targetPackId: selectedWorkCommand.targetPackId },
    calendar: { title: "Calendar", ...selectedWorkCommand },
    create: createCommand,
    memory: memoryCommand,
    lab: { title: "Demo Lab", ...selectedWorkCommand },
    meta: { title: "Meta", where: "Meta", blocker: "checks are calculated in this browser", next: "Refresh", stateText: "Ready", action: "refresh-meta", targetPackId: "" },
    feedback: { title: "Feedback", where: "Feedback", blocker: `Version ${stateVersionLabel()} is active`, next: "Copy context", stateText: "Ready", action: "copy-feedback-context", targetPackId: "" },
    health: { title: "Health", where: "Health", blocker: "navigation, saved work, data, and build checks are running", next: "Refresh", stateText: "Ready", action: "refresh-health", targetPackId: "" },
    settings: { title: "Settings", where: "Settings", blocker: "copy profile changes labels only in this static demo", next: "Choose copy profile", stateText: "Ready", action: "choose-profile", targetPackId: "" },
    pack: { title: `${workLabelTitle()} path`, ...selectedWorkCommand }
  };

  const selectedBlocker = selected ? blockerTextForPack(selected) : "";
  const selectedActionCommand = selected ? resolvePrimaryCommandForPack(selected) : null;
  const selectedActionFlow = selected
    ? selectedFlowHintForPack(selected, selectedActionCommand, selectedBlocker)
    : "";

  const routeCommandsHints = {
    home: hasSampleWork ? "Review blocked work first." : "Create work, then review it.",
    triage: triageCount > 0
      ? "Flow: edit rows, copy Markdown."
      : "Flow: paste work, parse.",
    work: selectedActionFlow ? `${selectedActionFlow}` : "Flow: choose work, run next.",
    today: selectedActionFlow ? `${selectedActionFlow}` : "Flow: due work, run next.",
    board: selectedActionFlow ? `${selectedActionFlow}` : "Flow: choose status, work, run next.",
    review: selectedActionFlow
      ? `${selectedActionFlow}`
      : "Flow: resolve blockers first.",
    focus: selectedActionFlow
      ? `${selectedActionFlow}`
      : "Flow: confirm work path, run next.",
    next: "Flow: set button, return, run next.",
    check: validateState.canRun ? "Flow: check work, fix gaps." : "Flow: create work, check.",
    search: hasSampleWork
      ? (searchQuery ? "Flow: refine search, open work." : "Flow: type search, open work.")
      : "Flow: create work, search.",
    stats: hasSampleWork ? "Flow: review counts, choose work." : "Flow: create work, review stats.",
    notes: selected
      ? `Flow: open memory for ${workTitle(selected)}.`
      : (hasSampleWork ? "Flow: choose work, open memory." : "Flow: create work, add memory."),
    timeline: selected
      ? `${selectedActionFlow}`
      : "Flow: choose work, review activity, run next.",
    calendar: selected
      ? `${selectedActionFlow}`
      : "Flow: set due date, run next.",
    files: selected
      ? `${selectedActionFlow}`
      : "Flow: choose work, review sources, run next.",
    memory: selected
      ? memoryRouteFlowHint(selected)
      : (hasSampleWork ? "Flow: choose work, add memory." : "Flow: create work, add memory."),
    lab: selected
      ? `${selectedActionFlow}`
      : "Flow: choose work, preview button, run next.",
    pack: selected ? `${selectedActionFlow}` : "Flow: review work, run next.",
    create: createRouteFlowHint(createCommand),
    meta: "Flow: inspect checks, copy proof.",
    feedback: "Flow: copy context, then open issue.",
    health: "Flow: verify, return to work.",
    settings: "Flow: choose copy profile, apply.",
    settingsProfile: "Flow: choose copy profile, apply.",
    settingsScenario: "Flow: choose scenario, continue."
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
    stateText: createState.canSave ? "Ready" : "Needs field",
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

  if (blocker === "missing Button runs next") {
    return "focus-create-next";
  }

  return "create-sample";
}

function createRouteFlowHint(command) {
  if (command?.action === "create-sample") {
    return "Flow: save work, review, run next.";
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
      blocker: DEMO_BLOCKER_NONE_LABEL,
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
    blocker: "memory note is empty",
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
    return "Flow: choose work, run next.";
  }

  const title = workTitle(pack);
  if (isMissingNextAction(pack)) {
    return `Flow: set Button runs next for ${title}.`;
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
    return { label: "Set Button runs next", action: "set-next", targetPackId: selected.id };
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
      label: "Needs setup",
      path: "draft",
      help: "Button runs next is missing."
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
    help: `Button runs next: ${resolved.label}.`
  };
}

function updateCommand(command) {
  el("command-title").textContent = command.title;
  setCopySurface(el("command-where"), command.where, "Where", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("command-blocker"), command.blocker, "Blocker", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("command-next"), command.next, "Button runs next", DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  el("command-state").textContent = command.stateText;
  el("command-state").title = command.stateHelp || `State: ${command.stateText}`;
  el("command-state").setAttribute("aria-label", command.stateHelp || `State: ${command.stateText}`);
  el("command-scope").textContent = command.scope;
  if (el("command-flow")) {
    const flowHint = commandFlowCopy(command.flowHint || "Flow: choose work, run next.");
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
  setCopySurface(el("primary-action"), command.next, "Button runs next", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  el("primary-action").dataset.action = command.action || "";
  el("primary-action").dataset.pack = command.targetPackId || "";
  el("primary-action").setAttribute("aria-label", commandRunLabel(command));
  el("primary-action").title = commandRunLabel(command);
  setCopySurface(el("dock-where"), command.where, "Where", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("dock-blocker"), command.blocker, "Blocker", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  setCopySurface(el("dock-next-label"), command.next, "Button runs next", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  el("dock-next").dataset.action = command.action || "";
  el("dock-next").dataset.pack = command.targetPackId || "";
  el("dock-next").setAttribute("aria-label", commandRunLabel(command));
  el("dock-next").title = commandRunLabel(command);
  updateActionReceipt();
  scheduleBottomDockVisibility();
}

function commandFlowCopy(flowHint) {
  const hint = normalizeCopy(flowHint) || "Flow: choose work, run next.";
  return hint.replace(/^Flow:\s*/iu, "Next step: ");
}

function commandMemoryHelpText(command, commandMemory) {
  const next = normalizeCopy(command?.next) || "choose work";
  if (commandMemory) {
    return `Relevant Memory: ${sentenceValue(commandMemory)}. Button runs next: ${next}.`;
  }

  if (!currentPack()) {
    return "No selected work memory context.";
  }

  return `Relevant Memory: none yet. How to fill: use Add memory on selected work or the Memory screen. Button runs next: ${next}.`;
}

function commandMemoryVisibleText(commandMemory) {
  return commandMemory
    ? visibleCopy(commandMemory, DEMO_COPY_LIMITS.memoryVisible)
    : "none yet - add from Memory";
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
      { id: "next", label: "Run", active: false, help: `Button runs next: ${command.next}.` }
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
    "parse-triage",
    "copy-triage",
    "create-sample",
    "focus-create-title",
    "focus-create-owner",
    "focus-create-next",
    "search-demo",
    "validate-sample",
    "memory",
    "add-note",
    "type-memory-note",
    "choose-profile",
    "refresh-health",
    "refresh-meta",
    "copy-feedback-context"
  ].includes(action || "");
}

function commandWorkPathDetail(command, pack) {
  if (pack) {
    const workflow = workflowStateForPack(pack, { label: command.next, action: command.action, targetPackId: command.targetPackId });
    return `${workflow.label}: ${visibleCopy(workflow.help, DEMO_COPY_LIMITS.commandFlowVisible)}`;
  }

  return `Button runs next: ${visibleCopy(command.next, DEMO_COPY_LIMITS.commandFlowVisible)}`;
}

function commandRunLabel(command) {
  const runNote = normalizeCopy(command.runNote);
  const runCopy = runNote ? ` ${runNote}.` : "";
  return helpCopy(
    `Where: ${command.where}. Blocker: ${command.blocker}. Button runs next: ${command.next}.${runCopy}`,
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

  if (kind === "feedback-context") {
    const details = document.querySelector('[data-support-details="feedback-context"]');
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

  if (kind === "triage-input") {
    return ["#triage-input"];
  }

  if (kind === "triage-output") {
    return ["#triage-output", ".demo-triage-card", "#triage-snapshot"];
  }

  if (kind === "search-input") {
    return ["#screen-search", "#demo-search"];
  }

  if (kind === "settings-profile") {
    return [".demo-profile-card[aria-pressed=\"true\"]", ".demo-profile-card", "#reset-demo"];
  }

  if (kind === "feedback-context") {
    return ["#feedback-context", "#copy-feedback", "#open-feedback"];
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
  const behavior = options.behavior || "smooth";
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
  if (action === "parse-triage" || action === "copy-triage") {
    return "triage-output";
  }

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

  if (action === "copy-feedback-context") {
    return "feedback-context";
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
      <p>Projects is a compact way to keep work honest: each item shows where you are, what is blocking progress, and the one button that should run next. This demo uses sample work so the value is visible without knowing the original project history.</p>
      <p class="demo-home-counts">${state.packs.length} sample ${escapeHtml(workNoun(state.packs.length))}; ${reviewCount} need review.</p>
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
        <span id="reset-demo-home-help" class="sr-only">${escapeHtml(resetHelp)}</span>
        <button class="btn" type="button" id="reset-demo-home"${controlHelpAttributes(false, resetHelp, "reset-demo-home-help")}>Reset sample</button>
      </div>
    </section>
  `;
  bindGoButtons();
  el("reset-demo-home")?.addEventListener("click", resetState);
}

function renderTriage() {
  const rows = normalizedTriageRows();
  const blockerCount = rows.filter((row) => !isUnblockedBlockerValue(row.blocker)).length;
  const clearNextCount = rows.filter((row) => row.next && !isPlaceholderNext(row.next)).length;
  const parseHelp = triageParseHelp(rows);
  const addRowHelp = triageAddRowHelp();
  const resetHelp = triageResetHelp();
  const copyMarkdownHelp = triageCopyMarkdownHelp(rows);
  const copyJsonHelp = triageCopyJsonHelp(rows);
  const messyWorkHelp = triageInputHelp();
  const triageSnapshotHelp = rows.length
    ? "Readonly handoff text for the current triage rows. Copy Markdown or JSON to share it."
    : "Readonly handoff text is empty until you parse work or add a row.";

  el("screen-content").innerHTML = `
    <div class="demo-grid demo-summary-strip">
      ${metricCard("Rows", rows.length, "Work items shaped from pasted text.")}
      ${metricCard("Blockers", blockerCount, "Rows that need review before running next.")}
      ${metricCard("Clear next", clearNextCount, "Rows with a concrete Button runs next.")}
    </div>
    <section class="demo-panel demo-triage-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Button runs next</span>
          <h2>Work triage tool</h2>
        </div>
        <span class="demo-status">browser-only data</span>
      </div>
      <div class="demo-triage-layout">
        <div class="demo-triage-input">
          <label class="demo-field demo-field-wide" for="triage-input">
            <span>Messy work</span>
            <textarea id="triage-input" rows="10"${fieldHelpAttributes("triage-input-help", messyWorkHelp)}>${escapeHtml(state.triageInput || defaultTriageInput())}</textarea>
            ${fieldHelp("triage-input", messyWorkHelp)}
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
          ${factLine("Button runs next", rows.length ? "Copy Markdown" : "Parse work")}
        </div>
      </div>
    </section>
    <section id="triage-output" class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Triage rows</span>
          <h2>${rows.length ? `${rows.length} work item(s)` : "Paste or add work"}</h2>
        </div>
        <span class="demo-status">${rows.length ? "editable" : "ready"}</span>
      </div>
      <div class="demo-triage-list">
        ${rows.length ? rows.map(triageCard).join("") : emptyState("Paste work or add a row to build a work path.", "Paste task text, then choose Parse work.")}
      </div>
      ${clipboardNoticePanel("copy-triage-markdown")}
      ${clipboardNoticePanel("copy-triage-json")}
      ${optionalDetails("Handoff", "Open for copyable Markdown, JSON, and readiness checks.", `
        <div class="demo-detail-section">
          <h3>Readiness</h3>
          <div class="demo-check-list">
            ${triageQualityChecks(rows).map(healthLine).join("")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Copy handoff</h3>
          <div class="${copyPayloadClass("triage-snapshot")}">
            <label class="sr-only" for="triage-snapshot">Triage snapshot markdown</label>
            <textarea id="triage-snapshot" class="demo-search-input" rows="8" readonly${fieldHelpAttributes("triage-snapshot-help", triageSnapshotHelp)}>${escapeHtml(triageMarkdown(rows))}</textarea>
            ${fieldHelp("triage-snapshot", triageSnapshotHelp)}
          </div>
          <div class="demo-card-actions">
            <span id="copy-triage-markdown-help" class="sr-only">${escapeHtml(copyMarkdownHelp)}</span>
            <span id="copy-triage-json-help" class="sr-only">${escapeHtml(copyJsonHelp)}</span>
            ${copyButton("copy-triage-markdown", "Copy Markdown", "btn btn-primary", copyMarkdownHelp, "copy-triage-markdown-help")}
            ${copyButton("copy-triage-json", "Copy JSON", "btn", copyJsonHelp, "copy-triage-json-help")}
            ${navButton("work", "Open work list")}
          </div>
        </div>
      `, "", detailsOpenAttribute("triage-snapshot"))}
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
  return "Reset the triage tool to the default pasted work.";
}

function triageCopyMarkdownHelp(rows) {
  return rows.length ? `Copy ${rows.length} triage row(s) as Markdown.` : "Paste or add work before copying a Markdown handoff.";
}

function triageCopyJsonHelp(rows) {
  return rows.length ? `Copy ${rows.length} triage row(s) as JSON.` : "Paste or add work before copying a JSON snapshot.";
}

function triageInputHelp() {
  return "Paste loose task lines; Parse work turns them into Where, Blocker, and Button runs next rows.";
}

function defaultTriageInput() {
  return [
    "Finalize mobile demo polish - blocked by unclear bottom bar focus - evidence: mobile smoke in dark mode",
    "Write README employer story - needs concrete tool positioning",
    "Ship GitHub Pages update - run static export and live smoke",
    "Review issue backlog - set Button runs next for stale tasks"
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
  const blocker = blockerDisplayValue(row.blocker);
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
  return DEMO_BLOCKER_NONE_LABEL;
}

function inferNextAction(line, blocker) {
  const value = String(line || "").toLowerCase();
  if (!isUnblockedBlockerValue(blocker)) {
    return /unblock/.test(value) ? "Set Blocker: None" : "Review blocker";
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
  if (!isUnblockedBlockerValue(blocker)) {
    return "Blocker is named, reviewed, and Button runs next is safe to run.";
  }

  if (next === "Ship") return "Published artifact is live and checked.";
  if (next === "Test") return "Relevant check passes with current output.";
  if (next === "Draft") return "Draft is ready for review or handoff.";
  return "Visible result or handoff note is recorded.";
}

function triageCard(row) {
  const status = isUnblockedBlockerValue(row.blocker) ? "ready" : "blocked";
  const removeHelp = triageRemoveHelp(row);
  const removeHelpId = `triage-remove-help-${row.id}`;
  const workHelpId = `triage-work-${row.id}-help`;
  const workHelp = triageFieldHelp("work");
  return `<article class="demo-triage-card" data-triage-id="${escapeAttribute(row.id)}">
    <div class="demo-card-head">
      <label class="demo-field demo-triage-title" for="triage-work-${escapeAttribute(row.id)}">
        <span>Work</span>
        <input id="triage-work-${escapeAttribute(row.id)}" data-triage-field="work" type="text" value="${escapeAttribute(row.work)}"${fieldHelpAttributes(workHelpId, workHelp)}>
        <small id="${escapeAttribute(workHelpId)}" class="demo-field-help">${escapeHtml(workHelp)}</small>
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
  const helpId = `${id}-help`;
  const help = triageFieldHelp(field);
  return `<label class="demo-field${wide ? " demo-field-wide" : ""}" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <input id="${escapeAttribute(id)}" data-triage-field="${escapeAttribute(field)}" type="text" value="${escapeAttribute(row[field] || "")}"${fieldHelpAttributes(helpId, help)}>
    <small id="${escapeAttribute(helpId)}" class="demo-field-help">${escapeHtml(help)}</small>
  </label>`;
}

function triageFieldHelp(field) {
  const help = {
    work: "Name the work item before it enters the list.",
    where: "Name where this work lives or what state it is in.",
    blocker: "Name what blocks Button runs next; use None when clear.",
    evidence: "Name the evidence needed before handoff.",
    doneWhen: "Describe the proof target before this work is done."
  };
  return help[field] || "Explain what this field changes in the work path.";
}

function triageSelectInput(row, field, label) {
  const id = `triage-${field}-${row.id}`;
  const helpId = `${id}-help`;
  const help = triageSelectHelp();
  const options = ["Review blocker", "Start", "Open", "Focus", "Draft", "Fix", "Test", "Ship", "Contact", "Set Blocker: None", "Done"];
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <select id="${escapeAttribute(id)}" data-triage-field="${escapeAttribute(field)}" aria-describedby="${escapeAttribute(helpId)}" title="${escapeAttribute(help)}">
      ${options.map((option) => `<option value="${escapeAttribute(option)}"${option === row[field] ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
    </select>
    <small id="${escapeAttribute(helpId)}" class="demo-field-help">${escapeHtml(help)}</small>
  </label>`;
}

function triageSelectHelp() {
  return "Pick what Button runs next stores for this row; use Review blocker when Blocker is named.";
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
      blocker: DEMO_BLOCKER_NONE_LABEL,
      next: "Start",
      evidence: "Visible result or handoff note",
      doneWhen: "Visible result or handoff note is recorded."
    }));
    state.status = triageStatus(DEMO_BLOCKER_NONE, "edit the new row");
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
      state.status = triageStatus(DEMO_BLOCKER_NONE, `review ${state.triageRows.length} parsed row(s)`);
      render();
    });
  });
}

function triageStatus(blocker, next) {
  const visibleBlocker = blockerDisplayValue(blocker);
  return `Where: Triage. Blocker: ${visibleBlocker}. Button runs next: ${next}.`;
}

function triageParsedStatus(rowCount) {
  return rowCount > 0
    ? triageStatus(DEMO_BLOCKER_NONE, `review ${rowCount} parsed row(s)`)
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
  const blockerRows = rows.filter((row) => !isUnblockedBlockerValue(row.blocker)).length;

  return [
    {
      label: "Rows are local",
      status: true,
      detail: "No backend, issue tracker, or local files are touched."
    },
    {
      label: "Work named",
      status: rows.length > 0 && missingWork === 0,
      detail: rows.length === 0 ? "Paste or add work to create triage rows." : `${missingWork} row(s) missing work title.`
    },
    {
      label: "Button runs next",
      status: rows.length > 0 && missingNext === 0,
      detail: rows.length === 0 ? "Parse work to name Button runs next." : `${missingNext} row(s) still need a clear Button runs next.`
    },
    {
      label: "Blockers surfaced",
      status: rows.length > 0,
      detail: `${blockerRows} row(s) name a blocker for review.`
    },
    {
      label: "Evidence ready",
      status: rows.length > 0 && missingEvidence === 0,
      detail: rows.length === 0 ? "Paste or add work to name evidence before handoff." : `${missingEvidence} row(s) missing evidence.`
    }
  ];
}

function collectTriageSnapshot(rows = normalizedTriageRows()) {
  return {
    tool: "Button runs next: work triage tool",
    route: formatRouteHash("triage"),
    storage: DEMO_API_BASE_URL ? "backend API for this browser" : "browser localStorage only",
    rows: rows.map((row) => ({
      work: row.work,
      where: row.where,
      blocker: blockerDisplayValue(row.blocker),
      buttonRunsNext: row.next,
      evidenceNeeded: row.evidence,
      proofTarget: row.doneWhen
    })),
    generatedAt: new Date().toISOString()
  };
}

function triageMarkdown(rows = normalizedTriageRows()) {
  if (!rows.length) {
    return "# Button runs next triage\n\nPaste or add work to create triage rows before copying a handoff.";
  }

  const header = [
    "# Button runs next triage",
    "",
    "| Work | Where | Blocker | Button runs next | Evidence needed | Proof target |",
    "|---|---|---|---|---|---|"
  ];
  const body = rows.map((row) => [
    row.work,
    row.where,
    blockerDisplayValue(row.blocker),
    row.next,
    row.evidence,
    row.doneWhen
  ].map(markdownCell).join(" | "));
  return [...header, ...body.map((line) => `| ${line} |`), "", `_Generated locally from the Projects static demo._`].join("\n");
}

function markdownCell(value) {
  return String(value || DEMO_BLOCKER_NONE_LABEL).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function renderWork() {
  const visible = filteredPacks();
  const orderedVisible = selectedFirstPacks(visible);
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

function renderToday() {
  const today = state.packs.filter((pack) => pack.due || pack.status === "active");
  const dueState = setDueTodayState("Today");
  const dueHelp = dueState.help;
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Today</span>
          <h2>${today.length} ${escapeHtml(workNoun(today.length))}</h2>
        </div>
        <span class="demo-status">${today.length ? "work first" : "empty"}</span>
      </div>
      <div class="demo-list">${today.length ? today.map(todayRow).join("") : emptyState(`No ${profile().work} is due today.`, `Use Set all due today, ${profile().newWork.toLowerCase()}, or edit a due date.`, emptyStateContextFor("Today", `no active or dated ${profile().work} is visible`, `set all due today, ${profile().newWork.toLowerCase()}, or edit a due date`))}</div>
      ${optionalDetails("Date tools", "Open for bulk due-date cleanup.", `
        ${disabledReasonNotice(!dueState.canRun, dueHelp)}
        <div class="demo-card-actions">
          <span id="today-set-due-help" class="sr-only">${escapeHtml(dueHelp)}</span>
          <button class="btn" type="button" data-action="set-due-today"${controlHelpAttributes(!dueState.canRun, dueHelp, "today-set-due-help")}>Set all due today</button>
        </div>
      `)}
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
  const orderedReview = selectedFirstPacks(review);
  const selected = currentPack();
  const firstReview = selected && review.some((pack) => pack.id === selected.id) ? selected : review[0] || null;
  const reviewButtonReason = "Where: Review. Blocker: no work needs review. Button runs next: create or edit work.";
  const reviewState = firstReview ? `${review.length} needs decision` : "clear";
  const emptyReview = state.packs.length === 0
    ? emptyState(`No ${profile().work} is available.`, `${profile().newWork}, reset demo data, or choose a scenario with ${profile().work}.`, emptyStateContextFor("Review", `no ${workNoun(2)} exist in this browser`, `${profile().newWork.toLowerCase()}, reset demo data, or choose a scenario with ${profile().work}`))
    : emptyState(`No ${profile().work} needs review.`, `Choose a different scenario or add a blocker to ${profile().work}.`, emptyStateContextFor("Review", `no blockers or missing Button runs next items are visible`, `create or edit ${profile().work}`));
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
      ${routeActionReceiptPanel(review, "Review")}
      <div class="demo-review-list">${orderedReview.length ? orderedReview.map(reviewCard).join("") : emptyReview}</div>
    </section>
  `;
  bindListActions();
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
      <p>Pick what Button runs next stores for this work. The preview shows the button that will actually run after blocker rules apply.</p>
      <div class="demo-command-lines compact" data-next-preview>
        ${factLine("Where", workTitle(pack))}
        ${factLine("Blocker", blockerTextForPack(pack))}
        ${factLine("Button runs next", nextCommand.label)}
      </div>
      <div class="demo-inline-form">
        <label class="demo-field" for="next-action-choice">
          <span>Button runs next</span>
          <select id="next-action-choice" class="demo-search-input" aria-describedby="next-choice-preview-help" title="${escapeAttribute(nextSelectHelp)}">
            ${BUTTON_RUNS_NEXT_CHOICES.map((option) => {
              const selected = option === pack.next || (option === "Set Blocker: None" && commandActionForLabel(pack.next).action === "unblock");
              return `<option value="${escapeAttribute(option)}"${selected ? " selected" : ""}>${escapeHtml(option)}</option>`;
            }).join("")}
          </select>
          <small id="next-choice-preview-help" class="demo-field-help" aria-live="polite">${escapeHtml(nextPreviewHelp)}</small>
        </label>
        <span id="apply-next-action-help" class="sr-only">${escapeHtml(saveNextHelp)}</span>
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
      <div class="demo-list">${state.packs.filter(isReview).map(nextCandidateRow).join("") || emptyState("No work needs next setup.", "Open work, add a blocker, or clear Button runs next to create a candidate.", emptyStateContextFor("Next setup", "every visible work item already has a clear Button runs next path", "open work or create a review candidate"))}</div>
    </section>
  `;
  el("next-action-choice").addEventListener("change", () => syncNextChoicePreview(pack));
  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));
  syncNextChoicePreview(pack);
  bindListActions();
}

function renderCheck() {
  const checks = sampleChecks();
  const validateState = validateSampleState();
  const validateHelp = validateState.help;
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Check</span>
          <h2>Work readiness checks</h2>
        </div>
        <span id="validate-sample-help" class="sr-only">${escapeHtml(validateHelp)}</span>
        <button class="btn btn-primary" type="button" data-action="validate-sample"${controlHelpAttributes(!validateState.canRun, validateHelp, "validate-sample-help")}>Check work</button>
      </div>
      ${disabledReasonNotice(!validateState.canRun, validateHelp)}
      <div class="demo-check-list">
        ${checks.map(checkRow).join("")}
      </div>
    </section>
  `;
  bindListActions();
}

function setDueTodayState(surface = "Today") {
  const unfinished = state.packs.filter((pack) => pack.status !== "done").length;
  if (state.packs.length === 0) {
    return {
      canRun: false,
      help: `Where: ${surface}. Blocker: no work exists. Button runs next: create or reset work before setting due dates.`
    };
  }

  if (unfinished === 0) {
    return {
      canRun: false,
      help: `Where: ${surface}. Blocker: all work is done. Button runs next: create or reopen work before setting due dates.`
    };
  }

  return {
    canRun: true,
    help: `Where: ${surface}. Blocker: None. Button runs next: set ${unfinished} unfinished work item(s) due today in this browser.`
  };
}

function todayIsoDate(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function dueTodayStatus(date, updatedCount) {
  if (state.packs.length === 0) {
    return "Where: Today. Blocker: no work exists. Button runs next: create or reset work before setting due dates.";
  }

  if (updatedCount === 0) {
    return "Where: Today. Blocker: all work is done. Button runs next: create or reopen work before setting due dates.";
  }

  return `Where: Today. Blocker: None. Button runs next: review ${updatedCount} work item(s) due ${date}.`;
}

function validationStatus(attention) {
  if (state.packs.length === 0) {
    return "Where: Check. Blocker: no work exists. Button runs next: create or reset work before checking.";
  }

  return attention === 0
    ? "Where: Check. Blocker: None. Button runs next: keep work ready."
    : `Where: Check. Blocker: ${attention} check item(s) need attention. Button runs next: fix check items.`;
}

function saveNextChoiceHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: Next setup / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: save choice; preview shows ${command.label}.`;
}

function nextChoiceSelectHelp(pack, command = resolvePrimaryCommandForPack(pack)) {
  const blocker = hasBlocker(pack) && command.action !== "unblock"
    ? "; blocker rules still require review"
    : "";
  return `Choose what Button runs next stores on this work${blocker}.`;
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
  const blocker = hasBlocker(pack) && command.action !== "unblock"
    ? " because this work is still blocked"
    : "";
  return `After save, Button runs next shows ${command.label}${blocker}.`;
}

function validateSampleState() {
  if (state.packs.length === 0) {
    return {
      canRun: false,
      help: "Where: Check. Blocker: no work exists. Button runs next: create or reset work before checking."
    };
  }

  return {
    canRun: true,
    help: "Where: Check. Blocker: None. Button runs next: run work readiness checks and update demo status."
  };
}

function validateSampleHelp() {
  return validateSampleState().help;
}

function resetDemoHelp() {
  return "Reset demo work, profile, scenario, and edits in this browser.";
}

function renderFocus() {
  const pack = currentPack() || state.packs[0];
  if (!pack) {
    el("screen-content").innerHTML = emptyState("No work is available.", "Create work, reset demo data, or choose a scenario with work.", emptyStateContextFor("Focus", "no work exists in this browser", "create work, reset demo data, or choose a scenario with work"));
    return;
  }
  const focusCommand = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, focusCommand);
  const doneAction = focusCommand.action === "done"
    ? supportActionButton("done", "Finish with proof", pack)
    : "";
  const supportSummary = focusCommand.action === "done"
    ? "Extra tools for opening, editing, or saving proof."
    : "Extra tools for opening or editing this work.";

  state.selectedId = pack.id;
  el("screen-content").innerHTML = `
    <section class="demo-panel demo-focus-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Focused work</span>
          <h2>${escapeHtml(workTitle(pack))}</h2>
        </div>
        <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
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
      ${actionReceiptCard(pack)}
      <details class="demo-card-support">
        <summary>
          <span>Other actions</span>
          <strong>${escapeHtml(supportSummary)}</strong>
        </summary>
        <div class="demo-card-actions compact">
          ${supportActionButton("open", "Open", pack)}
          ${supportActionButton("edit", "Edit path", pack)}
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
    <div class="demo-grid demo-summary-strip">
      ${metricCard("Active", counts.active ?? 0, "Work currently moving.")}
      ${metricCard("Review", counts.review ?? 0, "Work with blockers or missing Button runs next.")}
      ${metricCard("Done", counts.done ?? 0, "Work marked complete.")}
    </div>
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Stats</span>
          <h2>Browser-state counts</h2>
        </div>
        <span class="demo-status">${state.packs.length} work item(s)</span>
      </div>
      <div class="demo-stat-list">
        ${["active", "blocked", "draft", "done", "review"].map((key) => statBar(key, counts[key] ?? 0, total)).join("")}
      </div>
    </section>
  `;
}

function renderNotes() {
  const rows = state.packs.flatMap((pack) => pack.memory.map((note) => ({ pack, note })));
  const emptyNotes = state.packs.length === 0
    ? emptyState("No notes exist.", "Create work or reset demo data before adding memory.", emptyStateContextFor("Notes", "no work exists in this browser", "create or reset work"))
    : emptyState("No notes exist.", "Open Memory and add a note to selected work.", emptyStateContextFor("Notes", "no memory notes have been saved in this browser", "open Memory and add a note"));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Notes</span>
          <h2>Notes across work</h2>
        </div>
        ${navButton("memory", "Open memory", "btn btn-primary")}
      </div>
      <div class="demo-list">
        ${rows.map(({ pack, note }) => `<div class="demo-note"><strong>${escapeHtml(workTitle(pack))}</strong>${escapeHtml(note)}</div>`).join("") || emptyNotes}
      </div>
    </section>
  `;
  bindGoButtons();
}

function renderTimeline() {
  const rows = state.packs.flatMap((pack) => pack.activity.map((item, index) => ({ pack, item, index })));
  const emptyTimeline = state.packs.length === 0
    ? emptyState("No activity exists.", "Create work or reset demo data before running Button runs next.", emptyStateContextFor("Timeline", "no work exists in this browser", "create or reset work"))
    : emptyState("No activity exists.", "Run Button runs next to add activity.", emptyStateContextFor("Timeline", "no Button runs next result has written activity yet", "run Button runs next"));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Timeline</span>
          <h2>Activity log</h2>
        </div>
      </div>
      <div class="demo-list">
        ${rows.map(timelineRow).join("") || emptyTimeline}
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
          <span class="section-label">${escapeHtml(profile().sources)}</span>
          <h2>${escapeHtml(profile().sources)}</h2>
        </div>
        <span class="demo-status">${escapeHtml(profile().sources)} stay in this browser</span>
      </div>
      <div class="demo-source-list">
        ${rows.map(sourceRow).join("") || emptyState(`No ${profile().sources.toLowerCase()} exist.`, "Choose a source-backed scenario.", emptyStateContextFor(profile().sources, `this scenario has no ${profile().sources.toLowerCase()}`, "choose a source-backed scenario"))}
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
  const dueState = setDueTodayState("Calendar");
  const dueHelp = dueState.help;
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Calendar</span>
          <h2>Due dates</h2>
        </div>
        <span class="demo-status">${rows.length} dated</span>
      </div>
      <div class="demo-calendar-grid">
        ${rows.map(calendarCard).join("") || emptyState("No due dates exist.", "Use Set all due today, create work, or edit a due date.", emptyStateContextFor("Calendar", "no work has a due date", "set all due today, create work, or edit a due date"))}
      </div>
      ${optionalDetails("Date tools", "Open for bulk due-date cleanup.", `
        ${disabledReasonNotice(!dueState.canRun, dueHelp)}
        <div class="demo-card-actions">
          <span id="calendar-set-due-help" class="sr-only">${escapeHtml(dueHelp)}</span>
          <button class="btn" type="button" data-action="set-due-today"${controlHelpAttributes(!dueState.canRun, dueHelp, "calendar-set-due-help")}>Set all due today</button>
        </div>
      `)}
    </section>
  `;
  bindListActions();
}

function renderSearch() {
  const visible = filteredPacks();
  const emptySearch = state.packs.length === 0
    ? emptyState(`No ${profile().work} is available.`, `${profile().newWork} or reset demo data before searching.`, emptyStateContextFor("Search", `no ${workNoun(2)} exist in this browser`, `create or reset ${profile().work}`))
    : emptyState(`No ${profile().work} matches the search.`, "Clear search or try title, owner, due date, or Button runs next.", emptyStateContextFor("Search", `search text hides every ${workNoun(1)}`, "clear search or try title, owner, due date, or Button runs next"));
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Search</span>
          <h2>Search every ${escapeHtml(workNoun(1))}</h2>
        </div>
        <span class="demo-status">${visible.length} match(es)</span>
      </div>
      <label class="sr-only" for="screen-search">Search demo ${escapeHtml(profile().work)}</label>
      <input id="screen-search" class="demo-search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search ${escapeAttribute(profile().work)} title, owner, Button runs next, source, or due date">
      <div class="demo-work-list demo-search-results">${visible.map(workCard).join("") || emptySearch}</div>
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
        <span class="demo-status">${escapeHtml(persistenceStatusText())}</span>
      </div>
      <div class="demo-form-grid">
        ${inputField("new-title", "Title", defaults.title, `Name the ${profile().work} before Save can run.`)}
        ${inputField("new-owner", "Owner", defaults.owner, "Name the person, team, or role responsible for the next step.")}
        ${buttonRunsNextSelectField("new-next", "Button runs next", defaults.next, "Choose the first action. Choose action means Save work stays paused.")}
        ${inputField("new-due", "Due", defaults.due, "Optional date used by Today and Calendar views.")}
        ${textField("new-purpose", "Why it matters", defaults.purpose, `Optional context for why this ${profile().work} exists.`)}
      </div>
      <p id="create-save-help" class="demo-field-help" aria-live="polite">${escapeHtml(createState.help)}</p>
      <button id="create-sample" class="btn btn-primary" type="button" aria-describedby="create-save-help"${disabledReasonAttributes(!createState.canSave, createState.help)}>${escapeHtml(persistenceVerb())}</button>
    </section>
  `;
  el("create-sample").addEventListener("click", createSamplePack);
  bindCreateValidation();
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
        </div>
        <span class="demo-status">${escapeHtml(persistenceEditStatus("Edits stay in this browser"))}</span>
      </div>
      <div class="demo-forward-panel" data-forward-motion="pack-detail">
        <div class="demo-forward-head">
          <span class="section-label">Next step</span>
          <strong>${escapeHtml(packCommand.label)}</strong>
        </div>
        ${workPathStrip(pack, packCommand)}
        ${selectedWorkTriad(pack, packCommand)}
        <div class="demo-form-grid demo-forward-fields">
          ${blockerStateField(pack)}
          ${showOwnerInline ? inputField("edit-owner", "Owner", pack.owner, "Fill owner to clear this owner-related blocker.") : ""}
          ${buttonRunsNextSelectField("edit-next", "Button runs next", editableButtonRunsNextValue(pack.next), "Choose the action the main button runs for the selected work.")}
          ${inputField("edit-done-when", "Proof target", pack.doneWhen, "Describe the evidence needed before this work is done.")}
        </div>
      </div>
      <details class="demo-support-details" data-support-details="pack-detail">
        <summary>
          <span>More fields</span>
          <strong>${escapeHtml(supportDetailsSummary(showOwnerInline))}</strong>
        </summary>
        <div class="demo-form-grid">
          ${inputField("edit-title", "Title", pack.title, "Renames this work item.")}
          ${showOwnerInline ? "" : inputField("edit-owner", "Owner", pack.owner, "Changing owner can resolve owner-related blockers.")}
          ${inputField("edit-due", "Due", pack.due, "Optional date used by Today and Calendar views.")}
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
        <input id="memory-note" class="demo-search-input" type="text" placeholder="Add a memory note">
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

function blockerStateField(pack) {
  const blockerState = blockerStateForPack(pack);
  const hasBlocker = blockerState.hasBlocker;
  const blocker = hasBlocker ? blockerState.reason : "";
  return `
      <fieldset class="demo-field demo-blocker-field" data-blocker-field>
      <legend>Blocker</legend>
      <div class="demo-segmented-control" role="radiogroup" aria-label="Blocker value">
        <label class="demo-segment${hasBlocker ? "" : " active"}" data-blocker-mode-label="clear" for="edit-blocker-clear">
          <input id="edit-blocker-clear" name="edit-blocker-mode" type="radio" value="clear" data-blocker-mode="clear" aria-describedby="edit-blocker-clear-help" title="Stores Blocker: None so Button runs next can run after saving."${hasBlocker ? "" : " checked"}>
          <span>None</span>
          <small id="edit-blocker-clear-help" class="sr-only">Stores Blocker: None so Button runs next can run after saving.</small>
        </label>
        <label class="demo-segment${hasBlocker ? " active" : ""}" data-blocker-mode-label="set" for="edit-blocker-set">
          <input id="edit-blocker-set" name="edit-blocker-mode" type="radio" value="set" data-blocker-mode="set" aria-describedby="edit-blocker-set-help" title="Names the blocker reason; Button runs next stays paused until it clears."${hasBlocker ? " checked" : ""}>
          <span>Blocked</span>
          <small id="edit-blocker-set-help" class="sr-only">Names the blocker reason; Button runs next stays paused until it clears.</small>
        </label>
      </div>
      ${ownerBlockerGuide(pack)}
      <div class="demo-blocker-reason" data-blocker-reason${hasBlocker ? "" : " hidden"}>
        <label for="edit-blocker">Why blocked?</label>
        <small class="demo-field-help">Choose a common reason, or write the reason that must clear before the button can run.</small>
        ${blockerPresetButtons(blocker)}
        <input id="edit-blocker" type="text" value="${escapeAttribute(blocker)}" placeholder="missing owner, source, approval..." aria-describedby="edit-blocker-help"${hasBlocker ? "" : disabledReasonAttributes(true, blockerInputDisabledReason())}>
      </div>
      <p id="edit-blocker-help" class="demo-field-help" data-blocker-help>${hasBlocker ? "Blocked pauses Button runs next until this reason clears." : "None stores Blocker: None automatically; no typing required."}</p>
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
    return "Owner filled. Button runs next: Set Blocker: None.";
  }

  return "Blocker is None. Button runs next: Save work path.";
}

function ownerBlockerGuideState(ownerFilled, blockerClear) {
  if (!ownerFilled) {
    return "fill-owner";
  }

  return blockerClear ? "ready-to-save" : "clear-blocker";
}

function blockerPresetButtons(currentBlocker = "") {
  const current = normalizeCopy(currentBlocker).toLowerCase();
  return `<div class="demo-blocker-presets" aria-label="Common blocker reasons">
    ${BLOCKER_REASON_PRESETS.map((preset) => {
      const active = normalizeCopy(preset).toLowerCase() === current;
      const help = active
        ? `Current blocker reason is ${preset}. Button runs next stays paused until this clears.`
        : `Set blocker reason to ${preset}. Button runs next stays paused until this clears.`;
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
  return "Where: Blocker. Blocker: None is selected. Button runs next: choose Blocked before typing a blocker reason.";
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
      <p>Copy profile changes labels in this static demo. Edits stay in this browser only; real app data is untouched.</p>
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
      ${optionalDetails("Scenarios", "Open for demo presets that replace the browser work state.", `
        <div class="demo-scenario-grid">
          ${DEMO_SCENARIOS.map((item) => `
            <button type="button" class="demo-scenario-card" data-scenario="${escapeAttribute(item.id)}" aria-pressed="${state.scenarioId === item.id}"${controlLabelAttributes(scenarioCardHelp(item, state.scenarioId === item.id))}>
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.description)}</span>
            </button>
          `).join("")}
        </div>
      `)}
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
      <p>Screen: <strong>${escapeHtml(state.route || "home")}</strong> · Theme: <strong>${document.documentElement.classList.contains("dark") ? "dark" : "light"}</strong> · Built: <strong>${escapeHtml(state.metadata.generatedAt ? new Date(state.metadata.generatedAt).toLocaleString() : "unknown")}</strong></p>
      <div class="demo-check-list">
        ${checks.map(healthLine).join("")}
      </div>
      ${optionalDetails("Counts", "Open for browser counts and current screen facts.", `
        <div class="demo-grid">
          ${metricCard("Data", state.packs.length, "Loaded work items for this demo.")}
          ${metricCard("Checks", checks.filter((check) => check.status).length, "Passing health checks.")}
          ${metricCard("Total checks", checks.length, "All expected demo checks.")}
          ${metricCard("Scenario", state.scenarioId, "Current scenario library preset.")}
        </div>
      `)}
      <p><small>Snapshot generated: ${escapeHtml(now)}</small></p>
    </section>
  `;
}

function renderFeedback() {
  const issueTitle = `Projects static demo issue (${stateVersionLabel()})`;
  const issueBody = feedbackIssueBody();
  const issueBaseUrl = state.metadata?.issueUrl || "";
  const issueUrl = issueBaseUrl
    ? `${issueBaseUrl}?title=${encodeURIComponent(issueTitle)}&labels=demo%2Cfeedback&body=${encodeURIComponent(issueBody)}`
    : "";
  const copyFeedbackHelp = clipboardStatus("Feedback", "copy issue context into the issue body");
  const openFeedbackHelp = issueUrl
    ? routeStatus("Feedback", DEMO_BLOCKER_NONE, "open the prefilled issue")
    : routeStatus("Feedback", "no public issue tracker is configured", "copy context");
  const feedbackContextHelp = "Review or edit the issue context before copying it into a feedback report.";
  const openFeedbackAction = issueUrl
    ? `<a class="btn btn-primary" id="open-feedback" href="${escapeAttribute(issueUrl)}" rel="noopener noreferrer" target="_blank"${controlHelpAttributes(false, openFeedbackHelp, "open-feedback-help")}>Open issue</a>`
    : "";
  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Feedback</span>
          <h2>Report a demo issue</h2>
        </div>
        <span class="demo-status">${escapeHtml(stateVersionLabel())}</span>
      </div>
      <p>Copy the current demo context. The raw text is available below if you want to inspect it first.</p>
      <div class="demo-card-actions">
        <span id="copy-feedback-help" class="sr-only">${escapeHtml(copyFeedbackHelp)}</span>
        <span id="open-feedback-help" class="sr-only">${escapeHtml(openFeedbackHelp)}</span>
        ${copyButton("copy-feedback", "Copy context", "btn", copyFeedbackHelp, "copy-feedback-help")}
        ${openFeedbackAction}
      </div>
      ${clipboardNoticePanel("copy-feedback")}
      ${optionalDetails("Issue text", "Open for copyable context before filing feedback.", `
        <div class="${copyPayloadClass("feedback-context")}">
          <label class="sr-only" for="feedback-context">Demo issue context</label>
          <textarea id="feedback-context" class="demo-search-input" rows="10"${fieldHelpAttributes("feedback-context-help", feedbackContextHelp)}>${escapeHtml(issueBody)}</textarea>
          ${fieldHelp("feedback-context", feedbackContextHelp)}
        </div>
      `, "", `data-support-details="feedback-context" ${detailsOpenAttribute("feedback-context")}`)}
    </section>
  `;
  el("copy-feedback").addEventListener("click", copyFeedbackContext);
  el("open-feedback")?.addEventListener("click", () => {
    state.status = routeStatus("Feedback", DEMO_BLOCKER_NONE, "review the prefilled issue");
  });
}

function feedbackIssueBody() {
  const context = collectDiagnosticContext();
  return `Context:\n\n${JSON.stringify(context, null, 2)}`;
}

function copyFeedbackContext() {
  const copyFeedbackHelp = clipboardStatus("Feedback", "copy issue context into the issue body");
  copyToClipboard(valueOf("feedback-context") || feedbackIssueBody(), copyFeedbackHelp, {
    controlId: "copy-feedback",
    targetId: "feedback-context",
      title: "Issue context copied",
      detail: "The issue context is on the clipboard."
  });
}

function renderMeta() {
  const counts = countByFilter();
  const checks = buildHealthChecks();
  const passing = checks.filter((check) => check.status).length;
  const context = collectDiagnosticContext();
  const styleAudit = buildStyleAuditSnapshot();
  const now = new Date().toLocaleString();
  const copyMetaHelp = clipboardStatus("Meta", "copy build and current path context");
  const copyStyleAuditHelp = clipboardStatus("Meta", "copy shipped file check");
  const metaContextHelp = "Review or edit the current build snapshot before copying it for handoff.";
  const styleAuditHelp = "Review or edit the shipped file check before copying it for review.";

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Demo checks</span>
          <h2>Build snapshot</h2>
        </div>
        <span class="demo-status">${escapeHtml(context.version || stateVersionLabel())}</span>
      </div>
      <p>A compact summary from this browser's work and live checks.</p>
      <div class="demo-grid">
        ${metricCard("Version", context.version || stateVersionLabel(), "Build label from the exported demo.")}
        ${metricCard("Scenario", state.scenarioId, "Active demo preset.")}
        ${metricCard("Review", counts.review, "Needs follow-up in this browser.")}
        ${metricCard("Health", `${passing}/${checks.length}`, "Checks passing now.")}
      </div>
      ${clipboardNoticePanel("copy-meta-context")}
      ${clipboardNoticePanel("copy-style-audit")}
      ${optionalDetails("Proof", "Open for live checks, shipped files, and copyable snapshots.", `
        <div class="demo-detail-section">
          <h3>Live checks</h3>
          <div class="demo-check-list">
            ${checks.map(healthLine).join("")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Static files</h3>
          <div class="demo-grid">
            ${metricCard("Demo CSS", styleAuditMetric("demoCss", "lines"), styleAuditDetail("demoCss"))}
            ${metricCard("Product CSS", styleAuditMetric("productCss", "lines"), styleAuditDetail("productCss"))}
            ${metricCard("Style total", formatBytes(styleAudit.totals.cssBytes), `${styleAudit.totals.cssLines} style lines shipped.`)}
            ${metricCard("Screens", styleAudit.routeCount, `${navItems.length} navigation screens plus work path.`)}
          </div>
          <div class="demo-check-list">
            ${styleAuditChecks().map(healthLine).join("")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Work counts</h3>
          <div class="demo-grid">
            ${metricCard("Active work", counts.active, "Work ready to act on.")}
            ${metricCard("Blocked work", counts.blocked, "Work blocked or missing Button runs next.")}
            ${metricCard("Done work", counts.done, "Completed work items.")}
            ${metricCard("All work", counts.all, "Total work loaded.")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Copy proof</h3>
          <div class="${copyPayloadClass("meta-context")}">
            <label class="sr-only" for="meta-context">Build snapshot text</label>
            <textarea id="meta-context" class="demo-search-input" rows="8"${fieldHelpAttributes("meta-context-help", metaContextHelp)}>${escapeHtml(JSON.stringify(context, null, 2))}</textarea>
            ${fieldHelp("meta-context", metaContextHelp)}
          </div>
          <div class="${copyPayloadClass("style-audit")}">
            <label class="sr-only" for="style-audit">Shipped file check text</label>
            <textarea id="style-audit" class="demo-search-input" rows="8"${fieldHelpAttributes("style-audit-help", styleAuditHelp)}>${escapeHtml(JSON.stringify(styleAudit, null, 2))}</textarea>
            ${fieldHelp("style-audit", styleAuditHelp)}
          </div>
          <div class="demo-card-actions">
            <span id="copy-meta-context-help" class="sr-only">${escapeHtml(copyMetaHelp)}</span>
            <span id="copy-style-audit-help" class="sr-only">${escapeHtml(copyStyleAuditHelp)}</span>
            ${copyButton("copy-meta-context", "Copy build snapshot", "btn", copyMetaHelp, "copy-meta-context-help")}
            ${copyButton("copy-style-audit", "Copy file check", "btn", copyStyleAuditHelp, "copy-style-audit-help")}
          </div>
        </div>
      `, "", detailsOpenAttribute("meta-context", "style-audit"))}
      <p><small>Snapshot generated: ${escapeHtml(now)}</small></p>
    </section>
  `;
  el("copy-meta-context").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(context, null, 2), clipboardStatus("Meta", "share the build snapshot"), {
      controlId: "copy-meta-context",
      targetId: "meta-context",
      title: "Build snapshot copied",
      detail: "The current screen, Current path, build, and file summary are on the clipboard."
    });
  });
  el("copy-style-audit").addEventListener("click", () => {
    copyToClipboard(JSON.stringify(styleAudit, null, 2), clipboardStatus("Meta", "share the file check"), {
      controlId: "copy-style-audit",
      targetId: "style-audit",
      title: "File check copied",
      detail: "The shipped file check is on the clipboard."
    });
  });
}

function renderLab() {
  const pack = currentPack() || preferredReviewPack();
  const action = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, action);
  const styleAudit = buildStyleAuditSnapshot();
  const initialChecks = labSmokeChecks(pack, styleAudit);
  const snapshot = collectLabSnapshot(pack, action, styleAudit, initialChecks);
  const noPackReason = labNoPackReason();
  const labPackSelectHelp = labPackSelectReason(state.packs.length > 0);
  const labRunHelp = pack ? labRunActionHelp(pack, action) : noPackReason;
  const labSetNextHelp = pack ? labSetNextActionHelp(pack) : noPackReason;
  const copyLabSnapshotHelp = clipboardStatus("Demo Lab", "copy work snapshot");
  const labSnapshotHelp = "Review or edit the work snapshot before copying it as evidence.";
  const labOptions = state.packs.length
    ? state.packs.map((item) => `<option value="${escapeAttribute(item.id)}"${item.id === pack?.id ? " selected" : ""}>${escapeHtml(workTitle(item))} / ${escapeHtml(resolvePrimaryCommandForPack(item).label)}</option>`).join("")
    : `<option value="" selected>No work: create, reset, or choose scenario</option>`;

  if (pack && pack.id !== state.selectedId) {
    state.selectedId = pack.id;
  }

  el("screen-content").innerHTML = `
    <section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Demo Lab</span>
          <h2>Button runs next test</h2>
        </div>
        <span class="demo-status">${escapeHtml(action.label)}</span>
      </div>
      <p>Pick work, inspect the blocker, then run the same Button runs next shown in Current path.</p>
      <div class="demo-grid">
        ${metricCard("Selected", pack ? workTitle(pack) : "Choose work", pack ? `${workflow.label} / ${pack.owner}` : "Choose work to inspect its path.")}
        ${metricCard("Blocker", blockerTextForPack(pack), "The reason the work needs attention.")}
        ${metricCard("Runs next", action.label, "Selected work shows this Button runs next value.")}
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
        ${factLine("Where", pack ? workTitle(pack) : "Choose work")}
        ${factLine("Blocker", blockerTextForPack(pack))}
        ${factLine("Button runs next", action.label)}
      </div>
      ${optionalDetails("Proof", "Open for screen checks, file sizes, and copyable work snapshot.", `
        <div class="demo-detail-section">
          <h3>Screen checks</h3>
          <div id="lab-smoke-checks" class="demo-check-list">
            ${initialChecks.map(healthLine).join("")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Static files</h3>
          <div class="demo-stat-list">
            ${styleAudit.assets.map((asset) => assetBudgetRow(asset, styleAudit.totals.bytes)).join("")}
          </div>
        </div>
        <div class="demo-detail-section">
          <h3>Work snapshot</h3>
          <div class="${copyPayloadClass("lab-snapshot")}">
            <label class="sr-only" for="lab-snapshot">Work snapshot text</label>
            <textarea id="lab-snapshot" class="demo-search-input" rows="10"${fieldHelpAttributes("lab-snapshot-help", labSnapshotHelp)}>${escapeHtml(JSON.stringify(snapshot, null, 2))}</textarea>
            ${fieldHelp("lab-snapshot", labSnapshotHelp)}
          </div>
          <div class="demo-card-actions">
            <span id="copy-lab-snapshot-help" class="sr-only">${escapeHtml(copyLabSnapshotHelp)}</span>
            ${copyButton("copy-lab-snapshot", "Copy work snapshot", "btn btn-primary", copyLabSnapshotHelp, "copy-lab-snapshot-help")}
            ${navButton("meta", "Open meta")}
          </div>
          ${clipboardNoticePanel("copy-lab-snapshot")}
        </div>
      `, "", detailsOpenAttribute("lab-snapshot"))}
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
    ? "Where: Demo Lab. Blocker: None. Button runs next: choose work to preview Button runs next."
    : "Where: Demo Lab. Blocker: no work is available. Button runs next: create work, reset demo data, or choose a scenario with work.";
}

function labNoPackReason() {
  return state.packs.length === 0
    ? "Where: Demo Lab. Blocker: no work exists. Button runs next: create work, reset demo data, or choose a scenario with work."
    : "Where: Demo Lab. Blocker: no work is selected. Button runs next: choose work.";
}

function labRunActionHelp(pack, action) {
  return `Where: Demo Lab / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: run ${action.label}.`;
}

function labSetNextActionHelp(pack) {
  return `Where: Demo Lab / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: set Button runs next.`;
}

function workToolbar(label) {
  const currentWork = profile().work;
  return `
    <section class="demo-toolbar" aria-label="${escapeAttribute(label)}">
      <label class="sr-only" for="demo-search">Search demo ${escapeHtml(currentWork)}</label>
      <input id="demo-search" class="demo-search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search ${escapeAttribute(currentWork)} title, Button runs next, owner, or due date" autocomplete="off">
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
    return `Where: No ${profile().work} loaded. Blocker: no ${workNoun(2)} exist. Button runs next: ${emptyNext}.`;
  }

  return `Where: No ${profile().work} selected. Blocker: choose a ${workNoun(1)}. Button runs next: ${next}.`;
}

function selectedWorkStatus(surface, pack, next = resolvePrimaryCommandForPack(pack).label) {
  return `Where: ${surface} / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next}.`;
}

function profileCardHelp(key, value, active) {
  const prefix = active ? "Current copy profile" : "Apply copy profile";
  return `${prefix}: ${capitalize(key)}. Labels use ${value.newWork}, ${value.work}, and ${value.sources}.`;
}

function scenarioCardHelp(scenario, active) {
  const prefix = active ? "Current scenario" : "Apply scenario";
  return `${prefix}: ${scenario.label}. ${scenario.description}`;
}

function cardTitleButtonHelp(pack, action = "select") {
  const verb = action === "focus" ? "Focus" : "Select";
  const command = resolvePrimaryCommandForPack(pack);
  return `${verb} ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${command.label}.`;
}

function cardTitleButtonAttributes(pack, action = "select") {
  const copy = helpCopy(cardTitleButtonHelp(pack, action), DEMO_COPY_LIMITS.commandFlowHelp);
  return ` title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}"`;
}

function boardColumn(status) {
  const packs = state.packs.filter((pack) => pack.status === status);
  const emptyBoard = state.packs.length === 0
    ? emptyState(`No ${status} work.`, "Create work, reset demo data, or choose a scenario with work.", emptyStateContextFor(`${capitalize(status)} lane`, "no work exists in this browser", "create work, reset demo data, or choose a scenario with work"))
    : emptyState(`No ${status} work.`, "Change filters, choose another scenario, or edit work status.", emptyStateContextFor(`${capitalize(status)} lane`, `no work is marked ${status}`, "edit work status or choose another scenario"));
  return `<section class="demo-board-column">
    <div class="demo-board-head">
      <strong>${escapeHtml(capitalize(status))}</strong>
      <span>${packs.length}</span>
    </div>
    <div class="demo-list">
      ${packs.map(boardMiniCard).join("") || emptyBoard}
    </div>
  </section>`;
}

function boardMiniCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  return `<article class="demo-mini-card">
    <button type="button" class="demo-card-title" data-action="focus" data-pack="${escapeAttribute(pack.id)}"${cardTitleButtonAttributes(pack, "focus")}>${escapeHtml(workTitle(pack))}</button>
    <span>${escapeHtml(isUnblockedBlockerValue(pack.blocker) ? command.label : blockerDisplayValue(pack.blocker))}</span>
  </article>`;
}

function nextCandidateRow(pack) {
  return `<div class="demo-row has-row-support" data-pack-id="${escapeAttribute(pack.id)}">
    <div>
      <strong>${escapeHtml(workTitle(pack))}</strong>
      <span>${escapeHtml(isUnblockedBlockerValue(pack.blocker) ? "Ready for a clearer Button runs next." : blockerDisplayValue(pack.blocker))}</span>
    </div>
    <div class="demo-row-actions">
      ${supportActionButton("set-next", "Set Button runs next", pack, "btn btn-sm btn-primary")}
    </div>
    ${compactRowSupport("Focus this work without changing Button runs next.", supportActionButton("focus", "Focus", pack, "btn btn-sm"))}
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

function sampleChecks() {
  const missingOwner = state.packs.filter((pack) => !pack.owner || pack.owner === "No owner" || pack.owner === "unassigned").length;
  const missingNext = state.packs.filter(isMissingNextAction).length;
  const blocked = state.packs.filter((pack) => pack.status === "blocked").length;
  const missingDue = state.packs.filter((pack) => !pack.due && pack.status !== "done").length;
  return [
    ["Owners", missingOwner, "Every moving work item should name an owner."],
    ["Button runs next", missingNext, "Each work item needs a clear Button runs next value."],
    ["Blocked", blocked, "Blocked work should say what is blocking it."],
    ["Due dates", missingDue, "Unfinished work can optionally carry a date."]
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
      <strong>${escapeHtml(workTitle(pack))}</strong>
      <span>${escapeHtml(item)}</span>
    </div>
    <span class="demo-state-pill">${index === 0 ? "latest" : "earlier"}</span>
  </div>`;
}

function sourceRow({ pack, source }) {
  return `<div class="demo-row has-row-support" data-pack-id="${escapeAttribute(pack.id)}">
    <div>
      <strong>${escapeHtml(source)}</strong>
      <span>${escapeHtml(workTitle(pack))} / ${escapeHtml(pack.type)}</span>
    </div>
    <div class="demo-row-actions">
      ${primaryCommandButton(pack, "btn btn-sm btn-primary")}
    </div>
    ${compactRowSupport("Focus this work without changing Button runs next.", supportActionButton("focus", "Focus", pack, "btn btn-sm"))}
  </div>`;
}

function calendarCard(pack) {
  const workflow = workflowStateForPack(pack);
  return `<article class="demo-calendar-card" data-pack-id="${escapeAttribute(pack.id)}">
    <span>${escapeHtml(pack.due)}</span>
    <strong>${escapeHtml(workTitle(pack))}</strong>
    <small>${escapeHtml(workflow.label)} / ${escapeHtml(pack.owner)}</small>
    ${primaryCommandButton(pack, "btn btn-sm btn-primary")}
    ${compactRowSupport("Focus this work without changing Button runs next.", supportActionButton("focus", "Focus", pack, "btn btn-sm"))}
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
    copy.addEventListener("click", () => copyToClipboard(valueOf("lab-snapshot"), clipboardStatus("Demo Lab", "share the work snapshot"), {
      controlId: "copy-lab-snapshot",
      targetId: "lab-snapshot",
      title: "Work snapshot copied",
      detail: "The Button runs next work snapshot is on the clipboard."
    }));
  }
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
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-command-row">
      <div>
        <span>Button runs next</span>
        <strong>${escapeHtml(command.label)}</strong>
      </div>
      ${primaryCommandButton(pack)}
      ${primaryCommandReasonNote(pack, command)}
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(`Blocker: ${blockerDisplayValue(pack.blocker)}`)}</span>
      <span>${escapeHtml(formatDue(pack))}</span>
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
        ${blockerAction}
        ${supportActionButton("done", "Finish with proof", pack, "btn btn-sm")}
      </div>
    </details>
  </article>`;
}

function todayRow(pack) {
  return `<div class="demo-row has-row-support">
    <div>
      <strong>${escapeHtml(workTitle(pack))}</strong>
      <span>${escapeHtml(formatDue(pack))} / ${escapeHtml(pack.owner)}</span>
    </div>
    <div class="demo-row-actions">
      ${primaryCommandButton(pack, "btn btn-sm btn-primary")}
    </div>
    ${compactRowSupport("Focus this work without changing Button runs next.", supportActionButton("focus", "Focus", pack, "btn btn-sm"))}
  </div>`;
}

function reviewCard(pack) {
  const command = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, command);
  const cardClass = workflowCardClass("demo-review-card", pack, workflow, pack.id === state.selectedId);
  const blockerAction = hasBlocker(pack)
    ? supportActionButton("unblock", "Clear blocker", pack)
    : supportActionButton("block", "Mark blocked", pack);
  const nextHelpId = `next-${pack.id}-help`;
  const nextHelp = `Set the exact Button runs next value for ${workTitle(pack)}.`;

  return `<article class="${escapeAttribute(cardClass)}" data-pack-id="${escapeAttribute(pack.id)}">
    <div class="demo-card-head demo-review-card-head">
      <button type="button" class="demo-card-title" data-action="select" data-pack="${escapeAttribute(pack.id)}"${cardTitleButtonAttributes(pack)}>${escapeHtml(workTitle(pack))}</button>
      <span class="demo-state-pill" title="${escapeAttribute(workflow.help)}">${escapeHtml(workflow.label)}</span>
    </div>
    <div class="demo-review-card-main">
      <div class="demo-card-facts">
        ${cardFact("Blocker", blockerTextForPack(pack))}
        ${cardFact("Button runs next", command.label)}
      </div>
      <div class="demo-review-card-actions">
        ${primaryCommandButton(pack)}
        ${primaryCommandReasonNote(pack, command)}
      </div>
    </div>
    <div class="demo-card-meta">
      <span>${escapeHtml(formatDue(pack))}</span>
      <span>${escapeHtml(pack.owner)}</span>
    </div>
    ${relevantMemoryCardStrip(pack)}
    ${actionReceiptCard(pack)}
    <details class="demo-card-support" data-support-actions="review-card">
      <summary>
        <span>Other actions</span>
        <strong>Extra tools for focusing, editing, clearing blockers, or setting Button runs next.</strong>
      </summary>
      <div class="demo-card-actions">
        ${supportActionButton("focus", "Focus", pack)}
        ${supportActionButton("edit", "Edit", pack)}
        ${blockerAction}
      </div>
      <div class="demo-inline-form">
        ${buttonRunsNextSelectField(`next-${pack.id}`, "Button runs next", editableButtonRunsNextValue(pack.next), nextHelp)}
        ${supportActionButton("set-next", "Save Button runs next", pack)}
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
  const command = resolvePrimaryCommandForPack(pack);
  const copy = helpCopy(primaryCommandReason(pack, command), DEMO_COPY_LIMITS.commandFlowHelp);
  return `<button class="${escapeAttribute(className)}" type="button" data-action="run-next" data-pack="${escapeAttribute(pack.id)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(command.label)}</button>`;
}

function primaryCommandReason(pack, command = resolvePrimaryCommandForPack(pack)) {
  return `Where: ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${command.label}.`;
}

function primaryCommandReasonNote(pack, command = resolvePrimaryCommandForPack(pack)) {
  const reason = primaryCommandVisibleReason(pack, command);
  const copy = copySurface(reason, DEMO_COPY_LIMITS.commandFlowVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  return `<small class="demo-primary-reason" data-primary-action-reason title="${escapeAttribute(copy.help)}" aria-label="${escapeAttribute(copy.help)}">${escapeHtml(copy.visible)}</small>`;
}

function primaryCommandVisibleReason(pack, command = resolvePrimaryCommandForPack(pack)) {
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
  const copy = commandRunLabel(command);
  const label = command.next || "Open work list";
  return `<button id="pack-primary-action" class="btn btn-primary demo-pack-primary-action" type="button" data-action="${escapeAttribute(command.action || "")}" data-pack="${escapeAttribute(command.targetPackId || "")}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(label)}</button>`;
}

function syncPackPrimaryAction(command) {
  const button = el("pack-primary-action");
  if (!button) {
    return;
  }

  setCopySurface(button, command.next, "Button runs next", DEMO_COPY_LIMITS.commandButtonVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  button.dataset.action = command.action || "";
  button.dataset.pack = command.targetPackId || "";
  button.setAttribute("aria-label", commandRunLabel(command));
  button.title = commandRunLabel(command);
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
  const current = isMissingNextAction(pack) ? "Button runs next is missing" : `Button runs next is ${commandForSupportAction.label || "set"}`;
  const reasons = {
    open: `Open ${where} to inspect it without changing where Blocker is ${blocker}.`,
    focus: `Open ${where} focus view only; this does not run the main button.`,
    block: `Mark ${where} blocked to pause work while blocker details are confirmed.`,
    unblock: `Clear blocker for ${where}; this allows Button runs next to continue when set.`,
    done: `Finish ${where} and capture proof when workflow is ready to close.`,
    edit: `Edit ${where} path fields used by Button runs next.`,
    "set-next": `Set Button runs next for ${where} so the next action is deterministic. Current state: ${current}.`,
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
    return `Where: ${where} / done. Blocker: proof is already saved. Button runs next: Open to inspect this work.`;
  }

  const command = resolvePrimaryCommandForPack(pack);
  if (command.action === "done") {
    if (!normalizeCopy(pack?.doneWhen)) {
      return `Where: ${where}. Blocker: proof target is missing. Button runs next: add proof target before finishing with proof.`;
    }

    return "";
  }

  if (isMissingNextAction(pack)) {
    return `Where: ${where}. Blocker: Button runs next is missing. Button runs next: set Button runs next before finishing with proof.`;
  }

  if (hasBlocker(pack)) {
    return `Where: ${where}. Blocker: ${blockerTextForPack(pack)}. Button runs next: clear blocker before finishing with proof.`;
  }

  return `Where: ${where}. Blocker: Button runs next is ${command.label}. Button runs next: choose Finish with proof before saving proof.`;
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
    return "Set Button runs next for this work before finishing with proof.";
  }

  if (hasBlocker(pack)) {
    return `Clear blocker (${where}) before finishing with proof.`;
  }

  const command = resolvePrimaryCommandForPack(pack);
  if (command.action === "done" && !normalizeCopy(pack?.doneWhen)) {
    return "Add proof target first before finishing with proof.";
  }

  return "Choose Finish with proof as Button runs next.";
}

function supportActionVisibleReason(action) {
  const reasons = {
    open: "Open fields without running next.",
    focus: "Inspect without changing status.",
    block: "Add a blocker for review.",
    unblock: "Stores Blocker: None.",
    done: "Finish with proof visible.",
    edit: "Edit work path fields.",
    "set-next": "Choose the exact Button runs next value."
  };
  return reasons[action] || "Other button.";
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
    if (button.closest(".demo-work-card") || button.id === "pack-primary-action") {
      return;
    }

    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "set-due-today") {
        const dueState = setDueTodayState(screenTitleForRoute());
        if (!dueState.canRun) {
          state.status = dueState.help;
          render();
          return;
        }
        const today = todayIsoDate();
        const updated = state.packs.filter((pack) => pack.status !== "done");
        updated.forEach((pack) => { pack.due = today; });
        state.status = dueTodayStatus(today, updated.length);
      } else if (action === "validate-sample") {
        const validateState = validateSampleState();
        if (!validateState.canRun) {
          state.status = validateState.help;
          render();
          return;
        }
        const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
        state.status = validationStatus(attention);
      } else if (action === "set-next") {
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
              state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Button runs next: retry or refresh.`;
            }
          } else {
            state.status = selectedWorkStatus("Next setup", pack, "choose Button runs next");
            go("next", pack.id);
            return;
          }
        } else {
          state.status = noSelectedWorkStatus("choose work before setting Button runs next");
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
  const title = workTitle(pack);
  if (action === "done") {
    const proof = proofTargetSentence(pack);
    return changed
      ? `Done saved for ${title}. ${proof}`
      : `Done already saved for ${title}. ${proof}`;
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

  const nextLabel = result?.label || buttonRunsNextDisplayLabel(result?.next);
  const summary = result.changed
    ? `Button runs next set to ${nextLabel} for ${workTitle(pack)}.`
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
    `Created ${workTitle(pack)}. State: ${workflow.label}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next.label}.`,
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
  return `Where: ${workTitle(pack)} / ${workflow.label}. Blocker: ${blockerTextForPack(pack)}. Button runs next: ${next.label}.${proof}`;
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
      ${receiptLine("Button runs next", receipt.next)}
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
    ${receiptLine("Button runs next", receipt.next)}
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
  const help = `Where: Memory / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: continue work; next action is ${next.label}.`;
  return `<div class="demo-card-receipt-actions">
    <button class="btn btn-sm btn-primary" type="button" data-go="pack" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(help)}>Continue work</button>
    <small>${escapeHtml(`Returns to selected work. Button runs next stays ${next.label}.`)}</small>
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
  const help = `Where: Memory / ${workTitle(pack)}. Blocker: ${blockerTextForPack(pack)}. Button runs next: continue work; next action is ${next.label}.`;
  return `<div class="demo-command-receipt-actions">
    <button class="btn btn-sm btn-primary" type="button" data-go="pack" data-pack="${escapeAttribute(pack.id)}"${controlLabelAttributes(help)}>Continue work</button>
    <small>${escapeHtml(`Returns to selected work. Button runs next stays ${next.label}.`)}</small>
  </div>`;
}

function bindCommandReceiptActions(receiptElement) {
  receiptElement.querySelectorAll("[data-go]").forEach(bindGoButton);
}

function receiptAccessibleSummary(receipt) {
  const context = `Where: ${sentenceValue(receipt.where)}. Blocker: ${sentenceValue(receipt.blocker)}. Button runs next: ${sentenceValue(receipt.next)}. Proof target: ${sentenceValue(receipt.proof)}.`;
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
    state.status = `Where: Backend memory. Blocker: ${error.message || "API failed"}. Button runs next: retry or refresh.`;
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
  const label = buttonRunsNextDisplayLabel(pack.next);
  if (changed) {
    addPackActivity(pack, `Button runs next changed to ${label}.`);
  }

  return { changed, next: pack.next, label };
}

function nextChoiceForwardPath(pack, value) {
  const next = normalizeCopy(value) || "Open";
  const blocker = normalizeCopy(pack?.blocker) === "missing Button runs next"
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
    state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Button runs next: retry or refresh.`;
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
    queueFocus("selected-card", pack.id);
  } else if (action === "run-next") {
    runResolvedPackAction(pack);
    return;
  } else if (action === "review") {
    openReviewFixPath(pack);
    return;
  } else if (action === "set-next") {
    state.status = selectedWorkStatus("Next setup", pack, "choose Button runs next");
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
      state.status = `Where: Backend action. Blocker: ${error.message || "API failed"}. Button runs next: retry or refresh.`;
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
  } else if (action === "done") {
    const before = packActionSignature(pack);
    pack.status = "done";
    pack.blocker = DEMO_BLOCKER_NONE;
    pack.next = "Open";
    const changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, proofSavedActivity(pack));
    }
    setPackActionConfirmation(pack, "done", changed);
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
  const action = control?.dataset.action || el("primary-action").dataset.action;
  const targetPackId = control?.dataset.pack || el("primary-action").dataset.pack;
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

  const resolved = resolvePrimaryCommandForPack(pack);
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
    return "set Button runs next";
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

  savePackForwardPathFromForm(pack);
  render();
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

  state.status = `Where: Work path. Blocker: ${issue}. Button runs next: ${blockerModeFixNext(issue)}.`;
  syncPackDetailValidation(pack);
  requestAnimationFrame(() => focusCommandTarget(blockerModeFocusKind(issue), pack.id));
  return true;
}

function runRouteAction(action, targetPackId) {
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

      savePackForwardPathFromForm(selected);
      render();
    }
    return true;
  }

  if (action === "fix-blocker-mode") {
    const selected = findPack(targetPackId) || currentPack();
    if (selected) {
      const issue = blockerModeIssue() || "blocked mode needs a real blocker";
      queueFocus(blockerModeFocusKind(issue), selected.id);
      state.status = `Where: Work path. Blocker: ${issue}. Button runs next: ${blockerModeFixNext(issue)}.`;
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

  if (action === "search-demo") {
    if (state.route !== "search") {
      queueFocus("search-input");
      state.status = routeStatus("Search", "search field is not open", "focus search");
      go("search");
      return true;
    }

    queueFocus("search-input");
    state.status = routeStatus("Search", state.query ? `${filteredPacks().length} match(es) visible` : "no search text yet", state.query ? "refine search" : "type search text");
    render();
    return true;
  }

  if (action === "validate-sample") {
    const validateState = validateSampleState();
    if (!validateState.canRun) {
      state.status = validateState.help;
      render();
      return true;
    }
    const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
    state.status = validationStatus(attention);
    render();
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

  if (action === "choose-profile") {
    if (state.route !== "settings") {
      queueFocus("settings-profile");
      state.status = routeStatus("Settings", "copy profile chooser is not open", "choose copy profile");
      go("settings");
      return true;
    }

    queueFocus("settings-profile");
    state.status = routeStatus("Settings", "choose one copy profile card", "use selected profile labels");
    render();
    return true;
  }

  if (action === "refresh-health") {
      state.status = routeStatus("Health", DEMO_BLOCKER_NONE, "review current demo checks");
    render();
    return true;
  }

  if (action === "copy-feedback-context") {
    if (state.route !== "feedback") {
      queueFocus("feedback-context");
      state.status = routeStatus("Feedback", "feedback context is not open", "copy context");
      go("feedback");
      return true;
    }
    copyFeedbackContext();
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

  if (normalized === "review blocker") {
    return { label: "Review blocker", action: "review" };
  }

  if (normalized === "review" || normalized === "review work") {
    return { label: "Review work", action: "review-work" };
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

function buttonRunsNextDisplayLabel(value) {
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
    help: `Where: Create. Blocker: ${blockerDisplayValue(workflow.blocker)}. Button runs next: ${next}.`
  };
}

function createActionForBlocker(blocker) {
  if (blocker === "missing title") {
    return "Fill title";
  }

  if (blocker === "missing owner") {
    return "Fill owner";
  }

  if (blocker === "missing Button runs next") {
    return "Choose Button runs next";
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
  syncCreateRouteCommand();
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
        ? "Where: Memory. Blocker: no work exists. Button runs next: create or reset work before adding memory."
        : "Where: Memory. Blocker: no work is selected. Button runs next: choose work before adding memory."
    };
  }

  if (!String(note || "").trim()) {
    return {
      canSave: false,
      help: `Where: Memory. Blocker: memory note is empty. Button runs next: type a note for ${workTitle(pack)}.`
    };
  }

  return {
    canSave: true,
    help: `Where: Memory. Blocker: None. Button runs next: add memory note to ${workTitle(pack)}.`
  };
}

function memoryRouteStatus(pack) {
  if (pack) {
    return `Where: Memory / ${workTitle(pack)}. Blocker: memory note is empty. Button runs next: type a note for ${workTitle(pack)}.`;
  }

  return state.packs.length === 0
    ? "Where: Memory. Blocker: no work exists. Button runs next: create or reset work before adding memory."
    : "Where: Memory. Blocker: no work is selected. Button runs next: choose work before adding memory.";
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
        ? "Where: Work path. Blocker: no work exists. Button runs next: create or reset work before saving."
        : "Where: Work path. Blocker: no work is selected. Button runs next: choose work before saving."
    };
  }

  const blockerIssue = blockerModeIssue();
  if (blockerIssue) {
    return {
      canSave: false,
      help: `Where: Work path. Blocker: ${blockerIssue}. Button runs next: ${blockerModeFixNext(blockerIssue)}.`
    };
  }

  if (ownerBlockerNeedsClear()) {
    return {
      canSave: false,
      help: "Where: Work path. Blocker: owner is filled but Blocker is still set. Button runs next: Set Blocker: None."
    };
  }

  const changed = packForwardPathFormSignature(pack) !== packForwardPathSignature(pack);
  if (!changed) {
    return {
      canSave: false,
      help: "Where: Work path. Blocker: no changes to save. Button runs next: edit a field first."
    };
  }

  const pending = pendingPackFromForwardPathForm(pack);
  return {
    canSave: true,
    help: `Where: Work path. Blocker: ${blockerTextForPack(pending)}. Button runs next: save work path for ${workTitle(pending)}.`
  };
}

function packDetailSaveNote(stateForSave) {
  const help = normalizeCopy(stateForSave?.help);
  if (!help) {
    return "";
  }

  if (stateForSave.canSave) {
    return "Unsaved work-path changes. Button runs next saves them first.";
  }

  if (help.includes("no changes to save")) {
    return "";
  }

  if (help.includes("owner is filled but Blocker is still set")) {
    return "Owner is filled. Button runs next saves Blocker: None.";
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
      syncPackDetailValidation(pack);
      input?.focus();
    });
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
    next.value = "Open";
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
    help.textContent = issue || (hasBlocker && !ownerResolvedBlocker ? "Blocked pauses Button runs next until this reason clears." : clearHelp);
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
    return "Where: Blocker. Blocker: not owner-related. Button runs next: choose None or edit the blocker reason.";
  }

  if (isMissingOwnerValue(owner)) {
    return "Where: Blocker. Blocker: owner is still missing. Button runs next: fill Owner before setting Blocker: None.";
  }

  return "Where: Blocker. Blocker: no owner blocker to clear. Button runs next: choose Blocked with an owner blocker first.";
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
    setWorkDetailSubtitle(`Fix ${issue}. Button runs next: ${blockerModeFixNext(issue)}.`);
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
    setWorkDetailSubtitle("Owner filled. Button runs next: Set Blocker: None.");
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
    command.stateHelp = `Unsaved work path changes. Button runs next saves them first. After save, the button shows ${nextAfterSave}.`;
    command.flowHint = `Flow: save work path, then ${nextAfterSave}.`;
    command.runNote = `Saves pending work path changes. After save, ${nextAfterSave} is visible.`;
    if (head) head.textContent = saveAction;
    setWorkDetailSubtitle(`Unsaved changes. Button runs next: ${saveAction}.`);
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
    `Work state: ${stateLabel}. Work path: ${current}. Button runs next: ${label}.`,
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
    state.status = `Where: Backend create. Blocker: ${error.message || "API failed"}. Button runs next: retry or refresh.`;
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
    return { status: "draft", blocker: "missing Button runs next" };
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

function savePackForwardPathFromForm(pack) {
  const before = packForwardPathSnapshot(pack);
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
  const values = packForwardPathFormValues(pack);
  pack.title = values.title || pack.title;
  pack.status = values.status || pack.status;
  pack.blocker = values.blocker;
  pack.owner = values.owner || pack.owner;
  pack.due = values.due;
  pack.next = values.next || pack.next;
  pack.doneWhen = values.doneWhen || pack.doneWhen;
  pack.purpose = values.purpose || pack.purpose;
  pack.blocker = pack.status === "done" ? DEMO_BLOCKER_NONE : pack.blocker;
  if (pack.status === "blocked" && isUnblockedBlockerValue(pack.blocker)) {
    pack.status = "active";
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
  const rawBlocker = blockerMode === "set"
    ? normalizeCopy(blockerInput ? blockerInput.value : pack.blocker) || "needs review"
    : DEMO_BLOCKER_NONE;
  const blocker = currentStatus === "done" ? DEMO_BLOCKER_NONE : rawBlocker;
  const status = forwardPathStatusForBlocker(currentStatus, blocker, requestedNext);

  return {
    title: fieldValue("edit-title", pack.title) || pack.title || "",
    status,
    blocker,
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
  return !value || value === "choose action" || value === "choose next action" || value === "set button runs next" || value === "set next";
}

function editableButtonRunsNextValue(value) {
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
    return "missing Button runs next";
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

function formatDue(pack) {
  return pack.due ? `Due ${pack.due}` : "No due date";
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
  return `<button class="${escapeAttribute(className)}" type="button" data-go="${escapeAttribute(route)}" title="${escapeAttribute(copy)}" aria-label="${escapeAttribute(copy)}">${escapeHtml(label)}</button>`;
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
    triage: `Open triage to turn pasted ${profile().work} into Where, Blocker, and Button runs next.`,
    today: `Open dated ${profile().work} and run Button runs next from due items.`,
    board: `Open the status board to compare ${profile().work} lanes.`,
    review: `Open review ${profile().work} and resolve the next blocker.`,
    next: "Open Button runs next setup for review work.",
    check: "Open demo checks for screen and action coverage.",
    health: "Open demo health for navigation, asset, and state checks.",
    search: `Open search to find ${profile().work} by title, owner, due date, or next action.`,
    stats: `Open counts for visible ${profile().work}, review, and done states.`,
    notes: `Open notes for selected ${profile().work}.`,
    timeline: "Open browser-only activity written by demo actions.",
    files: `Open ${profile().sources.toLowerCase()} used by the ${workNoun(2)}.`,
    calendar: `Open due-date ${profile().work} and date-based actions.`,
    lab: `Open Demo Lab to inspect the selected ${profile().work} state.`,
    meta: "Open Meta to inspect screens, assets, and build info.",
    create: `Create ${profile().work} with title, owner, and Button runs next.`,
    memory: `Open Memory to add recall notes to selected ${profile().work}.`,
    settings: "Change the static demo copy profile.",
    feedback: "Open feedback with the current demo context."
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
    ${selectedWorkTriadLine("Button runs next", command.label, "next")}
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
    const label = key === "next" ? "Button runs next" : capitalize(key);
    setCopySurface(field, value, label, DEMO_COPY_LIMITS.commandFieldVisible, DEMO_COPY_LIMITS.commandFlowHelp);
  });
}

function workDetailSubtitle(pack, command = resolvePrimaryCommandForPack(pack)) {
  const blocker = blockerTextForPack(pack);
  if (isMissingNextAction(pack)) {
    return "Needs Button runs next. Choose what the main button should do.";
  }

  return hasBlocker(pack)
    ? `Blocked by ${blocker}. Button runs next: ${command.label}.`
    : `Ready. Button runs next: ${command.label}.`;
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

function supportDetailsSummary(ownerIsInline) {
  return ownerIsInline
    ? "Open for optional title, due date, and purpose."
    : "Open for optional owner, due date, and purpose.";
}

function relevantMemoryStrip(pack) {
  const latest = latestRelevantMemory(pack);
  const stateClass = latest ? "has-memory" : "is-empty";
  const visible = latest
    ? visibleCopy(latest, DEMO_COPY_LIMITS.memoryVisible)
    : "none yet";
  const help = latest
    ? `Relevant Memory: ${sentenceValue(latest)}. ${memoryStripNextLine(pack)}.`
    : `Relevant Memory: none yet. How to fill: add a memory note from the Memory screen. ${memoryStripNextLine(pack)}.`;
  const actionLabel = memoryStripActionLabel(pack, latest);
  const actionHelp = memoryStripActionHelp(pack, latest);

  return `<div class="demo-memory-strip ${escapeAttribute(stateClass)}" data-memory-strip="selected-work" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      <small class="demo-memory-next">${escapeHtml(memoryStripNextLine(pack))}</small>
      ${latest ? "" : `<small>How to fill: add a memory note from here or from the Memory screen.</small>`}
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
    : "none yet";
  const help = latest
    ? `Relevant Memory: ${sentenceValue(latest)}. ${memoryStripNextLine(pack)}.`
    : `Relevant Memory: none yet. Add a memory note from the selected work path. ${memoryStripNextLine(pack)}.`;
  const actionLabel = memoryStripActionLabel(pack, latest);
  const actionHelp = memoryStripActionHelp(pack, latest);

  return `<div class="demo-memory-strip compact ${escapeAttribute(stateClass)}" data-memory-strip="selected-card" title="${escapeAttribute(help)}" aria-label="${escapeAttribute(help)}">
    <div class="demo-memory-copy">
      <span>Relevant Memory</span>
      <strong>${escapeHtml(visible)}</strong>
      <small class="demo-memory-next">${escapeHtml(memoryStripNextLine(pack))}</small>
      ${latest ? "" : `<small>How to fill: open Memory or selected work to add recall.</small>`}
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
      ? "Button runs next: create or reset work"
      : "Button runs next: choose work";
  }

  return `Button runs next: ${resolvePrimaryCommandForPack(pack).label}`;
}

function memoryStripActionHelp(pack, latest = latestRelevantMemory(pack)) {
  if (!pack) {
    return state.packs.length === 0
      ? "Where: Relevant Memory. Blocker: no work exists. Button runs next: create or reset work before adding memory."
      : "Where: Relevant Memory. Blocker: no work is selected. Button runs next: choose work before adding memory.";
  }

  return latest
    ? `Where: Relevant Memory / ${workTitle(pack)}. Blocker: None. Button runs next: open saved memory for this work.`
    : `Where: Relevant Memory / ${workTitle(pack)}. Blocker: no saved memory note yet. Button runs next: add memory note.`;
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

  return `<div class="demo-work-path" data-work-path="selected-work" aria-label="${escapeAttribute(`Work state: ${workflow.label}. Work path: ${current}. Button runs next: ${command.label}.`)}">
    <span class="section-label">Work path</span>
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
    { id: "review", label: "Review", help: "Clear the blocker or run Button runs next." },
    { id: "proof", label: "Proof", help: "Run Button runs next and keep the proof target visible." },
    { id: "done", label: "Done", help: "Finish when proof is ready." }
  ];
}

function workPathStage(pack, command = resolvePrimaryCommandForPack(pack)) {
  return workflowStateForPack(pack, command).path;
}

function inputField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  return `<label class="demo-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <input id="${escapeAttribute(id)}" type="text" value="${escapeAttribute(value || "")}"${fieldHelpAttributes(describedBy, help)}>
    ${fieldHelp(id, help)}
  </label>`;
}

function buttonRunsNextSelectField(id, label, value, help = "") {
  const describedBy = help ? `${id}-help` : "";
  return `<label class="demo-field demo-action-choice-field" for="${escapeAttribute(id)}">
    <span>${escapeHtml(label)}</span>
    <select id="${escapeAttribute(id)}" class="demo-search-input"${fieldHelpAttributes(describedBy, help)}>
      ${buttonRunsNextOptions(value).map((option) => `<option value="${escapeAttribute(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
    </select>
    ${fieldHelp(id, help)}
  </label>`;
}

function buttonRunsNextOptions(value) {
  const current = normalizedButtonRunsNextChoice(value);
  const options = current && !BUTTON_RUNS_NEXT_CHOICES.includes(current)
    ? [current, ...BUTTON_RUNS_NEXT_CHOICES]
    : [...BUTTON_RUNS_NEXT_CHOICES];

  return [
    { value: "", label: "Choose action (required)", selected: !current },
    ...options.map((option) => ({ value: option, label: option, selected: option === current }))
  ];
}

function normalizedButtonRunsNextChoice(value) {
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

function recentActivityPanel() {
  const rows = state.packs.flatMap((pack) => pack.activity.slice(0, 2).map((item) => ({ pack, item }))).slice(0, 6);
  return `<section class="demo-panel">
    <div class="demo-panel-head">
      <div>
        <span class="section-label">Activity</span>
        <h2>Recent activity</h2>
      </div>
    </div>
    <div class="demo-list">${rows.map(({ pack, item }) => `<div class="demo-row"><div><strong>${escapeHtml(workTitle(pack))}</strong><span>${escapeHtml(item)}</span></div></div>`).join("")}</div>
  </section>`;
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
  state.status = routeStatus("Meta", "checks are refreshing", "wait for updated checks");
  render();
  collectStyleAudit().then((styleAudit) => {
    state.styleAudit = styleAudit;
      state.status = routeStatus("Meta", DEMO_BLOCKER_NONE, "review updated checks");
    if (state.route === "meta") {
      render();
    }
  });
}

function buildMetadata(rawMetadata = {}) {
  const fallbackVersion = DEMO_DEFAULT_VERSION;
  return {
    version: rawMetadata?.version || fallbackVersion,
    commit: rawMetadata?.commit || "unknown",
    generatedAt: rawMetadata?.generatedAt || rawMetadata?.generated || new Date().toISOString(),
    issueUrl: rawMetadata?.issueUrl || "",
    releaseNotesUrl: rawMetadata?.releaseNotesUrl || "",
    repository: rawMetadata?.repository || "",
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
  const supportReasons = supportActionReasonCoverageStatus();
  const primaryReasons = primaryActionReasonCoverageStatus();
  const emptyStates = emptyStateCoverageStatus();
  const receipts = receiptCoverageStatus();
  const selectGuidance = selectGuidanceCoverageStatus();
  const memoryGuidance = memoryGuidanceCoverageStatus();
  const fieldGuidance = fieldGuidanceCoverageStatus();
  const plainLanguage = plainLanguageCoverageStatus();
  const detailsOptIn = detailsOptInCoverageStatus();
  const copySurfaces = copySurfaceCoverageStatus();
  const compactLabels = compactLabelCoverageStatus();
  const northStar = northStarCoverageStatus();
  const checks = [
    {
      label: "Build info loaded",
      status: Boolean(state.metadata && state.metadata.version),
      detail: state.metadata?.version ? `Version ${state.metadata.version}` : "Build info not available."
    },
    {
      label: "Theme system",
      status: Boolean(state.metadata),
      detail: document.documentElement.classList.contains("dark") ? "Dark mode active." : "Light mode active."
    },
    {
      label: "Browser save",
      status: canUseLocalStorage(DEMO_STORAGE_KEY),
      detail: "Action receipts stay in this browser."
    },
    {
      label: "Scenario selected",
      status: Boolean(DEMO_SCENARIO_BY_ID[state.scenarioId]),
      detail: `Scenario ${state.scenarioId} applied.`
    },
    {
      label: "Navigation fallback",
      status: isKnownRoute(state.route),
      detail: `Current screen: ${screenTitleForRoute()}.`
    },
    {
      label: "Navigation links",
      status: routeContract.status,
      detail: routeContract.detail
    },
    {
      label: "North Star coverage",
      status: northStar.status,
      detail: northStar.detail
    },
    {
      label: "Disabled button reasons",
      status: disabledReasons.status,
      detail: disabledReasons.detail
    },
    {
      label: "Support action reasons",
      status: supportReasons.status,
      detail: supportReasons.detail
    },
    {
      label: "Primary action reasons",
      status: primaryReasons.status,
      detail: primaryReasons.detail
    },
    {
      label: "Empty state guidance",
      status: emptyStates.status,
      detail: emptyStates.detail
    },
    {
      label: "Confirmation guidance",
      status: receipts.status,
      detail: receipts.detail
    },
    {
      label: "Dropdown guidance",
      status: selectGuidance.status,
      detail: selectGuidance.detail
    },
    {
      label: "Memory guidance",
      status: memoryGuidance.status,
      detail: memoryGuidance.detail
    },
    {
      label: "Field guidance",
      status: fieldGuidance.status,
      detail: fieldGuidance.detail
    },
    {
      label: "Plain language",
      status: plainLanguage.status,
      detail: plainLanguage.detail
    },
    {
      label: "Support opt-in",
      status: detailsOptIn.status,
      detail: detailsOptIn.detail
    },
    {
      label: "Copy labels",
      status: copySurfaces.status,
      detail: copySurfaces.detail
    },
    {
      label: "Compact label limits",
      status: compactLabels.status,
      detail: compactLabels.detail
    },
    {
      label: "Work list loaded",
      status: Array.isArray(state.packs) && state.packs.length > 0,
      detail: `${state.packs.length} work item(s) available.`
    },
    {
      label: "Shipped files",
      status: state.styleAudit?.status === "ready",
      detail: styleAuditSummary()
    }
  ];
  return checks;
}

function styleAuditSummary() {
  const audit = state.styleAudit;
  if (!audit) {
    return "File sizes are still loading.";
  }

  const failed = audit.assets.filter((asset) => !asset.status);
  if (failed.length > 0) {
    return `${failed.length} shipped file(s) could not be measured.`;
  }

  return `${audit.totals.cssLines} style lines and ${formatBytes(audit.totals.cssBytes)} measured.`;
}

function copyLimitStatus() {
  const limits = copyLimitsSnapshot();
  const status = limits.commandField.visible > 0
    && limits.commandButton.visible > 0
    && limits.commandFlow.visible > 0
    && limits.commandField.help >= limits.commandField.visible
    && limits.commandButton.help >= limits.commandButton.visible
    && limits.commandFlow.help >= limits.commandFlow.visible
    && limits.compactButton.help >= limits.compactButton.visible
    && limits.compactBadge.help >= limits.compactBadge.visible
    && limits.compactNav.help >= limits.compactNav.visible
    && limits.receipt.help >= limits.receipt.visible
    && limits.status.help >= limits.status.visible;
  return {
    status,
    detail: `Visible/help budgets: fields ${limits.commandField.visible}/${limits.commandField.help}, buttons ${limits.commandButton.visible}/${limits.commandButton.help}, compact buttons ${limits.compactButton.visible}/${limits.compactButton.help}, flow ${limits.commandFlow.visible}/${limits.commandFlow.help}, receipt ${limits.receipt.visible}/${limits.receipt.help}, status ${limits.status.visible}/${limits.status.help}.`
  };
}

function copyLimitsSnapshot() {
  return {
    commandField: {
      visible: DEMO_COPY_LIMITS.commandFieldVisible,
      help: DEMO_COPY_LIMITS.commandFlowHelp
    },
    commandButton: {
      visible: DEMO_COPY_LIMITS.commandButtonVisible,
      help: DEMO_COPY_LIMITS.commandFlowHelp
    },
    commandFlow: {
      visible: DEMO_COPY_LIMITS.commandFlowVisible,
      help: DEMO_COPY_LIMITS.commandFlowHelp
    },
    compactButton: {
      visible: DEMO_COPY_LIMITS.compactButtonVisible,
      help: DEMO_COPY_LIMITS.compactHelp
    },
    compactBadge: {
      visible: DEMO_COPY_LIMITS.compactBadgeVisible,
      help: DEMO_COPY_LIMITS.compactHelp
    },
    compactNav: {
      visible: DEMO_COPY_LIMITS.compactNavVisible,
      help: DEMO_COPY_LIMITS.compactHelp
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
  const navRouteIds = navItems.map((item) => item.route);
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
      missingContracts.length ? `missing route links: ${missingContracts.join(", ")}` : "",
      missingNavEntries.length ? `missing nav: ${missingNavEntries.join(", ")}` : "",
      invalidPackPatterns.length ? `route id mismatch: ${invalidPackPatterns.join(", ")}` : "",
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
      ? `${routeIds.length} navigation link(s) aligned; unknown screen ${parsed.requestedRoute} opened #/home.`
      : `${routeIds.length} navigation link(s) aligned; current screen pattern ${parsed.pattern}.`
  };
}

function buildStyleAuditSnapshot() {
  const audit = state.styleAudit || emptyStyleAudit();
  const routeContract = routeContractStatus();
  const copySurfaces = copySurfaceCoverageStatus();
  const northStar = northStarCoverageStatus();
  const supportReasons = supportActionReasonCoverageStatus();
  const emptyStates = emptyStateCoverageStatus();
  const receipts = receiptCoverageStatus();
  const selectGuidance = selectGuidanceCoverageStatus();
  const memoryGuidance = memoryGuidanceCoverageStatus();
  const fieldGuidance = fieldGuidanceCoverageStatus();
  const plainLanguage = plainLanguageCoverageStatus();
  const detailsOptIn = detailsOptInCoverageStatus();
  const compactLabels = compactLabelCoverageStatus();
  return {
    status: audit.status,
    generatedAt: audit.generatedAt,
    storageKey: DEMO_STORAGE_KEY,
    routeCount: routeContract.routeCount,
    currentRoute: state.route,
    routeContract,
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    copyLimits: copyLimitsSnapshot(),
    northStarCoverage: northStar,
    commandSync: commandSyncStatus(),
    currentOverflow: currentOverflowStatus(),
    disabledReasonCoverage: disabledReasonCoverageStatus(),
    supportActionReasonCoverage: supportReasons,
    emptyStateCoverage: emptyStates,
    receiptCoverage: receipts,
    selectGuidanceCoverage: selectGuidance,
    memoryGuidanceCoverage: memoryGuidance,
    fieldGuidanceCoverage: fieldGuidance,
    plainLanguageCoverage: plainLanguage,
    detailsOptInCoverage: detailsOptIn,
    copySurfaceCoverage: copySurfaces,
    compactLabelCoverage: compactLabels,
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
      label: "Demo script measured",
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
      label: "Navigation links",
      status: audit.routeContract.status,
      detail: audit.routeContract.detail
    },
    {
      label: "North Star coverage",
      status: audit.northStarCoverage.status,
      detail: audit.northStarCoverage.detail
    },
    {
      label: "Current path controls sync",
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
      label: "Support action reasons",
      status: audit.supportActionReasonCoverage.status,
      detail: audit.supportActionReasonCoverage.detail
    },
    {
      label: "Empty state guidance",
      status: audit.emptyStateCoverage.status,
      detail: audit.emptyStateCoverage.detail
    },
    {
      label: "Receipt guidance",
      status: audit.receiptCoverage.status,
      detail: audit.receiptCoverage.detail
    },
    {
      label: "Select guidance",
      status: audit.selectGuidanceCoverage.status,
      detail: audit.selectGuidanceCoverage.detail
    },
    {
      label: "Memory guidance",
      status: audit.memoryGuidanceCoverage.status,
      detail: audit.memoryGuidanceCoverage.detail
    },
    {
      label: "Field guidance",
      status: audit.fieldGuidanceCoverage.status,
      detail: audit.fieldGuidanceCoverage.detail
    },
    {
      label: "Plain language",
      status: audit.plainLanguageCoverage.status,
      detail: audit.plainLanguageCoverage.detail
    },
    {
      label: "Support opt-in",
      status: audit.detailsOptInCoverage.status,
      detail: audit.detailsOptInCoverage.detail
    },
    {
      label: "Copy labels",
      status: audit.copySurfaceCoverage.status,
      detail: audit.copySurfaceCoverage.detail
    },
    {
      label: "Compact label limits",
      status: audit.compactLabelCoverage.status,
      detail: audit.compactLabelCoverage.detail
    },
    {
      label: "Copy length limits",
      status: copyLimitStatus().status,
      detail: copyLimitStatus().detail
    },
    {
      label: "Build timestamp",
      status: Boolean(state.metadata?.generatedAt),
      detail: state.metadata?.generatedAt
        ? `Generated ${new Date(state.metadata.generatedAt).toLocaleString()}.`
        : "Generated timestamp not available."
    }
  ];
}

function collectLabSnapshot(pack, action, styleAudit, smokeChecks = labSmokeChecks(pack, styleAudit)) {
  const workflow = workflowStateForPack(pack, action);
  return {
    route: state.route,
    routeHash: location.hash,
    selectedWork: pack
      ? {
          id: pack.id,
          title: workTitle(pack),
          status: pack.status,
          workflowState: workflow.label,
          blocker: blockerTextForPack(pack),
          buttonRunsNext: pack.next,
          buttonRunsNextLabel: action.label,
          buttonRunsNextRouteAction: action.action
        }
      : null,
    currentPath: {
      where: el("command-where")?.textContent.trim() || "",
      blocker: el("command-blocker")?.textContent.trim() || "",
      buttonRunsNext: el("command-next")?.textContent.trim() || "",
      buttonRunsNextAction: el("primary-action")?.dataset.action || "",
      buttonRunsNextPack: el("primary-action")?.dataset.pack || ""
    },
    focusTargets: {
      where: formatRouteHash("work", pack?.id || ""),
      blocker: pack && isReview(pack) ? formatRouteHash("review", pack.id) : formatRouteHash("review"),
      buttonRunsNext: pack && isMissingNextAction(pack) ? formatRouteHash("next", pack.id) : "current Button runs next"
    },
    styleAudit: {
      status: styleAudit.status,
      cssLines: styleAudit.totals.cssLines,
      cssBytes: styleAudit.totals.cssBytes,
      routeCount: styleAudit.routeCount,
      northStarCoverage: northStarCoverageStatus(),
      copySurfaceCoverage: copySurfaceCoverageStatus(),
      compactLabelCoverage: compactLabelCoverageStatus()
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
  const northStar = northStarCoverageStatus();
  const copySurfaces = copySurfaceCoverageStatus();
  const supportReasons = supportActionReasonCoverageStatus();
  const emptyStates = emptyStateCoverageStatus();
  const receipts = receiptCoverageStatus();
  const selectGuidance = selectGuidanceCoverageStatus();
  const memoryGuidance = memoryGuidanceCoverageStatus();
  const fieldGuidance = fieldGuidanceCoverageStatus();
  const plainLanguage = plainLanguageCoverageStatus();
  const detailsOptIn = detailsOptInCoverageStatus();
  const compactLabels = compactLabelCoverageStatus();
  const disabledReasonCheck = disabledReasons ? [{
    label: "Disabled control reasons",
    status: disabledReasons.status,
    detail: disabledReasons.detail
  }] : [];

  return [
    {
      label: "Selected work",
      status: Boolean(pack),
      detail: pack ? `${workTitle(pack)} is loaded into the lab.` : "Choose work to load it into the lab."
    },
    {
      label: "Blocker visible",
      status: Boolean(pack),
      detail: blockerTextForPack(pack)
    },
    {
      label: "Button preview",
      status: Boolean(pack && action.action),
      detail: pack ? `Button runs next shows ${action.label}.` : "Choose work so the Lab can preview Button runs next."
    },
    {
      label: "Bottom bar focus",
      status: true,
      detail: "Where, Blocker, and Button runs next scroll to active targets."
    },
    {
      label: "North Star coverage",
      status: northStar.status,
      detail: northStar.detail
    },
    {
      label: "Header and bottom bar sync",
      status: sync.status,
      detail: sync.detail
    },
    {
      label: "Current route overflow",
      status: overflow.status,
      detail: overflow.detail
    },
    {
      label: "Copy labels",
      status: copySurfaces.status,
      detail: copySurfaces.detail
    },
    {
      label: "Compact label limits",
      status: compactLabels.status,
      detail: compactLabels.detail
    },
    {
      label: "Support action reasons",
      status: supportReasons.status,
      detail: supportReasons.detail
    },
    {
      label: "Empty state guidance",
      status: emptyStates.status,
      detail: emptyStates.detail
    },
    {
      label: "Receipt guidance",
      status: receipts.status,
      detail: receipts.detail
    },
    {
      label: "Select guidance",
      status: selectGuidance.status,
      detail: selectGuidance.detail
    },
    {
      label: "Memory guidance",
      status: memoryGuidance.status,
      detail: memoryGuidance.detail
    },
    {
      label: "Field guidance",
      status: fieldGuidance.status,
      detail: fieldGuidance.detail
    },
    {
      label: "Plain language",
      status: plainLanguage.status,
      detail: plainLanguage.detail
    },
    {
      label: "Support opt-in",
      status: detailsOptIn.status,
      detail: detailsOptIn.detail
    },
    ...disabledReasonCheck,
    {
      label: "File check ready",
      status: styleAudit.status === "ready",
      detail: `${styleAudit.totals.cssLines} style lines measured.`
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
  const fieldPairs = [
    ["Where", el("command-where"), el("dock-where")],
    ["Blocker", el("command-blocker"), el("dock-blocker")],
    ["Button runs next", el("command-next"), dockLabel]
  ];
  const mismatchedFields = fieldPairs
    .filter(([, commandField, dockField]) => copySurfaceAuditText(commandField) !== copySurfaceAuditText(dockField))
    .map(([label]) => label);
  const status = Boolean(primary && dock && labelsMatch && actionMatches && packMatches && mismatchedFields.length === 0);

  return {
    status,
    mismatchedFields,
    detail: status
      ? `${primaryLabel} is wired to the same Where, Blocker, and Button runs next in Current path and bottom bar.`
      : `Current path and bottom bar differ: ${mismatchedFields.concat(labelsMatch ? [] : ["label"], actionMatches ? [] : ["action"], packMatches ? [] : ["work"]).join(", ") || "unknown wiring"}.`
  };
}

function copySurfaceAuditText(element) {
  return normalizeCopy(element?.getAttribute("aria-label") || element?.textContent || "");
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

function northStarCoverageStatus() {
  const commandFields = [
    { id: "command-where", label: "Current path Where" },
    { id: "command-blocker", label: "Current path Blocker" },
    { id: "command-next", label: "Current path Button runs next" }
  ];
  const dockFields = [
    { id: "dock-where", label: "bottom bar Where" },
    { id: "dock-blocker", label: "bottom bar Blocker" },
    { id: "dock-next-label", label: "bottom bar Button runs next" }
  ];
  const dockVisible = northStarReadableElement(document.querySelector(".demo-bottom-brief"));
  const requiredFields = dockVisible ? commandFields.concat(dockFields) : commandFields;
  const missing = requiredFields
    .filter((field) => !northStarReadableElement(document.getElementById(field.id)))
    .map((field) => field.label);
  const primary = document.getElementById("primary-action");
  const dock = document.getElementById("dock-next");

  if (!northStarReadableElement(primary) || !normalizeCopy(primary?.dataset.action)) {
    missing.push("header Button runs next wiring");
  }

  if (dockVisible && (!northStarReadableElement(dock) || !normalizeCopy(dock?.dataset.action))) {
    missing.push("bottom bar Button runs next wiring");
  }

  if (document.querySelector('[data-forward-motion="pack-detail"]')) {
    const selectedRequirements = [
      { selector: '[data-work-path="selected-work"]', label: "selected work path" },
      { selector: '[data-memory-strip="selected-work"]', label: "selected Relevant Memory" },
      { selector: '[data-forward-motion="pack-detail"] [data-command-field="where"]', label: "selected Where" },
      { selector: '[data-forward-motion="pack-detail"] [data-command-field="blocker"]', label: "selected Blocker" },
      { selector: '[data-forward-motion="pack-detail"] [data-command-field="button-runs-next"]', label: "selected Button runs next" }
    ];
    missing.push(...selectedRequirements
      .filter((item) => !northStarReadableElement(document.querySelector(item.selector)))
      .map((item) => item.label));
  }

  const selectedCardCount = Array.from(document.querySelectorAll(".demo-work-card.selected, .demo-review-card.selected"))
    .filter(northStarReadableElement).length;
  const memoryCardCount = Array.from(document.querySelectorAll('[data-memory-strip="selected-card"]'))
    .filter(northStarReadableElement).length;
  if (selectedCardCount > 0 && memoryCardCount < selectedCardCount) {
    missing.push("selected-card Relevant Memory");
  }

  const disabledReasons = disabledReasonCoverageStatus();
  if (!disabledReasons.status) {
    missing.push("disabled button reasons");
  }
  const supportReasons = supportActionReasonCoverageStatus();
  if (!supportReasons.status) {
    missing.push("support action reasons");
  }
  const primaryReasons = primaryActionReasonCoverageStatus();
  if (!primaryReasons.status) {
    missing.push("primary action reasons");
  }
  const emptyStates = emptyStateCoverageStatus();
  if (!emptyStates.status) {
    missing.push("empty state guidance");
  }
  const receipts = receiptCoverageStatus();
  if (!receipts.status) {
    missing.push("receipt guidance");
  }
  const selectGuidance = selectGuidanceCoverageStatus();
  if (!selectGuidance.status) {
    missing.push("select guidance");
  }
  const memoryGuidance = memoryGuidanceCoverageStatus();
  if (!memoryGuidance.status) {
    missing.push("memory guidance");
  }
  const fieldGuidance = fieldGuidanceCoverageStatus();
  if (!fieldGuidance.status) {
    missing.push("field guidance");
  }
  const plainLanguage = plainLanguageCoverageStatus();
  if (!plainLanguage.status) {
    missing.push("plain language");
  }
  const detailsOptIn = detailsOptInCoverageStatus();
  if (!detailsOptIn.status) {
    missing.push("support opt-in");
  }
  const compactLabels = compactLabelCoverageStatus();
  if (!compactLabels.status) {
    missing.push("compact label limits");
  }

  const status = missing.length === 0;
  const detailParts = [
    dockVisible
      ? "Where, Blocker, and Button runs next are present in Current path and bottom bar."
      : "Where, Blocker, and Button runs next are present in Current path; bottom bar is hidden on this viewport.",
    document.querySelector('[data-forward-motion="pack-detail"]')
      ? "Selected work exposes where, blocker, Button runs next, memory, and work fields."
      : "No selected-work edit form is shown on this screen.",
    selectedCardCount > 0 ? `${memoryCardCount}/${selectedCardCount} selected-card memory strip(s) visible.` : "",
    disabledReasons.detail,
    supportReasons.detail,
    primaryReasons.detail,
    emptyStates.detail,
    receipts.detail,
    selectGuidance.detail,
    memoryGuidance.detail,
    fieldGuidance.detail,
    plainLanguage.detail,
    detailsOptIn.detail,
    compactLabels.detail
  ].filter(Boolean);

  return {
    status,
    missing: missing.slice(0, 8),
    commandFields: requiredFields.length,
    selectedCardCount,
    memoryCardCount,
    detail: status
      ? detailParts.join(" ")
      : `${missing.length} North Star gap(s): ${missing.slice(0, 3).join(", ")}.`
  };
}

function northStarReadableElement(element) {
  if (!element || element.hidden || element.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return element.getClientRects().length > 0 && Boolean(normalizeCopy(element.textContent));
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
      ? `${controls.length} disabled button or field(s) on this screen explain why.`
      : `${missing.length} disabled button or field(s) need a reason: ${missing.map(disabledControlLabel).slice(0, 3).join(", ")}.`
  };
}

function supportActionReasonCoverageStatus() {
  const controls = Array.from(document.querySelectorAll(".demo-support-action"))
    .filter(isSupportActionAuditCandidate);
  const missing = controls.filter((control) => !supportActionReasonForControl(control));

  return {
    status: missing.length === 0,
    count: controls.length,
    missing: missing.map(supportActionAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${controls.length} support action button(s) explain why they exist.`
      : `${missing.length} support action button(s) need a reason: ${missing.map(supportActionAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function primaryActionReasonCoverageStatus() {
  const cards = Array.from(document.querySelectorAll(".demo-work-card, .demo-review-card"))
    .filter(northStarReadableElement);
  const missing = cards.filter((card) => !normalizeCopy(card.querySelector("[data-primary-action-reason]")?.textContent));

  return {
    status: missing.length === 0,
    count: cards.length,
    missing: missing.map(primaryActionReasonAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${cards.length} work card main button(s) explain why the button runs.`
      : `${missing.length} work card main button(s) need a visible reason: ${missing.map(primaryActionReasonAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function emptyStateCoverageStatus() {
  const states = Array.from(document.querySelectorAll(".demo-empty"))
    .filter(isEmptyStateAuditCandidate);
  const missing = states.filter((stateElement) => !emptyStateExplainsContext(stateElement));

  return {
    status: missing.length === 0,
    count: states.length,
    missing: missing.map(emptyStateAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${states.length} empty state(s) explain how to fill, where, blocker, and Button runs next.`
      : `${missing.length} empty state(s) need context: ${missing.map(emptyStateAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function receiptCoverageStatus() {
  const receipts = Array.from(document.querySelectorAll("[data-receipt-surface]"))
    .filter(isReceiptAuditCandidate);
  const missing = receipts.filter((receipt) => !receiptExplainsContext(receipt));

  return {
    status: missing.length === 0,
    count: receipts.length,
    missing: missing.map(receiptAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${receipts.length} confirmation message(s) explain where, blocker, Button runs next, and proof target.`
      : `${missing.length} confirmation message(s) need context: ${missing.map(receiptAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function selectGuidanceCoverageStatus() {
  const controls = Array.from(document.querySelectorAll("select"))
    .filter(isSelectGuidanceAuditCandidate);
  const missing = controls.filter((control) => !selectGuidanceForControl(control));

  return {
    status: missing.length === 0,
    count: controls.length,
    missing: missing.map(selectGuidanceAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${controls.length} dropdown(s) explain what to choose; empty or disabled dropdowns explain how to recover.`
      : `${missing.length} dropdown(s) need guidance: ${missing.map(selectGuidanceAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function memoryGuidanceCoverageStatus() {
  const strips = Array.from(document.querySelectorAll("[data-memory-strip]"))
    .filter(isMemoryGuidanceAuditCandidate);
  const missing = strips.filter((strip) => !memoryStripExplainsGuidance(strip));

  return {
    status: missing.length === 0,
    count: strips.length,
    missing: missing.map(memoryGuidanceAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${strips.length} memory strip(s) explain recall state, how to fill when empty, and Button runs next.`
      : `${missing.length} memory strip(s) need guidance: ${missing.map(memoryGuidanceAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function fieldGuidanceCoverageStatus() {
  const controls = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='radio']), textarea"))
    .filter(isFieldGuidanceAuditCandidate);
  const missing = controls.filter((control) => !fieldGuidanceForControl(control));

  return {
    status: missing.length === 0,
    count: controls.length,
    missing: missing.map(fieldGuidanceAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${controls.length} editable text field(s) explain what to enter and why.`
      : `${missing.length} editable text field(s) need guidance: ${missing.map(fieldGuidanceAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function plainLanguageCoverageStatus() {
  const blockedTerms = ["button-runs-next", "debug packet", "payload", "telemetry", "route contract", "style audit", "copy surface", "metadata", "sample"];
  const root = document.getElementById("screen-content");
  if (!root) {
    return {
      status: true,
      count: 0,
      missing: [],
      detail: "No visible demo copy is rendered yet."
    };
  }

  const findings = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = normalizeCopy(node.nodeValue);
    if (!text || !isPlainLanguageAuditCandidate(node.parentElement)) {
      continue;
    }

    const lower = text.toLowerCase();
    const term = blockedTerms.find((item) => lower.includes(item));
    if (term) {
      findings.push({ term, text, element: node.parentElement });
    }
  }

  return {
    status: findings.length === 0,
    count: findings.length,
    missing: findings.map(plainLanguageAuditLabel).slice(0, 8),
    detail: findings.length === 0
      ? "Visible demo copy uses viewer-facing labels."
      : `${findings.length} visible copy item(s) use internal wording: ${findings.map(plainLanguageAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function detailsOptInCoverageStatus() {
  const details = Array.from(document.querySelectorAll("details.demo-card-support, details.demo-support-details, details.demo-row-support, details.demo-site-details"))
    .filter(isDetailsOptInAuditCandidate);
  const missing = details.filter((item) => !detailsOptInSummaryExplainsScope(item));

  return {
    status: missing.length === 0,
    count: details.length,
    missing: missing.map(detailsOptInAuditLabel).slice(0, 8),
    detail: missing.length === 0
      ? `${details.length} support panel(s) explain why to open them.`
      : `${missing.length} support panel(s) need a reason: ${missing.map(detailsOptInAuditLabel).slice(0, 3).join(", ")}.`
  };
}

function copySurfaceCoverageStatus() {
  const surfaces = Array.from(document.querySelectorAll("[data-copy-surface]"))
    .filter(isCopySurfaceAuditCandidate);
  const requiredIds = [
    "command-where",
    "command-blocker",
    "command-next",
    "primary-action",
    "dock-where",
    "dock-blocker",
    "dock-next-label"
  ];
  const missingRequired = requiredIds.filter((id) => !document.getElementById(id)?.getAttribute("data-copy-surface"));
  const missingMetadata = surfaces.filter((surface) => !copySurfaceMetadataIsComplete(surface));
  const overVisibleLimit = surfaces.filter((surface) => copySurfaceTextOverLimit(surface));
  const issues = [
    ...missingRequired.map((id) => `${id} missing copy-surface`),
    ...missingMetadata.map(copySurfaceAuditLabel).map((label) => `${label} missing limits`),
    ...overVisibleLimit.map(copySurfaceAuditLabel).map((label) => `${label} over visible limit`)
  ];
  const status = issues.length === 0;

  return {
    status,
    count: surfaces.length,
    missingRequired,
    missingMetadata: missingMetadata.map(copySurfaceAuditLabel).slice(0, 8),
    overVisibleLimit: overVisibleLimit.map(copySurfaceAuditLabel).slice(0, 8),
    truncated: surfaces.filter((surface) => surface.getAttribute("data-copy-truncated") === "true").length,
    detail: status
      ? `${surfaces.length} copy label(s) publish visible/help limits.`
      : `${issues.length} copy label issue(s): ${issues.slice(0, 3).join(", ")}.`
  };
}

function isCopySurfaceAuditCandidate(surface) {
  if (surface.hidden || surface.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(surface);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return surface.getClientRects().length > 0;
}

function copySurfaceMetadataIsComplete(surface) {
  const visibleLimit = Number(surface.getAttribute("data-copy-visible-limit"));
  const helpLimit = Number(surface.getAttribute("data-copy-help-limit"));
  return Boolean(surface.getAttribute("data-copy-surface"))
    && Number.isFinite(visibleLimit)
    && visibleLimit > 0
    && Number.isFinite(helpLimit)
    && helpLimit >= visibleLimit
    && surface.hasAttribute("data-copy-truncated")
    && Boolean(normalizeCopy(surface.getAttribute("title")))
    && Boolean(normalizeCopy(surface.getAttribute("aria-label")));
}

function copySurfaceTextOverLimit(surface) {
  const visibleLimit = Number(surface.getAttribute("data-copy-visible-limit"));
  if (!Number.isFinite(visibleLimit) || visibleLimit <= 0) {
    return true;
  }

  return normalizeCopy(surface.textContent).length > visibleLimit;
}

function copySurfaceAuditLabel(surface) {
  return surface.id
    || surface.getAttribute("data-copy-surface")
    || normalizeCopy(surface.textContent).slice(0, 48)
    || surface.tagName.toLowerCase();
}

function compactLabelCoverageStatus() {
  const entries = compactLabelAuditEntries();
  const overLimit = entries.filter((entry) => entry.text.length > entry.limit);
  const missingHelp = entries.filter((entry) => entry.helpRequired && !compactLabelHasHelp(entry.element));
  const issues = [
    ...overLimit.map((entry) => `${compactLabelAuditLabel(entry)} over ${entry.limit}`),
    ...missingHelp.map((entry) => `${compactLabelAuditLabel(entry)} missing help`)
  ];

  return {
    status: issues.length === 0,
    count: entries.length,
    overLimit: overLimit.map(compactLabelAuditLabel).slice(0, 8),
    missingHelp: missingHelp.map(compactLabelAuditLabel).slice(0, 8),
    detail: issues.length === 0
      ? `${entries.length} compact label(s) stay inside visible/help limits.`
      : `${issues.length} compact label issue(s): ${issues.slice(0, 3).join(", ")}.`
  };
}

function compactLabelAuditEntries() {
  const specs = [
    {
      selector: ".demo-shell button.btn, .demo-shell a.btn",
      kind: "button",
      limit: DEMO_COPY_LIMITS.compactButtonVisible,
      helpRequiredAt: Math.floor(DEMO_COPY_LIMITS.compactButtonVisible * 0.7)
    },
    {
      selector: ".demo-nav-item strong",
      kind: "nav",
      limit: DEMO_COPY_LIMITS.compactNavVisible
    },
    {
      selector: ".demo-chip",
      kind: "chip",
      limit: DEMO_COPY_LIMITS.compactBadgeVisible,
      helpRequiredAt: Math.floor(DEMO_COPY_LIMITS.compactBadgeVisible * 0.75)
    },
    {
      selector: ".demo-status, .demo-state-pill, .demo-work-path-step",
      kind: "badge",
      limit: DEMO_COPY_LIMITS.compactBadgeVisible
    }
  ];

  return specs.flatMap((spec) => Array.from(document.querySelectorAll(spec.selector))
    .filter(compactLabelAuditCandidate)
    .map((element) => {
      const text = compactLabelVisibleText(element);
      return {
        element,
        kind: spec.kind,
        limit: spec.limit,
        text,
        helpRequired: Boolean(spec.helpRequiredAt && text.length >= spec.helpRequiredAt)
      };
    })
    .filter((entry) => entry.text));
}

function compactLabelAuditCandidate(element) {
  if (element.hidden || element.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return element.getClientRects().length > 0;
}

function compactLabelVisibleText(element) {
  const directLabel = Array.from(element.children || [])
    .find((child) => child.classList?.contains("demo-support-label")
      || child.classList?.contains("demo-copy-button-label"));
  if (directLabel) {
    return normalizeCopy(directLabel.textContent);
  }

  const clone = element.cloneNode(true);
  clone.querySelectorAll(".demo-support-reason, .demo-chip-count, .sr-only, [aria-hidden='true']")
    .forEach((child) => child.remove());
  return normalizeCopy(clone.textContent);
}

function compactLabelHasHelp(element) {
  return Boolean(normalizeCopy(element.getAttribute("title"))
    || normalizeCopy(element.getAttribute("aria-label"))
    || normalizeCopy(element.getAttribute("aria-description"))
    || normalizeCopy(element.getAttribute("data-disabled-reason")));
}

function compactLabelAuditLabel(entry) {
  return `${entry.kind}:${entry.text || entry.element.id || entry.element.tagName.toLowerCase()}`;
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

function isSupportActionAuditCandidate(control) {
  if (control.hidden || control.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(control);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return control.getClientRects().length > 0;
}

function isEmptyStateAuditCandidate(stateElement) {
  if (stateElement.hidden || stateElement.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(stateElement);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return stateElement.getClientRects().length > 0;
}

function isReceiptAuditCandidate(receipt) {
  if (receipt.hidden || receipt.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(receipt);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return receipt.getClientRects().length > 0;
}

function isSelectGuidanceAuditCandidate(control) {
  if (control.hidden || control.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(control);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return control.getClientRects().length > 0;
}

function isMemoryGuidanceAuditCandidate(strip) {
  if (strip.hidden || strip.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(strip);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return strip.getClientRects().length > 0;
}

function isFieldGuidanceAuditCandidate(control) {
  if (control.readOnly || control.hidden || control.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(control);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return control.getClientRects().length > 0;
}

function isPlainLanguageAuditCandidate(element) {
  if (!element || element.hidden || element.closest("[hidden], [aria-hidden='true'], .sr-only, .demo-copy-payload, .demo-clipboard-payload, textarea, script, style")) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return element.getClientRects().length > 0;
}

function isDetailsOptInAuditCandidate(details) {
  if (details.hidden || details.closest("[hidden], [aria-hidden='true']")) {
    return false;
  }

  const style = window.getComputedStyle(details);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  return details.getClientRects().length > 0;
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

function supportActionReasonForControl(control) {
  const reason = [
    control.getAttribute("data-support-reason"),
    control.querySelector(".demo-support-reason")?.textContent,
    control.getAttribute("title"),
    control.getAttribute("aria-label")
  ].find((value) => normalizeCopy(value));

  return reason || "";
}

function emptyStateExplainsContext(stateElement) {
  const text = normalizeCopy(stateElement.textContent);
  return ["How to fill:", "Where:", "Blocker:", "Button runs next:"]
    .every((label) => emptyStateHasLabelValue(text, label));
}

function emptyStateHasLabelValue(text, label) {
  const labels = ["How to fill:", "Where:", "Blocker:", "Button runs next:"];
  const index = text.indexOf(label);
  if (index < 0) {
    return false;
  }

  const valueStart = index + label.length;
  const nextLabelIndex = labels
    .filter((item) => item !== label)
    .map((item) => text.indexOf(item, valueStart))
    .filter((itemIndex) => itemIndex >= 0)
    .sort((left, right) => left - right)[0];
  const value = text.slice(valueStart, nextLabelIndex ?? text.length).trim();
  return Boolean(value);
}

function receiptExplainsContext(receipt) {
  const text = normalizeCopy([
    receipt.textContent,
    receipt.getAttribute("aria-label"),
    receipt.getAttribute("title")
  ].join(" "));
  return ["Where", "Blocker", "Button runs next", "Proof target"]
    .every((label) => receiptHasLabelValue(text, label));
}

function receiptHasLabelValue(text, label) {
  const labels = ["Where", "Blocker", "Button runs next", "Proof target"];
  const index = text.indexOf(label);
  if (index < 0) {
    return false;
  }

  const valueStart = index + label.length;
  const nextLabelIndex = labels
    .filter((item) => item !== label)
    .map((item) => text.indexOf(item, valueStart))
    .filter((itemIndex) => itemIndex >= 0)
    .sort((left, right) => left - right)[0];
  const value = text.slice(valueStart, nextLabelIndex ?? text.length)
    .replace(/^:/u, "")
    .trim();
  return Boolean(value);
}

function selectGuidanceForControl(control) {
  const guidance = selectGuidanceTextForControl(control);
  if (!selectGuidanceExplainsChoice(guidance)) {
    return "";
  }

  if (selectNeedsRecoveryGuidance(control) && !selectGuidanceExplainsRecovery(guidance)) {
    return "";
  }

  return guidance;
}

function selectGuidanceTextForControl(control) {
  const direct = [
    control.getAttribute("aria-description"),
    control.getAttribute("title"),
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

  const nearbyHelp = control.closest(".demo-field, .demo-inline-form")
    ?.querySelector(".demo-field-help")?.textContent;
  return normalizeCopy(nearbyHelp) ? nearbyHelp : "";
}

function selectGuidanceExplainsChoice(guidance) {
  const text = normalizeCopy(guidance).toLowerCase();
  return ["choose", "pick", "select", "stores", "preview"].some((term) => text.includes(term));
}

function selectNeedsRecoveryGuidance(control) {
  if (control.disabled || control.getAttribute("aria-disabled") === "true") {
    return true;
  }

  const optionText = Array.from(control.options || [])
    .map((option) => normalizeCopy(option.textContent).toLowerCase())
    .join(" ");
  return optionText.includes("no work")
    || optionText.includes("no item")
    || optionText.includes("not available")
    || optionText.includes("empty");
}

function selectGuidanceExplainsRecovery(guidance) {
  const text = normalizeCopy(guidance).toLowerCase();
  return ["create", "reset", "choose a scenario", "add", "open"].some((term) => text.includes(term));
}

function fieldGuidanceForControl(control) {
  const direct = [
    control.getAttribute("data-disabled-reason"),
    control.getAttribute("aria-description"),
    control.getAttribute("title"),
    control.getAttribute("aria-label"),
    control.getAttribute("placeholder")
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

  const nearbyHelp = control.closest(".demo-field, .demo-inline-form, .demo-copy-payload, .demo-triage-card, .demo-blocker-field")
    ?.querySelector(".demo-field-help, [data-blocker-help]")?.textContent;
  return normalizeCopy(nearbyHelp) ? nearbyHelp : "";
}

function detailsOptInSummaryExplainsScope(details) {
  const summary = details.querySelector("summary");
  if (!summary) {
    return false;
  }

  const label = normalizeCopy(summary.querySelector("span")?.textContent);
  const reason = normalizeCopy(summary.querySelector("strong")?.textContent);
  const reasonLower = reason.toLowerCase();
  return Boolean(label)
    && Boolean(reason)
    && (
      reasonLower.includes("open only")
      || reasonLower.includes("open for")
      || reasonLower.includes("without changing button runs next")
      || reasonLower.includes("clear blocker or set button runs next")
      || reasonLower.includes("focus, edit, clear blocker")
    );
}

function memoryStripExplainsGuidance(strip) {
  const action = strip.querySelector(".demo-memory-action");
  const text = normalizeCopy([
    strip.textContent,
    strip.getAttribute("aria-label"),
    strip.getAttribute("title"),
    action?.getAttribute("aria-label"),
    action?.getAttribute("title")
  ].join(" "));
  const hasMemory = !strip.classList.contains("is-empty");
  const hasRecallState = text.includes("Relevant Memory") && (hasMemory || text.includes("none yet"));
  const hasFillGuidance = hasMemory || text.includes("How to fill");
  const hasActionGuidance = text.includes("Button runs next");
  return hasRecallState && hasFillGuidance && hasActionGuidance;
}

function disabledControlLabel(control) {
  return control.id
    || control.getAttribute("data-action")
    || control.getAttribute("data-go")
    || control.textContent.trim()
    || control.tagName.toLowerCase();
}

function supportActionAuditLabel(control) {
  return control.getAttribute("data-action")
    || control.querySelector(".demo-support-label")?.textContent?.trim()
    || control.textContent.trim()
    || "support action";
}

function primaryActionReasonAuditLabel(card) {
  return card.querySelector(".demo-card-title")?.textContent?.trim()
    || card.getAttribute("data-pack-id")
    || "work card";
}

function emptyStateAuditLabel(stateElement) {
  return stateElement.querySelector("strong")?.textContent?.trim()
    || normalizeCopy(stateElement.textContent).slice(0, DEMO_COPY_LIMITS.statusVisible)
    || "empty state";
}

function receiptAuditLabel(receipt) {
  return receipt.getAttribute("data-receipt-surface")
    || receipt.querySelector("span")?.textContent?.trim()
    || normalizeCopy(receipt.textContent).slice(0, DEMO_COPY_LIMITS.statusVisible)
    || "receipt";
}

function selectGuidanceAuditLabel(control) {
  return control.id
    || control.closest("label")?.querySelector("span")?.textContent?.trim()
    || control.getAttribute("aria-label")
    || "select";
}

function memoryGuidanceAuditLabel(strip) {
  return strip.getAttribute("data-memory-strip")
    || strip.querySelector("span")?.textContent?.trim()
    || normalizeCopy(strip.textContent).slice(0, DEMO_COPY_LIMITS.statusVisible)
    || "memory strip";
}

function fieldGuidanceAuditLabel(control) {
  return control.id
    || control.getAttribute("data-triage-field")
    || control.closest("label")?.querySelector("span")?.textContent?.trim()
    || control.getAttribute("aria-label")
    || control.getAttribute("placeholder")
    || control.tagName.toLowerCase();
}

function plainLanguageAuditLabel(finding) {
  const label = finding.element?.id
    || finding.element?.closest("section")?.querySelector("h2")?.textContent?.trim()
    || finding.element?.tagName?.toLowerCase()
    || "visible copy";
  return `${label}: ${finding.term}`;
}

function detailsOptInAuditLabel(details) {
  return normalizeCopy(details.querySelector("summary span")?.textContent)
    || normalizeCopy(details.querySelector("summary")?.textContent).slice(0, DEMO_COPY_LIMITS.statusVisible)
    || "details panel";
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

function clipboardTargetLabel(targetId = "") {
  const labels = {
    "feedback-context": "Feedback context",
    "lab-snapshot": "Work snapshot",
    "meta-context": "Build snapshot",
    "style-audit": "File check",
    "triage-snapshot": "Triage snapshot"
  };
  return labels[targetId] || "Copied text";
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
  return `Where: ${where}. Blocker: None. Button runs next: ${next}.`;
}

function clipboardBlockedStatus() {
  return "Where: Clipboard. Blocker: browser blocked clipboard access. Button runs next: copy from the visible text area.";
}

function emptyState(text, help = "Use the nearby controls or reset demo data.", context = emptyStateContext()) {
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
      .replace(/Button Runs Next/g, "Button runs next");
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
