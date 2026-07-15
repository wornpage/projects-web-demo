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

  // --- Activity helpers (mirror the client's activityParts/relativeActivityTime
  //     so the server can own the Activity route render) ---
  const ACTIVITY_STAMP_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] /u;
  const ACTIVITY_MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

  function activityParts(entry) {
    const value = typeof entry === "string" ? entry : "";
    const match = ACTIVITY_STAMP_RE.exec(value);
    return match ? { text: value.slice(match[0].length), at: match[1] } : { text: value, at: "" };
  }

  function relativeActivityTime(at) {
    const then = at ? new Date(`${at.replace(" ", "T")}Z`) : null;
    if (!then || Number.isNaN(then.getTime())) {
      return "earlier";
    }
    const mins = Math.round((Date.now() - then.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${ACTIVITY_MONTHS[then.getMonth()]} ${then.getDate()}`;
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

  function reviewCardHtml(pack) {
    const title = escapeHtml(String(pack.title || "Untitled").slice(0, 120));
    const status = escapeHtml(pack.status || "active");
    const blocker = (pack.blocker || "").toLowerCase();
    const blockerDisplay = blocker && blocker !== "none" ? escapeHtml(String(pack.blocker).slice(0, 80)) : "None";
    const owner = escapeHtml(String(pack.owner || "Unassigned").slice(0, 60));
    const next = escapeHtml(String(pack.next || "Open").slice(0, 80));
    const id = escapeAttribute(pack.id || "");
    return `<div class="demo-work-card" data-pack-id="${id}">
      <div class="demo-work-card-main">
        <button type="button" class="demo-card-title" data-action="select" data-pack="${id}">${title}</button>
        <span class="demo-state-pill">${status}</span>
      </div>
      <div class="demo-work-card-meta">
        <span>Blocker: ${blockerDisplay}</span>
        <span>Owner: ${owner}</span>
        <span>Next: ${next}</span>
      </div>
    </div>`;
  }

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

    const cardHtml = review.length > 0
      ? review.map(reviewCardHtml).join("")
      : `<p>No ${copy.workMany || "work items"} need review.</p>`;

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
      <div class="demo-review-list">
        ${cardHtml}
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
        <p>The pre-loaded work items are fictional examples. Any resemblance to real projects, companies, or people is coincidental. You can replace them with your own data via the Settings → Import feature or by creating new work items.</p>
        <h3>No warranty</h3>
        <p>This demo is provided "as is" without warranty of any kind. The project owner is not responsible for any data loss or damages from using this demo.</p>
        <h3>Source code</h3>
        <p>This project is <a id="terms-github-link" href="#/terms" target="_blank" rel="noopener">open source on GitHub</a> under the GNU Affero General Public License v3.0 — see the LICENSE file in the repository. Commercial licensing is available on request.</p>
      </div>
    </section>`;
  }

  // -----------------------------------------------------------------------
  // Route stubs for remaining routes — each shows a meaningful header
  // and a loading indicator. Cards and interactive elements hydrate
  // client-side after the initial paint.
  // -----------------------------------------------------------------------

  function renderWorkHtml(model) {
    const copy = model.copy || {};
    return `<section class="demo-panel demo-list-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">${escapeHtml(copy.workMany || "Work items")}</span>
          <h2>${(model.packs || []).length} visible</h2>
        </div>
        ${navButton("create", copy.newWork || "New work item", "btn btn-primary")}
      </div>
      <div class="demo-work-list">${
        (model.packs || []).slice(0, 20).map(function(p) {
          var title = escapeHtml(String(p.title || "Untitled").slice(0, 100));
          var status = escapeHtml(p.status || "active");
          var id = escapeAttribute(p.id || "");
          return `<div class="demo-work-card" data-pack-id="${id}"><div class="demo-work-card-main"><button type="button" class="demo-card-title" data-action="select" data-pack="${id}">${title}</button><span class="demo-state-pill">${status}</span></div></div>`;
        }).join("") || "<p>No work items found.</p>"
      }</div></section>`;
  }

  function renderNextHtml(model) {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Next setup</span>
          <h2>Choose what the main button runs</h2>
        </div>
      </div>
      <p>Select the next action for the current work item. The chooser will appear after hydration.</p>
    </section>`;
  }

  function renderCreateHtml(model) {
    const copy = model.copy || {};
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Create</span>
          <h2>${escapeHtml(copy.newWork || "New work item")}</h2>
        </div>
      </div>
      <p>Create a new ${escapeHtml(model.copy.workOne || "work item")}. The form will appear after hydration.</p>
    </section>`;
  }

  function renderMemoryHtml() {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Memory</span>
        <h2>Memory notes</h2>
      </div>
      <p>Memory notes for the selected work item will appear after hydration.</p>
    </section>`;
  }

  function renderSettingsHtml() {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Settings</span>
        <h2>Profile, scenario, and theme</h2>
      </div>
      <div class="demo-settings-section">
        <h3>Profile</h3>
        <p>Current: <strong>${escapeHtml(model.copyProfile || "general")}</strong></p>
        <p>Work label: ${escapeHtml(model.copy.work || "work")}</p>
      </div>
      <div class="demo-settings-section">
        <h3>Work items</h3>
        <p>${(model.packs || []).length} items loaded</p>
      </div>
      <div class="demo-settings-section">
        <p>Profile, scenario, and theme controls will appear here after hydration.</p>
      </div>
    </section>`;
  }

  function renderSearchHtml() {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Search</span>
        <h2>Find work items</h2>
      </div>
      <p>Search across ${(model.packs || []).length} work items. The search input will appear after hydration.</p>
    </section>`;
  }

  function renderCalendarHtml(model) {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Calendar</span>
        <h2>Due dates for ${(model.packs || []).length} items</h2>
      </div>
      <p>Calendar grid will render after hydration. ${(model.packs || []).length} items have due dates.</p>
    </section>`;
  }

  function renderGanttHtml(model) {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Timeline</span>
        <h2>Timeline for ${(model.packs || []).length} items</h2>
      </div>
      <p>Gantt chart will render after hydration.</p>
    </section>`;
  }

  function renderInsightsHtml(model) {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Insights</span>
        <h2>Dashboard stats for ${(model.packs || []).length} items</h2>
      </div>
      <p>Dashboard charts will render after hydration.</p>
    </section>`;
  }

  function renderActivityHtml(model) {
    const packs = model.packs || [];
    const copy = model.copy || {};
    const feed = [];
    packs.forEach(function (pack) {
      (pack.activity || []).forEach(function (raw, index) {
        const parts = activityParts(raw);
        if (parts.text) {
          feed.push({ pack: pack, text: parts.text, at: parts.at, index: index });
        }
      });
    });
    const recent = feed
      .sort(function (a, b) { return (b.at || "").localeCompare(a.at || "") || a.index - b.index; })
      .slice(0, 50);
    const workNoun = packs.length === 1 ? (copy.workOne || "work item") : (copy.workMany || "work items");
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <div>
          <span class="section-label">Activity</span>
          <h2>${feed.length} actions across ${packs.length} ${escapeHtml(workNoun)}</h2>
        </div>
      </div>
      <div class="demo-activity-feed">
        ${recent.length ? recent.map(function (item) {
          return `<div class="demo-activity-entry">
            <span class="demo-activity-dot"></span>
            <div class="demo-activity-body">
              <button class="demo-card-title" type="button" data-action="select" data-pack="${escapeAttribute(item.pack.id || "")}">${escapeHtml(String(item.pack.title || "Untitled").slice(0, 120))}</button>
              <p>${escapeHtml(item.text)} <time class="demo-activity-time">${escapeHtml(relativeActivityTime(item.at))}</time></p>
            </div>
          </div>`;
        }).join("") : `<p class="demo-field-help">No activity yet. Actions appear here as you work through the demo.</p>`}
      </div>
    </section>`;
  }

  function renderPackDetailHtml(model) {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Work path</span>
        <h2>Loading work path…</h2>
      </div>
      <p>Work path form will render after hydration.</p>
    </section>`;
  }

  function renderCompareHtml() {
    return `<section class="demo-panel">
      <div class="demo-panel-head">
        <span class="section-label">Compare</span>
        <h2>Side-by-side comparison</h2>
      </div>
      <p>Side-by-side comparison will render after hydration.</p>
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
    renderTermsHtml,
    renderWorkHtml,
    renderNextHtml,
    renderCreateHtml,
    renderMemoryHtml,
    renderSettingsHtml,
    renderSearchHtml,
    renderCalendarHtml,
    renderGanttHtml,
    renderInsightsHtml,
    renderActivityHtml,
    renderPackDetailHtml,
    renderCompareHtml
  };
});
