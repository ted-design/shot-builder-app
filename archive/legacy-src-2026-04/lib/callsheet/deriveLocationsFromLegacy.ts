import type { DayDetails, LocationBlock, LocationReference, DayDetailsCustomLocation } from "../../types/callsheet";

/**
 * Default location type definitions with their display order.
 */
const LEGACY_LOCATION_KEYS = [
  { key: "productionOffice" as const, title: "Production Office", showName: true, showPhone: true },
  { key: "nearestHospital" as const, title: "Nearest Hospital", showName: true, showPhone: true },
  { key: "basecamp" as const, title: "Basecamp", showName: true, showPhone: false },
  { key: "parking" as const, title: "Parking", showName: true, showPhone: false },
];

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function hasContent(ref: LocationReference | null | undefined): boolean {
  if (!ref) return false;
  const label = ref.label ? String(ref.label).trim() : "";
  const notes = ref.notes ? String(ref.notes).trim() : "";
  const locationId = ref.locationId ? String(ref.locationId).trim() : "";
  return Boolean(label || notes || locationId);
}

/**
 * Derives a LocationBlock[] from legacy fixed fields when dayDetails.locations is absent.
 * This ensures backward compatibility with existing persisted schedules.
 *
 * @param dayDetails - The DayDetails object (may have legacy fields or modern locations array)
 * @returns LocationBlock[] - The unified locations array
 */
export function deriveLocationsFromLegacy(dayDetails: DayDetails | null | undefined): LocationBlock[] {
  // If modern locations array exists and has content, use it directly
  if (dayDetails?.locations && Array.isArray(dayDetails.locations) && dayDetails.locations.length > 0) {
    return dayDetails.locations;
  }

  if (!dayDetails) return [];

  const result: LocationBlock[] = [];

  // Convert legacy fixed fields - only include blocks that have content
  for (const { key, title, showName, showPhone } of LEGACY_LOCATION_KEYS) {
    const ref = dayDetails[key] as LocationReference | null | undefined;
    // Only include if the legacy field has content
    if (ref && hasContent(ref)) {
      result.push({
        id: `legacy-${key}`,
        title,
        ref: {
          locationId: ref.locationId ?? null,
          label: ref.label ?? null,
          notes: ref.notes ?? null,
        },
        showName,
        showPhone,
      });
    }
  }

  // Append custom locations
  const customLocations = dayDetails.customLocations;
  if (Array.isArray(customLocations)) {
    for (const custom of customLocations) {
      if (!custom) continue;
      const hasCustomContent =
        (custom.title && String(custom.title).trim()) ||
        (custom.label && String(custom.label).trim()) ||
        (custom.notes && String(custom.notes).trim()) ||
        (custom.locationId && String(custom.locationId).trim());

      if (!hasCustomContent) continue;

      result.push({
        id: custom.id || generateId(),
        title: custom.title ? String(custom.title).trim() : "Location",
        ref: {
          locationId: custom.locationId ?? null,
          label: custom.label ?? null,
          notes: custom.notes ?? null,
        },
        showName: true,
        showPhone: false,
      });
    }
  }

  return result;
}

/**
 * Returns a fresh set of default location blocks for a new schedule.
 */
export function getDefaultLocationBlocks(): LocationBlock[] {
  return LEGACY_LOCATION_KEYS.map(({ key, title, showName, showPhone }) => ({
    id: `legacy-${key}`,
    title,
    ref: null,
    showName,
    showPhone,
  }));
}

/**
 * Checks if a LocationBlock has any content worth displaying.
 */
export function locationBlockHasContent(block: LocationBlock): boolean {
  return hasContent(block.ref);
}
