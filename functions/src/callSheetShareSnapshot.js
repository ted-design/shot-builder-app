/**
 * Snapshot builder for `callSheetShares.snapshot` (Phase 3 publishing).
 *
 * Takes a set of already-loaded Firestore docs + roster/config state and
 * produces the immutable, reader-ready `CallSheetShareSnapshot` shape defined
 * in `src-vnext/features/publishing/types/callSheetShare.ts`.
 *
 * Pure functions — no Firestore calls inside. The `publishCallSheet` handler
 * is responsible for the reads; this module applies visibility rules, strips
 * private fields, and flattens.
 *
 * Immutability note: the builder always creates new objects / arrays. It does
 * not mutate the inputs. Matches the project's core-rules immutability norm.
 */

"use strict";

function coalesce(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function normalizeString(value, fallback) {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function nullableString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

/**
 * Build the sections array from the call-sheet config, dropping any section
 * whose `visible === false` and coercing each field entry into the
 * `{key, value}` tuple shape the snapshot schema expects.
 */
function buildSections(config) {
  const sections = Array.isArray(config?.sections) ? config.sections : [];
  return sections
    .filter((section) => section && section.visible !== false)
    .map((section) => ({
      key: normalizeString(section.key, ""),
      type: normalizeString(section.type, "generic"),
      title: nullableString(section.title),
      visible: true,
      fields: Array.isArray(section.fields)
        ? section.fields.map((field) => ({
            key: normalizeString(field?.key, ""),
            value: field?.value ?? null,
          }))
        : [],
    }));
}

function buildDayDetailsSnapshot(dayDetails) {
  if (!dayDetails) return null;
  return {
    generalCallTime: nullableString(dayDetails.generalCallTime),
    sunrise: nullableString(dayDetails.sunrise),
    sunset: nullableString(dayDetails.sunset),
    weatherSummary: nullableString(dayDetails.weatherSummary),
    notes: nullableString(dayDetails.notes),
  };
}

function buildScheduleSnapshot({ tracks, entries }) {
  if (!Array.isArray(tracks) && !Array.isArray(entries)) return null;
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const safeEntries = Array.isArray(entries) ? entries : [];

  const trackLookup = new Map();
  safeTracks.forEach((track) => {
    if (track && typeof track.id === "string") {
      trackLookup.set(track.id, normalizeString(track.label, ""));
    }
  });

  return {
    tracks: safeTracks.map((track) => ({
      id: normalizeString(track?.id, ""),
      label: normalizeString(track?.label, ""),
    })),
    entries: safeEntries.map((entry) => ({
      id: normalizeString(entry?.id, ""),
      startTime: nullableString(entry?.startTime),
      endTime: nullableString(entry?.endTime),
      title: normalizeString(entry?.title, ""),
      trackLabel:
        nullableString(entry?.trackLabel) ||
        (entry?.trackId ? trackLookup.get(entry.trackId) || null : null),
      locationLabel: nullableString(entry?.locationLabel),
    })),
  };
}

function buildTalentCalls(talentCalls, talentRoster) {
  const rosterLookup = new Map();
  if (Array.isArray(talentRoster)) {
    talentRoster.forEach((talent) => {
      if (talent && typeof talent.id === "string") {
        rosterLookup.set(talent.id, talent);
      }
    });
  }

  const safeCalls = Array.isArray(talentCalls) ? talentCalls : [];
  return safeCalls.map((call) => {
    const rosterEntry = call?.talentId ? rosterLookup.get(call.talentId) || null : null;
    return {
      talentId: nullableString(call?.talentId),
      name: normalizeString(call?.name, rosterEntry?.name || ""),
      roleLabel: nullableString(call?.roleLabel) || nullableString(rosterEntry?.roleLabel),
      callTime: nullableString(call?.callTime),
      precallTime: nullableString(call?.precallTime),
      wardrobeCall: nullableString(call?.wardrobeCall),
      makeupCall: nullableString(call?.makeupCall),
      onSetCall: nullableString(call?.onSetCall),
      notes: nullableString(call?.notes),
    };
  });
}

function buildCrewCalls(crewCalls, crewRoster) {
  const rosterLookup = new Map();
  if (Array.isArray(crewRoster)) {
    crewRoster.forEach((crew) => {
      if (crew && typeof crew.id === "string") {
        rosterLookup.set(crew.id, crew);
      }
    });
  }

  const safeCalls = Array.isArray(crewCalls) ? crewCalls : [];
  return safeCalls.map((call) => {
    const rosterEntry = call?.crewMemberId ? rosterLookup.get(call.crewMemberId) || null : null;

    // Per plan §3.4: private-by-default — crew phone/email only land in the
    // snapshot when the per-sheet override explicitly opts in.
    const showPhone = coalesce(nullableBoolean(call?.showPhone), false);
    const showEmail = coalesce(nullableBoolean(call?.showEmail), false);

    return {
      crewMemberId: nullableString(call?.crewMemberId),
      name: normalizeString(call?.name, rosterEntry?.name || ""),
      roleLabel: nullableString(call?.roleLabel) || nullableString(rosterEntry?.roleLabel),
      departmentLabel:
        nullableString(call?.departmentLabel) || nullableString(rosterEntry?.departmentLabel),
      callTime: nullableString(call?.callTime),
      precallTime: nullableString(call?.precallTime),
      showPhone,
      showEmail,
      phone: showPhone
        ? nullableString(call?.phone) || nullableString(rosterEntry?.phone)
        : null,
      email: showEmail
        ? nullableString(call?.email) || nullableString(rosterEntry?.email)
        : null,
    };
  });
}

function buildClientCalls(clientCalls) {
  const safeCalls = Array.isArray(clientCalls) ? clientCalls : [];
  return safeCalls.map((call) => ({
    id: normalizeString(call?.id, ""),
    name: normalizeString(call?.name, ""),
    company: nullableString(call?.company),
    roleLabel: nullableString(call?.roleLabel),
    callTime: nullableString(call?.callTime),
  }));
}

function buildLocations(locations) {
  const safe = Array.isArray(locations) ? locations : [];
  return safe.map((location) => ({
    id: nullableString(location?.id),
    label: normalizeString(location?.label, ""),
    address: nullableString(location?.address),
    notes: nullableString(location?.notes),
    latitude: nullableNumber(location?.latitude),
    longitude: nullableNumber(location?.longitude),
  }));
}

function buildBrand(project) {
  return {
    logoUrl: nullableString(project?.brand?.logoUrl) || nullableString(project?.logoUrl),
    primaryColor:
      nullableString(project?.brand?.primaryColor) ||
      nullableString(project?.primaryColor),
  };
}

/**
 * Primary entry point: assemble the full `CallSheetShareSnapshot` shape.
 *
 * @param {object} inputs
 * @param {string} inputs.title - e.g. "Day 3 — 1st Unit — Sep 22"
 * @param {{toMillis: Function} | null} inputs.shootDate - Firestore Timestamp
 * @param {object | null} inputs.config - callSheet/config doc
 * @param {object | null} inputs.dayDetails - dayDetails doc
 * @param {object | null} inputs.schedule - { tracks: [...], entries: [...] }
 * @param {Array | null} inputs.talentCalls
 * @param {Array | null} inputs.crewCalls
 * @param {Array | null} inputs.clientCalls
 * @param {Array | null} inputs.locations
 * @param {Array | null} inputs.talentRoster - project-level talent records
 * @param {Array | null} inputs.crewRoster - project-level crew records
 * @param {object} inputs.project - project doc
 * @param {object} inputs.client - client doc
 * @returns {object} CallSheetShareSnapshot
 */
function buildCallSheetShareSnapshot(inputs) {
  const {
    title,
    shootDate,
    config,
    dayDetails,
    schedule,
    talentCalls,
    crewCalls,
    clientCalls,
    locations,
    talentRoster,
    crewRoster,
    project,
    client,
  } = inputs || {};

  return {
    title: normalizeString(title, "Call Sheet"),
    date: shootDate || null,
    sections: buildSections(config),
    dayDetails: buildDayDetailsSnapshot(dayDetails),
    schedule: buildScheduleSnapshot({
      tracks: schedule?.tracks,
      entries: schedule?.entries,
    }),
    talentCalls: buildTalentCalls(talentCalls, talentRoster),
    crewCalls: buildCrewCalls(crewCalls, crewRoster),
    clientCalls: buildClientCalls(clientCalls),
    locations: buildLocations(locations),
    projectName: normalizeString(project?.name, ""),
    clientName: normalizeString(client?.name, ""),
    brand: buildBrand(project),
  };
}

module.exports = {
  buildCallSheetShareSnapshot,
  // Exposed for granular testing:
  buildSections,
  buildDayDetailsSnapshot,
  buildScheduleSnapshot,
  buildTalentCalls,
  buildCrewCalls,
  buildClientCalls,
  buildLocations,
  buildBrand,
};
