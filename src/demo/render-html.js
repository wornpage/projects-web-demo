// ---------------------------------------------------------------------------
// Module: render-html (shared, engine-neutral)
//
// Pure functions that take a RenderModel snapshot and return HTML strings for
// each route. Called by:
//   - The client (demo.js): renderHome() → renderHomeHtml(state.renderModel)
//   - The SSR server (server/src/render-html.js): builds a model from server
//     state and calls these same functions
//
// No DOM access, no event binding, no side effects. Just template literals +
// the helper builders that also accept a model parameter.
//
// Dual-loaded (UMD): the server require()s it; the client build prepends it
// into the bundle (exposes window.__renderHtml).
// ---------------------------------------------------------------------------

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.__renderHtml = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // -----------------------------------------------------------------------
  // HTML escaping — must work without browser globals for SSR.
  // -----------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return String(value ?? "").replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------------
  // Simple card/builders that only need string params (no pack/model needed).
  // These are called from route templates with pre-computed values.
  // -----------------------------------------------------------------------

  function insightCard(label, value, detail, tone) {
    return `<div class="demo-insight-card demo-insight-${escapeAttribute(tone)}">
      <span class="demo-summary-label">${escapeHtml(label)}</span>
      <span class="demo-insight-value">${escapeHtml(value)}</span>
      <small>${escapeHtml(detail)}</small>
    </div>`;
  }

  function navButton(route, label, cls) {
    return `<button type="button" class="${escapeAttribute(cls || "btn")}" data-go="${escapeAttribute(route)}">${escapeHtml(label)}</button>`;
  }

  // -----------------------------------------------------------------------
  // Route: Home / Dashboard
  // -----------------------------------------------------------------------

  function renderHomeHtml(model) {
    const packs = model.packs || [];
    const copy = model.copy || {};

    if (packs.length === 0) {
      // Empty state — client handles this via renderMethodPicker().
      // For SSR, send a minimal placeholder; the client can detect and
      // run the picker on hydration.
      return `<section class="demo-panel"><p>Loading…</p></section>`;
    }

    const reviewCount = packs.filter(function (p) {
      // Simple inline review check: has blocker or missing next action.
      // The full isReview() function lives in demo.js with more nuance.
      const blocker = (p.blocker || "").toLowerCase();
      const hasBlocker = blocker && blocker !== "none";
      const next = (p.next || "").trim().toLowerCase();
      const missingNext = !next || next === "choose action" || next === "choose next action" || next === "set next action" || next === "set button runs next" || next === "set next";
      return hasBlocker || missingNext;
    }).length;

    const doneCount = packs.filter(function (p) { return p.status === "done"; }).length;
    const totalCount = packs.length;

    return `<section class="demo-panel demo-home-hero">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Dashboard</span>
          <h2>${totalCount} ${escapeHtml(copy.workMany || "work items")} loaded</h2>
        </div>
      </div>
      <p class="demo-home-lede">Each card below is one piece of work with an owner, a blocker, a next action, and a proof it's done. Start with <button type="button" class="demo-linkish" data-go="review">Review</button> to see what needs a decision.</p>
      <div class="demo-insights-grid">
        ${insightCard("Need review", String(reviewCount), reviewCount + " with blockers", reviewCount > 0 ? "warn" : "good")}
        ${insightCard("Complete", Math.round((doneCount / Math.max(totalCount, 1)) * 100) + "%", doneCount + " finished", doneCount > 0 ? "good" : "neutral")}
        ${insightCard("Total", String(totalCount), copy.workMany || "items", "neutral")}
      </div>
      <div class="demo-quick-actions demo-secondary-paths" aria-label="Demo actions">
        ${navButton("review", "Review work", "btn btn-primary")}
        ${navButton("create", copy.newWork || "New work item")}
        ${navButton("settings", "Settings")}
        <button class="btn" type="button" id="reset-demo-home">Reset sample</button>
      </div>
      <div class="demo-home-share" aria-label="Share and export">
        <h3>Share and export</h3>
        <div class="demo-quick-actions">
          <button class="btn btn-sm" type="button" id="export-csv-home">Export CSV</button>
          <button class="btn btn-sm" type="button" id="export-ics-home">Export .ics</button>
          <button class="btn btn-sm" type="button" id="copy-standup-home">Copy standup</button>
          <button class="btn btn-sm" type="button" id="email-standup-home">Email standup</button>
          <button class="btn btn-sm" type="button" id="copy-link-home">Copy share link</button>
        </div>
      </div>
    </section>`;
  }

  // -----------------------------------------------------------------------
  // Route: Review
  // Shows a header with review counts and a standup summary. Individual
  // review cards are hydrated client-side for full interactivity.
  // -----------------------------------------------------------------------

  function renderReviewHtml(model) {
    const packs = model.packs || [];
    const copy = model.copy || {};

    // Inline review filter matching the client's isReview() logic.
    function isReview(p) {
      const blocker = (p.blocker || "").toLowerCase();
      const hasBlocker = blocker && blocker !== "none";
      const next = (p.next || "").trim().toLowerCase();
      const missingNext = !next || next === "choose action" || next === "choose next action" || next === "set next action" || next === "set button runs next" || next === "set next";
      return hasBlocker || missingNext;
    }

    const review = packs.filter(isReview);
    const blockedCount = review.filter(function(p) {
      const b = (p.blocker || "").toLowerCase();
      return b && b !== "none";
    }).length;
    const missingNextCount = review.filter(function(p) {
      const n = (p.next || "").trim().toLowerCase();
      return !n || n === "choose action" || n === "choose next action" || n === "set next action" || n === "set button runs next" || n === "set next";
    }).length;
    const ownerGapCount = review.filter(function(p) {
      const b = (p.blocker || "").toLowerCase();
      const o = (p.owner || "").toLowerCase();
      return b && b !== "none" && b.indexOf("owner") !== -1 && (!o || o === "unassigned" || o === "no owner" || o === "unowned");
    }).length;

    const standupLines = review.length === 0
      ? `Standup — every ${copy.workOne || "work item"} has a clear next action. Nothing needs a decision.`
      : `Standup — ${review.length} ${review.length === 1 ? (copy.workOne || "work item") : (copy.workMany || "work items")} ${review.length === 1 ? "needs" : "need"} a decision (${blockedCount} blocked, ${missingNextCount} missing action, ${ownerGapCount} owner ${ownerGapCount === 1 ? "gap" : "gaps"}).`;

    return `<section class="demo-panel demo-list-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Needs decision</span>
          <h2>${review.length} ${escapeHtml(review.length === 1 ? (copy.workOne || "work item") : (copy.workMany || "work items"))} to review</h2>
        </div>
        <div class="demo-review-head-actions">
          <span class="demo-status">${review.length} needs decision</span>
          ${review.length > 0 ? `<button class="btn btn-sm" type="button" id="copy-standup" title="Copy a shareable standup summary" aria-label="Copy standup summary">Copy standup</button>` : ""}
        </div>
      </div>
      <div class="demo-review-standup" aria-live="polite">
        <p>${escapeHtml(standupLines)}</p>
      </div>
      <div class="demo-review-list" id="review-card-list">
        <p>Loading review cards…</p>
      </div>
    </section>`;
  }

  // -----------------------------------------------------------------------
  // Route: Terms — fully static content, no hydration needed beyond the
  // github link href that bindTermsControls sets.
  // -----------------------------------------------------------------------

  function renderTermsHtml() {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <h2>Terms &amp; Privacy</h2>
      </div>
      <div class="demo-prose">
        <p><strong>This is a personal portfolio demonstration project.</strong> It is not a commercial product, not a service, and not intended for production use.</p>
        <h3>Data</h3>
        <p>This demo does not collect, store, or process personal data. There are no user accounts, no passwords, and no authentication. Any work items, memory notes, or settings you enter stay in your browser's local storage or in the demo backend row assigned to your anonymous client key. The project owner has no access to that data.</p>
        <h3>Sample data</h3>
        <p>The pre-loaded work items are fictional examples. Any resemblance to real projects, companies, or people is coincidental.</p>
        <h3>No warranty</h3>
        <p>This demo is provided "as is" without warranty of any kind.</p>
        <h3>Source code</h3>
        <p>This project is <a id="terms-github-link" href="#/terms" target="_blank" rel="noopener">open source on GitHub</a> under the GNU Affero General Public License v3.0.</p>
      </div>
    </section>`;
  }

  // -----------------------------------------------------------------------
  // Exports — one function per route, plus helpers.
  // -----------------------------------------------------------------------

  return {
    escapeHtml,
    escapeAttribute,
    insightCard,
    navButton,
    renderHomeHtml,
    renderReviewHtml,
    renderTermsHtml
  };
});
