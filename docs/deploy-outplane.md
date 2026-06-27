# Deploy on Outplane

Outplane is the preferred development host for this repo's backend-backed demo
mode. Use it as a Docker app with managed PostgreSQL so the container stays
stateless.

## Current Dev App

Verified on June 27, 2026:

```text
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app
```

The live app reported `postgres:projects_demo_state` from `/api/health`, and a
save/read smoke test passed through `/api/state`.

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

If Outplane gives you a single connection URI instead, you can use
`DATABASE_URL` in place of the `PG*` variables.

Do not set `PROJECTS_STATE_FILE` for the hosted Postgres app. That variable is
only for local file-backed development, and it implies container or volume state.

The browser sends an anonymous client key with API requests, so hosted demo
edits are separated per browser without accounts. Hosted Postgres API requests
without that browser key are rejected instead of sharing one fallback row.

The app also supports a sync code for personal two-device use. **New** creates a
code and copies the current demo state to that code's row; **Use** joins that
row from another device; **Leave** returns to the device's own row. Anyone with
the code can open the same demo state. The code is hashed before it is sent as
the backend row key, but the stored demo JSON is not end-to-end encrypted.

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

## Notes

Keep GitHub Pages as the static public portfolio path. Use Outplane only when
you want to test the backend-backed app mode.
