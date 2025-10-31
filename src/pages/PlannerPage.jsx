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

import React, { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  getDoc,
  updateDoc,
  query,
  orderBy,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  lanesPath,
  shotsPath,
  legacyProjectShotsPath,
  DEFAULT_PROJECT_ID,
  productFamiliesPath,
  productFamilySkusPath,
  productFamilyPath,
  talentPath,
  locationsPath,
  projectPath,
} from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { canManagePlanner, canManageShots, ROLE, resolveEffectiveRole } from "../lib/rbac";
import {
  Download,
  LayoutGrid,
  List,
  Settings2,
  PencilLine,
  User,
  MapPin,
  Package,
  Camera,
  Calendar,
  Info,
  GripVertical,
  ListRestart,
  MoreVertical,
} from "lucide-react";
import { formatNotesForDisplay, sanitizeNotesHtml } from "../lib/sanitize";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TagList } from "../components/ui/TagBadge";
import { toast, showConfirm } from "../lib/toast";
import AppImage from "../components/common/AppImage";
import PlannerSummary from "../components/planner/PlannerSummary";
const PlannerExportModal = lazy(() => import("../components/planner/PlannerExportModal"));
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
import { getStaggerDelay } from "../lib/animations";
import { useLanes, useShots, useProducts, useTalent, useLocations } from "../hooks/useFirestoreQuery";
import { useShotsOverview } from "../context/ShotsOverviewContext";

const PLANNER_VIEW_STORAGE_KEY = "planner:viewMode";
const PLANNER_FIELDS_STORAGE_KEY = "planner:visibleFields";
const UNASSIGNED_LANE_ID = "__unassigned__";
const LANE_END_DROPPABLE_ID = "__end__";

const defaultVisibleFields = {
  notes: true,
  location: true,
  talent: true,
  products: true,
};

const PLANNER_PREFS_STORAGE_KEY = "planner:prefs";
const PLANNER_PREFS_VERSION = 2;

const defaultPlannerPrefs = {
  version: PLANNER_PREFS_VERSION,
  groupBy: "none",
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

const buildLaneShotNumber = (laneName, index) => {
  const label = typeof laneName === "string" && laneName.trim() ? laneName.trim() : "Lane";
  return `${label} | Shot #${index + 1}`;
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
    // Prioritize reference/storyboard image if available
    candidates.push(shot.referenceImagePath);
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
    const storedVersion = typeof parsed.version === "number" ? parsed.version : 1;
    const sort = normalisePlannerSort(parsed.sort);

    if (storedVersion < PLANNER_PREFS_VERSION) {
      const usedLegacyDefault = parsed.groupBy == null || parsed.groupBy === "date";
      if (usedLegacyDefault) {
        return { ...defaultPlannerPrefs, sort };
      }
    }

    const groupBy = normalisePlannerGroup(parsed.groupBy);
    return { version: PLANNER_PREFS_VERSION, groupBy, sort };
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
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <div className="text-base font-semibold text-red-800 dark:text-red-200">
            Something went wrong loading the planner.
          </div>
          <p>
            Try refreshing the page. If the issue continues, please contact support with the
            steps that caused this error.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-slate-700"
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
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${laneId}`,
    data: { type: "lane-shot-target", laneId },
  });
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
  isSelected = false,
  isFocused = false,
  onFocus = null,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: shot.id,
    disabled,
    data: { type: "shot", shotId: shot.id },
  });
  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  const style = isActive ? { ...dragStyle, opacity: 0.3 } : dragStyle;
  const dragProps = disabled ? {} : { ...listeners, ...attributes };
  const products = typeof normaliseProducts === "function" ? normaliseProducts(shot) : shot.products || [];
  const cursorClass = disabled ? "" : "cursor-grab active:cursor-grabbing";
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full ${cursorClass}`}
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
        isSelected={isSelected}
        isFocused={isFocused}
        onFocus={onFocus}
      />
    </div>
  );
}


function DraggableLane({ laneId, disabled, children }) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `lane-item-${laneId}`,
    data: { type: "lane", laneId },
    disabled,
  });
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `lane-slot-${laneId}`,
    data: { type: "lane-slot", laneId },
    disabled,
  });

  const setNodeRef = useCallback(
    (node) => {
      setDragNodeRef(node);
      setDropNodeRef(node);
    },
    [setDragNodeRef, setDropNodeRef]
  );

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  const style = isDragging ? { ...dragStyle, opacity: 0.8 } : dragStyle;

  return children({
    setNodeRef,
    dragListeners: disabled ? {} : listeners,
    dragAttributes: disabled ? {} : attributes,
    isDragging,
    isOver,
    style,
  });
}

