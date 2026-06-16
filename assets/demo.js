const DEMO_STORAGE_KEY = "projects-static-demo-state-v2";
const THEME_STORAGE_KEY = "projects-demo-theme";

const state = {
  basePacks: [],
  packs: [],
  route: "home",
  selectedId: "",
  query: "",
  filter: "all",
  status: "Demo actions update browser state only.",
  copyProfile: "general",
  memoryDraft: ""
};

const navItems = [
  ["home", "H", "Home"],
  ["work", "W", "Work"],
  ["today", "T", "Today"],
  ["board", "B", "Board"],
  ["review", "R", "Review"],
  ["focus", "F", "Focus"],
  ["next", "N", "Next"],
  ["check", "!", "Check"],
  ["search", "S", "Search"],
  ["stats", "%", "Stats"],
  ["notes", "N", "Notes"],
  ["timeline", "-", "Timeline"],
  ["files", "#", "Files"],
  ["calendar", "D", "Calendar"],
  ["create", "+", "Create"],
  ["memory", "M", "Memory"],
  ["settings", "...", "Settings"]
];

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

const el = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  bindShellControls();
  renderNav();

  try {
    const response = await fetch("data/demo-packs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Demo data failed with ${response.status}`);
    }

    state.basePacks = await response.json();
    loadState();
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
  el("primary-action").addEventListener("click", () => runPrimaryAction());
  el("secondary-action").addEventListener("click", () => go("focus"));
  el("dock-next").addEventListener("click", () => runPrimaryAction());
}

function loadState() {
  const saved = safeJson(localStorage.getItem(DEMO_STORAGE_KEY));
  state.packs = Array.isArray(saved?.packs) ? saved.packs : structuredClone(state.basePacks);
  state.copyProfile = saved?.copyProfile || "general";
  state.selectedId = saved?.selectedId || state.packs[0]?.id || "";
  state.status = saved?.status || state.status;
}

function saveState() {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
    packs: state.packs,
    copyProfile: state.copyProfile,
    selectedId: state.selectedId,
    status: state.status
  }));
}

function resetState() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  state.packs = structuredClone(state.basePacks);
  state.copyProfile = "general";
  state.selectedId = state.packs[0]?.id || "";
  state.query = "";
  state.filter = "all";
  state.status = "Demo data reset. Browser state only.";
  render();
}

function renderNav() {
  el("demo-nav").innerHTML = navItems.map(([route, key, label]) => `
    <a class="demo-nav-item" href="#/${route}" data-route="${route}">
      <span>${escapeHtml(key)}</span>
      <strong>${escapeHtml(label)}</strong>
    </a>
  `).join("");
}

function routeFromHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [route, id] = hash.split("/");
  state.route = route || "home";
  if (id) {
    state.selectedId = decodeURIComponent(id);
  }
}

function go(route, id = "") {
  location.hash = id ? `#/${route}/${encodeURIComponent(id)}` : `#/${route}`;
}

function render() {
  if (!state.packs.find((pack) => pack.id === state.selectedId)) {
    state.selectedId = state.packs[0]?.id || "";
  }

  document.querySelectorAll(".demo-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === state.route);
  });

  const screenTitle = screenTitleForRoute();
  el("screen-title").textContent = screenTitle;
  renderCommand(currentPack());

  switch (state.route) {
    case "home":
      renderHome();
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
    case "settings":
      renderSettings();
      break;
    case "pack":
      renderPackDetail();
      break;
    case "work":
    default:
      renderWork();
      break;
  }

  saveState();
}

function screenTitleForRoute() {
  const profile = copyProfiles[state.copyProfile] || copyProfiles.general;
  const titles = {
    home: "Command cockpit",
    work: "Work list",
    today: "Today",
    board: "Board",
    review: "Review",
    focus: "Focus",
    next: "Next setup",
    check: "Check",
    search: "Search",
    stats: "Stats",
    notes: "Notes",
    timeline: "Timeline",
    files: "Files",
    calendar: "Calendar",
    create: profile.newWork,
    memory: "Memory",
    settings: "Settings",
    pack: "Pack detail"
  };
  return titles[state.route] || "Work list";
}

