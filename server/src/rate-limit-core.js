"use strict";

// ---------------------------------------------------------------------------
// Module: rate-limit-core (pure, engine-neutral)
//
// The counting logic for the Worker's durable rate limiter, with NO Durable
// Object / Worker dependencies so it can be unit-tested directly. The Durable
// Object (worker/index.mjs) only persists the `state` object between calls; all
// decisions happen here.
//
// One evaluation enforces two things at once, per /api request:
//   1. a global daily budget (hard cap on total free usage — bounds cost), and
//   2. a per-IP fixed-window request rate (abuse control).
//
// state shape: { day: "YYYY-MM-DD", budgetCount: number, ips: { [hash]: { count, resetAt } } }
// ---------------------------------------------------------------------------

function emptyState() {
  return { day: "", budgetCount: 0, ips: {} };
}

function dayKeyFor(ts) {
  return new Date(ts).toISOString().slice(0, 10); // UTC calendar day
}

function secondsUntilNextUtcDay(ts) {
  const d = new Date(ts);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - ts) / 1000));
}

function pruneIps(ips, now, maxTrackedIps) {
  for (const key of Object.keys(ips)) {
    if (ips[key].resetAt <= now) {
      delete ips[key];
    }
  }
  // Hard bound on tracked IPs: drop the soonest-to-reset entries if we blow past
  // the cap (pathological fan-out). Insertion order ~ age, so the earliest keys
  // are the oldest windows.
  const keys = Object.keys(ips);
  if (keys.length > maxTrackedIps) {
    for (const key of keys.slice(0, keys.length - maxTrackedIps)) {
      delete ips[key];
    }
  }
}

// Returns { state, allowed, status, message?, retryAfter?, budgetCount }.
// `state` is always the object to persist back (mutated in place from `prev`).
function evaluateRateLimit(prev, opts) {
  const now = opts.now;
  const state = prev && typeof prev === "object"
    ? { day: prev.day || "", budgetCount: prev.budgetCount || 0, ips: prev.ips || {} }
    : emptyState();

  // Daily rollover: reset the budget and the per-IP windows at UTC midnight.
  const today = dayKeyFor(now);
  if (state.day !== today) {
    state.day = today;
    state.budgetCount = 0;
    state.ips = {};
  }

  // 1. Global daily budget (hard cap). Checked before counting so a rejected
  //    request never consumes budget.
  if (state.budgetCount >= opts.dailyMax) {
    return {
      state,
      allowed: false,
      status: 503,
      message: "The demo has reached its daily usage limit. Please try again tomorrow.",
      retryAfter: secondsUntilNextUtcDay(now)
    };
  }

  // 2. Per-IP fixed window.
  const rec = state.ips[opts.ipHash];
  if (!rec || rec.resetAt <= now) {
    state.ips[opts.ipHash] = { count: 1, resetAt: now + opts.windowMs };
  } else if (rec.count >= opts.perIpMax) {
    return {
      state,
      allowed: false,
      status: 429,
      message: "Too many requests from your network. Please slow down.",
      retryAfter: Math.max(1, Math.ceil((rec.resetAt - now) / 1000))
    };
  } else {
    rec.count += 1;
  }

  // Allowed: consume one unit of the daily budget, then bound the IP map.
  state.budgetCount += 1;
  pruneIps(state.ips, now, opts.maxTrackedIps || 20000);

  return { state, allowed: true, status: 200, budgetCount: state.budgetCount };
}

module.exports = {
  emptyState,
  dayKeyFor,
  secondsUntilNextUtcDay,
  evaluateRateLimit
};
