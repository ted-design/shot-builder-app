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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { canManagePlanner, canManageShots, ROLE } from "../lib/rbac";
import { LayoutGrid, Rows3, Settings2, PencilLine } from "lucide-react";
import { formatNotesForDisplay } from "../lib/sanitize";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { toast } from "../lib/toast";

const PLANNER_VIEW_STORAGE_KEY = "planner:viewMode";
const PLANNER_FIELDS_STORAGE_KEY = "planner:visibleFields";

const defaultVisibleFields = {
  notes: true,
  location: true,
  talent: true,
  products: true,
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
  const locationLabel = shot.locationName || "–";

  const cardBaseClass =
    viewMode === "list"
      ? "flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between"
      : "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm";

  return (
    <div className={`${cardBaseClass} transition hover:border-primary/40 hover:shadow-md`}>
      <div className={viewMode === "list" ? "flex flex-1 flex-col gap-2" : "flex flex-col gap-2"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900">{shot.name}</h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{typeLabel}</span>
              <span>•</span>
              <span>{dateLabel}</span>
              {shot.laneId && shot.laneId === "__unassigned__" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">Unassigned</span>
              )}
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.(shot);
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
            className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        )}
        {visibleFields.location && (
          <div className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Location:</span> {locationLabel}
          </div>
        )}
        {visibleFields.talent && (
          <div className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Talent:</span>{" "}
            {talentList.length ? talentList.join(", ") : "–"}
          </div>
        )}
        {visibleFields.products && (
          <div className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Products:</span>{" "}
            {productLabels.length ? productLabels.slice(0, 3).join(", ") : "–"}
            {productLabels.length > 3 && "…"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const [lanes, setLanes] = useState([]);
  const [name, setName] = useState("");
  const [shotsByLane, setShotsByLane] = useState({});
  const [families, setFamilies] = useState([]);
  const [viewMode, setViewMode] = useState(() => readStoredPlannerView());
  const [visibleFields, setVisibleFields] = useState(() => readStoredVisibleFields());
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const fieldSettingsRef = useRef(null);
  const [activeShot, setActiveShot] = useState(null);
  const familyDetailCacheRef = useRef(new Map());
  const projectId = getActiveProjectId();
  const { clientId, role: globalRole } = useAuth();
  const userRole = globalRole || ROLE.VIEWER;
  const canEditPlanner = canManagePlanner(userRole);
  const canEditShots = canManageShots(userRole);
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

  useEffect(() => {
    // Subscribe to lanes for the current project
    const laneRef = collection(db, ...currentLanesPath);
    const unsubL = onSnapshot(query(laneRef, orderBy("order", "asc")), (s) =>
      setLanes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    // Subscribe to shots for the current project.  We query the global shots
    // collection and filter by projectId.  Snapshots update the map of shots
    // keyed by laneId, with "__unassigned__" used for null laneId.
    const shotsRef = collection(db, ...currentShotsPath);
    const shotsQuery = query(shotsRef, where("projectId", "==", projectId));
    const unsubS = onSnapshot(shotsQuery, (s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const map = {};
      all.forEach((sh) => {
        const key = sh.laneId || "__unassigned__";
        (map[key] ||= []).push(sh);
      });
      setShotsByLane(map);
    });

    // Subscribe to product families so the edit modal can reuse shared data.
    const familiesRef = collection(db, ...currentProductFamiliesPath);
    const unsubFamilies = onSnapshot(
      query(familiesRef, orderBy("styleName", "asc")),
      (snapshot) => {
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubL();
      unsubS();
      unsubFamilies();
    };
  }, [projectId, currentLanesPath, currentShotsPath, currentProductFamiliesPath]);

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
      alert("You do not have permission to modify the planner.");
      return;
    }
    if (!name) return;
    await addDoc(collection(db, ...currentLanesPath), { name, order: lanes.length });
    setName("");
  };

  const handleOpenShotEdit = (shot) => {
    if (!canEditShots) return;
    setActiveShot({
      shot,
      products: normaliseShotProducts(shot),
    });
  };

  const closeShotEdit = () => setActiveShot(null);

  const isListView = viewMode === "list";
  const laneWrapperClass = isListView
    ? "flex min-w-[320px] flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    : "flex min-w-[280px] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const shotListClass = isListView ? "flex flex-col gap-2" : "flex flex-col gap-3";

  const generateProductId = useCallback(() => Math.random().toString(36).slice(2, 10), []);

  const withDerivedProductFields = useCallback(
    (product) => {
      const family = families.find((entry) => entry.id === product.familyId);
      const fallbackSizes = Array.isArray(family?.sizes) ? family.sizes : [];
      const sizeList = Array.isArray(product.sizeList) ? product.sizeList : fallbackSizes;
      const rawStatus = product.status;
      const rawScope = product.sizeScope;
      const hasExplicitSize = product.size != null && product.size !== "";
      const derivedStatus =
        rawStatus === "pending-size"
          ? "pending-size"
          : rawScope === "pending"
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
      const colourImage = product.colourImagePath || product.colourThumbnail || null;
      const imageCandidates = Array.isArray(product.images)
        ? product.images
        : colourImage
        ? [colourImage]
        : [];

      return {
        ...product,
        familyId: product.familyId || family?.id || null,
        familyName: product.familyName || family?.styleName || "",
        styleNumber: product.styleNumber || family?.styleNumber || null,
        thumbnailImagePath:
          product.thumbnailImagePath || family?.thumbnailImagePath || family?.headerImagePath || null,
        colourId: product.colourId || product.colourwayId || null,
        colourwayId: product.colourwayId || product.colourId || null,
        colourName: product.colourName || "",
        colourImagePath: colourImage || null,
        images: imageCandidates,
        skuCode: product.skuCode || null,
        skuId: product.skuId || null,
        size: effectiveSize,
        sizeId: product.sizeId || (effectiveSize ? effectiveSize : null),
        sizeScope: derivedScope,
        status: derivedStatus,
        sizeList,
      };
    },
    [families]
  );

  const normaliseShotProducts = useCallback(
    (shot) => {
      if (Array.isArray(shot?.products) && shot.products.length) {
        return shot.products.map((product) => withDerivedProductFields(product)).filter(Boolean);
      }
      if (!Array.isArray(shot?.productIds)) return [];
      return shot.productIds
        .map((familyId) => {
          const family = families.find((entry) => entry.id === familyId);
          if (!family) return null;
          return withDerivedProductFields({
            id: `legacy-${familyId}`,
            familyId,
            familyName: family.styleName,
            styleNumber: family.styleNumber || null,
            thumbnailImagePath: family.thumbnailImagePath || family.headerImagePath || null,
            colourId: null,
            colourwayId: null,
            colourName: "Any colour",
            colourImagePath: null,
            skuCode: null,
            size: null,
            sizeList: Array.isArray(family.sizes) ? family.sizes : [],
            status: "complete",
            sizeScope: "all",
          });
        })
        .filter(Boolean);
    },
    [families, withDerivedProductFields]
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
      if (familyDetailCacheRef.current.has(familyId)) {
        return familyDetailCacheRef.current.get(familyId);
      }
      const skusPath = productFamilySkusPathForClient(familyId);
      const snapshot = await getDocs(
        query(collection(db, ...skusPath), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const details = {
        colours,
        sizes: families.find((family) => family.id === familyId)?.sizes || [],
      };
      familyDetailCacheRef.current.set(familyId, details);
      return details;
    },
    [families, productFamilySkusPathForClient]
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
      const prepared = products.map((product) => prepareProductForWrite(product));
      const nextProductIds = extractProductIds(prepared);
      await updateDoc(docRef, {
        products: prepared,
        productIds: nextProductIds,
        updatedAt: Date.now(),
      });
      await updateProductIndexes(shot.id, shot.products || [], prepared);
    },
    [canEditShots, currentShotsPath, extractProductIds, prepareProductForWrite, updateProductIndexes]
  );

  // Prompt to rename a lane.  Empty input aborts the rename.
  const renameLane = async (lane) => {
    if (!canEditPlanner) return;
    const newName = prompt("Lane name", lane.name);
    if (!newName) return;
    await updateDoc(doc(db, ...currentLanesPath, lane.id), { name: newName });
  };

  // Remove a lane.  Before deleting the lane document we set laneId=null for
  // all shots that currently reference this lane.  Because shots live in a
  // central collection we need to query for the current project's shots with
  // this laneId and update them.  Only then do we delete the lane.
  const removeLane = async (lane) => {
    if (!canEditPlanner) return;
    if (!confirm("Delete lane?")) return;
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
    await updateDoc(doc(db, ...currentShotsPath, shotId), patch);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            View
          </span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("board")}
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
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-pressed={viewMode === "list"}
            >
              <Rows3 className="h-4 w-4" aria-hidden="true" />
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
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className={`flex ${isListView ? "gap-3" : "gap-4"} overflow-x-auto pb-6`}>
          {/* Unassigned column */}
          <DroppableLane laneId="__unassigned__">
            <div className={laneWrapperClass}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Unassigned</span>
              </div>
              <div className={shotListClass}>
                {(shotsByLane["__unassigned__"] || []).map((sh) => (
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
          {/* Project lanes */}
          {lanes.map((lane) => (
            <DroppableLane key={lane.id} laneId={lane.id}>
              <div className={laneWrapperClass}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{lane.name}</span>
                  {canEditPlanner && (
                    <span className="flex items-center gap-2 text-xs text-primary">
                      <button onClick={() => renameLane(lane)} className="hover:underline">
                        Rename
                      </button>
                      <button onClick={() => removeLane(lane)} className="hover:underline">
                        Delete
                      </button>
                    </span>
                  )}
                </div>
                <div className={shotListClass}>
                  {(shotsByLane[lane.id] || []).map((sh) => (
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
          ))}
        </div>
      </DndContext>
      {canEditShots && activeShot && (
        <Modal
          open
          onClose={closeShotEdit}
          labelledBy="planner-shot-edit-title"
          contentClassName="p-0 max-h-[90vh] overflow-hidden"
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
