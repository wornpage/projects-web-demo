# Optional: package the demo as a single-file executable (Bun)

An alternative distribution alongside the Cloudflare deployment
(`docs/deploy-cloudflare.md`): one downloadable binary that serves the demo
locally and opens the browser. Useful as a "download and double-click"
portfolio artifact; nothing else in the repo depends on it.

## Build

Requires [Bun](https://bun.com) ≥ 1.3 on PATH **at package time only** (the
produced binary is self-contained; end users need nothing installed):

```powershell
node scripts/package-demo-bun.mjs
```

The script rebuilds `dist/static-publish/` (the protected artifact), embeds
every allowlisted file into a generated `Bun.serve` entry, and compiles it
with `bun build --compile --minify` to `dist/release/projects-demo.exe`
(~95 MB — the Bun runtime is bundled; that's the price of zero-install).

Cross-compile from any machine with `--target`:

```powershell
node scripts/package-demo-bun.mjs --target bun-linux-x64
node scripts/package-demo-bun.mjs --target bun-darwin-arm64
```

## Run

Launch the binary; it serves the demo on a random localhost port, prints the
URL, and opens the default browser (`--no-open` to suppress;
`PROJECTS_DEMO_PORT` to pin the port). Browser-local static mode only — no
backend, no network calls beyond localhost.

## Distribution caveats

- **GitHub Releases only, never the repo** — `dist/` is gitignored and the
  public-asset gates would reject a binary in the shipped tree.
- **Unsigned executable**: Windows SmartScreen / macOS Gatekeeper will warn
  on first run. Code-signing is the fix if this ever becomes a primary
  distribution channel; for a portfolio extra, the warning is acceptable —
  say so next to the download link.
- The embedded bundle is the same protected `assets/demo.js` the website
  ships — packaging leaks nothing the site doesn't.

## Why Bun here and nowhere else

Assessed 2026-07-11: porting the repo's runtime/toolchain to Bun was
rejected — the gates pin Node by design (`node --check`, `node --test`,
`check-docker-boundary.mjs` pins `FROM node:24-alpine` and
`CMD ["node", ...]`), and the deployed static site has no runtime at all.
`bun build --compile` is the one Bun capability Node lacks, so it is used
for exactly this optional artifact and nothing more.
