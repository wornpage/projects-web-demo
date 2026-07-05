import * as React from "react";
import { Triad, CockpitRoot } from "projects-cockpit";

export function Blocked() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 520 }}>
      <Triad where="Venue hold calendar" blocker="waiting on venue confirmation email" next="Review blocker" />
    </CockpitRoot>
  );
}

export function Clear() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 520 }}>
      <Triad where="Lighting checklist" blocker="None" next="Finish with proof" />
    </CockpitRoot>
  );
}
