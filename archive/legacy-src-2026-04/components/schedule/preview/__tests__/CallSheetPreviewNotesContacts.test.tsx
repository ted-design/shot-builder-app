import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CallSheetData } from "../../types";
import type { CallSheetSection } from "../../../../types/callsheet";
import { CallSheetPreview } from "../CallSheetPreview";

function section(id: string, type: CallSheetSection["type"], order: number): CallSheetSection {
  return { id, type, isVisible: true, order, config: {} };
}

describe("CallSheetPreview (Notes/Contacts wiring)", () => {
  it("renders Notes/Contacts editor fields in the info grid", () => {
    const notesHtml = '<p>Click <a href="https://example.com/map">parking map</a>.</p>';
    const data: CallSheetData = {
      projectName: "Project",
      version: "",
      groupName: "Call Sheet",
      shootDay: "Shoot Day",
      date: "Monday, Jan 1, 2026",
      dayNumber: 1,
      totalDays: 1,
      crewCallTime: null,
      dayDetails: {
        crewCallTime: null,
        shootingCallTime: null,
        breakfastTime: null,
        firstMealTime: null,
        secondMealTime: null,
        estimatedWrap: null,
        keyPeople: "Producer A",
        setMedic: "Dr. Smith",
        scriptVersion: "3",
        scheduleVersion: "7",
        weather: null,
        notes: notesHtml,
      },
      locations: [
        { type: "Production Office", name: "123 Office St", address: "" },
        { type: "Nearest Hospital", name: "General Hospital", address: "" },
        { type: "Basecamp", name: "Camp A", address: "" },
        { type: "Parking", name: "Lot B", address: "Use gate 2" },
      ],
      notes: notesHtml,
      schedule: [],
      talent: [],
      crew: [],
    };

    const sections: CallSheetSection[] = [
      section("s-header", "header", 0),
      section("s-day-details", "day-details", 1),
    ];

    render(<CallSheetPreview data={data} sections={sections} zoom={100} />);

    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Producer A")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Production Office")).toBeInTheDocument();
    expect(screen.getByText("123 Office St")).toBeInTheDocument();
    expect(screen.getByText("Basecamp")).toBeInTheDocument();
    expect(screen.getByText("Camp A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "parking map" })).toHaveAttribute("href", "https://example.com/map");
  });
});
