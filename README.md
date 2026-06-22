# Projects GitHub Pages Demo

This folder contains the static public demo for **Projects**. It is intentionally browser-only:
demo work is loaded from `data/demo-packs.json`, and action receipts stay in localStorage.
It is not a hosted service, sign-in surface, payment surface, or customer-data
collection path.

## Runtime decision

The public demo is not `Projects.Web`, not Razor Server, and not Blazor
WebAssembly at runtime. GitHub Pages serves static HTML, CSS, JavaScript, demo
data, metadata, and assets only.

The source-side direction is:

`Razor app/product shell -> export-pages script -> static GitHub Pages demo`

Razor and C# may feed future export tooling, but the exported Pages artifact
stays browser-local and JS-driven unless browser-side .NET logic becomes worth
the extra WASM weight. See
[`../architecture/github-pages-demo-runtime.md`](../architecture/github-pages-demo-runtime.md).

## Product surface

The demo acts like a product landing surface for quick proofing:

- Version metadata in the header (`demo-version`) is loaded from `assets/demo-metadata.json`.
- Health and feedback routes provide product-like operational checks and feedback handoff.
- Scenario presets emulate different starting conditions for demos and screenshots.
- Settings lets you switch copy profile and scenario quickly.

## Routes

The app is hash-routed. The hash path chooses the screen; browser-local state
chooses the selected work; the current path panel combines both to decide the
Button runs next control.

Navigation keeps the main work path visible first: Home, Review, Work, Focus,
Next, and Create. Supporting views and system/proof screens stay collapsed by
default so the public demo reads as one work path before it reads as a route list.

| Hash path | Screen | Meaning | Button source |
|---|---|---|---|
| `#/home` | Work overview | Work overview and scenario launch pad. | Route |
| `#/triage` | Work triage tool | Browser-local work triage tool for pasted tasks. | Route |
| `#/work/{packId}` | Work list | Work list browsing and Button runs next tryout. | Selected work |
| `#/today/{packId}` | Today | Today-focused items. | Selected work |
| `#/board/{packId}` | Board | Status lane board. | Selected work |
| `#/review/{packId}` | Review | Review queue and next-step tuning. | Selected work |
| `#/focus/{packId}` | Focus | Single selected work item. | Selected work |
| `#/next/{packId}` | Next setup | Configure a work item's Button runs next value. | Route + selected work |
| `#/check` | Check | Browser checks against demo data and quality rules. | Route |
| `#/search` | Search | Search through work fields. | Route |
| `#/stats` | Stats | Simple status and review metrics. | Route |
| `#/notes/{packId}` | Notes | Memory-style notes from selected work. | Route + selected work |
| `#/timeline` | Timeline | Activity history from this browser. | Route |
| `#/files` | Files | Source reference list. | Route |
| `#/calendar/{packId}` | Calendar | Due date view. | Selected work |
| `#/create` | Create | Add a work item. | Route |
| `#/memory/{packId}` | Memory | Per-item memory. | Route + selected work |
| `#/settings` | Settings | Copy profile and scenario controls. | Route |
| `#/feedback` | Feedback | Feedback flow with prefilled issue context. | Route |
| `#/health` | Demo health | Demo health checks and build summary. | Route |
| `#/meta` | Meta | Build and route snapshot for demos. | Route |
| `#/lab/{packId}` | Demo Lab | Button runs next test and copyable snapshot. | Route + selected work |

`docs/demo/assets/demo.js` keeps the same contract in `ROUTE_CONTRACT`,
`parseHashRoute()`, and `formatRouteHash()`.

Route patterns use URI-template-style `{packId}` placeholders. `packId` is a
URL-encoded stable work id; the parser decodes it with
`decodeURIComponent()` and falls back safely when a malformed fragment is
provided. Unknown routes resolve to `#/home`; routes without an explicit
`packId` keep the current browser-local selection or choose the route's default
work item.

The standards/convention boundary is:

| Area | Convention used |
|---|---|
| Hash path | URL fragment routing, interpreted only by browser JavaScript. |
| Route pattern | URI-template-style `{packId}` placeholders. |
| Id encoding | `encodeURIComponent()` / `decodeURIComponent()`. |
| Timestamps | ISO 8601 strings from `Date.toISOString()`. |
| Accessibility target | WCAG/ARIA-compatible labels, focus, and button states. |

