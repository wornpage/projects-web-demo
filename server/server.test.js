"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

const {
  normalizeText,
  workflowTextField,
  workflowStringArrayField,
  postgresStateKey,
  isGeneratedClientStateKey,
  isSyncStateKey,
  forwardPathStatusForBlocker,
  envInteger,
  normalizedCorsOrigin
} = require("./server.js");

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------
describe("normalizeText", () => {
  it("trims whitespace and collapses internal whitespace", () => {
    assert.strictEqual(normalizeText("  hello   world  "), "hello world");
  });

  it("returns empty string for null or undefined", () => {
    assert.strictEqual(normalizeText(null), "");
    assert.strictEqual(normalizeText(undefined), "");
  });

  it("truncates to maxLength", () => {
    assert.strictEqual(normalizeText("abcdefghij", 5), "abcde");
  });

  it("handles empty string", () => {
    assert.strictEqual(normalizeText(""), "");
  });

  it("handles only whitespace", () => {
    assert.strictEqual(normalizeText("   "), "");
  });

  it("defaults maxLength to 2000", () => {
    const long = "x".repeat(3000);
    const result = normalizeText(long);
    assert.strictEqual(result.length, 2000);
  });

  it("preserves single spaces between words", () => {
    assert.strictEqual(normalizeText("one two three"), "one two three");
  });
});

// ---------------------------------------------------------------------------
// workflowTextField
// ---------------------------------------------------------------------------
describe("workflowTextField", () => {
  it("returns empty string for missing optional field", () => {
    assert.strictEqual(workflowTextField({}, "title", 100), "");
  });

  it("throws for missing required field", () => {
    assert.throws(() => workflowTextField({}, "title", 100, { required: true }), {
      message: /title is required/u
    });
  });

  it("returns normalized valid string", () => {
    assert.strictEqual(workflowTextField({ title: "  Hello  " }, "title", 100), "Hello");
  });

  it("throws for non-string value", () => {
    assert.throws(() => workflowTextField({ title: 42 }, "title", 100), {
      message: /title must be text/u
    });
  });

  it("throws for value exceeding maxLength", () => {
    assert.throws(() => workflowTextField({ title: "a".repeat(101) }, "title", 100), {
      message: /cannot be more than 100 characters/u
    });
  });
});

// ---------------------------------------------------------------------------
// workflowStringArrayField
// ---------------------------------------------------------------------------
describe("workflowStringArrayField", () => {
  it("returns empty array for missing field", () => {
    assert.deepStrictEqual(workflowStringArrayField({}, "tags", 5, 50), []);
  });

  it("returns normalized entries", () => {
    const result = workflowStringArrayField({ tags: ["  Alpha  ", "Beta"] }, "tags", 5, 50);
    assert.deepStrictEqual(result, ["Alpha", "Beta"]);
  });

  it("throws for non-array value", () => {
    assert.throws(() => workflowStringArrayField({ tags: "nope" }, "tags", 5, 50), {
      message: /must be a text array/u
    });
  });

  it("throws for too many items", () => {
    assert.throws(() => workflowStringArrayField({ tags: ["a", "b", "c"] }, "tags", 2, 50), {
      message: /cannot contain more than 2 entries/u
    });
  });

  it("throws for blank entry", () => {
    assert.throws(() => workflowStringArrayField({ tags: [""] }, "tags", 5, 50), {
      message: /must be nonblank text/u
    });
  });
});

// ---------------------------------------------------------------------------
// postgresStateKey
// ---------------------------------------------------------------------------
describe("postgresStateKey", () => {
  it("produces deterministic SHA-256 prefixed key", () => {
    const key = postgresStateKey("test-key-123");
    const expectedHash = crypto.createHash("sha256").update("test-key-123").digest("hex");
    assert.strictEqual(key, `v2:${expectedHash}`);
  });

  it("truncates and normalizes input before hashing", () => {
    const key = postgresStateKey("  ABC  ");
    const expectedHash = crypto.createHash("sha256").update("ABC").digest("hex");
    assert.strictEqual(key, `v2:${expectedHash}`);
  });

  it("throws for empty key", () => {
    assert.throws(() => postgresStateKey(""), { message: /State key is required/u });
  });

  it("throws for whitespace-only key", () => {
    assert.throws(() => postgresStateKey("   "), { message: /State key is required/u });
  });
});

// ---------------------------------------------------------------------------
// isGeneratedClientStateKey / isSyncStateKey
// ---------------------------------------------------------------------------
describe("isGeneratedClientStateKey", () => {
  it("accepts demo- UUID format", () => {
    assert.strictEqual(isGeneratedClientStateKey("demo-550e8400-e29b-41d4-a716-446655440000"), true);
  });

  it("accepts demo- base64url format (22 chars)", () => {
    assert.strictEqual(isGeneratedClientStateKey("demo-AbCdEfGhIjKlMnOpQrStUv"), true);
  });

  it("accepts sync- keys", () => {
    assert.strictEqual(isGeneratedClientStateKey("sync-" + "A".repeat(43)), true);
  });

  it("rejects short values", () => {
    assert.strictEqual(isGeneratedClientStateKey("demo-abc"), false);
  });

  it("rejects empty string", () => {
    assert.strictEqual(isGeneratedClientStateKey(""), false);
  });

  it("rejects null", () => {
    assert.strictEqual(isGeneratedClientStateKey(null), false);
  });
});

