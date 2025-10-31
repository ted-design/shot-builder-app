import React from "react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ShotSidebarSummary from "../ShotSidebarSummary";

const createProps = (overrides = {}) => ({
  status: "todo",
  onStatusChange: vi.fn(),
  statusDisabled: false,
  dateValue: "",
  locationLabel: "",
  tags: [],
  basicsStatus: null,
  logisticsStatus: null,
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ShotSidebarSummary", () => {
  it("renders the current status and allows updating it", () => {
    const onStatusChange = vi.fn();
    render(
      <ShotSidebarSummary
        {...createProps({ status: "in_progress", onStatusChange })}
      />
    );

    const statusBadge = screen.getByText("In progress", { selector: "span" });
    expect(statusBadge).toBeInTheDocument();

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "complete" } });
    expect(onStatusChange).toHaveBeenCalledWith("complete");
  });

  it("shows schedule, location, and tag fallbacks when data is missing", () => {
    render(<ShotSidebarSummary {...createProps()} />);

    expect(screen.getByText("No date scheduled")).toBeInTheDocument();
    expect(
      screen.getByText("Set a target date in Basics.")
    ).toBeInTheDocument();
    expect(screen.getByText("No location")).toBeInTheDocument();
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("surfaces tag details and autosave metadata for basics and logistics", () => {
    render(
      <ShotSidebarSummary
        {...createProps({
          status: "complete",
          dateValue: "TBD",
          locationLabel: "Studio A",
          tags: [
            { id: "tag-1", label: "Hero", color: "indigo" },
            { id: "tag-2", label: "Campaign", color: "emerald" },
          ],
          basicsStatus: { state: "pending" },
          logisticsStatus: { state: "error", message: "Network lost" },
        })}
      />
    );

    expect(screen.getByText("Hero")).toBeInTheDocument();
    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Network lost")).toBeInTheDocument();
    expect(screen.getByText("TBD")).toBeInTheDocument();
    expect(screen.getByText("Studio A")).toBeInTheDocument();
  });
});
