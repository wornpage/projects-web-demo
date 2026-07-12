---
name: Projects Web Demo
description: A blocker-first work tracker demo — dense, checkable, quietly warm.
colors:
  steady-teal: "#0d9488"
  teal-deep: "#0f766e"
  teal-wash: "#e6f7f5"
  selected-mint: "#d7efe7"
  selected-ink: "#082f2b"
  ink: "#21322b"
  ink-secondary: "#5b6a60"
  ink-muted: "#63746a"
  warm-canvas: "#f5f3ef"
  paper-surface: "#fdfdfb"
  nav-shade: "#efede7"
  hairline: "#e2ddd5"
  hairline-strong: "#d0cac1"
  success-text: "#134e4a"
  success-bg: "#ecfdf5"
  warning-text: "#9a3412"
  warning-bg: "#fff7ed"
  danger-text: "#991b1b"
  danger-bg: "#fef2f2"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 610
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 560
    lineHeight: 1.35
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  panel: "14px"
components:
  button-primary:
    backgroundColor: "{colors.steady-teal}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-primary-hover:
    backgroundColor: "{colors.teal-deep}"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.panel}"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
---

# Design System: Projects Web Demo

## 1. Overview

**Creative North Star: "The Honest Clipboard"**

A friendly clipboard on a workbench: dense, practical, and nothing decorative. Every screen answers the same three questions — Where, Blocker, Next action — and the visual system exists to make those answers scannable and checkable, never to perform. Warmth comes from the copy and forgiving flows (undo, recovery, actionable empty states), not from ornament; the surfaces stay quiet so the words can be friendly.

The system explicitly rejects generic AI/SaaS slop: no gradient text, no glassmorphism, no hero-metric cards, no identical icon-card grids, and no side-stripe accents (an asset gate enforces full borders). It also rejects marketing sheen on app surfaces — the landing page sells quietly; the app just works.

**Key Characteristics:**
- Dense where work happens (work list, insights, search); air where a visitor is orienting (welcome, empty states, terms).
- Everything is bordered: 1px hairlines define every surface; depth is a whisper, not a shadow.
- One accent, used for state: Steady Teal marks selection, primary actions, and success — never decoration.
- Three-theme token system (light, dark, forest) driven entirely by `--cockpit-*` custom properties; components never hardcode color.

## 2. Colors

A warm paper neutral field with a single working accent; every color is a `--cockpit-*` custom property and light values below are canonical (dark and forest themes remap the same tokens).

