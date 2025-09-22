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
  closestCenter,
  useDroppable,
  useDraggable,
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
  getActiveProjectId,
  productFamiliesPath,
  productFamilySkusPath,
  productFamilyPath,
} from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManagePlanner, canManageShots, ROLE, resolveEffectiveRole } from "../lib/rbac";
import { LayoutGrid, List, Settings2, PencilLine } from "lucide-react";
import { formatNotesForDisplay } from "../lib/sanitize";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { toast } from "../lib/toast";
import { useStorageImage } from "../hooks/useStorageImage";

const PLANNER_VIEW_STORAGE_KEY = "planner:viewMode";
const PLANNER_FIELDS_STORAGE_KEY = "planner:visibleFields";
const UNASSIGNED_LANE_ID = "__unassigned__";

const defaultVisibleFields = {
  notes: true,
  location: true,
  talent: true,
  products: true,
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

const formatShotDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (typeof value === "string") return value.slice(0, 10);
  return "";
};

const readStoredPlannerView = () => {
  if (typeof window === "undefined") return "board";
  const stored = window.localStorage.getItem(PLANNER_VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "board";
};

const readStoredVisibleFields = () => {
  if (typeof window === "undefined") return { ...defaultVisibleFields };
  try {
    const raw = window.localStorage.getItem(PLANNER_FIELDS_STORAGE_KEY);
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
  const { setNodeRef } = useDroppable({ id: `lane-${laneId}` });
  return <div ref={setNodeRef}>{children}</div>;
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
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: shot.id, disabled });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
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
      />
    </div>
  );
}


