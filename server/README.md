# Projects Web Demo App

This is a small Node app for the Projects demo. It serves the frontend and
`/api` from one process. Local file-backed runs use hashed per-client state
files under the configured state directory; hosted runs should use managed
Postgres through `DATABASE_URL` or standard `PG*` variables. In API mode, the
browser sends an anonymous client key so demo edits are isolated per browser
without accounts.

State-changing and state-read API routes require that anonymous browser client
key in both local file-backed mode and hosted Postgres mode. Missing or invalid
keys are rejected instead of falling back to one shared row.
Hosted Postgres stores a server-side digest of that key in `state_key`; local
file-backed mode stores hashed filenames.
Each anonymous state row is capped at 50 work items. Oversized full-state writes
and create requests past that cap are rejected. Full-state writes also reject
oversized `actionReceipt` object shapes before storage.

The frontend can replace the anonymous browser key with a hashed sync code so
two browsers or devices can share one demo row. New sync codes and anonymous
browser row keys require Web Crypto instead of weak random fallbacks. That is a
convenience feature, not authentication or encryption of the stored JSON.

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

Seed demo work loads through `GET /api/demo-packs` with the same anonymous
browser client key as other API requests. The Node app keeps
`data/demo-packs.json` as a server-side seed file and does not serve that JSON
path directly.

The app shell is served with a Content Security Policy. The only inline script
is the server-injected API-base setting, and the server gives that script a
fresh nonce on each response.

Use `PROJECTS_STATE_STORAGE=postgres` and managed Postgres environment variables
when deploying this app to a host where local files are ephemeral. Local
file-backed app mode stores each keyed client in a separate hashed state file
beside the configured state path and rejects unkeyed state requests.

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
| `PROJECTS_STATE_FILE` | `/app/state/state.json` as the local file-backed state path |

## Outplane

Use [../docs/deploy-outplane.md](../docs/deploy-outplane.md) for the Outplane
development deploy path. It uses the same Dockerfile and Postgres-backed
storage mode as the production-shaped app.

## Static Preview

Serve the static frontend from the repository root:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "server/static.js"'
```

Open:

```text
http://localhost:5181/#/home
```

The static preview keeps the browser-local GitHub Pages behavior. Use app mode
at `http://localhost:5179/#/home` when you need backend-backed persistence.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check that the backend is running. |
| `GET /api/demo-packs` | Load server-side seed demo work with a browser client key. |
| `GET /api/state` | Load the full demo state. |
| `PUT /api/state` | Save the full demo state. |
| `GET /api/packs` | Load only work items. |
| `GET /api/packs/{id}/command` | Resolve the server-owned `Where`, `Blocker`, and `Button runs next` preview for one work item. |
| `POST /api/packs` | Create one work item using server-owned workflow defaults. |
| `POST /api/packs/{id}/path` | Save one work path and return the server-owned receipt/state. |
| `POST /api/packs/{id}/actions` | Run a server-owned pack action such as `start`, `unblock`, `block`, `done`, or `open`. |
| `POST /api/packs/{id}/next` | Set the server-owned `Button runs next` value for one work item. |
| `POST /api/packs/{id}/memory` | Add one memory note and return the server-owned receipt/state. |

API and app responses use `Cache-Control: no-store`, `Referrer-Policy:
no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
same-origin resource/opener isolation, and restrictive `Permissions-Policy`
headers. API body routes require `Content-Type: application/json`; non-JSON body
writes are rejected with `415`. API CORS reflects only same-origin app requests.
This is still demo isolation, not private account security.

## Checks

Run the full ship gate from the repository root before shipping backend
app-mode changes:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run ship:check'
```

That command runs backend syntax, frontend protection, public asset-disclosure,
public route-contract, sync sharing, state recovery, public boundary, Docker
deploy-boundary, whitespace, and live Outplane checks.