function renderCommand(selected) {
  const visibleCount = filteredPacks().length;
  const reviewCount = state.packs.filter(isReview).length;
  const command = commandForRoute(selected, visibleCount, reviewCount);
  updateCommand(command);
}

function commandForRoute(selected, visibleCount, reviewCount) {
  const routeLabel = screenTitleForRoute();
  const selectedTitle = selected?.title || "No sample work selected";
  const next = selected?.next || "Choose work";
  const blocker = selected?.blocker && selected.blocker !== "none"
    ? selected.blocker
    : reviewCount > 0
      ? `${reviewCount} sample item(s) need review`
      : "none";

  const routeCommands = {
    home: ["Command cockpit", "Home", `${reviewCount} sample item(s) need review`, "Review", "Ready"],
    work: ["Work list command flow", "Work list", blocker, next, selected?.status || "Ready"],
    today: ["Today command flow", "Today", "due sample work is visible", "Focus", "Today"],
    board: ["Board command flow", "Board", "sample work is grouped by status", "Focus", "Ready"],
    review: ["Review command flow", "Review", `${reviewCount} sample item(s) need decisions`, "Choose next action", "Review"],
    focus: ["Focus command flow", selectedTitle, selected?.blocker || "none", next, "Focus"],
    next: ["Next setup command flow", "Next setup", selected?.blocker || "choose a sample work item", selected?.next || "Choose next action", "Ready"],
    check: ["Check command flow", "Check", `${reviewCount} sample item(s) still need decisions`, "Validate sample", "Ready"],
    search: ["Search command flow", "Search", "type title, owner, next action, or due date", "Search", "Ready"],
    stats: ["Stats command flow", "Stats", "sample counts are calculated in browser state", "Review", "Ready"],
    notes: ["Notes command flow", "Notes", "sample notes are browser-only", "Add note", "Ready"],
    timeline: ["Timeline command flow", "Timeline", "sample activity is browser-only", "Open work", "Ready"],
    files: ["Files command flow", "Files", "sample sources are references only", "Open work", "Ready"],
    calendar: ["Calendar command flow", "Calendar", "sample due dates are visible", "Focus", "Ready"],
    create: ["Create command flow", "Create", "required fields are title and Button runs next", "Save sample", "Draft"],
    memory: ["Memory command flow", "Memory", "sample notes are browser-only", "Add note", "Ready"],
    settings: ["Settings command flow", "Settings", "copy profile changes labels only in this static demo", "Apply profile", "Ready"],
    pack: ["Pack detail command flow", selectedTitle, selected?.blocker || "none", selected?.next || "Save sample", selected?.status || "Ready"]
  };

  const [title, where, routeBlocker, routeNext, stateText] = routeCommands[state.route] || routeCommands.work;
  return {
    title,
    where,
    blocker: routeBlocker,
    next: routeNext,
    stateText: capitalize(stateText),
    scope: `Scope: ${visibleCount} of ${state.packs.length} sample work items visible.`
  };
}

function updateCommand(command) {
  el("command-title").textContent = command.title;
  el("command-where").textContent = command.where;
  el("command-blocker").textContent = command.blocker;
  el("command-next").textContent = command.next;
  el("command-state").textContent = command.stateText;
  el("command-scope").textContent = command.scope;
  el("primary-action").textContent = command.next;
  el("dock-where").textContent = command.where;
  el("dock-blocker").textContent = command.blocker;
  el("dock-next-label").textContent = command.next;
}

