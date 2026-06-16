# Projects GitHub Pages Demo

This folder contains the static public demo for Projects. It simulates the
cockpit in browser state and is intentionally not the real `Projects.Web`
server app.

- Demo: `https://jared-bidlow.github.io/projects-web-demo/`
- Public repo: `https://github.com/jared-bidlow/projects-web-demo`

| Boundary | Demo behavior |
|---|---|
| Data | Uses fake sample work from `data/demo-packs.json`. |
| Actions | Simulates changes in browser state only. |
| Screens | Includes Home, Work, Today, Board, Review, Focus, Next, Check, Search, Stats, Notes, Timeline, Files, Calendar, Create, Memory, Settings, and Pack detail routes. |
| Styling | The deploy workflow copies `src/Projects.Web/wwwroot/css/app.css` into the Pages artifact. |
| Storage | Does not read or write local packs, memory, files, or activity logs. |

The demo is a hash-routed static app. Example paths:

| Route | Purpose |
|---|---|
| `#/work` | Browse and filter fake sample work. |
| `#/board` | Scan fake work by status lane. |
| `#/review` | Change fake Button-runs-next values and mark sample work done. |
| `#/focus` | Show one selected item with Where / Blocker / Button runs next. |
| `#/next` | Choose the simulated Button-runs-next action for a sample item. |
| `#/check` | Run browser-only readiness checks against the fake data. |
| `#/stats` | Review browser-state counts by status and review need. |
| `#/notes` | Read fake memory notes across sample work. |
| `#/timeline` | Read fake activity entries across sample work. |
| `#/files` | Show fake source references without opening local files. |
| `#/calendar` | Browse fake due dates. |
| `#/create` | Add a browser-only sample item. |
| `#/settings` | Switch copy profile labels in demo state. |

The source-repo workflow is `.github/workflows/deploy-demo.yml`. It builds and
uploads a review artifact. The public demo repository hosts the live GitHub
Pages site.

Build the same static artifact locally:

```powershell
pwsh -NoLogo -NoProfile -File scripts/export-pages-demo.ps1 -OutputPath _site -Clean
```

For the public demo repository, copy or push only the generated `_site`
contents. Do not mirror the private app repo or real pack data.
