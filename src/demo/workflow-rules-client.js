// ---------------------------------------------------------------------------
// Module: workflow-rules-client (app-mode subset)
//
// App-mode thin subset of the shared workflow-rules module. The full module
// (server/src/workflow-rules.js) ships in the static/GitHub-Pages build where
// every pack action runs locally. The Worker app never needs packActionEffect
// or unblockPacksBlockedBy client-side — those are server-authoritative — so
// this module strips them out. The remaining functions (form preview, cycle
// check, receipt rendering) still run locally so the UI stays instant.
//
// Dual-loaded (UMD): the server never loads this file; the client build
// (scripts/build-demo-asset.mjs --app) prepends it into assets/demo-app.js
// where it runs as an IIFE and exposes window.__workflowRules — the same
// global name the demo.js engine expects.
// ---------------------------------------------------------------------------

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node (for tests / guard checks only)
  } else {
    root.__workflowRules = api; // Browser client (src/demo/demo.js)
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEMO_BLOCKER_NONE = "none";
  const VALID_PACK_STATUSES = ["active", "blocked", "draft", "done"];

  function normalizeText(value, maxLength = 2000) {
    return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maxLength);
  }

  function normalizeLegacyBlockerCopy(value) {
    return value
      .replace(/Button-runs-next/g, "Button runs next")
      .replace(/Button Runs Next/g, "Button runs next")
      .replace(/missing Button runs next/g, "missing next action")
      .replace(/Button runs next/g, "Next action")
      .replace(/button runs next/g, "next action");
  }

  function normalizeStoredBlocker(value) {
    const blocker = normalizeLegacyBlockerCopy(normalizeText(value, 200));
    return blocker && blocker.toLowerCase() !== DEMO_BLOCKER_NONE ? blocker : DEMO_BLOCKER_NONE;
  }

  function isUnblockedBlockerValue(value) {
    return normalizeStoredBlocker(value) === DEMO_BLOCKER_NONE;
  }

  function isPlaceholderNext(label) {
    const value = normalizeText(label, 120).toLowerCase();
    return !value
      || value === "choose action"
      || value === "choose next action"
      || value === "set next action"
      || value === "set button runs next"
      || value === "set next";
  }

  function forwardPathStatusForBlocker(status, blocker, next = "") {
    const normalizedStatus = normalizeText(status, 40) || "active";
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

  function blockedByBlockerText(targetPack, workTitle) {
    return normalizeText(`waiting on ${workTitle(targetPack)}`, 200);
  }

  function unblockedReceiptSentence(count) {
    if (!count) {
      return "";
    }
    return `Unblocked ${count} work item${count === 1 ? "" : "s"}.`;
  }

  return {
    DEMO_BLOCKER_NONE,
    VALID_PACK_STATUSES,
    normalizeText,
    normalizeLegacyBlockerCopy,
    normalizeStoredBlocker,
    isUnblockedBlockerValue,
    isPlaceholderNext,
    forwardPathStatusForBlocker,
    createsBlockedByCycle,
    blockedByBlockerText,
    unblockedReceiptSentence
    // Deliberately omitted (server-authoritative in app mode):
    //   packActionEffect, unblockPacksBlockedBy
  };
});
