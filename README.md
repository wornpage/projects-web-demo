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
| `assets/demo.js` | Hash routing, demo state, button behavior, and smoke checks. |
| `assets/demo.css` | Public demo layout and interaction styling. |
| `assets/app.css` | Shared visual tokens and base component rules used by the demo. |
| `assets/demo-metadata.json` | Release metadata kept with the static export. |
| `assets/favicon.png` | Demo favicon. |
| `data/demo-packs.json` | Fake browser-local work data. |
| `server/` | Optional Node app and static preview helpers for backend persistence experiments. |
| `Dockerfile` | Cross-platform container packaging for the Node app. |
| `render.yaml` | Render Blueprint for hosting the Docker app with managed Postgres state. |
| `docs/deploy-outplane.md` | Outplane development deploy checklist. |

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

The default local state file is `server/data/state.json`. Hosted deploys should
use `PROJECTS_STATE_STORAGE=postgres` with managed Postgres environment
variables instead of writable container files.

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

The container serves the frontend and `/api` from one Node process. It can use
local file-backed state for development, but hosted deploys should use managed
Postgres so app containers stay stateless.

## Outplane Dev Deploy

Use Outplane when you want a development deployment of the backend-backed app.
The repo's Dockerfile already reads `PORT`, binds to `0.0.0.0`, and supports
managed Postgres through Outplane's `PG*` environment variables.

Current development deployment:

```text
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app
```

See [docs/deploy-outplane.md](docs/deploy-outplane.md).

## Render

This repo includes `render.yaml` for a Render Blueprint deployment.

1. Push `main` to GitHub.
2. In Render, create a new Blueprint from this repository.
3. Confirm the `projects-web-demo` service.
4. Confirm the `projects-web-demo-db` Postgres database.
5. Use `/api/health` as the health check path.

The Blueprint uses Docker, starts the same single-process app, and stores state
in managed Postgres through `DATABASE_URL`. Each browser sends an anonymous
client key so visitors do not overwrite each other; hosted API requests without
that key are rejected instead of sharing one fallback row. The database is
configured without a public IP allow list, so the app uses Render's private
connection string.

## Static Preview With API

Run the app/API in one terminal:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/server.js"'
```

Run the static frontend preview in another terminal:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/static.js"'
```

Then open:

```text
http://localhost:5181/?api=http://localhost:5179/#/home
```

When `api` is present, the frontend loads and saves demo state through
`GET /api/state` and `PUT /api/state`. Without `api`, the static preview keeps
the original browser-local GitHub Pages behavior.

## GitHub Pages

The published site is this static repository. Keep the Pages branch/folder
pointing at these checked-in files. Do not publish `server/data/state.json`.

Before pushing, run:

```powershell
pwsh -NoLogo -NoProfile -Command 'node --check "assets/demo.js"'
```

Then smoke the main routes locally in light and dark mode:

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
