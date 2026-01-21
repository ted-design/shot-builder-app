import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EditorPanel from "../EditorPanel";

function EditorPanelHarness({ initialSettings = {} }) {
  const [scheduleSettings, setScheduleSettings] = useState({
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

    // The schedule section should show cascade checkbox
    const cascadeChanges = screen.getByRole("checkbox", { name: /ripple downstream/i });

    expect(cascadeChanges).toBeInTheDocument();
    expect(cascadeChanges).toBeChecked();
  });

  it("toggles cascade changes checkbox", () => {
    render(<EditorPanelHarness />);

    const cascadeChanges = screen.getByRole("checkbox", { name: /ripple downstream/i });

    // Should start checked
    expect(cascadeChanges).toBeChecked();

    // Toggle cascade changes
    fireEvent.click(cascadeChanges);
    expect(cascadeChanges).not.toBeChecked();

    // Toggle back
    fireEvent.click(cascadeChanges);
    expect(cascadeChanges).toBeChecked();
  });

  it("renders with initial settings unchecked", () => {
    render(
      <EditorPanelHarness initialSettings={{ cascadeChanges: false }} />
    );

    const cascadeChanges = screen.getByRole("checkbox", { name: /ripple downstream/i });

    expect(cascadeChanges).not.toBeChecked();
  });
});
