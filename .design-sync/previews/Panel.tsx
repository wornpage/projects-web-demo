import * as React from "react";
import { Panel, CockpitRoot, FieldHelp } from "projects-cockpit";

export function Dashboard() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 520 }}>
      <Panel label="Dashboard" heading="37 work items loaded" status="12 need review">
        <p>
          Each card below is one piece of work with an owner, a blocker, a next
          action, and a proof it&rsquo;s done. Start with Review to see what needs a
          decision.
        </p>
      </Panel>
    </CockpitRoot>
  );
}

export function WithHelp() {
  return (
    <CockpitRoot style={{ padding: 12, maxWidth: 520 }}>
      <Panel label="Create" heading="New work" status="Saves in this browser">
        <p>Name the work, choose its first action, and save.</p>
        <FieldHelp>Title and Next action are required; everything else is optional.</FieldHelp>
      </Panel>
    </CockpitRoot>
  );
}
