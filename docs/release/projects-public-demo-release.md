# Projects Public Demo Release Draft

Date: 2026-06-27
Commit: `047263c`
Live app: https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app/
Screenshot: `docs/release/projects-public-demo-review.png`

## Release Summary

Projects public demo is complete for its current public portfolio scope.

The demo now presents a deliberately small workflow surface: Start, Review,
Work, Next Action, Memory, and Create, with internal-looking routes kept out of
the public navigation. The Review screen shows the core loop clearly: choose
work, see the blocker, inspect the work path, use relevant memory, and run the
next action.

The completed audit keeps the public-demo boundary explicit. This is demo-data
software with anonymous state rows, not account-grade private storage,
authentication, encryption, or customer-data handling.

## Evidence

- Full local plus live ship gate passed with `npm --prefix server run ship:check`.
- Live Outplane verification passed against the protected current frontend.
- Compliance audit now has no remaining `Needs next slice` rows.
- Backend-boundary evidence is proven by named endpoints, typed browser-row
  envelopes, server-owned command previews, and local-only transient UI.
- Public surface remains compact, allowlisted, and portfolio-facing.

## GitHub Release Body Draft

### Projects Public Demo: complete public-demo scope

This release completes the Projects public demo for its current portfolio scope.

Highlights:

- Small public route set: Start, Review, Work, Next Action, Memory, Create.
- Review-first workflow that shows where work is, what blocks it, and what the
  next button will run.
- Relevant memory and work-path context surfaced directly in the action flow.
- Hosted backend boundaries proven through named state/workflow endpoints,
  typed browser-row saves, server-owned command previews, and local-only
  transient UI.
- Public release boundary documented: demo data only, no login, no private
  project data, and no claim of account-grade storage or encryption.

Verification:

- `npm --prefix server run ship:check`
- Live Outplane app shell, protected JS, CSS, and seed data matched this
  checkout.
- Non-public files and retired public assets were blocked by live verification.

Live demo: https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app/

## LinkedIn Draft

I finished a public portfolio demo pass for Projects.

The goal was deliberately small: make the demo explain the product idea without
requiring project history or exposing internal cockpit surfaces.

The current demo is review-first:

- Pick work.
- See the blocker.
- See the path and relevant memory.
- Run the next action.

The important part is the boundary. This is public demo data, not account-grade
private storage. The app says that directly, and the checks enforce it.

Under the hood, the hosted version now has a tighter split between browser UI
and backend-owned state: named endpoints for workflow/state changes, typed
browser-row saves, server-owned command previews, and local-only transient UI
for search and receipts.

The full ship gate passed, including live Outplane verification that the served
app shell, protected JS, CSS, seed data, blocked files, and API boundaries match
the checkout.

Live demo:
https://projectswebdemo7ojp-5179-sgscv2kjey.outplane.app/

Screenshot prepared:
`docs/release/projects-public-demo-review.png`

## Publish Checklist

- [x] App screenshot captured from the live app.
- [x] Screenshot visually checked for public safety.
- [x] Full ship gate passed.
- [x] Live app verified against the checkout.
- [ ] Create GitHub release or tag, if desired.
- [ ] Publish LinkedIn post, if desired.
