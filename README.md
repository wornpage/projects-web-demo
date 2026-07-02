# Projects Web Demo

This repository is the active lightweight web-tech home for the public
Projects demo. It is a static GitHub Pages app by default: HTML, CSS,
JavaScript, JSON demo data, and image assets.

The published GitHub Pages demo is browser-local. This repo also includes a
single-process Node app in `server/` for backend-backed demo persistence. Hosted
app mode keeps the container stateless and stores anonymous per-browser demo
state in managed Postgres. The Node app does not add accounts, payments,
customer-data collection, or a live Projects service.

## Active Boundary

Keep this repo focused on the public portfolio demo.

| Area | Kept here | Not part of this repo |
|---|---|---|
| Runtime | Static GitHub Pages app; optional single-process Node app in `server/` | Razor Server, Blazor WASM, desktop app runtime |
| Data | `data/demo-packs.json` sample work | Real packs, private notes, customer data |
| State | Browser `localStorage` under `projects-static-demo-state-v6`; optional Node app storage backed by local file or anonymous per-browser managed Postgres rows | Account state |
| Styling | Static CSS in `assets/` | Source-side app shell generation |
| Behavior | Source JS in `src/demo/demo.js`, generated to the public `assets/demo.js`; API calls only in Node app mode or when an API base URL is configured | Production backend workflows or GitHub API calls |

## Files

| Path | Purpose |
|---|---|
| `index.html` | Public app shell served by GitHub Pages. |
| `src/demo/demo.js` | Source for hash routing, demo state, button behavior, and backend app-mode calls. |
| `assets/demo.js` | Generated public browser file served by GitHub Pages and app mode. |
| `assets/demo.css` | Public demo layout and interaction styling. |
| `assets/favicon.png` | Demo favicon. |
| `data/demo-packs.json` | Fake sample work data. Public by design: committed to the repo, published by GitHub Pages, and served read-only by app mode alongside the keyed `GET /api/demo-packs` route. |
| `server/` | Optional Node app (`server.js` plus `server/src/` modules for constants, security, seed, state storage, validation, and workflow) and static preview helpers for backend persistence experiments. |
| `scripts/protect-frontend.mjs` | Production frontend protection step used by Docker builds. |
| `scripts/build-demo-asset.mjs` | Copies `src/demo/demo.js` to the single shipped `assets/demo.js`, or checks that they match. |
| `scripts/check-protected-frontend.mjs` | Local proof that the protected frontend hides configured readable tokens. |
| `scripts/check-public-assets.mjs` | Local proof that public assets stay allowlisted and public text assets stay budgeted without source maps or private path strings. |
| `scripts/build-static-publish.mjs` | Builds a filtered static publish artifact under `dist/static-publish`. |
| `scripts/check-static-publish.mjs` | Local proof that the static publish artifact contains only the allowlist and protected frontend output. |
| `scripts/check-static-preview.mjs` | Local proof that the static preview serves only the static allowlist and sends defensive headers. |
| `scripts/check-public-routes.mjs` | Local proof that the visible route set stays small and retired route code stays absent. |
| `scripts/check-sync-surface.mjs` | Local proof that sync links, QR sharing, and sync client keys stay wired. |
| `scripts/check-state-recovery.mjs` | Local proof that one client's exported state can be restored without mixing rows. |
| `scripts/check-public-boundary.mjs` | Local proof that the app server only serves public files and keyed demo states do not mix. |
| `scripts/check-docker-boundary.mjs` | Local proof that the Docker image copies only the deploy allowlist and runs protected output. |
| `scripts/check-deploy-config.mjs` | Local proof that the Outplane docs, Docker defaults, ignored state paths, and live verifier target stay aligned. |
| `scripts/check-compliance-audit.mjs` | Local proof that the Compliance audit stays mapped to checked evidence and remains in the ship gate. |
| `scripts/check-git-ship-state.mjs` | Local proof that the ship gate is running from a clean branch synced with its upstream. |
| `scripts/check-live-deploy.mjs` | Checks that the hosted Outplane app shell, protected JS, CSS, API seed data, and blocked repo paths match this checkout. |
| `scripts/check-ship.mjs` | Runs the local gates plus live Outplane verification before a ship. |
| `Dockerfile` | Cross-platform container packaging for the Node app. |
| `docs/deploy-outplane.md` | Outplane development deploy checklist. |
| `docs/public-exposure-audit.md` | Public file exposure audit and frontend privacy boundary. |
| `docs/compliance-audit.md` | Requirement-by-requirement map from the compliance goal to current proof and remaining slices. |

## Routes

The app uses hash routing so it can run as plain static files on GitHub Pages.
The important public paths are:

| Hash path | Purpose |
|---|---|
| `#/home` | Start screen with the portfolio value proposition. |
| `#/review` | Work that needs review or setup. |
| `#/work` | Work list and selected-work browsing. |
| `#/pack/{packId}` | Edit one work item path. |
| `#/next/{packId}` | Choose the next action for one work item. |
| `#/memory/{packId}` | Add browser-local memory for one work item. |
| `#/create` | Add browser-local sample work. |

Unknown and retired hashes fall back to `#/home`.

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

