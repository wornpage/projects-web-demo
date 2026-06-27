# Projects Web Demo App

This is a small Node app for the Projects demo. It serves the frontend and
`/api` from one process. Local runs use `server/data/state.json`; hosted runs
should use managed Postgres through `DATABASE_URL` or standard `PG*` variables.
In API mode, the browser sends an anonymous client key so demo edits are
isolated per browser without accounts.

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

Use `PROJECTS_STATE_STORAGE=postgres` and managed Postgres environment variables
when deploying this app to a host where local files are ephemeral.

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
| `PROJECTS_STATE_KEY=production` | Fallback state key when no browser client key is present. |

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
| `POST /api/packs` | Create one work item. |
| `PATCH /api/packs/{id}` | Update one work item. |
| `POST /api/packs/{id}/memory` | Add one memory note. |
