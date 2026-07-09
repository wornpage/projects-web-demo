# Improbable Spikes

> Exploratory prototypes from the "complete a broad spike that seems improbable" sessions.
> Each spike was implemented and verified within the existing test + smoke + check pipeline.

---

## ✅ Completed

| # | Spike | Summary |
|---|-------|---------|
| 1 | **Zero inline styles** | Converted context menu, touch tooltip, gantt chart to CSSStyleSheet. Zero `style="..."` attributes in the entire app. |
| 2 | **SVG favicon** | Created `assets/favicon.svg` — a vector "P" on a rounded rect that scales to any size. Wired into index.html, landing.html, manifest.json, all infrastructure, and service worker cache. |
| 3 | **Collapsible sidebar** | Toggle shrinks sidebar to 52px icons-only. Persisted preference in localStorage, animated grid-column transition. |
| 4 | **Drag-and-drop reordering** | HTML5 DnD on work cards, landing cards, and table rows. Drop reorders `state.packs` array, persists via `saveState()`. |
| 5 | **Eliminate `!important` (18 removed)** | Raised specificity with parent contexts and tag qualifiers. Removed from drag-over, focus-visible, clipboard states, profile cards, primary buttons, nav icons, gantt bar, field error, nl-field. |
| 6 | **Bottom tab bar on mobile** | Replaced 44 `!important` mobile sidebar overrides with a clean fixed `.demo-tab-bar` nav using the same nav-item markup. Horizontal scroll on narrow screens. |
| 7 | **RTL logical properties** | Converted 28 `left`/`right` → `inset-inline-start`/`inset-inline-end`, 13 margin, 5 padding, 20 border directional properties. Added `[dir="rtl"]` overrides. |
| 8 | **Multi-level undo stack** | `pushUndoSnapshot()` on every mutation, 50-entry stack. Ctrl+Z undoes, Ctrl+Shift+Z redoes. Stack cleared on reset. |
| 9 | **View transitions** | Wrapped render dispatch in `document.startViewTransition()`. Named `view-transition-name` on screen title and command brief. Graceful fallback on unsupported browsers. |
| 10 | **IndexedDB storage** | `_idbPut`/`_idbGet` helpers. `saveState()` writes to both localStorage (sync) and IndexedDB (async). `loadState()` migrates from IndexedDB on first load. |
| 11 | **Skeleton loading screen** | Shimmer-animated placeholder blocks mirroring sidebar + content. Shows during `is-booting`, hidden when JS renders. |
| 12 | **CSS-only theme switching** | Radio inputs (`☀️🌙🌲🌊🏜️`) with `html:has(#theme-xxx:checked)` selectors. Replaced all `html[data-theme]` and `html.dark` cascades. `applyTheme()` now just checks a radio. |
| 13 | **CSS-only donut chart** | `conic-gradient` donut for Insights completion rate. Uses CSSStyleSheet for the gradient (CSP-safe). Sparkline bar animations. |
| 14 | **Landing page dark mode parity** | Added `--hover-bg`, `--success-bg`, `--danger-bg`, layered `--shadow` to `@media (prefers-color-scheme: dark)` in landing.css. |
| 15 | **Inline markdown** | `parseInlineMarkdown()` — `**bold**`, `*italic*`, `[text](url)`. All text `escapeHtml()`'d first. Wired into memory notes and purpose fields. |
| 16 | **Diff view on Compare** | Per-field comparison (`diff-changed` / `diff-same` classes). Amber left-border for differences, green for matches. Summary counts differing fields. |
| 17 | **BroadcastChannel multi-tab sync** | Replaced `storage` event with `BroadcastChannel`. Every `saveState()` posts to all same-origin tabs. Smart merge: single-pack changes update in-place. |
| 18 | **Scroll progress indicator** | 3px accent bar at top of viewport. Updated via CSSStyleSheet on scroll. Hidden when page doesn't scroll. |
| 19 | **Search match highlighting** | `<mark class="search-match">` on title, owner, and blocker text when a search query is active. Works in card, landing, and table views. |
| 20 | **Confetti burst on done** | 8 emoji particles (✨🎉💫⭐🌟) with falling animation at the action location. Uses `innerHTML` for CSP safety. |
| 21 | **Scroll position persistence** | Saves `window.scrollY` per `route:filter` key. Restored on `render()`. Filter changes and fresh navigations clear the saved position. |
| 22 | **Roving tabindex on work lists** | Arrow keys navigate between cards. Enter selects. Space runs primary action. `d` marks done, `b` toggles blocker, `o` opens work path. |
| 23 | **Dark mode FOUC elimination** | `@media (prefers-color-scheme: dark)` blocks with all `--cockpit-*` and `--demo-*` variables, applied before JS loads. Zero white flash on dark-mode OS. |

