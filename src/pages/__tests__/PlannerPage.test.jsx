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
  stripHtml,
  normaliseShotTalent,
  buildPlannerExportLanes,
  calculateLaneSummaries,
  calculateTalentSummaries,
  TALENT_UNASSIGNED_ID,
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

describe("Planner export helpers", () => {
  it("strips markup while preserving breaks", () => {
    const input = "<p>Hello<br/>world</p><ul><li>First</li><li>Second</li></ul>";
    expect(stripHtml(input)).toBe("Hello\nworld\n• First\n• Second");
  });

  it("normalises talent data without duplicates", () => {
    const shot = {
      talent: [
        { talentId: "tal-1", name: "Alex" },
        { talentId: "tal-1", name: "Alex" },
        "Guest",
      ],
      talentIds: ["tal-2"],
      talentNames: ["Guest"],
    };
    expect(normaliseShotTalent(shot)).toEqual([
      { id: "tal-1", name: "Alex" },
      { id: "Guest", name: "Guest" },
      { id: "tal-2", name: "tal-2" },
    ]);
  });

  it("prepares lanes, totals, and talent summaries for export", () => {
    const shotsByLane = {
      [UNASSIGNED_LANE_ID]: [
        {
          id: "shot-unassigned",
          name: "Loose shot",
          description: "<p>Unassigned</p>",
          products: [],
        },
      ],
      "lane-a": [
        {
          id: "shot-a1",
          name: "Shot A1",
          type: "Beauty",
          date: "2025-02-01",
          locationName: "Studio",
          description: "<p>Line 1<br/>Line 2</p>",
          talent: [{ talentId: "tal-1", name: "Alex" }],
          products: [
            { familyName: "Dress", colourName: "Blue" },
          ],
        },
        {
          id: "shot-a2",
          name: "Shot A2",
          type: "Editorial",
          date: "2025-02-02",
          description: "<p>Hello<br/>World</p>",
          talent: [{ name: "Jamie" }],
          talentIds: ["tal-extra"],
          products: [],
        },
      ],
      "lane-b": [
        {
          id: "shot-b1",
          name: "Shot B1",
          description: "<div>Something</div>",
          talent: ["Jamie"],
          products: [],
        },
      ],
    };

    const lanes = [
      { id: "lane-a", name: "Lane A" },
      { id: "lane-b", name: "Lane B" },
    ];

    const lanesForExport = buildPlannerExportLanes(shotsByLane, lanes, (shot) => shot.products);

    expect(lanesForExport).toHaveLength(3);
    expect(lanesForExport[0]).toMatchObject({ id: UNASSIGNED_LANE_ID, name: "Unassigned" });
    expect(lanesForExport[1]).toMatchObject({ id: "lane-a", name: "Lane A" });
    expect(lanesForExport[1].shots[0]).toMatchObject({
      name: "Shot A1",
      type: "Beauty",
      date: "2025-02-01",
      location: "Studio",
      talent: ["Alex"],
      products: ["Dress – Blue"],
      notes: "Line 1\nLine 2",
    });
    expect(lanesForExport[1].shots[1].talent).toEqual(["Jamie", "tal-extra"]);

    const laneSummary = calculateLaneSummaries(lanesForExport);
    expect(laneSummary.totalShots).toBe(4);
    expect(laneSummary.lanes).toEqual([
      { id: UNASSIGNED_LANE_ID, name: "Unassigned", shotCount: 1 },
      { id: "lane-a", name: "Lane A", shotCount: 2 },
      { id: "lane-b", name: "Lane B", shotCount: 1 },
    ]);

    const talentSummary = calculateTalentSummaries(lanesForExport);
    const byId = Object.fromEntries(talentSummary.rows.map((row) => [row.id, row]));
    expect(byId[TALENT_UNASSIGNED_ID]).toMatchObject({
      total: 1,
      byLane: {
        [UNASSIGNED_LANE_ID]: 1,
        "lane-a": 0,
        "lane-b": 0,
      },
    });
    expect(byId["Alex"]).toMatchObject({ total: 1, byLane: { "lane-a": 1 } });
    expect(byId["Jamie"]).toMatchObject({ total: 2, byLane: { "lane-a": 1, "lane-b": 1 } });
    expect(byId["tal-extra"]).toMatchObject({ total: 1, byLane: { "lane-a": 1 } });
  });
});
