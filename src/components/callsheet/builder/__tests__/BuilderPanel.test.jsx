import { describe, it, expect } from "vitest";
import React, { useCallback, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BuilderPanel from "../BuilderPanel";

function Harness() {
  const [activeSectionId, setActiveSectionId] = useState("section-schedule");
  const [sections, setSections] = useState([
    {
      id: "section-schedule",
      type: "schedule",
      isVisible: true,
      order: 0,
      config: { viewMode: "parallel" },
    },
  ]);

  const handleUpdateSectionConfig = useCallback((sectionId, updates) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return { ...section, config: { ...(section.config || {}), ...(updates || {}) } };
      })
    );
  }, []);

  return (
    <div style={{ height: 900 }}>
      <BuilderPanel
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={setActiveSectionId}
        onReorderSections={() => {}}
        onToggleSection={() => {}}
        onAddSection={() => {}}
        onDeleteSection={() => {}}
        clientId="client"
        projectId="project"
        scheduleId="schedule"
        scheduleEditor={<div>EDITOR</div>}
        generalCrewCallTime=""
        onUpdateSectionConfig={handleUpdateSectionConfig}
        config={{
          id: "callSheetConfig",
          scheduleId: "schedule",
          projectId: "project",
          headerLayout: "classic",
          headerElements: [],
          sections,
          pageSize: "auto",
          spacing: "normal",
          timeFormat: "12h",
          temperatureFormat: "fahrenheit",
          showFooterLogo: false,
          colors: { primary: "#000", accent: "#000", text: "#000", background: "#fff" },
        }}
        onUpdateConfig={() => {}}
      />
    </div>
  );
}

describe("BuilderPanel", () => {
  it("toggles schedule view mode buttons", () => {
    render(<Harness />);

    const parallel = screen.getByRole("button", { name: "Parallel" });
    const stacked = screen.getByRole("button", { name: "Stacked" });

    // Active tab uses border-blue-600, inactive uses border-transparent
    expect(parallel).toHaveClass("border-blue-600");
    expect(stacked).toHaveClass("border-transparent");

    fireEvent.click(stacked);
    expect(stacked).toHaveClass("border-blue-600");
    expect(parallel).toHaveClass("border-transparent");

    fireEvent.click(parallel);
    expect(parallel).toHaveClass("border-blue-600");
    expect(stacked).toHaveClass("border-transparent");
  });
});