The Health and Meta screens include a route-contract check so broken nav
entries, mismatched `{packId}` patterns, unknown fragments, or malformed
encoded ids are visible inside the demo. They also flag URL-decoded `packId`
values that do not match the demo work loaded in this browser, extra
hash path segments, and ids supplied to routes that do not accept ids.

## Runtime conventions

| Area | Demo behavior |
|---|---|
| Data | Reads demo work from `data/demo-packs.json`. |
| State | Persists temporary demo state in localStorage under `projects-static-demo-state-v6`. |
| Versioning | Header `Build` uses release metadata; `State` in the header shows localStorage schema (`v6`). |
| Action receipts | Browser-only demo-data changes (no remote write-back). |
| Triage | Converts pasted task text into editable `Where`, `Blocker`, `Button runs next`, evidence, and done-when rows. |
| Theme | Supports light/dark, defaults to light. |
| Routes | `#/home` default when no route is provided. |
| Metadata | Loaded from `assets/demo-metadata.json` and shown in the header. |
| Copy budgets | Visible Current path copy is bounded separately from tooltip/ARIA help. Health, Meta, and Lab flag command labels missing `data-copy-*` coverage and compact button/badge labels that exceed visible/help limits. |
| North Star audit | Health, Meta, and Lab check that Where, Blocker, Button runs next, memory, memory guidance, editable-field guidance, plain-language copy, support opt-in, compact label limits, disabled-button reasons, support-action reasons, empty-state guidance, receipt confirmations, and select guidance are visible on the rendered route. |

## Build artifact

The exported bundle combines copied Blazor assets with a thin static demo overlay:

- `docs/demo/index.html` -> exported as `index.html`; the exporter rewrites only the output copy with versioned asset URLs.
- `docs/demo/README.md` -> exported as `README.md`; public artifact guidance copied beside the demo for review.
- `src/Projects.Web/wwwroot/css/app.css` -> exported as `assets/app.css`; shared Blazor shell, rail, button, typography, and token rules remain the styling baseline.
- `src/Projects.Web/wwwroot/favicon.png` -> exported as `assets/favicon.png`
- `docs/demo/assets/demo.js` -> exported as `assets/demo.js`; hash routes, browser-local state, Button runs next controls, and demo QA checks.
- `docs/demo/assets/demo.css` -> exported as `assets/demo.css`; static hash-route layout plus Pages-only surface rules that use Blazor tokens without generated `.card` markup.
- `docs/demo/assets/demo-metadata.json` -> merged into `assets/demo-metadata.json`; export-time version, commit, timestamp, and boundary fields win.
- `docs/demo/data/demo-packs.json` -> exported as `data/demo-packs.json`; demo work only.

`docs/demo/assets/app.css` is checked in only as a source-preview fallback for
opening `docs/demo/index.html` directly. The exported public artifact always
gets a fresh `assets/app.css` copied from `src/Projects.Web/wwwroot/css/app.css`.

Metadata is generated during export and written to `assets/demo-metadata.json` with:

- version
- commit
- generated timestamp
- repository/release links
- service boundary note
- scenario/profile defaults

Build locally:

```powershell
pwsh -NoLogo -NoProfile -File scripts/export-pages-demo.ps1 -OutputPath _site -Clean
```

`-Clean` removes the destination folder first and re-creates it safely.

The exporter also creates `.nojekyll` in the output folder. That marker is
generated, not checked into `docs/demo/`, and keeps the Pages artifact a plain
static bundle.

During export, `index.html` asset references get the current commit plus a
source-asset fingerprint as a `?v=` query string for `assets/app.css`,
`assets/demo.css`, and `assets/demo.js`.
The checked-in source `docs/demo/index.html` stays unversioned for direct local
preview.

The GitHub Actions review build uses `.github/workflows/deploy-demo.yml` to run the same exporter and upload `_site` as the `projects-static-demo` artifact.
Keep that workflow's path filters aligned with the source assets above so demo
HTML, artifact README, metadata, CSS, shared Blazor CSS, favicon, script, data,
and exporter changes rebuild the artifact.

## Public demo output

The exported `_site` folder is static and includes only the browser app,
copied public assets, demo data, and GitHub Pages marker files:

- `index.html`
- `.nojekyll`
- `README.md`
- `assets/app.css`
- `assets/demo.css`
- `assets/demo.js`
- `assets/demo-metadata.json`
- `assets/favicon.png`
- `data/demo-packs.json`
