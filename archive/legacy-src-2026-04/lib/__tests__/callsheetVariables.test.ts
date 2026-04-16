import { describe, expect, it } from "vitest";
import { buildCallSheetVariableContext, resolveCallSheetVariable } from "../callsheet/variables";

describe("callsheet variables", () => {
  it("builds a context and resolves known keys", () => {
    const ctx = buildCallSheetVariableContext({
      schedule: { name: "Day 1 - Studio", date: new Date("2026-01-06T12:00:00Z") },
      dayDetails: { scheduleId: "s1", crewCallTime: "06:00", shootingCallTime: "07:00", estimatedWrap: "18:00" } as any,
      companyName: "ACME",
      totalDays: 3,
      dayNumber: 1,
    });

    expect(resolveCallSheetVariable("@projectTitle", ctx)).toBe("Day 1 - Studio");
    expect(resolveCallSheetVariable("@companyName", ctx)).toBe("ACME");
    expect(resolveCallSheetVariable("@generalCrewCall", ctx)).toBe("06:00");
    expect(resolveCallSheetVariable("@shootingCall", ctx)).toBe("07:00");
    expect(resolveCallSheetVariable("@estWrap", ctx)).toBe("18:00");
    expect(resolveCallSheetVariable("@dayXofY", ctx)).toBe("Day 1 of 3");
  });
});

