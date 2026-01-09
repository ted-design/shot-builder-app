import { describe, it, expect } from "vitest";
import {
  deriveLocationsFromLegacy,
  getDefaultLocationBlocks,
  locationBlockHasContent,
} from "../callsheet/deriveLocationsFromLegacy";
import type { DayDetails, LocationBlock } from "../../types/callsheet";

describe("deriveLocationsFromLegacy", () => {
  it("returns modern locations array when present", () => {
    const modernLocations: LocationBlock[] = [
      {
        id: "loc-1",
        title: "Custom Location",
        ref: { locationId: "abc", label: "My Place", notes: "123 Main St" },
        showName: true,
        showPhone: false,
      },
    ];
    const dayDetails = {
      scheduleId: "sched-1",
      crewCallTime: "",
      shootingCallTime: "",
      estimatedWrap: "",
      locations: modernLocations,
      productionOffice: { label: "Old Office", notes: "Should be ignored" },
    } as DayDetails;

    const result = deriveLocationsFromLegacy(dayDetails);

    expect(result).toEqual(modernLocations);
  });

  it("derives from legacy fields when locations array is absent", () => {
    const dayDetails = {
      scheduleId: "sched-1",
      crewCallTime: "",
      shootingCallTime: "",
      estimatedWrap: "",
      locations: null,
      productionOffice: { locationId: "loc-1", label: "Production HQ", notes: "456 Studio Blvd" },
      nearestHospital: { label: "City Hospital", notes: "789 Health Ave" },
      basecamp: null,
      parking: { label: "Lot A" },
    } as DayDetails;

    const result = deriveLocationsFromLegacy(dayDetails);

    // Only legacy fields with content are included (basecamp is empty/null)
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Production Office");
    expect(result[0].ref?.label).toBe("Production HQ");
    expect(result[0].ref?.notes).toBe("456 Studio Blvd");
    expect(result[1].title).toBe("Nearest Hospital");
    expect(result[1].ref?.label).toBe("City Hospital");
    expect(result[2].title).toBe("Parking");
    expect(result[2].ref?.label).toBe("Lot A");
  });

  it("appends custom locations from legacy format", () => {
    const dayDetails = {
      scheduleId: "sched-1",
      crewCallTime: "",
      shootingCallTime: "",
      estimatedWrap: "",
      locations: null,
      productionOffice: null,
      nearestHospital: null,
      parking: null,
      basecamp: null,
      customLocations: [
        { id: "custom-1", title: "Catering", label: "Food Truck Area", notes: "Near Stage 3" },
        { id: "custom-2", title: "Talent Holding", label: "Green Room", notes: null },
      ],
    } as DayDetails;

    const result = deriveLocationsFromLegacy(dayDetails);

    // Only custom locations with content (empty legacy fields are skipped)
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Catering");
    expect(result[0].ref?.label).toBe("Food Truck Area");
    expect(result[1].title).toBe("Talent Holding");
    expect(result[1].ref?.label).toBe("Green Room");
  });

  it("returns empty array for null dayDetails", () => {
    const result = deriveLocationsFromLegacy(null);
    expect(result).toEqual([]);
  });

  it("returns empty array for undefined dayDetails", () => {
    const result = deriveLocationsFromLegacy(undefined);
    expect(result).toEqual([]);
  });

  it("returns empty array when dayDetails exists but has no legacy fields with content and no modern locations", () => {
    const dayDetails = {
      scheduleId: "sched-1",
      crewCallTime: "09:00",
      shootingCallTime: "10:00",
      estimatedWrap: "18:00",
      locations: null,
      productionOffice: null,
      nearestHospital: null,
      parking: null,
      basecamp: null,
      customLocations: null,
    } as DayDetails;

    const result = deriveLocationsFromLegacy(dayDetails);

    expect(result).toEqual([]);
  });

  it("returns empty array when legacy fields have empty content", () => {
    const dayDetails = {
      scheduleId: "sched-1",
      crewCallTime: "",
      shootingCallTime: "",
      estimatedWrap: "",
      locations: null,
      productionOffice: { label: "", notes: "" },
      nearestHospital: { label: "  ", notes: "  " }, // whitespace only
      parking: null,
      basecamp: null,
    } as DayDetails;

    const result = deriveLocationsFromLegacy(dayDetails);

    expect(result).toEqual([]);
  });
});

describe("getDefaultLocationBlocks", () => {
  it("returns 4 default location blocks", () => {
    const defaults = getDefaultLocationBlocks();

    expect(defaults).toHaveLength(4);
    expect(defaults[0].title).toBe("Production Office");
    expect(defaults[0].showName).toBe(true);
    expect(defaults[0].showPhone).toBe(true);
    expect(defaults[1].title).toBe("Nearest Hospital");
    expect(defaults[2].title).toBe("Basecamp");
    expect(defaults[2].showPhone).toBe(false);
    expect(defaults[3].title).toBe("Parking");
  });

  it("returns blocks with null refs", () => {
    const defaults = getDefaultLocationBlocks();
    defaults.forEach((block) => {
      expect(block.ref).toBeNull();
    });
  });
});

describe("locationBlockHasContent", () => {
  it("returns true when label is present", () => {
    const block: LocationBlock = {
      id: "1",
      title: "Test",
      ref: { label: "Some Label", notes: null },
      showName: true,
      showPhone: false,
    };
    expect(locationBlockHasContent(block)).toBe(true);
  });

  it("returns true when notes is present", () => {
    const block: LocationBlock = {
      id: "1",
      title: "Test",
      ref: { label: null, notes: "Some notes" },
      showName: true,
      showPhone: false,
    };
    expect(locationBlockHasContent(block)).toBe(true);
  });

  it("returns true when locationId is present", () => {
    const block: LocationBlock = {
      id: "1",
      title: "Test",
      ref: { locationId: "loc-123", label: null, notes: null },
      showName: true,
      showPhone: false,
    };
    expect(locationBlockHasContent(block)).toBe(true);
  });

  it("returns false when ref is null", () => {
    const block: LocationBlock = {
      id: "1",
      title: "Test",
      ref: null,
      showName: true,
      showPhone: false,
    };
    expect(locationBlockHasContent(block)).toBe(false);
  });

  it("returns false when ref has only empty strings", () => {
    const block: LocationBlock = {
      id: "1",
      title: "Test",
      ref: { locationId: "", label: "  ", notes: "" },
      showName: true,
      showPhone: false,
    };
    expect(locationBlockHasContent(block)).toBe(false);
  });
});
