"use strict";

// ---------------------------------------------------------------------------
// Module: render-html (server-side SSR glue)
//
// Builds a RenderModel from server state and calls the shared HTML template
// functions (src/demo/render-html.js) to produce the page content. Wraps the
// result in the app shell (index.html layout).
//
// The shared modules are required from src/demo/ — the same UMD files the
// client build prepends. Both expose their API via module.exports in Node.
// ---------------------------------------------------------------------------

const path = require("node:path");
const fs = require("node:fs");

const renderModel = require(path.join(__dirname, "..", "..", "src", "demo", "render-model.js"));
const renderHtml = require(path.join(__dirname, "..", "..", "src", "demo", "render-html.js"));

// The app shell HTML — index.html without the <main> content. We'll inject
// the SSR-rendered route content into the #screen-content element.
let _appShellTemplate = null;

function appShellTemplate() {
  if (_appShellTemplate) {
    return _appShellTemplate;
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

  // Split around the screen-content element to inject rendered content.
  // The element is <section id="screen-content" ...> ... </section>.
  const marker = 'id="screen-content"';

  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("App shell template missing #screen-content element.");
  }

  // Find the start of the opening tag (scan back from the marker).
  const tagStart = html.lastIndexOf("<", markerIndex);
  // Find the end of the opening tag.
  const tagEnd = html.indexOf(">", markerIndex) + 1;
  // Find the closing </section> tag after the opening tag.
  const closeIndex = html.indexOf("</section>", tagEnd);
  if (closeIndex === -1) {
    throw new Error("App shell template missing </section> for #screen-content.");
  }

  _appShellTemplate = {
    before: html.slice(0, tagEnd),
    after: html.slice(closeIndex)
  };

  return _appShellTemplate;
}

// -----------------------------------------------------------------------
// Build a RenderModel from server-side state.
// The server's state object is shaped differently from the client's global
// `state` — it comes from stateStorage.read() and has { packs, copyProfile,
// scenarioId, selectedId, filter, query, status, actionReceipt }.
// -----------------------------------------------------------------------

function buildRenderModel(serverState) {
  const packs = Array.isArray(serverState?.packs) ? serverState.packs : [];
  const copyProfileId = serverState?.copyProfile || "general";

  // The copy profiles live in the client demo.js. For SSR, we embed a minimal
  // set of labels. The full copyProfiles object could be extracted to a shared
  // module later.
  const copyProfiles = {
    general: { work: "work", workOne: "work item", workMany: "work items", newWork: "New work item" },
    developer: { work: "feature", workOne: "feature", workMany: "features", newWork: "New feature" },
    climate: { work: "project", workOne: "project", workMany: "projects", newWork: "New project" },
    dj: { work: "set", workOne: "set", workMany: "sets", newWork: "New set" },
    sales: { work: "deal", workOne: "deal", workMany: "deals", newWork: "New deal" },
    ops: { work: "task", workOne: "task", workMany: "tasks", newWork: "New task" },
    ai: { work: "prompt", workOne: "prompt", workMany: "prompts", newWork: "New prompt" }
  };

  return renderModel.snapshotRenderModel(
    {
      packs: packs,
      basePacks: packs,
      route: "home",
      routeParam: "",
      selectedId: serverState?.selectedId || (packs[0]?.id || ""),
      filter: serverState?.filter || "all",
      query: serverState?.query || "",
      workListView: "card",
      density: "card",
      energyFilter: "all",
      batchMode: false,
      batchSelected: [],
      actionReceipt: serverState?.actionReceipt || null,
      clipboardReceipt: null,
      focusMode: false,
      recentlyUnblockedIds: [],
      comparisonHistory: [],
      recentIds: [],
      copyProfile: copyProfileId
    },
    copyProfiles,
    copyProfileId
  );
}

// -----------------------------------------------------------------------
// Render a route as HTML. Returns the content to inject into #screen-content.
// For now, only "home" is implemented. Other routes return a placeholder.
// -----------------------------------------------------------------------

function renderRouteContent(serverState, route) {
  const model = buildRenderModel(serverState);

  switch (route) {
    case "home":
      return renderHtml.renderHomeHtml(model);
    default:
      // Other routes not yet implemented in the shared module.
      // Return a loading placeholder; the client will hydrate and re-render.
      return `<section class="demo-panel"><p>Loading ${renderHtml.escapeHtml(route)}…</p></section>`;
  }
}

// -----------------------------------------------------------------------
// Render the full HTML page with SSR content.
// -----------------------------------------------------------------------

function renderPageHtml(serverState, route) {
  const shell = appShellTemplate();
  const content = renderRouteContent(serverState, route || "home");

  return shell.before + "\n" + content + "\n" + shell.after;
}

module.exports = {
  buildRenderModel,
  renderRouteContent,
  renderPageHtml
};
