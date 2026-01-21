// src/lib/plannerExportHelpers.js
//
// Pure helper functions for planner export (PDF/CSV) functionality.
// Extracted from PlannerPage.jsx to allow reuse without mounting the page.
// These have NO React dependencies and NO side effects.

import { stripHtml } from "./stripHtml";
import { getPrimaryAttachment } from "./imageHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const UNASSIGNED_LANE_ID = "__unassigned__";

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

const toLaneKey = (laneId) => (laneId ? String(laneId) : UNASSIGNED_LANE_ID);

const formatPlannerProductLabel = (product) => {
  if (!product) return null;
  const name = product.familyName || product.productName || "Product";
  const colour = product.colourName ? ` – ${product.colourName}` : "";
  const rawSize = typeof product.size === "string" ? product.size.trim() : "";
  const sizeLabel =
    product.sizeScope === "all"
      ? "all sizes"
      : rawSize
      ? rawSize
      : "";
  const sizeSuffix = sizeLabel ? ` (${sizeLabel})` : "";
  return `${name}${colour}${sizeSuffix}`.trim();
};

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanos / 1e6);
  }
  return 0;
};

const resolveLaneSortIndex = (shot) => {
  if (typeof shot?.order === "number") return shot.order;
  if (typeof shot?.sortOrder === "number") return shot.sortOrder;
  if (typeof shot?.sortIndex === "number") return shot.sortIndex;
  return Number.MAX_SAFE_INTEGER;
};

const sortShotsForDisplay = (a, b) => {
  const laneDelta = resolveLaneSortIndex(a) - resolveLaneSortIndex(b);
  if (laneDelta !== 0) return laneDelta;

  const dateA = timestampToMillis(a?.date) || Number.POSITIVE_INFINITY;
  const dateB = timestampToMillis(b?.date) || Number.POSITIVE_INFINITY;
  if (dateA !== dateB) return dateA - dateB;

  const createdA = timestampToMillis(a?.createdAt);
  const createdB = timestampToMillis(b?.createdAt);
  if (createdA !== createdB) return createdA - createdB;

  const updatedA = timestampToMillis(a?.updatedAt);
  const updatedB = timestampToMillis(b?.updatedAt);
  if (updatedA !== updatedB) return updatedB - updatedA;

  const nameA = (a?.name || "").localeCompare(b?.name || "");
  if (nameA !== 0) return nameA;

  return (a?.id || "").localeCompare(b?.id || "");
};

const formatShotDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (typeof value === "string") return value.slice(0, 10);
  return "";
};

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

export const normaliseShotTalent = (shot) => {
  if (!shot) return [];
  const deduped = new Map();
  if (Array.isArray(shot.talent)) {
    shot.talent.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        const key = entry.trim();
        if (!key) return;
        if (!deduped.has(key)) deduped.set(key, { id: key, name: key });
        return;
      }
      const rawId = entry.talentId || entry.id || null;
      const name =
        entry.name || entry.fullName || entry.label || (typeof entry.displayName === "string" ? entry.displayName : "");
      const key = rawId || name || null;
      if (!key) return;
      if (!deduped.has(key)) {
        deduped.set(key, { id: rawId || key, name: name || key });
      }
    });
  }

  if (Array.isArray(shot.talentIds)) {
    shot.talentIds.forEach((rawId) => {
      if (!rawId) return;
      if (deduped.has(rawId)) return;
      let derivedName = null;
      if (Array.isArray(shot.talent)) {
        const match = shot.talent.find((entry) => entry?.talentId === rawId || entry?.id === rawId);
        derivedName =
          match?.name || match?.fullName || match?.label || (typeof match?.displayName === "string" ? match.displayName : null);
      }
      deduped.set(rawId, { id: rawId, name: derivedName || String(rawId) });
    });
  }

  if (Array.isArray(shot.talentNames)) {
    shot.talentNames.forEach((name) => {
      if (typeof name !== "string") return;
      const key = name.trim();
      if (!key) return;
      if (!deduped.has(key)) deduped.set(key, { id: key, name: key });
    });
  }

  return Array.from(deduped.values());
};

