import { describe, it, expect } from "vitest";
import {
  isTimeString,
  isAmbiguousTimeInput,
  parseTimeInputToMinutes,
  parseTypedTimeInput,
  formatMinutesToTime12h,
  computeEffectiveCrewCallDisplay,
  timeStringToMinutes,
} from "../crewCallEffective";

describe("crewCallEffective", () => {
  describe("isTimeString", () => {
    it("returns true for valid HH:MM format", () => {
      expect(isTimeString("06:30")).toBe(true);
      expect(isTimeString("6:30")).toBe(true);
      expect(isTimeString("12:00")).toBe(true);
      expect(isTimeString("23:59")).toBe(true);
      expect(isTimeString("00:00")).toBe(true);
    });

    it("returns false for invalid formats", () => {
      expect(isTimeString(null)).toBe(false);
      expect(isTimeString(undefined)).toBe(false);
      expect(isTimeString("")).toBe(false);
      expect(isTimeString("6:30 AM")).toBe(false);
      expect(isTimeString("6:30AM")).toBe(false);
      expect(isTimeString("630")).toBe(false);
      expect(isTimeString("OFF")).toBe(false);
      expect(isTimeString("text")).toBe(false);
    });

    it("trims whitespace", () => {
      expect(isTimeString("  06:30  ")).toBe(true);
    });
  });

  describe("isAmbiguousTimeInput", () => {
    it("returns true for ambiguous times (1-12 without AM/PM)", () => {
      expect(isAmbiguousTimeInput("6:17")).toBe(true);
      expect(isAmbiguousTimeInput("12:30")).toBe(true);
      expect(isAmbiguousTimeInput("1:00")).toBe(true);
      expect(isAmbiguousTimeInput("11:59")).toBe(true);
    });

    it("returns false for times with AM/PM", () => {
      expect(isAmbiguousTimeInput("6:17 AM")).toBe(false);
      expect(isAmbiguousTimeInput("6:17AM")).toBe(false);
      expect(isAmbiguousTimeInput("12:30 PM")).toBe(false);
    });

    it("returns false for unambiguous 24-hour format", () => {
      expect(isAmbiguousTimeInput("14:30")).toBe(false);
      expect(isAmbiguousTimeInput("00:30")).toBe(false);
      expect(isAmbiguousTimeInput("23:59")).toBe(false);
      expect(isAmbiguousTimeInput("13:00")).toBe(false);
    });

    it("returns false for non-time values", () => {
      expect(isAmbiguousTimeInput("OFF")).toBe(false);
      expect(isAmbiguousTimeInput(null)).toBe(false);
      expect(isAmbiguousTimeInput(undefined)).toBe(false);
      expect(isAmbiguousTimeInput("")).toBe(false);
      expect(isAmbiguousTimeInput("text")).toBe(false);
    });

    it("returns false for invalid hour/minute ranges", () => {
      expect(isAmbiguousTimeInput("24:00")).toBe(false);
      expect(isAmbiguousTimeInput("12:60")).toBe(false);
      expect(isAmbiguousTimeInput("-1:30")).toBe(false);
    });
  });

  describe("parseTimeInputToMinutes", () => {
    it("parses valid 12-hour times with AM", () => {
      expect(parseTimeInputToMinutes("6:17 AM")).toEqual({ minutes: 377 });
      expect(parseTimeInputToMinutes("6:17AM")).toEqual({ minutes: 377 });
      expect(parseTimeInputToMinutes("06:17 am")).toEqual({ minutes: 377 });
      expect(parseTimeInputToMinutes("12:00 AM")).toEqual({ minutes: 0 }); // midnight
      expect(parseTimeInputToMinutes("1:00 AM")).toEqual({ minutes: 60 });
    });

    it("parses valid 12-hour times with PM", () => {
      expect(parseTimeInputToMinutes("11:30 PM")).toEqual({ minutes: 1410 });
      expect(parseTimeInputToMinutes("12:00 PM")).toEqual({ minutes: 720 }); // noon
      expect(parseTimeInputToMinutes("1:00 PM")).toEqual({ minutes: 780 });
      expect(parseTimeInputToMinutes("6:30 PM")).toEqual({ minutes: 1110 });
    });

    it("returns null for times without AM/PM", () => {
      expect(parseTimeInputToMinutes("6:17")).toBeNull();
      expect(parseTimeInputToMinutes("14:30")).toBeNull();
    });

    it("returns null for invalid inputs", () => {
      expect(parseTimeInputToMinutes(null)).toBeNull();
      expect(parseTimeInputToMinutes(undefined)).toBeNull();
      expect(parseTimeInputToMinutes("")).toBeNull();
      expect(parseTimeInputToMinutes("OFF")).toBeNull();
      expect(parseTimeInputToMinutes("13:00 AM")).toBeNull(); // invalid hour for 12-hour
      expect(parseTimeInputToMinutes("0:00 AM")).toBeNull(); // 0 is invalid for 12-hour format
    });

    it("returns null for invalid minute ranges", () => {
      expect(parseTimeInputToMinutes("6:60 AM")).toBeNull();
      expect(parseTimeInputToMinutes("6:-1 AM")).toBeNull();
    });
  });

  describe("parseTypedTimeInput", () => {
    it("parses 12-hour format with AM/PM", () => {
      expect(parseTypedTimeInput("6:17 AM")).toEqual({ minutes: 377, canonical: "06:17" });
      expect(parseTypedTimeInput("11:30 PM")).toEqual({ minutes: 1410, canonical: "23:30" });
      expect(parseTypedTimeInput("12:00 AM")).toEqual({ minutes: 0, canonical: "00:00" });
      expect(parseTypedTimeInput("12:00 PM")).toEqual({ minutes: 720, canonical: "12:00" });
    });

    it("parses unambiguous 24-hour format", () => {
      expect(parseTypedTimeInput("14:30")).toEqual({ minutes: 870, canonical: "14:30" });
      expect(parseTypedTimeInput("00:30")).toEqual({ minutes: 30, canonical: "00:30" });
      expect(parseTypedTimeInput("23:59")).toEqual({ minutes: 1439, canonical: "23:59" });
      expect(parseTypedTimeInput("0:17")).toEqual({ minutes: 17, canonical: "00:17" });
    });

    it("rejects ambiguous times (1-12 without AM/PM)", () => {
      expect(parseTypedTimeInput("6:17")).toBeNull();
      expect(parseTypedTimeInput("12:30")).toBeNull();
      expect(parseTypedTimeInput("1:00")).toBeNull();
    });

    it("returns null for invalid inputs", () => {
      expect(parseTypedTimeInput(null)).toBeNull();
      expect(parseTypedTimeInput(undefined)).toBeNull();
      expect(parseTypedTimeInput("")).toBeNull();
      expect(parseTypedTimeInput("   ")).toBeNull();
      expect(parseTypedTimeInput("OFF")).toBeNull();
      expect(parseTypedTimeInput("24:00")).toBeNull();
    });
  });

  describe("formatMinutesToTime12h", () => {
    it("formats positive minutes correctly", () => {
      expect(formatMinutesToTime12h(0)).toBe("12:00 AM");
      expect(formatMinutesToTime12h(60)).toBe("1:00 AM");
      expect(formatMinutesToTime12h(377)).toBe("6:17 AM");
      expect(formatMinutesToTime12h(720)).toBe("12:00 PM");
      expect(formatMinutesToTime12h(1410)).toBe("11:30 PM");
    });

    it("normalizes negative minutes (previous day)", () => {
      expect(formatMinutesToTime12h(-30)).toBe("11:30 PM");
      expect(formatMinutesToTime12h(-60)).toBe("11:00 PM");
      expect(formatMinutesToTime12h(-720)).toBe("12:00 PM");
    });

    it("normalizes values over 24 hours", () => {
      expect(formatMinutesToTime12h(1440)).toBe("12:00 AM"); // 24 hours = 0
      expect(formatMinutesToTime12h(1500)).toBe("1:00 AM"); // 25 hours
    });
  });

  describe("timeStringToMinutes", () => {
    it("converts valid time strings to minutes", () => {
      expect(timeStringToMinutes("06:30")).toBe(390);
      expect(timeStringToMinutes("00:00")).toBe(0);
      expect(timeStringToMinutes("12:00")).toBe(720);
      expect(timeStringToMinutes("23:59")).toBe(1439);
    });

    it("returns null for invalid inputs", () => {
      expect(timeStringToMinutes(null)).toBeNull();
      expect(timeStringToMinutes("")).toBeNull();
      expect(timeStringToMinutes("OFF")).toBeNull();
      expect(timeStringToMinutes("6:30 AM")).toBeNull();
    });
  });

  describe("computeEffectiveCrewCallDisplay", () => {
    describe("priority 1: text override", () => {
      it("returns text display for callText", () => {
        const result = computeEffectiveCrewCallDisplay({ callText: "OFF" });
        expect(result).toEqual({
          kind: "text",
          display: "OFF",
          isPrevDay: false,
          effectiveMinutes: null,
          deltaMinutes: null,
        });
      });

      it("trims callText whitespace", () => {
        const result = computeEffectiveCrewCallDisplay({ callText: "  O  " });
        expect(result.display).toBe("O");
      });

      it("ignores other values when callText is set", () => {
        const result = computeEffectiveCrewCallDisplay({
          callText: "OFF",
          baseMinutes: 540,
          absoluteCallMinutes: 600,
        });
        expect(result.kind).toBe("text");
        expect(result.display).toBe("OFF");
      });
    });

    describe("priority 2: absolute time", () => {
      it("returns absolute time display", () => {
        const result = computeEffectiveCrewCallDisplay({ absoluteCallMinutes: 600 });
        expect(result.kind).toBe("absolute");
        expect(result.display).toBe("10:00 AM");
        expect(result.effectiveMinutes).toBe(600);
        expect(result.isPrevDay).toBe(false);
      });

      it("calculates delta from base when base is provided", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540,
          absoluteCallMinutes: 600,
        });
        expect(result.deltaMinutes).toBe(60); // 60 minutes later
      });

      it("sets deltaMinutes to null when no base", () => {
        const result = computeEffectiveCrewCallDisplay({ absoluteCallMinutes: 600 });
        expect(result.deltaMinutes).toBeNull();
      });
    });

    describe("priority 3: offset from base", () => {
      it("computes early offset (precall)", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540, // 9:00 AM
          offsetDirection: "early",
          offsetMinutes: 30,
        });
        expect(result.kind).toBe("offset");
        expect(result.display).toBe("8:30 AM");
        expect(result.effectiveMinutes).toBe(510);
        expect(result.deltaMinutes).toBe(-30);
        expect(result.isPrevDay).toBe(false);
      });

      it("computes delay offset", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540, // 9:00 AM
          offsetDirection: "delay",
          offsetMinutes: 60,
        });
        expect(result.kind).toBe("offset");
        expect(result.display).toBe("10:00 AM");
        expect(result.effectiveMinutes).toBe(600);
        expect(result.deltaMinutes).toBe(60);
      });

      it("handles previous day for early offset", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 30, // 12:30 AM
          offsetDirection: "early",
          offsetMinutes: 60,
        });
        expect(result.kind).toBe("offset");
        expect(result.display).toBe("11:30 PM"); // prev day
        expect(result.effectiveMinutes).toBe(-30);
        expect(result.isPrevDay).toBe(true);
        expect(result.deltaMinutes).toBe(-60);
      });

      it("ignores offset when offsetMinutes is 0", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540,
          offsetDirection: "early",
          offsetMinutes: 0,
        });
        expect(result.kind).toBe("base"); // falls through to base
      });

      it("ignores offset when no direction", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540,
          offsetMinutes: 30,
        });
        expect(result.kind).toBe("base");
      });
    });

    describe("priority 4: base crew call", () => {
      it("returns base display when no overrides", () => {
        const result = computeEffectiveCrewCallDisplay({ baseMinutes: 540 });
        expect(result.kind).toBe("base");
        expect(result.display).toBe("9:00 AM");
        expect(result.effectiveMinutes).toBe(540);
        expect(result.deltaMinutes).toBeNull();
        expect(result.isPrevDay).toBe(false);
      });
    });

    describe("priority 5: empty", () => {
      it("returns empty when no values provided", () => {
        const result = computeEffectiveCrewCallDisplay({});
        expect(result).toEqual({
          kind: "empty",
          display: "",
          isPrevDay: false,
          effectiveMinutes: null,
          deltaMinutes: null,
        });
      });

      it("returns empty for null/undefined values", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: null,
          callText: null,
          absoluteCallMinutes: undefined,
        });
        expect(result.kind).toBe("empty");
      });
    });

    describe("edge cases", () => {
      it("handles midnight (0 minutes)", () => {
        const result = computeEffectiveCrewCallDisplay({ baseMinutes: 0 });
        expect(result.display).toBe("12:00 AM");
        expect(result.effectiveMinutes).toBe(0);
      });

      it("handles end of day (1439 minutes)", () => {
        const result = computeEffectiveCrewCallDisplay({ baseMinutes: 1439 });
        expect(result.display).toBe("11:59 PM");
      });

      it("handles empty string callText as no override", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540,
          callText: "",
        });
        expect(result.kind).toBe("base");
      });

      it("handles whitespace-only callText as no override", () => {
        const result = computeEffectiveCrewCallDisplay({
          baseMinutes: 540,
          callText: "   ",
        });
        expect(result.kind).toBe("base");
      });
    });
  });
});