In app mode, seed demo work loads through `GET /api/demo-packs` with the same
anonymous browser client key as the rest of the API. Seed data requests
without the browser client key are rejected instead of falling back to a public
API row. The static `data/demo-packs.json` file is also served read-only by the
app server; it is committed public sample data, so this discloses nothing that
GitHub Pages does not already publish.

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
Hosted Postgres stores a server-side digest of the browser client key rather
than the raw request header value, and hosted reads use only that digest key.
State-changing API routes validate that client key before reading JSON payloads.
The API accepts only generated `demo-...` browser keys or hashed `sync-...`
share keys; weak manual header values and readable sync-code-shaped headers are
rejected.
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
Full recovery and sync writes must be JSON object snapshots with a `packs`
array; scalar, array, empty, or missing-work payloads are rejected before they
can sanitize into an empty row. Use the backend erase endpoint to clear the
current row.
Browser-row writes must use the typed `projects-browser-state-v1` envelope and
save only the durable row state, omitting transient receipt, search, and
browser-derived status text. The backend validates the browser payload, keeps
the current server-owned status, and clears transient receipt/search fields
before storage.
State writes also require supported text profile, scenario, and filter values,
bounded top-level status text, plus each work item must keep bounded text
fields with a unique id, title, and valid workflow status, and the saved
selected work id must be text that references one of those items. Work source,
memory, and activity lists must also be bounded text arrays. That keeps browser
rows, backup restores, and sync copies from silently creating duplicate rows,
dangling selections, malformed notes, malformed receipts, or off-contract work
rows.
Saved state that still uses the retired "Button runs next" vocabulary migrates
to the current "Next action" copy on read, in both browser-local state and
backend rows, so older demo rows keep working after the rename.
Selected-work commands in hosted app mode wait for the server command preview
before enabling the primary command buttons, so the browser does not briefly run
the local workflow fallback while `/api/packs/{id}/command` is loading.
Run-next dispatch also uses that server command preview in hosted app mode and
stops at a retry/refresh blocker while the preview is unavailable.
Card-level run-next buttons stay generic in hosted app mode instead of
rendering browser-resolved command labels; pressing one still enters the same
server-preview run-next path.
That same command preview owns the selected-work flow hint and primary "why"
copy in hosted app mode; the browser-side copy remains only as the static
fallback.
Server-owned workflow calls cancel pending generic state saves and call the
specific backend endpoint directly instead of first writing the full browser
state through `PUT /api/state`.
Recovery restores in hosted app mode post to `POST /api/state/restore` instead
of going through the browser's generic full-state save path. Static mode still
uses the local browser save path because GitHub Pages has no backend.
New sync-code copies in hosted app mode post to `POST /api/state/sync-copy`
instead of sending a browser-defined state snapshot. Hosted browser-row snapshots save
through the typed `PUT /api/state/browser` envelope without transient receipt,
search, or browser-derived status text; the older generic `PUT /api/state`
write path is retired. Browser-row writes preserve the current backend-owned
status instead of accepting browser status copy.
Hosted search text is treated as transient browser UI: typing in the work-list
search box re-renders locally without scheduling a backend browser-row save.
Hosted clipboard receipt banners are also transient browser UI and do not
schedule backend browser-row persistence.
Hosted filter changes post to `POST /api/state/filter` so that supported filter
values and the saved filter status copy are owned by the backend instead of the
browser-row snapshot path.
Hosted selected-work navigation posts to `POST /api/state/selected` so the
current work context is saved as a named backend field update instead of a
browser-row snapshot.
Hosted route-only navigation stays local-only; changing screens without
changing selected work does not schedule backend browser-row persistence.
Hosted scenario changes post to `POST /api/state/scenario` so the scenario
transform and empty-state scenario are owned by the backend instead of a
browser-row snapshot.
Hosted profile launch changes post to `POST /api/state/profile` so URL-selected
copy labels are saved by the backend instead of a browser-row snapshot.
Hosted reset posts to `POST /api/state/reset` so the server rebuilds the
default row from checked-in seed data instead of accepting a browser-row
snapshot.
If a hosted workflow endpoint fails, the browser shows a retry/refresh blocker
and does not continue into the static fallback write path.
Those workflow endpoints reject malformed or overlong request fields before
storage, including invalid create source lists, action keys, memory notes, next
values, and work-path text. The work-path endpoint also rejects unsupported
saved status values before storage, so hosted workflow writes cannot silently
normalize private or off-contract statuses.
When those endpoints return backend-owned state, the next render is marked
save-suppressed so the browser does not immediately re-upload that response
through the generic state endpoint.

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

The Start screen also has a collapsed Recovery section. **Copy backup** copies a
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

Current development deployment:

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

## GitHub Pages

Do not point Pages at the repository root. Build a filtered static artifact and
publish only that folder:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "scripts/build-static-publish.mjs"'
```

The artifact is written to `dist/static-publish/`. It contains only the static
allowlist, uses protected `assets/demo.js`, and excludes server code, docs,
package manifests, build scripts, and local state files.

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
For UI-only work, also smoke the main routes locally in light and dark mode:

- `#/home`
- `#/review`
- `#/work`
- `#/pack/source-folder-audit`
- `#/next/source-folder-audit`
- `#/memory/source-folder-audit`
- `#/create`

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

## Product Rule

The public demo should explain one idea clearly:

```text
Pick work -> see the blocker -> run the obvious next button.
```

If a feature does not support that public portfolio story, it should stay out
of this repo.