function renderHome() {
  const reviewCount = state.packs.filter(isReview).length;
  const doneCount = state.packs.filter((pack) => pack.status === "done").length;
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
        <button class="btn btn-primary" type="button" data-go="review">Review ${reviewCount}</button>
      </div>
      <p>The demo shows the public-safe shape of Projects: pick work, read Where / Blocker / Button runs next, then run a simulated action.</p>
      <div class="demo-quick-actions">
        ${navButton("work", "Open work list")}
        ${navButton("today", "Open today")}
        ${navButton("create", "Create sample")}
        ${navButton("settings", "Change copy profile")}
      </div>
    </section>
    ${recentActivityPanel()}
  `;
  bindGoButtons();
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
      <div class="demo-profile-grid">
        ${Object.entries(copyProfiles).map(([key, value]) => `
          <button type="button" class="demo-profile-card" data-profile="${escapeHtml(key)}" aria-pressed="${state.copyProfile === key}">
            <strong>${escapeHtml(capitalize(key))}</strong>
            <span>${escapeHtml(value.newWork)} / ${escapeHtml(value.work)} / ${escapeHtml(value.sources)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
  document.querySelectorAll(".demo-profile-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.copyProfile = button.dataset.profile;
      state.status = `${capitalize(state.copyProfile)} copy profile applied in demo state.`;
      render();
    });
  });
  el("reset-demo").addEventListener("click", resetState);
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
  return `<div class="demo-row">
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
  return `<article class="demo-review-card">
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
  document.querySelectorAll("[data-action]").forEach((button) => {
    if (button.closest(".demo-work-card")) {
      return;
    }

    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "set-due-today") {
        state.packs.forEach((pack) => { if (pack.status !== "done") pack.due = "2026-06-16"; });
        state.status = "All unfinished sample work is due today in browser state.";
      } else if (action === "review-first") {
        const first = state.packs.find(isReview);
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
            pack.next = input.value.trim() || "Review";
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

  const choice = valueOf("next-action-choice") || "Review";
  pack.next = choice;
  if (pack.blocker === "missing Button runs next") {
    pack.blocker = "none";
  }

  pack.activity.unshift(`Button runs next changed to ${choice} in browser state.`);
  state.selectedId = pack.id;
  state.status = `${pack.title} will now run ${choice} in the static demo.`;
  render();
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
    go("review");
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
  } else {
    go("pack", pack.id);
    return;
  }

  render();
}

function runPrimaryAction() {
  const pack = currentPack() || state.packs[0];
  const command = commandForRoute(pack, filteredPacks().length, state.packs.filter(isReview).length);
  if (!pack) {
    state.status = "No sample work is selected.";
    render();
    return;
  }

  if (state.route === "home") {
    go("review");
  } else if (state.route === "create") {
    createSamplePack();
  } else if (state.route === "search") {
    state.status = "Search checks browser-state sample data only.";
    render();
  } else if (state.route === "check") {
    const attention = sampleChecks().reduce((sum, [, count]) => sum + count, 0);
    state.status = attention === 0
      ? "Sample data passed the browser-state checks."
      : `${attention} sample check item(s) still need attention.`;
    render();
  } else if (state.route === "memory") {
    state.status = "Add a note from the Memory screen input.";
    render();
  } else if (state.route === "settings") {
    state.status = `${capitalize(state.copyProfile)} profile is active in demo state.`;
    render();
  } else {
    handlePackAction(pack.id, commandActionForLabel(command.next).action);
  }
}

function commandActionForPack(pack) {
  const label = (pack?.next || "Open").trim() || "Open";
  return commandActionForLabel(label);
}

function commandActionForLabel(label) {
  label = (label || "Open").trim() || "Open";
  const normalized = label.toLowerCase();

  if (normalized === "review") {
    return { label, action: "review" };
  }

  if (normalized === "set next" || normalized === "set button runs next" || normalized === "choose next action") {
    return { label, action: "set-next" };
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
  return pack.status === "blocked" || pack.blocker !== "none" || pack.next === "Review" || pack.next === "Choose next action";
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
  return `<div class="demo-command-line">
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
