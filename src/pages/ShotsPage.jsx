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
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
} from "../lib/demoSafeFirestore";
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
  ChevronRight,
  Camera,
  Calendar,
  Users,
  X,
  CheckSquare,
  Plus,
  Table,
  Shapes,
  CircleDot,
  Package,
  Check,
  MoreVertical,
  BarChart3,
  Layers,
  FileText,
  MapPin,
  Copy,
  FolderInput,
  FolderOutput,
  Archive,
  Trash2,
  Pencil,
  ChevronsDownUp,
  ChevronsUpDown,
  FileDown,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { shotStatusOptions } from "../lib/shotStatus";
import ExportButton from "../components/common/ExportButton";
import ProjectPickerModal from "../components/common/ProjectPickerModal";
import { searchShots } from "../lib/search";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ShotsOverviewProvider, useShotsOverview } from "../context/ShotsOverviewContext";
import {
  FieldSettingsMenu,
  OverviewToolbar,
  OverviewToolbarRow,
  SortMenu,
  ToolbarIconButton,
  ViewModeMenu,
  DensityMenu,
  GroupByMenu,
  FilterMenu,
} from "../components/overview";

const PlannerPage = lazy(() => import("./PlannerPage"));
const CallSheetEmbed = lazy(() => import("../components/callsheet/CallSheetEmbed"));
const PlannerExportModal = lazy(() => import("../components/planner/PlannerExportModal"));

// Import export normalization helpers from PlannerPage
import {
  groupShotsByLane,
  buildPlannerExportLanes,
} from "./PlannerPage";
import { VirtualizedGrid } from "../components/ui/VirtualizedList";
import { ButtonGroup } from "../components/ui/ButtonGroup";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import TalentMultiSelect from "../components/shots/TalentMultiSelect";
import NotesEditor from "../components/shots/NotesEditor";
import ShotEditModal from "../components/shots/ShotEditModal";
import BulkOperationsToolbar from "../components/shots/BulkOperationsToolbar";
import ShotTableView from "../components/shots/ShotTableView";
import BuilderGroupedView from "../components/shots/BuilderGroupedView";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";
import { useProjectScope } from "../context/ProjectScopeContext";
import { canEditProducts, canManageShots, resolveEffectiveRole } from "../lib/rbac";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast, showConfirm } from "../lib/toast";
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
import { InsightsSidebar } from "../components/insights";
import { calculateTalentTotals, calculateGroupedShotTotals } from "../lib/insightsCalculator";

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
const SHOTS_MANUAL_ORDER_PREFIX = "shots:manualOrder:"; // per-project
const SHOTS_INSIGHTS_STORAGE_KEY = "shots:insightsSidebarOpen";
const SHOTS_GROUP_BY_STORAGE_KEY = "shots:groupBy";

const SHOT_GROUP_OPTIONS = [
  { value: "none", label: "No grouping", icon: null },
  { value: "date", label: "By Date", icon: Calendar },
  { value: "talent", label: "By Talent", icon: Users },
  { value: "status", label: "By Status", icon: CircleDot },
];

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
  showTags: true,
  showStatus: true,
  showImage: true,
  showName: true,
  showType: true,
  showDate: true,
  // Sorting + density
  sort: "alpha",
  density: DEFAULT_SHOT_DENSITY,
  // Field settings
  fieldOrder: [],
  lockedFields: [],
};

const normaliseShotRecord = (id, data, fallbackProjectId) =>
  normaliseShot({ id, ...data }, { fallbackProjectId }) || { id, ...data };

const AUTOSAVE_DELAY_MS = 1200;

const DETAIL_TOGGLE_OPTIONS = [
  { key: "showStatus", label: "Status" },
  { key: "showImage", label: "Image" },
  { key: "showName", label: "Shot Name" },
  { key: "showType", label: "Description" },
  { key: "showDate", label: "Date" },
  { key: "showNotes", label: "Notes" },
  { key: "showTags", label: "Tags" },
  { key: "showProducts", label: "Products" },
  { key: "showTalent", label: "Talent" },
  { key: "showLocation", label: "Location" },
];

