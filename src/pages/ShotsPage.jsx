// src/pages/ShotsPage.jsx (global shots version)
//
// This version centralises all shots into a single collection at
// `clients/{clientId}/shots` and adds a `projectId` field to each shot
// document.  When fetching shots we filter on the active project ID using
// a `where('projectId', '==', projectId)` clause.  This makes it easy to
// reassign shots to other projects—simply update the `projectId` field.

import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  useShots,
  useProjects,
  useProducts,
  useTalent,
  useLocations,
  useLanes,
} from "../hooks/useFirestoreQuery";
import {
  useCreateShot,
  useUpdateShot,
  useDeleteShot,
  useBulkUpdateShots,
  useCreateProduct,
  useUpdateProduct,
  useCreateProject,
  useUpdateProject,
} from "../hooks/useFirestoreMutations";
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
import { db, uploadImageFile } from "../lib/firebase";
import {
  shotsPath as getShotsPath,
  productFamiliesPath,
  productFamilyPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import {
  LayoutGrid,
  Search,
  ChevronDown,
  Camera,
  Calendar,
  Users,
  X,
  CheckSquare,
  Plus,
  Table,
  Shapes,
  MapPin,
  CircleDot,
  Package,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/EmptyState";
import ExportButton from "../components/common/ExportButton";
import { searchShots } from "../lib/search";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageHeader } from "../components/ui/PageHeader";
import { ShotsOverviewProvider, useShotsOverview } from "../context/ShotsOverviewContext";
import {
  FieldVisibilityMenu,
  OverviewToolbar,
  OverviewToolbarRow,
  SortMenu,
  ToolbarIconButton,
  ViewModeMenu,
  DensityMenu,
} from "../components/overview";

const PlannerPage = lazy(() => import("./PlannerPage"));
import { VirtualizedGrid } from "../components/ui/VirtualizedList";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import TalentMultiSelect from "../components/shots/TalentMultiSelect";
import NotesEditor from "../components/shots/NotesEditor";
import ShotEditModal from "../components/shots/ShotEditModal";
import BulkOperationsToolbar from "../components/shots/BulkOperationsToolbar";
import ShotTableView from "../components/shots/ShotTableView";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";
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
import { buildActiveFilterPills, defaultOverviewFilters, removeFilterKey } from "../lib/overviewFilters";
import { normaliseShotStatus, DEFAULT_SHOT_STATUS } from "../lib/shotStatus";
import { normaliseShot, sortShotsForView, SHOT_SORT_OPTIONS } from "../lib/shotsSelectors";
import { getStaggerDelay } from "../lib/animations";
import ShotsAssetsTab from "../components/shots/ShotsAssetsTab";
import {
  createInitialSectionStatuses,
  cloneShotDraft,
  deriveSectionStatuses,
  markSectionsForState,
  buildSectionDiffMap,
} from "../lib/shotSectionStatus";
import { convertLegacyImageToAttachment } from "../lib/migrations/migrateShots";

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

const SHOTS_PREFS_STORAGE_KEY = "shots:viewPrefs";

const DEFAULT_SHOT_DENSITY = "comfortable";
const UNTITLED_SHOT_FALLBACK_NAME = "Untitled shot";
const COPY_NAME_PATTERN = /(.*) \(Copy(?: (\d+))?\)$/i;

const buildDuplicateName = (rawName, usedNames) => {
  const baseInput = typeof rawName === "string" ? rawName.trim() : "";
  const initial = baseInput || UNTITLED_SHOT_FALLBACK_NAME;
  const match = initial.match(COPY_NAME_PATTERN);
  const baseName = match && match[1] ? match[1].trim() || UNTITLED_SHOT_FALLBACK_NAME : initial;

  let attempt = 1;
  let candidate = `${baseName} (Copy)`;

  while (usedNames.has(candidate.toLowerCase())) {
    attempt += 1;
    candidate = `${baseName} (Copy ${attempt})`;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const defaultViewPrefs = {
  // Visibility toggles
  showProducts: true,
  showTalent: true,
  showLocation: true,
  showNotes: true,
  showStatus: true,
  showImage: true,
  showName: true,
  showType: true,
  showDate: true,
  // Sorting + density
  sort: "alpha",
  density: DEFAULT_SHOT_DENSITY,
};

const normaliseShotRecord = (id, data, fallbackProjectId) =>
  normaliseShot({ id, ...data }, { fallbackProjectId }) || { id, ...data };

const AUTOSAVE_DELAY_MS = 1200;

const DETAIL_TOGGLE_OPTIONS = [
  { key: "showStatus", label: "Status" },
  { key: "showImage", label: "Image" },
  { key: "showName", label: "Shot Name" },
  { key: "showType", label: "Type" },
  { key: "showDate", label: "Date" },
  { key: "showNotes", label: "Notes" },
  { key: "showProducts", label: "Products" },
  { key: "showTalent", label: "Talent" },
  { key: "showLocation", label: "Location" },
];

const SHOT_VIEW_OPTIONS = [
  { value: "gallery", label: "Gallery", icon: LayoutGrid, hideLabelOnSmallScreen: true },
  { value: "table", label: "Table", icon: Table, hideLabelOnSmallScreen: true },
];

const SHOT_DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfy" },
];

const normaliseShotDensity = (value) => {
  if (value === "compact") return "compact";
  if (value === "comfortable") return "comfortable";
  // Legacy mappings
  if (value === "cozy") return "comfortable";
  if (value === "extra") return "compact";
  return DEFAULT_SHOT_DENSITY;
};

// Density configuration for shot views with dramatic differences (25-50% between levels)
const SHOT_DENSITY_CONFIG = {
  compact: {
    // Table-specific
    tableRow: 'py-1.5',      // 6px vertical padding
    tablePadding: 'px-2',    // 8px horizontal padding
    tableText: 'text-xs',
  },
  comfortable: {
    // Table-specific
    tableRow: 'py-3',        // 12px vertical padding
    tablePadding: 'px-4',    // 16px horizontal padding
    tableText: 'text-sm',
  },
};

const readStoredShotsView = () => {
  const stored = readStorage(SHOTS_VIEW_STORAGE_KEY);
  if (stored === "list") return "gallery"; // migrate away from list
  if (stored === "table") return "table";
  return "gallery";
};

const readStoredShotFilters = () => {
  try {
    const raw = readStorage(SHOTS_FILTERS_STORAGE_KEY);
    if (!raw) return { ...defaultOverviewFilters };
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
      showArchived: parsed.showArchived === true,
    };
  } catch (error) {
    console.warn("[Shots] Failed to parse stored filters", error);
    return { ...defaultOverviewFilters };
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
      showStatus: parsed.showStatus !== false,
      showImage: parsed.showImage !== false,
      showName: parsed.showName !== false,
      showType: parsed.showType !== false,
      showDate: parsed.showDate !== false,
      sort: typeof parsed.sort === "string" ? parsed.sort : defaultViewPrefs.sort,
      density: normaliseShotDensity(parsed.density),
    };
  } catch (error) {
    console.warn("[Shots] Failed to read view prefs", error);
    return { ...defaultViewPrefs };
  }
};

