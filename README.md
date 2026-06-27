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
| Behavior | Static JS in `assets/demo.js`; API calls only in Node app mode or when an API base URL is configured | Production backend workflows or GitHub API calls |

## Files

| Path | Purpose |
|---|---|
| `index.html` | Public app shell served by GitHub Pages. |
| `assets/demo.js` | Hash routing, demo state, button behavior, and backend app-mode calls. |
| `assets/demo.css` | Public demo layout and interaction styling. |
| `assets/favicon.png` | Demo favicon. |
| `data/demo-packs.json` | Fake browser-local work data for static publishing; app mode reads it server-side and does not serve the JSON URL directly. |
| `server/` | Optional Node app and static preview helpers for backend persistence experiments. |
| `scripts/protect-frontend.mjs` | Production frontend protection step used by Docker builds. |
| `scripts/check-protected-frontend.mjs` | Local proof that the protected frontend hides configured readable tokens. |
| `scripts/check-public-assets.mjs` | Local proof that public assets stay allowlisted and public text assets stay budgeted without source maps or private path strings. |
| `scripts/check-static-preview.mjs` | Local proof that the static preview serves only the static allowlist and sends defensive headers. |
| `scripts/check-public-routes.mjs` | Local proof that the visible route set stays small and retired route code stays absent. |
| `scripts/check-sync-surface.mjs` | Local proof that sync links, QR sharing, and sync client keys stay wired. |
| `scripts/check-state-recovery.mjs` | Local proof that one client's exported state can be restored without mixing rows. |
| `scripts/check-public-boundary.mjs` | Local proof that the app server only serves public files and keyed demo states do not mix. |
| `scripts/check-docker-boundary.mjs` | Local proof that the Docker image copies only the deploy allowlist and runs protected output. |
| `scripts/check-live-deploy.mjs` | Checks that the hosted Outplane app is serving the protected current frontend. |
| `scripts/check-ship.mjs` | Runs the local gates plus live Outplane verification before a ship. |
| `Dockerfile` | Cross-platform container packaging for the Node app. |
| `docs/deploy-outplane.md` | Outplane development deploy checklist. |
| `docs/public-exposure-audit.md` | Public file exposure audit and frontend privacy boundary. |

## Routes

The app uses hash routing so it can run as plain static files on GitHub Pages.
The important public paths are:

| Hash path | Purpose |
|---|---|
| `#/home` | Start screen with the portfolio value proposition. |
| `#/review` | Work that needs review or setup. |
| `#/work` | Work list and selected-work browsing. |
| `#/pack/{packId}` | Edit one work item path. |
| `#/next/{packId}` | Choose what Button runs next for one work item. |
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

No build step is required for normal portfolio-demo edits.

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
`index.html` is served with a small runtime setting that points
`assets/demo.js` at the same-origin API, so no `?api=` query parameter is
needed.

In app mode, seed demo work loads through `GET /api/demo-packs` with the same
anonymous browser client key as the rest of the API. The static
`data/demo-packs.json` file remains in the repo for GitHub Pages and static
preview, but the Node app does not serve that URL directly.

The Node app also rewrites the CSS/JS asset query string at startup using
`PROJECTS_ASSET_VERSION`, a known commit environment variable, or a generated
startup value. That keeps hosted deploys from serving stale cached frontend
assets after a push.

API CORS is bounded to same-origin app requests using the request `Host`, not
forwarding headers. Hosted deploys can also pin explicit allowed origins with
`PROJECTS_PUBLIC_ORIGIN` or comma-separated `PROJECTS_ALLOWED_ORIGINS`. Use the
single Node app for backend-backed local testing; preflights with retired
methods or unlisted request headers are rejected. The static preview remains
browser-local.

The Node app also sends no-store, no-referrer, nosniff, HSTS, frame-deny,
same-origin resource/opener/embedder isolation, restrictive
Permissions-Policy headers, and a CSP that blocks unsafe inline scripts and
styles on served app and API responses. The CSP also denies frames, workers,
manifests, and media loaders the demo does not use.
The hosted app serves the backend API-base setting through
`assets/runtime-config.js` instead of an inline script.

The local state path defaults to a user data directory outside the repository,
but backend API state routes still require the browser's anonymous client key.
Local file-backed app mode stores each keyed client's state in a separate
hashed state file beside that path and rejects unkeyed state requests. Hosted
deploys should still use `PROJECTS_STATE_STORAGE=postgres` with managed
Postgres environment variables instead of writable container files.
Hosted Postgres stores a server-side digest of the browser client key rather
than the raw request header value.
State-changing API routes validate that client key before reading JSON payloads.
Each keyed backend row is capped at 50 work items. Oversized full-state writes
and create requests past that cap are rejected instead of being silently stored.

In hosted app mode, the top sync-code strip can connect two browsers or devices
to the same demo row. Use **New** to create a Web Crypto generated 20-character
code, then enter that code on the other device, copy the sync link, or scan the
QR code. Anyone with the code or sync link can open that demo state, and the
database still stores readable JSON; this is convenience sync, not private
encrypted storage.

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

The container serves the frontend and `/api` from one Node process. The image
copies only the named frontend files, the server seed JSON, and the app server,
not the whole repository, broad asset directories, or the retired shared app
stylesheet. It can use local file-backed state for development, but hosted
deploys should use managed Postgres so app containers stay stateless.

Production Docker builds run `scripts/protect-frontend.mjs` against
`assets/demo.js`. The script minifies with top-level Terser compression and
mangling, encodes selected internal API strings into a runtime string table,
syntax-checks the generated script, and fails the build if readable helper names
or protected strings remain. This makes the deployed browser script harder to
read, but it is still public executable JavaScript.

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
no-referrer, nosniff, HSTS, frame-deny,
same-origin opener/resource/embedder isolation, Permissions-Policy, and CSP
headers.

## GitHub Pages

The published site is this static repository. Keep the Pages branch/folder
pointing at these checked-in files. Do not publish local state files from
`server/data/` or a user data directory.

Before shipping, run the full local plus live gate:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run ship:check'
```

That command runs frontend syntax, backend syntax, protected frontend, public
asset-disclosure, public route-contract, sync sharing, state recovery,
public-boundary, Docker deploy-boundary, whitespace, and live Outplane checks.
For UI-only work, also smoke the main routes locally in light and dark mode:

- `#/home`
- `#/review`
- `#/work`
- `#/pack/source-folder-audit`
- `#/next/source-folder-audit`
- `#/memory/source-folder-audit`
- `#/create`

## Product Rule

The public demo should explain one idea clearly:

```text
Pick work -> see the blocker -> run the obvious next button.
```

If a feature does not support that public portfolio story, it should stay out
of this repo.