function ShotCard({ shot, viewMode, visibleFields, onEdit, canEdit, products }) {
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
  const [families, setFamilies] = useState([]);
  const [lanesLoading, setLanesLoading] = useState(true);
  const [shotsLoading, setShotsLoading] = useState(true);
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => readStoredPlannerView());
  const [visibleFields, setVisibleFields] = useState(() => readStoredVisibleFields());
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const fieldSettingsRef = useRef(null);
  const [activeShot, setActiveShot] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const familyDetailCacheRef = useRef(new Map());
  const pendingShotEditRef = useRef(null);
  const subscriptionErrorNotifiedRef = useRef(false);
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
  const currentProductFamiliesPath = useMemo(
    () => productFamiliesPath(clientId),
    [clientId]
  );
  const productFamilySkusPathForClient = useCallback(
    (familyId) => productFamilySkusPath(familyId, clientId),
    [clientId]
  );
  const productFamilyPathForClient = useCallback(
    (familyId) => productFamilyPath(familyId, clientId),
    [clientId]
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

    let cancelled = false;

    const laneRef = collection(db, ...currentLanesPath);
    const lanesQuery = query(laneRef, orderBy("order", "asc"));
    const shotsRef = collection(db, ...currentShotsPath);
    const shotsQuery = query(shotsRef, where("projectId", "==", projectId));
    const familiesRef = collection(db, ...currentProductFamiliesPath);
    const familiesQuery = query(familiesRef, orderBy("styleName", "asc"));

    const handleLanesError = (error) => {
      if (cancelled) return;
      setLanes([]);
      setLanesLoading(false);
      handleSubscriptionError("lanes")(error);
    };

    const handleShotsError = (error) => {
      if (cancelled) return;
      setShotsByLane({});
      setShotsLoading(false);
      handleSubscriptionError("shots")(error);
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
        const allShots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setShotsByLane(groupShotsByLane(allShots));
        setShotsLoading(false);
      },
      handleShotsError
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
      unsubFamilies();
    };
  }, [
    authReady,
    clientId,
    projectId,
    currentLanesPath,
    currentShotsPath,
    currentProductFamiliesPath,
    handleSubscriptionError,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLANNER_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      PLANNER_FIELDS_STORAGE_KEY,
      JSON.stringify(visibleFields)
    );
  }, [visibleFields]);

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

  const openShotEditor = useCallback(
    (shot) => {
      if (!shot) return;
      try {
        const products = normaliseShotProducts(shot);
        setActiveShot({ shot, products });
      } catch (error) {
        console.error("[Planner] Failed to prepare shot for editing", error);
        toast.error("Unable to open shot editor");
      }
    },
    [normaliseShotProducts]
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

  const closeShotEdit = useCallback(() => setActiveShot(null), []);

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
    if (!canEditShots && activeShot) {
      setActiveShot(null);
    }
  }, [canEditShots, activeShot]);

  const updateViewMode = useCallback(
    (nextMode) =>
      setViewMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode)),
    []
  );

  const isPlannerLoading = isAuthLoading || lanesLoading || shotsLoading || familiesLoading;
  const totalShots = useMemo(
    () =>
      Object.values(shotsByLane).reduce(
        (acc, laneShots) => acc + (Array.isArray(laneShots) ? laneShots.length : 0),
        0
      ),
    [shotsByLane]
  );

  const isListView = viewMode === "list";
  const laneWrapperClass = isListView
    ? "flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    : "flex min-w-[280px] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const shotListClass = isListView
    ? "flex flex-col gap-3"
    : "flex flex-col gap-3";
  const unassignedShots = shotsByLane[UNASSIGNED_LANE_ID] || [];

  const renderLaneBlock = (laneId, title, laneShots, laneMeta = null) => (
    <DroppableLane key={laneId} laneId={laneId}>
      <div className={laneWrapperClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {laneMeta && canEditPlanner && (
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
          {laneShots.map((sh) => (
            <DraggableShot
              key={sh.id}
              shot={sh}
              disabled={!canEditPlanner}
              viewMode={viewMode}
              visibleFields={visibleFields}
              onEdit={handleOpenShotEdit}
              canEditShots={canEditShots}
              normaliseProducts={normaliseShotProducts}
            />
          ))}
        </div>
      </div>
    </DroppableLane>
  );

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

  const extractProductIds = useCallback((products = []) => {
    const ids = new Set();
    products.forEach((product) => {
      const id = product.familyId || product.productId || product.productIdRef;
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, []);

  const prepareProductForWrite = useCallback((product) => {
    const sizeScope =
      product.sizeScope ||
      (product.status === "pending-size" ? "pending" : product.size ? "single" : "all");
    return {
      productId: product.familyId || product.productId || "",
      productName: (product.familyName || product.productName || "Product").trim(),
      styleNumber: product.styleNumber || null,
      colourId: product.colourId || null,
      colourName: product.colourName || null,
      colourImagePath: product.colourImagePath || null,
      thumbnailImagePath: product.thumbnailImagePath || null,
      size: product.size || null,
      sizeScope,
      status: product.status === "pending-size" ? "pending-size" : "complete",
    };
  }, []);

  const updateProductIndexes = useCallback(
    async (shotId, beforeProducts, afterProducts) => {
      const beforeIds = new Set(extractProductIds(beforeProducts));
      const afterIds = new Set(extractProductIds(afterProducts));
      const adds = [...afterIds].filter((id) => !beforeIds.has(id));
      const removals = [...beforeIds].filter((id) => !afterIds.has(id));

      await Promise.all(
        adds.map((id) =>
          updateDoc(doc(db, ...productFamilyPathForClient(id)), {
            shotIds: arrayUnion(shotId),
          }).catch(() => {})
        )
      );
      await Promise.all(
        removals.map((id) =>
          updateDoc(doc(db, ...productFamilyPathForClient(id)), {
            shotIds: arrayRemove(shotId),
          }).catch(() => {})
        )
      );
    },
    [extractProductIds, productFamilyPathForClient]
  );

  const saveShotProducts = useCallback(
    async (shot, products) => {
      if (!canEditShots) return;
      const docRef = doc(db, ...currentShotsPath, shot.id);
      const nextProducts = Array.isArray(products) ? products : [];
      const prepared = nextProducts.map((product) => prepareProductForWrite(product));
      const nextProductIds = extractProductIds(prepared);
      await updateDoc(docRef, {
        products: prepared,
        productIds: nextProductIds,
        updatedAt: Date.now(),
      });
      await updateProductIndexes(
        shot.id,
        Array.isArray(shot.products) ? shot.products : [],
        prepared
      );
    },
    [canEditShots, currentShotsPath, extractProductIds, prepareProductForWrite, updateProductIndexes]
  );

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            View
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => updateViewMode("board")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                viewMode === "board" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
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
                viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              List
            </button>
          </div>
        </div>
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
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {isListView ? (
            <div className="flex flex-col gap-4 pb-6">
              {renderLaneBlock(UNASSIGNED_LANE_ID, "Unassigned", unassignedShots)}
              {lanes.map((lane) =>
                renderLaneBlock(lane.id, lane.name, shotsByLane[lane.id] || [], lane)
              )}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-6">
              {renderLaneBlock(UNASSIGNED_LANE_ID, "Unassigned", unassignedShots)}
              {lanes.map((lane) =>
                renderLaneBlock(lane.id, lane.name, shotsByLane[lane.id] || [], lane)
              )}
            </div>
          )}
        </DndContext>
      )}
      {!isPlannerLoading && lanes.length === 0 && totalShots === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No shots have been scheduled for this project yet. Create shots from the Shots page or
          drag existing shots into lanes once they appear here.
        </div>
      )}
      {canEditShots && activeShot && (
        <Modal
          open
          onClose={closeShotEdit}
          labelledBy="planner-shot-edit-title"
          contentClassName="p-0 max-h-[90vh] overflow-y-auto"
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="planner-shot-edit-title" className="text-lg font-semibold">
                    Edit products for {activeShot.shot.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Adjust linked colours and sizes, then save to update the shot.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-xl text-slate-400 hover:text-slate-600"
                  onClick={closeShotEdit}
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ShotProductsEditor
                value={activeShot.products}
                onChange={(next) => setActiveShot((prev) => ({ ...prev, products: next }))}
                families={families}
                loadFamilyDetails={loadFamilyDetails}
                createProduct={buildShotProduct}
                emptyHint="No products linked"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeShotEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await saveShotProducts(activeShot.shot, activeShot.products);
                      toast.success("Shot products updated");
                      closeShotEdit();
                    } catch (error) {
                      console.error("[Planner] Failed to update shot products", error);
                      toast.error("Unable to save products");
                    }
                  }}
                  disabled={!activeShot.products}
                >
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </Modal>
      )}
      {!canEditPlanner && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Planner actions are read-only for your role. Producers or crew can organise shot lanes.
        </div>
      )}
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
};
