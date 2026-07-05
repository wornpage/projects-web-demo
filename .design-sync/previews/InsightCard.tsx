import * as React from "react";
import { InsightCard, CockpitRoot } from "projects-cockpit";

export function Tones() {
  return (
    <CockpitRoot style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 12, padding: 12, maxWidth: 460 }}>
      <InsightCard value="19%" label="Completion" detail="7 of 37 work items done" tone="low" />
      <InsightCard value="12" label="Need review" detail="12 with blockers" tone="warn" />
      <InsightCard value="14" label="Active" detail="in progress" />
      <InsightCard value="0" label="Overdue" detail="nothing past due" tone="good" />
    </CockpitRoot>
  );
}