---

## 📋 Planned but not yet attempted

| # | Spike | Why it was skipped |
|---|-------|--------------------|
| A | **Complete dark mode without JS** | Partially done (#12 radio theme switching). Full removal would require rewriting the Settings screen theme chooser and removing `initTheme()`/`applyTheme()` entirely. The Settings screen still uses JS for per-theme chips. |
| B | **Offline-first with full IndexedDB** | Partially done (#10 write-through). True offline-first would mean reading *only* from IndexedDB (no localStorage fallback), adding sync conflict resolution, and versioning for schema migrations. The localStorage fallback was kept for backward compatibility and simplicity. |
| C | **Full keyboard accessibility** | Partially done (#22 roving tabindex + focus rings). Remaining: roving tabindex on sidebar nav items, the command palette, settings chips, and memory chips. Also needs visible `:focus` indicators on every element (some custom-styled buttons suppress the outline). |
| D | **Eliminate *all* `!important`** | Partially done (#5 removed 18, #6 removed 44). 19 remain — all in legitimate places: `prefers-reduced-motion` (2), `@media print` (7), forced-colors (1), responsive media-queries (2), dark-theme `:is()` selectors (2), a `prefers-reduced-motion: no-preference` block (4), and a color override (1). Most are unavoidable cascade constraints. |
| E | **Virtualized work list with true DOM recycling** | Partially done (the `applyVirtualScroll` function hides off-screen items via `display: none`). True virtualization would keep only ~20 DOM nodes and recycle them as the user scrolls, using a spacer to maintain scroll height. The current hide/show approach still creates all DOM nodes on render. |
| F | **Settings theme chooser — CSS-only** | The Settings screen renders theme chips that call `applyTheme()` via JS. Converting these to radio-button labels (same pattern as the header) would remove the last JS dependency from the theme system. |
| G | **Gantt chart interactivity** | The gantt bars render as CSSStyleSheet-driven divs but have no click, hover, or drag behavior. Adding click-to-navigate and hover-tooltips would make it a real planning tool. |
| H | **Animated route transitions per-screen** | View transitions (#9) use a default cross-fade. Adding specific `view-transition-name` to cards, lists, and the sidebar would create staggered, more polished transitions. |
| I | **Offline form drafts** | The create form and memory note input lose typed text on navigation. Saving drafts to `sessionStorage` and restoring them would prevent data loss. |
| J | **Scroll-synced side-by-side compare** | The Compare page shows two columns that scroll independently. Syncing their scroll positions would make diffing easier. |
| K | **Animation for filter/sort changes** | When the filter changes or search is applied, cards disappear/appear abruptly. A staggered fade or scale animation would smooth the transition. |
| L | **Voice input for notes** | `webkitSpeechRecognition` or the `SpeechRecognition` API could transcribe spoken memory notes. Falls back gracefully on unsupported browsers. |
| M | **Daily digest email template** | The Email Standup button opens a `mailto:` link. A proper HTML email template with inline styles and a summary table would be more useful. |
| N | **QR code share link** | The sync panel copies a URL. Generating a QR code inline (via canvas or CSS grid) would make sharing faster on mobile. |
| O | **Calendar heatmap** | The Calendar page is a traditional grid. Adding a GitHub-style contribution heatmap for activity would be a compelling visualization. |
| P | **Command palette fuzzy search** | The Cmd+K palette uses exact substring matching. Adding fuzzy matching (typos, partial matches) would make it more forgiving. |
| Q | **Natural-language relative dates** | The parser handles "in 3 days" and "next Monday" but not "this Friday" or "end of month". Expanding the date parser to handle more human phrases would be useful. |
| R | **Card color coding by type** | Each pack has a `type` field (music, design, developer, etc.). Adding a subtle left-border or background tint per type would add visual grouping. |
| S | **Audio cue on notifications** | The toast system is visual-only. A subtle sound on error or success toasts would help when the tab is backgrounded. |
| T | **Print-friendly work list** | The `@media print` rule hides most UI chrome. A dedicated print layout with a clean table of all work items would be useful for meetings. |
| U | **Pin / star work items** | Let users pin important items to the top of the work list. Pinned status persisted in the pack data, indicated with a 📌 icon. Pin state survives filter/sort. |
| V | **Batch multi-select actions** | Checkbox mode: tap checkboxes to select multiple cards, then apply a single action (done, block, delete) to all selected at once. Needs a floating action bar that appears when items are selected. |
| W | **Kanban / board view** | A fourth work-list view: columns by status (Active → Blocked → Done). Cards drag between columns to change status. Uses the same card rendering with a horizontal scroll layout. |
| X | **Focus mode** | Collapse everything except one work item. Dim the sidebar and other cards. Show only the selected pack's full detail. Toggle with `F` key. |
| Y | **Recurring / template work items** | Mark a pack as a template. A "Repeat" button spawns a new copy with the same title, owner, and next-action, resetting status to active. Useful for daily/weekly routines like standups or checklists. |
| Z | **Work item timeline / changelog** | Every field edit appends a timestamped entry to `pack.history`. Show the full edit history on the work path as a chronological log. Undo could roll back to any point in the timeline. |
| AA | **Snooze / defer** | A "Snooze" button that sets `due` to +1 day, +3 days, +1 week, or a custom date. The item disappears from active views until the due date arrives. |
| AB | **Progress slider** | A 0–100% slider or stepper on each pack. The donut chart on Insights could show average progress across all items. Visual indicator on cards. |
| AC | **Merge two work items** | Select two packs on the Compare page and merge them: combine memory notes, pick the most recent blocker/owner, keep the first title. The merged item absorbs both histories. |
| AD | **Keyboard shortcut cheat sheet** | Press `?` to show a modal panel listing all shortcuts: route keys, card keys, Cmd+K, Ctrl+Z, Ctrl+Shift+Z, Escape (dismiss toast), Space, d, b, o. Replaces the brief toast. |
| AE | **Density / view preference memory** | Remember the last `workListView` (card / landing / table) per route, stored in localStorage. The toggle starts where the user left it instead of always resetting to "card". |
| AF | **Command palette fuzzy search** | The Cmd+K palette uses exact substring matching. Adding fuzzy matching (typos, partial matches) would make it more forgiving. (Listed earlier as P — expanded here for completeness.) |
| AG | **Calendar heatmap** | The Calendar page is a traditional grid. Adding a GitHub-style contribution heatmap for activity density would be a compelling visualization. (Listed earlier as O — expanded here for completeness.) |
| AH | **Goal / OKR linking** | Tie work items to higher-level objectives. Add an `objective` field, group by objective on the Insights page, and show progress toward each goal. |
| AI | **Import from JSON / CSV** | The current import only handles a proprietary list format. Adding generic JSON and CSV import would let users migrate from other tools. Detect column mapping automatically. |
| AJ | **Export as formatted PDF** | Beyond CSV, generate a formatted PDF report with the work list, completion stats, and a summary table. Use `window.print()` with a dedicated print stylesheet. |
