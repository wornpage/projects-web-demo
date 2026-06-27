# North Star Audit

Overall status: Active, not complete.

This audit maps the North Star objective to current proof in this repository.
It is not a completion claim. A passing audit means the public demo has an
honest evidence map and the ship gate checks that map before live verification.

## Requirement Audit

| ID | Requirement | Evidence | Status | Next slice |
|---|---|---|---|---|
| portfolio-scope | Keep the public app portfolio-grade and focused on the small demo story. | `README.md`; `scripts/check-public-routes.mjs`; `scripts/check-risk-decisions.mjs` | Proven | Keep visible routes and copy tied to the public portfolio story. |
| public-surface | Keep the public frontend small, allowlisted, and intentionally scoped. | `scripts/check-public-assets.mjs`; `scripts/check-static-publish.mjs`; `scripts/check-static-preview.mjs`; `scripts/check-docker-boundary.mjs` | Proven | Keep size budgets and allowlists tight as features move. |
| private-value | Avoid giving away private repo files, private paths, server source, docs, source maps, or real project data. | `docs/public-exposure-audit.md`; `scripts/check-live-deploy.mjs`; `scripts/check-public-assets.mjs`; `scripts/check-docker-boundary.mjs` | Accepted demo tradeoff | Browser JavaScript remains visible by design; continue moving valuable behavior server-side when practical. |
| backend-boundaries | Move valuable or private behavior behind backend boundaries where practical. | `server/server.js`; `scripts/check-public-boundary.mjs`; `scripts/check-live-deploy.mjs`; `scripts/check-deploy-config.mjs` | Needs next slice | Continue reducing browser-owned static fallbacks that are still required for GitHub Pages, and keep hosted app-mode dispatch API-owned. |
| frontend-protection | Protect readable frontend output without treating obfuscation as real security. | `scripts/protect-frontend.mjs`; `scripts/check-protected-frontend.mjs`; `scripts/check-live-deploy.mjs`; `docs/public-exposure-audit.md` | Accepted demo tradeoff | Keep protection as a deterrent only; use backend boundaries for real secrecy. |
| data-separation | Keep anonymous browser and sync rows separated in local file mode and hosted Postgres. | `scripts/check-public-boundary.mjs`; `scripts/check-state-recovery.mjs`; `scripts/check-live-deploy.mjs`; `server/server.js` | Proven | Add authentication only before storing private or customer data. |
| recovery | Keep demo state recoverable and erasable without mixing users. | `scripts/check-state-recovery.mjs`; `scripts/check-live-deploy.mjs`; `README.md` | Proven | Keep recovery JSON bounded and versioned as state shape changes. |
| sync-sharing | Make two-device sync simple while documenting that it is shared demo state, not encrypted account storage. | `scripts/check-sync-surface.mjs`; `scripts/check-live-deploy.mjs`; `docs/deploy-outplane.md` | Accepted demo tradeoff | Keep copy-code, copy-link, QR, and leave-row flows simple; add auth or encryption before private use. |
| outplane-reproducible | Deploy reproducibly on Outplane with Docker, managed Postgres, defensive headers, and live app matching the checkout. | `Dockerfile`; `docs/deploy-outplane.md`; `scripts/check-deploy-config.mjs`; `scripts/check-live-deploy.mjs` | Proven | Keep the checked live URL, deploy docs, and Docker runtime aligned. |
| ship-gate | Require green local checks plus live Outplane verification before every ship. | `scripts/check-ship.mjs`; `scripts/check-git-ship-state.mjs`; `scripts/check-live-deploy.mjs`; `server/package.json` | Proven | Keep every new North Star invariant wired into `npm --prefix server run ship:check`. |

## Completion Rule

Do not mark the North Star goal complete from this audit alone. Completion
requires a fresh requirement-by-requirement review of this table, current source
files, local command output, hosted Outplane behavior, and any remaining
`Needs next slice` rows. Accepted demo tradeoffs must remain explicit and must
not be confused with account security, encryption, or private customer-data
handling.
