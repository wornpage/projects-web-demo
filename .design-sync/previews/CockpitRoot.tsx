import * as React from "react";
import { CockpitRoot, Panel, StatePill } from "projects-cockpit";

export function LightSurface() {
  return (
    <CockpitRoot style={{ padding: 16 }}>
      <Panel label="Surface" heading="Cockpit root" status={<StatePill tone="success">Themed</StatePill>}>
        <p>Everything inside gets the cockpit background, Sitka serif stack, and dense 13px/1.4 rhythm.</p>
      </Panel>
    </CockpitRoot>
  );
}

export function DarkSurface() {
  return (
    <div data-theme="dark">
      <CockpitRoot style={{ padding: 16 }}>
        <Panel label="Surface" heading="Dark palette" status={<StatePill tone="success">Themed</StatePill>}>
          <p>Set data-theme=&quot;dark&quot; on any ancestor to switch the token palette.</p>
        </Panel>
      </CockpitRoot>
    </div>
  );
}
