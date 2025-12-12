import { describe, it, expect } from "vitest";
import { sortEntriesByTime } from "../cascadeEngine";

describe("sortEntriesByTime", () => {
  it("sorts by actual time, not lexicographic order", () => {
    const entries = [
      { id: "late", startTime: "9:30", duration: 30, order: 0 },
      { id: "early", startTime: "8:30", duration: 30, order: 0 },
    ];

    const sorted = sortEntriesByTime(entries);
    expect(sorted.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("supports AM/PM formats and order tie-breaks", () => {
    const entries = [
      { id: "second", startTime: "8:30 AM", duration: 30, order: 1 },
      { id: "first", startTime: "08:30", duration: 30, order: 0 },
      { id: "afternoon", startTime: "2:00 PM", duration: 30, order: 0 },
    ];

    const sorted = sortEntriesByTime(entries);
    expect(sorted.map((e) => e.id)).toEqual(["first", "second", "afternoon"]);
  });
});
