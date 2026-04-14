import { describe, it, expect } from "vitest";
import { applyDurationChange, sortEntriesByTime } from "../cascadeEngine";

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

describe("applyDurationChange", () => {
  it("marks the resized entry as changed even when no times shift", () => {
    const entries = [
      { id: "first", trackId: "photo", startTime: "09:00", duration: 30, order: 0 },
      { id: "second", trackId: "photo", startTime: "10:00", duration: 30, order: 1 },
    ];

    const results = applyDurationChange(entries, "first", 45, { cascadeEnabled: true, gapMinutes: 0 });
    const resized = results.find((r) => r.id === "first");

    expect(resized).toMatchObject({ id: "first", duration: 45, changed: true });
  });

  it("marks the resized entry as changed when it is not first", () => {
    const entries = [
      { id: "first", trackId: "photo", startTime: "09:00", duration: 30, order: 0 },
      { id: "second", trackId: "photo", startTime: "10:00", duration: 30, order: 1 },
      { id: "third", trackId: "photo", startTime: "11:30", duration: 30, order: 2 },
    ];

    const results = applyDurationChange(entries, "second", 45, { cascadeEnabled: true, gapMinutes: 0 });
    const resized = results.find((r) => r.id === "second");

    expect(resized).toMatchObject({ id: "second", duration: 45, changed: true });
  });
});
