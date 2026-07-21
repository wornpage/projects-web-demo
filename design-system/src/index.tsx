import * as React from "react";

/**
 * Root surface wrapper. Applies the cockpit background, the system-ui type
 * stack, and dense 13px/1.4 body rhythm. Wrap screens in this (or put the classes
 * on body) so text and tokens resolve; set data-theme="dark" on a parent
 * for the dark palette.
 */
export interface CockpitRootProps {
  children?: React.ReactNode;
  /** Extra classes merged onto the root. */
  className?: string;
  style?: React.CSSProperties;
}
export function CockpitRoot({ children, className, style }: CockpitRootProps) {
  return (
    <div className={cx("cockpit-root", className)} style={style}>
      {children}
    </div>
  );
}

/**
 * Button in the cockpit idiom: full 1px border, 8px radius, quiet secondary
 * text by default; the primary variant fills with the accent. Dense — 13px
 * text, 6/14 padding.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. "primary" is the one main action on a surface. */
  variant?: "default" | "primary";
  /** Compact size for card-level and toolbar actions. */
  size?: "md" | "sm";
  children?: React.ReactNode;
}
export function Button({ variant = "default", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx("cockpit-btn", variant === "primary" && "cockpit-btn--primary", size === "sm" && "cockpit-btn--sm", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Workflow-state label. Tone carries the meaning: warn = blocked or needs
 * attention (the cockpit uses the warning color, not the accent, for
 * attention), success = done with proof, muted = draft/inactive.
 */
export interface StatePillProps {
  /** State color. */
  tone?: "accent" | "warn" | "danger" | "success" | "muted";
  children?: React.ReactNode;
  title?: string;
}
export function StatePill({ tone = "accent", children, title }: StatePillProps) {
  return (
    <span className={cx("cockpit-pill", tone !== "accent" && `cockpit-pill--${tone}`)} title={title}>
      {children}
    </span>
  );
}

/**
 * Toggle chip for filters and choices. Pressed state uses aria-pressed and
 * fills with the selected tint. Optional count/label renders muted on the
 * right.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected state (renders the selected tint + accent border). */
  pressed?: boolean;
  /** Small muted suffix, e.g. a count. */
  count?: React.ReactNode;
  children?: React.ReactNode;
}
export function Chip({ pressed = false, count, className, children, ...rest }: ChipProps) {
  return (
    <button type="button" className={cx("cockpit-chip", className)} aria-pressed={pressed} {...rest}>
      {children}
      {count != null ? <span className="cockpit-chip-count">{count}</span> : null}
    </button>
  );
}

/**
 * Content panel: surface background, full 1px border, 14px padding. The head
 * pairs an uppercase micro section-label with a display heading and an
 * optional right-aligned muted status.
 */
export interface PanelProps {
  /** Uppercase micro-label above the heading, e.g. "Dashboard". */
  label?: React.ReactNode;
  /** Display heading. */
  heading?: React.ReactNode;
  /** Muted status text on the right of the head. */
  status?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}
export function Panel({ label, heading, status, children, className }: PanelProps) {
  return (
    <section className={cx("cockpit-panel", className)}>
      {(label || heading || status) ? (
        <div className="cockpit-panel-head">
          <div>
            {label ? <span className="cockpit-section-label">{label}</span> : null}
            {heading ? <h2>{heading}</h2> : null}
          </div>
          {status ? <span className="cockpit-panel-status">{status}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * The signature Where › Blocker › Next-action flow strip. Three labeled
 * columns joined by chevrons; the Next-action column carries the accent tint
 * because it is the point of the triad. Stacks to rows under 560px.
 */
export interface TriadProps {
  /** Which piece of work this is about. */
  where: React.ReactNode;
  /** What is in the way ("None" when clear). */
  blocker: React.ReactNode;
  /** The one next action to take. */
  next: React.ReactNode;
}
export function Triad({ where, blocker, next }: TriadProps) {
  return (
    <div className="cockpit-triad">
      <div className="cockpit-triad-fact"><span>Where</span><strong>{where}</strong></div>
      <div className="cockpit-triad-fact"><span>Blocker</span><strong>{blocker}</strong></div>
      <div className="cockpit-triad-fact"><span>Next action</span><strong>{next}</strong></div>
    </div>
  );
}

/**
 * One work item: title + state pill head, an optional Triad, a Next-action
 * command row with its button, and muted meta (owner, due). State shows as a
 * full border color — attention work gets the warning border, finished work
 * recedes at 72% opacity until hovered. Never a colored side-stripe.
 */
export interface WorkCardProps {
  title: React.ReactNode;
  /** Card state: attention = blocked/needs-action (warning border), done recedes. */
  state?: "ready" | "attention" | "done";
  /** Pill text shown next to the title, e.g. "Blocked", "Done". */
  stateLabel?: React.ReactNode;
  /** Pill tone; defaults to match state (warn for attention, success for done). */
  stateTone?: StatePillProps["tone"];
  /** The next-action command label, e.g. "Review blocker". */
  nextAction?: React.ReactNode;
  /** Called when the next-action button is pressed. */
  onNextAction?: () => void;
  /** Owner name shown in the meta row. */
  owner?: React.ReactNode;
  /** Due text shown in the meta row, e.g. "Due Jun 18". */
  due?: React.ReactNode;
  /** Extra content (e.g. a Triad) rendered between head and command row. */
  children?: React.ReactNode;
  onTitleClick?: () => void;
}
export function WorkCard({ title, state = "ready", stateLabel, stateTone, nextAction, onNextAction, owner, due, children, onTitleClick }: WorkCardProps) {
  const tone = stateTone ?? (state === "attention" ? "warn" : state === "done" ? "success" : "accent");
  return (
    <article className={cx("cockpit-card", state === "attention" && "cockpit-card--attention", state === "done" && "cockpit-card--done")}>
      <div className="cockpit-card-head">
        <button type="button" className="cockpit-card-title" onClick={onTitleClick}>{title}</button>
        {stateLabel ? <StatePill tone={tone}>{stateLabel}</StatePill> : null}
      </div>
      {children}
      {nextAction ? (
        <div className="cockpit-card-command">
          <div>
            <span>Next action</span>
            <strong>{nextAction}</strong>
          </div>
          <Button variant="primary" size="sm" onClick={onNextAction}>{nextAction}</Button>
        </div>
      ) : null}
      {(owner || due) ? (
        <div className="cockpit-card-meta">
          {due ? <span>{due}</span> : null}
          {owner ? <span>{owner}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Stat card: big display value, label, muted detail. Tone tints the
 * full border and the value — good/warn/low map to success/warning/danger
 * tokens.
 */
export interface InsightCardProps {
  /** The big number/value. */
  value: React.ReactNode;
  /** What the value measures. */
  label: React.ReactNode;
  /** Muted supporting detail. */
  detail?: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "low";
}
export function InsightCard({ value, label, detail, tone = "neutral" }: InsightCardProps) {
  return (
    <div className={cx("cockpit-insight", tone !== "neutral" && `cockpit-insight--${tone}`)}>
      <span className="cockpit-insight-value">{value}</span>
      <strong>{label}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

/**
 * Muted single-line guidance under a control. 12px, never wraps into a
 * paragraph — keep it to one sentence.
 */
export interface FieldHelpProps {
  children?: React.ReactNode;
  id?: string;
}
export function FieldHelp({ children, id }: FieldHelpProps) {
  return <p className="cockpit-field-help" id={id}>{children}</p>;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
