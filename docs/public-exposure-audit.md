# Public Exposure Audit

Date: 2026-06-27

## Summary

The hosted Outplane app does not expose private repository files through the
web server. The public surface is the browser app itself:

- `index.html`
- `assets/`
- `data/demo-packs.json`
- `/api/health`
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
| `/data/demo-packs.json` | `200` | Public sample data |
| `/README.md` | `404` | Repo docs not served by Outplane |
| `/Dockerfile` | `404` | Deploy file not served by Outplane |
| `/.git/config` | `404` | Git metadata not served |
| `/server/server.js` | `404` | Server source not served |
| `/server/package-lock.json` | `404` | Dependency lockfile not served |
| `/docs/deploy-outplane.md` | `404` | Docs not served by Outplane |
| `/render.yaml` | `404` | Render config not served |
| `/assets/../server/server.js` | `404` | Traversal attempt denied |
| `/assets/%2e%2e/server/server.js` | `404` | Encoded traversal attempt denied |
| `/api/state` without client key | `400` | Hosted state is not shared by fallback |
| `/api/state` with client key | `200` | Demo state loads for that client key |

GitHub evidence:

| Check | Result |
|---|---|
| Repository visibility | Private |
| Likely GitHub Pages URL | `404` |
| GitHub Pages API | `404` |

## Risk Decisions

| Risk | Current status | Decision |
|---|---|---|
| Browser JS is visible | True | Accept for demo; move valuable logic server-side if it becomes proprietary |
| Public sample data is visible | True | Accept; keep fake demo data only |
| Private repo files served by Outplane | Not observed | App allowlist only serves app assets and sample data |
| Private repo URL in public frontend | Fixed | Removed public Source link and frontend repo URL defaults |
| Docker image contains extra docs/source helpers | Reduced | Docker now copies only `server/server.js` after install |
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
through `POST /api/packs/{id}/next`, memory notes run through
`POST /api/packs/{id}/memory`, and pack-level actions such as `start`,
`unblock`, `block`, `done`, and `open` run through
`POST /api/packs/{id}/actions`. These endpoints update the stored demo state on
the server and return the resulting receipt to the browser.

## Obfuscation Decision

Do not paste this app into third-party web obfuscators. Use local build tooling
only, after behavior has been moved server-side and browser smoke tests pass.
Obfuscation can add copy-friction, but it does not make browser-delivered code
private and can break debugging, accessibility, and interaction flows if it is
too aggressive.

The production Docker build uses local Terser minification on `assets/demo.js`
inside the image and prunes the build tool before runtime. This is copy-friction,
not a security boundary; the browser still receives executable JavaScript.

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
