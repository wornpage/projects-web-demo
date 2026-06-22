# Projects Web Demo

This repository is the active lightweight web-tech home for the public
Projects demo. It is a static GitHub Pages app: HTML, CSS, JavaScript, JSON
demo data, and image assets only.

The demo is browser-local. It does not run a backend, collect customer data,
store sign-ins, process payments, or call a live Projects service.

## Active Boundary

Keep this repo focused on the public portfolio demo.

| Area | Kept here | Not part of this repo |
|---|---|---|
| Runtime | Static GitHub Pages app | Razor Server, Blazor WASM, desktop app runtime |
| Data | `data/demo-packs.json` sample work | Real packs, private notes, customer data |
| State | Browser `localStorage` under `projects-static-demo-state-v6` | Server persistence or account state |
| Styling | Static CSS in `assets/` | Source-side app shell generation |
| Behavior | Static JS in `assets/demo.js` | Backend workflows or GitHub API calls |

## Files

| Path | Purpose |
|---|---|
| `index.html` | Public app shell served by GitHub Pages. |
| `assets/demo.js` | Hash routing, demo state, button behavior, and smoke checks. |
| `assets/demo.css` | Public demo layout and interaction styling. |
| `assets/app.css` | Shared visual tokens and base component rules used by the demo. |
| `assets/demo-metadata.json` | Build/version metadata shown in the demo header. |
| `assets/favicon.png` | Demo favicon. |
| `data/demo-packs.json` | Fake browser-local work data. |

## Routes

The app uses hash routing so it can run as plain static files on GitHub Pages.
The important public paths are:

| Hash path | Purpose |
|---|---|
| `#/home` | Work overview. |
| `#/review` | Work that needs review or setup. |
| `#/work` | Work list and selected-work browsing. |
| `#/pack/{packId}` | Edit one work item path. |
| `#/next/{packId}` | Choose what Button runs next for one work item. |
| `#/memory/{packId}` | Add browser-local memory for one work item. |
| `#/settings` | Demo profile and scenario controls. |
| `#/health` | Runtime checks for the static demo. |
| `#/meta` | Copyable metadata and route snapshot. |

Unknown hashes fall back to `#/home`.

## Local Preview

Run any static file server from the repository root:

```powershell
python -m http.server 5181
```

Then open:

```text
http://localhost:5181/#/home
```

No build step is required for normal portfolio-demo edits.

## GitHub Pages

The published site is this static repository. Keep the Pages branch/folder
pointing at these checked-in files.

Before pushing, run:

```powershell
node --check assets/demo.js
```

Then smoke the main routes locally in light and dark mode:

- `#/home`
- `#/review`
- `#/work`
- `#/pack/source-folder-audit`
- `#/next/source-folder-audit`
- `#/memory/source-folder-audit`
- `#/settings`
- `#/health`
- `#/meta`

## Product Rule

The public demo should explain one idea clearly:

```text
Pick work -> see the blocker -> run the obvious next button.
```

If a feature does not support that public portfolio story, it should stay out
of this repo.
