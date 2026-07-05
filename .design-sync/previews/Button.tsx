import * as React from "react";
import { Button, CockpitRoot } from "projects-cockpit";

export function Variants() {
  return (
    <CockpitRoot style={{ display: "flex", gap: 10, padding: 12, alignItems: "center" }}>
      <Button variant="primary">Review work</Button>
      <Button>Open work path</Button>
      <Button size="sm">Clear blocker</Button>
      <Button variant="primary" size="sm">Finish with proof</Button>
    </CockpitRoot>
  );
}

export function Disabled() {
  return (
    <CockpitRoot style={{ display: "flex", gap: 10, padding: 12, alignItems: "center" }}>
      <Button variant="primary" disabled>Save work</Button>
      <Button disabled>Reset sample</Button>
    </CockpitRoot>
  );
}
