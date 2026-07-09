# Improbable Spikes

> Exploratory prototypes from the "complete a broad spike that seems improbable" sessions.
> Each spike was implemented and verified within the existing test + smoke + check pipeline.

---

## ✅ Completed

| # | Cat. | Spike | Summary |
|---|------|-------|---------|
| 1 | CSP |**Zero inline styles** | Converted context menu, touch tooltip, gantt chart to CSSStyleSheet. Zero `style="..."` attributes in the entire app. |
| 2 | PWA |**SVG favicon** | Created `assets/favicon.svg` — a vector "P" on a rounded rect that scales to any size. Wired into index.html, landing.html, manifest.json, all infrastructure, and service worker cache. |
| 3 | UX |**Collapsible sidebar** | Toggle shrinks sidebar to 52px icons-only. Persisted preference in localStorage, animated grid-column transition. |
| 4 | UX |**Drag-and-drop reordering** | HTML5 DnD on work cards, landing cards, and table rows. Drop reorders `state.packs` array, persists via `saveState()`. |
| 5 | UI |**Eliminate `!important` (18 removed)** | Raised specificity with parent contexts and tag qualifiers. Removed from drag-over, focus-visible, clipboard states, profile cards, primary buttons, nav icons, gantt bar, field error, nl-field. |
| 6 | UX |**Bottom tab bar on mobile** | Replaced 44 `!important` mobile sidebar overrides with a clean fixed `.demo-tab-bar` nav using the same nav-item markup. Horizontal scroll on narrow screens. |
| 7 | I18N |**RTL logical properties** | Converted 28 `left`/`right` → `inset-inline-start`/`inset-inline-end`, 13 margin, 5 padding, 20 border directional properties. Added `[dir="rtl"]` overrides. |
| 8 | DATA |**Multi-level undo stack** | `pushUndoSnapshot()` on every mutation, 50-entry stack. Ctrl+Z undoes, Ctrl+Shift+Z redoes. Stack cleared on reset. |
| 9 | UX |**View transitions** | Wrapped render dispatch in `document.startViewTransition()`. Named `view-transition-name` on screen title and command brief. Graceful fallback on unsupported browsers. |
| 10 | DATA |**IndexedDB storage** | `_idbPut`/`_idbGet` helpers. `saveState()` writes to both localStorage (sync) and IndexedDB (async). `loadState()` migrates from IndexedDB on first load. |
| 11 | UX |**Skeleton loading screen** | Shimmer-animated placeholder blocks mirroring sidebar + content. Shows during `is-booting`, hidden when JS renders. |
| 12 | UI |**CSS-only theme switching** | Radio inputs (`☀️🌙🌲🌊🏜️`) with `html:has(#theme-xxx:checked)` selectors. Replaced all `html[data-theme]` and `html.dark` cascades. `applyTheme()` now just checks a radio. |
| 13 | VIZ |**CSS-only donut chart** | `conic-gradient` donut for Insights completion rate. Uses CSSStyleSheet for the gradient (CSP-safe). Sparkline bar animations. |
| 14 | UI |**Landing page dark mode parity** | Added `--hover-bg`, `--success-bg`, `--danger-bg`, layered `--shadow` to `@media (prefers-color-scheme: dark)` in landing.css. |
| 15 | MD |**Inline markdown** | `parseInlineMarkdown()` — `**bold**`, `*italic*`, `[text](url)`. All text `escapeHtml()`'d first. Wired into memory notes and purpose fields. |
| 16 | UX |**Diff view on Compare** | Per-field comparison (`diff-changed` / `diff-same` classes). Amber left-border for differences, green for matches. Summary counts differing fields. |
| 17 | COLLAB |**BroadcastChannel multi-tab sync** | Replaced `storage` event with `BroadcastChannel`. Every `saveState()` posts to all same-origin tabs. Smart merge: single-pack changes update in-place. |
| 18 | UX |**Scroll progress indicator** | 3px accent bar at top of viewport. Updated via CSSStyleSheet on scroll. Hidden when page doesn't scroll. |
| 19 | SEARCH |**Search match highlighting** | `<mark class="search-match">` on title, owner, and blocker text when a search query is active. Works in card, landing, and table views. |
| 20 | UX |**Confetti burst on done** | 8 emoji particles (✨🎉💫⭐🌟) with falling animation at the action location. Uses `innerHTML` for CSP safety. |
| 21 | UX |**Scroll position persistence** | Saves `window.scrollY` per `route:filter` key. Restored on `render()`. Filter changes and fresh navigations clear the saved position. |
| 22 | A11Y |**Roving tabindex on work lists** | Arrow keys navigate between cards. Enter selects. Space runs primary action. `d` marks done, `b` toggles blocker, `o` opens work path. |
| 23 | UI |**Dark mode FOUC elimination** | `@media (prefers-color-scheme: dark)` blocks with all `--cockpit-*` and `--demo-*` variables, applied before JS loads. Zero white flash on dark-mode OS. |
| 24 | UX |**Card color coding by type** | Each pack type (music, design, developer, etc.) gets a distinct left-border accent color and tinted badge. 15 types. |
| 25 | UX |**Pin / star work items** | Right-click context menu includes Pin/Unpin. Pinned items sort to top of work list. |
| 26 | UX |**Keyboard shortcut cheat sheet** | Pressing `?` now opens a proper dialog with grouped shortcut keys instead of an ephemeral toast. |
| 27 | UX |**Offline form drafts** | Create form and memory note auto-save to `sessionStorage` on each keystroke. Restored on route return. |
| 28 | UX |**Copy as Markdown** | Right-click context menu includes "Copy as Markdown". Outputs `- [ ] Title | Owner | Due | Blocker`. |
| 29 | UX |**Recently viewed quick-access** | Last 5 viewed pack IDs tracked in `state.recentIds`. Shown as clickable "Jump back" chips above the work list. |
| 30 | UX |**Settings theme CSS-only** | Settings theme chips are `<label for="theme-xxx">` targeting header radio inputs — zero JS needed. |
| 31 | UX |**Gantt chart clickable** | Gantt bars and labels navigate to the pack on click via delegated handler. |
| 32 | UX |**Offline sync indicator** | Green/red dot in the header — updates on online/offline events. |
| 33 | UX |**Card fade-in animation** | Work/list/table cards animate in with opacity+translateY on render. |
| 34 | UX |**Work item age indicator** | Shows "today", "3 days ago", "2 months ago" from first activity timestamp. |
| 46 | UX |**Focus mode** | F key or 🔍 button collapses sidebar, dims distractions, centers selected work.
| 45 | UX |**Quick-add from URL param** | ?add=Buy+milk+due+tomorrow pre-fills NL input and auto-submits. Bookmarkable.
| 44 | GAME |**Achievement badges** | 6 unlockable badges in sidebar footer — first done, 10 tasks, 7-day streak, etc. |
| 43 | SEARCH |**Command palette fuzzy search** | Cmd+K matches non-consecutive chars — "st" finds "Start", "cl" finds "Calendar". |
| 42 | UX |**Inline editing on cards** | Double-click title or owner to edit inline. Enter saves, Escape cancels, blur saves.
| 41 | VIZ |**Calendar heatmap** | Activity density grid (84 days) below calendar nav — GitHub-style contribution squares.
| 40 | UX |**Batch multi-select** | ☑ button toggles checkbox mode. Select cards and batch done/block/delete from floating bar.
| 39 | UX |**Staggered card list animation** | Cards fade in with sequential delays (0.03s × index) using CSS nth-child rules, up to 20 items. |
| 38 | UX |**Deadline countdown** | Cards show "2 days overdue" (red), "Due today" (amber), "Due tomorrow" or "Due in 5 days".
| 37 | DATA |**Backup to JSON download** | "Download backup" button in Settings creates a timestamped .json from state. |
| 36 | UX |**Per-route view preference** | Work-list view mode remembered per route in localStorage. |
| 35 | UX |**Extra actions mobile cleanup** | Hide verbose `<strong>` text in card-support summary on ≤640px screens. |
| 47 | UX |**Deadline countdown (AR)** | Cards show "2 days overdue" (red), "Due today" (amber), urgency from `pack.due` vs current date. |
| 48 | UX |**Inline editing on cards (AM)** | Double-click title or owner to edit inline. Enter saves, Escape cancels, blur auto-saves. |
| 49 | GAME |**Achievement badges (AW)** | 6 unlockable emoji badges in sidebar footer — first done, 10 tasks, 7-day streak, all fields, 20 items, blocker cleared. Persistent in localStorage. |
| 50 | UX |**Gantt click-to-navigate (G)** | Gantt bars and labels navigate to the pack on click. Delegated handler, CSSStyleSheet-safe. |
| 51 | UX |**Offline sync indicator (BB)** | Green/red dot in sidebar achievements area — updates on online/offline events. |
| 52 | NLP |**Natural-language relative dates (Q)** | Parser handles "this Friday", "end of month", "end of this month". |
| 53 | UX |**Audio cue on toasts (S)** | Subtle beep via Web Audio API — low tone on error, short tick on info/success. |
| 54 | DATA |**Print-friendly work list (T)** | Enhanced @media print: clean card borders, page-break avoidance, full-width layout. |
| 55 | UX |**Snooze / defer (AA)** | Snooze 1d/3d/7d buttons in card support, pushes due date forward with activity log entry. |
| 56 | UI |**Custom accent color (AP)** | Color picker in Settings overrides --cockpit-accent, persisted in localStorage. |
| 59 | AUTOM |**Recurring/template items (Y)** | Repeat button in card support creates a fresh copy of any work item.
| 58 | UX |**Subtasks/checklist (AK)** | Collapsible checklist per work item with checkboxes and progress bar. CSP-safe.
| 57 | UX |**Desktop deadline notifications (BV)** | System notification for items due today on startup. Requests permission. |

