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

describe("Planner view preferences", () => {
  const { readStoredPlannerView, readStoredVisibleFields } = __test;

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
  const { ShotCard } = __test;
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
