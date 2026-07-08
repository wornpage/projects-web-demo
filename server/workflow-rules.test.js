"use strict";

// Unit tests for the shared workflow-rules core. Because BOTH engines (this
// backend and the static client bundle) consume this exact module, these tests
// pin the parity behavior for both at once.

const { describe, it } = require("node:test");
const assert = require("node:assert");
const rules = require("./src/workflow-rules.js");

describe("workflow-rules: constants", () => {
  it("exposes the four stored statuses and the blocker sentinel", () => {
    assert.deepStrictEqual(rules.VALID_PACK_STATUSES, ["active", "blocked", "draft", "done"]);
    assert.strictEqual(rules.DEMO_BLOCKER_NONE, "none");
  });
});

describe("workflow-rules: normalizeStoredBlocker", () => {
  it("folds blank/none to the sentinel", () => {
    assert.strictEqual(rules.normalizeStoredBlocker(""), "none");
    assert.strictEqual(rules.normalizeStoredBlocker("  none  "), "none");
    assert.strictEqual(rules.normalizeStoredBlocker(null), "none");
  });

  it("collapses whitespace and preserves a real blocker", () => {
    assert.strictEqual(rules.normalizeStoredBlocker("  waiting   on   audit "), "waiting on audit");
  });

  it("rewrites legacy 'Button runs next' phrasing (the reconciled behavior)", () => {
    assert.strictEqual(rules.normalizeStoredBlocker("missing Button runs next"), "missing next action");
    assert.strictEqual(rules.normalizeStoredBlocker("Button runs next"), "Next action");
  });

  it("caps the stored blocker at 200 characters", () => {
    assert.strictEqual(rules.normalizeStoredBlocker("x".repeat(500)).length, 200);
  });
});

describe("workflow-rules: isUnblockedBlockerValue", () => {
  it("is true only for the sentinel/blank", () => {
    assert.strictEqual(rules.isUnblockedBlockerValue("none"), true);
    assert.strictEqual(rules.isUnblockedBlockerValue(""), true);
    assert.strictEqual(rules.isUnblockedBlockerValue("waiting"), false);
  });
});

describe("workflow-rules: isPlaceholderNext", () => {
  it("treats blank and the set-it prompts as placeholders", () => {
    for (const label of ["", "choose action", "choose next action", "set next action", "set button runs next", "set next"]) {
      assert.strictEqual(rules.isPlaceholderNext(label), true, `expected placeholder: ${JSON.stringify(label)}`);
    }
  });

  it("treats a real next action as non-placeholder", () => {
    assert.strictEqual(rules.isPlaceholderNext("Review blocker"), false);
    assert.strictEqual(rules.isPlaceholderNext("Open"), false);
  });
});

describe("workflow-rules: forwardPathStatusForBlocker", () => {
  it("done stays done", () => {
    assert.strictEqual(rules.forwardPathStatusForBlocker("done", "none", "Open"), "done");
  });
  it("a placeholder next means draft", () => {
    assert.strictEqual(rules.forwardPathStatusForBlocker("active", "none", "choose action"), "draft");
  });
  it("a real blocker means blocked", () => {
    assert.strictEqual(rules.forwardPathStatusForBlocker("active", "waiting on audit", "Open"), "blocked");
  });
  it("otherwise active", () => {
    assert.strictEqual(rules.forwardPathStatusForBlocker("active", "none", "Open"), "active");
  });
});

describe("workflow-rules: createsBlockedByCycle", () => {
  const packs = [
    { id: "a", blockedBy: "b" },
    { id: "b", blockedBy: "" },
    { id: "c", blockedBy: "a" }
  ];
  it("detects a direct loop", () => {
    assert.strictEqual(rules.createsBlockedByCycle(packs, "b", "a"), true);
  });
  it("detects a transitive loop", () => {
    assert.strictEqual(rules.createsBlockedByCycle(packs, "b", "c"), true);
  });
  it("allows a non-looping link", () => {
    assert.strictEqual(rules.createsBlockedByCycle(packs, "a", "b"), false);
  });
});

describe("workflow-rules: packActionEffect", () => {
  it("start clears the missing-setup blocker and opens a placeholder next", () => {
    assert.deepStrictEqual(
      rules.packActionEffect({ status: "draft", blocker: "missing setup", next: "choose action" }, "start"),
      { status: "active", blocker: "none", next: "Open" }
    );
  });
  it("start preserves an existing blocker and next", () => {
    assert.deepStrictEqual(
      rules.packActionEffect({ status: "blocked", blocker: "waiting", next: "Review blocker" }, "start"),
      { status: "active", blocker: "waiting", next: "Review blocker" }
    );
  });
  it("unblock resets blocker and next", () => {
    assert.deepStrictEqual(
      rules.packActionEffect({ status: "blocked", blocker: "waiting", next: "x" }, "unblock"),
      { status: "active", blocker: "none", next: "Open" }
    );
  });
  it("block sets the demo blocker", () => {
    assert.deepStrictEqual(
      rules.packActionEffect({ status: "active", blocker: "none", next: "Open" }, "block"),
      { status: "blocked", blocker: "blocked in this demo", next: "Set Blocker: None" }
    );
  });
  it("done clears the blocker and dependency but leaves next", () => {
    assert.deepStrictEqual(
      rules.packActionEffect({ status: "active", blocker: "waiting", next: "Ship it", blockedBy: "x" }, "done"),
      { status: "done", blocker: "none", blockedBy: "" }
    );
  });
  it("returns an empty patch for unknown actions", () => {
    assert.deepStrictEqual(rules.packActionEffect({ status: "active" }, "open"), {});
  });
});

describe("workflow-rules: blockedByBlockerText", () => {
  it("formats the waiting-on text with the injected title", () => {
    assert.strictEqual(rules.blockedByBlockerText({ id: "x" }, () => "Widget X"), "waiting on Widget X");
  });
});

describe("workflow-rules: unblockPacksBlockedBy", () => {
  it("clears dependents, recomputes status, and logs via the injected seams", () => {
    const packs = [
      { id: "a", blockedBy: "" },
      { id: "b", blockedBy: "a", blocker: "waiting on A", status: "blocked", next: "Open" },
      { id: "c", blockedBy: "a", blocker: "waiting on A", status: "blocked", next: "choose action" },
      { id: "d", blockedBy: "z", blocker: "waiting on Z", status: "blocked", next: "Open" }
    ];
    const activity = [];
    const unblocked = rules.unblockPacksBlockedBy(packs, { id: "a" }, {
      onActivity: (pack, text) => activity.push([pack.id, text]),
      workTitle: (pack) => `Work ${pack.id}`
    });

    assert.deepStrictEqual(unblocked.map((p) => p.id), ["b", "c"]);
    // b had a real next -> active; c had a placeholder next -> draft.
    assert.strictEqual(packs[1].status, "active");
    assert.strictEqual(packs[2].status, "draft");
    assert.strictEqual(packs[1].blocker, "none");
    assert.strictEqual(packs[1].blockedBy, "");
    // d depends on a different pack and is untouched.
    assert.strictEqual(packs[3].blockedBy, "z");
    assert.deepStrictEqual(activity, [
      ["b", "Unblocked: Work a finished with proof."],
      ["c", "Unblocked: Work a finished with proof."]
    ]);
  });
});
