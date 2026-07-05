import * as React from "react";
import { Chip, CockpitRoot } from "projects-cockpit";

export function FilterRow() {
  return (
    <CockpitRoot style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>
      <Chip pressed count={37}>All</Chip>
      <Chip count={14}>Active</Chip>
      <Chip count={12}>Blocked</Chip>
      <Chip count={6}>Done</Chip>
    </CockpitRoot>
  );
}

export function ChoiceChips() {
  return (
    <CockpitRoot style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>
      <Chip pressed count="Selected">Venue hold calendar</Chip>
      <Chip count="Choose">Lighting checklist</Chip>
      <Chip count="Choose">Release flyer assets</Chip>
    </CockpitRoot>
  );
}
