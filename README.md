# Projects GitHub Pages Demo

This folder contains the static public demo for **Projects**. It is intentionally browser-only:
sample work is loaded from `data/demo-packs.json`, and all actions stay in localStorage.
It is not a hosted service, sign-in surface, payment surface, or customer-data
collection path.

## Runtime decision

The public demo is not `Projects.Web`, not Razor Server, and not Blazor
WebAssembly at runtime. GitHub Pages serves static HTML, CSS, JavaScript, sample
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
chooses the selected sample work; the command brief combines both to decide the
primary button.

| Hash path | Screen | Meaning | Primary action source |
|---|---|---|---|
| `#/home` | Command cockpit | Cockpit overview and scenario launch pad. | Route |
| `#/triage` | Work triage tool | Browser-local work triage tool for pasted tasks. | Route |
| `#/work/{packId}` | Work list | Work list browsing and action simulation. | Selected work |
| `#/today/{packId}` | Today | Today-focused items. | Selected work |
| `#/board/{packId}` | Board | Status lane board. | Selected work |
| `#/review/{packId}` | Review | Review queue and next-step tuning. | Selected work |
| `#/focus/{packId}` | Focus | Single selected sample work. | Selected work |
| `#/next/{packId}` | Next setup | Configure a sample item's next action. | Route + selected work |
| `#/check` | Check | Browser checks against sample data and quality rules. | Route |
| `#/search` | Search | Search through sample work fields. | Route |
| `#/stats` | Stats | Simple status and review metrics. | Route |
| `#/notes/{packId}` | Notes | Memory-style notes from sample work. | Route + selected work |
| `#/timeline` | Timeline | Activity history from sample state. | Route |
| `#/files` | Files | Source reference list. | Route |
| `#/calendar/{packId}` | Calendar | Due date view. | Selected work |
| `#/create` | Create | Add a sample work item. | Route |
| `#/memory/{packId}` | Memory | Per-item memory. | Route + selected work |
| `#/settings` | Settings | Copy profile and scenario controls. | Route |
| `#/feedback` | Feedback | Feedback workflow with prefilled diagnostics. | Route |
| `#/health` | Demo health | Demo health checks and metadata summary. | Route |
| `#/meta` | Meta | Product-style telemetry and meta snapshot for demos. | Route |
| `#/lab/{packId}` | Demo Lab | Demo command-flow simulator and copyable snapshot. | Route + selected work |

`docs/demo/assets/demo.js` keeps the same contract in `ROUTE_CONTRACT`,
`parseHashRoute()`, and `formatRouteHash()`.

Route patterns use URI-template-style `{packId}` placeholders. `packId` is a
URL-encoded stable sample work id; the parser decodes it with
`decodeURIComponent()` and falls back safely when a malformed fragment is
provided. Unknown routes resolve to `#/home`; routes without an explicit
`packId` keep the current browser-local selection or choose the route's default
sample work.

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
values that do not match the fake sample work loaded in browser state, extra
hash path segments, and ids supplied to routes that do not accept ids.

## Runtime conventions

| Area | Demo behavior |
|---|---|
| Data | Reads fake sample work from `data/demo-packs.json`. |
| State | Persists temporary demo state in localStorage under `projects-static-demo-state-v6`. |
| Versioning | Header `Build` uses release metadata; `State` in the header shows localStorage schema (`v6`). |
| Actions | Browser-only mutations (no remote write-back). |
| Triage | Converts pasted task text into editable `Where`, `Blocker`, `Button runs next`, evidence, and done-when rows. |
| Theme | Supports light/dark, defaults to light. |
| Routes | `#/home` default when no route is provided. |
| Metadata | Loaded from `assets/demo-metadata.json` and shown in the header. |

## Build artifact

The exported bundle combines copied Blazor assets with a thin static demo overlay:

- `docs/demo/index.html` -> exported as `index.html`; the exporter rewrites only the output copy with versioned asset URLs.
- `docs/demo/README.md` -> exported as `README.md`; public artifact guidance copied beside the demo for review.
- `src/Projects.Web/wwwroot/css/app.css` -> exported as `assets/app.css`; shared Blazor shell, rail, button, typography, and token rules remain the styling baseline.
- `src/Projects.Web/wwwroot/favicon.png` -> exported as `assets/favicon.png`
- `docs/demo/assets/demo.js` -> exported as `assets/demo.js`; hash routes, browser-local state, simulated actions, and demo QA checks.
- `docs/demo/assets/demo.css` -> exported as `assets/demo.css`; static hash-route layout plus Pages-only surface rules that use Blazor tokens without generated `.card` markup.
- `docs/demo/assets/demo-metadata.json` -> merged into `assets/demo-metadata.json`; export-time version, commit, timestamp, and boundary fields win.
- `docs/demo/data/demo-packs.json` -> exported as `data/demo-packs.json`; fake sample work only.

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

During export, `index.html` asset references get the current commit as a `?v=`
query string for `assets/app.css`, `assets/demo.css`, and `assets/demo.js`.
The checked-in source `docs/demo/index.html` stays unversioned for direct local
preview.

The GitHub Actions review build uses `.github/workflows/deploy-demo.yml` to run the same exporter and upload `_site` as the `projects-static-demo` artifact.
Keep that workflow's path filters aligned with the source assets above so demo
HTML, artifact README, metadata, CSS, shared Blazor CSS, favicon, script, data,
and exporter changes rebuild the artifact.

## Public demo output

The exported `_site` folder is static and includes only the browser app,
copied public assets, sample data, and GitHub Pages marker files:

- `index.html`
- `.nojekyll`
- `README.md`
- `assets/app.css`
- `assets/demo.css`
- `assets/demo.js`
- `assets/demo-metadata.json`
- `assets/favicon.png`
- `data/demo-packs.json`
