# __PROJECT_NAME__

A client-side SPA with hash routing, CSS theming, and an optional Express+Postgres backend. Built from `spa-template`.

## Quick start

```bash
node scripts/init.mjs   # Replace placeholders with your project details
npm install             # Install terser (build tool)
cd server && npm install  # Install pg (optional, for backend)
npm run build           # Minify and output assets/app.js
npm start               # Start the dev server (default :3000)
```

## Project structure

```
├── index.html          # App shell (CSP, skip link, <main> target)
├── assets/
│   ├── app.css         # Design tokens, reset, layout (light + dark themes)
│   └── app.js          # Minified SPA bundle (built from src/)
├── src/app/
│   └── app.js          # Router, state store, theme manager, route renderers
├── server/
│   ├── server.js       # Express API server with Postgres/file state
│   └── src/            # constants, security (CORS), state-storage
├── scripts/
│   ├── build.mjs       # Terser minification + --check mode
│   ├── check-ship.mjs  # Pre-ship gates
│   └── init.mjs        # Placeholder replacement for new projects
├── data/               # Runtime state files (gitignored)
└── package.json
```

## Frontend architecture

- **Hash router**: `window.location.hash` drives all navigation. No server-side routing needed.
- **State store**: plain object (`const state = {...}`) mutated in place. No framework.
- **Render dispatch**: each route has a render function that writes `innerHTML` into `#screen-content`.
- **Theme manager**: CSS custom properties on `:root` switch between light and dark via `html.dark` class.
- **No dependencies**: vanilla JS, zero runtime npm packages.

## Backend architecture (optional)

- **server.js**: raw `http.createServer`, JSON logging, graceful shutdown on SIGTERM/SIGINT.
- **State storage**: Postgres (via `pg` + `DATABASE_URL`) or local file (via `STATE_DIR`).
- **Security headers**: CSP, CORS, HSTS, cache-control, referrer-policy, frame options, permissions policy — all applied to every response.
- **Static files**: server doubles as a static file host for the built SPA.

## Ship check

```bash
npm run ship:check
```

Runs:
1. Frontend syntax (`node --check src/app/app.js`)
2. Build freshness (`build.mjs --check` — asserts assets match source)

Non-zero exit blocks deployment. Add your own gates (tests, lint, bundle size) in `scripts/check-ship.mjs`.

## Customizing

1. Add routes in `ROUTES` object and write render functions in `src/app/app.js`.
2. Add CSS in `assets/app.css` — use `var(--app-*)` tokens for theming.
3. Add API endpoints in `server/server.js` under the `// API routes` comment.
4. Add ship gates in `scripts/check-ship.mjs`.
