// ---------------------------------------------------------------------------
// Module: workflow-rules (shared, engine-neutral)
//
// The single source of truth for the pure work-item workflow rules that BOTH
// engines must agree on: the status vocabulary, the blocker sentinel and its
// normalizers, the forward-path status derivation, and the blocked-by cycle
// check. Nothing here touches the DOM, HTTP, or copy profiles — it is pure
// data + pure functions so the static client and the Node backend cannot
// drift.
//
// Dual-loaded (UMD): the server `require()`s it (module.exports); the client
// build (scripts/build-demo-asset.mjs) prepends it into assets/demo.js where it
// runs as an IIFE and exposes `window.__workflowRules`. Terser runs with
// toplevel:false, so the IIFE's internals mangle safely while the global
// survives — the same pattern as src/demo/telemetry.js.
// ---------------------------------------------------------------------------

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node backend (server/src/*)
  } else {
    root.__workflowRules = api; // Browser client (src/demo/demo.js)
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEMO_BLOCKER_NONE = "none";
  const DEMO_BLOCKER_NONE_LABEL = "None";
  const VALID_PACK_STATUSES = ["active", "blocked", "draft", "done"];
  const SERVER_PACK_ACTIONS = ["start", "unblock", "block", "done", "open"];

  // Collapse whitespace, trim, and cap length. Matches the server's
  // validation.normalizeText so both engines normalize identically.
  function normalizeText(value, maxLength = 2000) {
    return String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, maxLength);
  }

  // Rewrite the legacy "Button runs next" blocker phrasings to current copy.
  function normalizeLegacyBlockerCopy(value) {
    return value
      .replace(/Button-runs-next/g, "Button runs next")
      .replace(/Button Runs Next/g, "Button runs next")
      .replace(/missing Button runs next/g, "missing next action")
      .replace(/Button runs next/g, "Next action")
      .replace(/button runs next/g, "next action");
  }

  // Canonical stored-blocker normalizer: legacy-copy rewrite + 200-char cap,
  // folding the "none" sentinel. Both engines share this exact behavior.
  function normalizeStoredBlocker(value) {
    const blocker = normalizeLegacyBlockerCopy(normalizeText(value, 200));
    return blocker && blocker.toLowerCase() !== DEMO_BLOCKER_NONE ? blocker : DEMO_BLOCKER_NONE;
  }

  function isUnblockedBlockerValue(value) {
    return normalizeStoredBlocker(value) === DEMO_BLOCKER_NONE;
  }

  // A "next action" is a placeholder (i.e. not yet chosen) when blank or one of
  // the set-it prompts.
  function isPlaceholderNext(label) {
    const value = normalizeText(label, 120).toLowerCase();
    return !value
      || value === "choose action"
      || value === "choose next action"
      || value === "set next action"
      || value === "set button runs next"
      || value === "set next";
  }

  // Derive the forward-path status from (status, blocker, next). Precedence:
  // done stays done; a placeholder next means still a draft; a real blocker
  // means blocked; otherwise active.
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

  // Would pointing packId at targetId create a blocked-by loop? Walks the
  // blockedBy chain up to packs.length hops.
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

  return {
    DEMO_BLOCKER_NONE,
    DEMO_BLOCKER_NONE_LABEL,
    VALID_PACK_STATUSES,
    SERVER_PACK_ACTIONS,
    normalizeText,
    normalizeLegacyBlockerCopy,
    normalizeStoredBlocker,
    isUnblockedBlockerValue,
    isPlaceholderNext,
    forwardPathStatusForBlocker,
    createsBlockedByCycle
  };
});
