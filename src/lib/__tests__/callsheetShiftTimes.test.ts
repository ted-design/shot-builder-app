import { describe, expect, it } from "vitest";
import { shiftTimeString } from "../callsheet/shiftTimes";

describe("callsheet shiftTimes", () => {
  it("shifts valid HH:MM times and clamps to day range", () => {
    expect(shiftTimeString("06:00", 60)).toBe("07:00");
    expect(shiftTimeString("00:01", -5)).toBe("00:00");
    expect(shiftTimeString("23:59", 5)).toBe("23:59");
  });

  it("returns null for invalid input", () => {
    expect(shiftTimeString("6:00 AM", 10)).toBe(null);
    expect(shiftTimeString(null, 10)).toBe(null);
  });
});

