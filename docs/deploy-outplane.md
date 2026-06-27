# Deploy on Outplane

Outplane is the preferred development host for this repo's backend-backed demo
mode. Use it as a Docker app with managed PostgreSQL so the container stays
stateless.

## Current Dev App

Verified on June 27, 2026:

```text
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app
```

The live app reported `storage: postgres` from `/api/health`, and a save/read
smoke test passed through `/api/state`.

## Shape

| Area | Setting |
|---|---|
| Build method | Dockerfile |
| Root directory | `/` |
| App port | `5179`, or the value Outplane injects as `PORT` |
| Bind host | `0.0.0.0` through the Dockerfile `HOST` setting |
| Storage | Managed PostgreSQL through Outplane's `PG*` env vars |
| Health check | `/api/health` |

## Deploy Steps

1. Create an Outplane managed PostgreSQL database.
2. Open the database connection panel.
3. Create an Outplane application from this GitHub repository.
4. Select Dockerfile as the build method.
5. Set the root directory to `/`.
6. Set the app port to `5179` if Outplane does not prefill it.
7. Add the runtime environment variables below.
8. Deploy the app.

## Environment

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PROJECTS_STATE_STORAGE` | `postgres` |
| `PGHOST` | Outplane-provided database host |
| `PGDATABASE` | Outplane-provided database name |
| `PGUSER` | Outplane-provided database role |
| `PGPASSWORD` | Outplane-provided database password |
| `PGSSLMODE` | `require` |
| `PROJECTS_PUBLIC_ORIGIN` | Optional explicit app origin, such as `https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app` |

If Outplane gives you a single connection URI instead, you can use
`DATABASE_URL` in place of the `PG*` variables.

Do not set `PROJECTS_STATE_FILE` for the hosted Postgres app. That variable is
only for local file-backed development, and it implies container or volume state.

The browser sends an anonymous client key with API requests, so hosted demo
edits are separated per browser without accounts. Hosted Postgres API requests
without that browser key are rejected instead of sharing one fallback row.
The API accepts only generated `demo-...` browser keys or `sync-...` share keys,
and rejects weak manual header values such as short passwords.
The server stores a digest of the browser client key in Postgres `state_key`,
not the raw request header value. It can read old raw-key rows long enough to
migrate them on the next write.
The hosted API also avoids wildcard CORS and only reflects the same-origin
Outplane app origin or an explicitly configured `PROJECTS_PUBLIC_ORIGIN` /
`PROJECTS_ALLOWED_ORIGINS` value. It does not use forwarding headers to authorize
CORS.

The app also supports a sync code for personal two-device use. **New** creates a
Web Crypto generated 20-character code and copies the current demo state to that
code's row; **Use** joins that row from another device; **Copy link** copies an
invite URL; the QR code opens the same invite URL on a phone; **Leave** returns
to the device's own row. Anyone with the code or sync link can open the same
demo state. The code is hashed before it is sent to the API, and the server
hashes API client keys again before Postgres storage, but the stored demo JSON
is not end-to-end encrypted.

This is demo isolation, not real user security. Add authentication before
storing private user data, real customer work, or anything that needs account
ownership.

## Checks

After deploy:

1. Open `/api/health` and confirm `ok` is `true`.
2. Open `/#/home`.
3. Change one work item.
4. Refresh the page and confirm the change remains in that browser.
5. Open a private window and confirm it starts from seed demo data.
6. Create a sync code, use it in a second browser, and confirm both browsers see
   the same demo state.
7. Confirm **Copy link** copies a `?sync=` URL and the QR code is visible beside
   the sync link.
8. Confirm the app shell points at a current CSS/JS asset query string and
   `assets/demo.js` includes the latest frontend code. The Node app rewrites
   asset query strings at startup so stale cached assets are bypassed after a
   deploy.
9. Run the full ship verifier from the repo root:

   ```powershell
   pwsh -NoLogo -NoProfile -Command 'npm --prefix server run ship:check'
   ```

   The ship verifier runs local syntax, protected frontend, public
   asset-disclosure, public route, sync sharing, state recovery, public-boundary,
   Docker deploy-boundary, whitespace, and live Outplane checks. Its live step
   fails if Outplane is still serving an old frontend bundle, if the app shell is
   missing its same-origin runtime config script or no-inline CSP, if app/API
   responses are missing the noindex/noarchive robots header, if production
   minification did not run, if the backend-backed frontend helpers are missing,
   if retired triage code is still public, if hosted state accepts a request
   without a browser client key, if hosted state accepts a weak manual client
   key, if a missing-key write reaches body parsing before ownership validation,
   if hosted state accepts a non-JSON write, if hosted state accepts an
   oversized receipt shape, if two browser client keys can read each other's
   state, if seed demo work cannot load through the keyed API, if a shared sync
   key cannot be read from a second request, if an
   exported state snapshot cannot be restored, or if public assets expose source
   maps or private path strings.
   It writes only generated-format verifier rows.

## Notes

Keep GitHub Pages as the static public portfolio path. Use Outplane only when
you want to test the backend-backed app mode.
