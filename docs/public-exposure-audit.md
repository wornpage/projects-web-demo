# Public Exposure Audit

Date: 2026-06-27

## Summary

The hosted Outplane app does not expose private repository files through the
web server. The public surface is the browser app itself:

- `index.html`
- `assets/demo.css`
- `assets/demo.js`
- `assets/favicon.png`
- `/api/health`
- `/api/demo-packs` and related API routes only when the browser sends a demo
  client key
- `/api/state` and related API routes only when the browser sends a demo client
  key

HTML, CSS, JavaScript, images, and public JSON are visible to every visitor.
That is expected for a browser app. Anything in those files must be treated as
public.

## Evidence

Live URL checked:

```text
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app
```

Observed responses:

| Path | Result | Meaning |
|---|---:|---|
| `/` | `200` | Public app shell |
| `/assets/demo.js` | `200` | Public browser logic |
| `/data/demo-packs.json` | `404` | Static sample data file is not served by the hosted app |
| `/README.md` | `404` | Repo docs not served by Outplane |
| `/Dockerfile` | `404` | Deploy file not served by Outplane |
| `/.git/config` | `404` | Git metadata not served |
| `/server/server.js` | `404` | Server source not served |
| `/server/package-lock.json` | `404` | Dependency lockfile not served |
| `/docs/deploy-outplane.md` | `404` | Docs not served by Outplane |
| `/render.yaml` | `404` | Retired provider config not served |
| `/assets/../server/server.js` | `404` | Traversal attempt denied |
| `/assets/%2e%2e/server/server.js` | `404` | Encoded traversal attempt denied |
| `/api/state` without client key | `400` | Backend state has no unkeyed fallback row |
| `/api/state` with client key | `200` | Demo state loads for that client key |
| `/api/demo-packs` with client key | `200` | Demo seed data loads through the keyed API |

GitHub evidence:

| Check | Result |
|---|---|
| Repository visibility | Private |
| Likely GitHub Pages URL | `404` |
| GitHub Pages API | `404` |

