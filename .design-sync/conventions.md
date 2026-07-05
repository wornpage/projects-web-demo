# Projects Cockpit — build conventions

**Wrap every screen in `CockpitRoot`.** It applies the cockpit background, the Sitka
serif stack, and the dense 13px/1.4 body rhythm; outside it, text falls back to
browser defaults and token-driven colors still resolve but the surface reads wrong.
Dark mode: set `data-theme="dark"` on any ancestor (CockpitRoot included) — the full
token palette switches.

**Styling idiom: tokens + component props, no invented classes.** All colors, radii,
and type come from `var(--cockpit-*)` custom properties defined in `tokens/tokens.css`
(reachable via `styles.css`). The ones you'll actually use for layout glue:
`--cockpit-bg`, `--cockpit-surface`, `--cockpit-border`, `--cockpit-border-strong`,
`--cockpit-text`, `--cockpit-text-secondary`, `--cockpit-text-muted`,
`--cockpit-accent`, `--cockpit-accent-50`, `--cockpit-selected-bg`,
`--cockpit-warning-border`, `--cockpit-warning-text`, `--cockpit-success-border`,
`--cockpit-danger-border`, `--cockpit-radius` (8px), `--cockpit-radius-sm` (4px),
`--cockpit-shadow-sm`, `--font-family`, `--font-family-display`.

Hard rules of this design language:
- **Full 1px borders only — never a thick colored left-edge stripe.** State is carried
  by the full border color (warning = blocked/attention) and by `StatePill` text, not
  by side-stripes.
- **The warning color, not the accent, marks attention.** The accent marks the primary
  action and selection.
- **Finished work recedes** (WorkCard `state="done"` renders at reduced opacity).
- Dense spacing: 13–14px UI text, 12–14px paddings, 1.4 line-height. Don't air it out.

**Where the truth lives.** Read `styles.css` → `tokens/tokens.css` and
`_ds_bundle.css` for the full class/token vocabulary; each
`components/general/<Name>/<Name>.prompt.md` documents that component's API.

**Idiomatic composition:**

```tsx
<CockpitRoot>
  <Panel label="Review" heading="12 work items need a decision" status="2 owner gaps">
    <WorkCard
      title="Release flyer assets"
      state="attention" stateLabel="Blocked"
      nextAction="Review blocker" owner="Print shop" due="Due Jun 18"
    >
      <Triad where="Release flyer assets" blocker="waiting on Source folder audit" next="Review blocker" />
    </WorkCard>
  </Panel>
</CockpitRoot>
```

The `Triad` (Where › Blocker › Next action) is the signature element — use it wherever
a piece of work's situation needs to read at a glance, and let its Next-action column
keep the accent.

*Provenance note: these components are faithful React reimplementations of the
Projects demo app's vanilla-JS UI (the app itself is the visual source of truth), built
for this design system by agreement with its owner.*
