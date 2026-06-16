const state = {
  packs: [],
  query: "",
  filter: "all",
  selectedId: "",
  route: "Work list",
  status: "Simulated actions only."
};

const filters = [
  ["all", "All"],
  ["active", "Active"],
  ["blocked", "Blocked"],
  ["draft", "Draft"],
  ["done", "Done"],
  ["review", "Review"]
];

const el = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  bindStaticControls();

  try {
    const response = await fetch("data/demo-packs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Demo data failed with ${response.status}`);
    }

    state.packs = await response.json();
    state.selectedId = state.packs[0]?.id ?? "";
    render();
  } catch (error) {
    state.status = "Demo data failed to load.";
    el("work-list").innerHTML = `<div class="demo-empty">${escapeHtml(error.message)}</div>`;
    updateCommand({
      where: "Demo",
      blocker: "static JSON could not load",
      next: "Refresh",
      stateText: "Offline",
      scope: "Scope: no sample work is visible."
    });
  }
});

function initTheme() {
  const saved = localStorage.getItem("projects-demo-theme");
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
  localStorage.setItem("projects-demo-theme", dark ? "dark" : "light");
}

function bindStaticControls() {
  el("demo-search").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    render();
  });
  el("primary-action").addEventListener("click", () => simulatePrimaryAction());
  el("today-action").addEventListener("click", () => {
    state.route = "Today";
    state.status = "Showing due-now sample work.";
    state.filter = "review";
    render();
  });
  el("dock-next").addEventListener("click", () => simulatePrimaryAction());
}

function render() {
  renderChips();
  const visible = filteredPacks();
  const selected = visible.find((pack) => pack.id === state.selectedId) ?? visible[0] ?? state.packs[0];
  state.selectedId = selected?.id ?? "";
  renderList(visible);
  renderCommand(selected, visible.length);
}

function renderChips() {
  const counts = countByFilter();
  el("status-chips").innerHTML = filters.map(([key, label]) => {
    const pressed = state.filter === key;
    return `<button type="button" class="demo-chip" aria-pressed="${pressed}" data-filter="${key}">
      ${label}<span class="demo-chip-count">${counts[key] ?? 0}</span>
    </button>`;
  }).join("");

  document.querySelectorAll(".demo-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.status = `${button.textContent.trim()} filter applied.`;
      render();
    });
  });
}

function renderList(packs) {
  el("visible-count").textContent = `${packs.length} visible`;
  el("demo-status").textContent = state.status;

  if (packs.length === 0) {
    el("work-list").innerHTML = `<div class="demo-empty">No demo work matches this filter.</div>`;
    return;
  }

  el("work-list").innerHTML = packs.map((pack) => {
    const selected = pack.id === state.selectedId ? " selected" : "";
    return `<article class="demo-work-card${selected}" data-pack-id="${escapeHtml(pack.id)}">
      <div class="demo-card-head">
        <button type="button" class="demo-card-title btn-link" data-action="select">${escapeHtml(pack.title)}</button>
        <span class="demo-state-pill">${escapeHtml(pack.status)}</span>
      </div>
      <div class="demo-command-row">
        <div>
          <span>Button runs next</span>
          <strong>${escapeHtml(pack.next)}</strong>
        </div>
        <button type="button" class="btn btn-primary" data-action="open">${escapeHtml(pack.next)}</button>
      </div>
      <div class="demo-card-meta">
        <span>${escapeHtml(pack.blocker)}</span>
        <span>${escapeHtml(pack.due)}</span>
        <span>${escapeHtml(pack.owner)}</span>
      </div>
      <div class="demo-card-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="open">Open</button>
        <button type="button" class="btn btn-sm" data-action="focus">Focus</button>
        <button type="button" class="btn btn-sm" data-action="block">Block</button>
        <button type="button" class="btn btn-sm" data-action="done">Done</button>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll(".demo-work-card button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".demo-work-card");
      handleCardAction(card.dataset.packId, button.dataset.action);
    });
  });
}

function renderCommand(selected, visibleCount) {
  if (!selected) {
    updateCommand({
      where: state.route,
      blocker: "no sample work matches the current filter",
      next: "Clear search",
      stateText: "Filtered",
      scope: "Scope: 0 sample work items visible."
    });
    return;
  }

  const needsReview = state.packs.filter((pack) => isReview(pack)).length;
  updateCommand({
    where: state.route,
    blocker: needsReview > 0 ? `${needsReview} sample work item(s) need review` : "none",
    next: selected.next,
    stateText: selected.status === "blocked" ? "Blocked" : selected.status === "done" ? "Done" : "Review",
    scope: `Scope: ${visibleCount} of ${state.packs.length} sample work items visible.`
  });
}

function updateCommand(command) {
  el("command-where").textContent = command.where;
  el("command-blocker").textContent = command.blocker;
  el("command-next").textContent = command.next;
  el("command-state").textContent = command.stateText;
  el("command-scope").textContent = command.scope;
  el("primary-action").textContent = command.next;
  el("dock-where").textContent = command.where.replace(" list", "");
  el("dock-blocker").textContent = command.blocker;
  el("dock-next-label").textContent = command.next;
}

function handleCardAction(id, action) {
  const pack = state.packs.find((candidate) => candidate.id === id);
  if (!pack) {
    return;
  }

  state.selectedId = id;
  if (action === "block") {
    pack.status = "blocked";
    pack.blocker = "blocked in demo state";
    pack.next = "Unblock";
    state.status = `${pack.title} is blocked in browser state only.`;
  } else if (action === "done") {
    pack.status = "done";
    pack.blocker = "none";
    pack.next = "Open";
    state.status = `${pack.title} is marked done in browser state only.`;
  } else if (action === "focus") {
    state.route = "Focus";
    state.status = `${pack.title} is the focused sample item.`;
  } else {
    state.route = "Work detail";
    state.status = `${pack.title} opened in the static demo.`;
  }

  render();
}

function simulatePrimaryAction() {
  if (!state.selectedId && state.packs.length > 0) {
    state.selectedId = state.packs[0].id;
  }

  const pack = state.packs.find((candidate) => candidate.id === state.selectedId);
  if (!pack) {
    state.status = "No sample work is selected.";
  } else if (pack.status === "blocked") {
    pack.status = "active";
    pack.blocker = "none";
    pack.next = "Open";
    state.status = `${pack.title} unblocked in demo state.`;
  } else if (pack.status === "done") {
    state.route = "Work detail";
    state.status = `${pack.title} is already done; opening the detail preview.`;
  } else {
    state.route = "Review";
    state.filter = "review";
    state.status = "Review mode is simulated; no local pack files changed.";
  }

  render();
}

function filteredPacks() {
  const query = state.query.trim().toLowerCase();
  return state.packs.filter((pack) => {
    const filterMatch =
      state.filter === "all" ||
      (state.filter === "review" && isReview(pack)) ||
      pack.status === state.filter;
    const haystack = `${pack.title} ${pack.next} ${pack.owner} ${pack.due} ${pack.blocker}`.toLowerCase();
    return filterMatch && (!query || haystack.includes(query));
  });
}

function countByFilter() {
  const counts = Object.fromEntries(filters.map(([key]) => [key, 0]));
  counts.all = state.packs.length;
  for (const pack of state.packs) {
    counts[pack.status] = (counts[pack.status] ?? 0) + 1;
    if (isReview(pack)) {
      counts.review += 1;
    }
  }
  return counts;
}

function isReview(pack) {
  return pack.status === "blocked" || pack.blocker !== "none" || pack.next === "Review";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