Repeatable local gate:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run boundary:check'
```

The gate starts the Node app with a temporary file-backed state directory,
confirms only the named public file allowlist is served, confirms repository
files, unlisted asset/data paths, and path traversal attempts return `404`,
creates work under one browser client
key, confirms another client key cannot read it, confirms unkeyed local API
state is rejected, confirms non-JSON state writes are rejected, confirms
oversized keyed state snapshots, oversized `actionReceipt` shapes, and create
requests past the state cap are rejected,
confirms public assets stay on the file allowlist, confirms public text assets
stay under explicit size budgets without source-map hints or private path
strings, confirms retired route code stays absent,
and confirms the backend-served app shell sends a nonce-based Content Security
Policy for the injected runtime API script and blocks unsafe inline styles. It
also confirms the app shell sends
legacy frame denial, same-origin resource/opener isolation, and restrictive
Permissions-Policy headers. API CORS uses the exact same-origin app origin
instead of a wildcard, rejects a third-party preflight, and cannot be authorized
by a spoofed forwarding header. It also confirms malformed `Host` values do not
bypass the normal request handler.

The static preview gate starts `server/static.js`, confirms only the static file
allowlist is served, confirms static sample JSON remains the only public data
file, rejects non-read methods, sends defensive CSP and browser security headers,
confirms the frontend avoids runtime inline style setters that the static CSP
would block, and confirms unexpected valid `Host` values do not affect preview
routing:

```powershell
pwsh -NoLogo -NoProfile -Command 'npm --prefix server run static:check'
```

Repeatable live gate:

```powershell
pwsh -NoLogo -NoProfile -Command 'node "scripts/check-live-deploy.mjs"'
```

The live gate confirms the hosted app uses Postgres, serves the app shell with a
nonce-based CSP, rejects `/api/state` without a browser client key, loads seed
demo work through `/api/demo-packs` with a browser client key, keeps fixed
`live-check-*` browser rows separate, lets a fixed shared sync key read the same
row from another request, restores an exported state snapshot to its keyed row,
rejects oversized keyed state snapshots, uses same-origin API CORS instead of
wildcard CORS, rejects a third-party preflight, and rejects forwarded-host CORS
spoofing. It also confirms the hosted app shell sends frame-deny, same-origin
resource/opener isolation, restrictive Permissions-Policy headers, and a style
policy without unsafe inline styles, and that
hosted public assets have no source-map
references, private path strings, served source-map files, retired metadata
asset, or unlisted public asset/data paths.
It confirms `/api/health` reports only the storage kind and does not expose
database table names, local state file paths, or storage credentials.
The sync gate confirms generated sync codes and anonymous browser row keys use
Web Crypto and do not fall back to weak random values.

## Risk Decisions

| Risk | Current status | Decision |
|---|---|---|
| Browser JS is visible | True | Accept for demo; move valuable logic server-side if it becomes proprietary |
| Static sample data is visible on static targets | True | Accept for GitHub Pages/static preview; the static preview gate proves it remains the only public data file, while hosted app mode loads seed data through the keyed API |
| Private repo files served by Outplane | Not observed | App allowlist only serves app assets and keyed API routes |
| Private repo URL in public frontend | Fixed | Removed public Source link and frontend repo URL defaults |
| Browser-side diagnostic metadata is public | Fixed | Removed the public metadata asset and retired browser-side audit helpers |
| Docker image contains extra docs/source helpers | Reduced | Docker now copies only `server/server.js` after install |
| Broad shared app stylesheet is public | Fixed | Removed `assets/app.css`; demo-owned tokens now live in `assets/demo.css` |
| Hosted app serves static sample JSON directly | Fixed | `/data/demo-packs.json` is no longer served by the app server; seed work loads through `GET /api/demo-packs` with the browser client key |
| Obsolete provider config confuses the deployment path | Fixed | Removed the retired Render Blueprint so Outplane plus Docker is the only checked-in hosted path |
| Public health endpoint exposes storage internals | Fixed | `/api/health` now reports only the storage kind, not the table name or state file path |
| Accidental files under public asset directories become reachable | Fixed | Static serving and Docker deploys now use a named public frontend file allowlist |
| Local file-backed API users mix state | Fixed | Browser client keys are required and map to separate hashed local state files |
| Hosted Postgres stores raw browser row keys | Reduced | New writes use server-side `v2:` SHA-256 state keys; raw-key reads remain only to migrate pre-hash rows on next write |
| Anonymous backend state rows can grow without a work-item cap | Fixed | `PUT /api/state` and `POST /api/packs` reject rows above 50 work items |
| API body routes parse non-JSON writes | Fixed | Body routes require `Content-Type: application/json`; non-JSON state writes return `415` |
| Full-state writes accept unbounded receipt objects | Fixed | `actionReceipt` objects are depth/key/item bounded before storage |
| Guessable generated sync or browser row keys | Reduced | Generated sync codes and anonymous browser row keys require Web Crypto with no weak random fallback |
| Backend app shell allows arbitrary inline script/style | Reduced | The Node app serves `index.html` with a nonce-based CSP for the injected API-base script and blocks unsafe inline styles |
| App shell lacks defensive browser headers | Fixed | The Node app sends frame-deny, same-origin resource/opener isolation, no-referrer, nosniff, and restrictive Permissions-Policy headers |
| API accepts browser calls from any site | Fixed | CORS reflects only the same-origin app origin or explicit configured origins and does not trust forwarded-host for authorization |
| Host header parsing can bypass the normal error path | Fixed | Request routing parses against a fixed internal base and the boundary gate sends an invalid Host header through `/api/health` |
| GitHub Pages root publish could expose repo files | Possible if enabled | Keep Pages disabled or publish only a filtered artifact |

## What Cannot Be Hidden

Visitors can always inspect downloaded browser files with DevTools or direct
URLs. Minification or obfuscation can slow casual copying, but it cannot make
HTML, CSS, JavaScript, images, or public JSON private.

## If The UI Logic Is Too Valuable To Share

Use a thinner frontend:

1. Keep only layout, rendering, and button calls in browser JavaScript.
2. Move scoring, workflow decisions, parsing, recommendations, and proprietary
   rules into authenticated API endpoints.
3. Return only final results needed for the screen.
4. Disable source maps for production builds.
5. Minify bundles for size and casual copy friction.
6. Add authentication before storing private user data or private project work.

Do not rely on obfuscation for security.

The first server-side slice is pack workflow execution. In backend app mode,
pack creation runs through `POST /api/packs`, `Button runs next` changes run
through `POST /api/packs/{id}/next`, selected-work command previews run
through `GET /api/packs/{id}/command`, work-path edits run through
`POST /api/packs/{id}/path`, memory notes run through `POST
/api/packs/{id}/memory`, and pack-level actions such as `start`, `unblock`,
`block`, `done`, and `open` run through `POST /api/packs/{id}/actions`. These
endpoints update or read the stored demo state on the server and return the
resulting command preview or receipt to the browser.
The older generic `PATCH /api/packs/{id}` update path is retired so work edits
must pass through the server-owned workflow endpoints.
Full demo snapshot persistence is intentionally limited to `PUT /api/state` for
browser-row persistence, sync-code copy, and recovery. The older duplicate
`POST /api/state` write path is retired.

## Obfuscation Decision

Do not paste this app into third-party web obfuscators. Use local build tooling
only, after behavior has been moved server-side and browser smoke tests pass.
Obfuscation can add copy-friction, but it does not make browser-delivered code
private and can break debugging, accessibility, and interaction flows if it is
too aggressive.

The production Docker build runs `scripts/protect-frontend.mjs` against
`assets/demo.js`. The script uses local Terser minification with top-level
compression and mangling, encodes selected internal API strings into a runtime
string table, syntax-checks the generated script, and fails the build if
readable helper names or protected strings remain. This hides readable helper
names such as the backend action helpers while keeping the deployed script
small enough to load normally.

`nstarke/egodeath` was evaluated at pinned commit
`ef8ed58fd26eb5cba59cb3a2787660efc7ac5b31`, but it is not enabled for
production. It produced syntax-valid output at low token targets, but browser
smoke tests repeatedly emitted runtime `ReferenceError` errors for this app.
That is not clean enough to ship. This is still copy-friction, not a security
boundary; the browser receives executable JavaScript either way.

## Required Publish Boundary

For any static publish target, publish only:

```text
index.html
assets/
data/demo-packs.json
.nojekyll
```

Do not publish the repository root if it contains server code, deployment docs,
or private project files.
