# Deploy the static demo to Cloudflare Pages

The deployed product is the **static artifact**, not the repository. Build it,
then upload only the artifact folder. The app-mode backend (`server/`) is not
part of this deployment — it stays in the repo, dormant, for local app-mode
and as the home of the build tooling.

## 1. Build the artifact

From the repo root:

```powershell
node scripts/build-static-publish.mjs
# or, equivalently:
npm --prefix server run publish:static
```

The artifact is written to `dist/static-publish/`. It contains only the
public file allowlist (`index.html`, `landing.html`, `sw.js`,
`manifest.json`, `assets/*`, `data/demo-packs.json`) and its
`assets/demo.js` is the **protected bundle** — re-minified with top-level
mangling and internal strings encoded (`scripts/protect-frontend.mjs` runs
inside the build). No server code, docs, or manifests are included; the
`publish:check` gate proves that on every CI run.

## 2. Upload to Cloudflare Pages

Two options — both serve the same artifact:

- **Direct upload (simplest, matches the "drop" workflow):** Cloudflare
  dashboard → Workers & Pages → Create → Pages → *Upload assets*, then drag
  `dist/static-publish/` in. Or from the CLI:

  ```powershell
  npx wrangler pages deploy dist/static-publish
  ```

- **Git-connected build:** point Pages at the repo with build command
  `node scripts/build-static-publish.mjs` and output directory
  `dist/static-publish`. Note this runs the protected build on Cloudflare's
  side; the direct-upload path avoids giving the build any third-party
  runtime at all.

The app uses **hash routing** (`#/home`, `#/work`), so no SPA fallback or
`_redirects` file is needed — serving `index.html` at `/` is sufficient.

## 3. After the first deploy

- Enable **Bot Fight Mode** (dashboard → Security → Bots) — free tier, cuts
  bulk scraping of the published assets.
- Spot-check `#/home`, `#/work`, and `#/search` in the deployed site; the
  service worker (`sw.js`) is network-first, so a second reload picks up any
  newly deployed bundle.

## App mode on Cloudflare Workers (free plan)

The backend can also run live on Cloudflare Workers — same account, $0 — with
per-client state in SQLite-backed Durable Objects instead of a file or
Postgres. The worker (`worker/index.mjs` + `wrangler.jsonc`) reuses the Node
server's `routeRequest` through node:http shims, so API behavior is the same
code, not a port; it serves the protected static artifact through the assets
binding and injects `runtime-config.js` with `backendMode: true`.

```powershell
npm --prefix server run worker:dev     # local: builds artifact, runs wrangler dev on :8787
npm --prefix server run worker:deploy  # deploy: requires `npx wrangler login` once
```

Both commands (and plain `npx wrangler deploy`) build `dist/static-publish`
themselves: `wrangler.jsonc` declares `build.command`, which installs the
server dependencies when they are missing and runs the artifact build. That is
what makes the git-connected **Workers Builds** deploy work — Cloudflare
clones the repo fresh and runs `npx wrangler deploy` with no separate build
step, so the deploy command in the Workers Builds settings needs no
customization.

Notes:

- Free-tier fit: 100k requests/day, 10 ms CPU per request, Durable Objects on
  the free plan are SQLite-backed (`new_sqlite_classes` in the migration).
- Durable Object names are SHA-256 digests of the client key — same privacy
  property as file storage's hashed filenames.
- Rate-limit buckets are per-isolate memory, so limits are advisory rather
  than global there; the per-key write limit still binds within an isolate.
- Optional vars: `PROJECTS_PUBLIC_ORIGIN` (extra allowed CORS origins),
  `PROJECTS_ASSET_VERSION` (cache-busting version; defaults to `app`).

## Why this shape

Decided 2026-07-11: the repo stays a **monorepo with static as the
first-class deployed route**. The static demo and app-mode are one frontend
in two modes, welded by a shared workflow-rules core
(`server/src/workflow-rules.js` is required by the backend *and* prepended
into the client bundle) and a hosted-parity data contract — splitting them
into separate repos would reintroduce the silent-drift bug class the gates
exist to prevent. The backend stays dormant rather than deleted: it owns the
build tooling and roughly half the ship gates, and deleting it is a one-way
door that buys nothing the artifact build doesn't already provide. Source
stays public under AGPL-3.0 (+ CLA for commercial dual licensing); exposure
of the deployed site is handled by the protected bundle, not by hiding the
repo.
