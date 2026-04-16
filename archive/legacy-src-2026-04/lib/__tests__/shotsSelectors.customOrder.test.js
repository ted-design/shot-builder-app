import { describe, expect, it } from "vitest";
import { sortShotsForView } from "../shotsSelectors";

describe("shotsSelectors - custom order", () => {
  it("sorts by sortOrder when present, then falls back to date for legacy shots", () => {
    const shots = [
      { id: "a", name: "A", sortOrder: 2000, date: "2026-02-02" },
      { id: "b", name: "B", sortOrder: 1000, date: "2026-02-03" },
      { id: "c", name: "C", date: "2026-02-01" }, // legacy (no sortOrder)
    ];

    const result = sortShotsForView(shots, { sortBy: "custom" });
    expect(result.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("orders legacy shots without sortOrder by date then name", () => {
    const shots = [
      { id: "c", name: "C", date: "2026-02-02" },
      { id: "a", name: "A", date: "2026-02-01" },
      { id: "b", name: "B", date: "2026-02-01" },
    ];

    const result = sortShotsForView(shots, { sortBy: "custom" });
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("shotsSelectors - status sort", () => {
  it("sorts by status rank, then custom order within a status", () => {
    const shots = [
      { id: "c1", name: "C1", status: "complete", sortOrder: 1000 },
      { id: "t2", name: "T2", status: "todo", sortOrder: 2000 },
      { id: "t1", name: "T1", status: "todo", sortOrder: 1000 },
      { id: "p1", name: "P1", status: "in_progress", sortOrder: 1000 },
      { id: "h1", name: "H1", status: "on_hold", sortOrder: 1000 },
    ];

    const result = sortShotsForView(shots, { sortBy: "byStatus" });
    expect(result.map((s) => s.id)).toEqual(["t1", "t2", "p1", "h1", "c1"]);
  });
});

