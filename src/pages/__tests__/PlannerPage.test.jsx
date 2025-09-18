import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../lib/firebase", () => ({
  db: {},
  storage: {},
}));

vi.mock("../../hooks/useStorageImage", () => ({
  useStorageImage: vi.fn(),
}));

const { __test } = await import("../PlannerPage.jsx");
const { useStorageImage } = await import("../../hooks/useStorageImage");

const {
  readStoredPlannerView,
  readStoredVisibleFields,
  ShotCard,
  groupShotsByLane,
  UNASSIGNED_LANE_ID,
} = __test;

describe("Planner view preferences", () => {

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to board view when nothing is stored", () => {
    expect(readStoredPlannerView()).toBe("board");
  });

  it("restores the stored list view selection", () => {
    window.localStorage.setItem("planner:viewMode", "list");
    expect(readStoredPlannerView()).toBe("list");
  });

  it("falls back to defaults when stored fields are invalid", () => {
    window.localStorage.setItem("planner:visibleFields", "not-json");
    const fields = readStoredVisibleFields();
    expect(fields).toEqual({
      notes: true,
      location: true,
      talent: true,
      products: true,
    });
  });
});

describe("ShotCard thumbnails", () => {
  const baseShot = {
    id: "shot-1",
    name: "Test Shot",
    type: "Beauty",
    date: "2025-01-01",
    laneId: "lane-1",
    description: "",
    talent: [],
  };

  const visibleFields = {
    notes: true,
    location: true,
    talent: true,
    products: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the resolved storage image when available", () => {
    vi.mocked(useStorageImage).mockReturnValue("https://cdn.test/image.jpg");

    render(
      <ShotCard
        shot={baseShot}
        products={[
          {
            familyId: "fam-1",
            familyName: "Family",
            colourName: "Blue",
            colourImagePath: "images/blue.jpg",
          },
        ]}
        viewMode="board"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
      />
    );

    const image = screen.getByAltText("Test Shot thumbnail");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://cdn.test/image.jpg");
  });

  it("shows a placeholder when no image can be resolved", () => {
    vi.mocked(useStorageImage).mockReturnValue(null);

    render(
      <ShotCard
        shot={baseShot}
        products={[
          {
            familyId: "fam-2",
            familyName: "Family",
            colourName: "Red",
            colourImagePath: "images/red.jpg",
          },
        ]}
        viewMode="list"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
      />
    );

    expect(screen.getByText(/no image/i)).toBeInTheDocument();
  });
});

describe("groupShotsByLane", () => {
  const ts = (seconds) => ({ seconds, nanoseconds: 0 });

  it("groups shots by lane and preserves stable ordering", () => {
    const grouped = groupShotsByLane([
      { id: "unassigned-late", laneId: null, name: "Later", createdAt: ts(200) },
      { id: "lane-a-second", laneId: "lane-a", order: 2, name: "Lane A Second" },
      { id: "lane-b-second", laneId: "lane-b", sortOrder: 5, date: "2024-04-01", name: "Lane B Second" },
      { id: "unassigned-early", laneId: null, name: "Earlier", createdAt: ts(100) },
      { id: "lane-a-first", laneId: "lane-a", order: 1, name: "Lane A First" },
      { id: "lane-b-first", laneId: "lane-b", sortOrder: 5, date: "2024-03-01", name: "Lane B First" },
    ]);

    expect(grouped[UNASSIGNED_LANE_ID].map((shot) => shot.id)).toEqual([
      "unassigned-early",
      "unassigned-late",
    ]);

    expect(grouped["lane-a"].map((shot) => shot.id)).toEqual([
      "lane-a-first",
      "lane-a-second",
    ]);

    expect(grouped["lane-b"].map((shot) => shot.id)).toEqual([
      "lane-b-first",
      "lane-b-second",
    ]);
  });
});