const resolveShotImageForExport = (shot, products = []) => {
  const candidates = [];
  const primaryAttachment = getPrimaryAttachment(shot?.attachments);
  if (shot) {
    // Prioritize reference/storyboard image if available
    candidates.push(shot.referenceImagePath);
    if (primaryAttachment?.path) {
      candidates.push(primaryAttachment.path);
    }
    candidates.push(shot.previewImageUrl);
    candidates.push(shot.thumbnailUrl);
    candidates.push(shot.thumbnailImagePath);
    candidates.push(shot.imageUrl);
  }
  const productImageCandidates = Array.isArray(products)
    ? products
        .map((product) => {
          if (!product) return null;
          if (product.thumbnailImagePath) return product.thumbnailImagePath;
          if (product.colourImagePath) return product.colourImagePath;
          if (Array.isArray(product.images) && product.images.length) return product.images.find(Boolean);
          return null;
        })
        .filter(Boolean)
    : [];
  candidates.push(...productImageCandidates);

  // Accept both HTTP URLs and Firebase Storage paths
  // Firebase Storage paths start with "images/" and will be handled by AppImage component
  const validCandidate = candidates.find((value) => {
    if (typeof value !== "string") return false;
    // Accept HTTP/HTTPS URLs
    if (/^https?:\/\//i.test(value)) return true;
    // Accept Firebase Storage paths
    if (value.startsWith('images/')) return true;
    // Accept gs:// URLs
    if (value.startsWith('gs://')) return true;
    return false;
  });

  return validCandidate || null;
};

export const groupShotsByLane = (shots) => {
  const grouped = {};
  shots.forEach((shot) => {
    const laneKey = toLaneKey(shot?.laneId);
    if (!grouped[laneKey]) grouped[laneKey] = [];
    grouped[laneKey].push(shot);
  });
  Object.keys(grouped).forEach((laneId) => {
    grouped[laneId].sort(sortShotsForDisplay);
  });
  return grouped;
};

export const buildPlannerExportLanes = (shotsByLane, lanes, normaliseShotProductsFn) => {
  const orderedLanes = [
    { id: UNASSIGNED_LANE_ID, name: "Unassigned" },
    ...lanes.map((lane) => ({ id: lane.id, name: lane.name || "Untitled lane" })),
  ];

  return orderedLanes.map((lane) => {
    const laneShots = Array.isArray(shotsByLane[lane.id]) ? shotsByLane[lane.id] : [];
    const exportShots = laneShots.map((shot) => {
      const normalisedProducts =
        typeof normaliseShotProductsFn === "function"
          ? normaliseShotProductsFn(shot) || []
          : Array.isArray(shot.products)
          ? shot.products
          : [];
      const productLabels = Array.isArray(normalisedProducts)
        ? normalisedProducts.map(formatPlannerProductLabel).filter(Boolean)
        : [];
      const productImages = Array.isArray(normalisedProducts)
        ? normalisedProducts
            .map((product) => {
              if (!product) return null;
              if (product.thumbnailImagePath) return product.thumbnailImagePath;
              if (product.colourImagePath) return product.colourImagePath;
              if (Array.isArray(product.images) && product.images.length) return product.images.find(Boolean);
              return null;
            })
            .filter(Boolean)
        : [];
      const talentNames = normaliseShotTalent(shot).map((entry) => entry.name).filter(Boolean);
      const rawShotNumber = shot?.shotNumber;
      const shotNumber =
        typeof rawShotNumber === "string"
          ? rawShotNumber.trim()
          : typeof rawShotNumber === "number"
          ? String(rawShotNumber)
          : "";
      return {
        id: shot.id,
        laneId: lane.id,
        laneName: lane.name,
        shotNumber,
        name: shot.name || "Untitled shot",
        type: shot.type || "",
        date: formatShotDate(shot.date) || "",
        location: shot.locationName || shot.location || "",
        talent: talentNames,
        products: productLabels,
        notes: stripHtml(shot.description || ""),
        image: resolveShotImageForExport(shot, normalisedProducts),
        attachments: Array.isArray(shot.attachments) ? shot.attachments : [],
        referenceImageCrop: shot.referenceImageCrop || null,
        referenceImagePath: shot.referenceImagePath || null,
        imageUrl: shot.imageUrl || null,
        productImages,
      };
    });
    return { ...lane, shots: exportShots };
  });
};
