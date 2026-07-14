// ---------------------------------------------------------------------------
// Module: render-model (shared, engine-neutral)
//
// A pure-data snapshot of every field the rendering functions read from the
// mutable global `state`. Both the server SSR path and the client path build
// the same shape so the shared HTML template functions can stay engine-neutral.
//
// The server builds this from its in-memory state + the copy profile labels.
// The client calls snapshotRenderModel() to extract it from the global `state`.
// ---------------------------------------------------------------------------

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.__renderModel = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // -----------------------------------------------------------------------
  // Render model shape — every field a render function might read.
  // Keep this in sync with the global `state` object in demo.js.
  // -----------------------------------------------------------------------

  function emptyRenderModel() {
    return {
      // --- Pack data ---
      packs: [],
      basePacks: [],

      // --- Route ---
      route: "home",
      routeParam: "",
      selectedId: "",

      // --- List display ---
      filter: "all",
      query: "",
      workListView: "card",
      density: "card",
      energyFilter: "all",

      // --- Batch mode ---
      batchMode: false,
      batchSelected: [],

      // --- Receipt ---
      actionReceipt: null,
      clipboardReceipt: null,

      // --- UI state ---
      focusMode: false,
      recentlyUnblockedIds: [],
      comparisonHistory: [],
      recentIds: [],

      // --- Copy profile labels (derived, not stored on state) ---
      copyProfile: "general",
      copy: {
        work: "work",
        workOne: "work item",
        workMany: "work items",
        newWork: "New work item"
      }
    };
  }

  // -----------------------------------------------------------------------
  // Client-side snapshot: extract from the global mutable `state` and the
  // copy profile lookup. Called once at the top of render() so every
  // template function reads from the snapshot instead of global state.
  // -----------------------------------------------------------------------

  function snapshotRenderModel(state, copyProfiles, profileId) {
    const profile = (copyProfiles && copyProfiles[profileId || state.copyProfile]) || {};

    return {
      packs: state.packs || [],
      basePacks: state.basePacks || [],
      route: state.route || "home",
      routeParam: state.routeParam || "",
      selectedId: state.selectedId || "",
      filter: state.filter || "all",
      query: state.query || "",
      workListView: state.workListView || "card",
      density: state.density || "card",
      energyFilter: state.energyFilter || "all",
      batchMode: Boolean(state.batchMode),
      batchSelected: state.batchSelected ? [...state.batchSelected] : [],
      actionReceipt: state.actionReceipt || null,
      clipboardReceipt: state.clipboardReceipt || null,
      focusMode: Boolean(state.focusMode),
      recentlyUnblockedIds: state.recentlyUnblockedIds || [],
      comparisonHistory: state.comparisonHistory || [],
      recentIds: state.recentIds || [],
      copyProfile: profileId || state.copyProfile || "general",
      copy: {
        work: profile.work || "work",
        workOne: profile.workOne || profile.work || "work item",
        workMany: profile.workMany || (profile.work ? profile.work + "s" : "work items"),
        newWork: profile.newWork || "New work item"
      }
    };
  }

  return {
    emptyRenderModel,
    snapshotRenderModel
  };
});
