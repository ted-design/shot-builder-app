import { describe, expect, it } from "vitest";
import {
  scheduleCrewCallPath,
  scheduleCrewCallsPath,
  scheduleClientCallPath,
  scheduleClientCallsPath,
  scheduleDayDetailPath,
  scheduleDayDetailsPath,
  scheduleTalentCallPath,
  scheduleTalentCallsPath,
} from "../paths";

describe("paths - schedule callsheet supporting docs", () => {
  it("builds schedule day details paths", () => {
    expect(scheduleDayDetailsPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "dayDetails",
    ]);
    expect(scheduleDayDetailPath("p1", "s1", "d1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "dayDetails",
      "d1",
    ]);
  });

  it("builds schedule talent calls paths", () => {
    expect(scheduleTalentCallsPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "talentCalls",
    ]);
    expect(scheduleTalentCallPath("p1", "s1", "t1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "talentCalls",
      "t1",
    ]);
  });

  it("builds schedule crew calls paths", () => {
    expect(scheduleCrewCallsPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "crewCalls",
    ]);
    expect(scheduleCrewCallPath("p1", "s1", "cm1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "crewCalls",
      "cm1",
    ]);
  });

  it("builds schedule client calls paths", () => {
    expect(scheduleClientCallsPath("p1", "s1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "clientCalls",
    ]);
    expect(scheduleClientCallPath("p1", "s1", "cc1", "c1")).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "schedules",
      "s1",
      "clientCalls",
      "cc1",
    ]);
  });
});