describe("isSyncStateKey", () => {
  it("accepts valid sync key", () => {
    assert.strictEqual(isSyncStateKey("sync-" + "A".repeat(43)), true);
  });

  it("rejects wrong length", () => {
    assert.strictEqual(isSyncStateKey("sync-" + "A".repeat(42)), false);
    assert.strictEqual(isSyncStateKey("sync-" + "A".repeat(44)), false);
  });

  it("rejects non-sync prefix", () => {
    assert.strictEqual(isSyncStateKey("demo-xxxx"), false);
  });
});

// ---------------------------------------------------------------------------
// forwardPathStatusForBlocker
// ---------------------------------------------------------------------------
describe("forwardPathStatusForBlocker", () => {
  it("returns 'done' when status is 'done'", () => {
    assert.strictEqual(forwardPathStatusForBlocker("done", "none"), "done");
  });

  it("returns 'draft' when next action is a placeholder", () => {
    assert.strictEqual(forwardPathStatusForBlocker("active", "none", "Set next action"), "draft");
  });

  it("returns 'draft' when next action is empty (needs setup)", () => {
    assert.strictEqual(forwardPathStatusForBlocker("active", "waiting on review"), "draft");
  });

  it("returns 'blocked' when blocker exists and next is set", () => {
    assert.strictEqual(forwardPathStatusForBlocker("active", "waiting on review", "Code review"), "blocked");
  });

  it("returns 'active' for normal active work", () => {
    assert.strictEqual(forwardPathStatusForBlocker("active", "none", "Code review"), "active");
  });

  it("returns 'draft' for empty inputs (no next action)", () => {
    assert.strictEqual(forwardPathStatusForBlocker("", ""), "draft");
  });
});

// ---------------------------------------------------------------------------
// envInteger
// ---------------------------------------------------------------------------
describe("envInteger", () => {
  it("returns fallback when env var is not set", () => {
    const saved = process.env.TEST_MY_VAR;
    delete process.env.TEST_MY_VAR;
    try {
      assert.strictEqual(envInteger("TEST_MY_VAR", 42, 1, 100), 42);
    } finally {
      process.env.TEST_MY_VAR = saved;
    }
  });

  it("parses a valid integer from env", () => {
    const saved = process.env.TEST_MY_VAR;
    process.env.TEST_MY_VAR = "50";
    try {
      assert.strictEqual(envInteger("TEST_MY_VAR", 42, 1, 100), 50);
    } finally {
      process.env.TEST_MY_VAR = saved;
    }
  });

  it("throws for non-numeric value", () => {
    const saved = process.env.TEST_MY_VAR;
    process.env.TEST_MY_VAR = "abc";
    try {
      assert.throws(() => envInteger("TEST_MY_VAR", 42, 1, 100), {
        message: /must be an integer/u
      });
    } finally {
      process.env.TEST_MY_VAR = saved;
    }
  });

  it("throws for value below min", () => {
    const saved = process.env.TEST_MY_VAR;
    process.env.TEST_MY_VAR = "0";
    try {
      assert.throws(() => envInteger("TEST_MY_VAR", 42, 1, 100), {
        message: /must be an integer/u
      });
    } finally {
      process.env.TEST_MY_VAR = saved;
    }
  });

  it("throws for value above max", () => {
    const saved = process.env.TEST_MY_VAR;
    process.env.TEST_MY_VAR = "101";
    try {
      assert.throws(() => envInteger("TEST_MY_VAR", 42, 1, 100), {
        message: /must be an integer/u
      });
    } finally {
      process.env.TEST_MY_VAR = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// normalizedCorsOrigin
// ---------------------------------------------------------------------------
describe("normalizedCorsOrigin", () => {
  it("returns origin for valid URL", () => {
    assert.strictEqual(normalizedCorsOrigin("https://example.com"), "https://example.com");
  });

  it("returns empty for URL with path", () => {
    assert.strictEqual(normalizedCorsOrigin("https://example.com/path"), "https://example.com");
  });

  it("returns empty for invalid URL", () => {
    assert.strictEqual(normalizedCorsOrigin("not-a-url"), "");
  });

  it("returns empty for empty input", () => {
    assert.strictEqual(normalizedCorsOrigin(""), "");
    assert.strictEqual(normalizedCorsOrigin(null), "");
  });

  it("rejects non-http/https protocols", () => {
    assert.strictEqual(normalizedCorsOrigin("ftp://example.com"), "");
  });
});
