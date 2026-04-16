import { describe, expect, it } from "vitest";
import { callSheetConfigPath, callSheetLayoutPath, callSheetPath } from "../paths";

describe("paths - callsheet", () => {
  it("builds schedule-scoped callsheet paths", () => {
    expect(callSheetPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "callSheet",
    ]);
    expect(callSheetConfigPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "callSheet",
      "config",
    ]);
    expect(callSheetLayoutPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "callSheet",
      "layout",
    ]);
  });
});

