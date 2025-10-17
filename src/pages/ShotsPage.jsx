// src/pages/ShotsPage.jsx (global shots version)
//
// This version centralises all shots into a single collection at
// `clients/{clientId}/shots` and adds a `projectId` field to each shot
// document.  When fetching shots we filter on the active project ID using
// a `where('projectId', '==', projectId)` clause.  This makes it easy to
// reassign shots to other projects—simply update the `projectId` field.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  useShots,
  useProjects,
  useProducts,
  useTalent,
  useLocations,
} from "../hooks/useFirestoreQuery";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  shotsPath as getShotsPath,
  productFamiliesPath,
  productFamilyPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import { LayoutGrid, List, SlidersHorizontal, ChevronDown, Camera, Filter, X } from "lucide-react";
import Select from "react-select";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/EmptyState";
import ExportButton from "../components/common/ExportButton";
import FilterPresetManager from "../components/ui/FilterPresetManager";
import { searchShots } from "../lib/search";
import VirtualizedList, { VirtualizedGrid } from "../components/ui/VirtualizedList";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import TalentMultiSelect from "../components/shots/TalentMultiSelect";
import NotesEditor from "../components/shots/NotesEditor";
import ShotEditModal from "../components/shots/ShotEditModal";
import CreateShotCard from "../components/shots/CreateShotCard";
import BulkOperationsToolbar from "../components/shots/BulkOperationsToolbar";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { canEditProducts, canManageShots, resolveEffectiveRole } from "../lib/rbac";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast } from "../lib/toast";
import { formatNotesForDisplay, sanitizeNotesHtml } from "../lib/sanitize";
import AppImage from "../components/common/AppImage";
import { z } from "zod";
import { createProductFamily, createProductColourway } from "../lib/productMutations";
import { TagList } from "../components/ui/TagBadge";
import {
  shotDraftSchema,
  initialShotDraft,
  toDateInputValue,
  parseDateToTimestamp,
  mapProductForWrite,
  extractProductIds,
  mapTalentForWrite,
} from "../lib/shotDraft";
import { readStorage, writeStorage } from "../lib/safeStorage";
import { normaliseShotStatus, DEFAULT_SHOT_STATUS } from "../lib/shotStatus";
import { normaliseShot, sortShotsForView, SHOT_SORT_OPTIONS } from "../lib/shotsSelectors";
import { getStaggerDelay } from "../lib/animations";
import ActivityTimeline from "../components/activity/ActivityTimeline";

const SHOTS_VIEW_STORAGE_KEY = "shots:viewMode";
const SHOTS_FILTERS_STORAGE_KEY = "shots:filters";

// Firestore batch write limit
const FIRESTORE_BATCH_LIMIT = 500;

// Available shot types for bulk editing
const AVAILABLE_SHOT_TYPES = [
  "product",
  "lifestyle",
  "detail",
  "model",
  "flat-lay",
  "hero",
  "ecommerce",
  "editorial",
  "b-roll",
  "establishing",
];

const defaultShotFilters = {
  locationId: "",
  talentIds: [],
  productFamilyIds: [],
  tagIds: [],
};

const SHOTS_PREFS_STORAGE_KEY = "shots:viewPrefs";

const defaultViewPrefs = {
  showProducts: true,
  showTalent: true,
  showLocation: true,
  showNotes: true,
  sort: "alpha",
};

const normaliseShotRecord = (id, data, fallbackProjectId) =>
  normaliseShot({ id, ...data }, { fallbackProjectId }) || { id, ...data };

const filterSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 6,
    borderColor: state.isFocused ? "#2563eb" : "#cbd5f5",
    boxShadow: state.isFocused ? "0 0 0 1px rgba(37, 99, 235, 0.35)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#2563eb" : "#94a3b8",
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#e2e8f0",
    borderRadius: 9999,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0f172a",
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#475569",
    ":hover": {
      backgroundColor: "#cbd5f5",
      color: "#1d4ed8",
    },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 1200 }),
};