function LaneEndDropZone({ disabled, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "lane-slot-__end__",
    data: { type: "lane-slot", laneId: LANE_END_DROPPABLE_ID },
    disabled,
  });
  return (
    <div ref={setNodeRef} data-lane-drop-over={isOver ? "" : undefined}>
      {typeof children === "function" ? children(isOver) : children}
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
  isSelected = false,
  isFocused = false,
  onFocus = null,
}) {
  const typeLabel = shot.type || "–";
  const dateLabel = formatShotDate(shot.date) || "—";
  const shotNumberLabel =
    typeof shot.shotNumber === "string" && shot.shotNumber.trim() ? shot.shotNumber.trim() : null;
  const shotNameLabel = shot.name || (shotNumberLabel ? shotNumberLabel : "Untitled shot");
  const isUnassignedShot = toLaneKey(shot.laneId) === UNASSIGNED_LANE_ID;
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
    shot.referenceImagePath ||
    firstProduct?.colourImagePath ||
    firstProduct?.thumbnailImagePath ||
    (Array.isArray(firstProduct?.images) && firstProduct.images.length
      ? firstProduct.images[0]
      : null) ||
    null;
  const thumbnailSrc = visibleFields.products ? derivedThumbnail : null;
  const showThumbnailFrame = Boolean(visibleFields.products && firstProduct);
  const imagePosition = shot.referenceImagePath && shot.referenceImageCrop
    ? `${shot.referenceImageCrop.x}% ${shot.referenceImageCrop.y}%`
    : undefined;
  const locationLabel = shot.locationName || "–";
  const showDetailsSection =
    visibleFields.location || visibleFields.talent || visibleFields.products;

  const cardBaseClass =
    viewMode === "list"
      ? "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      : "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800";
  const highlightClasses = isFocused
    ? "ring-2 ring-primary shadow-lg"
    : isSelected
    ? "ring-1 ring-primary/50"
    : "";

  return (
    <div
      data-shot-id={shot.id}
      className={`${cardBaseClass} transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${highlightClasses}`}
      onClick={() => onFocus?.(shot)}
    >
      <div className="flex flex-col gap-3">
        {showThumbnailFrame ? (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
            <AppImage
              src={thumbnailSrc}
              alt={`${shot.name} thumbnail`}
              preferredSize={240}
              loading="lazy"
              className="h-full w-full"
              imageClassName="h-full w-full object-cover"
              position={imagePosition}
              placeholder={
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  Loading
                </div>
              }
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  No image
                </div>
              }
            />
          </div>
        ) : (
          <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
            No image
          </div>
        )}
        {shotNumberLabel && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 dark:text-primary/70">
            {shotNumberLabel}
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h4 className="flex-1 min-w-[200px] text-base font-semibold text-slate-900 dark:text-slate-100" title={shotNameLabel}>
            {shotNameLabel}
          </h4>
          <div className="flex flex-shrink-0 items-center gap-1">
            <select
              aria-label={`${shotNameLabel} status`}
              className={`h-8 rounded-md border px-2 text-xs font-medium transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                statusControlDisabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
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
                onPointerDownCapture={(event) => event.stopPropagation()}
                onPointerUpCapture={(event) => event.stopPropagation()}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                aria-label={`Edit ${shot.name}`}
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {shot.type && (
            <StatusBadge variant="default" className="text-xs">
              {typeLabel}
            </StatusBadge>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{dateLabel}</span>
          </div>
          {productLabels.length > 0 && (
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{productLabels.length} {productLabels.length === 1 ? "product" : "products"}</span>
            </div>
          )}
          {isUnassignedShot && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Unassigned
            </span>
          )}
        </div>
        {showDetailsSection && (
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            {visibleFields.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span>{locationLabel}</span>
              </div>
            )}
            {visibleFields.talent && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span>{talentList.length ? talentList.join(", ") : "–"}</span>
              </div>
            )}
            {visibleFields.products && (
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span>
                  {productLabels.length ? productLabels.slice(0, 3).join(", ") : "–"}
                  {productLabels.length > 3 && "…"}
                </span>
              </div>
            )}
          </div>
        )}
        {Array.isArray(shot.tags) && shot.tags.length > 0 && (
          <TagList tags={shot.tags} emptyMessage={null} className="text-xs" />
        )}
        {visibleFields.notes && notesHtml && (
          <div
            className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        )}
      </div>
    </div>
  );
}

function PlannerPageContent({ embedded = false }) {
  const [name, setName] = useState("");
  const [shotsByLane, setShotsByLane] = useState({});
  const [plannerShots, setPlannerShots] = useState([]);
  const [shotsLoading, setShotsLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => readStoredPlannerView());
  const [visibleFields, setVisibleFields] = useState(() => readStoredVisibleFields());
  const [plannerPrefs, setPlannerPrefs] = useState(() => readStoredPlannerPrefs());
  const [exportOpen, setExportOpen] = useState(false);
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [renumberingLaneIds, setRenumberingLaneIds] = useState(() => new Set());
  const [openLaneMenuId, setOpenLaneMenuId] = useState(null);
  const fieldSettingsRef = useRef(null);
  const laneMenuRef = useRef(null);
  const [editingShot, setEditingShot] = useState(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [activeDragShot, setActiveDragShot] = useState(null);
  const [overLaneId, setOverLaneId] = useState(null);
  const [activeLaneId, setActiveLaneId] = useState(null);
  const [laneOverId, setLaneOverId] = useState(null);
  const familyDetailCacheRef = useRef(new Map());
  const pendingShotEditRef = useRef(null);
  const subscriptionErrorNotifiedRef = useRef(false);
  const statusBackfillRef = useRef(new Set());
  const autoScrollRef = useRef({ lastTick: 0, active: false });
  const boardScrollRef = useRef(null);
  const overview = useShotsOverview();
  const sharedFilters = overview?.filters || null;
  const focusShotId = overview?.focusShotId ?? null;
  const setFocusShotId = overview?.setFocusShotId ?? (() => {});
  const sharedSelectedShotIds = overview?.selectedShotIds || null;
  const setSharedSelectedShotIds = overview?.setSelectedShotIds ?? (() => {});
  const groupBy = plannerPrefs.groupBy;
  const sortBy = plannerPrefs.sort;
  const navigate = useNavigate();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  const projectId = currentProjectId;
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

  // TanStack Query hooks for cached data with realtime updates
  const { data: lanes = [], isLoading: lanesLoading } = useLanes(clientId, projectId);
  const { data: primaryShots = [], isLoading: primaryShotsLoading } = useShots(clientId, projectId);
  const { data: families = [], isLoading: familiesLoading } = useProducts(clientId);
  const { data: talent = [], error: talentError } = useTalent(clientId);
  const { data: locations = [] } = useLocations(clientId);

  // Derive talent load error from query error
  const talentLoadError = talentError
    ? describeFirebaseError(talentError, "Unable to load talent.").message
    : null;
  const currentLanesPath = useMemo(
    () => (projectId ? lanesPath(projectId, clientId) : null),
    [projectId, clientId]
  );
  const currentShotsPath = useMemo(() => shotsPath(clientId), [clientId]);
  const currentLegacyShotsPath = useMemo(
    () => (projectId ? legacyProjectShotsPath(projectId, clientId) : null),
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
      activationConstraint: { distance: 4 },
    })
  );

  useEffect(() => {
    setLastVisitedPath(embedded ? "/shots?view=planner" : "/planner");
  }, [embedded, setLastVisitedPath]);

  useEffect(() => {
    if (!scopeReady) return;
    if (!projectId) {
      if (!redirectNotifiedRef.current) {
        redirectNotifiedRef.current = true;
        toast.info({ title: "Please select a project" });
      }
      navigate("/projects", { replace: true });
      return;
    }
    redirectNotifiedRef.current = false;
  }, [scopeReady, projectId, navigate]);

  // Fetch current project for header display
  useEffect(() => {
    if (!projectId || !clientId) {
      setCurrentProject(null);
      return;
    }

    const fetchProject = async () => {
      try {
        const projectRef = doc(db, ...projectPath(projectId, clientId));
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          setCurrentProject({ id: projectSnap.id, ...projectSnap.data() });
        } else {
          setCurrentProject(null);
        }
      } catch (error) {
        console.error("[Planner] Failed to fetch project", error);
        setCurrentProject(null);
      }
    };

    fetchProject();
  }, [projectId, clientId]);

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

  const tagOptions = useMemo(() => {
    const tagMap = new Map();
    plannerShots.forEach((shot) => {
      if (Array.isArray(shot.tags)) {
        shot.tags.forEach((tag) => {
          if (tag && tag.id && tag.label) {
            tagMap.set(tag.id, { id: tag.id, label: tag.label, color: tag.color });
          }
        });
      }
    });
    return Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [plannerShots]);

  const filteredPlannerShots = useMemo(() => {
    if (!Array.isArray(plannerShots) || plannerShots.length === 0) {
      return [];
    }

    const baseFilters = sharedFilters || {};
    const locationFilter = typeof baseFilters.locationId === "string" ? baseFilters.locationId : "";
    const talentFilterSet = new Set(Array.isArray(baseFilters.talentIds) ? baseFilters.talentIds.filter(Boolean) : []);
    const productFilterSet = new Set(
      Array.isArray(baseFilters.productFamilyIds) ? baseFilters.productFamilyIds.filter(Boolean) : []
    );
    const sharedTagList = Array.isArray(baseFilters.tagIds) ? baseFilters.tagIds.filter(Boolean) : [];
    const combinedTagSet = new Set([
      ...sharedTagList,
      ...selectedTagIds.filter((id) => typeof id === "string" && id),
    ]);
    const includeArchived = baseFilters.showArchived === true;

    return plannerShots.filter((shot) => {
      if (!includeArchived && shot?.deleted) {
        return false;
      }

      if (locationFilter && (shot?.locationId || "") !== locationFilter) {
        return false;
      }

      if (talentFilterSet.size) {
        const shotTalentIds = Array.isArray(shot?.talent)
          ? shot.talent.map((entry) => entry?.talentId).filter(Boolean)
          : Array.isArray(shot?.talentIds)
          ? shot.talentIds.filter(Boolean)
          : [];
        if (!shotTalentIds.some((id) => talentFilterSet.has(id))) {
          return false;
        }
      }

      if (productFilterSet.size) {
        const productIds = extractProductIds(shot?.products || [])
          .concat(Array.isArray(shot?.productIds) ? shot.productIds : [])
          .filter(Boolean);
        if (!productIds.some((id) => productFilterSet.has(id))) {
          return false;
        }
      }

      if (combinedTagSet.size) {
        const shotTagIds = Array.isArray(shot?.tags)
          ? shot.tags.map((tag) => tag?.id).filter(Boolean)
          : [];
        if (!shotTagIds.some((id) => combinedTagSet.has(id))) {
          return false;
        }
      }

      return true;
    });
  }, [plannerShots, sharedFilters, selectedTagIds]);

  const filteredShotsByLane = useMemo(() => {
    return groupShotsByLane(filteredPlannerShots);
  }, [filteredPlannerShots]);

  const resolvedShotsByLane = useMemo(() => {
    const copy = { ...filteredShotsByLane };
    const knownLaneIds = new Set([UNASSIGNED_LANE_ID, ...lanes.map((lane) => lane.id)]);
    let orphans = [];
    Object.entries(copy).forEach(([laneId, shots]) => {
      if (!knownLaneIds.has(laneId)) {
        orphans = orphans.concat(shots);
        delete copy[laneId];
      }
    });
    if (orphans.length) {
      copy[UNASSIGNED_LANE_ID] = (copy[UNASSIGNED_LANE_ID] || []).concat(orphans);
    }
    return copy;
  }, [filteredShotsByLane, lanes]);

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
    if (!scopeReady || !authReady) {
      return undefined;
    }

    if (!projectId || !clientId || !currentLegacyShotsPath) {
      setShotsByLane({});
      setPlannerShots([]);
      setShotsLoading(false);
      return undefined;
    }

    setSubscriptionError(null);
    subscriptionErrorNotifiedRef.current = false;
    setShotsLoading(true);
    setShotsByLane({});
    setPlannerShots([]);

    let cancelled = false;

    const shotsRef = collection(db, ...currentShotsPath);
    const legacyShotsRef = collection(db, ...currentLegacyShotsPath);

    let legacyLoaded = false;
    let latestLegacyShots = [];
    const unassignedShotBuckets = new Map();
    const unassignedUnsubs = [];

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
      const unassignedShots = [];
      unassignedShotBuckets.forEach((entries) => {
        entries.forEach((shot) => unassignedShots.push(shot));
      });
      const merged = mergeShotSources(
        [...primaryShots, ...unassignedShots],
        latestLegacyShots,
        projectId || DEFAULT_PROJECT_ID
      );
      setPlannerShots(merged);
      setShotsByLane(groupShotsByLane(merged));
      backfillMissingStatuses([...primaryShots, ...unassignedShots]);
    };

    const updateShotsLoading = () => {
      if (!cancelled && legacyLoaded) {
        setShotsLoading(false);
      }
    };

    const handleLegacyShotsError = (error) => {
      if (cancelled) return;
      latestLegacyShots = [];
      legacyLoaded = true;
      applyCombinedShots();
      setShotsLoading(false);
      handleSubscriptionError("legacy shots")(error);
    };

    const handleUnassignedShotsError = (error) => {
      if (cancelled) return;
      unassignedShotBuckets.clear();
      applyCombinedShots();
      handleSubscriptionError("shots (unassigned)")(error);
    };

    if (projectId === DEFAULT_PROJECT_ID) {
      const unassignedClauses = [
        { key: "null", filter: where("projectId", "==", null) },
        { key: "empty", filter: where("projectId", "==", "") },
      ];
      unassignedClauses.forEach(({ key, filter }) => {
        const unassignedQuery = query(shotsRef, filter);
        unassignedUnsubs.push(
          onSnapshot(
            unassignedQuery,
            (snapshot) => {
              if (cancelled) return;
              const entries = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                projectId: DEFAULT_PROJECT_ID,
              }));
              unassignedShotBuckets.set(key, entries);
              applyCombinedShots();
            },
            handleUnassignedShotsError
          )
        );
      });
    }

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

    // Safety timeout: if legacy shots don't load within 5 seconds, clear loading state
    // This prevents infinite loading if the subscription fails silently
    const loadingTimeout = setTimeout(() => {
      if (!cancelled && !legacyLoaded) {
        console.warn("[Planner] Legacy shots took too long to load, clearing loading state");
        legacyLoaded = true;
        setShotsLoading(false);
      }
    }, 5000);

    // Trigger applyCombinedShots when primaryShots from hook changes
    applyCombinedShots();

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
      unsubLegacyShots();
      unassignedUnsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    scopeReady,
    authReady,
    clientId,
    projectId,
    currentShotsPath,
    currentLegacyShotsPath,
    handleSubscriptionError,
    primaryShots,
  ]);


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
        version: PLANNER_PREFS_VERSION,
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

  useEffect(() => {
    if (!openLaneMenuId) return undefined;
    const handleClick = (event) => {
      if (laneMenuRef.current && !laneMenuRef.current.contains(event.target)) {
        setOpenLaneMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [openLaneMenuId]);

  useEffect(() => {
    if (!openLaneMenuId) {
      laneMenuRef.current = null;
    }
  }, [openLaneMenuId]);

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
      setFocusShotId(shot.id);
      setSharedSelectedShotIds(new Set([shot.id]));
      openShotEditor(shot);
    },
    [canEditShots, isAuthLoading, openShotEditor, setFocusShotId, setSharedSelectedShotIds]
  );

  const handleFocusShot = useCallback(
    (candidate) => {
      if (!candidate) {
        setFocusShotId(null);
        setSharedSelectedShotIds(new Set());
        return;
      }
      const nextId = typeof candidate === "string" ? candidate : candidate?.id;
      setFocusShotId(nextId || null);
      if (nextId) {
        setSharedSelectedShotIds(new Set([nextId]));
      }
    },
    [setFocusShotId, setSharedSelectedShotIds]
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

  const renumberLaneShots = useCallback(
    async ({ laneId, laneName }, { silent = false } = {}) => {
      if (!canEditPlanner || !currentShotsPath) return;
      const targetLaneKey = laneId || UNASSIGNED_LANE_ID;
      const resolvedLaneId = laneId === UNASSIGNED_LANE_ID ? null : laneId;
      const targetProjectId = projectId || DEFAULT_PROJECT_ID;

      setRenumberingLaneIds((prev) => {
        const next = new Set(prev);
        next.add(targetLaneKey);
        return next;
      });

      try {
        const baseConstraints = [where("projectId", "==", targetProjectId)];
        const laneQuery = resolvedLaneId === null
          ? query(collection(db, ...currentShotsPath), ...baseConstraints)
          : query(collection(db, ...currentShotsPath), ...baseConstraints, where("laneId", "==", resolvedLaneId));

        const snapshot = await getDocs(laneQuery);
        if (snapshot.empty) {
          if (!silent) {
            toast.info(`No shots to renumber in ${laneName || "lane"}`);
          }
          return;
        }

        const entries = snapshot.docs
          .map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .filter((shot) =>
            resolvedLaneId === null
              ? !shot.laneId || shot.laneId === null || shot.laneId === UNASSIGNED_LANE_ID
              : shot.laneId === resolvedLaneId
          );

        if (!entries.length) {
          if (!silent) {
            toast.info(`No shots to renumber in ${laneName || "lane"}`);
          }
          return;
        }

        const laneSortBy = typeof sortBy === "string" ? sortBy : defaultPlannerPrefs.sort;
        const orderedEntries = sortShotsForView(entries, { sortBy: laneSortBy });

        const batch = writeBatch(db);
        orderedEntries.forEach((shot, index) => {
          const docRef = doc(db, ...currentShotsPath, shot.id);
          const nextNumber = resolvedLaneId === null ? null : buildLaneShotNumber(laneName, index);
          batch.update(docRef, { shotNumber: nextNumber });
        });

        await batch.commit();

        if (!silent) {
          toast.success(`Renumbered ${entries.length} shots in ${laneName || "lane"}`);
        }
      } catch (error) {
        console.error(`[Planner] Failed to renumber lane ${laneId}`, error);
        if (!silent) {
          toast.error("Could not renumber shots");
        }
      } finally {
        setRenumberingLaneIds((prev) => {
          const next = new Set(prev);
          next.delete(targetLaneKey);
          return next;
        });
      }
    },
    [canEditPlanner, currentShotsPath, projectId, toast, sortBy]
  );

  const reorderPlannerLanes = useCallback(
    async (sourceLaneId, targetLaneId) => {
      if (!canEditPlanner || !currentLanesPath) return;
      const laneIds = Array.isArray(lanes) ? lanes.map((entry) => entry.id) : [];
      const fromIndex = laneIds.indexOf(sourceLaneId);
      if (fromIndex === -1) return;

      const working = [...laneIds];
      const [removed] = working.splice(fromIndex, 1);

      if (targetLaneId === LANE_END_DROPPABLE_ID) {
        working.push(removed);
      } else {
        let insertIndex = working.indexOf(targetLaneId);
        if (insertIndex === -1) {
          working.push(removed);
        } else {
          working.splice(insertIndex, 0, removed);
        }
      }

      const batch = writeBatch(db);
      working.forEach((laneId, index) => {
        batch.update(doc(db, ...currentLanesPath, laneId), { order: index });
      });

      await batch.commit();
    },
    [canEditPlanner, currentLanesPath, lanes]
  );

  const handleDragStart = useCallback(
    ({ active }) => {
      const type = active?.data?.current?.type;
      if (type === "lane") {
        const laneId = active?.data?.current?.laneId || null;
        if (!laneId || !canEditPlanner) return;
        setActiveLaneId(laneId);
        setLaneOverId(laneId);
        return;
      }
      if (type && type !== "shot") return;
      const shotId = active?.data?.current?.shotId || active?.id;
      if (!shotId) return;
      const shot = plannerShotsById.get(shotId) || null;
      setActiveDragShot(shot);
      setOverLaneId(shot?.laneId ?? null);
      if (shot) {
        setFocusShotId(shot.id);
        setSharedSelectedShotIds(new Set([shot.id]));
      }
      if (!autoScrollRef.current.active) {
        autoScrollRef.current.active = true;
        autoScrollRef.current.lastTick = 0;
        window.addEventListener("pointermove", handleAutoScrollPointerMove, { passive: true });
      }
    },
    [
      plannerShotsById,
      handleAutoScrollPointerMove,
      setFocusShotId,
      setSharedSelectedShotIds,
      canEditPlanner,
    ]
  );

  const handleDragOver = useCallback(({ active, over }) => {
    const activeType = active?.data?.current?.type;
    if (activeType === "lane") {
      const overLane = over?.data?.current?.laneId || null;
      setLaneOverId(overLane);
      return;
    }
    if (activeType && activeType !== "shot") return;
    if (over?.data?.current?.type === "lane-slot") {
      setOverLaneId(null);
      return;
    }
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
      const { active, over } = event;
      const activeType = active?.data?.current?.type;

      if (activeType === "lane") {
        setActiveLaneId(null);
        const sourceLaneId = active?.data?.current?.laneId;
        const targetLaneId = over?.data?.current?.laneId || null;
        if (!canEditPlanner || !sourceLaneId || !targetLaneId || sourceLaneId === targetLaneId) {
          setLaneOverId(null);
          return;
        }
        try {
          await reorderPlannerLanes(sourceLaneId, targetLaneId);
        } catch (error) {
          console.error("[Planner] Failed to reorder lanes", error);
          toast.error("Could not move lane");
        } finally {
          setLaneOverId(null);
        }
        return;
      }

      setActiveLaneId(null);
      setLaneOverId(null);

      if (activeType && activeType !== "shot") return;

      const shotId = active?.data?.current?.shotId || active?.id;
      const overRawId = over?.id;
      setActiveDragShot(null);
      setOverLaneId(null);
      if (!canEditPlanner) return;
      if (!shotId || typeof overRawId !== "string" || !overRawId.startsWith("lane-")) return;
      if (over?.data?.current?.type === "lane-slot") return;
      const laneIdKey = overRawId.slice(5);
      const shot = plannerShotsById.get(shotId);
      const previousLaneKey = toLaneKey(shot?.laneId);
      if (shot && previousLaneKey === laneIdKey) return;
      if (shot) {
        setFocusShotId(shot.id);
        setSharedSelectedShotIds(new Set([shot.id]));
      }
      const isUnassignedTarget = laneIdKey === UNASSIGNED_LANE_ID;
      const nextLaneId = isUnassignedTarget ? null : laneIdKey;
      const lane = lanes.find((l) => l.id === laneIdKey);
      const patch = { laneId: nextLaneId };
      if (nextLaneId) {
        if (lane && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) patch.date = lane.name;
      } else {
        patch.date = null;
      }
      try {
        await updateDoc(doc(db, ...currentShotsPath, shotId), patch);
        const renumberPromises = [];
        const targetLaneName = lane?.name || (isUnassignedTarget ? "Unassigned" : laneIdKey);
        renumberPromises.push(
          renumberLaneShots({ laneId: laneIdKey, laneName: targetLaneName }, { silent: true })
        );
        if (previousLaneKey !== laneIdKey) {
          const previousLane = shot?.laneId
            ? lanes.find((l) => l.id === shot.laneId)
            : null;
          const previousLaneName = previousLane?.name || (previousLaneKey === UNASSIGNED_LANE_ID ? "Unassigned" : previousLaneKey);
          renumberPromises.push(
            renumberLaneShots(
              { laneId: previousLaneKey, laneName: previousLaneName },
              { silent: true }
            )
          );
        }
        if (renumberPromises.length) {
          await Promise.allSettled(renumberPromises);
        }
      } catch (error) {
        console.error("[Planner] Failed to move shot", error);
        toast.error("Could not move shot");
      }
    },
    [
      cleanupAutoScroll,
      canEditPlanner,
      reorderPlannerLanes,
      toast,
      plannerShotsById,
      lanes,
      currentShotsPath,
      setFocusShotId,
      setSharedSelectedShotIds,
      renumberLaneShots,
    ]
  );

  const handleDragCancel = useCallback(() => {
    cleanupAutoScroll();
    setActiveDragShot(null);
    setOverLaneId(null);
    setActiveLaneId(null);
    setLaneOverId(null);
  }, [cleanupAutoScroll]);

  useEffect(() => () => cleanupAutoScroll(), [cleanupAutoScroll]);

  const lanesForExport = useMemo(
    () => buildPlannerExportLanes(resolvedShotsByLane, lanes, normaliseShotProducts),
    [resolvedShotsByLane, lanes, normaliseShotProducts]
  );
  const laneSummary = useMemo(() => calculateLaneSummaries(lanesForExport), [lanesForExport]);
  const talentSummary = useMemo(() => calculateTalentSummaries(lanesForExport), [lanesForExport]);

  const isPlannerLoading = isAuthLoading || lanesLoading || primaryShotsLoading || familiesLoading;
  const totalShots = laneSummary.totalShots;

  const isListView = viewMode === "list";
  const laneWrapperClass = isListView
    ? "flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    : "flex flex-1 min-w-[320px] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800";
  const shotListClass = isListView
    ? "flex flex-col gap-3"
    : "flex flex-col gap-3";
  const unassignedShots = resolvedShotsByLane[UNASSIGNED_LANE_ID] || [];
  const lanesLockedByGrouping = groupBy !== "none";
  const derivedGroups = useMemo(
    () => (groupBy === "none" ? [] : selectPlannerGroups(filteredPlannerShots, { groupBy, sortBy })),
    [filteredPlannerShots, groupBy, sortBy]
  );

  const renderLaneBlock = (laneId, title, laneShots, laneMeta = null, options = {}) => {
    const droppable = options.droppable !== false;
    const laneList = Array.isArray(laneShots) ? laneShots : [];
    const displayShots = options.sortBy ? sortShotsForView(laneList, { sortBy: options.sortBy }) : laneList;
    const isActiveShotTarget = droppable && overLaneId === laneId;
    const placeholderVisible = shouldShowLanePlaceholder(activeDragShot, laneId, overLaneId, droppable);
    const isUnassignedLane = laneId === UNASSIGNED_LANE_ID;
    const laneDraggableEnabled = droppable && laneMeta && canEditPlanner && !lanesLockedByGrouping;
    const isLaneDropTarget = laneDraggableEnabled && activeLaneId && laneOverId === laneId && activeLaneId !== laneId;
    const animationClass =
      typeof options.animationIndex === "number" ? "animate-fade-in opacity-0" : "";
    const animationStyle =
      typeof options.animationIndex === "number" ? getStaggerDelay(options.animationIndex) : undefined;
    const laneContainerClass = isListView ? "w-full" : "flex-1 min-w-[320px]";

    const buildCard = (dragHandleProps = {}) => (
      <div
        className={`${laneWrapperClass} ${
          isActiveShotTarget ? "border-primary/60 shadow-lg ring-1 ring-primary/20" : ""
        } ${
          isLaneDropTarget ? "border-primary/70 ring-2 ring-primary/40" : ""
        } ${
          isUnassignedLane ? "border-dashed border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/40" : ""
        }`}
      >
        <div
          className={`mb-3 flex items-start justify-between rounded-md border px-3 py-2 ${
            isUnassignedLane
              ? "border-slate-300 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60"
              : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-start gap-2">
            {laneDraggableEnabled && (
              <button
                type="button"
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label={`Reorder lane ${title}`}
                {...dragHandleProps}
              >
                <GripVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <Camera className="h-3.5 w-3.5" />
                <span>{displayShots.length} {displayShots.length === 1 ? "shot" : "shots"}</span>
              </div>
            </div>
          </div>
          {droppable && laneMeta && canEditPlanner && (
            <div className="flex items-center gap-1 text-slate-500">
              <button
                type="button"
                onClick={() =>
                  renumberLaneShots(
                    { laneId: laneMeta.id, laneName: laneMeta.name },
                    { silent: false }
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition hover:border-slate-200 hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-primary/80"
                title="Renumber shots"
                aria-label="Renumber shots"
                disabled={renumberingLaneIds.has(laneMeta.id)}
              >
                <ListRestart className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="relative" ref={openLaneMenuId === laneMeta.id ? (node) => {
                if (node) {
                  laneMenuRef.current = node;
                  node.dataset.laneMenu = laneMeta.id;
                }
              } : null}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenLaneMenuId((previous) =>
                      previous === laneMeta.id ? null : laneMeta.id
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-haspopup="menu"
                  aria-expanded={openLaneMenuId === laneMeta.id}
                  aria-label={`Lane actions for ${laneMeta.name}`}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </button>
                {openLaneMenuId === laneMeta.id && (
                  <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800" role="menu">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      onClick={() => {
                        setOpenLaneMenuId(null);
                        renameLane(laneMeta);
                      }}
                    >
                      Rename lane
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/60"
                      onClick={() => {
                        setOpenLaneMenuId(null);
                        removeLane(laneMeta);
                      }}
                    >
                      Delete lane
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {isUnassignedLane && (
          <p className="mb-2 rounded-md border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            Shots without a lane land here until they are scheduled.
          </p>
        )}
        <div className={shotListClass}>
          {displayShots.map((sh, index) => (
            <div key={sh.id} className="animate-fade-in opacity-0" style={getStaggerDelay(index)}>
              <DraggableShot
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
                isFocused={focusShotId === sh.id}
                isSelected={sharedSelectedShotIds instanceof Set ? sharedSelectedShotIds.has(sh.id) : false}
                onFocus={handleFocusShot}
              />
            </div>
          ))}
          {placeholderVisible && (
            <div className="flex min-h-[72px] items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 transition-all duration-150 dark:bg-primary/10">
              <span className="text-xs font-medium text-primary/60 dark:text-primary/80">Drop here</span>
            </div>
          )}
        </div>
      </div>
    );

    if (!droppable) {
      return (
        <div key={laneId} className={`${laneContainerClass} ${animationClass}`} style={animationStyle}>
          {buildCard()}
        </div>
      );
    }

    if (laneDraggableEnabled) {
      return (
        <DraggableLane key={laneId} laneId={laneId} disabled={!laneDraggableEnabled}>
          {({ setNodeRef, dragListeners, dragAttributes, style }) => (
            <div
              ref={setNodeRef}
              style={{ ...style, ...animationStyle }}
              className={`${laneContainerClass} ${animationClass}`}
            >
              <DroppableLane laneId={laneId}>{buildCard({ ...dragListeners, ...dragAttributes })}</DroppableLane>
            </div>
          )}
        </DraggableLane>
      );
    }

    return (
      <DroppableLane key={laneId} laneId={laneId}>
        <div className={`${laneContainerClass} ${animationClass}`} style={animationStyle}>
          {buildCard()}
        </div>
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
      await renumberLaneShots({ laneId: lane.id, laneName: trimmed }, { silent: true });
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
    const confirmed = await showConfirm("Delete lane?");
    if (!confirmed) return;
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Planner</h1>
        {currentProject && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {currentProject.name}
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Arrange shots into lanes for the active project. Drag cards between lanes to
          update assignments and keep shoot days organised.
        </p>
      </div>
      {subscriptionError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          We could not refresh all planner data. Try again shortly or reload the page.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              View
            </span>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => updateViewMode("board")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                  viewMode === "board"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
          {tagOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="planner-tag-filter"
                className="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Tag
              </label>
              <select
                id="planner-tag-filter"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                value={selectedTagIds.length === 1 ? selectedTagIds[0] : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedTagIds(value ? [value] : []);
                }}
              >
                <option value="">All shots</option>
                {tagOptions.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              aria-haspopup="menu"
              aria-expanded={fieldSettingsOpen}
              aria-label="Select visible fields"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
            {fieldSettingsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
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
                    className="mt-2 flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <input
          placeholder="New lane (e.g., 2025-09-12 or Unassigned)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 min-w-[220px] flex-1 rounded-md border border-slate-200 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
      {lanesLockedByGrouping && (
        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            Lanes are read-only while grouping shots. Switch Group to "None" to drag, rename, or delete lanes.
          </p>
        </div>
      )}
      {isPlannerLoading ? (
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
                animationIndex: 0,
              })}
              {lanes.map((lane, index) =>
                renderLaneBlock(lane.id, lane.name, resolvedShotsByLane[lane.id] || [], lane, {
                  sortBy,
                  animationIndex: index + 1,
                })
              )}
            </div>
          ) : (
            <div className="pb-6">
              <div
                ref={boardScrollRef}
                className="grid min-w-full gap-4 overflow-x-auto [grid-auto-flow:row] md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]"
              >
                {renderLaneBlock(UNASSIGNED_LANE_ID, "Unassigned", unassignedShots, null, {
                  sortBy,
                  animationIndex: 0,
                })}
                {lanes.map((lane, index) =>
                  renderLaneBlock(lane.id, lane.name, resolvedShotsByLane[lane.id] || [], lane, {
                    sortBy,
                    animationIndex: index + 1,
                  })
                )}
                {canEditPlanner && !lanesLockedByGrouping && activeLaneId && (
                  <LaneEndDropZone disabled={!canEditPlanner || lanesLockedByGrouping}>
                    {(isOver) => (
                      <div
                        className={`flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition dark:border-slate-600 dark:text-slate-500 ${
                          isOver ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Drop lane at end</span>
                      </div>
                    )}
                  </LaneEndDropZone>
                )}
              </div>
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
            derivedGroups.map((group, index) => (
              <div
                key={group.id}
                className="animate-fade-in opacity-0"
                style={getStaggerDelay(index)}
              >
                {renderLaneBlock(group.id, group.name, group.shots, null, {
                  droppable: false,
                  sortBy,
                })}
              </div>
            ))
          ) : (
            <div className="flex min-h-[160px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No shots available for the current grouping.
            </div>
          )}
        </div>
      )}
      {!isPlannerLoading && lanes.length === 0 && totalShots === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          No shots have been scheduled for this project yet. Create shots from the Shots page or
          drag existing shots into lanes once they appear here.
        </div>
      )}
      {canEditShots && editingShot && (
        <ShotEditModal
          open
          titleId="planner-shot-edit-title"
          shotId={editingShot.shot.id}
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Planner actions are read-only for your role. Producers or crew can organise shot lanes.
        </div>
      )}
      {exportOpen && (
        <Suspense fallback={null}>
          <PlannerExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            lanes={lanesForExport}
            laneSummary={laneSummary}
            talentSummary={talentSummary}
            defaultVisibleFields={visibleFields}
            isLoading={isPlannerLoading}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function PlannerPage(props) {
  return (
    <PlannerErrorBoundary>
      <PlannerPageContent {...props} />
    </PlannerErrorBoundary>
  );
}

export const __test = {
  readStoredPlannerView,
  readStoredVisibleFields,
  readStoredPlannerPrefs,
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
