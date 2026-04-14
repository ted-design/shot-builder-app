/**
 * Insights calculation utilities for shot totals and talent coverage.
 * Extracted from PlannerPage.jsx for reuse in Builder tab.
 */

import {
  SHOT_STATUS_VALUES,
  isShotStatusValue,
  normaliseShotStatus,
  shotStatusOptions,
} from "./shotStatus";

export const TALENT_UNASSIGNED_ID = "__talent_unassigned__";
const STATUS_NONE_KEY = "no_status";

const STATUS_LABELS = shotStatusOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const findTalentRecord = (talentLookup, id, name) => {
  if (!talentLookup) return null;
  return talentLookup[id] || talentLookup[name] || null;
};

const normaliseTalentEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    const name = entry.trim();
    if (!name) return null;
    return { id: name, name, talentId: null, headshotPath: null };
  }
  if (typeof entry !== "object") return null;

  const rawId =
    typeof entry.talentId === "string"
      ? entry.talentId
      : typeof entry.id === "string"
      ? entry.id
      : entry.talentId != null
      ? String(entry.talentId)
      : entry.id != null
      ? String(entry.id)
      : null;

  const rawName =
    typeof entry.name === "string"
      ? entry.name
      : typeof entry.fullName === "string"
      ? entry.fullName
      : typeof entry.label === "string"
      ? entry.label
      : typeof entry.displayName === "string"
      ? entry.displayName
      : null;

  const resolvedName = rawName?.trim() || rawId || "Unnamed talent";
  const headshotPath =
    typeof entry.headshotPath === "string"
      ? entry.headshotPath
      : typeof entry.photoPath === "string"
      ? entry.photoPath
      : null;

  return {
    id: rawId || resolvedName,
    name: resolvedName,
    talentId: rawId,
    headshotPath,
  };
};

const normaliseShotTalentEntries = (shot) => {
  if (!shot) return [];
  const deduped = new Map();
  const addEntry = (candidate) => {
    const normalised = normaliseTalentEntry(candidate);
    if (!normalised) return;
    const key = normalised.id || normalised.name;
    if (!key || deduped.has(key)) return;
    deduped.set(key, normalised);
  };

  if (Array.isArray(shot.talent)) {
    shot.talent.forEach(addEntry);
  }
  if (Array.isArray(shot.talentIds)) {
    shot.talentIds.forEach((id) => addEntry({ talentId: id }));
  }
  if (Array.isArray(shot.talentNames)) {
    shot.talentNames.forEach(addEntry);
  }

  return Array.from(deduped.values());
};

const normaliseStatusKey = (status) => {
  if (isShotStatusValue(status)) return normaliseShotStatus(status);
  if (typeof status === "string" && status.trim()) return status.trim();
  return STATUS_NONE_KEY;
};

const formatStatusLabel = (key) => {
  if (key === STATUS_NONE_KEY) return "No status";
  return STATUS_LABELS[key] || key || "No status";
};

/**
 * Calculate shot totals per lane.
 * @param {Array} lanesForExport - Array of lane objects with shots
 * @returns {{ totalShots: number, lanes: Array<{ id: string, name: string, shotCount: number }> }}
 */
export const calculateLaneSummaries = (lanesForExport) => {
  const lanes = lanesForExport || [];
  const summaries = lanes.map((lane) => ({
    id: lane.id,
    name: lane.name,
    shotCount: Array.isArray(lane.shots) ? lane.shots.length : 0,
  }));
  const totalShots = summaries.reduce((acc, lane) => acc + lane.shotCount, 0);
  return { totalShots, lanes: summaries };
};

/**
 * Calculate talent coverage matrix across lanes.
 * @param {Array} lanesForExport - Array of lane objects with shots
 * @param {Object} talentLookup - Map of talent name -> talent record
 * @returns {{ lanes: Array<{ id: string, name: string }>, rows: Array }}
 */
export const calculateTalentSummaries = (lanesForExport, talentLookup = {}) => {
  const laneOrder = Array.isArray(lanesForExport) ? lanesForExport : [];
  const baseByLane = laneOrder.reduce((acc, lane) => ({ ...acc, [lane.id]: 0 }), {});
  const tally = new Map();

  const ensureTalent = (id, name, meta = {}) => {
    if (!tally.has(id)) {
      const talentRecord = findTalentRecord(talentLookup, id, name);
      tally.set(id, {
        id,
        name,
        talentId: meta.talentId || talentRecord?.id || null, // Firestore document ID for filtering
        headshotPath: meta.headshotPath || talentRecord?.headshotPath || null,
        total: 0,
        byLane: { ...baseByLane },
      });
    }
    return tally.get(id);
  };

  ensureTalent(TALENT_UNASSIGNED_ID, "Unassigned");

  laneOrder.forEach((lane) => {
    const laneId = lane.id;
    const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
    laneShots.forEach((shot) => {
      const assignments = normaliseShotTalentEntries(shot);
      if (!assignments.length) {
        const unassigned = ensureTalent(TALENT_UNASSIGNED_ID, "Unassigned");
        unassigned.total += 1;
        unassigned.byLane[laneId] = (unassigned.byLane[laneId] || 0) + 1;
        return;
      }
      const seen = new Set();
      assignments.forEach(({ id, name, talentId, headshotPath }) => {
        const key = id || name || "Unnamed talent";
        if (seen.has(key)) return;
        seen.add(key);
        const entry = ensureTalent(key, name || "Unnamed talent", { talentId, headshotPath });
        entry.total += 1;
        entry.byLane[laneId] = (entry.byLane[laneId] || 0) + 1;
      });
    });
  });

  const rows = Array.from(tally.values()).sort((a, b) => {
    if (a.id === TALENT_UNASSIGNED_ID) return 1;
    if (b.id === TALENT_UNASSIGNED_ID) return -1;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });

  return { lanes: laneOrder.map((lane) => ({ id: lane.id, name: lane.name })), rows };
};

