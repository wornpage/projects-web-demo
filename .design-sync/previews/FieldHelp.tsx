import * as React from "react";
import { FieldHelp, CockpitRoot } from "projects-cockpit";

export function UnderControl() {
  return (
    <CockpitRoot style={{ display: "grid", gap: 6, padding: 12, maxWidth: 380 }}>
      <label style={{ fontSize: 13, fontWeight: 590 }}>Owner (optional)</label>
      <input
        style={{ font: "inherit", padding: "6px 10px", border: "1px solid var(--cockpit-border)", borderRadius: "var(--cockpit-radius-sm)", background: "var(--cockpit-surface)", color: "var(--cockpit-text)" }}
        defaultValue="Venue lead"
      />
      <FieldHelp>Name the person, team, or role responsible for the next step.</FieldHelp>
    </CockpitRoot>
  );
}
