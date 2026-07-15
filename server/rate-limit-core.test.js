"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRateLimit, dayKeyFor, secondsUntilNextUtcDay } = require("./src/rate-limit-core.js");

const DAY = Date.UTC(2026, 6, 15, 12, 0, 0); // 2026-07-15 12:00 UTC
const opts = (over) => ({
  now: DAY,
  ipHash: "ipA",
  windowMs: 60000,
  perIpMax: 3,
  dailyMax: 10,
  maxTrackedIps: 100,
  ...over
});

test("allows requests under both limits and counts budget", () => {
  let state = null;
  for (let i = 1; i <= 3; i++) {
    const r = evaluateRateLimit(state, opts());
    assert.equal(r.allowed, true, `request ${i} allowed`);
    assert.equal(r.budgetCount, i);
    state = r.state;
  }
});

test("blocks a 4th request in the per-IP window with 429 + retryAfter", () => {
  let state = null;
  for (let i = 0; i < 3; i++) state = evaluateRateLimit(state, opts()).state;
  const r = evaluateRateLimit(state, opts());
  assert.equal(r.allowed, false);
  assert.equal(r.status, 429);
  assert.ok(r.retryAfter >= 1 && r.retryAfter <= 60);
});

test("rejected per-IP request does NOT consume the daily budget", () => {
  let state = null;
  for (let i = 0; i < 3; i++) state = evaluateRateLimit(state, opts()).state;
  const budgetBefore = state.budgetCount;
  const r = evaluateRateLimit(state, opts()); // 4th → rejected
  assert.equal(r.allowed, false);
  assert.equal(r.state.budgetCount, budgetBefore, "budget unchanged on rejection");
});

test("per-IP window resets after windowMs", () => {
  let state = null;
  for (let i = 0; i < 3; i++) state = evaluateRateLimit(state, opts()).state;
  // blocked now, but allowed once the window has elapsed
  assert.equal(evaluateRateLimit(state, opts()).allowed, false);
  const later = evaluateRateLimit(state, opts({ now: DAY + 61000 }));
  assert.equal(later.allowed, true);
});

test("different IPs are independent", () => {
  let state = null;
  for (let i = 0; i < 3; i++) state = evaluateRateLimit(state, opts({ ipHash: "ipA" })).state;
  assert.equal(evaluateRateLimit(state, opts({ ipHash: "ipA" })).allowed, false);
  assert.equal(evaluateRateLimit(state, opts({ ipHash: "ipB" })).allowed, true);
});

test("global daily budget returns 503 once exhausted", () => {
  // spread across many IPs so per-IP never trips; dailyMax = 10
  let state = null;
  for (let i = 0; i < 10; i++) {
    const r = evaluateRateLimit(state, opts({ ipHash: "ip" + i }));
    assert.equal(r.allowed, true);
    state = r.state;
  }
  const over = evaluateRateLimit(state, opts({ ipHash: "ipX" }));
  assert.equal(over.allowed, false);
  assert.equal(over.status, 503);
  assert.ok(over.retryAfter >= 1);
});

test("daily rollover resets budget and per-IP windows", () => {
  let state = null;
  for (let i = 0; i < 10; i++) state = evaluateRateLimit(state, opts({ ipHash: "ip" + i })).state;
  assert.equal(evaluateRateLimit(state, opts({ ipHash: "ipZ" })).allowed, false); // budget exhausted today
  const nextDay = DAY + 24 * 3600 * 1000;
  const r = evaluateRateLimit(state, opts({ now: nextDay, ipHash: "ipZ" }));
  assert.equal(r.allowed, true, "allowed after rollover");
  assert.equal(r.budgetCount, 1, "budget reset");
});

test("prunes the IP map to maxTrackedIps", () => {
  let state = null;
  for (let i = 0; i < 50; i++) {
    state = evaluateRateLimit(state, opts({ ipHash: "ip" + i, maxTrackedIps: 10, dailyMax: 1000 })).state;
  }
  assert.ok(Object.keys(state.ips).length <= 10, "ip map bounded");
});

test("dayKeyFor + secondsUntilNextUtcDay behave", () => {
  assert.equal(dayKeyFor(DAY), "2026-07-15");
  const secs = secondsUntilNextUtcDay(DAY);
  assert.equal(secs, 12 * 3600); // noon → midnight = 12h
});