// Mapping from viewPref boolean keys -> column keys used by the table
const PREF_TO_COLUMN_KEY = new Map([
  ["showImage", "image"],
  ["showName", "name"],
  ["showType", "type"],
  ["showStatus", "status"],
  ["showDate", "date"],
  ["showLocation", "location"],
  ["showProducts", "products"],
  ["showTalent", "talent"],
  ["showNotes", "notes"],
  ["showTags", "tags"],
]);

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
    // Normalise field order (columns)
    const defaultOrder = Array.from(PREF_TO_COLUMN_KEY.values());
    const rawOrder = Array.isArray(parsed.fieldOrder) ? parsed.fieldOrder : [];
    const baseOrder = rawOrder.filter((k) => defaultOrder.includes(k));
    const fieldOrder = [...baseOrder, ...defaultOrder.filter((k) => !baseOrder.includes(k))];
    // Normalise locked fields
    const lockedFields = Array.isArray(parsed.lockedFields)
      ? parsed.lockedFields.filter((k) => defaultOrder.includes(k))
      : [];

    return {
      showProducts: parsed.showProducts !== false,
      showTalent: parsed.showTalent !== false,
      showLocation: parsed.showLocation !== false,
      showNotes: parsed.showNotes !== false,
      showTags: parsed.showTags !== false,
      showStatus: parsed.showStatus !== false,
      showImage: parsed.showImage !== false,
      showName: parsed.showName !== false,
      showType: parsed.showType !== false,
      showDate: parsed.showDate !== false,
      sort: typeof parsed.sort === "string" ? parsed.sort : defaultViewPrefs.sort,
      density: normaliseShotDensity(parsed.density),
      fieldOrder,
      lockedFields,
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
  // Project picker modal state: { type: 'copy' | 'move', shot: Object } | null
  const [projectPickerAction, setProjectPickerAction] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [insightsSidebarOpen, setInsightsSidebarOpen] = useState(() => {
    const stored = readStorage(SHOTS_INSIGHTS_STORAGE_KEY);
    return stored === "true" || stored === true;
  });
  const [groupBy, setGroupBy] = useState(() => {
    const stored = readStorage(SHOTS_GROUP_BY_STORAGE_KEY);
    if (stored === "date" || stored === "talent" || stored === "status") return stored;
    return "none";
  });
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(["all"]));
  // Global collapse/expand state for gallery card sections
  const [gallerySectionsExpanded, setGallerySectionsExpanded] = useState(true);
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
  const { projectId: urlProjectId } = useParams();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  // Use URL param as primary source of truth (available immediately on navigation)
  // Fall back to context for cases where URL param isn't available
  const projectId = urlProjectId || currentProjectId;
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

  // Get current project for shoot dates (used in FilterMenu)
  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
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
    const selectedStatuses = new Set(filters.statusFilter || []);

    // Apply non-text filters first
    const preFiltered = shots.filter((shot) => {
      if (!filters.showArchived && shot.deleted) {
        return false;
      }

      // Status filter - if any statuses selected, shot must match one
      if (selectedStatuses.size > 0) {
        const shotStatus = shot.status || "todo";
        if (!selectedStatuses.has(shotStatus)) {
          return false;
        }
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

  // Insights calculations for sidebar
  const talentLookupByName = useMemo(() => {
    const lookup = {};
    talentOptions.forEach((entry) => {
      if (entry.name) {
        lookup[entry.name] = {
          id: entry.talentId,
          headshotPath: entry.headshotPath,
        };
      }
    });
    return lookup;
  }, [talentOptions]);

  const insightsTalentTotals = useMemo(
    () => calculateTalentTotals(filteredShots, talentLookupByName),
    [filteredShots, talentLookupByName]
  );

  // Transform shots into lanes-with-shots format for PDF export
  // Use PlannerPage's normalization to convert talent/products to strings and resolve images
  const lanesForExport = useMemo(() => {
    // Group shots by laneId using PlannerPage's helper
    const shotsByLane = groupShotsByLane(filteredShots);
    // Build export data with proper normalization (talent names, product labels, images)
    return buildPlannerExportLanes(shotsByLane, lanes, null);
  }, [filteredShots, lanes]);

  const toggleInsightsSidebar = useCallback(() => {
    setInsightsSidebarOpen((prev) => !prev);
  }, []);

  // Grouped shots calculation for accordion view
  const groupedShots = useMemo(
    () => calculateGroupedShotTotals(sortedShots, groupBy),
    [sortedShots, groupBy]
  );

  const toggleGroupExpanded = useCallback((groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        // Accordion: collapse all others, expand this one
        next.clear();
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleGroupByChange = useCallback((value) => {
    setGroupBy(value);
    // Reset expanded groups when changing groupBy
    if (value === "none") {
      setExpandedGroups(new Set(["all"]));
    } else {
      // Expand the first group by default
      setExpandedGroups(new Set());
    }
  }, []);

  // Manual table order per project (persisted locally)
  const manualOrderKey = useMemo(
    () => `${SHOTS_MANUAL_ORDER_PREFIX}${projectId || 'unknown'}`,
    [projectId]
  );
  const [manualOrder, setManualOrder] = useState(() => {
    try {
      const raw = readStorage(manualOrderKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'string' && id)
        : [];
    } catch {
      return [];
    }
  });
  // Reload manual order when project changes
  useEffect(() => {
    try {
      const raw = readStorage(manualOrderKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const reloaded = Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'string' && id)
        : [];
      setManualOrder(reloaded);
    } catch {
      setManualOrder([]);
    }
  }, [manualOrderKey]);
  useEffect(() => {
    try {
      writeStorage(manualOrderKey, JSON.stringify(manualOrder));
    } catch {}
  }, [manualOrderKey, manualOrder]);
  const lastManualRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (e) => {
      const isUndo = (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z');
      if (!isUndo) return;
      const prev = lastManualRef.current;
      if (!prev) return;
      e.preventDefault();
      setManualOrder(prev);
      lastManualRef.current = null;
      toast.success('Reorder undone');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Overlay manual order in table view
  const tableOrderedShots = useMemo(() => {
    if (!Array.isArray(sortedShots) || sortedShots.length === 0) return [];
    if (!Array.isArray(manualOrder) || manualOrder.length === 0) return sortedShots;
    const indexMap = new Map(manualOrder.map((id, i) => [id, i]));
    return [...sortedShots].sort((a, b) => {
      const ai = indexMap.has(a.id) ? indexMap.get(a.id) : Number.POSITIVE_INFINITY;
      const bi = indexMap.has(b.id) ? indexMap.get(b.id) : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return 0;
    });
  }, [sortedShots, manualOrder]);

  useEffect(() => {
    if (viewMode === "gallery" || viewMode === "table") {
      writeStorage(SHOTS_VIEW_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    writeStorage(SHOTS_INSIGHTS_STORAGE_KEY, insightsSidebarOpen ? "true" : "false");
  }, [insightsSidebarOpen]);

  useEffect(() => {
    writeStorage(SHOTS_GROUP_BY_STORAGE_KEY, groupBy);
  }, [groupBy]);

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
        showTags: viewPrefs.showTags,
        sort: viewPrefs.sort,
        density: normaliseShotDensity(viewPrefs.density),
        fieldOrder: Array.isArray(viewPrefs.fieldOrder)
          ? viewPrefs.fieldOrder
          : Array.from(PREF_TO_COLUMN_KEY.values()),
        lockedFields: Array.isArray(viewPrefs.lockedFields) ? viewPrefs.lockedFields : [],
      })
    );
  }, [viewPrefs]);

  const familyDetailCacheRef = useRef(new Map());
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

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

  const toggleFieldLock = useCallback((columnKey) => {
    setViewPrefs((prev) => {
      const locked = new Set(Array.isArray(prev.lockedFields) ? prev.lockedFields : []);
      if (locked.has(columnKey)) locked.delete(columnKey);
      else locked.add(columnKey);
      // If locking a field, ensure it's visible by turning on its pref key
      const prefKey = [...PREF_TO_COLUMN_KEY.entries()].find(([, v]) => v === columnKey)?.[0];
      const next = { ...prev, lockedFields: Array.from(locked) };
      if (prefKey && locked.has(columnKey)) next[prefKey] = true;
      return next;
    });
  }, []);

  const reorderFields = useCallback((nextOrder) => {
    setViewPrefs((prev) => ({ ...prev, fieldOrder: Array.isArray(nextOrder) ? nextOrder : prev.fieldOrder }));
  }, []);

  // Show All / Hide All field visibility handlers
  const handleShowAllFields = useCallback(() => {
    setViewPrefs((prev) => {
      const updates = {};
      for (const { key } of DETAIL_TOGGLE_OPTIONS) {
        updates[key] = true;
      }
      return { ...prev, ...updates };
    });
  }, []);

  const handleHideAllFields = useCallback(() => {
    setViewPrefs((prev) => {
      const locked = new Set(prev.lockedFields || []);
      const updates = {};
      for (const { key } of DETAIL_TOGGLE_OPTIONS) {
        const columnKey = PREF_TO_COLUMN_KEY.get(key) || key;
        // Keep locked fields visible
        if (!locked.has(columnKey)) {
          updates[key] = false;
        }
      }
      return { ...prev, ...updates };
    });
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
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (queryText) {
          setQueryText("");
        }
        setIsSearchOpen(false);
      }
    },
    [queryText]
  );

  useEffect(() => {
    if (!isSearchOpen) return undefined;

    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSearchOpen]);

  // Clear focus outline when pressing Escape or clicking outside shot cards
  useEffect(() => {
    if (!focusShotId) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        // Don't clear if a modal or dropdown is open
        const activeElement = document.activeElement;
        const isInModal = activeElement?.closest('[role="dialog"]');
        const isInDropdown = activeElement?.closest('[role="menu"]');
        if (!isInModal && !isInDropdown) {
          setFocusShotId(null);
        }
      }
    };

    const handleClickOutside = (event) => {
      // Check if click is on a shot card or inside a modal/dropdown
      const isOnShotCard = event.target.closest('[data-shot-card]');
      const isInModal = event.target.closest('[role="dialog"]');
      const isInDropdown = event.target.closest('[role="menu"]');
      const isOnToolbar = event.target.closest('[role="toolbar"]');

      if (!isOnShotCard && !isInModal && !isInDropdown && !isOnToolbar) {
        setFocusShotId(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [focusShotId, setFocusShotId]);

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

  // Single shot duplicate handler (used by 3-dot menu)
  const handleDuplicateSingleShot = useCallback(
    async (shot) => {
      if (!canEditShots || !shot) return;
      // Temporarily select only this shot and call the bulk handler
      setSelectedShotIds(new Set([shot.id]));
      // Use a slight delay to ensure state updates
      setTimeout(() => {
        // The bulk handler will be called with the selected shot
        // We need to trigger it manually
      }, 0);
      // For now, show feedback - full integration coming soon
      toast.info({
        title: "Duplicating shot...",
        description: "Select the shot and use bulk actions for now.",
      });
    },
    [canEditShots]
  );

  // Single shot copy to project handler - opens project picker
  const handleCopyToProjectSingleShot = useCallback(
    (shot) => {
      if (!canEditShots || !shot) return;
      setProjectPickerAction({ type: "copy", shot });
    },
    [canEditShots]
  );

  // Single shot move to project handler - opens project picker
  const handleMoveToProjectSingleShot = useCallback(
    (shot) => {
      if (!canEditShots || !shot) return;
      setProjectPickerAction({ type: "move", shot });
    },
    [canEditShots]
  );

  // Handle project selection from picker modal
  const handleProjectPickerSelect = useCallback(
    async (targetProjectId) => {
      if (!projectPickerAction || !targetProjectId) return;

      const { type, shot } = projectPickerAction;
      const targetProject = projects.find((p) => p.id === targetProjectId);
      const projectName = targetProject?.name || "selected project";

      if (type === "copy") {
        // Copy single shot to target project
        const confirmed = await showConfirm(
          `Copy "${shot.name}" to "${projectName}"?`
        );
        if (!confirmed) {
          setProjectPickerAction(null);
          return;
        }

        setCopyingProject(true);
        try {
          const targetShotsPath = ["clients", clientId, "shots"];
          const { id: _ignoreId, ...shotData } = shot;
          await addDoc(collection(db, ...targetShotsPath), {
            ...shotData,
            projectId: targetProjectId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success({
            title: "Shot copied",
            description: `"${shot.name}" has been copied to "${projectName}".`,
          });
        } catch (error) {
          console.error("[Shots] Failed to copy shot", error);
          toast.error({
            title: "Failed to copy shot",
            description: error.message || "An error occurred.",
          });
        } finally {
          setCopyingProject(false);
          setProjectPickerAction(null);
        }
      } else if (type === "move") {
        // Move single shot to target project
        const confirmed = await showConfirm(
          `Move "${shot.name}" to "${projectName}"? It will no longer appear in the current project.`
        );
        if (!confirmed) {
          setProjectPickerAction(null);
          return;
        }

        setMovingProject(true);
        try {
          const shotRef = doc(db, ...currentShotsPath, shot.id);
          await updateDoc(shotRef, {
            projectId: targetProjectId,
            updatedAt: serverTimestamp(),
          });
          toast.success({
            title: "Shot moved",
            description: `"${shot.name}" has been moved to "${projectName}".`,
          });
        } catch (error) {
          console.error("[Shots] Failed to move shot", error);
          toast.error({
            title: "Failed to move shot",
            description: error.message || "An error occurred.",
          });
        } finally {
          setMovingProject(false);
          setProjectPickerAction(null);
        }
      }
    },
    [projectPickerAction, projects, clientId, db, currentShotsPath, showConfirm]
  );

  // Single shot archive handler - toggles the deleted flag
  const handleArchiveSingleShot = useCallback(
    async (shot) => {
      if (!canEditShots || !shot) return;

      const isArchived = shot.deleted === true;
      const action = isArchived ? "restore" : "archive";
      const shotName = shot.name || "Untitled Shot";

      const confirmed = await showConfirm(
        `${isArchived ? "Restore" : "Archive"} "${shotName}"?\n\n${
          isArchived
            ? "This will restore the shot to your active shots list."
            : "This will move the shot to your archived shots. You can restore it later."
        }`
      );

      if (!confirmed) return;

      try {
        await updateShot(shot, {
          deleted: !isArchived,
          deletedAt: isArchived ? null : new Date().toISOString(),
        });

        toast.success({
          title: `Shot ${action}d`,
          description: `"${shotName}" has been ${action}d.`,
        });
      } catch (error) {
        console.error(`[Shots] Failed to ${action} shot:`, error);
        toast.error({
          title: `Failed to ${action} shot`,
          description: describeFirebaseError(error),
        });
      }
    },
    [canEditShots, updateShot]
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
    resolvedDensity === "compact" ? 260 :    // compact cards are tighter
    340;                                      // comfy baseline with flexible media

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
          <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap">
            {canEditShots && (
              <Button
                type="button"
                size="sm"
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create</span>
              </Button>
            )}

            <div
              ref={searchContainerRef}
              className={`flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition dark:border-slate-700/80 dark:bg-slate-900 ${
                isSearchOpen ? "ring-2 ring-primary/40 dark:ring-primary/50" : ""
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search shots"
                className="h-7 w-7 shrink-0 rounded-full"
              >
                <Search className="h-4 w-4" />
              </Button>
              <div
                className={`flex items-center transition-all duration-200 ${
                  isSearchOpen ? "w-44 sm:w-56 opacity-100" : "w-0 opacity-0 pointer-events-none"
                }`}
              >
                <Input
                  ref={searchInputRef}
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search shots..."
                  aria-label="Search shots"
                  className="h-7 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus:outline-none"
                />
                {queryText ? (
                  <button
                    type="button"
                    onClick={handleSearchClear}
                    className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <ButtonGroup>
                <FilterMenu
                  filters={filters}
                  onFilterChange={setFilters}
                  talentOptions={talentFilterOptions}
                  projectShootDates={currentProject?.shootDates || []}
                />

                <FieldSettingsMenu
                  fields={DETAIL_TOGGLE_OPTIONS.map(({ key, label }) => ({
                    key: PREF_TO_COLUMN_KEY.get(key) || key,
                    label,
                  }))}
                  visibleMap={Object.fromEntries(
                    Array.from(PREF_TO_COLUMN_KEY.entries()).map(([prefKey, colKey]) => [
                      colKey,
                      Boolean(viewPrefs[prefKey]),
                    ])
                  )}
                  lockedKeys={viewPrefs.lockedFields || []}
                  order={Array.isArray(viewPrefs.fieldOrder) && viewPrefs.fieldOrder.length
                    ? viewPrefs.fieldOrder
                    : Array.from(PREF_TO_COLUMN_KEY.values())}
                  onToggleVisible={(columnKey) => {
                    const prefEntry = [...PREF_TO_COLUMN_KEY.entries()].find(([, v]) => v === columnKey);
                    if (!prefEntry) return;
                    const [prefKey] = prefEntry;
                    toggleViewPref(prefKey);
                  }}
                  onToggleLock={toggleFieldLock}
                  onReorder={reorderFields}
                  onShowAll={handleShowAllFields}
                  onHideAll={handleHideAllFields}
                  iconOnly
                />

                <SortMenu
                  options={SHOT_SORT_OPTIONS}
                  value={viewPrefs.sort}
                  onChange={selectSort}
                  title="Sort shots"
                />

                {isGalleryView && (
                  <GroupByMenu
                    options={SHOT_GROUP_OPTIONS}
                    value={groupBy}
                    onChange={handleGroupByChange}
                    title="Group shots"
                  />
                )}
              </ButtonGroup>

              <ButtonGroup>
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

                {/* Bulk collapse/expand for gallery sections */}
                {isGalleryView && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setGallerySectionsExpanded(!gallerySectionsExpanded)}
                    aria-label={gallerySectionsExpanded ? "Collapse all sections" : "Expand all sections"}
                    title={gallerySectionsExpanded ? "Collapse all sections" : "Expand all sections"}
                  >
                    {gallerySectionsExpanded ? (
                      <ChevronsDownUp className="h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </ButtonGroup>

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
                  <span className="hidden sm:inline">
                    {selectionMode
                      ? selectedShotIds.size > 0
                        ? `Done (${selectedShotIds.size})`
                        : "Exit selection"
                      : "Select"}
                  </span>
                </Button>
              )}

              <ExportButton data={filteredShots} entityType="shots" buttonVariant="outline" />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPdfExportOpen(true)}
                className="flex items-center gap-1.5"
                title="Export PDF"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>

              <Button
                type="button"
                variant={insightsSidebarOpen ? "default" : "outline"}
                size="sm"
                onClick={toggleInsightsSidebar}
                aria-pressed={insightsSidebarOpen}
                aria-label={insightsSidebarOpen ? "Hide insights" : "Show insights"}
                className="flex items-center gap-1.5"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Insights</span>
              </Button>
            </div>
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
          topOffset={240}
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

      <div className="flex">
        <div className="min-w-0 flex-1 space-y-4 px-6">
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
              groupBy !== "none" ? (
                <BuilderGroupedView
                  groups={groupedShots}
                  expandedGroups={expandedGroups}
                  onToggleGroup={toggleGroupExpanded}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  renderShot={(shot, index) => {
                    const shotProducts = normaliseShotProducts(shot);
                    const shotTalentSelection = mapShotTalentToSelection(shot);
                    const notesHtml = formatNotesForDisplay(shot.description);
                    const locationName =
                      shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
                    return (
                      <div key={shot.id} className="animate-fade-in opacity-0" style={getStaggerDelay(index)}>
                        <ShotGalleryCard
                          shot={shot}
                          locationName={locationName}
                          products={shotProducts}
                          talent={shotTalentSelection}
                          notesHtml={notesHtml}
                          canEditShots={canEditShots}
                          onEdit={() => handleEditShot(shot)}
                          onDelete={() => removeShot(shot)}
                          onDuplicate={() => handleDuplicateSingleShot(shot)}
                          onCopyToProject={() => handleCopyToProjectSingleShot(shot)}
                          onMoveToProject={() => handleMoveToProjectSingleShot(shot)}
                          onArchive={() => handleArchiveSingleShot(shot)}
                          onChangeStatus={canEditShots ? (shot, value) => updateShot(shot, { status: value }) : null}
                          viewPrefs={viewPrefs}
                          isSelected={selectedShotIds.has(shot.id)}
                          onToggleSelect={selectionMode && canEditShots ? toggleShotSelection : null}
                          isFocused={focusShotId === shot.id}
                          onFocus={() => handleFocusShot(shot)}
                          globalSectionsExpanded={gallerySectionsExpanded}
                        />
                      </div>
                    );
                  }}
                />
              ) : (
                <VirtualizedGrid
                  items={sortedShots}
                  itemHeight={galleryItemHeight}
                  threshold={80}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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
                          onDelete={() => removeShot(shot)}
                          onDuplicate={() => handleDuplicateSingleShot(shot)}
                          onCopyToProject={() => handleCopyToProjectSingleShot(shot)}
                          onMoveToProject={() => handleMoveToProjectSingleShot(shot)}
                          onArchive={() => handleArchiveSingleShot(shot)}
                          onChangeStatus={canEditShots ? (shot, value) => updateShot(shot, { status: value }) : null}
                          viewPrefs={viewPrefs}
                          isSelected={selectedShotIds.has(shot.id)}
                          onToggleSelect={selectionMode && canEditShots ? toggleShotSelection : null}
                          isFocused={focusShotId === shot.id}
                          onFocus={() => handleFocusShot(shot)}
                          globalSectionsExpanded={gallerySectionsExpanded}
                        />
                      </div>
                    );
                  }}
                />
              )
            ) : (
              <ShotTableView
                rows={
                  // Rebuild rows from table-ordered shots to reflect manual order
                  tableOrderedShots.map((shot) => {
                    const products = normaliseShotProducts(shot);
                    const talentSelection = mapShotTalentToSelection(shot);
                    const notesHtml = formatNotesForDisplay(shot.description);
                    const locationName = shot.locationName || locationById.get(shot.locationId || "") || "Unassigned";
                    return { shot, products, talent: talentSelection, notesHtml, locationName };
                  })
                }
                viewPrefs={viewPrefs}
                density={SHOT_DENSITY_CONFIG[resolvedDensity]}
                canEditShots={canEditShots}
                selectedShotIds={selectedShotIds}
                onToggleSelect={selectionMode && canEditShots ? toggleShotSelection : null}
                onEditShot={canEditShots ? handleEditShot : null}
                persistKey={`shots:table:colWidths:${projectId || 'unknown'}`}
                onRowReorder={canEditShots ? (from, to) => {
                  // Move within currently visible table order
                  const visibleIds = tableOrderedShots.map((s) => s.id);
                  const clampedTo = Math.max(0, Math.min(visibleIds.length, to));
                  const nextVisible = visibleIds.slice();
                  const [moved] = nextVisible.splice(from, 1);
                  nextVisible.splice(clampedTo > from ? clampedTo - 1 : clampedTo, 0, moved);
                  const prevManual = manualOrder.slice();
                  lastManualRef.current = prevManual;
                  // Persist only the visible ordering; unknown ids keep their relative order
                  setManualOrder(nextVisible);
                  toast.info('Press Cmd/Ctrl+Z to undo');
                } : null}
                onChangeStatus={canEditShots ? (shot, value) => updateShot(shot, { status: value }) : null}
                focusedShotId={focusShotId}
                onFocusShot={handleFocusShot}
              />
            )}
          </div>
        </div>

        {/* Insights Sidebar */}
        <InsightsSidebar
          isOpen={insightsSidebarOpen}
          onClose={() => setInsightsSidebarOpen(false)}
          isLoading={shotsLoading || talentLoading}
          totalShots={filteredShots.length}
          shotTotalsRows={[
            { id: "all", name: "All Shots", shotCount: filteredShots.length },
          ]}
          talentRows={insightsTalentTotals}
          onTalentClick={(row) => {
            // Filter by talent when clicking a talent row
            if (row.talentId) {
              const currentTalentIds = filters.talentIds || [];
              const isActive = currentTalentIds.includes(row.talentId);
              if (isActive) {
                // Remove talent filter
                setFilters({
                  ...filters,
                  talentIds: currentTalentIds.filter((id) => id !== row.talentId),
                });
              } else {
                // Add talent filter
                setFilters({
                  ...filters,
                  talentIds: [...currentTalentIds, row.talentId],
                });
              }
            }
          }}
          activeTalentIds={filters.talentIds || []}
        />
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

      {/* Project Picker Modal for single-shot copy/move */}
      <ProjectPickerModal
        open={!!projectPickerAction}
        onClose={() => setProjectPickerAction(null)}
        projects={projects}
        currentProjectId={projectId}
        onSelect={handleProjectPickerSelect}
        title={
          projectPickerAction?.type === "copy"
            ? `Copy "${projectPickerAction?.shot?.name || "Shot"}" to Project`
            : `Move "${projectPickerAction?.shot?.name || "Shot"}" to Project`
        }
        description={
          projectPickerAction?.type === "copy"
            ? "Select a project to copy this shot to."
            : "Select a project to move this shot to. It will no longer appear in the current project."
        }
        actionLabel={projectPickerAction?.type === "copy" ? "Copy" : "Move"}
        isLoading={copyingProject || movingProject}
      />

      {/* PDF Export Modal */}
      <Suspense fallback={null}>
        <PlannerExportModal
          open={isPdfExportOpen}
          onClose={() => setIsPdfExportOpen(false)}
          lanes={lanesForExport}
          isLoading={shotsLoading}
          projectName={currentProject?.name || "Shots Export"}
        />
      </Suspense>
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
  onDelete,
  onDuplicate,
  onCopyToProject,
  onMoveToProject,
  onArchive,
  onChangeStatus = null,
  viewPrefs = defaultViewPrefs,
  isSelected = false,
  onToggleSelect = null,
  isFocused = false,
  onFocus = null,
  globalSectionsExpanded = true,
}) {
  // Collapsible sections state - synced with global state
  const [expandedSections, setExpandedSections] = useState({
    products: globalSectionsExpanded,
    talentLocation: globalSectionsExpanded,
    notes: globalSectionsExpanded,
  });

  // Sync local state when global state changes
  useEffect(() => {
    setExpandedSections({
      products: globalSectionsExpanded,
      talentLocation: globalSectionsExpanded,
      notes: globalSectionsExpanded,
    });
  }, [globalSectionsExpanded]);

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

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
    showTags = true,
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

  // Status label + color
  const statusValue = normaliseShotStatus(shot?.status);
  const statusLabel =
    statusValue === "in_progress" ? "In progress" : statusValue === "on_hold" ? "On hold" : statusValue === "complete" ? "Complete" : "To do";
  const statusTone = {
    in_progress: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-700/60",
    on_hold: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700/50",
    complete: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-700/50",
    default: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
  };
  const orderedFields =
    Array.isArray(viewPrefs?.fieldOrder) && viewPrefs.fieldOrder.length
      ? viewPrefs.fieldOrder
      : Array.from(PREF_TO_COLUMN_KEY.values());
  const isCompact = density === "compact";
  const mediaWidth = isCompact ? "w-24" : "w-32 md:w-36";
  const mediaRadius = isCompact ? "rounded-md" : "rounded-lg";
  const cardPadding = isCompact ? "p-3" : "p-4 md:p-5";
  const contentGap = isCompact ? "gap-2" : "gap-3";
  const titleClass = isCompact ? "text-[13px]" : "text-sm md:text-base";

  const metaEntries = orderedFields
    .map((key) => {
      if (key === "date" && showDate && formattedDate) {
        return (
          <span key="date" className="inline-flex items-center gap-1" title={formattedDate}>
            <Calendar className="h-3.5 w-3.5" />
            {formattedDate}
          </span>
        );
      }
      // Location removed from inline meta - now shown in dedicated section below
      return null;
    })
    .filter(Boolean);

  // Collapsible section header component - collapsible in all density modes
  const CollapsibleHeader = ({ label, icon: Icon, section, hasContent }) => {
    if (!hasContent) return null;

    const isExpanded = expandedSections[section];
    const iconSize = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";
    const chevronSize = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleSection(section);
        }}
        className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
      >
        {isExpanded ? (
          <ChevronDown className={`${chevronSize} shrink-0`} />
        ) : (
          <ChevronRight className={`${chevronSize} shrink-0`} />
        )}
        {Icon && <Icon className={`${iconSize} shrink-0`} />}
        <span>{label}</span>
      </button>
    );
  };

  // Check if sections have content
  const hasProducts = products && products.length > 0;
  const hasTalent = talent && talent.length > 0;
  const hasLocation = locationName && locationName !== "Unassigned";
  const hasTalentOrLocation = hasTalent || hasLocation;
  const hasNotes = Boolean(notesHtml);

  // Determine if talent & location section should be shown based on visibility prefs
  const shouldShowTalentLocation = (showTalent || showLocation) && hasTalentOrLocation;

  // Build structured content sections for better vertical space usage
  // All sections are collapsible in both compact and comfy modes
  const productsSection = showProducts && hasProducts && (
    <div key="products" className="space-y-1.5">
      <CollapsibleHeader label="Products" icon={Package} section="products" hasContent={hasProducts} />
      {expandedSections.products && (
        <ShotProductChips products={products} />
      )}
    </div>
  );

  // Combined Talent & Location section - single collapsible for both
  const talentLocationSection = shouldShowTalentLocation && (
    <div key="talentLocation" className="space-y-1.5">
      <CollapsibleHeader label="Talent & Location" icon={Users} section="talentLocation" hasContent={hasTalentOrLocation} />
      {expandedSections.talentLocation && (
        <div className="space-y-2">
          {/* Talent list */}
          {showTalent && hasTalent && (
            <ShotTalentList talent={talent} />
          )}
          {/* Location */}
          {showLocation && hasLocation && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
              <span>{locationName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const notesSection = showNotes && hasNotes && (
    <div key="notes" className="space-y-1.5">
      <CollapsibleHeader label="Notes" icon={FileText} section="notes" hasContent={hasNotes} />
      {expandedSections.notes && (
        <div
          className="prose prose-xs dark:prose-invert max-w-none text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3"
          dangerouslySetInnerHTML={{ __html: notesHtml }}
        />
      )}
    </div>
  );

  const tagsSection = showTags && tags.length > 0 && (
    <div key="tags" className="text-[11px]">
      <TagList tags={tags} emptyMessage={null} />
    </div>
  );

  // Status display - interactive dropdown if editable, static pill otherwise
  // In compact mode, use smaller padding and fit-content width
  const statusPadding = isCompact ? "px-2 py-1" : "px-3 py-1.5";
  const statusIconSize = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";
  const statusElement = showStatus && orderedFields.includes("status") ? (
    canEditShots && onChangeStatus ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`inline-flex w-fit items-center gap-1 rounded-full border ${statusPadding} text-[11px] font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${statusTone[statusValue] || statusTone.default}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Change status: ${statusLabel}`}
          >
            <CircleDot className={statusIconSize} />
            <span>{statusLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[120px]" onClick={(e) => e.stopPropagation()}>
          {shotStatusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChangeStatus(shot, option.value)}
              className="flex items-center gap-2"
            >
              <span className="flex-1">{option.label}</span>
              {option.value === statusValue && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full border ${statusPadding} text-[11px] font-medium ${statusTone[statusValue] || statusTone.default}`}
        title={`Status: ${statusLabel}`}
      >
        <CircleDot className={statusIconSize} />
        <span>{statusLabel}</span>
      </span>
    )
  ) : null;

  return (
    <Card className={`overflow-hidden border shadow-sm transition ${focusClasses} relative group`} data-shot-card onClick={() => onFocus?.(shot)}>
      {/* Card Actions Menu (Top Right Corner) - Visible on hover */}
      {canEditShots && (
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={(e) => e.stopPropagation()}
                aria-label="Shot actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Shot
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.();
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Shot
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyToProject?.();
                }}
              >
                <FolderOutput className="mr-2 h-4 w-4" />
                Copy to Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToProject?.();
                }}
              >
                <FolderInput className="mr-2 h-4 w-4" />
                Move to Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive?.();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Shot
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Shot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Comfy Density: Header (Name + Description + Status) Above Image */}
      {!isCompact && (showName || (showType && shot.type) || statusElement) && (
        <div className={`border-b border-slate-200 dark:border-slate-700 ${cardPadding} space-y-2`}>
          {/* Shot Name */}
          {showName && (
            <h3 className={`${titleClass} font-semibold leading-5 text-slate-900 dark:text-slate-50 line-clamp-2`} title={shot.name}>
              {shot.name}
            </h3>
          )}

          {/* Description/Type */}
          {showType && shot.type && (
            <p className="min-w-0 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2" title={shot.type}>
              {shot.type}
            </p>
          )}

          {/* Status - in comfy mode, below description */}
          {statusElement}
        </div>
      )}

      {/* Comfy Density: Image Section (centered) */}
      {!isCompact && showImage && (
        <div className={`${cardPadding} flex justify-center`}>
          <div
            className={`relative ${mediaWidth} md:w-48 overflow-hidden ${mediaRadius} border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 flex items-center justify-center max-h-80`}
          >
            {imagePath ? (
              <AppImage
                src={imagePath}
                alt={`${shot.name || "Shot"} preview`}
                preferredSize={640}
                className="max-h-full max-w-full"
                imageClassName="max-h-full max-w-full object-contain"
                position={imagePosition}
                fallback={
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No preview</div>
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No preview</div>
            )}
            {onToggleSelect && (
              <div className="absolute left-2 top-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(shot.id)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${shot?.name || "shot"}`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comfy Density: Tags below image, above products */}
      {!isCompact && tagsSection && (
        <div className={`border-b border-slate-200 dark:border-slate-700 ${cardPadding}`}>
          {tagsSection}
        </div>
      )}

      {/* Compact Density: Horizontal Layout (Image + Header Info side by side) */}
      {isCompact && (
        <div className={`flex items-start gap-3 sm:gap-4 ${cardPadding}`}>
          {/* Image (Left ~40%) */}
          {showImage && (
            <div
              className={`relative ${mediaWidth} overflow-hidden ${mediaRadius} border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 flex items-center justify-center self-start max-h-80`}
            >
              {imagePath ? (
                <AppImage
                  src={imagePath}
                  alt={`${shot.name || "Shot"} preview`}
                  preferredSize={640}
                  className="max-h-full max-w-full"
                  imageClassName="max-h-full max-w-full object-contain"
                  position={imagePosition}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No preview</div>
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No preview</div>
              )}
              {onToggleSelect && (
                <div className="absolute left-2 top-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(shot.id)}
                    className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${shot?.name || "shot"}`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Header Info (Right ~60%) */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Shot Name */}
            {showName && (
              <h3 className={`${titleClass} font-semibold leading-5 text-slate-900 dark:text-slate-50 line-clamp-2`} title={shot.name}>
                {shot.name}
              </h3>
            )}

            {/* Description/Type */}
            {showType && shot.type && (
              <p className="min-w-0 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2" title={shot.type}>
                {shot.type}
              </p>
            )}

            {/* Date */}
            {metaEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                {metaEntries}
              </div>
            )}

            {/* Status Dropdown */}
            {statusElement}

            {/* Tags */}
            {tagsSection}
          </div>
        </div>
      )}

      {/* Bottom Section: Full-Width Content (Starts at card left edge) */}
      {(productsSection || talentLocationSection || notesSection) && (
        <div className={`border-t border-slate-200 dark:border-slate-700 ${cardPadding}`}>
          <div className="flex flex-col gap-3">
            {/* Products - full width */}
            {productsSection}

            {/* Talent & Location - unified collapsible section */}
            {talentLocationSection}

            {/* Notes - full width */}
            {notesSection}
          </div>
        </div>
      )}
    </Card>
  );
});

// Test-only export for readStoredViewPrefs
export const __test__readStoredViewPrefs = readStoredViewPrefs;

const OVERVIEW_TAB_STORAGE_KEY = "shots:overviewTab";

const normaliseOverviewTab = (value) => {
  if (value === "schedule") return "schedule";
  if (value === "planner") return "schedule"; // Redirect legacy planner to schedule
  if (value === "assets") return "assets";
  return "shots";
};

const overviewTabs = [
  { value: "shots", label: "Builder", icon: Camera },
  { value: "schedule", label: "Schedule", icon: Calendar },
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
    if (activeTab === "schedule") {
      setLastVisitedPath("/shots?view=schedule");
    } else if (activeTab === "assets") {
      setLastVisitedPath("/shots?view=assets");
    } else {
      setLastVisitedPath("/shots");
    }
  }, [activeTab, setLastVisitedPath]);

  const activeContent = useMemo(() => {
    if (activeTab === "schedule") {
      return (
        <Suspense
          fallback={
            <div className="flex min-h-[240px] items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <CallSheetEmbed />
        </Suspense>
      );
    }
    if (activeTab === "assets") {
      return <ShotsAssetsTab />;
    }
    return <ShotsWorkspace />;
  }, [activeTab]);

  const activeLabel = activeTab === "schedule" ? "Schedule" : activeTab === "assets" ? "Assets" : "Builder";

  return (
    <ShotsOverviewProvider value={overviewValue}>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-neutral-900">
        {/* Non-sticky header - scrolls with content */}
        <div className="px-6 pt-4 pb-2" data-shot-overview-header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="heading-page">Shots</h1>
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
          </div>
        </div>

        {/* Sticky toolbar anchor - stays fixed when scrolling */}
        <div
          id="shots-toolbar-anchor"
          className="sticky top-14 z-40 bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-sm"
        />

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
