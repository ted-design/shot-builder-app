import { describe, it, expect } from "vitest";
import { selectPlannerGroups } from "../plannerSelectors";
import { sortShotsForView } from "../shotsSelectors";

describe("planner grouping and sorting", () => {
  it("sorts shots within a talent group using descending title order", () => {
    const shots = [
      { id: "shot-1", name: "Alpha", talent: [{ name: "Alex" }] },
      { id: "shot-2", name: "Zulu", talent: [{ name: "Alex" }] },
      { id: "shot-3", name: "Beta", talent: [{ name: "Brian" }] },
    ];

    const groups = selectPlannerGroups(shots, { groupBy: "talent", sortBy: "alpha_desc" });

    const alexGroup = groups.find((group) => group.id === "Alex");
    expect(alexGroup.shots.map((shot) => shot.name)).toEqual(["Zulu", "Alpha"]);
  });
});

describe("sortShotsForView", () => {
  it("supports descending date sorting", () => {
    const shots = [
      { id: "shot-1", name: "Alpha", date: "2024-01-01" },
      { id: "shot-2", name: "Beta", date: "2024-03-15" },
      { id: "shot-3", name: "Gamma", date: "2024-02-10" },
    ];

    const ordered = sortShotsForView(shots, { sortBy: "date_desc" });

    expect(ordered.map((shot) => shot.id)).toEqual(["shot-2", "shot-3", "shot-1"]);
  });
});
