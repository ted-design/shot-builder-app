import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EditorPanel from "../EditorPanel";

function EditorPanelHarness({ initialSettings = {} }) {
  const [scheduleSettings, setScheduleSettings] = useState({
    showDurations: true,
    cascadeChanges: true,
    ...initialSettings,
  });

  return (
    <EditorPanel
      activeSection={{ id: "section-schedule", type: "schedule", isVisible: true }}
      clientId="client"
      projectId="project"
      scheduleId="schedule"
      schedule={{ tracks: [] }}
      scheduleSettings={scheduleSettings}
      onToggleShowDurations={() =>
        setScheduleSettings((s) => ({ ...s, showDurations: !s.showDurations }))
      }
      onToggleCascade={() =>
        setScheduleSettings((s) => ({ ...s, cascadeChanges: !s.cascadeChanges }))
      }
      resolvedEntries={[]}
    />
  );
}

describe("EditorPanel - Schedule Section", () => {
  it("renders schedule settings checkboxes", () => {
    render(<EditorPanelHarness />);

    // The schedule section should show duration and cascade checkboxes
    const showDurations = screen.getByRole("checkbox", { name: /show durations/i });
    const cascadeChanges = screen.getByRole("checkbox", { name: /cascade changes/i });

    expect(showDurations).toBeInTheDocument();
    expect(cascadeChanges).toBeInTheDocument();
    expect(showDurations).toBeChecked();
    expect(cascadeChanges).toBeChecked();
  });

  it("toggles schedule settings checkboxes", () => {
    render(<EditorPanelHarness />);

    const showDurations = screen.getByRole("checkbox", { name: /show durations/i });
    const cascadeChanges = screen.getByRole("checkbox", { name: /cascade changes/i });

    // Both should start checked
    expect(showDurations).toBeChecked();
    expect(cascadeChanges).toBeChecked();

    // Toggle show durations
    fireEvent.click(showDurations);
    expect(showDurations).not.toBeChecked();

    // Toggle cascade changes
    fireEvent.click(cascadeChanges);
    expect(cascadeChanges).not.toBeChecked();

    // Toggle back
    fireEvent.click(showDurations);
    fireEvent.click(cascadeChanges);
    expect(showDurations).toBeChecked();
    expect(cascadeChanges).toBeChecked();
  });

  it("renders with initial settings unchecked", () => {
    render(
      <EditorPanelHarness initialSettings={{ showDurations: false, cascadeChanges: false }} />
    );

    const showDurations = screen.getByRole("checkbox", { name: /show durations/i });
    const cascadeChanges = screen.getByRole("checkbox", { name: /cascade changes/i });

    expect(showDurations).not.toBeChecked();
    expect(cascadeChanges).not.toBeChecked();
  });
});

