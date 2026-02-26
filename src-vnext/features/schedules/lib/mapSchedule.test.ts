import { describe, expect, it } from "vitest"
import {
  mapCrewCall,
  mapDayDetails,
  mapLocationRecord,
  mapScheduleEntry,
  mapTalentCall,
} from "./mapSchedule"

describe("mapSchedule time sanitization", () => {
  it("normalizes day details times and drops invalid values", () => {
    const mapped = mapDayDetails("dd1", {
      scheduleId: "s1",
      crewCallTime: "6:00 AM",
      shootingCallTime: "14:30",
      breakfastTime: "24:00",
      estimatedWrap: "7:00 PM",
    })

    expect(mapped.crewCallTime).toBe("06:00")
    expect(mapped.shootingCallTime).toBe("14:30")
    expect(mapped.breakfastTime).toBeNull()
    expect(mapped.estimatedWrap).toBe("19:00")
  })

  it("normalizes talent call time, preserves text override, and drops invalid time", () => {
    const mappedTime = mapTalentCall("tc1", {
      talentId: "talent-1",
      callTime: "7:15 AM",
      callText: "OFF",
      setTime: "24:00",
      wrapTime: "18:10",
    })
    expect(mappedTime.callTime).toBe("07:15")
    expect(mappedTime.callText).toBeNull()
    expect(mappedTime.setTime).toBeNull()
    expect(mappedTime.wrapTime).toBe("18:10")

    const mappedText = mapTalentCall("tc2", {
      talentId: "talent-2",
      callTime: "OFF",
      callText: null,
    })
    expect(mappedText.callTime).toBeNull()
    expect(mappedText.callText).toBe("OFF")
  })

  it("normalizes crew call time, preserves text override, and drops invalid wrap", () => {
    const mappedTime = mapCrewCall("cc1", {
      crewMemberId: "crew-1",
      callTime: "06:45",
      callText: "IGNORE",
      wrapTime: "24:00",
    })
    expect(mappedTime.callTime).toBe("06:45")
    expect(mappedTime.callText).toBeNull()
    expect(mappedTime.wrapTime).toBeNull()

    const mappedText = mapCrewCall("cc2", {
      crewMemberId: "crew-2",
      callTime: "O/C",
      callText: null,
    })
    expect(mappedText.callTime).toBeNull()
    expect(mappedText.callText).toBe("O/C")
  })

  it("normalizes legacy shared track marker from all to shared", () => {
    const mapped = mapScheduleEntry("entry-1", {
      type: "banner",
      title: "Shared Note",
      trackId: "all",
      order: 0,
    })

    expect(mapped.trackId).toBe("shared")
  })

  it("maps custom highlight metadata for schedule entries", () => {
    const mapped = mapScheduleEntry("entry-h", {
      type: "setup",
      title: "Look Reset",
      order: 1,
      highlight: {
        variant: "outline",
        color: "#2563eb",
        emoji: "✨",
      },
    })

    expect(mapped.highlight).toEqual({
      variant: "outline",
      color: "#2563eb",
      emoji: "✨",
    })
  })

  it("maps modern day-details location blocks", () => {
    const mapped = mapDayDetails("dd-modern", {
      scheduleId: "s1",
      crewCallTime: "06:00",
      shootingCallTime: "07:00",
      estimatedWrap: "19:00",
      locations: [
        {
          id: "loc-1",
          title: "Basecamp",
          ref: { locationId: "library-1", label: "North Lot", notes: "Gate B" },
          showName: true,
          showPhone: false,
        },
      ],
    })

    expect(mapped.locations).toEqual([
      {
        id: "loc-1",
        title: "Basecamp",
        ref: { locationId: "library-1", label: "North Lot", notes: "Gate B" },
        showName: true,
        showPhone: false,
      },
    ])
  })

  it("derives day-details locations from legacy fixed fields and custom locations", () => {
    const mapped = mapDayDetails("dd-legacy", {
      scheduleId: "s1",
      crewCallTime: "06:00",
      shootingCallTime: "07:00",
      estimatedWrap: "19:00",
      basecamp: { label: "East Base", notes: "Lot C" },
      nearestHospital: { label: "City Hospital" },
      customLocations: [
        { id: "custom-1", title: "Holding", label: "Studio A", notes: "2nd floor" },
      ],
    })

    expect(mapped.locations).toEqual([
      {
        id: "legacy-nearestHospital",
        title: "Hospital",
        ref: { locationId: null, label: "City Hospital", notes: null },
        showName: true,
        showPhone: true,
      },
      {
        id: "legacy-basecamp",
        title: "Basecamp",
        ref: { locationId: null, label: "East Base", notes: "Lot C" },
        showName: true,
        showPhone: false,
      },
      {
        id: "custom-1",
        title: "Holding",
        ref: { locationId: null, label: "Studio A", notes: "2nd floor" },
        showName: true,
        showPhone: false,
      },
    ])
  })

  it("maps location records with project membership", () => {
    const mapped = mapLocationRecord("l1", {
      name: "Hospital",
      address: "100 Main St",
      notes: "ER entrance",
      projectIds: ["p1", "p2"],
    })

    expect(mapped).toEqual({
      id: "l1",
      name: "Hospital",
      address: "100 Main St",
      street: null,
      unit: null,
      city: null,
      province: null,
      postal: null,
      phone: null,
      photoPath: null,
      photoUrl: null,
      notes: "ER entrance",
      projectIds: ["p1", "p2"],
      createdAt: undefined,
      updatedAt: undefined,
      createdBy: null,
    })
  })

  it("derives location address from structured fields when address is absent", () => {
    const mapped = mapLocationRecord("l2", {
      name: "Basecamp",
      street: "10 Studio Way",
      unit: "Unit 4",
      city: "Los Angeles",
      province: "CA",
      postal: "90001",
    })

    expect(mapped.address).toBe("10 Studio Way Unit 4 · Los Angeles, CA · 90001")
  })
})
