// Structured error telemetry — keyed DOMAIN:operation:outcome triples.
// Usage:
//   trace("backend", "pack-action", "error", { packId, reason: "timeout" })
//   → logs  "TRACE backend:pack-action:error {"packId":"...","reason":"timeout"}"
// Non-production: writes to console. Production: swap out for your telemetry sink.

(function () {
  "use strict";

  const EMIT = "console"; // "console" | "none" | URL string

  function trace(domain, operation, outcome, extra = {}) {
    const key = `${domain}:${operation}:${outcome}`;
    const payload = { ts: new Date().toISOString(), key, ...extra };
    if (EMIT === "console") {
      const method = outcome === "error" ? "error" : "log";
      console[method]("TRACE", payload);
    }
    // Extend: POST to EMIT URL, batch, sample, etc.
  }

  // Wrap critical async paths
  function traced(fn, domain, operation) {
    return async function (...args) {
      try {
        const result = await fn.apply(this, args);
        trace(domain, operation, "ok");
        return result;
      } catch (err) {
        trace(domain, operation, "error", { message: err.message });
        throw err;
      }
    };
  }

  // Expose for the demo
  window.__telemetry = { trace, traced };
})();
