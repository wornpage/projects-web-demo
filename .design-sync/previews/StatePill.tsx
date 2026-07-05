import * as React from "react";
import { StatePill, CockpitRoot } from "projects-cockpit";

export function Tones() {
  return (
    <CockpitRoot style={{ display: "flex", gap: 10, padding: 12, alignItems: "center", flexWrap: "wrap" }}>
      <StatePill>Ready</StatePill>
      <StatePill tone="warn">Blocked</StatePill>
      <StatePill tone="warn">Needs next action</StatePill>
      <StatePill tone="success">Done</StatePill>
      <StatePill tone="danger">Overdue</StatePill>
      <StatePill tone="muted">Draft</StatePill>
    </CockpitRoot>
  );
}