/**
 * Calculate shot totals grouped by a field (e.g., date, talent).
 * Used by Builder tab for accordion grouping.
 * @param {Array} shots - Array of shot objects
 * @param {string} groupBy - Field to group by ('date', 'talent', 'none')
 * @returns {Array<{ key: string, label: string, shotCount: number, shots: Array }>}
 */
export const calculateGroupedShotTotals = (shots, groupBy = "none") => {
  if (!shots?.length || groupBy === "none") {
    return [{ key: "all", label: "All Shots", shotCount: shots?.length || 0, shots: shots || [] }];
  }

  const groups = new Map();

  shots.forEach((shot) => {
    let keys = [];

    if (groupBy === "date") {
      // Group by scheduled date
      const date = shot.scheduledDate || shot.date;
      keys = [date || "unscheduled"];
    } else if (groupBy === "talent") {
      // Group by talent (shot can appear in multiple groups)
      const talents = normaliseShotTalentEntries(shot).map((entry) => entry.name);
      keys = talents.length ? talents : ["unassigned"];
    } else if (groupBy === "status") {
      const statusKey = normaliseStatusKey(shot.status);
      keys = [statusKey];
    } else {
      keys = ["all"];
    }

    keys.forEach((key) => {
      if (!groups.has(key)) {
        groups.set(key, { key, shots: [] });
      }
      groups.get(key).shots.push(shot);
    });
  });

  // Convert to array and add labels/counts
  const result = Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: formatGroupLabel(key, groupBy),
    shotCount: group.shots.length,
    shots: group.shots,
  }));

  // Sort groups
  return result.sort((a, b) => {
    // Always put unscheduled/unassigned at the end
    if (a.key === "unscheduled" || a.key === "unassigned") return 1;
    if (b.key === "unscheduled" || b.key === "unassigned") return -1;

    if (groupBy === "date") {
      // Sort dates chronologically
      return a.key.localeCompare(b.key);
    }
    if (groupBy === "status") {
      const order = (key) => {
        const index = SHOT_STATUS_VALUES.indexOf(key);
        if (index !== -1) return index;
        if (key === STATUS_NONE_KEY) return SHOT_STATUS_VALUES.length + 2;
        return SHOT_STATUS_VALUES.length + 1;
      };
      const delta = order(a.key) - order(b.key);
      if (delta !== 0) return delta;
      return a.label.localeCompare(b.label);
    }
    // Sort alphabetically for talent
    return a.label.localeCompare(b.label);
  });
};

/**
 * Format a group key into a human-readable label.
 */
const formatGroupLabel = (key, groupBy) => {
  if (key === "unscheduled") return "Unscheduled";
  if (key === "unassigned") return "Unassigned Talent";
  if (groupBy === "status") return formatStatusLabel(key);
  if (key === "all") return "All Shots";

  if (groupBy === "date") {
    // Format date string nicely
    try {
      const date = new Date(key);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      // Fall through to return key as-is
    }
  }

  return key;
};

/**
 * Calculate talent totals for Builder insights (without lane breakdown).
 * @param {Array} shots - Array of shot objects
 * @param {Object} talentLookup - Map of talent name -> talent record
 * @returns {Array<{ id: string, name: string, talentId: string|null, headshotPath: string|null, total: number }>}
 */
export const calculateTalentTotals = (shots, talentLookup = {}) => {
  const tally = new Map();

  const ensureTalent = (id, name, meta = {}) => {
    const key = id || name;
    if (!key) return null;
    if (!tally.has(key)) {
      const talentRecord = findTalentRecord(talentLookup, id, name);
      tally.set(key, {
        id: key === "Unassigned" ? TALENT_UNASSIGNED_ID : key,
        name: name || "Unnamed talent",
        talentId: meta.talentId || talentRecord?.id || null,
        headshotPath: meta.headshotPath || talentRecord?.headshotPath || null,
        total: 0,
      });
    }
    return tally.get(key);
  };

  ensureTalent(TALENT_UNASSIGNED_ID, "Unassigned");

  (shots || []).forEach((shot) => {
    const assignments = normaliseShotTalentEntries(shot);
    if (!assignments.length) {
      ensureTalent(TALENT_UNASSIGNED_ID, "Unassigned").total += 1;
      return;
    }
    const seen = new Set();
    assignments.forEach(({ id, name, talentId, headshotPath }) => {
      const key = id || name || "Unnamed talent";
      if (seen.has(key)) return;
      seen.add(key);
      const entry = ensureTalent(key, name || "Unnamed talent", { talentId, headshotPath });
      if (entry) entry.total += 1;
    });
  });

  const rows = Array.from(tally.values()).sort((a, b) => {
    if (a.id === TALENT_UNASSIGNED_ID) return 1;
    if (b.id === TALENT_UNASSIGNED_ID) return -1;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });

  return rows;
};
