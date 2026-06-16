# Projects GitHub Pages Demo

This folder contains the static public demo for Projects. It simulates the
cockpit in browser state and is intentionally not the real `Projects.Web`
server app.

| Boundary | Demo behavior |
|---|---|
| Data | Uses fake sample work from `data/demo-packs.json`. |
| Actions | Simulates changes in browser state only. |
| Styling | The deploy workflow copies `src/Projects.Web/wwwroot/css/app.css` into the Pages artifact. |
| Storage | Does not read or write local packs, memory, files, or activity logs. |

The deploy workflow is `.github/workflows/deploy-demo.yml`.

Build the same static artifact locally:

```powershell
pwsh -NoLogo -NoProfile -File scripts/export-pages-demo.ps1 -OutputPath _site -Clean
```

For a separate public demo repository, copy or push only the generated `_site`
contents. Do not mirror the private app repo or real pack data.
