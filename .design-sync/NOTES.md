# design-sync notes — projects-web-demo

- This repo is a vanilla-JS app (src/demo/demo.js), NOT a component library. There is no
  native component package; the synced components are **hand-authored React
  reimplementations** of the app's visual patterns, created for this sync with the user's
  explicit approval (chose "Tokens + reimplemented components" over tokens-only).
- The authored package lives in `design-system/` (created by the first sync). Tokens are
  extracted from the `--cockpit-*` custom properties in assets/demo.css; the source of
  visual truth for the patterns is assets/demo.css (work cards, triad, state pills,
  buttons, chips).
- Design idiom to preserve: Sitka Text/Heading serif stack (Georgia fallback), dense
  spacing (1.4 line-height, 13-14px UI text), FULL 1px borders — never side-stripe
  left borders (repo gate check-public-assets.mjs fails on border-left >= 2px), warning
  color carries blocked/attention state, done work recedes via opacity.
- The demo app itself is CSP-strict (no inline styles); the design-system package has no
  such constraint but should stay class/token-driven to match the idiom.
- The converter's `tokensPkg` requires the package to resolve from its own node_modules;
  a self-referencing Windows junction provides that:
  `cmd /c mklink /J design-system\node_modules\projects-cockpit design-system`.
  Recreate it on a fresh clone (node_modules is never committed).
- Playwright for the render check: reuse the repo's pinned version (server/package.json,
  1.61.x) installed into .ds-sync/ — the cached chromium builds under
  %LOCALAPPDATA%/ms-playwright pin it.
- **`--entry` resolves against CWD, not `--node-modules`** (package-build.mjs `resolve(ENTRY_OVERRIDE)`).
  From the repo root, pass the FULL repo-relative path: `--entry ./design-system/dist/index.js`
  (NOT `--entry ./dist/index.js` — that walks up from `<repo>/dist`, finds no package.json since
  the repo has no root manifest, and dies with `ENOENT ...\dist\package.json` at dts.mjs projectFor).
  The exact command that works (2026-07-10 re-sync):
  `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules design-system/node_modules --entry ./design-system/dist/index.js --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json`
- Fonts: Sitka / Iowan Old Style / Palatino are OS-provided system fonts — nothing to
  ship; suppressed via `runtimeFontPrefixes`. Georgia is the shippable-free fallback.

- Drift-check recipe (used by the 2026-07-05 re-sync, works well): diff the `--cockpit-*`
  declarations between the app's light+dark theme blocks (assets/demo.css, first ~68
  lines) and design-system/src/tokens.css, and compare the app's `.btn` rules against
  `.cockpit-btn` in src/styles.css. That re-sync folded in the WCAG dark accent-text fix
  (#d1f5e8 -> #04241d) and the app's press-state layer (hover shadow, :active sink) —
  both landed in the app after the first sync, exactly the hand-mirror drift the risk
  section warns about. The app's forest/ocean/sepia themes are deliberately NOT mirrored
  (package ships light + dark only).
- **2026-07-10 re-sync — big drift fold.** Mirrored three app changes that had accumulated:
  (1) **Font: Sitka serif → system-ui** — the app deliberately switched on 2026-07-08
  (commit 12412cd); the package had kept Sitka. User confirmed "mirror the app" on
  2026-07-10, so tokens.css now ships the system-ui stack and `runtimeFontPrefixes` was
  REMOVED from config (no brand font to suppress — system fonts need no shipping, no
  [FONT_MISSING]). Do NOT reintroduce Sitka unless the app restores it first.
  (2) **Teal palette retune** — accent #1d6f64 → #0d9488 (+hover, +accent-50 #e6f7f5),
  warm-canvas neutrals (#f5f3ef/#fdfdfb), AA muted #708277 → #63746a, dark borders
  lightened. (3) **10px/6px radii** (were 8/4), **two-layer shadows** + new
  `--cockpit-shadow-md`, **pill buttons** (border-radius 999px, was --cockpit-radius),
  chip min-height 42px, 3px focus ring (was 2px). All 9 components render unchanged
  (source/DOM identical — it's a pure token/CSS reskin), so grades carried forward at
  zero cost; upload was styling + docs only.

## Re-sync risks

- **The source of truth is the app, not this package.** design-system/src mirrors
  assets/demo.css by hand; whenever the app's cockpit tokens or card idiom change
  (grep the app repo's recent commits for demo.css), the package must be updated by
  hand or it silently drifts. Nothing automated catches this.
- The self-referencing junction (above) and design-system/node_modules must exist
  before the converter runs; `npm install` + `mklink /J` on fresh clones.
- Rebuild the package first (`npm --prefix design-system run build` = cfg.buildCmd)
  whenever src/ changed; the converter reads dist/.
- A concurrent agent (DeepSeek) force-pushes this repo's main — verify the durable
  set (.design-sync/, design-system/) survived history rewrites before trusting a
  clean diff.
