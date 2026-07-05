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
- `--config` and `--entry` resolve relative to dirname(--node-modules) in some paths;
  run everything from the repo root and prefer explicit relative paths.
- Fonts: Sitka / Iowan Old Style / Palatino are OS-provided system fonts — nothing to
  ship; suppressed via `runtimeFontPrefixes`. Georgia is the shippable-free fallback.

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
