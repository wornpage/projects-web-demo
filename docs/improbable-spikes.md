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
| AK | **Subtasks / checklist within a work item** | A collapsible checklist inside each pack — mark subtasks done without changing the pack's status. Progress bar auto-computes from checked subtasks. |
| AL | **Work item dependencies graph** | Visualize `blockedBy` relationships as a directed graph. Nodes are packs, edges are dependencies. Click a node to navigate. Canvas or SVG-based. |
| AM | **Inline editing on cards** | Edit title, owner, or next-action directly on the work card without navigating to the full work path. Double-click to edit, Enter to save, Escape to cancel. |
| AN | **Quick-add from URL params** | `?add=Buy+milk+due+tomorrow` parses at launch and opens the create form pre-filled. The natural-language parser handles the rest. Bookmarkable quick-add. |
| AO | **Drag to resize sidebar** | A draggable handle on the sidebar edge. User can widen or narrow the sidebar, persistent in localStorage. Min 160px, max 320px. |
| AP | **Custom accent color** | A color picker in Settings that overrides `--cockpit-accent`. Saved to localStorage. All 5 built-in themes still available alongside the custom option. |
| AQ | **Burndown / velocity chart** | Show completed vs remaining work over time as a line chart. Track weekly velocity. CSS-only sparkline version or a small canvas. |
| AR | **Deadline countdown** | Cards with a past due date show "2 days overdue" in red. Cards due today show "Due today" in amber. Urgency computed from `pack.due` vs `new Date()`. |
| AS | **Work item age indicator** | Each card shows how long ago it was created, last edited, or last touched. "Opened 3 days ago · touched 2 hours ago". Helps spot stale items. |
| AT | **File attachments via blob URLs** | Upload files/images to a work item. Store as base64 blobs in IndexedDB. Preview inline with `<img>` or `<a download>`. Max 1MB per attachment. |
| AU | **Shareable read-only link** | Generate a URL that loads the demo with a specific snapshot — `?share=base64encodedState`. The recipient sees a read-only view with a "Copy to my demo" button. |
| AV | **Guided interactive tour** | First-visit overlay that walks through the sidebar, work list, command brief, and keyboard shortcuts. Dismissed permanently. Uses `step-1`, `step-2` floating tooltips. |
| AW | **Achievement badges** | Gamification: "First completion", "10 tasks done", "7-day streak", "All fields filled". Displayed as small emoji badges in the sidebar footer. Persisted in localStorage. |
| AX | **Dark mode scheduling** | Auto-switch theme at sunset based on geolocation or a user-set schedule. "Dark mode from 18:00–06:00". Falls back to `prefers-color-scheme` if no schedule set. |
| AY | **Command palette natural-language** | Type "block venue hold" in Cmd+K and it finds the pack and runs the blocker toggle. Type "done lighting checklist" to mark it done. Parse intent from free text. |
| AZ | **Workflow automation rules** | Simple if-this-then-that: "When any pack is marked done, unblock all packs blocked by it." Configured in Settings with a dropdown. Stored as JSON rules. |
| BA | **Multiple workspaces / projects** | Switch between independent sets of packs via a project selector in the header. Each workspace has its own state file. "General", "Music", "Dev" etc. |
| BB | **Offline sync indicator** | A small dot in the header: green = saved, amber = unsaved changes, red = offline. Updates reactively after each `saveState()`. Uses `navigator.onLine` + a periodic ping. |
| BC | **Screen reader optimized mode** | Toggle that adds `role="status"` live regions, `aria-description` on complex components, and skips decorative animations. Stored as an accessibility preference. |
| BD | **Two-factor / passkey auth** | For the hosted Outplane version: WebAuthn passkey support. Registration and login via `navigator.credentials`. Falls back to client-key header for browsers without WebAuthn. |
| BE | **Magic link email login** | Passwordless auth: enter email, receive a link, click to authenticate. The link contains a signed token. Backend-only spike (server changes to generate/verify tokens). |
| BF | **Copy as Markdown / Notion format** | Right-click → "Copy as Markdown" outputs `- [ ] Title (owner, due date)`. "Copy as Notion" outputs a Notion-compatible block. Clipboard-friendly formatting. |
| BG | **Voice input for notes** | `SpeechRecognition` API for dictating memory notes. A microphone button in the memory input that starts listening. Falls back gracefully. Transcript appended to the note field. |
| BH | **Multi-language i18n** | Extract all user-facing strings into a `LANG` object. Switch language via Settings. Start with English + Spanish. Community-contributable translation files. |
| BI | **Card density toggle per route** | Remember card/list/table preference per route independently. Work list might be table, Review might be cards. Stored in a `viewPreferences` map in localStorage. |
| BJ | **Eisenhower matrix view** | A 2×2 grid: Urgent/Not Urgent × Important/Not Important. Drag cards into quadrants. Quadrant stored as a pack property. Filter work list by quadrant. |
| BK | **Gantt chart drag-to-reschedule** | Drag bar edges to change start/end dates. Drag the whole bar to shift both dates. Updates `pack.due` and triggers re-render. Uses the same DnD primitives as card reordering. |
| BL | **Weekly review guided mode** | A step-by-step review flow: "1. Review done items", "2. Update blocked items", "3. Set next actions", "4. Plan next week". Progress bar. Prompts and reflection text areas. |
| BM | **Timeboxing / Pomodoro timer** | A 25-minute focus timer attached to a work item. Start/stop button on the card. Logs completed pomodoros to `pack.activity`. Shows a small timer in the header. Uses `setInterval`. |
| BN | **Work item "energy level"** | Add a `pack.energy` field: low / medium / high. Filterable. Shown as 🔋/⚡ icons on cards. Helps users pick work that matches their current energy state. |
| BO | **Card emoji reactions** | Add a small reaction bar at the bottom of each card: 👍 👎 🚀 😅 🔥. Click to toggle. Reaction counts stored in `pack.reactions`. Anonymous, local-only. |
| BP | **Work item "mood" tracking** | Optional daily mood check-in attached to a work item. "How did this work feel today? 😊 😐 😤". Stored as `pack.moodLog` with timestamps. Plotted on the work path as a tiny trendline. |
| BQ | **Custom fields** | Users can define extra fields per work item: "Estimated hours", "Client name", "Priority score". Stored in `pack.customFields`. Rendered dynamically in the work path and card summaries. |
| BR | **Slack / Discord webhook integration** | Post a summary to a Slack/Discord channel when a work item is marked done or blocked. Configurable webhook URL in Settings. One-click test button. Uses `fetch`. |
| BS | **RSS feed of changes** | An RSS endpoint `/feed/demo-packs.xml` that lists recent activity as feed items. Subscribe to your own work log. Read-only, no auth needed for the demo version. |
| BT | **Workflow state machine visualizer** | A small SVG diagram on the work path showing the pack's journey: Draft → Active → Blocked → Done. Current state highlighted. Click a state to see when the pack entered it. |
| BU | **Color-blind accessible mode** | Add a toggle that replaces the default palette with a color-blind-friendly one (deuteranopia/protanopia/tritanopia). Uses distinct patterns and luminance contrast instead of hue alone. |
| BV | **Desktop notifications on deadline** | Request Notification permission. When a card's due date is today and the tab is backgrounded, fire a `new Notification("Lighting checklist is due today")`. |
| BW | **Bulk import from clipboard table** | Paste a TSV/CSV table directly into the work list. Parse headers, create one pack per row. Show a preview before committing. Reuses the natural-language parser for field detection. |
| BX | **Work item relationships** | Add `pack.relatedTo` and `pack.duplicateOf` fields. Show related items as linked chips below the card. Bidirectional — if A relates to B, B shows A. Navigate between related items. |
| BY | **Seasonal / holiday themes** | Automatically apply a festive theme on specific dates: 🎃 Halloween (Oct 31), ❄️ Winter (Dec 1–31), 🎆 New Year (Jan 1). CSS-only overrides for accent colors. Disabled by default, opt-in. |
| BZ | **Markdown export of entire work list** | One-click export of the full, filtered work list as a Markdown file. Includes `## Title`, `- Status`, `- Blocker`, `- Next action` for each item. Download as `.md` file. |
| CA | **Automatic cloud backup** | Periodically POST the state snapshot to a configurable endpoint. Backup interval configurable in Settings (off, hourly, daily). Uses `navigator.sendBeacon` for reliability on page unload. |
| CB | **Data validation rules** | Define rules like "Title must be at least 3 characters" or "Due date cannot be in the past". Client-side validation with inline error messages. Rules are configurable per profile. |
| CC | **Work item templates gallery** | Ship a set of pre-built templates: "Bug report", "Feature request", "Meeting agenda", "Code review", "Blog post". Each template pre-fills title, purpose, doneWhen, and sources. |
| CD | **Mobile home-screen widget** | A simple widget showing today's due count and the next action. Uses the Web App Manifest + a minimal static HTML view at `/widget`. Android/iOS "Add to home screen" compatible. |
| CE | **Public API key management** | For the hosted version: users can create/revoke API keys in Settings. Keys shown once at creation time. Scoped to read, write, or admin. Stored as hashed values server-side. |
| CF | **Context menu customization** | Settings panel to choose which actions appear in the right-click menu. Drag to reorder. Defaults to "Open / Copy title / Finish with proof / Cancel". User can add "Block" or "Snooze". |
| CG | **Undo for individual field edits** | Finer-grained undo than full-pack snapshots. Track the last 10 field-level changes per pack. Undo only reverts the most recent field change, not the entire pack state. |
| CH | **Collapsible settings panels** | Each settings section (Profiles, Scenarios, Themes, Recovery, Reset, Copy layer) is a collapsible `<details>`. Only one open at a time via `name` attribute accordion. |
| CI | **Comparison history** | The Compare page remembers the last 5 pack-pairs you compared. Shows them as a quick-select history strip. Click a pair to re-compare those two packs instantly. |
| CJ | **Analytics mini-dashboard** | A small stats panel at the bottom of Insights: most active day of week, average tasks per day, longest streak, busiest owner. Pure JS computation from pack data, no external analytics. |
| CK | **High contrast mode** | Independent of the OS setting: a toggle in the accessibility panel that enables `forced-colors: active` CSS rules across the app. Higher contrast borders, thicker text, system color palette. |
| CL | **Parent/child work-item hierarchy** | Nested tasks: a pack can have `pack.parentId` pointing to another pack. Children inherit the parent's blocker/owner. Show as an indented tree in the work list. Collapsible branches. |
| CM | **Archive and trash** | Move done items to an archive (hidden from the work list, visible via a toggle). Soft-delete sends items to trash with 30-day recovery. Both are just filtered views on the same packs array. |
| CN | **Duplicate detection on create** | When typing a new title, fuzzy-compare against existing titles. If similarity > 80%, show a warning: "This looks similar to 'Venue hold calendar'. Create anyway?" |
| CO | **Recently viewed quick-access** | Track the last 5 viewed pack IDs. Show as a small chip row at the top of the work list. "Jump back to…" with pack titles and timestamps. Stored in `state.recentIds`. |
| CP | **Calendar sync (Google / Outlook)** | Generate an `.ics` file per pack with due date and title. Offer a "Subscribe to calendar" link that serves a live `.ics` feed endpoint from the server. Read-only, one-way sync. |
| CQ | **Daily standup optimized view** | A special view at `#/standup` that shows: "What I did", "What I'm doing", "Blockers". Auto-generated from pack status, activity, and blocker fields. Designed to be read aloud in 30 seconds. |
| CR | **Check-in reminders** | If `Notification` permission is granted, send a daily reminder at a configurable time: "Time to update your work status. 3 items need attention." Clicking the notification opens the app. |
| CS | **Drag image from desktop to attach** | Drop an image file onto a work card. Reads via `FileReader`, stores as a base64 data URL in `pack.attachments`. Thumbnail preview on the card. Max size enforced client-side. |
| CT | **Link previews in memory notes** | If a memory note contains a URL, fetch its Open Graph metadata (title, description, image) and render an inline preview card. Cached in IndexedDB. Falls back gracefully on CORS errors. |
| CU | **Auto-tag from title via keyword extraction** | Simple NLP: scan the title for known keywords ("bug", "feature", "meeting", "review") and auto-suggest tags. User confirms or dismisses. Keywords defined per profile in Settings. |
| CV | **Voting / prioritization** | Team members (simulated via client keys) can upvote work items. Sort the work list by vote count. Votes stored as `pack.votes`. "5 votes — top priority" badge on cards. |
| CW | **Sprint planning mode** | Group packs into named sprints via `pack.sprint`. Calendar shows sprint boundaries. Burndown chart per sprint. Sprint retrospective prompt at sprint end. |
| CX | **Smart suggestions** | Heuristic engine: "This item has no blocker — suggest blocking it." "This item has been active for 14 days — suggest setting a deadline." Shown as a small banner on the card. Configurable rules per profile. |
| CY | **Time estimation vs actual logging** | Add `pack.estimatedHours` and `pack.actualHours`. Show variance on the card. Insights page shows accuracy over time. "You tend to underestimate by 30%" — learning insight. |
| CZ | **Git integration** | A work item can link to a Git commit or branch. `pack.gitRef` stores a commit hash. Clicking opens the commit in the repo. Auto-fill from commit message if using a webhook. |
| DA | **Work item confidence level** | Add `pack.confidence`: high / medium / low. Visualized as a tiny meter on the card. Filters from the work list. "How confident are you this will be done on time?" |
| DB | **Work item location** | Add `pack.location`: office, home, field, remote. Useful for teams that split between on-site and remote work. Filterable. Shown as a small pin emoji on cards. |
| DC | **Cost / budget tracking** | Add `pack.cost` (estimated) and `pack.actualCost` (actual). Sum per sprint or per project. Simple number fields. No currency conversion — just raw values. |
| DD | **Sentiment analysis on memory notes** | Scan memory note text for positive/negative word lists. Show a small 😊/😐/😟 indicator next to each note. Pure client-side, no server. Word lists configurable. |
| DE | **@mentions in memory notes** | `@owner` or `@blocked` highlights as a chip. Click navigates to the work path of the mentioned item. Autocomplete dropdown as you type `@`. |
| DF | **Quick-add from email** | A dedicated email address (for the hosted version) that parses incoming emails into work items. Subject → title, body → purpose. Reply-to address used as owner. Mailgun/Postmark integration. |
| DG | **Work item milestone grouping** | Add `pack.milestone`. Group work items by milestone on the Insights page. Show milestone progress (completed/total). Milestones have optional due dates. |
| DH | **Recurring work items** | A `pack.recurring` field: "daily", "weekly", "monthly". When marked done, a new copy spawns with the next due date. Shows the recurrence pattern on the card. |
| DI | **Backup to JSON file download** | One-click "Download backup" in Settings. Downloads a timestamped `.json` file with the full state snapshot. "Restore backup" button opens a file picker to load a backup. |
| DJ | **Drag calendar event to reschedule** | In the Calendar view, drag a day cell with items to a different day. Updates all due dates for items on that day. Visual drag indicator. |
| DK | **Keyboard-first mode** | A toggle that makes every interactive element reachable via keyboard. Shows shortcut hints on hover. Disables mouse-specific interactions. Single-key navigation where possible. |
| DL | **Work item "rot" detection** | Items untouched for 30+ days get a subtle "stale" indicator — reduced opacity and a 🕸️ icon. Configurable threshold in Settings. "Tidy up" button archives all stale items. |
| DM | **Autosave form drafts** | The create form and memory input save typed text to `sessionStorage` on every keystroke. If the user navigates away and back, the draft is restored. Cleared on successful save. |
| DN | **Progressive web app install prompt** | Detect `beforeinstallprompt` and show a custom "Install app" banner. Tracks dismissal. The banner only shows after the user has interacted with the app for 30+ seconds. |
