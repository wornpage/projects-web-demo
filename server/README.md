# Projects Web Demo App

This is a small Node app for the Projects demo. It serves the frontend and
`/api` from one process. Local runs use `server/data/state.json` plus hashed
per-client state files when the browser sends an anonymous client key; hosted
runs should use managed Postgres through `DATABASE_URL` or standard `PG*`
variables. In API mode, the browser sends an anonymous client key so demo edits
are isolated per browser without accounts.

When `PROJECTS_STATE_STORAGE=postgres` is active, state-changing and state-read
API routes require that anonymous browser client key. Missing or invalid keys
are rejected instead of falling back to one shared hosted row.

The frontend can replace the anonymous browser key with a hashed sync code so
two browsers or devices can share one demo row. That is a convenience feature,
not authentication or encryption of the stored JSON.

## App Mode

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/server.js"'
```

Open:

```text
http://localhost:5179/#/home
```

In app mode, the frontend is served with a same-origin API setting, so no
`?api=` query parameter is needed.

The app shell is served with a Content Security Policy. The only inline script
is the server-injected API-base setting, and the server gives that script a
fresh nonce on each response.

Use `PROJECTS_STATE_STORAGE=postgres` and managed Postgres environment variables
when deploying this app to a host where local files are ephemeral. Local
file-backed app mode still honors the browser client key by storing each keyed
client in a separate hashed state file beside the default file.

## Docker

Build from the repository root:

```powershell
pwsh -NoLogo -NoProfile -Command 'docker build -t projects-web-demo .'
```

Run with persisted state:

```powershell
pwsh -NoLogo -NoProfile -Command 'docker run --rm -p 5179:5179 -v projects-web-demo-state:/app/state projects-web-demo'
```

The image sets:

| Variable | Value |
|---|---|
| `HOST` | `0.0.0.0` |
| `PORT` | `5179` |
| `PROJECTS_STATE_FILE` | `/app/state/state.json` for local file fallback |

## Render

Use the repository root `render.yaml` as a Render Blueprint. It deploys the
Docker app, creates a managed Postgres database, injects `DATABASE_URL`, and
sets `/api/health` as the health check path.

Production storage uses:

| Variable | Purpose |
|---|---|
| `PROJECTS_STATE_STORAGE=postgres` | Select managed database state. |
| `DATABASE_URL` | Render-provided private Postgres connection string. |
| `PGHOST` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` | Alternative split Postgres config. |
| `PROJECTS_STATE_KEY=production` | Local file-mode fallback key. Hosted Postgres requests use the browser client key. |

## Outplane

Use [../docs/deploy-outplane.md](../docs/deploy-outplane.md) for the Outplane
development deploy path. It uses the same Dockerfile and Postgres-backed storage
mode as Render.

## Static Preview With API

Run the app/API in one terminal:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/server.js"'
```

Then serve the static frontend from the repository root in another terminal:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/static.js"'
```

Open the frontend with the API query parameter:

```text
http://localhost:5181/?api=http://localhost:5179/#/home
```

Without the `api` query parameter, the app keeps its original browser-local
GitHub Pages behavior.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check that the backend is running. |
| `GET /api/state` | Load the full demo state. |
| `PUT /api/state` | Save the full demo state. |
| `GET /api/packs` | Load only work items. |
| `GET /api/packs/{id}/command` | Resolve the server-owned `Where`, `Blocker`, and `Button runs next` preview for one work item. |
| `POST /api/packs` | Create one work item using server-owned workflow defaults. |
| `PATCH /api/packs/{id}` | Update one work item. |
| `POST /api/packs/{id}/path` | Save one work path and return the server-owned receipt/state. |
| `POST /api/packs/{id}/actions` | Run a server-owned pack action such as `start`, `unblock`, `block`, `done`, or `open`. |
| `POST /api/packs/{id}/next` | Set the server-owned `Button runs next` value for one work item. |
| `POST /api/packs/{id}/memory` | Add one memory note and return the server-owned receipt/state. |

API JSON responses use `Cache-Control: no-store` and `X-Content-Type-Options:
nosniff`. This is still demo isolation, not private account security.

## Checks

Run the full ship gate from the repository root before shipping backend
app-mode changes:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run ship:check'
```

That command runs backend syntax, frontend protection, public route-contract,
sync sharing, public boundary, Docker deploy-boundary, whitespace, and live
Outplane checks.
