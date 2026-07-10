# Product

## Register

product

## Users

- **Portfolio visitors** — recruiters and fellow engineers poking around a live demo to judge craft. They arrive cold, click around for a few minutes, and should never hit a dead control or an unexplained screen.
- **The owner** — demos the app in conversations and uses it as a proving ground for engineering practices (ship gates, behavior smoke tests, static/hosted parity).
- **Automated agents** — more than one AI agent commits here; the design system and checks must survive batch edits by contributors who did not read the room.

## Product Purpose

A self-contained demonstration of a blocker-first work tracker: every work item carries an owner, a blocker, and a next action, and the UI keeps asking "what is the next physical action?" It runs in two modes — a static GitHub Pages build and an optional Node backend — with one behavior across both. Success is a visitor who can explore every screen, verify the claims the dashboard makes (the "Built-to-be-checked" panel), and leave believing the engineering.

## Brand Personality

Warm and approachable. Friendly, plain-language copy that explains rather than gates; forgiving flows (undo, recovery snapshots, confirmations that teach); whitespace and breathing room where a visitor is orienting. Warmth is carried by words and forgiving behavior — not by decoration. Working screens (work list, search, insights) stay information-dense; orientation screens (welcome, empty states, terms) get the air.

## Anti-references

Generic AI/SaaS slop. Specifically: no gradient text, no glassmorphism, no hero-metric template, no identical icon-card grids, no side-stripe borders (full borders only — this one is enforced by an asset gate). No marketing sheen on an app surface; the landing page sells quietly, the app just works.

## Design Principles

1. **Built to be checked.** Any claim the UI makes should be verifiable in the UI (receipts, honest "what this demo doesn't prove" copy). Never fake a state.
2. **Warmth through words, not decoration.** Empty states, errors, and first-run moments talk like a helpful colleague. Visual style stays quiet.
3. **Density where work happens, air where orientation happens.** Work list and insights are dense; welcome, empty, and error states breathe.
4. **Every control does something.** A rendered button, chip, or checkbox is bound and produces an observable effect — enforced by the behavior smoke gate.
5. **Both modes, one behavior.** Static and hosted modes render the same states the same way; new fields reach server sanitizers the same day they reach the client.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Existing commitments to preserve: `aria-pressed` on all toggles, `aria-live` status regions, keyboard roving tabindex on work lists, label/`for` wiring on inputs, honest focus outlines (3px ring), light/dark via both `prefers-color-scheme` and a manual toggle. Respect `prefers-reduced-motion` for any animation added.