export function ShotsWorkspace() {
  const [queryText, setQueryText] = useState("");
  const debouncedQueryText = useDebouncedValue(queryText, 300);
  const [createDraft, setCreateDraft] = useState({ ...initialShotDraft });
  const [createAutoStatus, setCreateAutoStatus] = useState(() => createInitialSectionStatuses());
  const [talentLoadError, setTalentLoadError] = useState(null);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const [viewMode, setViewMode] = useState(() => readStoredShotsView());
  const [localFilters, setLocalFilters] = useState(() => readStoredShotFilters());
  const [viewPrefs, setViewPrefs] = useState(() => readStoredViewPrefs());
  const [editingShot, setEditingShot] = useState(null);
  const [editAutoStatus, setEditAutoStatus] = useState(() => createInitialSectionStatuses());
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [movingProject, setMovingProject] = useState(false);
  const [copyingProject, setCopyingProject] = useState(false);
  const [localSelectedShotIds, setLocalSelectedShotIds] = useState(() => new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [stickyOffset, setStickyOffset] = useState(80);
  const autoSaveTimerRef = useRef(null);
  const autoSaveInflightRef = useRef(false);
  const editingShotRef = useRef(editingShot);
  const isSavingShotRef = useRef(isSavingShot);
  const overview = useShotsOverview();
  const filters = overview?.filters ?? localFilters;
  const setFilters = overview?.setFilters ?? setLocalFilters;
  const selectedShotIds = overview?.selectedShotIds ?? localSelectedShotIds;
  const setSelectedShotIds = overview?.setSelectedShotIds ?? setLocalSelectedShotIds;
  const focusShotId = overview?.focusShotId ?? null;
  const setFocusShotId = overview?.setFocusShotId ?? (() => {});
  const navigate = useNavigate();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  const projectId = currentProjectId;
  const { clientId, role: globalRole, projectRoles = {}, user, claims } = useAuth();

  // TanStack Query hooks for data fetching with intelligent caching
  const { data: shots = [], isLoading: shotsLoading } = useShots(clientId, projectId);
  const { data: families = [], isLoading: familiesLoading } = useProducts(clientId);
  const talentOptionsScope = FLAGS.projectScopedAssets ? { projectId, scope: "project" } : {};
  const locationOptionsScope = FLAGS.projectScopedAssets ? { projectId, scope: "project" } : {};
  const { data: talent = [], isLoading: talentLoading } = useTalent(clientId, talentOptionsScope);
  const { data: locations = [], isLoading: locationsLoading } = useLocations(clientId, locationOptionsScope);
  const { data: lanes = [] } = useLanes(clientId, projectId);
  const { data: projects = [], isLoading: projectsLoading } = useProjects(clientId);

  // TanStack Query mutation hooks for create/update/delete operations
  const createShotMutation = useCreateShot(clientId, { projectId });
  const updateShotMutation = useUpdateShot(clientId, projectId);
  const deleteShotMutation = useDeleteShot(clientId, projectId);
  const bulkUpdateShotsMutation = useBulkUpdateShots(clientId, projectId);
  const createProductMutation = useCreateProduct(clientId);
  const updateProductMutation = useUpdateProduct(clientId);
  const createProjectMutation = useCreateProject(clientId);
  const updateProjectMutation = useUpdateProject(clientId);

  const userRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectRoles, projectId]
  );
  const canEditShots = canManageShots(userRole);
  // Use globalRole for product permissions since products are client-scoped, not project-scoped
  const canManageProducts = canEditProducts(globalRole);

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
    editingShotRef.current = editingShot;
  }, [editingShot]);

  useEffect(() => {
    isSavingShotRef.current = isSavingShot;
  }, [isSavingShot]);

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
        return { talentId: entry.id, name, headshotPath: entry.headshotPath || entry.photoPath || null };
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

  // Location filter options for react-select (single-select)
  const locationFilterOptions = useMemo(
    () =>
      locations.map((loc) => ({
        value: loc.id,
        label: loc.name || "Untitled location",
      })),
    [locations]
  );

  const locationFilterValue = useMemo(() => {
    const id = filters.locationId || "";
    if (!id) return null;
    return (
      locationFilterOptions.find((opt) => opt.value === id) || {
        value: id,
        label: "Unknown location",
      }
    );
  }, [filters.locationId, locationFilterOptions]);

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
  const filteredShots = useMemo(() => {
    const term = debouncedQueryText.trim();
    const selectedLocation = filters.locationId || "";
    const selectedTalentIds = new Set(filters.talentIds || []);
    const selectedProductIds = new Set(filters.productFamilyIds || []);
    const selectedTagIds = new Set(filters.tagIds || []);

    // Apply non-text filters first
    const preFiltered = shots.filter((shot) => {
      if (!filters.showArchived && shot.deleted) {
        return false;
      }

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
    if (viewMode === "gallery" || viewMode === "table") {
      writeStorage(SHOTS_VIEW_STORAGE_KEY, viewMode);
    }
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
        showArchived: filters.showArchived === true,
      })
    );
  }, [filters]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = null;
    let timeoutId = null;

    const measure = () => {
      // Get the sticky elements that contribute to the sticky offset
      const navElement = document.querySelector("[data-app-top-nav]");
      const shotOverviewHeader = document.querySelector("[data-shot-overview-header]");

      if (!navElement) return;

      // Calculate total height of sticky elements above the sticky toolbar
      // IMPORTANT: Only include elements with position:sticky that remain visible when scrolling
      let totalOffset = 0;

      // Navigation bar height (sticky, always visible)
      const navHeight = navElement.offsetHeight || 64; // Default to 64px if not found
      totalOffset += navHeight;

      // Shot Overview header height (sticky, always visible)
      const headerHeight = shotOverviewHeader?.offsetHeight || 73; // Default to 73px if not found
      totalOffset += headerHeight;

      // Note: We do NOT include breadcrumb height because it has position:static
      // and scrolls away with the page content.

      // Update the sticky offset if it changed
      setStickyOffset((current) => {
        const newOffset = totalOffset;

        // Log measurements for debugging (only when offset changes)
        if (current !== newOffset) {
          console.log('📏 Sticky Toolbar Offset Calculation:', {
            navHeight,
            headerHeight,
            calculatedOffset: totalOffset,
            finalOffset: newOffset,
            previousOffset: current
          });
        }

        return newOffset;
      });
    };

    const scheduleMeasure = () => {
      if (frameId != null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    // Initial measurement with a small delay to ensure DOM is ready
    timeoutId = setTimeout(() => {
      measure();
    }, 100);

    // Re-measure on scroll and resize
    window.addEventListener("resize", scheduleMeasure);
    const scrollListenerOptions = { passive: true };
    window.addEventListener("scroll", scheduleMeasure, scrollListenerOptions);

    // Use ResizeObserver for dynamic content changes
    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleMeasure);

      const navElement = document.querySelector("[data-app-top-nav]");
      if (navElement) resizeObserver.observe(navElement);
    }

    return () => {
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, scrollListenerOptions);
      resizeObserver?.disconnect();
      if (frameId != null) window.cancelAnimationFrame(frameId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    writeStorage(
      SHOTS_PREFS_STORAGE_KEY,
      JSON.stringify({
        showProducts: viewPrefs.showProducts,
        showTalent: viewPrefs.showTalent,
        showLocation: viewPrefs.showLocation,
        showNotes: viewPrefs.showNotes,
        showStatus: viewPrefs.showStatus,
        showImage: viewPrefs.showImage,
        showName: viewPrefs.showName,
        showType: viewPrefs.showType,
        showDate: viewPrefs.showDate,
        sort: viewPrefs.sort,
        density: normaliseShotDensity(viewPrefs.density),
      })
    );
  }, [viewPrefs]);

  useEffect(() => {
    if (!isSearchExpanded) return undefined;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isSearchExpanded]);

  const familyDetailCacheRef = useRef(new Map());
  const searchInputRef = useRef(null);

  useEffect(() => {
    familyDetailCacheRef.current.clear();
  }, [families]);

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

  const tableRows = useMemo(
    () =>
      sortedShots.map((shot) => {
        const products = normaliseShotProducts(shot);
        const talentSelection = mapShotTalentToSelection(shot);
        const notesHtml = formatNotesForDisplay(shot.description);
        const locationName =
          shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";

        return {
          id: shot.id,
          shot,
          products,
          talent: talentSelection,
          notesHtml,
          locationName,
        };
      }),
    [sortedShots, normaliseShotProducts, mapShotTalentToSelection, locationById]
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

    setCreateAutoStatus((current) =>
      markSectionsForState(current, createDraft, initialShotDraft, "saving")
    );
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

      // Handle reference image upload if provided
      let referenceImagePath = validation.data.referenceImagePath || null;
      if (createDraft.referenceImageFile) {
        try {
          const tempId = `temp-${Date.now()}`;
          const result = await uploadImageFile(createDraft.referenceImageFile, {
            folder: "shots/references",
            id: tempId,
          });
          referenceImagePath = result.path;
        } catch (uploadError) {
          console.error("[Shots] Failed to upload reference image:", uploadError);
          toast.error({ title: "Image upload failed", description: "Continuing without reference image" });
        }
      }

      const shotData = {
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
        createdBy: user?.uid || null,
        referenceImagePath,
        referenceImageCrop: createDraft.referenceImageCrop || null,
      };

      // Use TanStack Query mutation hook for automatic cache invalidation
      const newShot = await new Promise((resolve, reject) => {
        createShotMutation.mutate(shotData, {
          onSuccess: (data) => {
            resolve(data);
          },
          onError: (error) => {
            reject(error);
          },
        });
      });

      console.info("[Shots] Shot created", {
        path: targetPath,
        projectId: resolvedProjectId,
        docId: newShot.id,
        ...authInfo,
      });

      // Update reverse indexes for product/talent lookups
      await updateReverseIndexes({
        shotId: newShot.id,
        before: { productIds: [], products: [], talentIds: [], locationId: null },
        after: {
          productIds: shotData.productIds,
          products: productsForWrite,
          talentIds: shotData.talentIds,
          locationId: shotData.locationId,
        },
      });

      setCreateDraft({ ...initialShotDraft });
      setCreateAutoStatus(createInitialSectionStatuses());
      setCreateModalOpen(false);
      toast.success(`Shot "${shotData.name}" created.`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid product selection", description: message });
        setCreateAutoStatus((current) =>
          markSectionsForState(current, createDraft, initialShotDraft, "error", {
            message,
          })
        );
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
        setCreateAutoStatus((current) =>
          markSectionsForState(current, createDraft, initialShotDraft, "error", {
            message: message || "Auto-save failed",
          })
        );
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
    setCreateAutoStatus(createInitialSectionStatuses());
    setCreateModalOpen(true);
  }, [canEditShots, projectId, setCreateAutoStatus]);

  const toggleViewPref = useCallback((key) => {
    setViewPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const selectSort = useCallback((sortValue) => {
    setViewPrefs((prev) => ({ ...prev, sort: sortValue }));
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

    if (Object.prototype.hasOwnProperty.call(patch, "referenceImagePath")) {
      docPatch.referenceImagePath = patch.referenceImagePath || null;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "attachments")) {
      docPatch.attachments = Array.isArray(patch.attachments) ? patch.attachments : [];
    }

    const after = {
      productIds: docPatch.productIds ?? before.productIds,
      products: docPatch.products ?? before.products,
      talentIds: docPatch.talentIds ?? before.talentIds,
      locationId: docPatch.locationId ?? before.locationId,
    };

    try {
      // Use TanStack Query mutation hook for automatic cache invalidation
      await new Promise((resolve, reject) => {
        updateShotMutation.mutate(
          { shotId: shot.id, updates: docPatch },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
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
    // Use TanStack Query mutation hook for automatic cache invalidation
    await new Promise((resolve, reject) => {
      deleteShotMutation.mutate(
        { shotId: shot.id },
        {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        }
      );
    });
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

  const handleShowArchivedChange = useCallback((checked) => {
    setFilters((previous) => ({
      ...previous,
      showArchived: checked,
    }));
  }, []);

  // Build active filters array for pills
  const activeFilters = useMemo(
    () =>
      buildActiveFilterPills(filters, {
        locations,
        talentOptions: talentFilterOptions,
        productOptions: productFilterOptions,
        tagOptions: tagFilterOptions,
      }),
    [filters, locations, talentFilterOptions, productFilterOptions, tagFilterOptions]
  );

  // Remove individual filter
  const removeFilter = useCallback(
    (filterKey) => {
      setFilters((prev) => removeFilterKey(prev, filterKey));
    },
    []
  );

  const updateViewMode = useCallback(
    (nextMode) =>
      setViewMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode)),
    []
  );

  // Selection handlers
  const toggleShotSelection = useCallback(
    (shotId) => {
      if (!selectionMode) return;
      setSelectedShotIds((prev) => {
        const next = new Set(prev);
        if (next.has(shotId)) {
          next.delete(shotId);
          if (focusShotId === shotId) {
            const iterator = next.values();
            const first = iterator.next();
            setFocusShotId(first.done ? null : first.value);
          }
        } else {
          next.add(shotId);
          setFocusShotId(shotId);
        }
        return next;
      });
    },
    [selectionMode, focusShotId, setFocusShotId, setSelectedShotIds]
  );

  const toggleSelectAll = useCallback(() => {
    if (!selectionMode) return;
    if (selectedShotIds.size === sortedShots.length && sortedShots.length > 0) {
      setSelectedShotIds(new Set());
      setFocusShotId(null);
    } else {
      const next = sortedShots.map((shot) => shot.id);
      setSelectedShotIds(new Set(next));
      setFocusShotId(next.length ? next[0] : null);
    }
  }, [selectionMode, selectedShotIds.size, sortedShots, setFocusShotId, setSelectedShotIds]);

  const clearSelection = useCallback(() => {
    setSelectedShotIds(new Set());
    setFocusShotId(null);
  }, [setSelectedShotIds, setFocusShotId]);

  const exitSelectionMode = useCallback(() => {
    clearSelection();
    setSelectionMode(false);
  }, [clearSelection]);

  const handleSelectionModeToggle = useCallback(() => {
    if (selectionMode) {
      exitSelectionMode();
    } else {
      setSelectionMode(true);
    }
  }, [selectionMode, exitSelectionMode]);

  const selectedShots = useMemo(() => {
    return sortedShots.filter((shot) => selectedShotIds.has(shot.id));
  }, [sortedShots, selectedShotIds]);

  useEffect(() => {
    if (!selectionMode && selectedShotIds.size > 0) {
      clearSelection();
    }
  }, [selectionMode, selectedShotIds.size, clearSelection]);

  const handleFocusShot = useCallback(
    (candidate, options = {}) => {
      const mirrorSelection = Boolean(options?.mirrorSelection);
      let nextId = null;

      if (!candidate && typeof options === "string") {
        nextId = options;
      } else if (typeof candidate === "string") {
        nextId = candidate;
      } else {
        nextId = candidate?.id || null;
      }

      if (!nextId) {
        setFocusShotId(null);
        if (mirrorSelection) {
          setSelectedShotIds(new Set());
        }
        return;
      }

      setFocusShotId(nextId);
      if (mirrorSelection) {
        setSelectedShotIds(new Set([nextId]));
      }
    },
    [setFocusShotId, setSelectedShotIds]
  );

  const handleSearchClear = useCallback(() => {
    setQueryText("");
    setIsSearchExpanded(false);
  }, []);

  const handleSearchKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsSearchExpanded(false);
      }
    },
    []
  );

  const openShotEditor = useCallback(
    (shot) => {
      if (!shot) return;
      setFocusShotId(shot.id);
      try {
        const products = normaliseShotProducts(shot);
        const talentSelection = mapShotTalentToSelection(shot);

        // AUTO-MIGRATION: Convert legacy referenceImagePath to attachments array if needed
        let attachments = Array.isArray(shot.attachments) ? shot.attachments : [];
        if (attachments.length === 0 && shot.referenceImagePath) {
          const migratedAttachment = convertLegacyImageToAttachment(shot, user?.uid);
          if (migratedAttachment) {
            attachments = [migratedAttachment];
          }
        }

        const draft = {
          name: shot.name || "",
          description: shot.description || "",
          type: shot.type || "",
          date: toDateInputValue(shot.date),
          locationId: shot.locationId || "",
          status: normaliseShotStatus(shot.status || DEFAULT_SHOT_STATUS),
          talent: talentSelection,
          products,
          tags: Array.isArray(shot.tags) ? shot.tags : [],
          attachments,
          referenceImagePath: shot.referenceImagePath || "",
          referenceImageCrop: shot.referenceImageCrop || null,
          referenceImageFile: null,
        };
        setEditingShot({
          shot,
          draft,
          initialDraft: cloneShotDraft(draft),
        });
        setEditAutoStatus(createInitialSectionStatuses());
      } catch (error) {
        console.error("[Shots] Failed to prepare shot for editing", error);
        toast.error("Unable to open shot editor");
      }
  },
    [mapShotTalentToSelection, normaliseShotProducts, setEditAutoStatus, setFocusShotId, user]
  );

  const handleEditShot = useCallback(
    (shot) => {
      if (!canEditShots) return;
      openShotEditor(shot);
    },
    [canEditShots, openShotEditor]
  );

  const handleCreateDraftChange = useCallback(
    (patch) => {
      setCreateDraft((previous) => {
        const nextDraft = { ...previous, ...patch };
        setCreateAutoStatus((current) => deriveSectionStatuses(nextDraft, initialShotDraft, current));
        return nextDraft;
      });
    },
    [setCreateAutoStatus]
  );

  const updateEditingDraft = useCallback(
    (patch) => {
      setEditingShot((previous) => {
        if (!previous) return previous;
        const nextDraft = {
          ...previous.draft,
          ...patch,
        };
        const baseline = previous.initialDraft || cloneShotDraft(previous.draft);
        setEditAutoStatus((current) => deriveSectionStatuses(nextDraft, baseline, current));
        return {
          ...previous,
          draft: nextDraft,
        };
      });
    },
    [setEditAutoStatus]
  );

  const closeShotEditor = useCallback(() => {
    setEditingShot(null);
    setIsSavingShot(false);
    setEditAutoStatus(createInitialSectionStatuses());
  }, [setEditAutoStatus]);

  const performAutoSave = useCallback(async () => {
    const snapshot = editingShotRef.current;
    if (!snapshot || isSavingShotRef.current || autoSaveInflightRef.current) {
      return;
    }

    const draft = snapshot.draft;
    const baseline = snapshot.initialDraft || cloneShotDraft(draft);
    const diffMap = buildSectionDiffMap(draft, baseline);
    const hasChanges = Object.values(diffMap).some(Boolean);
    if (!hasChanges) {
      return;
    }

    autoSaveInflightRef.current = true;

    setEditAutoStatus((current) => markSectionsForState(current, draft, baseline, "saving"));

    const patch = {};

    if (diffMap.basics) {
      patch.name = draft.name;
      patch.status = draft.status ?? DEFAULT_SHOT_STATUS;
      patch.type = draft.type || "";
      patch.date = draft.date || "";
      patch.locationId = draft.locationId || "";
    }

    if (diffMap.logistics) {
      patch.products = Array.isArray(draft.products) ? draft.products.map((product) => ({ ...product })) : [];
      patch.talent = Array.isArray(draft.talent) ? draft.talent.map((entry) => ({ ...entry })) : [];
      patch.tags = Array.isArray(draft.tags) ? draft.tags.map((tag) => ({ ...tag })) : [];
    }

    if (diffMap.creative) {
      patch.description = draft.description || "";
    }

    if (diffMap.attachments) {
      let referenceImagePath = draft.referenceImagePath || null;
      const referenceImageCrop = draft.referenceImageCrop || null;
      if (draft.referenceImageFile) {
        try {
          const uploadResult = await uploadImageFile(draft.referenceImageFile, {
            folder: "shots/references",
            id: snapshot.shot.id,
          });
          referenceImagePath = uploadResult.path;
        } catch (uploadError) {
          const { message: uploadMessage } = describeFirebaseError(uploadError, "Unable to upload reference image.");
          console.error("[Shots] Auto-save upload failed", uploadError);
          setEditAutoStatus((current) =>
            markSectionsForState(current, draft, baseline, "error", {
              message: uploadMessage || "Auto-save failed",
            })
          );
          toast.error({ title: "Auto-save failed", description: uploadMessage });
          autoSaveInflightRef.current = false;
          return;
        }
      }
      patch.referenceImagePath = referenceImagePath;
      patch.referenceImageCrop = referenceImageCrop || null;
      patch.attachments = draft.attachments || [];
    }

    if (!Object.keys(patch).length) {
      autoSaveInflightRef.current = false;
      return;
    }

    try {
      await updateShot(snapshot.shot, patch);
      const timestamp = Date.now();
      const draftUpdate = {
        ...draft,
        ...(diffMap.attachments
          ? {
              referenceImagePath: patch.referenceImagePath || null,
              referenceImageCrop: patch.referenceImageCrop || null,
              referenceImageFile: null,
              attachments: patch.attachments || [],
            }
          : {}),
      };

      setEditAutoStatus((current) =>
        markSectionsForState(current, draftUpdate, baseline, "saved", { timestamp })
      );

      setEditingShot((previous) => {
        if (!previous || previous.shot.id !== snapshot.shot.id) {
          return previous;
        }

        const shotUpdate = { ...previous.shot };

        if (diffMap.basics) {
          shotUpdate.name = draftUpdate.name;
          shotUpdate.status = normaliseShotStatus(draftUpdate.status ?? DEFAULT_SHOT_STATUS);
          shotUpdate.type = draftUpdate.type || "";
          shotUpdate.date = draftUpdate.date || "";
          shotUpdate.locationId = draftUpdate.locationId || null;
        }

        if (diffMap.logistics) {
          shotUpdate.products = Array.isArray(draftUpdate.products)
            ? draftUpdate.products.map((product) => ({ ...product }))
            : [];
          shotUpdate.talent = Array.isArray(draftUpdate.talent)
            ? draftUpdate.talent.map((entry) => ({ ...entry }))
            : [];
          shotUpdate.tags = Array.isArray(draftUpdate.tags)
            ? draftUpdate.tags.map((tag) => ({ ...tag }))
            : [];
        }

        if (diffMap.creative) {
          shotUpdate.description = draftUpdate.description || "";
          shotUpdate.notes = draftUpdate.description || "";
        }

        if (diffMap.attachments) {
          shotUpdate.referenceImagePath = draftUpdate.referenceImagePath || null;
          shotUpdate.referenceImageCrop = draftUpdate.referenceImageCrop || null;
          shotUpdate.attachments = draftUpdate.attachments || [];
        }

        return {
          ...previous,
          shot: shotUpdate,
          draft: draftUpdate,
          initialDraft: cloneShotDraft(draftUpdate),
        };
      });
    } catch (error) {
      const { message: errorMessage } = describeFirebaseError(error, "Unable to auto-save shot.");
      console.error("[Shots] Auto-save failed", error);
      setEditAutoStatus((current) =>
        markSectionsForState(current, draft, baseline, "error", {
          message: errorMessage || "Auto-save failed",
        })
      );
      toast.error({ title: "Auto-save failed", description: errorMessage });
    } finally {
      autoSaveInflightRef.current = false;
    }
  }, [updateShot, setEditAutoStatus, setEditingShot]);

  const handleSaveShot = useCallback(async () => {
    if (!editingShot) return;
    if (!canEditShots) {
      toast.error("You do not have permission to edit shots.");
      return;
    }

    const baselineDraft = editingShot.initialDraft || cloneShotDraft(editingShot.draft);
    setEditAutoStatus((current) =>
      markSectionsForState(current, editingShot.draft, baselineDraft, "saving")
    );
    setIsSavingShot(true);
    try {
      const parsed = shotDraftSchema.parse({
        ...editingShot.draft,
        locationId: editingShot.draft.locationId || "",
      });

      // Handle reference image upload if provided
      let referenceImagePath = parsed.referenceImagePath || null;
      if (editingShot.draft.referenceImageFile) {
        try {
          const result = await uploadImageFile(editingShot.draft.referenceImageFile, {
            folder: "shots/references",
            id: editingShot.shot.id,
          });
          referenceImagePath = result.path;
        } catch (uploadError) {
          console.error("[Shots] Failed to upload reference image:", uploadError);
          toast.error({ title: "Image upload failed", description: "Continuing without updating reference image" });
        }
      }

      await updateShot(editingShot.shot, {
        name: parsed.name,
        description: parsed.description || "",
        type: parsed.type || "",
        date: parsed.date || "",
        locationId: parsed.locationId || null,
        talent: parsed.talent,
        products: parsed.products,
        tags: parsed.tags || [],
        referenceImagePath,
        referenceImageCrop: editingShot.draft.referenceImageCrop || null,
        attachments: editingShot.draft.attachments || [],
      });
      toast.success(`Shot "${parsed.name}" updated.`);
      setEditAutoStatus((current) =>
        markSectionsForState(current, editingShot.draft, baselineDraft, "saved", {
          timestamp: Date.now(),
        })
      );
      setEditingShot(null);
      setEditAutoStatus(createInitialSectionStatuses());
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        toast.error({ title: "Invalid shot details", description: message });
        setEditAutoStatus((current) =>
          markSectionsForState(current, editingShot.draft, baselineDraft, "error", {
            message,
          })
        );
      } else {
        const { code, message } = describeFirebaseError(error, "Unable to update shot.");
        toast.error({ title: "Failed to update shot", description: `${code}: ${message}` });
        setEditAutoStatus((current) =>
          markSectionsForState(current, editingShot.draft, baselineDraft, "error", {
            message: message || "Auto-save failed",
          })
        );
      }
      console.error("[Shots] Failed to save shot", error);
    } finally {
      setIsSavingShot(false);
    }
  }, [editingShot, canEditShots, updateShot, setEditAutoStatus]);

  useEffect(() => {
    if (!editingShot) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    const hasPending = Object.values(editAutoStatus || {}).some((entry) => entry?.state === "pending");

    if (hasPending && !isSavingShot && !autoSaveInflightRef.current) {
      if (!autoSaveTimerRef.current) {
        autoSaveTimerRef.current = setTimeout(() => {
          autoSaveTimerRef.current = null;
          performAutoSave();
        }, AUTOSAVE_DELAY_MS);
      }
    } else if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [editingShot, editAutoStatus, isSavingShot, performAutoSave]);

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    },
    []
  );

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
      setEditAutoStatus(createInitialSectionStatuses());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to move shot.");
      console.error("[Shots] Failed to move shot", error);
      toast.error({ title: "Failed to move shot", description: `${code}: ${message}` });
    } finally {
      setMovingProject(false);
    }
  }, [editingShot, canEditShots, projects, currentShotsPath, setEditAutoStatus]);

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
        referenceImagePath: shotData.referenceImagePath || null,
        referenceImageCrop: shotData.referenceImageCrop || null,
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
      setFocusShotId(null);
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
      setFocusShotId(null);
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
      // Get location name for denormalization
      const locationName = locationId
        ? locations.find((loc) => loc.id === locationId)?.name || null
        : null;

      // Use TanStack Query bulk mutation hook
      const shotIds = selectedShots.map(shot => shot.id);
      await new Promise((resolve, reject) => {
        bulkUpdateShotsMutation.mutate(
          {
            shotIds,
            updates: {
              locationId: locationId || null,
              locationName: locationName,
            }
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });

      const locationLabel = locationId ? (locationName || "Unknown location") : "None";
      toast.success({
        title: "Location updated",
        description: `Set location to "${locationLabel}" for ${selectedShots.length} shot${
          selectedShots.length === 1 ? "" : "s"
        }.`,
      });

      // Clear selection after successful operation
      setSelectedShotIds(new Set());
      setFocusShotId(null);
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
  }, [canEditShots, selectedShots, locations, isProcessingBulk, bulkUpdateShotsMutation]);

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
      setFocusShotId(null);
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

  // Bulk set lane for selected shots
  const handleBulkSetLane = useCallback(async (laneId) => {
    if (!canEditShots || selectedShots.length === 0) return;
    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }
    setIsProcessingBulk(true);
    try {
      const updates = { laneId: laneId || null };
      if (laneId) {
        const lane = lanes.find((l) => l.id === laneId);
        if (lane?.name && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) {
          updates.date = lane.name;
        }
      } else {
        updates.date = null;
      }
      const shotIds = selectedShots.map((s) => s.id);
      await new Promise((resolve, reject) => {
        bulkUpdateShotsMutation.mutate(
          { shotIds, updates },
          { onSuccess: () => resolve(), onError: (error) => reject(error) }
        );
      });
      toast.success({ title: "Lane updated", description: `Updated ${selectedShots.length} shots.` });
      setSelectedShotIds(new Set());
      setFocusShotId(null);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to set lane.");
      console.error("[Shots] Failed to set lane in bulk", error);
      toast.error({ title: "Failed to set lane", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [canEditShots, selectedShots, lanes, bulkUpdateShotsMutation, isProcessingBulk, setSelectedShotIds, setFocusShotId]);

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
      setFocusShotId(null);
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
   * Duplicate selected shots within the current project
   */
  const handleBulkDuplicateShots = useCallback(async () => {
    if (!canEditShots || selectedShots.length === 0) return;
    if (!projectId) {
      toast.error({
        title: "No project selected",
        description: "Select a project before duplicating shots.",
      });
      return;
    }

    if (isProcessingBulk) {
      toast.info({ title: "Please wait", description: "Another operation is in progress." });
      return;
    }

    const usedNames = new Set(
      sortedShots
        .map((shot) => (typeof shot?.name === "string" ? shot.name.trim() : ""))
        .filter(Boolean)
        .map((name) => name.toLowerCase())
    );

    setIsProcessingBulk(true);
    try {
      const createdShots = [];

      for (let index = 0; index < selectedShots.length; index += 1) {
        const shot = selectedShots[index];
        const duplicateName = buildDuplicateName(shot?.name, usedNames);

        const rawProducts = Array.isArray(shot?.products) ? shot.products : [];
        const productsForWrite = rawProducts
          .map((product) => {
            if (!product) return null;
            try {
              return mapProductForWrite(product);
            } catch (error) {
              console.warn("[Shots] Skipping product while duplicating shot", {
                shotId: shot?.id,
                product,
                error,
              });
              return null;
            }
          })
          .filter(Boolean);

        const productIds = extractProductIds(productsForWrite);

        const talentSource = Array.isArray(shot?.talent) && shot.talent.length
          ? shot.talent
          : Array.isArray(shot?.talentIds)
          ? shot.talentIds
              .map((entry) => {
                if (!entry) return null;
                if (typeof entry === "string") {
                  return { talentId: entry, name: "" };
                }
                if (typeof entry === "object") {
                  const talentId = entry.talentId || entry.id || null;
                  if (!talentId) return null;
                  return { talentId, name: entry.name || "" };
                }
                return null;
              })
              .filter(Boolean)
          : [];

        const talentForWrite = mapTalentForWrite(talentSource);
        const talentIds = talentForWrite.map((entry) => entry.talentId);

        const tagsForWrite = Array.isArray(shot?.tags)
          ? shot.tags
              .filter((tag) => tag && tag.id && tag.label)
              .map((tag) => ({
                id: tag.id,
                label: tag.label,
                color: tag.color || "gray",
              }))
          : [];

        const duplicatePayload = {
          name: duplicateName,
          description: shot?.description || shot?.notes || "",
          notes: shot?.notes || shot?.description || "",
          type: shot?.type || "",
          status: normaliseShotStatus(shot?.status || DEFAULT_SHOT_STATUS),
          date: shot?.date || null,
          locationId: shot?.locationId || null,
          locationName: shot?.locationName || null,
          projectId,
          laneId: typeof shot?.laneId === "string" ? shot.laneId : shot?.laneId ?? null,
          shotNumber:
            typeof shot?.shotNumber === "string" && shot.shotNumber.trim()
              ? shot.shotNumber
              : null,
          products: productsForWrite,
          productIds,
          talent: talentForWrite,
          talentIds,
          tags: tagsForWrite,
          referenceImagePath: shot?.referenceImagePath || null,
          referenceImageCrop: shot?.referenceImageCrop
            ? { ...shot.referenceImageCrop }
            : null,
          thumbPath: shot?.thumbPath || null,
        };

        const newShot = await createShotMutation.mutateAsync(duplicatePayload);
        createdShots.push({ id: newShot.id, name: duplicateName });

        await updateReverseIndexes({
          shotId: newShot.id,
          before: { productIds: [], products: [], talentIds: [], locationId: null },
          after: {
            productIds,
            products: productsForWrite,
            talentIds,
            locationId: duplicatePayload.locationId,
          },
        });
      }

      if (createdShots.length === 1) {
        toast.success({
          title: "Shot duplicated",
          description: `Created "${createdShots[0].name}".`,
        });
        setFocusShotId(createdShots[0].id);
      } else {
        toast.success({
          title: "Shots duplicated",
          description: `Created ${createdShots.length} shots.`,
        });
        const lastCreated = createdShots[createdShots.length - 1];
        setFocusShotId(lastCreated ? lastCreated.id : null);
      }

      setSelectedShotIds(new Set());
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to duplicate shots.");
      console.error("[Shots] Failed to duplicate shots", {
        error,
        shotCount: selectedShots.length,
        shotIds: selectedShots.map((s) => s.id).slice(0, 10),
      });
      toast.error({ title: "Failed to duplicate shots", description: `${code}: ${message}` });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [
    canEditShots,
    selectedShots,
    projectId,
    isProcessingBulk,
    sortedShots,
    createShotMutation,
    setSelectedShotIds,
    setFocusShotId,
  ]);

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
      setFocusShotId(null);
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
  const isGalleryView = viewMode === "gallery";
  const isTableView = viewMode === "table";
  const talentNoOptionsMessage =
    talentLoadError || (talentOptions.length ? "No matching talent" : "No talent available");
  const showArchived = Boolean(filters.showArchived);
  const resolvedDensity = normaliseShotDensity(viewPrefs.density);
  // Dramatic density differences: 25-50% between levels
  const galleryItemHeight =
    resolvedDensity === "compact" ? 200 :    // compact cards are tighter
    400;                                      // comfy baseline

  const handleDensityChange = useCallback((nextDensity) => {
    setViewPrefs((prev) => ({ ...prev, density: normaliseShotDensity(nextDensity) }));
  }, []);

  const productNoOptionsMessage = productFilterOptions.length
    ? "No matching products"
    : "No products available";
  const tagNoOptionsMessage = tagFilterOptions.length
    ? "No matching tags"
    : "No tags available";

  return (
    <div>
      <OverviewToolbar filterPills={activeFilters} onRemoveFilter={removeFilter}>
        <OverviewToolbarRow>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showArchived}
                onChange={(e) => handleShowArchivedChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:focus:ring-primary-light"
              />
              <span>Show Archived</span>
            </label>
            <SortMenu
              options={SHOT_SORT_OPTIONS}
              value={viewPrefs.sort}
              onChange={selectSort}
              title="Sort shots"
            />
            <FieldVisibilityMenu
              options={DETAIL_TOGGLE_OPTIONS.map((option) => ({
                key: option.key,
                label: option.label,
                checked: Boolean(viewPrefs[option.key]),
              }))}
              onToggle={toggleViewPref}
            />
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={isSearchExpanded ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setIsSearchExpanded(true)}
                aria-label="Search shots"
                aria-expanded={isSearchExpanded}
              >
                <Search className="h-4 w-4" />
              </Button>
              <div
                className={`relative flex items-center overflow-hidden transition-all duration-200 ${
                  isSearchExpanded ? "w-48 opacity-100 sm:w-56" : "pointer-events-none w-0 opacity-0"
                }`}
              >
                <Input
                  ref={searchInputRef}
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Type to search..."
                  aria-label="Search shots"
                  className="h-9 w-full border-slate-200 bg-white pr-8 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-2 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ViewModeMenu
              options={SHOT_VIEW_OPTIONS}
              value={viewMode}
              onChange={updateViewMode}
              ariaLabel="Select view"
            />
            <DensityMenu
              options={SHOT_DENSITY_OPTIONS}
              value={viewPrefs.density}
              onChange={handleDensityChange}
              ariaLabel="Select density"
            />
            {canEditShots && sortedShots.length > 0 && (
              <Button
                type="button"
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={handleSelectionModeToggle}
                aria-pressed={selectionMode}
                className="flex items-center gap-1.5"
              >
                {selectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                <span>
                  {selectionMode
                    ? selectedShotIds.size > 0
                      ? `Done (${selectedShotIds.size})`
                      : "Exit selection"
                    : "Select"}
                </span>
              </Button>
            )}
            <ExportButton data={filteredShots} entityType="shots" />
            {canEditShots && (
              <Button type="button" onClick={openCreateModal} className="flex items-center gap-2">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Create shot</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
        </OverviewToolbarRow>
      </OverviewToolbar>

      {/* Bulk Tagging Toolbar - appears when shots are selected */}
      {canEditShots && selectionMode && (
        <BulkOperationsToolbar
          selectedCount={selectedShotIds.size}
          onClearSelection={clearSelection}
          onExitSelection={exitSelectionMode}
          onSelectAll={toggleSelectAll}
          totalCount={sortedShots.length}
          isSticky={true}
          topOffset={314}
          // Tag operations
          onApplyTags={handleBulkApplyTags}
          onRemoveTags={handleBulkRemoveTags}
          availableTags={tagFilterOptions.map((opt) => ({
            id: opt.value,
            label: opt.label,
            color: opt.color || "blue",
          }))}
          onDuplicateShots={handleBulkDuplicateShots}
          // Property operations
          onSetLocation={handleBulkSetLocation}
          onSetDate={handleBulkSetDate}
          onSetType={handleBulkSetType}
          availableLocations={locations}
          availableTypes={AVAILABLE_SHOT_TYPES}
          // Lane operations
          onSetLane={handleBulkSetLane}
          availableLanes={lanes}
          // Project operations
          onMoveToProject={handleBulkMoveToProject}
          onCopyToProject={handleBulkCopyToProject}
          availableProjects={projects}
          currentProjectId={projectId}
          // State
          isProcessing={isProcessingBulk}
        />
      )}

      <div className="mx-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Build and manage the shot list for the active project. Set the active project from the Dashboard.
          </p>
          {!canEditShots && (
            <div className="rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
              You can browse shots but need producer or crew access to create or edit them.
            </div>
          )}
          <div className="space-y-4">
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
                <div className="rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
                  No shots match the current search or filters.
                </div>
              )
            ) : isGalleryView ? (
              <VirtualizedGrid
                items={sortedShots}
                itemHeight={galleryItemHeight}
                threshold={80}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
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
                        onToggleSelect={selectionMode && canEditShots ? toggleShotSelection : null}
                        isFocused={focusShotId === shot.id}
                        onFocus={() => handleFocusShot(shot)}
                      />
                    </div>
                  );
                }}
              />
            ) : (
              <ShotTableView
                rows={tableRows}
                viewPrefs={viewPrefs}
                density={SHOT_DENSITY_CONFIG[resolvedDensity]}
                canEditShots={canEditShots}
                selectedShotIds={selectedShotIds}
                onToggleSelect={selectionMode && canEditShots ? toggleShotSelection : null}
                onEditShot={canEditShots ? handleEditShot : null}
                focusedShotId={focusShotId}
                onFocusShot={handleFocusShot}
              />
            )}
          </div>
      </div>

      {canEditShots && isCreateModalOpen && (
        <ShotEditModal
          open
          titleId="create-shot-modal-title"
          heading="Create shot"
          shotName={createDraft.name || "New shot"}
          draft={createDraft}
          onChange={handleCreateDraftChange}
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
            setCreateAutoStatus(createInitialSectionStatuses());
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
          autoSaveStatus={createAutoStatus}
        />
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
          autoSaveStatus={editAutoStatus}
        />
      )}
    </div>
  );
}


function selectShotImage(shot, products = []) {
  // Priority 1: Primary attachment from new multi-image system
  if (shot?.attachments && Array.isArray(shot.attachments) && shot.attachments.length > 0) {
    const primary = shot.attachments.find((att) => att.isPrimary) || shot.attachments[0];
    if (primary?.path) return primary.path;
  }

  // Priority 2: Legacy reference/storyboard image
  if (shot?.referenceImagePath) {
    return shot.referenceImagePath;
  }

  // Priority 3: Product images (fallback)
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
  isFocused = false,
  onFocus = null,
}) {
  const imagePath = useMemo(() => selectShotImage(shot, products), [shot, products]);
  const imagePosition = useMemo(() => {
    // Only apply crop position if the image is the reference image
    if (imagePath === shot?.referenceImagePath && shot?.referenceImageCrop) {
      return `${shot.referenceImageCrop.x}% ${shot.referenceImageCrop.y}%`;
    }
    return undefined;
  }, [imagePath, shot]);
  const formattedDate = toDateInputValue(shot.date);
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
    showStatus = true,
    showImage = true,
    showName = true,
    showType = true,
    showDate = true,
  } = viewPrefs || defaultViewPrefs;
  const tags = Array.isArray(shot.tags) ? shot.tags : [];
  const focusClasses = isFocused
    ? "ring-2 ring-primary shadow-md"
    : isSelected
    ? "ring-2 ring-primary/60"
    : "";

  const density = normaliseShotDensity(viewPrefs?.density);
  const imageHeightClass = 'h-44 sm:h-48';

  // Status label + color
  const statusValue = normaliseShotStatus(shot?.status);
  const statusLabel =
    statusValue === 'in_progress' ? 'In progress' :
    statusValue === 'on_hold' ? 'On hold' :
    statusValue === 'complete' ? 'Complete' : 'To do';
  const statusColor =
    statusValue === 'in_progress' ? 'text-blue-600' :
    statusValue === 'on_hold' ? 'text-amber-600' :
    statusValue === 'complete' ? 'text-emerald-600' : 'text-slate-500';

  // Helpers to render compact bullets
  const productBullets = Array.isArray(products)
    ? products
        .filter(Boolean)
        .map((p) => [p.familyName, p.colourName].filter(Boolean).join(' – '))
        .filter(Boolean)
    : [];
  const talentBullets = Array.isArray(talent)
    ? talent.filter(Boolean).map((t) => t.name).filter(Boolean)
    : [];

  const CompactCard = () => (
    <div className="px-3 py-2">
      <div className="flex items-start gap-3">
        {showImage && (
          <div className="relative flex-shrink-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
              {imagePath ? (
                <AppImage
                  src={imagePath}
                  alt={`${shot.name || 'Shot'} preview`}
                  preferredSize={160}
                  className="h-full w-full"
                  imageClassName="h-full w-full object-cover"
                  position={imagePosition}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">No image</div>
              )}
            </div>
            {onToggleSelect && (
              <div className="absolute -left-2 -top-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(shot.id)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${shot?.name || 'shot'}`}
                />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {showName && (
              <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-5 line-clamp-2" title={shot.name}>
                {shot.name}
              </h3>
            )}
            {canEditShots && (
              <div className="flex items-center gap-1">
                {showStatus && (
                  <span className={`inline-flex items-center gap-1 text-[11px] ${statusColor}`} title={`Status: ${statusLabel}`}>
                    <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">{statusLabel}</span>
                  </span>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                  Edit
                </Button>
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {showDate && formattedDate && (
              <span className="inline-flex items-center gap-1" title={formattedDate}>
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
            )}
            {showType && shot.type && (
              <span className="inline-flex items-center gap-1" title={shot.type}>
                <Shapes className="h-3.5 w-3.5" />
                {shot.type}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="mt-1">
              <TagList tags={tags} emptyMessage={null} />
            </div>
          )}
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {showTalent && (
              <div className="min-w-0 flex items-start gap-1" title={talentBullets.join(', ')}>
                <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                {talentBullets.length > 0 ? (
                  <p className="min-w-0 truncate">{talentBullets.slice(0, 3).join(' • ')}{talentBullets.length > 3 ? ' +' + (talentBullets.length - 3) : ''}</p>
                ) : (
                  <span className="text-slate-400">No talent</span>
                )}
              </div>
            )}
            {showLocation && (
              <div className="min-w-0 flex items-start gap-1" title={locationName}>
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                <p className="min-w-0 truncate">{locationName || 'Unassigned'}</p>
              </div>
            )}
          </div>
          {showProducts && (
            <div className="mt-1 text-[11px] text-slate-600">
              <div className="flex items-start gap-1" title={productBullets.join(', ')}>
                <Package className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                {productBullets.length > 0 ? (
                  <p className="min-w-0 truncate">{productBullets.slice(0, 3).join(' • ')}{productBullets.length > 3 ? ' +' + (productBullets.length - 3) : ''}</p>
                ) : (
                  <span className="text-slate-400">No products</span>
                )}
              </div>
            </div>
          )}
          {showNotes && (
            notesHtml ? (
              <div
                className="mt-1 text-[11px] text-slate-600 prose prose-xs dark:prose-invert max-w-none line-clamp-2"
                dangerouslySetInnerHTML={{ __html: notesHtml }}
              />
            ) : (
              <p className="mt-1 text-[11px] text-slate-400 inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> No notes</p>
            )
          )}
        </div>
      </div>
    </div>
  );

  const ComfyCard = () => (
    <>
      {showImage && (
        <div className={`relative ${imageHeightClass} bg-slate-100`}>
          <AppImage
            src={imagePath}
            alt={`${shot.name} preview`}
            preferredSize={640}
            className="h-full w-full"
            imageClassName="h-full w-full object-cover"
            position={imagePosition}
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
      )}
      <CardContent className="space-y-1.5 px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          {showName && (
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-base line-clamp-2" title={shot.name}>
              {shot.name}
            </h3>
          )}
          {showType && shot.type && (
            <span className="text-[10px] uppercase tracking-wide text-primary">{shot.type}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          {showDate && formattedDate && <span>{formattedDate}</span>}
          {showLocation && locationName && <span title={locationName}>{locationName}</span>}
          {showStatus && (
            <span className={`inline-flex items-center gap-1 ${statusColor}`} title={`Status: ${statusLabel}`}>
              <CircleDot className="h-3.5 w-3.5" />
              <span className="sr-only">{statusLabel}</span>
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div>
            <TagList tags={tags} emptyMessage={null} />
          </div>
        )}
        {showNotes && (
          notesHtml ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none line-clamp-3"
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
    </>
  );

  return (
    <Card className={`overflow-hidden border shadow-sm transition ${focusClasses}`} onClick={() => onFocus?.(shot)}>
      {density === 'compact' ? <CompactCard /> : <ComfyCard />}
    </Card>
  );
});

const OVERVIEW_TAB_STORAGE_KEY = "shots:overviewTab";

const normaliseOverviewTab = (value) => {
  if (value === "planner") return "planner";
  if (value === "assets") return "assets";
  return "shots";
};

const overviewTabs = [
  { value: "shots", label: "Builder", icon: Camera },
  { value: "planner", label: "Planner", icon: Calendar },
  { value: "assets", label: "Assets", icon: Users },
];

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export default function ShotsPage({ initialView = null }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setLastVisitedPath } = useProjectScope();
  const queryTab = searchParams.get("view");
  const normalisedPropTab = initialView ? normaliseOverviewTab(initialView) : null;
  const normalisedQueryTab = queryTab ? normaliseOverviewTab(queryTab) : null;
  const [activeTab, setActiveTab] = useState(() => {
    if (normalisedPropTab) return normalisedPropTab;
    if (normalisedQueryTab) return normalisedQueryTab;
    const stored = readStorage(OVERVIEW_TAB_STORAGE_KEY);
    return stored ? normaliseOverviewTab(stored) : "shots";
  });
  const [sharedFilters, setSharedFiltersState] = useState(() => readStoredShotFilters());
  const [sharedSelectedShotIds, setSharedSelectedShotIdsState] = useState(() => new Set());
  const [focusShotId, setFocusShotIdState] = useState(null);

  const updateSharedFilters = useCallback((updater) => {
    setSharedFiltersState((prev) => {
      const resolved = typeof updater === "function" ? updater(prev) : updater;
      const base = resolved && typeof resolved === "object" ? resolved : defaultOverviewFilters;
      const next = { ...defaultOverviewFilters, ...base };
      return shallowEqual(next, prev) ? prev : next;
    });
  }, []);

  const updateSharedSelectedShotIds = useCallback((updater) => {
    setSharedSelectedShotIdsState((prev) => {
      const resolved = typeof updater === "function" ? updater(prev) : updater;
      let nextSet;
      if (resolved instanceof Set) {
        nextSet = resolved === prev ? new Set(resolved) : new Set(resolved);
      } else if (Array.isArray(resolved)) {
        nextSet = new Set(resolved);
      } else if (!resolved) {
        nextSet = new Set();
      } else {
        nextSet = new Set(resolved);
      }

      if (nextSet.size === prev.size) {
        let identical = true;
        for (const id of nextSet) {
          if (!prev.has(id)) {
            identical = false;
            break;
          }
        }
        if (identical) {
          return prev;
        }
      }

      return nextSet;
    });
  }, []);

  const setFocusShotId = useCallback((value) => {
    setFocusShotIdState(value ?? null);
  }, []);

  const overviewValue = useMemo(
    () => ({
      filters: sharedFilters,
      setFilters: updateSharedFilters,
      selectedShotIds: sharedSelectedShotIds,
      setSelectedShotIds: updateSharedSelectedShotIds,
      focusShotId,
      setFocusShotId,
    }),
    [sharedFilters, updateSharedFilters, sharedSelectedShotIds, updateSharedSelectedShotIds, focusShotId, setFocusShotId]
  );

  useEffect(() => {
    if (normalisedPropTab && normalisedPropTab !== activeTab) {
      setActiveTab(normalisedPropTab);
      return;
    }
    if (normalisedQueryTab && normalisedQueryTab !== activeTab) {
      setActiveTab(normalisedQueryTab);
    }
  }, [normalisedPropTab, normalisedQueryTab, activeTab]);

  useEffect(() => {
    writeStorage(OVERVIEW_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (nextTab) => {
      const resolved = normaliseOverviewTab(nextTab);
      setActiveTab(resolved);
      writeStorage(OVERVIEW_TAB_STORAGE_KEY, resolved);
      const existing = new URLSearchParams(location.search);
      if (resolved === "shots") {
        existing.delete("view");
      } else {
        existing.set("view", resolved);
      }
      setSearchParams(existing, { replace: true });
    },
    [location.search, setSearchParams]
  );

  // Remember last visited path including tab
  useEffect(() => {
    if (activeTab === "planner") {
      setLastVisitedPath("/shots?view=planner");
    } else if (activeTab === "assets") {
      setLastVisitedPath("/shots?view=assets");
    } else {
      setLastVisitedPath("/shots");
    }
  }, [activeTab, setLastVisitedPath]);

  const activeContent = useMemo(() => {
    if (activeTab === "planner") {
      return (
        <Suspense
          fallback={
            <div className="flex min-h-[240px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <PlannerPage embedded />
        </Suspense>
      );
    }
    if (activeTab === "assets") {
      return <ShotsAssetsTab />;
    }
    return <ShotsWorkspace />;
  }, [activeTab]);

  const activeLabel = activeTab === "planner" ? "Planner" : activeTab === "assets" ? "Assets" : "Builder";

  return (
    <ShotsOverviewProvider value={overviewValue}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <PageHeader sticky={true} className="top-28 z-[39]" data-shot-overview-header>
          <PageHeader.Content>
            <div>
              <PageHeader.Title>Shots</PageHeader.Title>
              <PageHeader.Description>
                Create, plan, and review shots without leaving the page.
              </PageHeader.Description>
            </div>
            <PageHeader.Actions>
              <div
                className="flex items-center space-x-1 rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800"
                role="tablist"
                aria-label="Shot overview tabs"
                aria-orientation="horizontal"
              >
                {overviewTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.value === activeTab;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                      }`}
                      onClick={() => handleTabChange(tab.value)}
                      role="tab"
                      id={`overview-tab-${tab.value}`}
                      aria-controls={`overview-panel-${tab.value}`}
                      aria-selected={isActive}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </PageHeader.Actions>
          </PageHeader.Content>
          <div className="pb-3" id="shots-toolbar-anchor" />
        </PageHeader>
      <div
        className="flex-1"
        id={`overview-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`overview-tab-${activeTab}`}
        aria-label={`${activeLabel} workspace`}
      >
        {activeContent}
      </div>
      </div>
    </ShotsOverviewProvider>
  );
}