### Primary
- **Steady Teal** (#0d9488, `--cockpit-accent`): primary action buttons, the selected filter chip, focus rings, progress fills, and the "today" marker. It means "this is live or chosen," never "this is pretty." Hover deepens to **Teal Deep** (#0f766e); tinted moments use **Teal Wash** (#e6f7f5) and **Selected Mint** (#d7efe7) with **Selected Ink** (#082f2b) text.
- **Link** (`--cockpit-link`, Teal Deep in light): the text-role accent for link-ish hovers and status text on plain surfaces. Fill roles (`--cockpit-accent-hover`) and text roles never share a token — dark themes need a deep fill under white labels but a pale tone as standalone text.

### Neutral
- **Warm Canvas** (#f5f3ef, `--cockpit-bg`): the page field.
- **Paper Surface** (#fdfdfb, `--cockpit-surface`): panels, cards, inputs — anything that holds content.
- **Nav Shade** (#efede7, `--cockpit-nav-bg`): the sidebar/bottom-bar layer, one step darker than canvas.
- **Ink** (#21322b), **Ink Secondary** (#5b6a60), **Ink Muted** (#63746a): three text levels. Muted is tuned to hold APCA |Lc| ≥ 60 on canvas, surface, and Nav Shade — do not lighten it.
- **Hairline** (#e2ddd5) and **Hairline Strong** (#d0cac1): every border in the system.

### Tertiary
- Status tints pair a deep text tone with a pale wash: success (#134e4a on #ecfdf5), warning (#9a3412 on #fff7ed), danger (#991b1b on #fef2f2). Used for state pills, toasts, and blocked/done card accents only.

### Named Rules
**The One Accent Rule.** Steady Teal is the only saturated voice on any screen and it always signals state (selected, primary, in-progress). If teal appears somewhere a click or a status isn't, it's wrong.

**The Contrast Floor Rule.** Body-size text never drops below APCA |Lc| 60 against its actual background, and primary ink targets Lc 75+ (`scripts/check-contrast-apca.mjs` enforces the floors for every theme and every real token pairing in CI). Muted gray "for elegance" is prohibited; #63746a (Lc 63.6 on Nav Shade, the worst pairing) is the floor on light surfaces. APCA replaced the old 4.5:1 rule because WCAG 2 ratios overrate light-on-dark pairs — the switch exposed failing muted text in all four dark themes that 4.5:1 had waved through.

## 3. Typography

**Display Font:** system-ui (with Segoe UI / Roboto / Helvetica fallbacks)
**Body Font:** same single family
**Label/Mono Font:** ui-monospace (Consolas fallback) — recovery/state payload textareas only

**Character:** One quiet system family at several weights. The hierarchy is carried by weight (400 → 560 → 610 → 660) and size steps, not by font changes; nothing about the type asks for attention.

### Hierarchy
- **Display** (600, 20px, 1.25): panel headings ("37 visible", "Terms & Privacy"). Drops to 18px under 480px.
- **Title** (610, 16px, 1.3): card titles and section h3s.
- **Body** (400–450, 13–15px, 1.45): facts, help copy, form fields. Dense data surfaces run 13px.
- **Label** (560–660, 11px, 0.02em, UPPERCASE): section labels ("WORK ITEMS", "WHERE", "BLOCKER"), meta rows, insight-card captions. Always in a muted or secondary ink.

### Named Rules
**The Weight-Not-Width Rule.** Emphasis is a weight step, never letterspacing tricks, italics, or a second family. The uppercase 11px label is the one sanctioned deviation and it always pairs with muted ink.

## 4. Elevation

Flat by default, defined by borders. Every surface carries a 1px Hairline border; shadows are near-subliminal ambience (`--cockpit-shadow-sm`: 0 1px 2px + 0 1px 4px at 4–6% alpha) and grow only one step on hover (`shadow-md`). Depth is communicated by layer color (Canvas → Nav Shade → Paper Surface), not by float. Dialogs and toasts are the only elements allowed a visible lift.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06)`): resting panels and cards.
- **Hover** (`box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)`): interactive containers under the pointer, always with a Hairline→Strong border shift.

### Named Rules
**The Full Border Rule.** Accents are full 1px borders or background tints — never a thick colored `border-left`/`border-right` stripe. This is enforced by `scripts/check-public-assets.mjs`; a side-stripe will fail CI.

## 5. Components

Quiet and sturdy: things look like what they do, full borders, flat at rest, and every control is bound to a real effect (a CI smoke test clicks them all).

### Buttons
- **Shape:** pill (999px radius), inline-flex, 13px/560, 6px 14px padding.
- **Primary:** Steady Teal fill, white text; hover deepens to Teal Deep; active presses down 1px with an inset shadow.
- **Secondary (default `.btn`):** Paper Surface fill, Ink Secondary text, Hairline border; hover tints with hover-bg and strengthens the border.
- **Small (`.btn-sm`):** same anatomy, tighter padding; used in card action rows.

### Chips
- **Style:** transparent pill, Hairline border, 13px/560 Ink Secondary; count badges inline.
- **State:** `aria-pressed="true"` fills with Selected Mint and Selected Ink. Filter chips (status, energy) are real buttons, never spans.

### Cards / Containers
- **Corner Style:** 10px radius (`--cockpit-radius`).
- **Background:** Paper Surface on Warm Canvas.
- **Shadow Strategy:** Ambient at rest, Hover on pointer-over (see Elevation).
- **Border:** 1px Hairline always; workflow state may tint it (danger/success) but never thickens one side.
- **Internal Padding:** 14px (10px under 480px).

### Inputs / Fields
- **Style:** Paper Surface fill, 1px Hairline, 10px radius, 8px 14px padding, 15px text (16px under 560px to prevent iOS focus-zoom).
- **Focus:** border flips to Steady Teal plus a 3px focus ring (`--demo-focus-ring`), offset 2px. Never remove it.
- **Error:** danger border on blocked copy surfaces.

### Navigation
- Desktop: a 200px left sidebar on Nav Shade, collapsible to 52px; items are icon + 14px label, selected item carries the teal treatment. Mobile: the same routes as a bottom bar with safe-area padding; every destination must remain reachable without horizontal scroll (smoke-tested).

### Empty States (signature)
A dashed Hairline box, centered: bold one-line fact, a "How to fill" sentence, the Where/Blocker/Next triad in small muted text, and one real action button (`.demo-empty-action`). Empty states teach the mental model and always offer the way out.

## 6. Do's and Don'ts

### Do:
- **Do** express every color through `--cockpit-*` tokens so light/dark/forest themes stay in lockstep; new UI hardcoding hex will look broken in two of three themes.
- **Do** give every interactive element `aria-pressed`/`aria-label` state and a visible 3px focus ring — the routes gate and smoke test check for it.
- **Do** keep working screens dense (13px data type, 8–12px gaps) and give orientation screens room to breathe.
- **Do** ship an action button inside every empty state; copy that says "clear the filter" must sit next to a button that does it.
- **Do** run the full gate sweep plus `node scripts/check-behavior-smoke.mjs` before shipping any UI change.

### Don't:
- **Don't** use side-stripe borders (`border-left` > 1px as accent) — CI fails them; use full borders or background tints ("The Full Border Rule").
- **Don't** reach for generic AI/SaaS slop: gradient text, glassmorphism, hero-metric cards, identical icon-card grids — PRODUCT.md names these as anti-references.
- **Don't** put muted gray below APCA |Lc| 60 on any body-size text; #63746a is the light-theme floor, and the contrast gate fails CI on any theme that dips ("The Contrast Floor Rule").
- **Don't** use Steady Teal decoratively; if it isn't marking selection, a primary action, or live progress, use a neutral.
- **Don't** add inline `onclick`/`style` attributes — the hosted CSP blocks them; use bound listeners and constructed stylesheets.
- **Don't** render a control without binding it; a button with no observable effect fails the behavior smoke.