const readStoredShotsView = () => {
  const stored = readStorage(SHOTS_VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "gallery";
};

const readStoredShotFilters = () => {
  try {
    const raw = readStorage(SHOTS_FILTERS_STORAGE_KEY);
    if (!raw) return { ...defaultShotFilters };
    const parsed = JSON.parse(raw);
    return {
      locationId: typeof parsed.locationId === "string" ? parsed.locationId : "",
      talentIds: Array.isArray(parsed.talentIds)
        ? parsed.talentIds.filter((value) => typeof value === "string" && value)
        : [],
      productFamilyIds: Array.isArray(parsed.productFamilyIds)
        ? parsed.productFamilyIds.filter((value) => typeof value === "string" && value)
        : [],
      tagIds: Array.isArray(parsed.tagIds)
        ? parsed.tagIds.filter((value) => typeof value === "string" && value)
        : [],
    };
  } catch (error) {
    console.warn("[Shots] Failed to parse stored filters", error);
    return { ...defaultShotFilters };
  }
};

const readStoredViewPrefs = () => {
  try {
    const raw = readStorage(SHOTS_PREFS_STORAGE_KEY);
    if (!raw) return { ...defaultViewPrefs };
    const parsed = JSON.parse(raw);
    return {
      showProducts: parsed.showProducts !== false,
      showTalent: parsed.showTalent !== false,
      showLocation: parsed.showLocation !== false,
      showNotes: parsed.showNotes !== false,
      sort: typeof parsed.sort === "string" ? parsed.sort : defaultViewPrefs.sort,
    };
  } catch (error) {
    console.warn("[Shots] Failed to read view prefs", error);
    return { ...defaultViewPrefs };
  }
};

export default function ShotsPage() {
  const [queryText, setQueryText] = useState("");
  const debouncedQueryText = useDebouncedValue(queryText, 300);
  const [createDraft, setCreateDraft] = useState({ ...initialShotDraft });
  const [talentLoadError, setTalentLoadError] = useState(null);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const [viewMode, setViewMode] = useState(() => readStoredShotsView());
  const [filters, setFilters] = useState(() => readStoredShotFilters());
  const [viewPrefs, setViewPrefs] = useState(() => readStoredViewPrefs());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingShot, setEditingShot] = useState(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [movingProject, setMovingProject] = useState(false);
  const [copyingProject, setCopyingProject] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const navigate = useNavigate();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  const projectId = currentProjectId;
  const { clientId, role: globalRole, projectRoles = {}, user, claims } = useAuth();

  // TanStack Query hooks for data fetching with intelligent caching
  const { data: shots = [], isLoading: shotsLoading } = useShots(clientId, projectId);
  const { data: families = [], isLoading: familiesLoading } = useProducts(clientId);
  const { data: talent = [], isLoading: talentLoading } = useTalent(clientId);
  const { data: locations = [], isLoading: locationsLoading } = useLocations(clientId);
  const { data: projects = [], isLoading: projectsLoading } = useProjects(clientId);
  const userRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectRoles, projectId]
  );
  const canEditShots = canManageShots(userRole);
  const canManageProducts = canEditProducts(userRole);
  const currentShotsPath = useMemo(() => getShotsPath(clientId), [clientId]);
  const currentProductFamiliesPath = useMemo(() => productFamiliesPath(clientId), [clientId]);
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);
  const currentProjectsPath = useMemo(() => ["clients", clientId, "projects"], [clientId]);
  const productFamilyPathForClient = useCallback(
    (familyId) => productFamilyPath(familyId, clientId),
    [clientId]
  );
  const productFamilySkusPathForClient = useCallback(
    (familyId) => productFamilySkusPath(familyId, clientId),
    [clientId]
  );
  const buildAuthDebugInfo = useCallback(
    () => ({
      uid: user?.uid ?? null,
      claims: {
        role: claims?.role ?? null,
        clientId: claims?.clientId ?? null,
        orgId: claims?.orgId ?? null,
      },
    }),
    [user, claims]
  );

  useEffect(() => {
    setLastVisitedPath("/shots");
  }, [setLastVisitedPath]);

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

  const talentOptions = useMemo(
    () =>
      talent.map((entry) => {
        const name =
          entry.name ||
          [entry.firstName, entry.lastName].filter(Boolean).join(" ").trim() ||
          "Unnamed talent";
        return { talentId: entry.id, name };
      }),
    [talent]
  );

  const locationById = useMemo(() => {
    const lookup = new Map();
    locations.forEach((entry) => {
      if (!entry) return;
      lookup.set(entry.id, entry.name || "Unnamed location");
    });
    return lookup;
  }, [locations]);

  const talentFilterOptions = useMemo(
    () => talentOptions.map((entry) => ({ value: entry.talentId, label: entry.name })),
    [talentOptions]
  );
  const productFilterOptions = useMemo(
    () =>
      families.map((family) => ({
        value: family.id,
        label: family.styleName || "Untitled product",
      })),
    [families]
  );

  const talentFilterValue = useMemo(
    () =>
      (filters.talentIds || []).map((id) =>
        talentFilterOptions.find((option) => option.value === id) || {
          value: id,
          label: "Unknown talent",
        }
      ),
    [filters.talentIds, talentFilterOptions]
  );

  const productFilterValue = useMemo(
    () =>
      (filters.productFamilyIds || []).map((id) =>
        productFilterOptions.find((option) => option.value === id) || {
          value: id,
          label: "Unknown product",
        }
      ),
    [filters.productFamilyIds, productFilterOptions]
  );

  // Build tag filter options from all shots
  const tagFilterOptions = useMemo(() => {
    const tagMap = new Map();
    shots.forEach((shot) => {
      if (Array.isArray(shot.tags)) {
        shot.tags.forEach((tag) => {
          if (tag && tag.id && tag.label) {
            tagMap.set(tag.id, { value: tag.id, label: tag.label, color: tag.color });
          }
        });
      }
    });
    return Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [shots]);

  const tagFilterValue = useMemo(
    () =>
      (filters.tagIds || []).map((id) =>
        tagFilterOptions.find((option) => option.value === id) || {
          value: id,
          label: "Unknown tag",
        }
      ),
    [filters.tagIds, tagFilterOptions]
  );

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.locationId && filters.locationId.length) count++;
    if (Array.isArray(filters.talentIds) && filters.talentIds.length) count++;
    if (Array.isArray(filters.productFamilyIds) && filters.productFamilyIds.length) count++;
    if (Array.isArray(filters.tagIds) && filters.tagIds.length) count++;
    return count;
  }, [filters.locationId, filters.talentIds, filters.productFamilyIds, filters.tagIds]);

  const filteredShots = useMemo(() => {
    const term = debouncedQueryText.trim();
    const selectedLocation = filters.locationId || "";
    const selectedTalentIds = new Set(filters.talentIds || []);
    const selectedProductIds = new Set(filters.productFamilyIds || []);
    const selectedTagIds = new Set(filters.tagIds || []);

    // Apply non-text filters first
    const preFiltered = shots.filter((shot) => {
      if (selectedLocation && (shot.locationId || "") !== selectedLocation) {
        return false;
      }

      if (selectedTalentIds.size) {
        const shotTalentIds = Array.isArray(shot.talent)
          ? shot.talent.map((entry) => entry.talentId).filter(Boolean)
          : Array.isArray(shot.talentIds)
          ? shot.talentIds.filter(Boolean)
          : [];
        const hasTalentMatch = shotTalentIds.some((id) => selectedTalentIds.has(id));
        if (!hasTalentMatch) return false;
      }

      if (selectedProductIds.size) {
        const shotProductIds = extractProductIds(shot.products || [])
          .concat(Array.isArray(shot.productIds) ? shot.productIds : [])
          .filter(Boolean);
        const hasProductMatch = shotProductIds.some((id) => selectedProductIds.has(id));
        if (!hasProductMatch) return false;
      }

      if (selectedTagIds.size) {
        const shotTagIds = Array.isArray(shot.tags)
          ? shot.tags.map((tag) => tag.id).filter(Boolean)
          : [];
        const hasTagMatch = shotTagIds.some((id) => selectedTagIds.has(id));
        if (!hasTagMatch) return false;
      }

      return true;
    });

    // Apply fuzzy text search if query exists
    if (!term) return preFiltered;

    const searchResults = searchShots(preFiltered, term);
    return searchResults.map((result) => result.item);
  }, [shots, debouncedQueryText, filters]);

  const sortedShots = useMemo(
    () => sortShotsForView(filteredShots, { sortBy: viewPrefs.sort }),
    [filteredShots, viewPrefs.sort]
  );

  useEffect(() => {
    writeStorage(SHOTS_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(
      SHOTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        locationId: filters.locationId || "",
        talentIds: Array.isArray(filters.talentIds) ? filters.talentIds : [],
        productFamilyIds: Array.isArray(filters.productFamilyIds)
          ? filters.productFamilyIds
          : [],
        tagIds: Array.isArray(filters.tagIds) ? filters.tagIds : [],
      })
    );
  }, [filters]);

  useEffect(() => {
    writeStorage(
      SHOTS_PREFS_STORAGE_KEY,
      JSON.stringify({
        showProducts: viewPrefs.showProducts,
        showTalent: viewPrefs.showTalent,
        showLocation: viewPrefs.showLocation,
        showNotes: viewPrefs.showNotes,
        sort: viewPrefs.sort,
      })
    );
  }, [viewPrefs]);

  useEffect(() => {
    if (!displayMenuOpen) return undefined;
    const handleClick = (event) => {
      if (!displayMenuRef.current || displayMenuRef.current.contains(event.target)) return;
      setDisplayMenuOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setDisplayMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [displayMenuOpen]);

  // Click-outside handler for filter panel
  useEffect(() => {
    if (!filtersOpen) return undefined;
    function onFiltersClick(event) {
      if (!filtersRef.current) return;
      if (!filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    }
    window.addEventListener("mousedown", onFiltersClick);
    return () => window.removeEventListener("mousedown", onFiltersClick);
  }, [filtersOpen]);

  const familyDetailCacheRef = useRef(new Map());
  const displayMenuRef = useRef(null);
  const filtersRef = useRef(null);

  // Helper to build references
  const collRef = (...segments) => collection(db, ...segments);
  const docRef = (...segments) => doc(db, ...segments);

  const toFamilyIdSet = (source) => {
    const ids = new Set();
    if (Array.isArray(source?.productIds)) {
      source.productIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(source?.products)) {
      source.products.forEach((item) => {
        const id = item?.familyId || item?.productId;
        if (id) ids.add(id);
      });
    }
    return ids;
  };

  /**
   * Keep related reverse indexes up to date when products/talent/locations change
   * on a shot.  When a shot references a product, for example, we also add the
   * shot ID to that product's `shotIds` array.  When removing a reference we
   * remove the shot ID from the relevant document.  Errors are caught and
   * ignored so that missing documents don't break the operation.
   */
  async function updateReverseIndexes({ shotId, before, after }) {
    // Products
    const prevP = toFamilyIdSet(before);
    const nextP = toFamilyIdSet(after);
    const addsP = [...nextP].filter((id) => !prevP.has(id));
    const remsP = [...prevP].filter((id) => !nextP.has(id));
    await Promise.all(
      addsP.map((id) =>
        updateDoc(docRef(...productFamilyPathForClient(id)), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsP.map((id) =>
        updateDoc(docRef(...productFamilyPathForClient(id)), { shotIds: arrayRemove(shotId) }).catch(
          () => {}
        )
      )
    );
    // Talent
    const prevT = new Set(before.talentIds || []);
    const nextT = new Set(after.talentIds || []);
    const addsT = [...nextT].filter((id) => !prevT.has(id));
    const remsT = [...prevT].filter((id) => !nextT.has(id));
    await Promise.all(
      addsT.map((id) =>
        updateDoc(docRef(...currentTalentPath, id), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsT.map((id) =>
        updateDoc(docRef(...currentTalentPath, id), { shotIds: arrayRemove(shotId) }).catch(
          () => {}
        )
      )
    );
    // Location
    const prevL = before.locationId || null;
    const nextL = after.locationId || null;
    if (prevL && prevL !== nextL) {
      await updateDoc(docRef(...currentLocationsPath, prevL), {
        shotIds: arrayRemove(shotId),
      }).catch(() => {});
    }
    if (nextL && prevL !== nextL) {
      await updateDoc(docRef(...currentLocationsPath, nextL), {
        shotIds: arrayUnion(shotId),
      }).catch(() => {});
    }
  }

  const generateProductId = () => Math.random().toString(36).slice(2, 10);

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
          : rawStatus === "complete"
          ? "complete"
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
        return shot.products
          .map((product) => {
            if (!product) return null;
            if (product.familyId) {
              return withDerivedProductFields(product);
            }
            const familyId = product.productId || product.productIdRef;
            if (!familyId) return null;
            const family = families.find((entry) => entry.id === familyId);
            if (!family) return null;
            const base = {
              familyId,
              familyName: product.productName || family.styleName || "",
              styleNumber: product.styleNumber ?? family.styleNumber ?? null,
              thumbnailImagePath:
                product.thumbnailImagePath ||
                family.thumbnailImagePath ||
                family.headerImagePath ||
                null,
              colourId: product.colourId ?? null,
              colourwayId: product.colourId ?? null,
              colourName: product.colourName || "",
              colourImagePath: product.colourImagePath ?? null,
              images: Array.isArray(product.images) ? product.images : [],
              size: product.size ?? null,
              sizeScope:
                product.sizeScope ||
                (product.status === "pending-size"
                  ? "pending"
                  : product.size
                  ? "single"
                  : "all"),
              status: product.status === "pending-size" ? "pending-size" : "complete",
            };
            return withDerivedProductFields(base);
          })
          .filter(Boolean);
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
    []
  );

  const handleCreateProductFamily = useCallback(
    async (payload) => {
      if (!canManageProducts) throw new Error("You do not have permission to create products.");
      try {
        const familyId = await createProductFamily({
          db,
          clientId,
          payload,
          userId: user?.uid || null,
        });
        toast.success({ title: "Product created", description: "The new product family is now available." });
        return familyId;
      } catch (error) {
        console.error("[Shots] Failed to create product", error);
        toast.error({
          title: "Product creation failed",
          description: error?.message || "Unable to save the new product.",
        });
        throw error;
      }
    },
    [canManageProducts, clientId, user]
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

  const handleCreateColourway = useCallback(
    async (familyId, payload) => {
      if (!canManageProducts) {
        throw new Error("You do not have permission to create colourways.");
      }
      const family = families.find((entry) => entry.id === familyId);
      if (!family) {
        throw new Error("Product family is no longer available.");
      }
      const cachedDetails = familyDetailCacheRef.current.get(familyId);
      const existingSkus = cachedDetails?.colours || [];
      try {
        const colour = await createProductColourway({
          db,
          clientId,
          familyId,
          payload,
          userId: user?.uid || null,
          family,
          existingSkus,
        });
        const nextColours = existingSkus.filter((entry) => entry.id !== colour.id);
        nextColours.push(colour);
        const nextDetails = {
          sizes: cachedDetails?.sizes || family.sizes || [],
          colours: nextColours,
        };
        familyDetailCacheRef.current.set(familyId, nextDetails);
        toast.success({
          title: "Colourway created",
          description: `${colour.colorName} is ready to use.`,
        });
        return colour;
      } catch (error) {
        console.error("[Shots] Failed to create colourway", error);
        toast.error({
          title: "Colourway creation failed",
          description: error?.message || "Unable to save the colourway.",
        });
        throw error;
      }
    },
    [canManageProducts, families, clientId, user, db]
  );

  // TanStack Query hooks now handle all data subscriptions with intelligent caching
  // Realtime updates are maintained through onSnapshot in the custom hooks

  // Create a new shot with validation and error handling.
  const handleCreateShot = async () => {
    const shotPathSegments = currentShotsPath;
    const targetPath = `/${shotPathSegments.join("/")}`;
    const authInfo = buildAuthDebugInfo();

    if (!user) {
      console.warn("[Shots] Create blocked: no authenticated user", {
        path: targetPath,
        projectId,
        ...authInfo,
      });
      toast.error("You must be signed in to create shots.");
      return;
    }

    if (!canEditShots) {
      console.warn("[Shots] Create blocked: insufficient role", {
        path: targetPath,
        projectId,
        ...authInfo,
      });
      toast.error("You do not have permission to create shots.");
      return;
    }

    if (isCreatingShot) return;

    const validation = shotDraftSchema.safeParse(createDraft);
    if (!validation.success) {
      const message = validation.error.issues.map((issue) => issue.message).join("; ");
      toast.error({ title: "Check shot details", description: message });
      return;
    }

    if (!projectId) {
      toast.error("No project selected. Please select a project before creating shots.");
      return;
    }

    const resolvedProjectId =
      validation.data.projectId && validation.data.projectId.trim()
        ? validation.data.projectId.trim()
        : projectId;

    setIsCreatingShot(true);
    console.info("[Shots] Attempting to create shot", {
      path: targetPath,
      projectId: resolvedProjectId,
      ...authInfo,
    });
    try {
      const productsForWrite = validation.data.products.map((product) => mapProductForWrite(product));
      const talentForWrite = mapTalentForWrite(validation.data.talent);
      const locationId = validation.data.locationId || null;
      const locationName = locationId
        ? locations.find((location) => location.id === locationId)?.name || null
        : null;

      const notesHtml = sanitizeNotesHtml(validation.data.description || "");
      const resolvedStatus = normaliseShotStatus(validation.data.status);

      const payload = {
        name: validation.data.name,
        description: notesHtml,
        notes: notesHtml,
        type: validation.data.type || "",
        date: parseDateToTimestamp(validation.data.date) || null,
        locationId,
        locationName,
        products: productsForWrite,
        productIds: extractProductIds(productsForWrite),
        talent: talentForWrite,
        talentIds: talentForWrite.map((entry) => entry.talentId),
        tags: validation.data.tags || [],
        projectId: resolvedProjectId,
        status: resolvedStatus,
        deleted: false,
        deletedAt: null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      };

      const docRefSnap = await writeDoc("create shot", () => addDoc(collRef(...shotPathSegments), payload));
      console.info("[Shots] Shot created", {
        path: targetPath,
        projectId: resolvedProjectId,
        docId: docRefSnap.id,
        ...authInfo,
      });
      await updateReverseIndexes({
        shotId: docRefSnap.id,
        before: { productIds: [], products: [], talentIds: [], locationId: null },
        after: {
          productIds: payload.productIds,
          products: productsForWrite,
          talentIds: payload.talentIds,
          locationId: payload.locationId,
        },
      });

      setCreateDraft({ ...initialShotDraft });
      setCreateModalOpen(false);
      toast.success(`Shot "${payload.name}" created.`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid product selection", description: message });
      } else {
        const { code, message } = describeFirebaseError(error, "Unable to create shot.");
        console.error("[Shots] Failed to create shot", {
          path: targetPath,
          projectId,
          ...authInfo,
          code,
          message,
          error,
        });
        toast.error({
          title: "Failed to create shot",
          description: `${code}: ${message} (${targetPath})`,
        });
      }
    } finally {
      setIsCreatingShot(false);
    }
  };

  const openCreateModal = useCallback(() => {
    if (!canEditShots) return;
    if (!projectId) {
      toast.error("No project selected. Please select a project before creating shots.");
      return;
    }
    setCreateDraft({
      ...initialShotDraft,
      projectId: projectId,
      status: DEFAULT_SHOT_STATUS,
    });
    setCreateModalOpen(true);
  }, [canEditShots, projectId]);

  const toggleViewPref = useCallback((key) => {
    setViewPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const selectSort = useCallback((sortValue) => {
    setViewPrefs((prev) => ({ ...prev, sort: sortValue }));
    setDisplayMenuOpen(false);
  }, []);

  // Update an existing shot.  We compute before/after arrays for reverse
  // indexing and only update fields that have changed.  Note: If you allow
  // editing the project assignment in the future, updating the `projectId`
  // here will effectively reassign the shot.
  const updateShot = async (shot, patch) => {
    if (!canEditShots) return;
    const before = {
      productIds: shot.productIds || extractProductIds(shot.products),
      products: shot.products || [],
      talentIds: shot.talentIds || [],
      locationId: shot.locationId || null,
    };

    const docPatch = { ...patch };

    if (Object.prototype.hasOwnProperty.call(patch, "description")) {
      const html = sanitizeNotesHtml(patch.description || "");
      docPatch.description = html;
      docPatch.notes = html;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "notes")) {
      const html = sanitizeNotesHtml(patch.notes || "");
      docPatch.notes = html;
      if (!Object.prototype.hasOwnProperty.call(docPatch, "description")) {
        docPatch.description = html;
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, "status")) {
      docPatch.status = normaliseShotStatus(patch.status);
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

    if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
      docPatch.tags = Array.isArray(patch.tags) ? patch.tags : [];
    }

    const after = {
      productIds: docPatch.productIds ?? before.productIds,
      products: docPatch.products ?? before.products,
      talentIds: docPatch.talentIds ?? before.talentIds,
      locationId: docPatch.locationId ?? before.locationId,
    };

    try {
      await writeDoc("update shot", () => updateDoc(docRef(...currentShotsPath, shot.id), docPatch));
      await updateReverseIndexes({ shotId: shot.id, before, after });
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update shot.");
      toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
      throw error;
    }
  };

  // Soft delete a shot by marking it as deleted
  const removeShot = async (shot) => {
    if (!canEditShots) return;
    const now = Date.now();
    await writeDoc("delete shot", () => updateDoc(docRef(...currentShotsPath, shot.id), {
      deleted: true,
      deletedAt: now,
    }));
  };

  // Restore a soft-deleted shot
  const restoreShot = async (shot) => {
    if (!canEditShots) return;
    await writeDoc("restore shot", () => updateDoc(docRef(...currentShotsPath, shot.id), {
      deleted: false,
      deletedAt: null,
    }));
    toast.success(`Restored shot: ${shot.name}`);
  };

  const handleLocationFilterChange = useCallback((nextId) => {
    setFilters((previous) => ({
      ...previous,
      locationId: nextId || "",
    }));
  }, []);

  const handleTalentFilterChange = useCallback((selected) => {
    const ids = Array.isArray(selected) ? selected.map((option) => option.value) : [];
    setFilters((previous) => ({
      ...previous,
      talentIds: ids,
    }));
  }, []);

  const handleProductFilterChange = useCallback((selected) => {
    const ids = Array.isArray(selected) ? selected.map((option) => option.value) : [];
    setFilters((previous) => ({
      ...previous,
      productFamilyIds: ids,
    }));
  }, []);

  const handleTagFilterChange = useCallback((selected) => {
    const ids = Array.isArray(selected) ? selected.map((option) => option.value) : [];
    setFilters((previous) => ({
      ...previous,
      tagIds: ids,
    }));
  }, []);

  const clearFilters = useCallback(
    () => setFilters({ ...defaultShotFilters }),
    []
  );

  // Preset callbacks
  const handleLoadPreset = useCallback((presetFilters) => {
    if (presetFilters.locationId !== undefined) {
      setFilters((prev) => ({ ...prev, locationId: presetFilters.locationId }));
    }
    if (presetFilters.talentIds !== undefined) {
      setFilters((prev) => ({ ...prev, talentIds: presetFilters.talentIds }));
    }
    if (presetFilters.productFamilyIds !== undefined) {
      setFilters((prev) => ({ ...prev, productFamilyIds: presetFilters.productFamilyIds }));
    }
    if (presetFilters.tagIds !== undefined) {
      setFilters((prev) => ({ ...prev, tagIds: presetFilters.tagIds }));
    }
  }, []);

  const getCurrentFilters = useCallback(() => ({
    locationId: filters.locationId,
    talentIds: filters.talentIds,
    productFamilyIds: filters.productFamilyIds,
    tagIds: filters.tagIds,
  }), [filters.locationId, filters.talentIds, filters.productFamilyIds, filters.tagIds]);

  // Build active filters array for pills
  const activeFilters = useMemo(() => {
    const pills = [];
    if (filters.locationId) {
      const location = locations.find((loc) => loc.id === filters.locationId);
      if (location) {
        pills.push({
          key: `location-${filters.locationId}`,
          label: "Location",
          value: location.name || "Unknown",
        });
      }
    }
    if (Array.isArray(filters.talentIds) && filters.talentIds.length > 0) {
      filters.talentIds.forEach((talentId) => {
        const talentOption = talentFilterOptions.find((opt) => opt.value === talentId);
        if (talentOption) {
          pills.push({
            key: `talent-${talentId}`,
            label: "Talent",
            value: talentOption.label,
          });
        }
      });
    }
    if (Array.isArray(filters.productFamilyIds) && filters.productFamilyIds.length > 0) {
      filters.productFamilyIds.forEach((productId) => {
        const productOption = productFilterOptions.find((opt) => opt.value === productId);
        if (productOption) {
          pills.push({
            key: `product-${productId}`,
            label: "Product",
            value: productOption.label,
          });
        }
      });
    }
    if (Array.isArray(filters.tagIds) && filters.tagIds.length > 0) {
      filters.tagIds.forEach((tagId) => {
        const tagOption = tagFilterOptions.find((opt) => opt.value === tagId);
        if (tagOption) {
          pills.push({
            key: `tag-${tagId}`,
            label: "Tag",
            value: tagOption.label,
          });
        }
      });
    }
    return pills;
  }, [filters.locationId, filters.talentIds, filters.productFamilyIds, filters.tagIds, locations, talentFilterOptions, productFilterOptions, tagFilterOptions]);

  // Remove individual filter
  const removeFilter = useCallback((filterKey) => {
    if (filterKey.startsWith("location-")) {
      setFilters((prev) => ({ ...prev, locationId: "" }));
    } else if (filterKey.startsWith("talent-")) {
      const talentId = filterKey.replace("talent-", "");
      setFilters((prev) => ({
        ...prev,
        talentIds: prev.talentIds.filter((id) => id !== talentId),
      }));
    } else if (filterKey.startsWith("product-")) {
      const productId = filterKey.replace("product-", "");
      setFilters((prev) => ({
        ...prev,
        productFamilyIds: prev.productFamilyIds.filter((id) => id !== productId),
      }));
    } else if (filterKey.startsWith("tag-")) {
      const tagId = filterKey.replace("tag-", "");
      setFilters((prev) => ({
        ...prev,
        tagIds: prev.tagIds.filter((id) => id !== tagId),
      }));
    }
  }, []);

  const updateViewMode = useCallback(
    (nextMode) =>
      setViewMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode)),
    []
  );

  // Selection handlers
  const toggleShotSelection = useCallback((shotId) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedShotIds.size === sortedShots.length && sortedShots.length > 0) {
      // Deselect all
      setSelectedShotIds(new Set());
    } else {
      // Select all visible shots
      setSelectedShotIds(new Set(sortedShots.map((shot) => shot.id)));
    }
  }, [selectedShotIds.size, sortedShots]);

  const clearSelection = useCallback(() => {
    setSelectedShotIds(new Set());
  }, []);

  const selectedShots = useMemo(() => {
    return sortedShots.filter((shot) => selectedShotIds.has(shot.id));
  }, [sortedShots, selectedShotIds]);

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
            tags: Array.isArray(shot.tags) ? shot.tags : [],
          },
        });
      } catch (error) {
        console.error("[Shots] Failed to prepare shot for editing", error);
        toast.error("Unable to open shot editor");
      }
    },
    [mapShotTalentToSelection, normaliseShotProducts]
  );

  const handleEditShot = useCallback(
    (shot) => {
      if (!canEditShots) return;
      openShotEditor(shot);
    },
    [canEditShots, openShotEditor]
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
        tags: parsed.tags || [],
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
      console.error("[Shots] Failed to save shot", error);
    } finally {
      setIsSavingShot(false);
    }
  }, [editingShot, canEditShots, updateShot]);

  const handleMoveToProject = useCallback(async (targetProjectId) => {
    if (!editingShot) return;
    if (!canEditShots) {
      toast.error("You do not have permission to move shots.");
      return;
    }
    if (!targetProjectId) return;

    const targetProject = projects.find((p) => p.id === targetProjectId);
    if (!targetProject) {
      toast.error({ title: "Project not found" });
      return;
    }

    setMovingProject(true);
    try {
      await writeDoc("move shot to project", () =>
        updateDoc(docRef(...currentShotsPath, editingShot.shot.id), {
          projectId: targetProjectId,
          laneId: null, // Remove from planner lanes when moving
          updatedAt: serverTimestamp(),
        })
      );
      toast.success({
        title: "Shot moved",
        description: `"${editingShot.shot.name}" has been moved to ${targetProject.name}.`,
      });
      setEditingShot(null);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to move shot.");
      console.error("[Shots] Failed to move shot", error);
      toast.error({ title: "Failed to move shot", description: `${code}: ${message}` });
    } finally {
      setMovingProject(false);
    }
  }, [editingShot, canEditShots, projects, currentShotsPath]);

  const handleCopyToProject = useCallback(async (targetProjectId) => {
    if (!editingShot) return;
    if (!canEditShots) {
      toast.error("You do not have permission to copy shots.");
      return;
    }
    if (!targetProjectId) return;

    const targetProject = projects.find((p) => p.id === targetProjectId);
    if (!targetProject) {
      toast.error({ title: "Project not found" });
      return;
    }

    setCopyingProject(true);
    try {
      const shotData = editingShot.shot;
      // Create a copy without the id and with updated metadata
      const shotCopy = {
        name: shotData.name,
        description: shotData.description || "",
        type: shotData.type || "",
        date: shotData.date || "",
        locationId: shotData.locationId || null,
        projectId: targetProjectId,
        laneId: null, // Don't assign to any lane initially
        status: shotData.status || "todo",
        products: shotData.products || [],
        talent: shotData.talent || [],
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await writeDoc("copy shot to project", () =>
        addDoc(collRef(...currentShotsPath), shotCopy)
      );

      toast.success({
        title: "Shot copied",
        description: `"${shotData.name}" has been copied to ${targetProject.name}.`,
      });
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to copy shot.");
      console.error("[Shots] Failed to copy shot", error);
      toast.error({ title: "Failed to copy shot", description: `${code}: ${message}` });
    } finally {
      setCopyingProject(false);
    }
  }, [editingShot, canEditShots, projects, currentShotsPath]);

  // Bulk tag operations
  const handleBulkApplyTags = useCallback(async (tagsToApply) => {
    if (!canEditShots || selectedShots.length === 0 || tagsToApply.length === 0) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const existingTags = Array.isArray(shot.tags) ? shot.tags : [];

        // Merge tags - avoid duplicates by tag ID
        const tagMap = new Map();
        existingTags.forEach((tag) => tagMap.set(tag.id, tag));
        tagsToApply.forEach((tag) => tagMap.set(tag.id, tag));
        const mergedTags = Array.from(tagMap.values());

        const shotDocRef = docRef(...currentShotsPath, shot.id);
        batch.update(shotDocRef, {
          tags: mergedTags,
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      const tagLabels = tagsToApply.map((tag) => tag.label).join(", ");
      toast.success({
        title: "Tags applied",
        description: `Applied "${tagLabels}" to ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        }.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to apply tags.");
      console.error("[Shots] Failed to apply tags in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10), // Log first 10 for context
        tagCount: tagsToApply.length,
        tags: tagsToApply.map(t => t.label)
      });
      toast.error({ title: "Failed to apply tags", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);

  const handleBulkRemoveTags = useCallback(async (tagIdsToRemove) => {
    if (!canEditShots || selectedShots.length === 0 || tagIdsToRemove.length === 0) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;
      const tagIdSet = new Set(tagIdsToRemove);

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const existingTags = Array.isArray(shot.tags) ? shot.tags : [];

        // Filter out tags to be removed
        const filteredTags = existingTags.filter((tag) => !tagIdSet.has(tag.id));

        const shotDocRef = docRef(...currentShotsPath, shot.id);
        batch.update(shotDocRef, {
          tags: filteredTags,
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success({
        title: "Tags removed",
        description: `Removed ${tagIdsToRemove.length} tag${
          tagIdsToRemove.length === 1 ? "" : "s"
        } from ${selectedShots.length} shot${selectedShots.length === 1 ? "" : "s"}.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to remove tags.");
      console.error("[Shots] Failed to remove tags in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10), // Log first 10 for context
        tagIdsToRemove
      });
      toast.error({ title: "Failed to remove tags", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);

  /**
   * Bulk set location for selected shots
   */
  const handleBulkSetLocation = useCallback(async (locationId) => {
    if (!canEditShots || selectedShots.length === 0) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;

      // Get location name for denormalization
      const locationName = locationId
        ? locations.find((loc) => loc.id === locationId)?.name || null
        : null;

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const shotDocRef = docRef(...currentShotsPath, shot.id);

        batch.update(shotDocRef, {
          locationId: locationId || null,
          locationName: locationName,
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      const locationLabel = locationId ? (locationName || "Unknown location") : "None";
      toast.success({
        title: "Location updated",
        description: `Set location to "${locationLabel}" for ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        }.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update location.");
      console.error("[Shots] Failed to set location in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10),
        locationId
      });
      toast.error({ title: "Failed to update location", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, locations, isProcessingBulk]);

  /**
   * Bulk set date for selected shots
   */
  const handleBulkSetDate = useCallback(async (dateValue) => {
    if (!canEditShots || selectedShots.length === 0) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;

      // Parse date to timestamp
      const dateTimestamp = dateValue ? parseDateToTimestamp(dateValue) : null;

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const shotDocRef = docRef(...currentShotsPath, shot.id);

        batch.update(shotDocRef, {
          date: dateTimestamp,
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      const dateLabel = dateValue ? dateValue : "cleared";
      toast.success({
        title: "Date updated",
        description: `Set date to ${dateLabel} for ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        }.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update date.");
      console.error("[Shots] Failed to set date in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10),
        dateValue
      });
      toast.error({ title: "Failed to update date", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);

  /**
   * Bulk set type for selected shots
   */
  const handleBulkSetType = useCallback(async (typeValue) => {
    if (!canEditShots || selectedShots.length === 0) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const shotDocRef = docRef(...currentShotsPath, shot.id);

        batch.update(shotDocRef, {
          type: typeValue || "",
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      const typeLabel = typeValue ? typeValue : "cleared";
      toast.success({
        title: "Type updated",
        description: `Set type to "${typeLabel}" for ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        }.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to update type.");
      console.error("[Shots] Failed to set type in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10),
        typeValue
      });
      toast.error({ title: "Failed to update type", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);

  /**
   * Bulk move shots to a different project
   */
  const handleBulkMoveToProject = useCallback(async (targetProjectId) => {
    if (!canEditShots || selectedShots.length === 0 || !targetProjectId) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    // Confirmation prompt for destructive operation
    const targetProject = projects.find((p) => p.id === targetProjectId);
    const projectName = targetProject?.name || "selected project";
    const confirmed = await showConfirm(
      `Move ${selectedShots.length} shot${selectedShots.length === 1 ? "" : "s"} to "${projectName}"? ` +
      `They will no longer appear in the current project.`
    );
    if (!confirmed) return;

    setIsProcessingBulk(true);
    try {
      let batch = writeBatch(db);
      let updateCount = 0;

      // Process in batches (Firestore limit)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        const shotDocRef = docRef(...currentShotsPath, shot.id);

        batch.update(shotDocRef, {
          projectId: targetProjectId,
          laneId: null, // Reset lane assignment when moving projects
          updatedAt: serverTimestamp()
        });
        updateCount++;

        // Commit every FIRESTORE_BATCH_LIMIT operations
        if (updateCount === FIRESTORE_BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          updateCount = 0;
        }
      }

      // Commit remaining operations
      if (updateCount > 0) {
        await batch.commit();
      }

      toast.success({
        title: "Shots moved",
        description: `Moved ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        } to "${projectName}".`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to move shots.");
      console.error("[Shots] Failed to move shots to project in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10),
        targetProjectId
      });
      toast.error({ title: "Failed to move shots", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, projects, isProcessingBulk]);

  /**
   * Bulk copy shots to a different project
   */
  const handleBulkCopyToProject = useCallback(async (targetProjectId) => {
    if (!canEditShots || selectedShots.length === 0 || !targetProjectId) return;

    // Prevent race conditions from rapid operations
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    // Confirmation for resource-intensive operation
    const targetProject = projects.find((p) => p.id === targetProjectId);
    const projectName = targetProject?.name || "selected project";
    const confirmed = await showConfirm(
      `Copy ${selectedShots.length} shot${selectedShots.length === 1 ? "" : "s"} to "${projectName}"? ` +
      `This will create ${selectedShots.length} new shot${selectedShots.length === 1 ? "" : "s"}.`
    );
    if (!confirmed) return;

    setIsProcessingBulk(true);
    try {
      const copiedShots = [];

      // Create new documents with addDoc (cannot batch addDoc operations easily)
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];

        // Copy all properties except id and timestamps
        const shotData = {
          name: shot.name,
          description: shot.description || "",
          type: shot.type || "",
          date: shot.date || null,
          locationId: shot.locationId || null,
          locationName: shot.locationName || null,
          projectId: targetProjectId,
          laneId: null, // Don't assign to any lane initially
          status: shot.status || "todo",
          products: Array.isArray(shot.products) ? shot.products : [],
          productIds: Array.isArray(shot.productIds) ? shot.productIds : [],
          talent: Array.isArray(shot.talent) ? shot.talent : [],
          talentIds: Array.isArray(shot.talentIds) ? shot.talentIds : [],
          tags: Array.isArray(shot.tags) ? shot.tags : [],
          notes: shot.notes || "",
          thumbPath: shot.thumbPath || null, // Copy reference to same image
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
          updatedAt: serverTimestamp()
        };

        const newDocRef = await addDoc(
          collRef(...currentShotsPath),
          shotData
        );
        copiedShots.push(newDocRef.id);
      }

      toast.success({
        title: "Shots copied",
        description: `Copied ${copiedShots.length} shot${
          copiedShots.length === 1 ? "" : "s"
        } to "${projectName}".`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to copy shots.");
      console.error("[Shots] Failed to copy shots to project in bulk", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map(s => s.id).slice(0, 10),
        targetProjectId
      });
      toast.error({ title: "Failed to copy shots", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, currentShotsPath, db, user, projects, isProcessingBulk]);

  const selectPortalTarget =
    typeof window === "undefined" ? undefined : window.document.body;
  const filtersApplied = Boolean(
    (filters.locationId && filters.locationId.length) ||
      (Array.isArray(filters.talentIds) && filters.talentIds.length) ||
      (Array.isArray(filters.productFamilyIds) && filters.productFamilyIds.length)
  );
  const isGalleryView = viewMode === "gallery";
  const isListView = viewMode === "list";
  const talentNoOptionsMessage =
    talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available");
  const activeSortOption = SHOT_SORT_OPTIONS.find((option) => option.value === viewPrefs.sort) || SHOT_SORT_OPTIONS[0];

  return (
    <div className="space-y-6">
      <div className="sticky inset-x-0 top-14 z-40 bg-white/95 dark:bg-slate-800/95 py-4 px-6 backdrop-blur">
        <Card className="border-b-2">
          <CardContent className="py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="flex-none text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Shots</h1>
                <Input
                  placeholder="Search shots by name, talent, product, or location..."
                  aria-label="Search shots"
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  className="min-w-[200px] max-w-md flex-1"
                />
            {canEditShots && (
              <Button type="button" onClick={openCreateModal} className="flex-none whitespace-nowrap">
                New shot
              </Button>
            )}
            <div className="relative flex-none" ref={displayMenuRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-3"
                onClick={() => setDisplayMenuOpen((open) => !open)}
                aria-expanded={displayMenuOpen}
                aria-haspopup="menu"
              >
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium">Display</span>
                  <span className="text-xs text-slate-500">{activeSortOption.label}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </Button>
              {displayMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm shadow-lg">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</p>
                    <div className="mt-2 space-y-1">
                      {SHOT_SORT_OPTIONS.map((option) => {
                        const active = viewPrefs.sort === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => selectSort(option.value)}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 transition ${
                              active
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            {option.label}
                            {active && <span className="text-[10px] uppercase">Active</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</p>
                    <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-400">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                          checked={viewPrefs.showNotes}
                          onChange={() => toggleViewPref("showNotes")}
                        />
                        Notes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                          checked={viewPrefs.showProducts}
                          onChange={() => toggleViewPref("showProducts")}
                        />
                        Products
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                          checked={viewPrefs.showTalent}
                          onChange={() => toggleViewPref("showTalent")}
                        />
                        Talent
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                          checked={viewPrefs.showLocation}
                          onChange={() => toggleViewPref("showLocation")}
                        />
                        Location
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hidden sm:inline">View</span>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <button
                  type="button"
                  onClick={() => updateViewMode("gallery")}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm transition ${
                    isGalleryView ? "bg-slate-900 text-white dark:bg-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  aria-pressed={isGalleryView}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateViewMode("list")}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-sm transition ${
                    isListView ? "bg-slate-900 text-white dark:bg-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  aria-pressed={isListView}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
              <ExportButton data={filteredShots} entityType="shots" />
              {canEditShots && sortedShots.length > 0 && (
                <label className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 sm:px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedShotIds.size > 0 && selectedShotIds.size === sortedShots.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium whitespace-nowrap">
                    {selectedShotIds.size > 0 ? `${selectedShotIds.size} selected` : 'Select all'}
                  </span>
                </label>
              )}
            </div>

            {/* Filter button and presets */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={filtersRef}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className={`relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    activeFilterCount > 0
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={filtersOpen}
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

              {/* Filter panel */}
              {filtersOpen && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-lg animate-slide-in-from-right">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Filter shots</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            clearFilters();
                            setFiltersOpen(false);
                          }}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                        >
                          <X className="h-3 w-3" />
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Location filter */}
                    <div className="space-y-2">
                      <label htmlFor="location-filter" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Location
                      </label>
                      <select
                        id="location-filter"
                        className="h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                        value={filters.locationId}
                        onChange={(event) => handleLocationFilterChange(event.target.value)}
                      >
                        <option value="">All locations</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Talent filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Talent</label>
                      <Select
                        isMulti
                        classNamePrefix="filter-select"
                        styles={filterSelectStyles}
                        options={talentFilterOptions}
                        value={talentFilterValue}
                        onChange={handleTalentFilterChange}
                        placeholder={talentOptions.length ? "Select talent..." : "No talent available"}
                        isDisabled={!talentOptions.length}
                        noOptionsMessage={() =>
                          talentOptions.length ? "No matching talent" : "No talent available"
                        }
                        menuPortalTarget={selectPortalTarget}
                        menuShouldBlockScroll
                        closeMenuOnSelect={false}
                      />
                    </div>

                    {/* Product filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Products</label>
                      <Select
                        isMulti
                        classNamePrefix="filter-select"
                        styles={filterSelectStyles}
                        options={productFilterOptions}
                        value={productFilterValue}
                        onChange={handleProductFilterChange}
                        placeholder={productFilterOptions.length ? "Select products..." : "No products available"}
                        isDisabled={!productFilterOptions.length}
                        noOptionsMessage={() =>
                          productFilterOptions.length ? "No matching products" : "No products available"
                        }
                        menuPortalTarget={selectPortalTarget}
                        menuShouldBlockScroll
                        closeMenuOnSelect={false}
                      />
                    </div>

                    {/* Tags filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tags</label>
                      <Select
                        isMulti
                        classNamePrefix="filter-select"
                        styles={filterSelectStyles}
                        options={tagFilterOptions}
                        value={tagFilterValue}
                        onChange={handleTagFilterChange}
                        placeholder={tagFilterOptions.length ? "Select tags..." : "No tags available"}
                        isDisabled={!tagFilterOptions.length}
                        noOptionsMessage={() =>
                          tagFilterOptions.length ? "No matching tags" : "No tags available"
                        }
                        menuPortalTarget={selectPortalTarget}
                        menuShouldBlockScroll
                        closeMenuOnSelect={false}
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>

              <FilterPresetManager
                page="shots"
                currentFilters={getCurrentFilters()}
                onLoadPreset={handleLoadPreset}
                onClearFilters={clearFilters}
              />
            </div>

            {/* Active filter pills */}
            {activeFilters.length > 0 && (
              <div className="flex w-full flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => removeFilter(filter.key)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-medium hover:bg-primary/20 transition"
                  >
                    <span>{filter.label}: {filter.value}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Tagging Toolbar - appears when shots are selected */}
      {canEditShots && selectedShotIds.size > 0 && (
        <BulkOperationsToolbar
          selectedCount={selectedShotIds.size}
          onClearSelection={clearSelection}
          // Tag operations
          onApplyTags={handleBulkApplyTags}
          onRemoveTags={handleBulkRemoveTags}
          availableTags={tagFilterOptions.map((opt) => ({
            id: opt.value,
            label: opt.label,
            color: opt.color || "blue",
          }))}
          // Property operations
          onSetLocation={handleBulkSetLocation}
          onSetDate={handleBulkSetDate}
          onSetType={handleBulkSetType}
          availableLocations={locations}
          availableTypes={AVAILABLE_SHOT_TYPES}
          // Project operations
          onMoveToProject={handleBulkMoveToProject}
          onCopyToProject={handleBulkCopyToProject}
          availableProjects={projects}
          currentProjectId={projectId}
          // State
          isProcessing={isProcessingBulk}
        />
      )}

      <p className="px-6 text-sm text-slate-600 dark:text-slate-400">
        Build and manage the shot list for the active project. Set the active project from the Dashboard.
      </p>
      {canEditShots ? (
        <div className="mx-6">
          <CreateShotCard onClick={openCreateModal} disabled={isCreatingShot} />
        </div>
      ) : (
        <div className="mx-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
          You can browse shots but need producer or crew access to create or edit them.
        </div>
      )}
      <div className="mx-6 space-y-4">
        {sortedShots.length === 0 ? (
          shots.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No shots yet"
              description="Start building your shot list to plan and organize your photo shoot."
              action={canEditShots ? "Create Shot" : null}
              onAction={canEditShots ? openCreateModal : null}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
              No shots match the current search or filters.
            </div>
          )
        ) : isGalleryView ? (
          <VirtualizedGrid
            items={sortedShots}
            itemHeight={420}
            threshold={100}
            className="mx-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            renderItem={(shot, index, isVirtualized) => {
              const shotProducts = normaliseShotProducts(shot);
              const shotTalentSelection = mapShotTalentToSelection(shot);
              const notesHtml = formatNotesForDisplay(shot.description);
              const locationName =
                shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
              return (
                <div
                  className={isVirtualized ? "" : "animate-fade-in opacity-0"}
                  style={isVirtualized ? {} : getStaggerDelay(index)}
                >
                  <ShotGalleryCard
                    shot={shot}
                    locationName={locationName}
                    products={shotProducts}
                    talent={shotTalentSelection}
                    notesHtml={notesHtml}
                    canEditShots={canEditShots}
                    onEdit={() => handleEditShot(shot)}
                    viewPrefs={viewPrefs}
                    isSelected={selectedShotIds.has(shot.id)}
                    onToggleSelect={canEditShots ? toggleShotSelection : null}
                  />
                </div>
              );
            }}
          />
        ) : (
          <VirtualizedList
            items={sortedShots}
            itemHeight={280}
            threshold={100}
            className="space-y-4"
            renderItem={(shot, index, isVirtualized) => {
              const shotProducts = normaliseShotProducts(shot);
              const shotTalentSelection = mapShotTalentToSelection(shot);
              const notesHtml = formatNotesForDisplay(shot.description);
              const locationName =
                shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
              return (
                <div
                  className={isVirtualized ? "" : "animate-fade-in opacity-0"}
                  style={isVirtualized ? {} : getStaggerDelay(index)}
                >
                  <ShotListCard
                    shot={shot}
                    locationName={locationName}
                    products={shotProducts}
                    talent={shotTalentSelection}
                    notesHtml={notesHtml}
                    canEditShots={canEditShots}
                    onEdit={() => handleEditShot(shot)}
                    viewPrefs={viewPrefs}
                    isSelected={selectedShotIds.has(shot.id)}
                    onToggleSelect={canEditShots ? toggleShotSelection : null}
                  />
                </div>
              );
            }}
          />
        )}
      </div>
      {canEditShots && isCreateModalOpen && (
        <ShotEditModal
          open
          titleId="create-shot-modal-title"
          heading="Create shot"
          shotName={createDraft.name || "New shot"}
          draft={createDraft}
          onChange={(patch) => setCreateDraft((prev) => ({ ...prev, ...patch }))}
          onClose={() => {
            if (isCreatingShot) return;
            setCreateModalOpen(false);
            if (projectId) {
              setCreateDraft({
                ...initialShotDraft,
                projectId: projectId,
                status: DEFAULT_SHOT_STATUS,
              });
            }
          }}
          onSubmit={handleCreateShot}
          isSaving={isCreatingShot}
          submitLabel="Create shot"
          savingLabel="Creating…"
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          createProduct={buildShotProduct}
          allowProductCreation={canManageProducts}
          onCreateProduct={handleCreateProductFamily}
          onCreateColourway={handleCreateColourway}
          locations={locations}
          talentOptions={talentOptions}
          talentPlaceholder={talentLoadError ? "Talent unavailable" : "Select talent"}
          talentNoOptionsMessage={talentNoOptionsMessage}
          talentLoadError={talentLoadError}
        />
      )}
      {!canEditShots && (
        <div className="mx-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
          Shot actions are read-only for your role.
        </div>
      )}
      {canEditShots && editingShot && (
        <ShotEditModal
          open
          titleId="edit-shot-modal-title"
          shotId={editingShot.shot.id}
          shotName={editingShot.shot.name}
          draft={editingShot.draft}
          onChange={updateEditingDraft}
          onClose={closeShotEditor}
          onSubmit={handleSaveShot}
          isSaving={isSavingShot}
          onDelete={() => removeShot(editingShot.shot)}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          createProduct={buildShotProduct}
          allowProductCreation={canManageProducts}
          onCreateProduct={handleCreateProductFamily}
          onCreateColourway={handleCreateColourway}
          locations={locations}
          talentOptions={talentOptions}
          talentPlaceholder="Select talent"
          talentNoOptionsMessage={talentNoOptionsMessage}
          talentLoadError={talentLoadError}
          projects={projects}
          currentProjectId={projectId}
          onMoveToProject={handleMoveToProject}
          movingProject={movingProject}
          onCopyToProject={handleCopyToProject}
          copyingProject={copyingProject}
        />
      )}

      {/* Activity Timeline */}
      {clientId && projectId && (
        <div className="mx-6 mb-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h2>
            </CardHeader>
            <CardContent>
              <ActivityTimeline clientId={clientId} projectId={projectId} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


function selectShotImage(products = []) {
  for (const product of products) {
    if (!product) continue;
    if (product.thumbnailImagePath) return product.thumbnailImagePath;
    if (Array.isArray(product.images)) {
      const candidate = product.images.find(Boolean);
      if (candidate) return candidate;
    }
    if (product.colourImagePath) return product.colourImagePath;
  }
  return null;
}

const ShotProductChips = memo(function ShotProductChips({ products }) {
  if (!Array.isArray(products) || products.length === 0) {
    return <p className="mt-1 text-xs text-slate-500">No products linked</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {products.map((product, index) => {
        if (!product) return null;
        const sizeDescriptor =
          product.status === "pending-size"
            ? "size pending"
            : product.sizeScope === "all"
            ? "all sizes"
            : product.size
            ? product.size
            : "";
        const chipClass =
          product.status === "pending-size"
            ? "rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs text-amber-800 dark:text-amber-200"
            : "rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-300";
        const key =
          product.id ||
          `${product.familyId || "family"}-${product.colourId || "colour"}-${index}`;
        return (
          <span key={key} className={chipClass}>
            {product.familyName}
            {product.colourName ? ` – ${product.colourName}` : ""}
            {sizeDescriptor ? ` (${sizeDescriptor})` : ""}
          </span>
        );
      })}
    </div>
  );
});

const ShotTalentList = memo(function ShotTalentList({ talent }) {
  if (!Array.isArray(talent) || talent.length === 0) {
    return <p className="mt-1 text-xs text-slate-500">No talent assigned</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {talent.map((entry) => {
        if (!entry) return null;
        const key = entry.talentId || entry.name;
        return (
          <span key={key} className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
            {entry.name}
          </span>
        );
      })}
    </div>
  );
});

const ShotListCard = memo(function ShotListCard({
  shot,
  locationName,
  products,
  talent,
  notesHtml,
  canEditShots,
  onEdit,
  viewPrefs = defaultViewPrefs,
  isSelected = false,
  onToggleSelect = null,
}) {
  const formattedDate = toDateInputValue(shot.date);
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
  } = viewPrefs || defaultViewPrefs;
  const tags = Array.isArray(shot.tags) ? shot.tags : [];

  return (
    <Card className={`border shadow-sm transition ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {onToggleSelect && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(shot.id)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2" title={shot.name}>
              {shot.name}
            </h3>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {formattedDate && <span>Date: {formattedDate}</span>}
              {shot.type && <span>Type: {shot.type}</span>}
              {showLocation && locationName && <span title={locationName}>Location: {locationName}</span>}
            </div>
            {tags.length > 0 && (
              <div className="mt-2">
                <TagList tags={tags} emptyMessage={null} />
              </div>
            )}
          </div>
          {canEditShots && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
                Edit
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3 pt-2">
        {showNotes && (
          notesHtml ? (
            <div
              className="rounded-md bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: notesHtml }}
            />
          ) : (
            <p className="text-sm text-slate-500">No notes added yet.</p>
          )
        )}
        {showProducts && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Products
            </span>
            <ShotProductChips products={products} />
          </div>
        )}
        {showTalent && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Talent
            </span>
            <ShotTalentList talent={talent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const ShotGalleryCard = memo(function ShotGalleryCard({
  shot,
  locationName,
  products,
  talent,
  notesHtml,
  canEditShots,
  onEdit,
  viewPrefs = defaultViewPrefs,
  isSelected = false,
  onToggleSelect = null,
}) {
  const imagePath = useMemo(() => selectShotImage(products), [products]);
  const formattedDate = toDateInputValue(shot.date);
  const plainNotes = notesHtml
    ? notesHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
  } = viewPrefs || defaultViewPrefs;
  const tags = Array.isArray(shot.tags) ? shot.tags : [];

  return (
    <Card className={`overflow-hidden border shadow-sm transition ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <div className="relative h-48 bg-slate-100">
        <AppImage
          src={imagePath}
          alt={`${shot.name} preview`}
          preferredSize={640}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          fallback={
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              No preview available
            </div>
          }
          placeholder={
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              Loading preview…
            </div>
          }
        />
        {onToggleSelect && (
          <div className="absolute left-3 top-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(shot.id)}
              className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary shadow-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {canEditShots && (
          <div className="absolute right-3 top-3 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          </div>
        )}
      </div>
      <CardContent className="space-y-2 px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2" title={shot.name}>
            {shot.name}
          </h3>
          {shot.type && <span className="text-xs uppercase tracking-wide text-primary">{shot.type}</span>}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {formattedDate && <span>{formattedDate}</span>}
          {showLocation && locationName && <span title={locationName}>{locationName}</span>}
        </div>
        {tags.length > 0 && (
          <div>
            <TagList tags={tags} emptyMessage={null} />
          </div>
        )}
        {showNotes && (
          plainNotes ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{plainNotes}</p>
          ) : (
            <p className="text-sm text-slate-500">No notes added yet.</p>
          )
        )}
        {showProducts && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Products
            </span>
            <ShotProductChips products={products} />
          </div>
        )}
        {showTalent && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Talent
            </span>
            <ShotTalentList talent={talent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
