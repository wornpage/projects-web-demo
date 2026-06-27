# Projects Web Demo App

This is a small no-dependency Node app for the Projects demo. It serves the
frontend and `/api` from one process and stores runtime state in
`server/data/state.json`.

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

Use `PROJECTS_STATE_FILE` or a persistent disk when deploying this app to a
host where local files are otherwise ephemeral.

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
| `PROJECTS_STATE_FILE` | `/app/state/state.json` |

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
