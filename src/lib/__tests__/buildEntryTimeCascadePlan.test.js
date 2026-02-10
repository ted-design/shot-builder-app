import { describe, expect, it } from "vitest";
import { buildEntryTimeCascadePlan } from "../callsheet/buildEntryTimeCascadePlan";

describe("buildEntryTimeCascadePlan", () => {
  const baseEntries = [
    { id: "a", trackId: "primary", startTime: "08:00", duration: 30, order: 0 },
    { id: "b", trackId: "primary", startTime: "08:30", duration: 30, order: 1 },
    { id: "c", trackId: "primary", startTime: "09:00", duration: 30, order: 2 },
  ];

  it("returns null when updates do not include startTime", () => {
    const plan = buildEntryTimeCascadePlan(baseEntries, "b", { colorKey: "red" }, { cascadeChanges: true });
    expect(plan).toBeNull();
  });

  it("returns single update when cascade is disabled", () => {
    const plan = buildEntryTimeCascadePlan(
      baseEntries,
      "b",
      { startTime: "08:45", colorKey: "red" },
      { cascadeChanges: false }
    );

    expect(plan).toEqual({
      mode: "single",
      updates: [{ entryId: "b", startTime: "08:45", colorKey: "red" }],
    });
  });

  it("returns single update when clearing start time", () => {
    const plan = buildEntryTimeCascadePlan(
      baseEntries,
      "b",
      { startTime: "", colorKey: "blue" },
      { cascadeChanges: true }
    );

    expect(plan).toEqual({
      mode: "single",
      updates: [{ entryId: "b", startTime: "", colorKey: "blue" }],
    });
  });

  it("builds batch cascade updates and merges non-time fields", () => {
    const plan = buildEntryTimeCascadePlan(
      baseEntries,
      "b",
      { startTime: "08:45", colorKey: "red" },
      { cascadeChanges: true }
    );

    expect(plan.mode).toBe("batch");
    expect(plan.updates).toEqual(
      expect.arrayContaining([
        { entryId: "a", duration: 45 },
        { entryId: "b", startTime: "08:45", colorKey: "red" },
        { entryId: "c", startTime: "09:15" },
      ])
    );
  });

  it("uses updated target duration when deriving downstream times", () => {
    const plan = buildEntryTimeCascadePlan(
      baseEntries,
      "b",
      { startTime: "08:45", duration: 45 },
      { cascadeChanges: true }
    );

    expect(plan.mode).toBe("batch");
    expect(plan.updates).toEqual(
      expect.arrayContaining([
        { entryId: "a", duration: 45 },
        { entryId: "b", startTime: "08:45", duration: 45 },
        { entryId: "c", startTime: "09:30" },
      ])
    );
  });
});