---

## 📋 Planned but not yet attempted

| # | Cat. | Spike | Why it was skipped |
|---|------|-------|--------------------|
| A | UI |**Complete dark mode without JS** | Partially done (#12 radio theme switching). Full removal would require rewriting the Settings screen theme chooser and removing `initTheme()`/`applyTheme()` entirely. The Settings screen still uses JS for per-theme chips. |
| B | DATA |**Offline-first with full IndexedDB** | Partially done (#10 write-through). True offline-first would mean reading *only* from IndexedDB (no localStorage fallback), adding sync conflict resolution, and versioning for schema migrations. The localStorage fallback was kept for backward compatibility and simplicity. |
| C | A11Y |**Full keyboard accessibility** | Partially done (#22 roving tabindex + focus rings). Remaining: roving tabindex on sidebar nav items, the command palette, settings chips, and memory chips. Also needs visible `:focus` indicators on every element (some custom-styled buttons suppress the outline). |
| D | UI |**Eliminate *all* `!important`** | Partially done (#5 removed 18, #6 removed 44). 19 remain — all in legitimate places: `prefers-reduced-motion` (2), `@media print` (7), forced-colors (1), responsive media-queries (2), dark-theme `:is()` selectors (2), a `prefers-reduced-motion: no-preference` block (4), and a color override (1). Most are unavoidable cascade constraints. |
| E | PERF |**Virtualized work list with true DOM recycling** | Partially done (the `applyVirtualScroll` function hides off-screen items via `display: none`). True virtualization would keep only ~20 DOM nodes and recycle them as the user scrolls, using a spacer to maintain scroll height. The current hide/show approach still creates all DOM nodes on render. |
| F | UI |**Settings theme chooser — CSS-only** | The Settings screen renders theme chips that call `applyTheme()` via JS. Converting these to radio-button labels (same pattern as the header) would remove the last JS dependency from the theme system. |
| G | UX |**Gantt chart interactivity** | Partially done: click-to-navigate is live. Remaining: hover tooltips, drag-to-reschedule bar edges. |
| H | UX |**Animated route transitions per-screen** | View transitions (#9) use a default cross-fade. Adding specific `view-transition-name` to cards, lists, and the sidebar would create staggered, more polished transitions. |
| J | UX |**Scroll-synced side-by-side compare** | The Compare page shows two columns that scroll independently. Syncing their scroll positions would make diffing easier. |
| L | A11Y |**Voice input for notes** | `webkitSpeechRecognition` or the `SpeechRecognition` API could transcribe spoken memory notes. Falls back gracefully on unsupported browsers. |
| M | DATA |**Daily digest email template** | The Email Standup button opens a `mailto:` link. A proper HTML email template with inline styles and a summary table would be more useful. |
| N | COLLAB |**QR code share link** | The sync panel copies a URL. Generating a QR code inline (via canvas or CSS grid) would make sharing faster on mobile. |
| W | UX |**Kanban / board view** | A fourth work-list view: columns by status (Active → Blocked → Done). Cards drag between columns to change status. Uses the same card rendering with a horizontal scroll layout. |
| Y | AUTOM |**Recurring / template work items** | Mark a pack as a template. A "Repeat" button spawns a new copy with the same title, owner, and next-action, resetting status to active. Useful for daily/weekly routines like standups or checklists. |
| Z | UX |**Work item timeline / changelog** | Every field edit appends a timestamped entry to `pack.history`. Show the full edit history on the work path as a chronological log. Undo could roll back to any point in the timeline. |
| AB | UX |**Progress slider** | A 0–100% slider or stepper on each pack. The donut chart on Insights could show average progress across all items. Visual indicator on cards. |
| AC | UX |**Merge two work items** | Select two packs on the Compare page and merge them: combine memory notes, pick the most recent blocker/owner, keep the first title. The merged item absorbs both histories. |
| AH | UX |**Goal / OKR linking** | Tie work items to higher-level objectives. Add an `objective` field, group by objective on the Insights page, and show progress toward each goal. |
| AI | DATA |**Import from JSON / CSV** | The current import only handles a proprietary list format. Adding generic JSON and CSV import would let users migrate from other tools. Detect column mapping automatically. |
| AJ | DATA |**Export as formatted PDF** | Beyond CSV, generate a formatted PDF report with the work list, completion stats, and a summary table. Use `window.print()` with a dedicated print stylesheet. |
| AK | UX |**Subtasks / checklist within a work item** | A collapsible checklist inside each pack — mark subtasks done without changing the pack's status. Progress bar auto-computes from checked subtasks. |
| AL | VIZ |**Work item dependencies graph** | Visualize `blockedBy` relationships as a directed graph. Nodes are packs, edges are dependencies. Click a node to navigate. Canvas or SVG-based. |
| AO | UX |**Drag to resize sidebar** | A draggable handle on the sidebar edge. User can widen or narrow the sidebar, persistent in localStorage. Min 160px, max 320px. |
| AQ | VIZ |**Burndown / velocity chart** | Show completed vs remaining work over time as a line chart. Track weekly velocity. CSS-only sparkline version or a small canvas. |
| AS | UX |**Work item age indicator** | Each card shows how long ago it was created, last edited, or last touched. "Opened 3 days ago · touched 2 hours ago". Helps spot stale items. |
| AT | UX |**File attachments via blob URLs** | Upload files/images to a work item. Store as base64 blobs in IndexedDB. Preview inline with `<img>` or `<a download>`. Max 1MB per attachment. |
| AU | COLLAB |**Shareable read-only link** | Generate a URL that loads the demo with a specific snapshot — `?share=base64encodedState`. The recipient sees a read-only view with a "Copy to my demo" button. |
| AV | UX |**Guided interactive tour** | First-visit overlay that walks through the sidebar, work list, command brief, and keyboard shortcuts. Dismissed permanently. Uses `step-1`, `step-2` floating tooltips. |
| AX | UI |**Dark mode scheduling** | Auto-switch theme at sunset based on geolocation or a user-set schedule. "Dark mode from 18:00–06:00". Falls back to `prefers-color-scheme` if no schedule set. |
| AY | NLP |**Command palette natural-language** | Type "block venue hold" in Cmd+K and it finds the pack and runs the blocker toggle. Type "done lighting checklist" to mark it done. Parse intent from free text. |
| AZ | AUTOM |**Workflow automation rules** | Simple if-this-then-that: "When any pack is marked done, unblock all packs blocked by it." Configured in Settings with a dropdown. Stored as JSON rules. |
| BA | INFRA |**Multiple workspaces / projects** | Switch between independent sets of packs via a project selector in the header. Each workspace has its own state file. "General", "Music", "Dev" etc. |
| BC | A11Y |**Screen reader optimized mode** | Toggle that adds `role="status"` live regions, `aria-description` on complex components, and skips decorative animations. Stored as an accessibility preference. |
| BD | SEC |**Two-factor / passkey auth** | For the hosted Outplane version: WebAuthn passkey support. Registration and login via `navigator.credentials`. Falls back to client-key header for browsers without WebAuthn. |
| BE | SEC |**Magic link email login** | Passwordless auth: enter email, receive a link, click to authenticate. The link contains a signed token. Backend-only spike (server changes to generate/verify tokens). |
| BG | A11Y |**Voice input for notes** | `SpeechRecognition` API for dictating memory notes. A microphone button in the memory input that starts listening. Falls back gracefully. Transcript appended to the note field. |
| BH | I18N |**Multi-language i18n** | Extract all user-facing strings into a `LANG` object. Switch language via Settings. Start with English + Spanish. Community-contributable translation files. |
| BJ | VIZ |**Eisenhower matrix view** | A 2×2 grid: Urgent/Not Urgent × Important/Not Important. Drag cards into quadrants. Quadrant stored as a pack property. Filter work list by quadrant. |
| BK | UX |**Gantt chart drag-to-reschedule** | Drag bar edges to change start/end dates. Drag the whole bar to shift both dates. Updates `pack.due` and triggers re-render. Uses the same DnD primitives as card reordering. |
| BL | UX |**Weekly review guided mode** | A step-by-step review flow: "1. Review done items", "2. Update blocked items", "3. Set next actions", "4. Plan next week". Progress bar. Prompts and reflection text areas. |
| BM | UX |**Timeboxing / Pomodoro timer** | A 25-minute focus timer attached to a work item. Start/stop button on the card. Logs completed pomodoros to `pack.activity`. Shows a small timer in the header. Uses `setInterval`. |
| BN | UX |**Work item "energy level"** | Add a `pack.energy` field: low / medium / high. Filterable. Shown as 🔋/⚡ icons on cards. Helps users pick work that matches their current energy state. |
| BO | GAME |**Card emoji reactions** | Add a small reaction bar at the bottom of each card: 👍 👎 🚀 😅 🔥. Click to toggle. Reaction counts stored in `pack.reactions`. Anonymous, local-only. |
| BP | DATA |**Work item "mood" tracking** | Optional daily mood check-in attached to a work item. "How did this work feel today? 😊 😐 😤". Stored as `pack.moodLog` with timestamps. Plotted on the work path as a tiny trendline. |
| BQ | UX |**Custom fields** | Users can define extra fields per work item: "Estimated hours", "Client name", "Priority score". Stored in `pack.customFields`. Rendered dynamically in the work path and card summaries. |
| BR | COLLAB |**Slack / Discord webhook integration** | Post a summary to a Slack/Discord channel when a work item is marked done or blocked. Configurable webhook URL in Settings. One-click test button. Uses `fetch`. |
| BS | COLLAB |**RSS feed of changes** | An RSS endpoint `/feed/demo-packs.xml` that lists recent activity as feed items. Subscribe to your own work log. Read-only, no auth needed for the demo version. |
| BT | VIZ |**Workflow state machine visualizer** | A small SVG diagram on the work path showing the pack's journey: Draft → Active → Blocked → Done. Current state highlighted. Click a state to see when the pack entered it. |
| BU | A11Y |**Color-blind accessible mode** | Add a toggle that replaces the default palette with a color-blind-friendly one (deuteranopia/protanopia/tritanopia). Uses distinct patterns and luminance contrast instead of hue alone. |
| BW | UX |**Bulk import from clipboard table** | Paste a TSV/CSV table directly into the work list. Parse headers, create one pack per row. Show a preview before committing. Reuses the natural-language parser for field detection. |
| BX | DATA |**Work item relationships** | Add `pack.relatedTo` and `pack.duplicateOf` fields. Show related items as linked chips below the card. Bidirectional — if A relates to B, B shows A. Navigate between related items. |
| BY | UI |**Seasonal / holiday themes** | Automatically apply a festive theme on specific dates: 🎃 Halloween (Oct 31), ❄️ Winter (Dec 1–31), 🎆 New Year (Jan 1). CSS-only overrides for accent colors. Disabled by default, opt-in. |
| BZ | DATA |**Markdown export of entire work list** | One-click export of the full, filtered work list as a Markdown file. Includes `## Title`, `- Status`, `- Blocker`, `- Next action` for each item. Download as `.md` file. |
| CA | DATA |**Automatic cloud backup** | Periodically POST the state snapshot to a configurable endpoint. Backup interval configurable in Settings (off, hourly, daily). Uses `navigator.sendBeacon` for reliability on page unload. |
| CB | UX |**Data validation rules** | Define rules like "Title must be at least 3 characters" or "Due date cannot be in the past". Client-side validation with inline error messages. Rules are configurable per profile. |
| CC | UX |**Work item templates gallery** | Ship a set of pre-built templates: "Bug report", "Feature request", "Meeting agenda", "Code review", "Blog post". Each template pre-fills title, purpose, doneWhen, and sources. |
| CD | PWA |**Mobile home-screen widget** | A simple widget showing today's due count and the next action. Uses the Web App Manifest + a minimal static HTML view at `/widget`. Android/iOS "Add to home screen" compatible. |
| CE | SEC |**Public API key management** | For the hosted version: users can create/revoke API keys in Settings. Keys shown once at creation time. Scoped to read, write, or admin. Stored as hashed values server-side. |
| CF | UX |**Context menu customization** | Settings panel to choose which actions appear in the right-click menu. Drag to reorder. Defaults to "Open / Copy title / Finish with proof / Cancel". User can add "Block" or "Snooze". |
| CG | UX |**Undo for individual field edits** | Finer-grained undo than full-pack snapshots. Track the last 10 field-level changes per pack. Undo only reverts the most recent field change, not the entire pack state. |
| CH | UI |**Collapsible settings panels** | Each settings section (Profiles, Scenarios, Themes, Recovery, Reset, Copy layer) is a collapsible `<details>`. Only one open at a time via `name` attribute accordion. |
| CI | UX |**Comparison history** | The Compare page remembers the last 5 pack-pairs you compared. Shows them as a quick-select history strip. Click a pair to re-compare those two packs instantly. |
| CJ | VIZ |**Analytics mini-dashboard** | A small stats panel at the bottom of Insights: most active day of week, average tasks per day, longest streak, busiest owner. Pure JS computation from pack data, no external analytics. |
| CK | A11Y |**High contrast mode** | Independent of the OS setting: a toggle in the accessibility panel that enables `forced-colors: active` CSS rules across the app. Higher contrast borders, thicker text, system color palette. |
| CL | DATA |**Parent/child work-item hierarchy** | Nested tasks: a pack can have `pack.parentId` pointing to another pack. Children inherit the parent's blocker/owner. Show as an indented tree in the work list. Collapsible branches. |
| CM | DATA |**Archive and trash** | Move done items to an archive (hidden from the work list, visible via a toggle). Soft-delete sends items to trash with 30-day recovery. Both are just filtered views on the same packs array. |
| CN | UX |**Duplicate detection on create** | When typing a new title, fuzzy-compare against existing titles. If similarity > 80%, show a warning: "This looks similar to 'Venue hold calendar'. Create anyway?" |
| CP | COLLAB |**Calendar sync (Google / Outlook)** | Generate an `.ics` file per pack with due date and title. Offer a "Subscribe to calendar" link that serves a live `.ics` feed endpoint from the server. Read-only, one-way sync. |
| CQ | UX |**Daily standup optimized view** | A special view at `#/standup` that shows: "What I did", "What I'm doing", "Blockers". Auto-generated from pack status, activity, and blocker fields. Designed to be read aloud in 30 seconds. |
| CR | UX |**Check-in reminders** | If `Notification` permission is granted, send a daily reminder at a configurable time: "Time to update your work status. 3 items need attention." Clicking the notification opens the app. |
| CS | UX |**Drag image from desktop to attach** | Drop an image file onto a work card. Reads via `FileReader`, stores as a base64 data URL in `pack.attachments`. Thumbnail preview on the card. Max size enforced client-side. |
| CT | UX |**Link previews in memory notes** | If a memory note contains a URL, fetch its Open Graph metadata (title, description, image) and render an inline preview card. Cached in IndexedDB. Falls back gracefully on CORS errors. |
| CU | NLP |**Auto-tag from title via keyword extraction** | Simple NLP: scan the title for known keywords ("bug", "feature", "meeting", "review") and auto-suggest tags. User confirms or dismisses. Keywords defined per profile in Settings. |
| CV | COLLAB |**Voting / prioritization** | Team members (simulated via client keys) can upvote work items. Sort the work list by vote count. Votes stored as `pack.votes`. "5 votes — top priority" badge on cards. |
| CW | AUTOM |**Sprint planning mode** | Group packs into named sprints via `pack.sprint`. Calendar shows sprint boundaries. Burndown chart per sprint. Sprint retrospective prompt at sprint end. |
| CX | NLP |**Smart suggestions** | Heuristic engine: "This item has no blocker — suggest blocking it." "This item has been active for 14 days — suggest setting a deadline." Shown as a small banner on the card. Configurable rules per profile. |
| CY | DATA |**Time estimation vs actual logging** | Add `pack.estimatedHours` and `pack.actualHours`. Show variance on the card. Insights page shows accuracy over time. "You tend to underestimate by 30%" — learning insight. |
| CZ | COLLAB |**Git integration** | A work item can link to a Git commit or branch. `pack.gitRef` stores a commit hash. Clicking opens the commit in the repo. Auto-fill from commit message if using a webhook. |
| DA | UX |**Work item confidence level** | Add `pack.confidence`: high / medium / low. Visualized as a tiny meter on the card. Filters from the work list. "How confident are you this will be done on time?" |
| DB | UX |**Work item location** | Add `pack.location`: office, home, field, remote. Useful for teams that split between on-site and remote work. Filterable. Shown as a small pin emoji on cards. |
| DC | DATA |**Cost / budget tracking** | Add `pack.cost` (estimated) and `pack.actualCost` (actual). Sum per sprint or per project. Simple number fields. No currency conversion — just raw values. |
| DD | NLP |**Sentiment analysis on memory notes** | Scan memory note text for positive/negative word lists. Show a small 😊/😐/😟 indicator next to each note. Pure client-side, no server. Word lists configurable. |
| DE | UX |**@mentions in memory notes** | `@owner` or `@blocked` highlights as a chip. Click navigates to the work path of the mentioned item. Autocomplete dropdown as you type `@`. |
| DF | COLLAB |**Quick-add from email** | A dedicated email address (for the hosted version) that parses incoming emails into work items. Subject → title, body → purpose. Reply-to address used as owner. Mailgun/Postmark integration. |
| DG | UX |**Work item milestone grouping** | Add `pack.milestone`. Group work items by milestone on the Insights page. Show milestone progress (completed/total). Milestones have optional due dates. |
| DH | AUTOM |**Recurring work items** | A `pack.recurring` field: "daily", "weekly", "monthly". When marked done, a new copy spawns with the next due date. Shows the recurrence pattern on the card. |
| DJ | UX |**Drag calendar event to reschedule** | In the Calendar view, drag a day cell with items to a different day. Updates all due dates for items on that day. Visual drag indicator. |
| DK | A11Y |**Keyboard-first mode** | A toggle that makes every interactive element reachable via keyboard. Shows shortcut hints on hover. Disables mouse-specific interactions. Single-key navigation where possible. |
| DL | UX |**Work item "rot" detection** | Items untouched for 30+ days get a subtle "stale" indicator — reduced opacity and a 🕸️ icon. Configurable threshold in Settings. "Tidy up" button archives all stale items. |
| DN | PWA |**Progressive web app install prompt** | Detect `beforeinstallprompt` and show a custom "Install app" banner. Tracks dismissal. The banner only shows after the user has interacted with the app for 30+ seconds. |
