import * as React from "react";
import { WorkCard, Triad, CockpitRoot } from "projects-cockpit";

export function Blocked() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 440 }}>
      <WorkCard
        title="Release flyer assets"
        state="attention"
        stateLabel="Blocked"
        nextAction="Review blocker"
        owner="Print shop"
        due="Due Jun 18, 2026"
      >
        <Triad where="Release flyer assets" blocker="waiting on Source folder audit" next="Review blocker" />
      </WorkCard>
    </CockpitRoot>
  );
}

export function Ready() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 440 }}>
      <WorkCard
        title="Lighting checklist"
        state="ready"
        stateLabel="Ready"
        nextAction="Finish with proof"
        owner="Venue lead"
        due="Due Jun 12, 2026"
      >
        <Triad where="Lighting checklist" blocker="None" next="Finish with proof" />
      </WorkCard>
    </CockpitRoot>
  );
}

export function Done() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 440 }}>
      <WorkCard
        title="Recording export"
        state="done"
        stateLabel="Done"
        owner="Audio desk"
      />
    </CockpitRoot>
  );
}
