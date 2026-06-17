# Projects GitHub Pages Demo

This folder contains the static public demo for **Projects**. It is intentionally browser-only:
sample work is loaded from `data/demo-packs.json`, and all actions stay in localStorage.

## Product surface

The demo acts like a product landing surface for quick proofing:

- Version metadata in the header (`demo-version`) is loaded from `assets/demo-metadata.json`.
- Health and feedback routes provide product-like operational checks and feedback handoff.
- Scenario presets emulate different starting conditions for demos and screenshots.
- Settings lets you switch copy profile and scenario quickly.

## Routes

The app is hash-routed. Key screens are:

| Route | Purpose |
|---|---|
| `#/home` | Cockpit overview and scenario launch pad. |
| `#/work` | Work list browsing and action simulation. |
| `#/today` | Today-focused items. |
| `#/board` | Status lane board. |
| `#/review` | Review queue and next-step tuning. |
| `#/focus` | Single selected sample work. |
| `#/next` | Configure a sample item’s next action. |
| `#/check` | Browser checks against sample data and quality rules. |
| `#/search` | Search through sample work fields. |
| `#/stats` | Simple status and review metrics. |
| `#/notes` | Memory-style notes from sample work. |
| `#/timeline` | Activity history from sample state. |
| `#/files` | Source reference list. |
| `#/calendar` | Due date view. |
| `#/create` | Add a sample work item. |
| `#/memory` | Per-item memory. |
| `#/settings` | Copy profile and scenario controls. |
| `#/feedback` | Feedback workflow with prefilled diagnostics. |
| `#/health` | Demo health checks and metadata summary. |
| `#/meta` | Product-style telemetry and meta snapshot for demos. |

## Runtime conventions

| Area | Demo behavior |
|---|---|
| Data | Reads fake sample work from `data/demo-packs.json`. |
| State | Persists temporary demo state in localStorage under `projects-static-demo-state-v2`. |
| Actions | Browser-only mutations (no remote write-back). |
| Theme | Supports light/dark, defaults to dark. |
| Routes | `#/home` default when no route is provided. |
| Metadata | Loaded from `assets/demo-metadata.json` and shown in the header. |

## Build artifact

The shared stylesheet and icon are copied from `src/Projects.Web`:

- `src/Projects.Web/wwwroot/css/app.css`
- `src/Projects.Web/wwwroot/favicon.png`

Metadata is generated during export and written to `assets/demo-metadata.json` with:

- version
- commit
- generated timestamp
- repository/release links
- scenario/profile defaults

Build locally:

```powershell
pwsh -NoLogo -NoProfile -File scripts/export-pages-demo.ps1 -OutputPath _site -Clean
```

`-Clean` removes the destination folder first and re-creates it safely.

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
