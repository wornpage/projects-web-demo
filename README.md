# Projects Web Demo

[![Ship check](https://github.com/jared-bidlow/projects-web-demo/actions/workflows/ship-check.yml/badge.svg)](https://github.com/jared-bidlow/projects-web-demo/actions/workflows/ship-check.yml)

**Deployment:** static-first Cloudflare Pages — see
[docs/deploy-cloudflare.md](docs/deploy-cloudflare.md). A live URL will be
listed here once the Pages deploy is up; the previous Outplane dev deployment
is suspended. App mode can also run on Cloudflare Workers (free plan) with
Durable Object state — same doc, "App mode on Cloudflare Workers" section.

This repository is the active lightweight web-tech home for the public
Projects demo. It is a static GitHub Pages app by default: HTML, CSS,
JavaScript, JSON demo data, and image assets.

The published GitHub Pages demo is browser-local. This repo also includes a
single-process Node app in `server/` for backend-backed demo persistence. Hosted
app mode keeps the container stateless and stores anonymous per-browser demo
state in managed Postgres. The Node app does not add accounts, payments,
customer-data collection, or a live Projects service.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Public app shell served by GitHub Pages. |
| `src/demo/demo.js` | Source for hash routing, demo state, button behavior, and backend app-mode calls. |
| `assets/demo.js` | Generated public browser file served by GitHub Pages and app mode. |
| `assets/demo.css` | Public demo layout and interaction styling. |
| `assets/favicon.png` | Demo favicon. |
| `assets/favicon.svg` | Vector SVG favicon used by PWA manifest. |
| `sw.js` | Service worker for offline PWA support. Network-first with cached offline fallback; never intercepts `/api/` requests. |
| `manifest.json` | PWA web app manifest for installable demo. |
| `landing.html` | Public landing page for the portfolio demo. |
| `docs/improbable-spikes.md` | Tracker of 55+ exploratory features implemented. |
| `data/demo-packs.json` | Fake sample work data. Public by design: committed to the repo, published by GitHub Pages, and served read-only by app mode alongside the keyed `GET /api/demo-packs` route. |
| `server/` | Optional Node app (`server.js` plus `server/src/` modules for constants, security, seed, state storage, validation, and workflow) and static preview helpers for backend persistence experiments. |
| `scripts/check-*.mjs` (15+) | Ship-gate proof scripts for asset budgets, protected frontend, route contract, sync surface, state recovery, public/Docker/deploy boundaries, compliance, git state, and live Outplane verification. Run via `npm --prefix server run ship:check`. |
| `scripts/check-deploy-config.mjs` | Local proof that the Outplane docs, Docker defaults, ignored state paths, and live verifier target stay aligned. |
| `scripts/check-compliance-audit.mjs` | Local proof that the Compliance audit stays mapped to checked evidence and remains in the ship gate. |
| `scripts/protect-frontend.mjs` | Production frontend protection (Terser minify + string table encode) used by Docker builds. |
| `scripts/build-demo-asset.mjs` | Copies `src/demo/demo.js` to the shipped `assets/demo.js`. |
| `scripts/check-behavior-smoke.mjs` | Behavioral proof — loads static preview in Chromium, asserts no console errors, no dead buttons, no hidden leaks. |
| `Dockerfile` | Cross-platform container packaging for the Node app. |
| `docs/deploy-outplane.md` | Outplane development deploy checklist. |
| `docs/public-exposure-audit.md` | Public file exposure audit and frontend privacy boundary. |
| `docs/compliance-audit.md` | Requirement-by-requirement map from the compliance goal to current proof and remaining slices. |

## Routes

The app uses hash routing so it can run as plain static files on GitHub Pages.
The important public paths are:

| Hash path | Purpose |
|---|---|
| `#/home` | Dashboard — a "Do this next" spotlight for the top item, then stats, recent activity, bookmarklet, quick actions. First-time visitors see a welcome screen with method starting points instead; picking one (or skipping) sets a browser-local flag and returning visits go straight to the dashboard. |
| `#/review` | Work that needs review or setup. |
| `#/work` | Work list and selected-work browsing. |
| `#/pack/{packId}` | Edit one work item path. |
| `#/next/{packId}` | Choose the next action for one work item. |
| `#/memory/{packId}` | Add memory notes, search all notes across all work. |
| `#/create` | Add work items. Pre-fills from ?title= and ?url= query params (bookmarklet). |
| `#/compare/{packId}/{packId}` | Compare two work items side by side. |
| `#/calendar` | Month + year view of due dates with activity density heatmap. |
| `#/gantt` | Timeline / Gantt chart — items with due dates on a horizontal timeline. |
| `#/insights` | Aggregate stats — completion rate, owner activity, type breakdown, milestone progress, and analytics dashboard (streak, busiest owner, most active day). |
| `#/activity` | Chronological timeline of all actions across all work items. |
| `#/settings` | Demo preferences: copy profile, scenario, theme, reset, import, and recovery. |
| `#/terms` | Terms of use and privacy — personal portfolio demo, no data collection. |

Unknown and retired hashes fall back to `#/home`.

`Cmd/Ctrl+K` (or the "Search ⌘K" header button on wide screens) opens a
command palette: a native-dialog list that filters over every work item,
screen, and scenario; Enter jumps to the item's work path, the screen, or
loads the scenario. When finishing work with proof unblocks dependents, the
freshly unblocked cards play a one-shot highlight on the Work and Review
lists so the cascade is visible; `prefers-reduced-motion` gets a static ring
instead.

## Local Preview

Run the no-dependency static preview server from the repository root:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/static.js"'
```

Then open:

```text
http://localhost:5181/#/home
```

HTML, CSS, and data edits can preview directly. After editing `src/demo/demo.js`,
run `npm --prefix server run demo:build` before previewing or shipping.

`.gitattributes` pins LF endings on the budgeted public text assets so the
byte-size gates measure the same deployed bytes on every platform; Windows
checkouts should not see CRLF inflation on those files.

## App Mode

Run the single-process app from the repository root:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/server.js"'
```

Then open:

```text
http://localhost:5179/#/home
```

The same Node process serves the frontend and `/api`. In app mode,
`index.html` loads `assets/runtime-config.js`, a small generated script that
sets `window.__projectsDemoConfig` with the same-origin API base, backend mode
flag, and asset version, so no `?api=` query parameter is needed.

### Seed Data

In app mode, seed demo work loads through `GET /api/demo-packs` with the same
anonymous browser client key as the rest of the API. Seed data requests
without the browser client key are rejected instead of falling back to a public
API row. The static `data/demo-packs.json` file is also served read-only by the
app server; it is committed public sample data, so this discloses nothing that
GitHub Pages does not already publish.

### Security Headers

The Node app also rewrites the CSS/JS asset query string at startup using
`PROJECTS_ASSET_VERSION`, a known commit environment variable, or a
content-derived asset fallback based on the shipped public runtime files. That
keeps hosted deploys from serving stale cached frontend assets after a push
without changing asset URLs on every restart of the same build.

API CORS is bounded to same-origin app requests using the request `Host`, not
forwarding headers. Hosted deploys can also pin explicit allowed origins with
`PROJECTS_PUBLIC_ORIGIN` or comma-separated `PROJECTS_ALLOWED_ORIGINS`. Use the
single Node app for backend-backed local testing; preflights with retired
methods or unlisted request headers are rejected. The static preview remains
browser-local.

The Node app also sends no-store, no-referrer, nosniff, HSTS, frame-deny,
same-origin resource/opener/embedder isolation, restrictive
Permissions-Policy headers, `Clear-Site-Data: "cookies"`, and a CSP that blocks
unsafe inline scripts and styles on served app and API responses. The CSP also
denies frames, workers, manifests, and media loaders the demo does not use.
App and API responses also send `X-Robots-Tag: noindex, nofollow, noarchive`
so public dev deployments are not invited into search indexes or archives.
The hosted app serves the backend API-base setting through
`assets/runtime-config.js` instead of an inline script.

### State Storage

The local state path defaults to a user data directory outside the repository,
but backend API state routes still require the browser's anonymous client key.
The app does not use cookie-backed sessions; app, API, and static-preview
responses clear cookies so hidden cookie state cannot become a second identity
path.
Local file-backed app mode stores each keyed client's state in a separate
hashed state file beside that path and rejects unkeyed state requests. Hosted
deploys should still use `PROJECTS_STATE_STORAGE=postgres` with managed
Postgres environment variables instead of writable container files.
Invalid `PROJECTS_STATE_STORAGE` values fail startup instead of silently falling
back to file-backed state.

### API Security

Hosted Postgres stores a server-side digest of the browser client key rather
than the raw request header value, and hosted reads use only that digest key.
State-changing API routes validate that client key before reading JSON payloads.
The API accepts only generated `demo-...` browser keys or hashed `sync-...`
share keys; weak manual header values and readable sync-code-shaped headers are
rejected.

### Rate Limits

The backend also keeps in-memory per-source and per-state write rate limits.
By default, each process allows 1200 API requests per socket source, 600 write
requests per socket source, and 120 write requests per state key in a 60-second
window. State-write throttling runs after client-key validation but before JSON
body parsing. On one app process, repeated invalid writes eventually return
`429` without being stored; the ship gate proves that locally and verifies the
source ordering. The hosted live gate does not require observing `429` because
Outplane can route requests across processes. This is an abuse guard for a
public demo, not authentication or DDoS protection.
Each keyed backend row is capped at 50 work items. Oversized browser-row,
recovery, sync, and create writes past that cap are rejected instead of being
silently stored.
JSON body writes are capped at 1 MiB and return `413` before storage if the
request is too large. Declared oversized bodies are rejected before the request
stream is read.

### Workflow Endpoints

Hosted app mode uses named endpoints instead of a single generic state write path.
Each endpoint owns one concern; the browser calls the right one for the action.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/state/browser` | `PUT` | Save typed browser-row snapshot (durable fields only, no transient receipt/search). The older generic `PUT /api/state` is retired. |
| `/api/state/restore` | `POST` | Restore a full recovery snapshot. |
| `/api/state/sync-copy` | `POST` | Copy state under a new sync code. |
| `/api/state/filter` | `POST` | Persist the active work-list filter. |
| `/api/state/selected` | `POST` | Persist the selected work item. |
| `/api/state/scenario` | `POST` | Apply a scenario transform. |
| `/api/state/profile` | `POST` | Apply a copy-profile change. |
| `/api/state/reset` | `POST` | Rebuild the default row from seed data. |
| `/api/packs/{id}/command` | `GET` | Server-owned command preview for the primary button. |

#### Write validation

All state writes validate before storage:

- Recovery and sync payloads must be JSON objects with a `packs` array — scalar, empty, or missing-work payloads are rejected.
- Browser-row writes use the typed `projects-browser-state-v1` envelope. The backend strips transient receipt, search, and browser-derived status text, preserving only durable fields.
- Each work item must have a unique id, title, and valid workflow status. Text fields are bounded. Source, memory, and activity must be bounded arrays.
- Supported profile, scenario, and filter values are enforced. Top-level status text is capped.
- Unsupported saved status values are rejected — hosted writes cannot silently normalize off-contract statuses.
- Request fields are validated: malformed action keys, overlong memory notes, invalid next values, and bad create source lists are all rejected before storage.
- Each keyed backend row is capped at 50 work items. JSON body writes are capped at 1 MiB.

#### Command preview

In hosted app mode, the primary command button waits for `/api/packs/{id}/command` before enabling. This prevents the browser from briefly showing the local workflow fallback. The server preview also owns the flow hint and "why" copy; the browser-side copy is only a static fallback. Card-level run-next buttons stay generic in hosted mode but still enter the same server-preview path.

#### Server-owned writes

Workflow actions (start, unblock, block, done) cancel pending generic state saves and call the specific backend endpoint directly instead of writing the full browser state. When a workflow endpoint returns backend-owned state, the next render is marked save-suppressed so the browser doesn't immediately re-upload it.

State-changing routes (filter, selected-work, scenario, profile) each post to their named endpoint. Route-only navigation — changing screens without changing selected work — stays local-only and does not schedule backend persistence. Search text and clipboard receipts are transient browser UI and never trigger saves.

#### Legacy migration

Saved state using the retired "Button runs next" vocabulary migrates to "Next action" on read, in both browser-local and backend rows, so older demo rows keep working after the rename.

#### Error handling

If any hosted workflow endpoint fails, the browser shows a retry/refresh blocker and does not fall through to the static write path.

### Sync / Sharing

In hosted app mode, the top sync-code strip can connect two browsers or devices
to the same demo row. Use **New** to create a Web Crypto generated 20-character
code, then copy that code, enter it on the other device, copy the sync link, or
scan the QR code. Anyone with the code or sync link can open that demo state,
and the database still stores readable JSON; this is convenience sync, not
private encrypted storage. Browsers must support Web Crypto hashing for sync
codes; the app will not send readable sync codes as backend row keys. Sync
copy uses the named backend sync endpoint, and sync links use `?sync=` only as a
launch parameter and remove it from the address bar after the shared state
loads.

### Recovery

The Settings screen also has a collapsed Recovery section. **Copy backup** copies a
bounded JSON snapshot for the current browser or active sync row, and
**Restore backup** validates pasted Projects demo recovery JSON before loading
and saving it through the local static path or the hosted restore endpoint. This
is still demo recovery, not account backup or encrypted private storage.
In hosted app mode, the same Recovery section can erase the current backend row.
That removes only the row selected by this browser or active sync code and then
shows the sample state without immediately recreating the deleted row.

## Docker

Build the app image:

```powershell
pwsh -NoLogo -NoProfile -Command 'docker build -t projects-web-demo .'
```

Run it with local file-backed state:

```powershell
pwsh -NoLogo -NoProfile -Command 'docker run --rm -p 5179:5179 -v projects-web-demo-state:/app/state projects-web-demo'
```

Then open:

```text
http://localhost:5179/#/home
```

The container serves the frontend and `/api` from one Node process. The final
runtime image copies only pruned production dependencies, the named frontend
files, the server seed JSON, and the app server, not the whole repository, broad
asset directories, package manifests, build scripts, docs, or the retired shared
app stylesheet. It can use local file-backed state for development, but hosted
deploys should use managed Postgres so app containers stay stateless.

Production Docker builds run `scripts/protect-frontend.mjs` against
`assets/demo.js` in the build stage only. The script minifies with top-level
Terser compression and mangling, encodes selected internal API strings into a
runtime string table, syntax-checks the generated script, and fails the build if
readable helper names or protected strings remain. This makes the deployed
browser script harder to read, but it is still public executable JavaScript.

The pinned `nstarke/egodeath` commit
`ef8ed58fd26eb5cba59cb3a2787660efc7ac5b31` was tested and left disabled for
production because browser smoke tests showed repeated runtime errors on this
app.

## Outplane Dev Deploy

Use Outplane when you want a development deployment of the backend-backed app.
The repo's Dockerfile already reads `PORT`, binds to `0.0.0.0`, and supports
managed Postgres through Outplane's `PG*` environment variables.

The previous development deployment is **suspended** (its URL returns 404)
now that the deployed product is the static Cloudflare Pages artifact:

```text
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app
```

See [docs/deploy-outplane.md](docs/deploy-outplane.md).

## Static Preview

Build the single public browser file after editing demo source:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run demo:build'
```

Run the static frontend preview from the repository root:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/static.js"'
```

Then open:

```text
http://localhost:5181/#/home
```

The static preview uses browser-local state, matching the GitHub Pages behavior.
Use app mode at `http://localhost:5179/#/home` when you need backend-backed
persistence.
The preview server still uses the public file allowlist, a fixed internal URL
base that does not depend on the incoming Host header, and defensive no-store,
cookie-clearing, no-referrer, nosniff, HSTS, frame-deny,
same-origin opener/resource/embedder isolation, Permissions-Policy, and CSP
headers.

## Static hosting (Cloudflare Pages, GitHub Pages)

The deployed product is the static artifact, not the repository. **Cloudflare
Pages is the primary target** — see [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)
for the runbook; app mode stays an optional local/dormant route. Whatever the
host, never point it at the repository root. Build a filtered static artifact
and publish only that folder:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "scripts/build-static-publish.mjs"'
```

The artifact is written to `dist/static-publish/`. It contains only the static
allowlist, uses protected `assets/demo.js`, and excludes server code, docs,
package manifests, build scripts, and local state files.

The same artifact can also be packaged as a downloadable single-file
executable — see [docs/demo-exe-bun.md](docs/demo-exe-bun.md).

Before shipping, run the full local plus live gate:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run ship:check'
```

That command runs generated demo asset sync, frontend syntax, backend syntax,
protected frontend, public asset-disclosure, static publish artifact, public
route-contract, sync sharing, state recovery, public-boundary, Docker deploy-boundary, deploy-config,
Compliance audit, whitespace, clean git state, and live Outplane checks,
including app shell and protected frontend content matching, seed-data matching,
unkeyed seed data rejection, hosted repo-file blocking, invalid work-path status
rejection, and rejection of weak manual API client keys.
The live checks run only when a hosted backend URL is passed
(`npm --prefix server run ship:check -- <live-url>`); with no URL they are
skipped, because the deployed product is the static artifact
([docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)) and the app-mode
backend stays dormant.
For UI-only work, also smoke the main routes locally in light and dark mode:

- `#/home`
- `#/review`
- `#/work`
- `#/pack/source-folder-audit`
- `#/next/source-folder-audit`
- `#/memory/source-folder-audit`
- `#/create`
- `#/settings`

## Work Dependencies

A work item's blocker can reference another work item. On the work path edit
screen, "Blocked by work item" fills the blocker reason as `waiting on {title}`
and stores the reference; the select only offers targets that are not the item
itself, not already done, and would not create a dependency loop. When the
referenced work finishes with proof, every directly dependent item unblocks
automatically — blocker cleared, status recomputed, an "Unblocked" activity
line added — and the finish receipt reports `Unblocked N work items.`
Dependencies are non-transitive (a chain clears one hop per finished item) and
behave identically in browser-local static mode and backend app mode. The
backend rejects unknown, self, finished, or loop-creating references before
storage, and dangling references left by scenario switches or imports are
cleared on read while the blocker text is kept.

## Import and Standup Export

The Settings screen has an "Import your work" box: paste a task list and it
replaces the sample work with browser-local packs. `parseWorkList` reads one
item per line, strips markdown bullets and checkboxes, and pulls `@owner`,
`(blocked: reason)`, and `due:YYYY-MM-DD` tokens; checked items import as done.
Parsed items flow through the same `normalizeRecoveryState` pipeline the restore
feature uses, so the 50-item cap, unique-id, and validation rules apply, and the
import lands as a browser-local save in static mode or through
`POST /api/state/restore` in app mode. Nothing is sent anywhere the paste did
not already contain.

The Review screen has a "Copy standup" button. `buildStandupText` turns the
current review queue into a shareable plain-text summary — a header with the
blocked / missing-action / owner-gap counts, one line per item with its blocker,
owner, and next action, and an "Up next" line — copied through the same
local-only clipboard path as the sync and recovery copy controls. It never
schedules a backend write.


## Feature Highlights

- **Batch multi-select** — checkbox mode on work cards with floating action bar
- **Subtasks / checklist** — collapsible per-pack checklists with progress bar
- **Drag-and-drop reorder** — reorder cards, landing cards, and table rows
- **Achievement badges** — 6 unlockable badges (first done, 10 tasks, 7-day streak, all fields, 20 items, blocker cleared)
- **Progress slider** — 0–100% slider per work item
- **Energy level** — 🔋⚡🚀 tags, filter by energy
- **Location field** — set office/home/field, shown as 📍 on cards
- **Milestone grouping** — group by milestone name, tracked on Insights
- **Snooze / defer** — 1d/3d/7d snooze buttons push due dates forward
- **Deadline countdown** — red/amber urgency badges on cards
- **Desktop notifications** — system notification for items due today
- **Custom accent color** — color picker overrides app accent
- **@mentions** — `@name` in memory notes creates clickable chip
- **Seasonal themes** — 🎃 Halloween, ❄️ Winter, 🎉 Holiday accents
- **Keyboard shortcuts** — `?` cheat sheet, arrow keys, `d` marks done, `b` toggles blocker
- **Focus mode** — `F` key collapses sidebar, centers selected work

## Product Rule

The public demo should explain one idea clearly:

```text
Pick work -> see the blocker -> run the obvious next button.
```

If a feature does not support that public portfolio story, it should stay out
of this repo.

## License

The code is licensed under the GNU Affero General Public License v3.0 —
see [LICENSE](LICENSE). If you run a modified version as a network service,
the AGPL requires you to offer its source to your users.

Contributions are accepted under the terms of [CLA.md](CLA.md), which lets
the maintainer offer the project under other terms as well. Commercial or
dual licensing is available on request — contact the maintainer through the
GitHub profile.
