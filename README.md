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
| Screens | Includes Home, Work, Today, Review, Focus, Search, Create, Memory, Settings, and Pack detail routes. |
| Styling | The deploy workflow copies `src/Projects.Web/wwwroot/css/app.css` into the Pages artifact. |
| Storage | Does not read or write local packs, memory, files, or activity logs. |

The demo is a hash-routed static app. Example paths:

| Route | Purpose |
|---|---|
| `#/work` | Browse and filter fake sample work. |
| `#/review` | Change fake Button-runs-next values and mark sample work done. |
| `#/focus` | Show one selected item with Where / Blocker / Button runs next. |
| `#/create` | Add a browser-only sample item. |
| `#/settings` | Switch copy profile labels in demo state. |

The deploy workflow is `.github/workflows/deploy-demo.yml`.

Build the same static artifact locally:

```powershell
pwsh -NoLogo -NoProfile -File scripts/export-pages-demo.ps1 -OutputPath _site -Clean
```

For the public demo repository, copy or push only the generated `_site`
contents. Do not mirror the private app repo or real pack data.
