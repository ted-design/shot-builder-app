import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../lib/firebase", () => ({
  db: {},
  storage: {},
}));

const appImageMock = vi.fn();

vi.mock("../../components/common/AppImage", () => ({
  __esModule: true,
  default: (props) => {
    appImageMock(props);
    return (
      <div data-testid="app-image" data-alt={props.alt}>
        {props.children}
      </div>
    );
  },
}));

const { __test } = await import("../PlannerPage.jsx");

const {
  readStoredPlannerView,
  readStoredVisibleFields,
  readStoredPlannerPrefs,
  ShotCard,
  groupShotsByLane,
  UNASSIGNED_LANE_ID,
  stripHtml,
  normaliseShotTalent,
  buildPlannerExportLanes,
  calculateLaneSummaries,
  calculateTalentSummaries,
  TALENT_UNASSIGNED_ID,
  mergeShotSources,
  normaliseShotForPlanner,
  shouldShowLanePlaceholder,
} = __test;

describe("Planner view preferences", () => {

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to gallery view when nothing is stored", () => {
    expect(readStoredPlannerView()).toBe("gallery");
  });

  it("falls back to defaults when stored fields are invalid", () => {
    window.localStorage.setItem("planner:visibleFields", "not-json");
    const fields = readStoredVisibleFields();
    expect(fields).toEqual({
      status: true,
      image: true,
      name: true,
      type: true,
      date: true,
      notes: true,
      location: true,
      talent: true,
      products: true,
      tags: true,
    });
  });

  it("defaults to no grouping when no planner prefs are stored", () => {
    const prefs = readStoredPlannerPrefs();
    expect(prefs).toMatchObject({ groupBy: "none", sort: "order" });
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
    status: "todo",
  };

  const visibleFields = {
    status: true,
    image: true,
    name: true,
    type: true,
    date: true,
    notes: true,
    location: true,
    talent: true,
    products: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appImageMock.mockClear();
  });

  it("passes the expected image source to AppImage", () => {
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
        viewMode="gallery"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
      />
    );

    expect(appImageMock).toHaveBeenCalled();
    const call = appImageMock.mock.calls[0][0];
    expect(call.alt).toBe("Test Shot thumbnail");
    expect(call.src).toBe("images/blue.jpg");
  });

  it("shows a placeholder when no image can be resolved", () => {
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
        viewMode="table"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
      />
    );

    const call = appImageMock.mock.calls[0][0];
    expect(call.fallback).toBeTruthy();
    const { getByText } = render(<>{call.fallback}</>);
    expect(getByText(/no image/i)).toBeInTheDocument();
  });

  it("disables the status control when editing is not allowed", () => {
    render(
      <ShotCard
        shot={{ ...baseShot, status: "in_progress" }}
        products={[]}
        viewMode="gallery"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit={false}
      />
    );

    const statusSelect = screen.getByLabelText(/test shot status/i);
    expect(statusSelect).toBeDisabled();
    expect(statusSelect).toHaveValue("in_progress");
  });

  it("invokes the status change handler when a new value is selected", () => {
    const handleStatusChange = vi.fn();

    render(
      <ShotCard
        shot={baseShot}
        products={[]}
        viewMode="gallery"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
        onChangeStatus={handleStatusChange}
      />
    );

    const statusSelect = screen.getByLabelText(/test shot status/i);
    expect(statusSelect).not.toBeDisabled();

    fireEvent.change(statusSelect, { target: { value: "complete" } });

    expect(handleStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: "shot-1" }), "complete");
  });

  it("renders the shot number when available", () => {
    render(
      <ShotCard
        shot={{ ...baseShot, shotNumber: "2025-10-23 | Shot #2" }}
        products={[]}
        viewMode="gallery"
        visibleFields={visibleFields}
        onEdit={() => {}}
        canEdit
      />
    );

    expect(screen.getByText("2025-10-23 | Shot #2")).toBeInTheDocument();
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

describe("shouldShowLanePlaceholder", () => {
  const activeShot = { id: "shot-1", laneId: "lane-a" };

  it("returns true when a draggable shot hovers a droppable lane", () => {
    expect(shouldShowLanePlaceholder(activeShot, "lane-a", "lane-a", true)).toBe(true);
  });

  it("returns false when the lane is not the current hover target", () => {
    expect(shouldShowLanePlaceholder(activeShot, "lane-b", "lane-a", true)).toBe(false);
  });

  it("returns false when dragging metadata is missing", () => {
    expect(shouldShowLanePlaceholder(null, "lane-a", "lane-a", true)).toBe(false);
    expect(shouldShowLanePlaceholder(activeShot, "lane-a", null, true)).toBe(false);
    expect(shouldShowLanePlaceholder(activeShot, "lane-a", "lane-a", false)).toBe(false);
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

describe("shot merging helpers", () => {
  it("normalises lane and project identifiers for legacy shots", () => {
    const legacyShot = {
      id: "legacy-1",
      lane: { id: "lane-legacy" },
      projectId: "",
      name: "Legacy Shot",
    };
    expect(normaliseShotForPlanner(legacyShot, "project-fallback")).toEqual(
      expect.objectContaining({
        id: "legacy-1",
        laneId: "lane-legacy",
        projectId: "project-fallback",
      })
    );
  });

  it("prefers primary shots while including unmatched legacy entries", () => {
    const primary = [
      { id: "shot-1", laneId: "lane-primary", projectId: "proj-new", name: "Primary" },
    ];
    const legacy = [
      { id: "shot-1", laneId: "lane-legacy", name: "Legacy copy" },
      { id: "shot-2", lane: { id: "lane-legacy-2" }, name: "Legacy extra" },
    ];
    const merged = mergeShotSources(primary, legacy, "proj-fallback");
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "shot-1",
      laneId: "lane-primary",
      projectId: "proj-new",
      name: "Primary",
    });
    expect(merged[1]).toMatchObject({
      id: "shot-2",
      laneId: "lane-legacy-2",
      projectId: "proj-fallback",
      name: "Legacy extra",
    });
  });
});
