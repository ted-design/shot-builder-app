// src/pages/PlannerPage.jsx (global shots version)
//
// This Planner subscribes to lanes under the active project and to a global
// shots collection filtered by `projectId`.  Lanes are stored in
// `projects/{projectId}/lanes` and maintain their per‑project scope.  Shots
// live in `clients/{clientId}/shots` and include a `projectId` field so
// they can be filtered per project.  Dragging a shot between lanes updates
// its `laneId`, and if the lane name is a date (YYYY-MM-DD) the shot's
// `date` field is updated as well.  All other behaviour matches the
// previous Planner implementation.

import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  lanesPath,
  shotsPath,
  legacyProjectShotsPath,
  getActiveProjectId,
  DEFAULT_PROJECT_ID,
  productFamiliesPath,
  productFamilySkusPath,
  productFamilyPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManagePlanner, canManageShots, ROLE, resolveEffectiveRole } from "../lib/rbac";
import { Download, LayoutGrid, List, Settings2, PencilLine } from "lucide-react";
import { formatNotesForDisplay, sanitizeNotesHtml } from "../lib/sanitize";
import { Button } from "../components/ui/button";
import { toast } from "../lib/toast";
import { useStorageImage } from "../hooks/useStorageImage";
import PlannerSummary from "../components/planner/PlannerSummary";
import PlannerExportModal from "../components/planner/PlannerExportModal";
import ShotEditModal from "../components/shots/ShotEditModal";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { selectPlannerGroups } from "../lib/plannerSelectors";
import { sortShotsForView } from "../lib/shotsSelectors";
import {
  shotDraftSchema,
  toDateInputValue,
  parseDateToTimestamp,
  mapProductForWrite,
  extractProductIds,
  mapTalentForWrite,
} from "../lib/shotDraft";
import { z } from "zod";
import { readStorage, writeStorage } from "../lib/safeStorage";
import {
  DEFAULT_SHOT_STATUS,
  isShotStatusValue,
  normaliseShotStatus,
  shotStatusOptions,
} from "../lib/shotStatus";

const PLANNER_VIEW_STORAGE_KEY = "planner:viewMode";
const PLANNER_FIELDS_STORAGE_KEY = "planner:visibleFields";
const UNASSIGNED_LANE_ID = "__unassigned__";

const defaultVisibleFields = {
  notes: true,
  location: true,
  talent: true,
  products: true,
};

const PLANNER_PREFS_STORAGE_KEY = "planner:prefs";

const defaultPlannerPrefs = {
  groupBy: "date",
  sort: "alpha",
};

const TALENT_UNASSIGNED_ID = "__talent_unassigned__";

const PLANNER_GROUP_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "talent", label: "Talent" },
  { value: "none", label: "None" },
];

const PLANNER_SORT_OPTIONS = [
  { value: "alpha", label: "Title A→Z" },
  { value: "alpha_desc", label: "Title Z→A" },
  { value: "date_asc", label: "Date Asc" },
  { value: "date_desc", label: "Date Desc" },
];

const PLANNER_GROUP_VALUES = new Set(PLANNER_GROUP_OPTIONS.map((option) => option.value));
const PLANNER_SORT_VALUES = new Set(PLANNER_SORT_OPTIONS.map((option) => option.value));

const normalisePlannerGroup = (value) =>
  typeof value === "string" && PLANNER_GROUP_VALUES.has(value)
    ? value
    : defaultPlannerPrefs.groupBy;

const normalisePlannerSort = (value) => {
  if (typeof value !== "string" || !value) return defaultPlannerPrefs.sort;
  if (value === "byDate") return "date_asc";
  if (value === "byTalent") return "alpha";
  if (PLANNER_SORT_VALUES.has(value)) return value;
  return defaultPlannerPrefs.sort;
};

const toLaneKey = (laneId) => (laneId ? String(laneId) : UNASSIGNED_LANE_ID);


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

const groupShotsByLane = (shots) => {
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

const normaliseShotForPlanner = (shot, fallbackProjectId = null) => {
  if (!shot || typeof shot !== "object") return null;
  const laneId =
    shot.laneId != null
      ? shot.laneId
      : shot.lane && typeof shot.lane === "object"
      ? shot.lane.id ?? null
      : null;
  const projectId = shot.projectId || fallbackProjectId || DEFAULT_PROJECT_ID;
  const notes = typeof shot.notes === "string" ? shot.notes : shot.description || "";
  const status = normaliseShotStatus(shot.status);
  return { ...shot, laneId, projectId, notes, status };
};

const mergeShotSources = (primaryShots = [], legacyShots = [], fallbackProjectId = null) => {
  const merged = new Map();
  if (Array.isArray(legacyShots)) {
    legacyShots.forEach((shot) => {
      const normalised = normaliseShotForPlanner(shot, fallbackProjectId);
      if (normalised?.id) {
        merged.set(normalised.id, normalised);
      }
    });
  }
  if (Array.isArray(primaryShots)) {
    primaryShots.forEach((shot) => {
      const normalised = normaliseShotForPlanner(shot, fallbackProjectId);
      if (normalised?.id) {
        merged.set(normalised.id, normalised);
      }
    });
  }
  return Array.from(merged.values());
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

const stripHtml = (value) => {
  if (typeof value !== "string" || !value) return "";
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/\r+/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]+/g, " ")
    .trim();
};

const shouldShowLanePlaceholder = (activeShot, laneId, overLane, droppable = true) =>
  Boolean(droppable && activeShot && activeShot.id && overLane === laneId);

const normaliseShotTalent = (shot) => {
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
  if (shot) {
    candidates.push(shot.previewImageUrl);
    candidates.push(shot.thumbnailUrl);
    candidates.push(shot.thumbnailImagePath);
    candidates.push(shot.imageUrl);
  }
  const firstProduct = Array.isArray(products) && products.length ? products[0] : null;
  if (firstProduct) {
    candidates.push(firstProduct.colourImagePath);
    candidates.push(firstProduct.thumbnailImagePath);
    if (Array.isArray(firstProduct.images)) {
      candidates.push(...firstProduct.images);
    }
  }
  const httpCandidate = candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value));
  return httpCandidate || null;
};

const buildPlannerExportLanes = (shotsByLane, lanes, normaliseShotProductsFn) => {
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
        ? normalisedProducts
            .map((product) => {
              if (!product) return null;
              const name = product.familyName || product.productName || "Product";
              const colour = product.colourName ? ` – ${product.colourName}` : "";
              return `${name}${colour}`.trim();
            })
            .filter(Boolean)
        : [];
      const talentNames = normaliseShotTalent(shot).map((entry) => entry.name).filter(Boolean);
      return {
        id: shot.id,
        laneId: lane.id,
        laneName: lane.name,
        name: shot.name || "Untitled shot",
        type: shot.type || "",
        date: formatShotDate(shot.date) || "",
        location: shot.locationName || shot.location || "",
        talent: talentNames,
        products: productLabels,
        notes: stripHtml(shot.description || ""),
        image: resolveShotImageForExport(shot, normalisedProducts),
      };
    });
    return { ...lane, shots: exportShots };
  });
};

