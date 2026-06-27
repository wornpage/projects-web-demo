# Projects Web Demo API

This is a small local backend for the static Projects demo. It has no external
dependencies and stores runtime state in `server/data/state.json`.

## Run

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/server.js"'
```

Then serve the static frontend from the repository root:

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
