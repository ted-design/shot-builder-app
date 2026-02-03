import { describe, it, expect } from "vitest"
import {
  projectsPath,
  projectPath,
  projectMembersPath,
  shotsPath,
  shotPath,
  pullsPath,
  pullPath,
  lanesPath,
  productFamiliesPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
  crewPath,
  schedulesPath,
  schedulePath,
  scheduleEntriesPath,
  scheduleDayDetailsPath,
  scheduleTalentCallsPath,
  scheduleCrewCallsPath,
  scheduleClientCallsPath,
  callSheetConfigPath,
} from "./paths"

const CLIENT = "test-client"

describe("Firestore Path Builders", () => {
  describe("projects", () => {
    it("builds projectsPath", () => {
      expect(projectsPath(CLIENT)).toEqual(["clients", "test-client", "projects"])
    })

    it("builds projectPath", () => {
      expect(projectPath("proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1",
      ])
    })

    it("builds projectMembersPath", () => {
      expect(projectMembersPath("proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "members",
      ])
    })
  })

  describe("shots (global)", () => {
    it("builds shotsPath at client level", () => {
      expect(shotsPath(CLIENT)).toEqual(["clients", "test-client", "shots"])
    })

    it("builds shotPath", () => {
      expect(shotPath("shot-1", CLIENT)).toEqual([
        "clients", "test-client", "shots", "shot-1",
      ])
    })
  })

  describe("pulls (project-scoped)", () => {
    it("builds pullsPath under project", () => {
      expect(pullsPath("proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "pulls",
      ])
    })

    it("builds pullPath", () => {
      expect(pullPath("pull-1", "proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "pulls", "pull-1",
      ])
    })
  })

  describe("lanes", () => {
    it("builds lanesPath under project", () => {
      expect(lanesPath("proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "lanes",
      ])
    })
  })

  describe("products", () => {
    it("builds productFamiliesPath", () => {
      expect(productFamiliesPath(CLIENT)).toEqual([
        "clients", "test-client", "productFamilies",
      ])
    })

    it("builds productFamilySkusPath", () => {
      expect(productFamilySkusPath("fam-1", CLIENT)).toEqual([
        "clients", "test-client", "productFamilies", "fam-1", "skus",
      ])
    })
  })

  describe("talent, locations, crew", () => {
    it("builds talentPath", () => {
      expect(talentPath(CLIENT)).toEqual(["clients", "test-client", "talent"])
    })

    it("builds locationsPath", () => {
      expect(locationsPath(CLIENT)).toEqual(["clients", "test-client", "locations"])
    })

    it("builds crewPath", () => {
      expect(crewPath(CLIENT)).toEqual(["clients", "test-client", "crew"])
    })
  })

  describe("schedules (project-scoped)", () => {
    it("builds schedulesPath under project", () => {
      expect(schedulesPath("proj-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules",
      ])
    })

    it("builds schedulePath", () => {
      expect(schedulePath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1",
      ])
    })

    it("builds scheduleEntriesPath", () => {
      expect(scheduleEntriesPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "entries",
      ])
    })

    it("builds scheduleDayDetailsPath", () => {
      expect(scheduleDayDetailsPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "dayDetails",
      ])
    })

    it("builds scheduleTalentCallsPath", () => {
      expect(scheduleTalentCallsPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "talentCalls",
      ])
    })

    it("builds scheduleCrewCallsPath", () => {
      expect(scheduleCrewCallsPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "crewCalls",
      ])
    })

    it("builds scheduleClientCallsPath", () => {
      expect(scheduleClientCallsPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "clientCalls",
      ])
    })

    it("builds callSheetConfigPath (doc path)", () => {
      expect(callSheetConfigPath("proj-1", "sched-1", CLIENT)).toEqual([
        "clients", "test-client", "projects", "proj-1", "schedules", "sched-1", "callSheet", "config",
      ])
    })
  })

  describe("clientId scoping", () => {
    it("always requires explicit clientId (no hardcoded fallback)", () => {
      // Verify the functions take clientId as a required parameter
      // by calling with different values and checking the output
      expect(projectsPath("org-a")[1]).toBe("org-a")
      expect(projectsPath("org-b")[1]).toBe("org-b")
    })
  })
})