const calculateLaneSummaries = (lanesForExport) => {
  const lanes = lanesForExport || [];
  const summaries = lanes.map((lane) => ({
    id: lane.id,
    name: lane.name,
    shotCount: Array.isArray(lane.shots) ? lane.shots.length : 0,
  }));
  const totalShots = summaries.reduce((acc, lane) => acc + lane.shotCount, 0);
  return { totalShots, lanes: summaries };
};

const calculateTalentSummaries = (lanesForExport) => {
  const laneOrder = Array.isArray(lanesForExport) ? lanesForExport : [];
  const baseByLane = laneOrder.reduce((acc, lane) => ({ ...acc, [lane.id]: 0 }), {});
  const tally = new Map();

  const ensureTalent = (id, name) => {
    if (!tally.has(id)) {
      tally.set(id, {
        id,
        name,
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
      const assignments = Array.isArray(shot.talent) ? shot.talent : [];
      if (!assignments.length) {
        const unassigned = ensureTalent(TALENT_UNASSIGNED_ID, "Unassigned");
        unassigned.total += 1;
        unassigned.byLane[laneId] = (unassigned.byLane[laneId] || 0) + 1;
        return;
      }
      const seen = new Set();
      assignments.forEach((name) => {
        const key = name || "Unnamed talent";
        if (seen.has(key)) return;
        seen.add(key);
        const entry = ensureTalent(key, name || "Unnamed talent");
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

const readStoredPlannerView = () => {
  const stored = readStorage(PLANNER_VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "board";
};

const readStoredVisibleFields = () => {
  try {
    const raw = readStorage(PLANNER_FIELDS_STORAGE_KEY);
    if (!raw) return { ...defaultVisibleFields };
    const parsed = JSON.parse(raw);
    return {
      notes:
        typeof parsed.notes === "boolean" ? parsed.notes : defaultVisibleFields.notes,
      location:
        typeof parsed.location === "boolean"
          ? parsed.location
          : defaultVisibleFields.location,
      talent:
        typeof parsed.talent === "boolean" ? parsed.talent : defaultVisibleFields.talent,
      products:
        typeof parsed.products === "boolean"
          ? parsed.products
          : defaultVisibleFields.products,
    };
  } catch (error) {
    console.warn("[Planner] Failed to parse field visibility preferences", error);
    return { ...defaultVisibleFields };
  }
};

const readStoredPlannerPrefs = () => {
  try {
    const raw = readStorage(PLANNER_PREFS_STORAGE_KEY);
    if (!raw) return { ...defaultPlannerPrefs };
    const parsed = JSON.parse(raw);
    const groupBy = normalisePlannerGroup(parsed.groupBy);
    const sort = normalisePlannerSort(parsed.sort);
    return { groupBy, sort };
  } catch (error) {
    console.warn("[Planner] Failed to parse planner preferences", error);
    return { ...defaultPlannerPrefs };
  }
};

class PlannerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Planner] Unhandled rendering error", error, info);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="text-base font-semibold text-red-800">
            Something went wrong loading the planner.
          </div>
          <p>
            Try refreshing the page. If the issue continues, please contact support with the
            steps that caused this error.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Dismiss error
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple droppable component for DnD kit
function DroppableLane({ laneId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane-${laneId}` });
  return (
    <div ref={setNodeRef} data-droppable-over={isOver ? "" : undefined}>
      {children}
    </div>
  );
}

// Simple draggable shot card for DnD kit
function DraggableShot({
  shot,
  disabled,
  viewMode,
  visibleFields,
  onEdit,
  canEditShots,
  normaliseProducts,
  statusOptions,
  onChangeStatus,
  isActive = false,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: shot.id, disabled });
  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  const style = isActive ? { ...dragStyle, opacity: 0.3 } : dragStyle;
  const dragProps = disabled ? {} : { ...listeners, ...attributes };
  const products = typeof normaliseProducts === "function" ? normaliseProducts(shot) : shot.products || [];
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full"
      {...dragProps}
    >
      <ShotCard
        shot={shot}
        viewMode={viewMode}
        visibleFields={visibleFields}
        onEdit={onEdit}
        canEdit={canEditShots}
        products={products}
        statusOptions={statusOptions}
        onChangeStatus={onChangeStatus}
      />
    </div>
  );
}


function ShotCard({
  shot,
  viewMode,
  visibleFields,
  onEdit,
  canEdit,
  products,
  statusOptions,
  onChangeStatus,
}) {
  const typeLabel = shot.type || "–";
  const dateLabel = formatShotDate(shot.date) || "—";
  const notesHtml = visibleFields.notes ? formatNotesForDisplay(shot.description) : "";
  const talentList = Array.isArray(shot.talent)
    ? shot.talent
        .map((entry) => entry?.name)
        .filter(Boolean)
    : Array.isArray(shot.talentIds)
    ? shot.talentIds
        .map((id) => {
          if (!shot.talent) return null;
          const match = shot.talent.find((entry) => entry?.talentId === id);
          return match?.name || null;
        })
        .filter(Boolean)
    : [];
  const productLabels = Array.isArray(products)
    ? products.map((product) => {
        const name = product?.familyName || product?.productName || "Product";
        const colour = product?.colourName ? ` – ${product.colourName}` : "";
        return `${name}${colour}`;
      })
    : [];
  const statusList = Array.isArray(statusOptions) && statusOptions.length ? statusOptions : shotStatusOptions;
  const statusValue = normaliseShotStatus(shot.status);
  const statusControlDisabled = !canEdit || typeof onChangeStatus !== "function";
  const handleStatusChange = (event) => {
    event.stopPropagation();
    const nextValue = event.target.value;
    if (statusControlDisabled) return;
    if (nextValue === statusValue) return;
    onChangeStatus(shot, nextValue);
  };
  const firstProduct = Array.isArray(products) && products.length ? products[0] : null;
  const derivedThumbnail =
    firstProduct?.colourImagePath ||
    firstProduct?.thumbnailImagePath ||
    (Array.isArray(firstProduct?.images) && firstProduct.images.length
      ? firstProduct.images[0]
      : null) ||
    null;
  const thumbnailSrc = visibleFields.products ? derivedThumbnail : null;
  const thumbnailUrl = useStorageImage(thumbnailSrc);
  const showThumbnailFrame = Boolean(visibleFields.products && firstProduct);
  const locationLabel = shot.locationName || "–";
  const showDetailsSection =
    visibleFields.location || visibleFields.talent || visibleFields.products;

  const cardBaseClass =
    viewMode === "list"
      ? "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      : "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm";

  const metaContainerClass =
    viewMode === "list"
      ? "grid gap-2 text-xs text-slate-600 md:grid-cols-3"
      : "flex flex-col gap-2 text-xs text-slate-600";

  return (
    <div className={`${cardBaseClass} transition hover:border-primary/40 hover:shadow-md`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {showThumbnailFrame && (
            thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`${shot.name} thumbnail`}
                className="h-12 w-12 flex-none rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                No image
              </div>
            )
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">{shot.name}</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{typeLabel}</span>
                  <span>•</span>
                  <span>{dateLabel}</span>
                  {shot.laneId && shot.laneId === UNASSIGNED_LANE_ID && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Unassigned</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <select
                  aria-label={`${shot.name} status`}
                  className={`h-8 min-w-[130px] rounded-md border px-2 text-xs font-medium transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                    statusControlDisabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  value={statusValue}
                  onChange={handleStatusChange}
                  disabled={statusControlDisabled}
                  onPointerDownCapture={(event) => event.stopPropagation()}
                  onPointerUpCapture={(event) => event.stopPropagation()}
                >
                  {statusList.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onEdit?.(shot);
                    }}
                    onPointerDownCapture={(event) => {
                      // Prevent the parent draggable from hijacking pointer events.
                      event.stopPropagation();
                    }}
                    onPointerUpCapture={(event) => {
                      event.stopPropagation();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={`Edit ${shot.name}`}
                  >
                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            {visibleFields.notes && notesHtml && (
              <div
                className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: notesHtml }}
              />
            )}
          </div>
        </div>
        {showDetailsSection && (
          <div className={metaContainerClass}>
            {visibleFields.location && (
              <div>
                <span className="font-medium text-slate-700">Location:</span> {locationLabel}
              </div>
            )}
            {visibleFields.talent && (
              <div>
                <span className="font-medium text-slate-700">Talent:</span>{" "}
                {talentList.length ? talentList.join(", ") : "–"}
              </div>
            )}
            {visibleFields.products && (
              <div>
                <span className="font-medium text-slate-700">Products:</span>{" "}
                {productLabels.length ? productLabels.slice(0, 3).join(", ") : "–"}
                {productLabels.length > 3 && "…"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlannerPageContent() {
  const [lanes, setLanes] = useState([]);
  const [name, setName] = useState("");
  const [shotsByLane, setShotsByLane] = useState({});
  const [plannerShots, setPlannerShots] = useState([]);
  const [families, setFamilies] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const [talentLoadError, setTalentLoadError] = useState(null);
  const [lanesLoading, setLanesLoading] = useState(true);
  const [shotsLoading, setShotsLoading] = useState(true);
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => readStoredPlannerView());
  const [visibleFields, setVisibleFields] = useState(() => readStoredVisibleFields());
  const [plannerPrefs, setPlannerPrefs] = useState(() => readStoredPlannerPrefs());
  const [exportOpen, setExportOpen] = useState(false);
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const fieldSettingsRef = useRef(null);
  const [editingShot, setEditingShot] = useState(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [activeDragShot, setActiveDragShot] = useState(null);
  const [overLaneId, setOverLaneId] = useState(null);
  const familyDetailCacheRef = useRef(new Map());
  const pendingShotEditRef = useRef(null);
  const subscriptionErrorNotifiedRef = useRef(false);
  const statusBackfillRef = useRef(new Set());
  const autoScrollRef = useRef({ lastTick: 0, active: false });
  const boardScrollRef = useRef(null);
  const projectId = getActiveProjectId();
  const {
    clientId,
    role: globalRole,
    projectRoles = {},
    ready: authReady,
    loadingClaims,
  } = useAuth();
  const userRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectRoles, projectId]
  );
  const canEditPlanner = canManagePlanner(userRole);
  const canEditShots = canManageShots(userRole);
  const isAuthLoading = !authReady || loadingClaims;
  const currentLanesPath = useMemo(() => lanesPath(projectId, clientId), [projectId, clientId]);
  const currentShotsPath = useMemo(() => shotsPath(clientId), [clientId]);
  const currentLegacyShotsPath = useMemo(
    () => legacyProjectShotsPath(projectId, clientId),
    [projectId, clientId]
  );
  const currentProductFamiliesPath = useMemo(
    () => productFamiliesPath(clientId),
    [clientId]
  );
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);
  const productFamilySkusPathForClient = useCallback(
    (familyId) => productFamilySkusPath(familyId, clientId),
    [clientId]
  );
  const productFamilyPathForClient = useCallback(
    (familyId) => productFamilyPath(familyId, clientId),
    [clientId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const familiesById = useMemo(() => {
    const map = new Map();
    families.forEach((family) => {
      if (family?.id) {
        map.set(family.id, family);
      }
    });
    return map;
  }, [families]);

  const plannerShotsById = useMemo(() => {
    const map = new Map();
    plannerShots.forEach((shot) => {
      if (shot?.id) {
        map.set(shot.id, shot);
      }
    });
    return map;
  }, [plannerShots]);

  const talentOptions = useMemo(
    () =>
      talent.map((entry) => {
        const name =
          entry?.name ||
          [entry?.firstName, entry?.lastName].filter(Boolean).join(" ").trim() ||
          "Unnamed talent";
        return { talentId: entry.id, name };
      }),
    [talent]
  );

  const talentNoOptionsMessage =
    talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available");

  useEffect(() => {
    familyDetailCacheRef.current.clear();
  }, [clientId]);

  const handleSubscriptionError = useCallback(
    (scope) => (error) => {
      console.error(`[Planner] Failed to subscribe to ${scope}`, error);
      setSubscriptionError(error);
      if (!subscriptionErrorNotifiedRef.current) {
        toast.error("We hit a problem loading planner data. Try refreshing the page.");
        subscriptionErrorNotifiedRef.current = true;
      }
    },
    [setSubscriptionError, subscriptionErrorNotifiedRef]
  );

  useEffect(() => {
    if (!authReady) {
      return undefined;
    }

    if (!projectId || !clientId) {
      setLanes([]);
      setShotsByLane({});
      setPlannerShots([]);
      setFamilies([]);
      setLanesLoading(false);
      setShotsLoading(false);
      setFamiliesLoading(false);
      return undefined;
    }

    setSubscriptionError(null);
    subscriptionErrorNotifiedRef.current = false;
    setLanesLoading(true);
    setShotsLoading(true);
    setFamiliesLoading(true);
    setLanes([]);
    setShotsByLane({});
    setPlannerShots([]);

    let cancelled = false;

    const laneRef = collection(db, ...currentLanesPath);
    const lanesQuery = query(laneRef, orderBy("order", "asc"));
    const shotsRef = collection(db, ...currentShotsPath);
    const shotsQuery = query(shotsRef, where("projectId", "==", projectId));
    const legacyShotsRef = collection(db, ...currentLegacyShotsPath);
    const familiesRef = collection(db, ...currentProductFamiliesPath);
    const familiesQuery = query(familiesRef, orderBy("styleName", "asc"));

    const handleLanesError = (error) => {
      if (cancelled) return;
      setLanes([]);
      setLanesLoading(false);
      handleSubscriptionError("lanes")(error);
    };

    let primaryLoaded = false;
    let legacyLoaded = false;
    let latestPrimaryShots = [];
    let latestLegacyShots = [];

    const backfillMissingStatuses = (candidates) => {
      if (!Array.isArray(candidates) || !candidates.length) return;
      if (!currentShotsPath || !currentShotsPath.length) return;
      const updates = [];
      candidates.forEach((shot) => {
        const shotId = shot?.id;
        if (!shotId || statusBackfillRef.current.has(shotId)) return;
        if (isShotStatusValue(shot?.status)) return;
        statusBackfillRef.current.add(shotId);
        updates.push(
          updateDoc(doc(db, ...currentShotsPath, shotId), { status: DEFAULT_SHOT_STATUS }).catch(
            (error) => {
              statusBackfillRef.current.delete(shotId);
              console.warn(`[Planner] Failed to backfill status for shot ${shotId}`, error);
            }
          )
        );
      });
      if (updates.length) {
        Promise.all(updates).catch((error) => {
          console.warn("[Planner] Failed to backfill shot statuses", error);
        });
      }
    };

    const applyCombinedShots = () => {
      if (cancelled) return;
      const merged = mergeShotSources(latestPrimaryShots, latestLegacyShots, projectId);
      setPlannerShots(merged);
      setShotsByLane(groupShotsByLane(merged));
      backfillMissingStatuses(latestPrimaryShots);
    };

    const updateShotsLoading = () => {
      if (!cancelled && primaryLoaded && legacyLoaded) {
        setShotsLoading(false);
      }
    };

    const handlePrimaryShotsError = (error) => {
      if (cancelled) return;
      latestPrimaryShots = [];
      primaryLoaded = true;
      applyCombinedShots();
      setShotsLoading(false);
      handleSubscriptionError("shots")(error);
    };

    const handleLegacyShotsError = (error) => {
      if (cancelled) return;
      latestLegacyShots = [];
      legacyLoaded = true;
      applyCombinedShots();
      setShotsLoading(false);
      handleSubscriptionError("legacy shots")(error);
    };

    const handleFamiliesError = (error) => {
      if (cancelled) return;
      setFamilies([]);
      setFamiliesLoading(false);
      handleSubscriptionError("product families")(error);
    };

    const unsubLanes = onSnapshot(
      lanesQuery,
      (snapshot) => {
        if (cancelled) return;
        setLanes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLanesLoading(false);
      },
      handleLanesError
    );

    const unsubShots = onSnapshot(
      shotsQuery,
      (snapshot) => {
        if (cancelled) return;
        latestPrimaryShots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        primaryLoaded = true;
        applyCombinedShots();
        updateShotsLoading();
      },
      handlePrimaryShotsError
    );

    const unsubLegacyShots = onSnapshot(
      legacyShotsRef,
      (snapshot) => {
        if (cancelled) return;
        latestLegacyShots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        legacyLoaded = true;
        applyCombinedShots();
        updateShotsLoading();
      },
      handleLegacyShotsError
    );

    const unsubFamilies = onSnapshot(
      familiesQuery,
      (snapshot) => {
        if (cancelled) return;
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setFamiliesLoading(false);
      },
      handleFamiliesError
    );

    return () => {
      cancelled = true;
      unsubLanes();
      unsubShots();
      unsubLegacyShots();
      unsubFamilies();
    };
  }, [
    authReady,
    clientId,
    projectId,
    currentLanesPath,
    currentShotsPath,
    currentLegacyShotsPath,
    currentProductFamiliesPath,
    handleSubscriptionError,
    mergeShotSources,
  ]);

  useEffect(() => {
    if (!clientId) {
      setTalent([]);
      setLocations([]);
      setTalentLoadError(null);
      return undefined;
    }

    const talentQuery = query(collection(db, ...currentTalentPath), orderBy("name", "asc"));
    const locationsQuery = query(collection(db, ...currentLocationsPath), orderBy("name", "asc"));

    const unsubTalent = onSnapshot(
      talentQuery,
      (snapshot) => {
        setTalent(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setTalentLoadError(null);
      },
      (error) => {
        const { code, message } = describeFirebaseError(error, "Unable to load talent.");
        setTalent([]);
        setTalentLoadError(
          code === "permission-denied"
            ? "You don't have permission to load talent."
            : message
        );
        toast.error({ title: "Failed to load talent", description: `${code}: ${message}` });
      }
    );

    const unsubLocations = onSnapshot(
      locationsQuery,
      (snapshot) => {
        setLocations(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        const { code, message } = describeFirebaseError(error, "Unable to load locations.");
        setLocations([]);
        toast.error({ title: "Failed to load locations", description: `${code}: ${message}` });
      }
    );

    return () => {
      unsubTalent();
      unsubLocations();
    };
  }, [clientId, currentTalentPath, currentLocationsPath]);

  useEffect(() => {
    writeStorage(PLANNER_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(PLANNER_FIELDS_STORAGE_KEY, JSON.stringify(visibleFields));
  }, [visibleFields]);

  useEffect(() => {
    writeStorage(
      PLANNER_PREFS_STORAGE_KEY,
      JSON.stringify({
        groupBy: plannerPrefs.groupBy,
        sort: plannerPrefs.sort,
      })
    );
  }, [plannerPrefs]);

  useEffect(() => {
    if (!fieldSettingsOpen) return undefined;
    const handleClick = (event) => {
      if (!fieldSettingsRef.current) return;
      if (!fieldSettingsRef.current.contains(event.target)) {
        setFieldSettingsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [fieldSettingsOpen]);

  // Create a new lane with a given name.  Lanes are ordered sequentially
  // based on the length of the current lane array.  Names are arbitrary but
  // using a date format (YYYY-MM-DD) allows drag events to update shot dates.
  const addLane = async () => {
    if (!canEditPlanner) {
      toast.error("You do not have permission to modify the planner.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await addDoc(collection(db, ...currentLanesPath), { name: trimmed, order: lanes.length });
      setName("");
    } catch (error) {
      console.error("[Planner] Failed to add lane", error);
      toast.error("Could not create lane");
    }
  };

  const generateProductId = useCallback(() => Math.random().toString(36).slice(2, 10), []);

  const withDerivedProductFields = useCallback(
    (product) => {
      if (!product) return null;

      const resolvedFamilyId =
        product.familyId || product.productId || product.productIdRef || product.id || null;
      const family = resolvedFamilyId ? familiesById.get(resolvedFamilyId) : null;
      const fallbackSizes = Array.isArray(product.sizeList)
        ? product.sizeList
        : Array.isArray(family?.sizes)
        ? family.sizes
        : [];
      const rawStatus = product.status;
      const rawScope = product.sizeScope;
      const hasExplicitSize = product.size != null && product.size !== "";
      const derivedStatus =
        rawStatus === "pending-size" || rawScope === "pending"
          ? "pending-size"
          : hasExplicitSize
          ? "complete"
          : "complete";
      const derivedScope =
        derivedStatus === "pending-size"
          ? "pending"
          : rawScope === "all"
          ? "all"
          : hasExplicitSize
          ? "single"
          : rawScope === "single"
          ? "single"
          : "all";
      const effectiveSize = derivedStatus === "pending-size" ? null : product.size || null;
      const familyThumbnail = family?.thumbnailImagePath || family?.headerImagePath || null;
      const colourImage = product.colourImagePath || product.colourThumbnail || null;
      const thumbnailImage = product.thumbnailImagePath || colourImage || familyThumbnail || null;
      const baseImages = Array.isArray(product.images) ? product.images : [];
      const imageCandidates = [
        ...baseImages,
        colourImage,
        product.thumbnailImagePath || null,
        familyThumbnail,
      ].filter(Boolean);
      const uniqueImages = [...new Set(imageCandidates)];
      const resolvedFamilyName =
        product.familyName || product.productName || family?.styleName || "";
      const resolvedColourName = product.colourName || product.colour || "";

      return {
        ...product,
        familyId: resolvedFamilyId,
        productId: product.productId || resolvedFamilyId || null,
        familyName: resolvedFamilyName,
        productName: product.productName || resolvedFamilyName || "Product",
        styleNumber: product.styleNumber || family?.styleNumber || null,
        thumbnailImagePath: thumbnailImage,
        colourId: product.colourId || product.colourwayId || null,
        colourwayId: product.colourwayId || product.colourId || null,
        colourName: resolvedColourName,
        colourImagePath: colourImage || familyThumbnail || null,
        images: uniqueImages,
        skuCode: product.skuCode || null,
        skuId: product.skuId || null,
        size: effectiveSize,
        sizeId: product.sizeId || (effectiveSize ? effectiveSize : null),
        sizeScope: derivedScope,
        status: derivedStatus,
        sizeList: fallbackSizes,
      };
    },
    [familiesById]
  );

  const normaliseShotProducts = useCallback(
    (shot) => {
      if (!shot) return [];
      if (Array.isArray(shot.products) && shot.products.length) {
        return shot.products.map((product) => withDerivedProductFields(product)).filter(Boolean);
      }
      if (!Array.isArray(shot.productIds) || !shot.productIds.length) return [];
      return shot.productIds
        .map((familyId) => {
          const family = familyId ? familiesById.get(familyId) : null;
          if (!family) return null;
          return withDerivedProductFields({
            id: `legacy-${familyId}`,
            familyId,
            productId: familyId,
            familyName: family.styleName,
            productName: family.styleName,
            styleNumber: family.styleNumber || null,
            thumbnailImagePath: family.thumbnailImagePath || family.headerImagePath || null,
            colourId: null,
            colourwayId: null,
            colourName: "Any colour",
            colourImagePath: family.thumbnailImagePath || family.headerImagePath || null,
            skuCode: null,
            size: null,
            sizeList: Array.isArray(family.sizes) ? family.sizes : [],
            status: "complete",
            sizeScope: "all",
          });
        })
        .filter(Boolean);
    },
    [familiesById, withDerivedProductFields]
  );

  const mapShotTalentToSelection = useCallback(
    (shot) => {
      if (!shot) return [];
      if (Array.isArray(shot.talent) && shot.talent.length) {
        return shot.talent
          .map((entry) => {
            if (!entry || !entry.talentId) return null;
            const fallback = talentOptions.find((opt) => opt.talentId === entry.talentId);
            return {
              talentId: entry.talentId,
              name: entry.name || fallback?.name || "Unnamed talent",
            };
          })
          .filter(Boolean);
      }
      if (Array.isArray(shot.talentIds) && shot.talentIds.length) {
        return shot.talentIds
          .map((id) => {
            if (!id) return null;
            const fallback = talentOptions.find((opt) => opt.talentId === id);
            return { talentId: id, name: fallback?.name || "Unnamed talent" };
          })
          .filter(Boolean);
      }
      return [];
    },
    [talentOptions]
  );

  const openShotEditor = useCallback(
    (shot) => {
      if (!shot) return;
      try {
        const products = normaliseShotProducts(shot);
        const talentSelection = mapShotTalentToSelection(shot);
        setEditingShot({
          shot,
          draft: {
            name: shot.name || "",
            description: shot.description || "",
            type: shot.type || "",
            date: toDateInputValue(shot.date),
            locationId: shot.locationId || "",
            talent: talentSelection,
            products,
          },
        });
      } catch (error) {
        console.error("[Planner] Failed to prepare shot for editing", error);
        toast.error("Unable to open shot editor");
      }
    },
    [mapShotTalentToSelection, normaliseShotProducts]
  );

  const handleOpenShotEdit = useCallback(
    (shot) => {
      if (!shot) return;
      if (!canEditShots) {
        if (isAuthLoading) {
          pendingShotEditRef.current = shot;
          return;
        }
        toast.error("You do not have permission to edit shots.");
        return;
      }
      openShotEditor(shot);
    },
    [canEditShots, isAuthLoading, openShotEditor]
  );

  const updateEditingDraft = useCallback((patch) => {
    setEditingShot((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        draft: {
          ...previous.draft,
          ...patch,
        },
      };
    });
  }, []);

  const closeShotEditor = useCallback(() => {
    setEditingShot(null);
    setIsSavingShot(false);
  }, []);

  // moved below `updateShot` to avoid TDZ when referenced in deps

  useEffect(() => {
    if (canEditShots && pendingShotEditRef.current) {
      const shotToOpen = pendingShotEditRef.current;
      pendingShotEditRef.current = null;
      openShotEditor(shotToOpen);
    } else if (!isAuthLoading && !canEditShots) {
      pendingShotEditRef.current = null;
    }
  }, [canEditShots, isAuthLoading, openShotEditor]);

  useEffect(() => {
    if (!canEditShots && editingShot) {
      setEditingShot(null);
      setIsSavingShot(false);
    }
  }, [canEditShots, editingShot]);

  const updateViewMode = useCallback(
    (nextMode) =>
      setViewMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode)),
    []
  );

  const updateGroupBy = useCallback((nextGroup) => {
    const normalised = normalisePlannerGroup(nextGroup);
    setPlannerPrefs((prev) =>
      prev.groupBy === normalised ? prev : { ...prev, groupBy: normalised }
    );
  }, []);

  const updatePlannerSort = useCallback((nextSort) => {
    const normalised = normalisePlannerSort(nextSort);
    setPlannerPrefs((prev) =>
      prev.sort === normalised ? prev : { ...prev, sort: normalised }
    );
  }, []);

  const handleUpdateShotStatus = useCallback(
    async (shot, nextStatus) => {
      if (!shot || !shot.id) return;
      if (!canEditShots) {
        toast.error("You do not have permission to edit shots.");
        return;
      }
      const resolved = normaliseShotStatus(nextStatus);
      if (resolved === normaliseShotStatus(shot.status)) return;
      try {
        await updateShot(shot, { status: resolved });
      } catch (error) {
        console.error("[Planner] Failed to update shot status", error);
        toast.error("Could not update shot status");
      }
    },
    [canEditShots, updateShot]
  );

  const handleAutoScrollPointerMove = useCallback(
    (event) => {
      if (!autoScrollRef.current.active) return;
      if (typeof PointerEvent !== "undefined" && !(event instanceof PointerEvent)) return;
      const now = performance.now();
      if (now - autoScrollRef.current.lastTick < 40) return;
      autoScrollRef.current.lastTick = now;
      const threshold = 72;
      const step = 28;
      const { clientX, clientY } = event;
      if (clientY < threshold) {
        window.scrollBy({ top: -step, behavior: "smooth" });
      } else if (clientY > window.innerHeight - threshold) {
        window.scrollBy({ top: step, behavior: "smooth" });
      }
      if (viewMode === "board" && boardScrollRef.current) {
        const bounds = boardScrollRef.current.getBoundingClientRect();
        if (clientX < bounds.left + threshold) {
          boardScrollRef.current.scrollBy({ left: -step, behavior: "smooth" });
        } else if (clientX > bounds.right - threshold) {
          boardScrollRef.current.scrollBy({ left: step, behavior: "smooth" });
        }
      }
    },
    [viewMode]
  );

  const cleanupAutoScroll = useCallback(() => {
    if (!autoScrollRef.current.active) return;
    autoScrollRef.current.active = false;
    window.removeEventListener("pointermove", handleAutoScrollPointerMove);
  }, [handleAutoScrollPointerMove]);

  const handleDragStart = useCallback(
    ({ active }) => {
      const shotId = active?.id;
      if (!shotId) return;
      const shot = plannerShotsById.get(shotId) || null;
      setActiveDragShot(shot);
      setOverLaneId(shot?.laneId ?? null);
      if (!autoScrollRef.current.active) {
        autoScrollRef.current.active = true;
        autoScrollRef.current.lastTick = 0;
        window.addEventListener("pointermove", handleAutoScrollPointerMove, { passive: true });
      }
    },
    [plannerShotsById, handleAutoScrollPointerMove]
  );

  const handleDragOver = useCallback(({ over }) => {
    if (!over?.id || typeof over.id !== "string") {
      setOverLaneId(null);
      return;
    }
    if (over.id.startsWith("lane-")) {
      setOverLaneId(over.id.slice(5));
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      cleanupAutoScroll();
      const shotId = event.active?.id;
      const overRawId = event.over?.id;
      setActiveDragShot(null);
      setOverLaneId(null);
      if (!canEditPlanner) return;
      if (!shotId || typeof overRawId !== "string" || !overRawId.startsWith("lane-")) return;
      const laneId = overRawId.slice(5);
      const shot = plannerShotsById.get(shotId);
      if (shot && shot.laneId === laneId) return;
      const patch = { laneId };
      if (laneId) {
        const lane = lanes.find((l) => l.id === laneId);
        if (lane && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) patch.date = lane.name;
      }
      try {
        await updateDoc(doc(db, ...currentShotsPath, shotId), patch);
      } catch (error) {
        console.error("[Planner] Failed to move shot", error);
        toast.error("Could not move shot");
      }
    },
    [cleanupAutoScroll, canEditPlanner, plannerShotsById, lanes, currentShotsPath, toast]
  );

  const handleDragCancel = useCallback(() => {
    cleanupAutoScroll();
    setActiveDragShot(null);
    setOverLaneId(null);
  }, [cleanupAutoScroll]);

  useEffect(() => () => cleanupAutoScroll(), [cleanupAutoScroll]);

  const lanesForExport = useMemo(
    () => buildPlannerExportLanes(shotsByLane, lanes, normaliseShotProducts),
    [shotsByLane, lanes, normaliseShotProducts]
  );
  const laneSummary = useMemo(() => calculateLaneSummaries(lanesForExport), [lanesForExport]);
  const talentSummary = useMemo(() => calculateTalentSummaries(lanesForExport), [lanesForExport]);

  const isPlannerLoading = isAuthLoading || lanesLoading || shotsLoading || familiesLoading;
  const totalShots = laneSummary.totalShots;

  const isListView = viewMode === "list";
  const laneWrapperClass = isListView
    ? "flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    : "flex min-w-[280px] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const shotListClass = isListView
    ? "flex flex-col gap-3"
    : "flex flex-col gap-3";
  const unassignedShots = shotsByLane[UNASSIGNED_LANE_ID] || [];
  const groupBy = plannerPrefs.groupBy;
  const sortBy = plannerPrefs.sort;
  const derivedGroups = useMemo(
    () => (groupBy === "none" ? [] : selectPlannerGroups(plannerShots, { groupBy, sortBy })),
    [plannerShots, groupBy, sortBy]
  );

  const renderLaneBlock = (laneId, title, laneShots, laneMeta = null, options = {}) => {
    const droppable = options.droppable !== false;
    const laneList = Array.isArray(laneShots) ? laneShots : [];
    const displayShots = options.sortBy
      ? sortShotsForView(laneList, { sortBy: options.sortBy })
      : laneList;
    const isActiveLane = droppable && overLaneId === laneId;
    const placeholderVisible = shouldShowLanePlaceholder(activeDragShot, laneId, overLaneId, droppable);
    const card = (
      <div
        className={`${laneWrapperClass} ${
          isActiveLane ? "border-primary/60 shadow-lg ring-1 ring-primary/20" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {droppable && laneMeta && canEditPlanner && (
            <span className="flex items-center gap-2 text-xs text-primary">
              <button onClick={() => renameLane(laneMeta)} className="hover:underline">
                Rename
              </button>
              <button onClick={() => removeLane(laneMeta)} className="hover:underline">
                Delete
              </button>
            </span>
          )}
        </div>
        <div className={shotListClass}>
          {displayShots.map((sh) => (
            <DraggableShot
              key={sh.id}
              shot={sh}
              disabled={!droppable || !canEditPlanner}
              viewMode={viewMode}
              visibleFields={visibleFields}
              onEdit={handleOpenShotEdit}
              canEditShots={canEditShots}
              normaliseProducts={normaliseShotProducts}
              statusOptions={shotStatusOptions}
              onChangeStatus={handleUpdateShotStatus}
              isActive={activeDragShot?.id === sh.id}
            />
          ))}
          {placeholderVisible && (
            <div className="h-16 rounded-md border-2 border-dashed border-primary/60 bg-primary/5" />
          )}
        </div>
      </div>
    );

    if (!droppable) {
      return (
        <div key={laneId} className="min-w-[260px] flex-1">
          {card}
        </div>
      );
    }

    return (
      <DroppableLane key={laneId} laneId={laneId}>
        {card}
      </DroppableLane>
    );
  };

  const buildShotProduct = useCallback(
    (selection, previous = null) => {
      const { family, colour, size, status: requestedStatus, sizeScope } = selection;
      const baseStatus = requestedStatus === "pending-size" ? "pending-size" : "complete";
      const resolvedScope =
        baseStatus === "pending-size"
          ? "pending"
          : sizeScope === "all"
          ? "all"
          : size
          ? "single"
          : sizeScope === "single"
          ? "single"
          : "all";
      const resolvedSize =
        baseStatus === "pending-size"
          ? null
          : resolvedScope === "all"
          ? null
          : size || null;
      const colourImage = colour.imagePath || colour.thumbnailImagePath || null;
      const colourImages = Array.isArray(colour.images)
        ? colour.images
        : colourImage
        ? [colourImage]
        : [];

      return {
        id: previous?.id || generateProductId(),
        familyId: family.id,
        familyName: family.styleName,
        styleNumber: family.styleNumber || null,
        thumbnailImagePath:
          family.thumbnailImagePath || family.headerImagePath || colourImage || null,
        colourId: colour.id || null,
        colourwayId: colour.id || null,
        colourName: colour.colorName || "",
        colourImagePath: colourImage || null,
        images: colourImages,
        skuCode: colour.skuCode || null,
        skuId: colour.skuId || null,
        size: resolvedSize,
        sizeId: resolvedSize || null,
        sizeScope: resolvedScope,
        status: baseStatus,
        sizeList: Array.isArray(family.sizes) ? family.sizes : [],
      };
    },
    [generateProductId]
  );

  const loadFamilyDetails = useCallback(
    async (familyId) => {
      if (!familyId) return { colours: [], sizes: [] };
      if (familyDetailCacheRef.current.has(familyId)) {
        return familyDetailCacheRef.current.get(familyId);
      }
      try {
        const skusPath = productFamilySkusPathForClient(familyId);
        const snapshot = await getDocs(
          query(collection(db, ...skusPath), orderBy("colorName", "asc"))
        );
        const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        const family = familiesById.get(familyId);
        const details = {
          colours,
          sizes: Array.isArray(family?.sizes) ? family.sizes : [],
        };
        familyDetailCacheRef.current.set(familyId, details);
        return details;
      } catch (error) {
        console.error("[Planner] Failed to load family details", error);
        toast.error("Unable to load product information");
        throw error;
      }
    },
    [familiesById, productFamilySkusPathForClient]
  );

  const toFamilyIdSet = (source = {}) => {
    const ids = new Set();
    if (Array.isArray(source?.productIds)) {
      source.productIds.forEach((id) => {
        if (id) ids.add(id);
      });
    }
    if (Array.isArray(source?.products)) {
      source.products.forEach((item) => {
        const id = item?.familyId || item?.productId;
        if (id) ids.add(id);
      });
    }
    return ids;
  };

  const updateReverseIndexes = useCallback(
    async ({ shotId, before, after }) => {
      const prevProductIds = toFamilyIdSet(before);
      const nextProductIds = toFamilyIdSet(after);
      const productAdds = [...nextProductIds].filter((id) => !prevProductIds.has(id));
      const productRemovals = [...prevProductIds].filter((id) => !nextProductIds.has(id));

      await Promise.all(
        productAdds.map((id) =>
          updateDoc(doc(db, ...productFamilyPathForClient(id)), {
            shotIds: arrayUnion(shotId),
          }).catch(() => {})
        )
      );

      await Promise.all(
        productRemovals.map((id) =>
          updateDoc(doc(db, ...productFamilyPathForClient(id)), {
            shotIds: arrayRemove(shotId),
          }).catch(() => {})
        )
      );

      const prevTalentIds = new Set(before.talentIds || []);
      const nextTalentIds = new Set(after.talentIds || []);
      const talentAdds = [...nextTalentIds].filter((id) => !prevTalentIds.has(id));
      const talentRemovals = [...prevTalentIds].filter((id) => !nextTalentIds.has(id));

      await Promise.all(
        talentAdds.map((id) =>
          updateDoc(doc(db, ...currentTalentPath, id), {
            shotIds: arrayUnion(shotId),
          }).catch(() => {})
        )
      );

      await Promise.all(
        talentRemovals.map((id) =>
          updateDoc(doc(db, ...currentTalentPath, id), {
            shotIds: arrayRemove(shotId),
          }).catch(() => {})
        )
      );

      const prevLocationId = before.locationId || null;
      const nextLocationId = after.locationId || null;

      if (prevLocationId && prevLocationId !== nextLocationId) {
        await updateDoc(doc(db, ...currentLocationsPath, prevLocationId), {
          shotIds: arrayRemove(shotId),
        }).catch(() => {});
      }

      if (nextLocationId && prevLocationId !== nextLocationId) {
        await updateDoc(doc(db, ...currentLocationsPath, nextLocationId), {
          shotIds: arrayUnion(shotId),
        }).catch(() => {});
      }
    },
    [productFamilyPathForClient, currentTalentPath, currentLocationsPath]
  );

  const updateShot = useCallback(
    async (shot, patch) => {
      if (!canEditShots) return;

      const before = {
        productIds: shot.productIds || extractProductIds(shot.products),
        products: shot.products || [],
        talentIds: shot.talentIds || [],
        locationId: shot.locationId || null,
      };

      const docPatch = { ...patch };

      if (Object.prototype.hasOwnProperty.call(patch, "description")) {
        docPatch.description = sanitizeNotesHtml(patch.description || "");
      }

      if (Object.prototype.hasOwnProperty.call(patch, "products") && patch.products != null) {
        const productsForWrite = patch.products.map((product) => mapProductForWrite(product));
        docPatch.products = productsForWrite;
        docPatch.productIds = extractProductIds(productsForWrite);
      }

      if (Object.prototype.hasOwnProperty.call(patch, "date")) {
        docPatch.date = patch.date ? parseDateToTimestamp(patch.date) : null;
      }

      if (Object.prototype.hasOwnProperty.call(patch, "talent") && patch.talent != null) {
        const talentForWrite = mapTalentForWrite(patch.talent);
        docPatch.talent = talentForWrite;
        docPatch.talentIds = talentForWrite.map((entry) => entry.talentId);
      }

      if (Object.prototype.hasOwnProperty.call(patch, "locationId")) {
        const locationId = patch.locationId || null;
        docPatch.locationId = locationId;
        docPatch.locationName = locationId
          ? locations.find((location) => location.id === locationId)?.name || null
          : null;
      }

      const after = {
        productIds: docPatch.productIds ?? before.productIds,
        products: docPatch.products ?? before.products,
        talentIds: docPatch.talentIds ?? before.talentIds,
        locationId: docPatch.locationId ?? before.locationId,
      };

      try {
        await writeDoc("update shot", () => updateDoc(doc(db, ...currentShotsPath, shot.id), docPatch));
        await updateReverseIndexes({ shotId: shot.id, before, after });
      } catch (error) {
        const { code, message } = describeFirebaseError(error, "Unable to update shot.");
        toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
        throw error;
      }
    },
    [
      canEditShots,
      currentShotsPath,
      locations,
      updateReverseIndexes,
      mapProductForWrite,
      extractProductIds,
      mapTalentForWrite,
      sanitizeNotesHtml,
      parseDateToTimestamp,
    ]
  );

  const handleSaveShot = useCallback(async () => {
    if (!editingShot) return;
    if (!canEditShots) {
      toast.error("You do not have permission to edit shots.");
      return;
    }

    setIsSavingShot(true);
    try {
      const parsed = shotDraftSchema.parse({
        ...editingShot.draft,
        locationId: editingShot.draft.locationId || "",
      });
      await updateShot(editingShot.shot, {
        name: parsed.name,
        description: parsed.description || "",
        type: parsed.type || "",
        date: parsed.date || "",
        locationId: parsed.locationId || null,
        talent: parsed.talent,
        products: parsed.products,
      });
      toast.success(`Shot "${parsed.name}" updated.`);
      setEditingShot(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid shot details", description: message });
      } else {
        const { code, message } = describeFirebaseError(error, "Unable to update shot.");
        toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
      }
      console.error("[Planner] Failed to save shot", error);
    } finally {
      setIsSavingShot(false);
    }
  }, [editingShot, canEditShots, updateShot]);

  // Prompt to rename a lane.  Empty input aborts the rename.
  const renameLane = async (lane) => {
    if (!canEditPlanner) return;
    const newName = prompt("Lane name", lane.name);
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await updateDoc(doc(db, ...currentLanesPath, lane.id), { name: trimmed });
    } catch (error) {
      console.error("[Planner] Failed to rename lane", error);
      toast.error("Could not rename lane");
    }
  };

  // Remove a lane.  Before deleting the lane document we set laneId=null for
  // all shots that currently reference this lane.  Because shots live in a
  // central collection we need to query for the current project's shots with
  // this laneId and update them.  Only then do we delete the lane.
  const removeLane = async (lane) => {
    if (!canEditPlanner) return;
    if (!confirm("Delete lane?")) return;
    try {
      const q = query(
        collection(db, ...currentShotsPath),
        where("projectId", "==", projectId),
        where("laneId", "==", lane.id)
      );
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((dref) =>
          updateDoc(doc(db, ...currentShotsPath, dref.id), { laneId: null })
        )
      );
      await deleteDoc(doc(db, ...currentLanesPath, lane.id));
    } catch (error) {
      console.error("[Planner] Failed to remove lane", error);
      toast.error("Could not delete lane");
    }
  };

  // Handle drag end events.  Update the shot's laneId (and date if the lane
  // name looks like a date).  Because shots are stored in a central
  // collection we update via shotsPath().
  const onDragEnd = async (e) => {
    if (!canEditPlanner) return;
    const shotId = e.active?.id;
    const overId = e.over?.id;
    if (!shotId || !overId) return;
    const laneId = overId.startsWith("lane-") ? overId.slice(5) : null;
    const patch = { laneId };
    if (laneId) {
      const lane = lanes.find((l) => l.id === laneId);
      if (lane && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) patch.date = lane.name;
    }
    try {
      await updateDoc(doc(db, ...currentShotsPath, shotId), patch);
    } catch (error) {
      console.error("[Planner] Failed to move shot", error);
      toast.error("Could not move shot");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Planner</h1>
        <p className="text-sm text-slate-600">
          Arrange shots into lanes for the active project. Drag cards between lanes to
          update assignments and keep shoot days organised.
        </p>
      </div>
      {subscriptionError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          We could not refresh all planner data. Try again shortly or reload the page.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              View
            </span>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => updateViewMode("board")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                  viewMode === "board"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-pressed={viewMode === "board"}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                Board
              </button>
              <button
                type="button"
                onClick={() => updateViewMode("list")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                  viewMode === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-pressed={viewMode === "list"}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                List
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="planner-group-select"
              className="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Group
            </label>
            <select
              id="planner-group-select"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
              value={groupBy}
              onChange={(event) => updateGroupBy(event.target.value)}
            >
              {PLANNER_GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="planner-sort-select"
              className="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Sort
            </label>
            <select
              id="planner-sort-select"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
              value={sortBy}
              onChange={(event) => updatePlannerSort(event.target.value)}
            >
              {PLANNER_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800"
            aria-haspopup="dialog"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </Button>
          <div className="relative" ref={fieldSettingsRef}>
            <button
              type="button"
              onClick={() => setFieldSettingsOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={fieldSettingsOpen}
              aria-label="Select visible fields"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
            {fieldSettingsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shot details
                </p>
                {[
                  { key: "notes", label: "Notes" },
                  { key: "location", label: "Location" },
                  { key: "talent", label: "Talent" },
                  { key: "products", label: "Products" },
                ].map((option) => (
                  <label
                    key={option.key}
                    className="mt-2 flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleFields[option.key]}
                      onChange={(event) =>
                        setVisibleFields((prev) => ({
                          ...prev,
                          [option.key]: event.target.checked,
                        }))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <PlannerSummary
        isLoading={isPlannerLoading}
        laneSummary={laneSummary}
        talentSummary={talentSummary}
      />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          placeholder="New lane (e.g., 2025-09-12 or Unassigned)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 min-w-[220px] flex-1 rounded-md border border-slate-200 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
          disabled={!canEditPlanner}
        />
        <button
          onClick={addLane}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
          disabled={!canEditPlanner}
        >
          Add lane
        </button>
      </div>
      {isPlannerLoading ? (
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading planner…
        </div>
      ) : groupBy === "none" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {isListView ? (
            <div className="flex flex-col gap-4 pb-6">
              {renderLaneBlock(UNASSIGNED_LANE_ID, "Unassigned", unassignedShots, null, {
                sortBy,
              })}
              {lanes.map((lane) =>
                renderLaneBlock(lane.id, lane.name, shotsByLane[lane.id] || [], lane, {
                  sortBy,
                })
              )}
            </div>
          ) : (
            <div ref={boardScrollRef} className="flex gap-4 overflow-x-auto pb-6">
              {renderLaneBlock(UNASSIGNED_LANE_ID, "Unassigned", unassignedShots, null, {
                sortBy,
              })}
              {lanes.map((lane) =>
                renderLaneBlock(lane.id, lane.name, shotsByLane[lane.id] || [], lane, {
                  sortBy,
                })
              )}
            </div>
          )}
          <DragOverlay>
            {activeDragShot ? (
              <ShotCard
                shot={activeDragShot}
                viewMode={viewMode}
                visibleFields={visibleFields}
                onEdit={null}
                canEdit={false}
                products={normaliseShotProducts(activeDragShot)}
                statusOptions={shotStatusOptions}
                onChangeStatus={null}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className={isListView ? "flex flex-col gap-4 pb-6" : "flex gap-4 overflow-x-auto pb-6"}>
          {derivedGroups.length ? (
            derivedGroups.map((group) =>
              renderLaneBlock(group.id, group.name, group.shots, null, {
                droppable: false,
                sortBy,
              })
            )
          ) : (
            <div className="flex min-h-[160px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No shots available for the current grouping.
            </div>
          )}
        </div>
      )}
      {!isPlannerLoading && lanes.length === 0 && totalShots === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No shots have been scheduled for this project yet. Create shots from the Shots page or
          drag existing shots into lanes once they appear here.
        </div>
      )}
      {canEditShots && editingShot && (
        <ShotEditModal
          open
          titleId="planner-shot-edit-title"
          shotName={editingShot.shot.name}
          description="Update shot details, linked products, and talent assignments."
          draft={editingShot.draft}
          onChange={updateEditingDraft}
          onClose={closeShotEditor}
          onSubmit={handleSaveShot}
          isSaving={isSavingShot}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          createProduct={buildShotProduct}
          allowProductCreation={false}
          locations={locations}
          talentOptions={talentOptions}
          talentPlaceholder="Select talent"
          talentNoOptionsMessage={talentNoOptionsMessage}
          talentLoadError={talentLoadError}
        />
      )}
      {!canEditPlanner && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Planner actions are read-only for your role. Producers or crew can organise shot lanes.
        </div>
      )}
      <PlannerExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        lanes={lanesForExport}
        laneSummary={laneSummary}
        talentSummary={talentSummary}
        defaultVisibleFields={visibleFields}
        isLoading={isPlannerLoading}
      />
    </div>
  );
}

export default function PlannerPage() {
  return (
    <PlannerErrorBoundary>
      <PlannerPageContent />
    </PlannerErrorBoundary>
  );
}

export const __test = {
  readStoredPlannerView,
  readStoredVisibleFields,
  ShotCard,
  groupShotsByLane,
  UNASSIGNED_LANE_ID,
  stripHtml,
  normaliseShotTalent,
  buildPlannerExportLanes,
  calculateLaneSummaries,
  calculateTalentSummaries,
  TALENT_UNASSIGNED_ID,
  mergeShotSources,
  normaliseShotForPlanner,
  shouldShowLanePlaceholder,
};
