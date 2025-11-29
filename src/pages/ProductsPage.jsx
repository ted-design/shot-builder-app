import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useProducts } from "../hooks/useFirestoreQuery";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Checkbox } from "../components/ui/input";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState } from "../components/ui/EmptyState";
import VirtualizedList, { VirtualizedGrid } from "../components/ui/VirtualizedList";
import FilterPresetManager from "../components/ui/FilterPresetManager";
import NewProductModal from "../components/products/NewProductModal";
import EditProductModal from "../components/products/EditProductModal";
import ProductsTableView from "../components/products/ProductsTableView";
import SKUColorSelector from "../components/products/SKUColorSelector";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import AppImage from "../components/common/AppImage";
import ExportButton from "../components/common/ExportButton";
import { PageHeader } from "../components/ui/PageHeader";
import ExpandableSearch from "../components/overview/ExpandableSearch";
import SortMenu from "../components/overview/SortMenu";
import ViewModeMenu from "../components/overview/ViewModeMenu";
import FieldSettingsMenu from "../components/overview/FieldSettingsMenu";
import { LayoutGrid, Table, Archive, Trash2, Type, Package, X, CheckSquare, MoreVertical } from "lucide-react";
import {
  productFamiliesPath,
  productFamilyPath,
  productFamilySkuPath,
  productFamilySkusPath,
} from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { ROLE, canArchiveProducts, canDeleteProducts, canEditProducts } from "../lib/rbac";
import Modal from "../components/ui/modal";
import { toast, showConfirm } from "../lib/toast";
import { buildSkuAggregates, createProductFamily, genderLabel, formatProductImageFilename } from "../lib/productMutations";
import { readStorage, writeStorage } from "../lib/safeStorage";
import { getStaggerDelay } from "../lib/animations";
import { searchProducts } from "../lib/search";
import {
  getTypesForGender,
  getSubcategoriesForType,
  getTypeLabel,
  getSubcategoryLabel,
  hasCategories,
  getTypeLabelUnion,
  getSubcategoryLabelUnion,
} from "../lib/productCategories";
import ProductFilterDrawer from "../components/products/ProductFilterDrawer";

const statusLabel = (status) => {
  if (status === "discontinued") return "Discontinued";
  return "Active";
};

const statusBadgeClasses = (status) => {
  if (status === "discontinued") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
};

const recommendedImageText = "Use 1600x2000px JPGs under 2.5MB for best results.";

const VIEW_STORAGE_KEY = "products:viewMode";
const FIELD_PREFS_STORAGE_KEY = "products:fieldPrefs";
const COLUMN_STORAGE_KEY = "products:listColumns"; // legacy fallback

const SORT_OPTIONS = [
  { value: "styleNameAsc", label: "Style name (A→Z)" },
  { value: "styleNameDesc", label: "Style name (Z→A)" },
  { value: "styleNumberAsc", label: "Style number (low→high)" },
  { value: "styleNumberDesc", label: "Style number (high→low)" },
];

const DEFAULT_DENSITY = "comfortable";
const VIEW_PRESETS = [
  { value: "galleryComfortable", label: "Gallery · Comfortable", icon: LayoutGrid, view: "gallery", density: "comfortable" },
  { value: "galleryWide", label: "Gallery · Wide", icon: LayoutGrid, view: "gallery", density: "wide" },
  { value: "tableCompact", label: "Table · Compact", icon: Table, view: "table", density: "compact" },
];

// Dramatic density configuration
const DENSITY_CONFIG = {
  compact: {
    itemHeight: 220,
    gap: 'gap-2',      // 8px
    cardPadding: 'px-3 pb-3 pt-2',
    contentSpacing: 'space-y-1',
    textSize: 'text-sm',
    // Table-specific
    tableRow: 'py-1.5',      // 6px vertical padding
    tablePadding: 'px-2',    // 8px horizontal padding
    tableText: 'text-xs',
  },
  comfortable: {
    itemHeight: 400,
    gap: 'gap-4',      // 16px
    cardPadding: 'px-4 pb-4 pt-3',
    contentSpacing: 'space-y-2',
    textSize: 'text-base',
    // Table-specific
    tableRow: 'py-3',        // 12px vertical padding
    tablePadding: 'px-4',    // 16px horizontal padding
    tableText: 'text-sm',
  },
  wide: {
    itemHeight: 200,
    gap: 'gap-5',      // 20px - tighter to allow more text space
    cardPadding: 'px-4 py-4',
    contentSpacing: 'space-y-2',
    textSize: 'text-base',
    // Cap at 3 columns max, even on 2xl screens
    gridClass: 'grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    // Table-specific (inherit from comfortable)
    tableRow: 'py-3',
    tablePadding: 'px-4',
    tableText: 'text-sm',
  },
};

const PRODUCT_FIELD_OPTIONS = [
  { key: "preview", label: "Preview" },
  { key: "styleName", label: "Style name" },
  { key: "styleNumber", label: "Style #" },
  { key: "gender", label: "Gender" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "colors", label: "Colors" },
  { key: "sizes", label: "Sizes" },
  { key: "lastUpdated", label: "Last updated" },
];

const PRODUCT_FIELD_KEYS = PRODUCT_FIELD_OPTIONS.map(({ key }) => key);
const DEFAULT_FIELD_ORDER = PRODUCT_FIELD_KEYS;
const DEFAULT_FIELD_VISIBILITY = {
  preview: true,
  styleName: true,
  styleNumber: true,
  gender: true,
  category: true,
  status: true,
  colors: true,
  sizes: true,
  lastUpdated: true,
};

const LEGACY_LIST_COLUMN_DEFAULTS = {
  styleNumber: DEFAULT_FIELD_VISIBILITY.styleNumber,
  status: DEFAULT_FIELD_VISIBILITY.status,
  sizes: false,
};

const twoLineClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const buildFamilyMeta = (family) => {
  const displayImagePath = family?.thumbnailImagePath || family?.headerImagePath || null;
  const colourList = Array.isArray(family?.colorNames)
    ? family.colorNames.filter(Boolean)
    : [];
  const sizeList = Array.isArray(family?.sizeOptions)
    ? family.sizeOptions.filter(Boolean)
    : [];
  return {
    displayImagePath,
    colourList,
    coloursLabel: colourList.join(", "),
    sizeList,
    sizesLabel: sizeList.join(", "),
  };
};

const chunkArray = (items, size) => {
  if (size <= 0) return [items];
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normaliseText = (value) => (value || "").toString().trim().toLowerCase();

const normaliseViewMode = (value) => {
  if (value === "table" || value === "list") return "table";
  return "gallery";
};

const normaliseDensity = (value) => {
  if (value === "compact") return "compact";
  if (value === "comfortable" || value === "comfy" || value === "cozy") return "comfortable";
  if (value === "wide") return "wide";
  return DEFAULT_DENSITY;
};

const normaliseFieldOrder = (order) => {
  if (!Array.isArray(order)) return [...DEFAULT_FIELD_ORDER];
  const base = order.filter((key) => PRODUCT_FIELD_KEYS.includes(key));
  return [...base, ...PRODUCT_FIELD_KEYS.filter((key) => !base.includes(key))];
};

const readStoredColumns = () => {
  try {
    const raw = readStorage(COLUMN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      styleNumber:
        typeof parsed.styleNumber === "boolean"
          ? parsed.styleNumber
          : LEGACY_LIST_COLUMN_DEFAULTS.styleNumber,
      status:
        typeof parsed.status === "boolean" ? parsed.status : LEGACY_LIST_COLUMN_DEFAULTS.status,
      sizes:
        typeof parsed.sizes === "boolean" ? parsed.sizes : LEGACY_LIST_COLUMN_DEFAULTS.sizes,
    };
  } catch (error) {
    console.warn("[Products] Failed to parse list column preferences", error);
    return null;
  }
};

const readStoredFieldPrefs = () => {
  const visibility = { ...DEFAULT_FIELD_VISIBILITY };
  let order = [...DEFAULT_FIELD_ORDER];
  let locked = [];

  // Legacy checkbox preferences
  try {
    const legacyColumns = readStoredColumns();
    if (legacyColumns) {
      visibility.styleNumber = legacyColumns.styleNumber;
      visibility.status = legacyColumns.status;
      visibility.sizes = legacyColumns.sizes;
    }
  } catch {}

  // Legacy visibility map
  try {
    const legacyRaw = readStorage("products_fieldVisibility");
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      PRODUCT_FIELD_KEYS.forEach((key) => {
        if (parsedLegacy && Object.prototype.hasOwnProperty.call(parsedLegacy, key)) {
          visibility[key] = Boolean(parsedLegacy[key]);
        }
      });
    }
  } catch (error) {
    console.warn("[Products] Failed to parse legacy field visibility", error);
  }

  // Current prefs
  try {
    const raw = readStorage(FIELD_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const nextVisibility = parsed.visibility || parsed.visibleFields;
        if (nextVisibility && typeof nextVisibility === "object") {
          PRODUCT_FIELD_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(nextVisibility, key)) {
              visibility[key] = Boolean(nextVisibility[key]);
            }
          });
        }
        order = normaliseFieldOrder(parsed.order || parsed.fieldOrder || order);
        const lockedInput = parsed.locked || parsed.lockedFields;
        if (Array.isArray(lockedInput)) {
          locked = lockedInput.filter((key) => PRODUCT_FIELD_KEYS.includes(key));
        }
      }
    }
  } catch (error) {
    console.warn("[Products] Failed to parse field preferences", error);
  }

  return {
    visibility,
    order: normaliseFieldOrder(order),
    locked,
  };
};

const readStoredViewMode = () => {
  return normaliseViewMode(readStorage(VIEW_STORAGE_KEY));
};

const formatUpdatedAt = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(typeof value.toMillis === "function" ? value.toMillis() : value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const FamilyHeaderImage = memo(function FamilyHeaderImage({ path, alt, className }) {
  const containerClass = [
    "overflow-hidden rounded-card bg-slate-100",
    className || "aspect-[4/5] w-full",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <AppImage
      src={path}
      alt={alt}
      preferredSize={640}
      loading="lazy"
      className={containerClass}
      imageClassName="h-full w-full object-cover"
      placeholder={
        <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
          Loading image…
        </div>
      }
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
          No image
        </div>
      }
    />
  );
});

const CreateProductCard = memo(function CreateProductCard({ onClick }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className="border-dashed border-2 border-slate-300 bg-slate-50 cursor-pointer transition-all duration-150 hover:border-slate-400 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/60 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label="Create new product family"
    >
      <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">Create Product</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add a new product family with colours, sizes, and SKUs.
        </p>
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label="Create new product"
        >
          New Product
        </Button>
      </CardContent>
    </Card>
  );
});

const ProductActionMenu = memo(function ProductActionMenu({
  family,
  onEdit,
  onRename,
  onToggleStatus,
  onArchive,
  onRestore,
  canEdit,
  canArchive,
  canDelete,
  open,
  onClose,
}) {
  if (!open) return null;
  return (
    <div
      role="menu"
      aria-label={`Actions for ${family.styleName || 'product'}`}
      className="absolute right-0 top-10 z-50 w-48 rounded-md border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg dark:border-slate-700 dark:bg-slate-800/95"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => {
          onEdit(family);
          onClose();
        }}
      >
        Edit family
      </button>
      {canEdit && (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          onClick={() => {
            onRename(family);
            onClose();
          }}
        >
          Rename
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          onClick={() => {
            onToggleStatus(family);
            onClose();
          }}
        >
          {family.status === "discontinued" ? "Set active" : "Set discontinued"}
        </button>
      )}
      {!family.deleted && canArchive && (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          onClick={() => {
            onArchive(family);
            onClose();
          }}
        >
          {family.archived ? "Restore from archive" : "Archive"}
        </button>
      )}
      {family.deleted && canDelete && (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-emerald-600 font-medium dark:hover:bg-slate-700"
          onClick={() => {
            onRestore(family);
            onClose();
          }}
        >
          Restore from deleted
        </button>
      )}
      {/* Delete action is intentionally not exposed here; use typed confirmation in Edit modal. */}
    </div>
  );
});

export default function ProductsPage() {
  const { clientId, role: globalRole, user } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canEdit = canEditProducts(role);
  const canArchive = canArchiveProducts(role);
  const canDelete = canDeleteProducts(role);
  const currentProductFamiliesPath = useMemo(() => productFamiliesPath(clientId), [clientId]);
  const productFamilyPathForClient = useCallback(
    (familyId) => productFamilyPath(familyId, clientId),
    [clientId]
  );
  const productFamilySkusPathForClient = useCallback(
    (familyId) => productFamilySkusPath(familyId, clientId),
    [clientId]
  );
  const productFamilySkuPathForClient = useCallback(
    (familyId, skuId) => productFamilySkuPath(familyId, skuId, clientId),
    [clientId]
  );

  // TanStack Query hook - cached data with realtime updates
  const { data: families = [], isLoading: loading } = useProducts(clientId);

  const [queryText, setQueryText] = useState("");
  const debouncedQueryText = useDebouncedValue(queryText, 300);
  const [statusFilter, setStatusFilter] = useState("active");
  const [genderFilter, setGenderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  // Pagination state - only used in list view (gallery view uses VirtualizedGrid)
  const [itemsToShow, setItemsToShow] = useState(50);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFamily, setEditFamily] = useState(null);
  const [menuFamilyId, setMenuFamilyId] = useState(null);
  const [renameState, setRenameState] = useState({ id: null, value: "", saving: false, error: null });
  const [viewMode, setViewMode] = useState(() => readStoredViewMode());
  const [sortOrder, setSortOrder] = useState("styleNameAsc");
  const initialFieldPrefs = useMemo(() => readStoredFieldPrefs(), []);

  // New state for consolidated toolbar features
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const [density, setDensity] = useState(() => normaliseDensity(readStorage("products_density") || DEFAULT_DENSITY));
  const [fieldVisibility, setFieldVisibility] = useState(initialFieldPrefs.visibility);
  const [fieldOrder, setFieldOrder] = useState(initialFieldPrefs.order);
  const [lockedFields, setLockedFields] = useState(initialFieldPrefs.locked);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState(() => new Set());
  const [batchStyleModalOpen, setBatchStyleModalOpen] = useState(false);
  const [batchStyleDraft, setBatchStyleDraft] = useState([]);
  const [batchCategoryModalOpen, setBatchCategoryModalOpen] = useState(false);
  const [batchCategoryDraft, setBatchCategoryDraft] = useState({ productType: null, productSubcategory: null });
  const [batchWorking, setBatchWorking] = useState(false);
  const [confirmBatchDeleteOpen, setConfirmBatchDeleteOpen] = useState(false);
  const [confirmBatchDeleteText, setConfirmBatchDeleteText] = useState("");

  // Wide density mode - SKU selection and preloading
  const [selectedSkus, setSelectedSkus] = useState({}); // { familyId: skuId }
  const [familySkus, setFamilySkus] = useState({}); // { familyId: SKU[] }

  const menuRef = useRef(null);
  const skuCacheRef = useRef(new Map());
  const pendingSkuLoadsRef = useRef(new Set());
  const pendingSkuPromisesRef = useRef(new Map());
  const batchFirstFieldRef = useRef(null);
  const selectAllRef = useRef(null);

  const canUseBatchActions = canEdit || canArchive || canDelete;

  // Removed: onSnapshot subscription replaced by useProducts hook above

  useEffect(() => {
    function onWindowClick(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuFamilyId(null);
      }
    }
    if (menuFamilyId) {
      window.addEventListener("mousedown", onWindowClick);
      return () => window.removeEventListener("mousedown", onWindowClick);
    }
    return undefined;
  }, [menuFamilyId]);

  useEffect(() => {
    writeStorage(VIEW_STORAGE_KEY, normaliseViewMode(viewMode));
  }, [viewMode]);

  // Persist new toolbar state
  useEffect(() => {
    writeStorage("products_density", normaliseDensity(density));
  }, [density]);

  useEffect(() => {
    try {
      writeStorage(
        FIELD_PREFS_STORAGE_KEY,
        JSON.stringify({
          visibility: fieldVisibility,
          order: fieldOrder,
          locked: lockedFields,
        })
      );
      // Keep legacy key in sync for compatibility
      writeStorage("products_fieldVisibility", JSON.stringify(fieldVisibility));
    } catch (error) {
      console.warn("[Products] Failed to persist field preferences", error);
    }
  }, [fieldVisibility, fieldOrder, lockedFields]);

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!selectionModeActive && selectedFamilyIds.size > 0) {
      setSelectedFamilyIds(new Set());
    }
  }, [selectionModeActive, selectedFamilyIds.size]);

  // Reset pagination when filters or search change
  useEffect(() => {
    setItemsToShow(50);
  }, [debouncedQueryText, statusFilter, genderFilter, typeFilter, subcategoryFilter, showArchived, sortOrder]);

  const filteredFamilies = useMemo(() => {
    const text = debouncedQueryText.trim();

    // First apply filter criteria (status, gender, type, subcategory, archived)
    const preFiltered = families.filter((family) => {
      if (family.deleted) return false;
      if (!showArchived && family.archived) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && family.status === "discontinued") return false;
        if (statusFilter === "discontinued" && family.status !== "discontinued") return false;
      }
      if (genderFilter !== "all" && (family.gender || "").toLowerCase() !== genderFilter) return false;
      if (typeFilter !== "all" && (family.productType || "") !== typeFilter) return false;
      if (subcategoryFilter !== "all" && (family.productSubcategory || "") !== subcategoryFilter) return false;
      return true;
    });

    // If no search query, return pre-filtered results
    if (!text) return preFiltered;

    // Apply fuzzy search to pre-filtered results
    const searchResults = searchProducts(preFiltered, text);

    // Extract items from search results
    return searchResults.map(result => result.item);
  }, [families, debouncedQueryText, statusFilter, genderFilter, typeFilter, subcategoryFilter, showArchived]);

  // Sort filtered families based on current sort order
  const sortedFamilies = useMemo(() => {
    const list = [...filteredFamilies];
    const compareStyleName = (a, b) => {
      const left = normaliseText(a.styleName);
      const right = normaliseText(b.styleName);
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      if (result !== 0) return result;
      return (a.id || "").localeCompare(b.id || "");
    };
    const compareStyleNumber = (a, b) => {
      const left = normaliseText(a.styleNumber);
      const right = normaliseText(b.styleNumber);
      if (!left && !right) return compareStyleName(a, b);
      if (!left) return 1;
      if (!right) return -1;
      const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      if (result !== 0) return result;
      return compareStyleName(a, b);
    };

    switch (sortOrder) {
      case "styleNameDesc":
        list.sort((a, b) => compareStyleName(b, a));
        break;
      case "styleNumberAsc":
        list.sort(compareStyleNumber);
        break;
      case "styleNumberDesc":
        list.sort((a, b) => compareStyleNumber(b, a));
        break;
      default:
        list.sort(compareStyleName);
        break;
    }
    return list;
  }, [filteredFamilies, sortOrder]);

  // Preload SKUs for visible families when in wide density mode
  useEffect(() => {
    if (density !== 'wide' || !db || !clientId) return;

    const visibleFamilies = sortedFamilies.slice(0, itemsToShow);
    const familiesToLoad = visibleFamilies.filter(
      (family) => !familySkus[family.id] && !pendingSkuLoadsRef.current.has(family.id)
    );

    if (familiesToLoad.length === 0) return;

    const loadSkusForFamilies = async () => {
      const skuPromises = familiesToLoad.map(async (family) => {
        pendingSkuLoadsRef.current.add(family.id);
        try {
          const skusRef = collection(db, ...productFamilySkusPath(family.id, clientId));
          const snapshot = await getDocs(skusRef);
          const skus = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((sku) => sku.deleted !== true);
          return { familyId: family.id, skus };
        } catch (error) {
          console.error(`Failed to load SKUs for family ${family.id}:`, error);
          return { familyId: family.id, skus: [] };
        } finally {
          pendingSkuLoadsRef.current.delete(family.id);
        }
      });

      const results = await Promise.all(skuPromises);
      const newFamilySkus = {};
      const newSelectedSkus = {};

      results.forEach(({ familyId, skus }) => {
        newFamilySkus[familyId] = skus;
        // Auto-select first SKU if none selected
        if (skus.length > 0 && !selectedSkus[familyId]) {
          newSelectedSkus[familyId] = skus[0].id;
        }
      });

      setFamilySkus((prev) => ({ ...prev, ...newFamilySkus }));
      setSelectedSkus((prev) => ({ ...prev, ...newSelectedSkus }));
    };

    loadSkusForFamilies();
  }, [density, sortedFamilies, itemsToShow, familySkus, selectedSkus, db, clientId]);

  const displayedFamilies = useMemo(() => {
    return sortedFamilies.slice(0, itemsToShow);
  }, [sortedFamilies, itemsToShow]);

  // Auto-expand table pagination for small remainders so counts align
  useEffect(() => {
    const mode = normaliseViewMode(viewMode);
    const total = sortedFamilies.length;
    if (mode !== "table") return;
    if (total > itemsToShow && total - itemsToShow <= 20) {
      setItemsToShow(total);
    }
  }, [viewMode, sortedFamilies, itemsToShow]);

  const hasMoreItems = sortedFamilies.length > itemsToShow;
  const totalCount = sortedFamilies.length;

  const genders = useMemo(() => {
    const set = new Set();
    families.forEach((family) => family.gender && set.add(family.gender.toLowerCase()));
    return Array.from(set);
  }, [families]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "active") count++;
    if (genderFilter !== "all") count++;
    if (typeFilter !== "all") count++;
    if (subcategoryFilter !== "all") count++;
    if (showArchived) count++;
    return count;
  }, [statusFilter, genderFilter, typeFilter, subcategoryFilter, showArchived]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStatusFilter("active");
    setGenderFilter("all");
    setTypeFilter("all");
    setSubcategoryFilter("all");
    setShowArchived(false);
  }, []);

  // Handle preset load
  const handleLoadPreset = useCallback((filters) => {
    if (filters.statusFilter !== undefined) setStatusFilter(filters.statusFilter);
    if (filters.genderFilter !== undefined) setGenderFilter(filters.genderFilter);
    if (filters.typeFilter !== undefined) setTypeFilter(filters.typeFilter);
    if (filters.subcategoryFilter !== undefined) setSubcategoryFilter(filters.subcategoryFilter);
    if (filters.showArchived !== undefined) setShowArchived(filters.showArchived);
  }, []);

  // Get current filters for saving
  const getCurrentFilters = useCallback(() => ({
    statusFilter,
    genderFilter,
    typeFilter,
    subcategoryFilter,
    showArchived,
  }), [statusFilter, genderFilter, typeFilter, subcategoryFilter, showArchived]);

  // Build active filters array for pills
  const activeFilters = useMemo(() => {
    const filters = [];
    if (statusFilter !== "active") {
      filters.push({
        key: "status",
        label: "Status",
        value: statusFilter === "all" ? "All statuses" : "Discontinued",
      });
    }
    if (genderFilter !== "all") {
      filters.push({
        key: "gender",
        label: "Gender",
        value: genderLabel(genderFilter),
      });
    }
    if (typeFilter !== "all") {
      filters.push({
        key: "type",
        label: "Type",
        value:
          genderFilter === "all"
            ? getTypeLabelUnion(typeFilter) || typeFilter
            : getTypeLabel(genderFilter, typeFilter) || typeFilter,
      });
    }
    if (subcategoryFilter !== "all") {
      filters.push({
        key: "subcategory",
        label: "Subcategory",
        value:
          genderFilter === "all"
            ? getSubcategoryLabelUnion(typeFilter, subcategoryFilter) || subcategoryFilter
            : getSubcategoryLabel(genderFilter, typeFilter, subcategoryFilter) || subcategoryFilter,
      });
    }
    if (showArchived) {
      filters.push({
        key: "archived",
        label: "Show archived",
        value: "Yes",
      });
    }
    return filters;
  }, [statusFilter, genderFilter, typeFilter, subcategoryFilter, showArchived]);

  // Remove individual filter
  const removeFilter = useCallback((filterKey) => {
    switch (filterKey) {
      case "status":
        setStatusFilter("active");
        break;
      case "gender":
        setGenderFilter("all");
        setTypeFilter("all");
        setSubcategoryFilter("all");
        break;
      case "type":
        setTypeFilter("all");
        setSubcategoryFilter("all");
        break;
      case "subcategory":
        setSubcategoryFilter("all");
        break;
      case "archived":
        setShowArchived(false);
        break;
      default:
        break;
    }
  }, []);

  const resolvedFieldVisibility = useMemo(
    () => ({ ...DEFAULT_FIELD_VISIBILITY, ...(fieldVisibility || {}) }),
    [fieldVisibility]
  );
  const resolvedFieldOrder = useMemo(
    () => normaliseFieldOrder(fieldOrder),
    [fieldOrder]
  );
  const resolvedDensityKey = DENSITY_CONFIG[density] ? density : DEFAULT_DENSITY;

  const ensureFamilySkusLoaded = useCallback((familyId) => {
    if (!db || !clientId) return Promise.resolve([]);
    if (familySkus[familyId]) return Promise.resolve(familySkus[familyId]);
    if (pendingSkuPromisesRef.current.has(familyId)) {
      return pendingSkuPromisesRef.current.get(familyId);
    }

    pendingSkuLoadsRef.current.add(familyId);
    const loadPromise = getDocs(collection(db, ...productFamilySkusPathForClient(familyId)))
      .then((snapshot) => {
        const skus = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((sku) => sku.deleted !== true);

        setFamilySkus((prev) => ({ ...prev, [familyId]: skus }));
        setSelectedSkus((prev) => {
          if (prev[familyId] || !skus.length) return prev;
          return { ...prev, [familyId]: skus[0].id };
        });
        return skus;
      })
      .catch((error) => {
        console.error(`[Products] Failed to load SKUs for family ${familyId}:`, error);
        return [];
      })
      .finally(() => {
        pendingSkuLoadsRef.current.delete(familyId);
        pendingSkuPromisesRef.current.delete(familyId);
      });

    pendingSkuPromisesRef.current.set(familyId, loadPromise);
    return loadPromise;
  }, [clientId, db, familySkus, productFamilySkusPathForClient]);

  // Preload SKUs for visible families when showing colors in table view (for swatches)
  useEffect(() => {
    const mode = normaliseViewMode(viewMode);
    if (mode !== "table") return;
    if (!resolvedFieldVisibility.colors) return;
    displayedFamilies.forEach((family) => {
      if (!familySkus[family.id] && !pendingSkuPromisesRef.current.has(family.id)) {
        ensureFamilySkusLoaded(family.id);
      }
    });
  }, [viewMode, resolvedFieldVisibility.colors, displayedFamilies, familySkus, ensureFamilySkusLoaded]);

  const toggleFieldVisibility = useCallback((key) => {
    if (lockedFields.includes(key)) return;
    setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, [lockedFields]);

  const toggleFieldLock = useCallback((key) => {
    setLockedFields((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]
    );
  }, []);

  const handleFieldOrderChange = useCallback((nextOrder) => {
    setFieldOrder(normaliseFieldOrder(nextOrder));
  }, []);

  const currentViewPreset = useMemo(() => {
    const match = VIEW_PRESETS.find(
      (preset) => normaliseViewMode(preset.view) === normaliseViewMode(viewMode) && normaliseDensity(preset.density) === resolvedDensityKey
    );
    return match ? match.value : VIEW_PRESETS[0].value;
  }, [viewMode, resolvedDensityKey]);

  const handleViewPresetChange = useCallback((presetValue) => {
    const preset = VIEW_PRESETS.find((item) => item.value === presetValue) || VIEW_PRESETS[0];
    setViewMode(normaliseViewMode(preset.view));
    setDensity(normaliseDensity(preset.density));
  }, []);

  useEffect(() => {
    const mode = normaliseViewMode(viewMode);
    if (mode === "table" && resolvedDensityKey !== "compact") {
      setDensity("compact");
    } else if (mode === "gallery" && resolvedDensityKey === "compact") {
      setDensity("comfortable");
    }
  }, [viewMode, resolvedDensityKey]);

  const familyMap = useMemo(() => {
    const map = new Map();
    families.forEach((family) => {
      map.set(family.id, family);
    });
    return map;
  }, [families]);

  const selectedFamilies = useMemo(
    () => sortedFamilies.filter((family) => selectedFamilyIds.has(family.id)),
    [sortedFamilies, selectedFamilyIds]
  );
  const selectedCount = selectedFamilies.length;
  const allVisibleSelected =
    sortedFamilies.length > 0 && sortedFamilies.every((family) => selectedFamilyIds.has(family.id));
  const hasActiveSelected = selectedFamilies.some((family) => !family.archived);
  const hasArchivedSelected = selectedFamilies.some((family) => family.archived);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = !allVisibleSelected && selectedCount > 0;
  }, [allVisibleSelected, selectedCount]);

  useEffect(() => {
    setSelectedFamilyIds((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(sortedFamilies.map((family) => family.id));
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (visible.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [sortedFamilies]);

  useEffect(() => {
    if (!batchStyleModalOpen) return;
    if (!selectedCount) {
      setBatchStyleModalOpen(false);
    }
  }, [batchStyleModalOpen, selectedCount]);

  useEffect(() => {
    if (!batchCategoryModalOpen) return;
    if (!selectedCount) {
      setBatchCategoryModalOpen(false);
    }
  }, [batchCategoryModalOpen, selectedCount]);

  const closeModals = () => {
    setNewModalOpen(false);
    setEditModalOpen(false);
    setEditFamily(null);
    skuCacheRef.current = new Map();
  };

  const clearSelection = useCallback(() => setSelectedFamilyIds(new Set()), []);

  const toggleFamilySelection = useCallback(
    (familyId, nextValue) => {
      if (!canUseBatchActions || batchWorking) return;
      setSelectedFamilyIds((prev) => {
        const currentlySelected = prev.has(familyId);
        const shouldSelect = typeof nextValue === "boolean" ? nextValue : !currentlySelected;
        if (currentlySelected === shouldSelect) return prev;
        const next = new Set(prev);
        if (shouldSelect) {
          next.add(familyId);
        } else {
          next.delete(familyId);
        }
        return next;
      });
    },
    [batchWorking, canUseBatchActions]
  );

  const handleSelectAllChange = useCallback(
    (event) => {
      if (batchWorking) return;
      const { checked } = event.target;
      setSelectedFamilyIds((prev) => {
        if (checked) {
          const next = new Set(prev);
          sortedFamilies.forEach((family) => next.add(family.id));
          if (next.size === prev.size) return prev;
          return next;
        }
        if (!prev.size) return prev;
        const next = new Set(prev);
        let changed = false;
        sortedFamilies.forEach((family) => {
          if (next.delete(family.id)) changed = true;
        });
        return changed ? next : prev;
      });
    },
    [batchWorking, sortedFamilies]
  );

  const runBatchedWrites = useCallback(async (operations) => {
    if (!operations.length) return;
    for (const chunk of chunkArray(operations, 200)) {
      const batch = writeBatch(db);
      chunk.forEach((operation) => {
        switch (operation.type) {
          case "update":
            batch.update(operation.ref, operation.data);
            break;
          case "delete":
            batch.delete(operation.ref);
            break;
          case "set":
            batch.set(operation.ref, operation.data, operation.options);
            break;
          default:
            break;
        }
      });
      await batch.commit();
    }
  }, []);

  const handleCreateFamily = useCallback(
    async (payload) => {
      if (!canEdit) throw new Error("You do not have permission to create products.");
      await createProductFamily({
        db,
        clientId,
        payload,
        userId: user?.uid || null,
      });
    },
    [canEdit, clientId, user]
  );

  const loadFamilyForEdit = useCallback(
    async (family) => {
      setEditLoading(true);
      setEditFamily({ ...family, skus: [] });
      setEditModalOpen(true);
      try {
        const skuSnapshot = await getDocs(
          query(
            collection(db, ...productFamilySkusPathForClient(family.id)),
            orderBy("colorName", "asc")
          )
        );
        // Filter out deleted SKUs in memory to handle SKUs without a deleted field
        // Explicitly check for deleted === true to include SKUs with undefined/null deleted field
        const skus = skuSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((sku) => sku.deleted !== true);
        skuCacheRef.current = new Map(skus.map((sku) => [sku.id, sku]));
        setEditFamily({ ...family, skus });
      } catch (error) {
        console.error("[Products] Failed to load SKUs for edit:", error);
        toast.error({
          title: "Failed to load product details",
          description: error?.message || "Unable to load SKUs. Please try again.",
        });
      } finally {
        setEditLoading(false);
      }
    },
    [productFamilySkusPathForClient] // productFamilySkusPathForClient depends on clientId
  );

  const handleUpdateFamily = useCallback(
    async (familyId, payload) => {
      if (!canEdit) throw new Error("You do not have permission to edit products.");
      const now = Date.now();
      const familySizes = Array.isArray(payload.family.sizes) ? payload.family.sizes : [];
      const aggregates = buildSkuAggregates(payload.skus, familySizes);
      const familyRef = doc(db, ...productFamilyPathForClient(familyId));
      let thumbnailPath = payload.family.currentThumbnailImagePath || null;

      const updates = {
        styleName: payload.family.styleName,
        styleNumber: payload.family.styleNumber,
        previousStyleNumber: payload.family.previousStyleNumber,
        gender: payload.family.gender,
        productType: payload.family.productType || null,
        productSubcategory: payload.family.productSubcategory || null,
        status: payload.family.status,
        archived: payload.family.archived,
        notes: payload.family.notes,
        sizes: familySizes,
        skuCount: aggregates.skuCount,
        activeSkuCount: aggregates.activeSkuCount,
        skuCodes: aggregates.skuCodes,
        colorNames: aggregates.colorNames,
        sizeOptions: aggregates.sizeOptions,
        updatedAt: now,
        updatedBy: user?.uid || null,
      };

      if (payload.family.removeThumbnailImage) {
        updates.thumbnailImagePath = null;
        const pathToRemove = payload.family.currentThumbnailImagePath;
        if (pathToRemove) {
          await deleteImageByPath(pathToRemove).catch(() => {});
        }
        thumbnailPath = null;
      }

      if (payload.family.removeHeaderImage) {
        updates.headerImagePath = null;
        const pathToRemove = payload.family.currentHeaderImagePath;
        if (pathToRemove) {
          await deleteImageByPath(pathToRemove).catch(() => {});
        }
      }

      await updateDoc(familyRef, updates);

      if (payload.family.thumbnailImageFile) {
        const { path } = await uploadImageFile(payload.family.thumbnailImageFile, {
          folder: "productFamilies",
          id: `${familyId}/thumbnail`,
          optimize: false, // already optimized in form layer
        });
        await updateDoc(familyRef, {
          thumbnailImagePath: path,
          updatedAt: Date.now(),
          updatedBy: user?.uid || null,
        });
        if (thumbnailPath && thumbnailPath !== path) {
          await deleteImageByPath(thumbnailPath).catch(() => {});
        }
        thumbnailPath = path;
      }

      if (payload.family.headerImageFile) {
        const { path } = await uploadImageFile(payload.family.headerImageFile, {
          folder: "productFamilies",
          id: familyId,
          optimize: false, // already optimized in form layer
        });
        await updateDoc(familyRef, {
          headerImagePath: path,
          updatedAt: Date.now(),
          updatedBy: user?.uid || null,
        });
        const previousPath = payload.family.currentHeaderImagePath;
        if (previousPath) {
          await deleteImageByPath(previousPath).catch(() => {});
        }
      }

      let fallbackImagePath = null;
      for (const sku of payload.skus) {
        if (sku.id) {
          const skuRef = doc(db, ...productFamilySkuPathForClient(familyId, sku.id));
          const update = {
            colorName: sku.colorName,
            skuCode: sku.skuCode,
            sizes: sku.sizes,
            status: sku.status,
            archived: sku.archived,
            hexColor: sku.hexColor || null,
            updatedAt: now,
            updatedBy: user?.uid || null,
          };
          let nextImagePath = sku.imagePath || null;
          if (sku.removeImage) {
            update.imagePath = null;
            if (sku.imagePath) {
              await deleteImageByPath(sku.imagePath).catch(() => {});
            }
            nextImagePath = null;
          }
          if (sku.imageFile) {
            // Generate formatted filename for new image upload
            const filename = formatProductImageFilename(
              payload.family?.styleNumber,
              payload.family?.styleName,
              sku.colorName
            );

            const result = await uploadImageFile(sku.imageFile, {
              folder: `productFamilies/${familyId}/skus`,
              id: sku.id,
              filename,
              optimize: false, // already optimized in form layer
            });
            update.imagePath = result.path;
            if (sku.imagePath && sku.imagePath !== result.path) {
              await deleteImageByPath(sku.imagePath).catch(() => {});
            }
            nextImagePath = result.path;
          }
          await updateDoc(skuRef, update);
          if (!fallbackImagePath && nextImagePath && !sku.removeImage) {
            fallbackImagePath = nextImagePath;
          }
        } else {
          const skuCollection = collection(db, ...productFamilySkusPathForClient(familyId));
          const skuRef = doc(skuCollection);
          let imagePath = sku.imagePath || null;
          if (sku.imageFile) {
            // Generate formatted filename for new colourway image
            const filename = formatProductImageFilename(
              payload.family?.styleNumber,
              payload.family?.styleName,
              sku.colorName
            );

            const result = await uploadImageFile(sku.imageFile, {
              folder: `productFamilies/${familyId}/skus`,
              id: skuRef.id,
              filename,
              optimize: false, // already optimized in form layer
            });
            imagePath = result.path;
          }
          await setDoc(skuRef, {
            colorName: sku.colorName,
            skuCode: sku.skuCode,
            sizes: sku.sizes,
            status: sku.status,
            archived: sku.archived,
            hexColor: sku.hexColor || null,
            imagePath,
            deleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            createdBy: user?.uid || null,
            updatedBy: user?.uid || null,
          });
          if (!fallbackImagePath && imagePath && !sku.removeImage) {
            fallbackImagePath = imagePath;
          }
        }
      }

      for (const removedId of payload.removedSkuIds) {
        await updateDoc(doc(db, ...productFamilySkuPathForClient(familyId, removedId)), {
          deleted: true,
          deletedAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user?.uid || null,
        });
      }

      if (!thumbnailPath && fallbackImagePath) {
        await updateDoc(familyRef, {
          thumbnailImagePath: fallbackImagePath,
          updatedAt: Date.now(),
          updatedBy: user?.uid || null,
        });
      }

      // Clear cached SKUs for this family so they get re-fetched with updated hexColor values
      setFamilySkus((prev) => {
        const next = { ...prev };
        delete next[familyId];
        return next;
      });
    },
    [canEdit, user]
  );

  const handleArchiveToggle = useCallback(async (family) => {
    if (!canArchive) return;
    const update = {
      archived: !family.archived,
      updatedAt: Date.now(),
      updatedBy: user?.uid || null,
    };
    await updateDoc(doc(db, ...productFamilyPathForClient(family.id)), update);
  }, [canArchive, db, currentProductFamiliesPath, user]);

  const handleStatusToggle = useCallback(async (family) => {
    if (!canEdit) return;
    await updateDoc(doc(db, ...productFamilyPathForClient(family.id)), {
      status: family.status === "discontinued" ? "active" : "discontinued",
      updatedAt: Date.now(),
      updatedBy: user?.uid || null,
    });
  }, [canEdit, db, currentProductFamiliesPath, user]);

  const handleDeleteFamily = async (family, options = {}) => {
    if (!canDelete) return;
    if (!options?.skipPrompt) {
      const confirmed = await showConfirm(
        `Delete ${family.styleName}? This marks it as deleted but keeps it for potential recovery.`
      );
      if (!confirmed) return;
    }

    const now = Date.now();
    const familyRef = doc(db, ...productFamilyPathForClient(family.id));
    await updateDoc(familyRef, {
      deleted: true,
      deletedAt: now,
      updatedAt: now,
      updatedBy: user?.uid || null,
    });
  };

  const handleRestoreFamily = useCallback(async (family) => {
    if (!canDelete) return;
    const now = Date.now();
    const familyRef = doc(db, ...productFamilyPathForClient(family.id));
    await updateDoc(familyRef, {
      deleted: false,
      deletedAt: null,
      updatedAt: now,
      updatedBy: user?.uid || null,
    });
    toast.success(`Restored ${family.styleName}.`);
  }, [canDelete, db, currentProductFamiliesPath, user]);

  const handleBatchArchive = async () => {
    if (!canArchive || !selectedFamilies.length) return;
    const toArchive = selectedFamilies.filter((family) => !family.archived);
    if (!toArchive.length) {
      toast.info("Selected products are already archived.");
      return;
    }
    setBatchWorking(true);
    try {
      const now = Date.now();
      const operations = toArchive.map((family) => ({
        type: "update",
        ref: doc(db, ...productFamilyPathForClient(family.id)),
        data: {
          archived: true,
          updatedAt: now,
          updatedBy: user?.uid || null,
        },
      }));
      await runBatchedWrites(operations);
      toast.success(`Archived ${toArchive.length} product ${toArchive.length === 1 ? "family" : "families"}.`);
      clearSelection();
    } catch (error) {
      console.error("[Products] Batch archive failed", error);
      toast.error({ title: "Archive failed", description: error?.message || "Unable to archive selection." });
    } finally {
      setBatchWorking(false);
    }
  };

  const handleBatchRestore = async () => {
    if (!canArchive || !selectedFamilies.length) return;
    const toRestore = selectedFamilies.filter((family) => family.archived);
    if (!toRestore.length) {
      toast.info("Selected products are not archived.");
      return;
    }
    setBatchWorking(true);
    try {
      const now = Date.now();
      const operations = toRestore.map((family) => ({
        type: "update",
        ref: doc(db, ...productFamilyPathForClient(family.id)),
        data: {
          archived: false,
          updatedAt: now,
          updatedBy: user?.uid || null,
        },
      }));
      await runBatchedWrites(operations);
      toast.success(`Restored ${toRestore.length} product ${toRestore.length === 1 ? "family" : "families"}.`);
      clearSelection();
    } catch (error) {
      console.error("[Products] Batch restore failed", error);
      toast.error({ title: "Restore failed", description: error?.message || "Unable to restore selection." });
    } finally {
      setBatchWorking(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!canDelete || !selectedFamilies.length) return;
    const count = selectedFamilies.length;
    setBatchWorking(true);
    try {
      const now = Date.now();
      const operations = selectedFamilies.map((family) => ({
        type: "update",
        ref: doc(db, ...productFamilyPathForClient(family.id)),
        data: {
          deleted: true,
          deletedAt: now,
          updatedAt: now,
          updatedBy: user?.uid || null,
        },
      }));

      await runBatchedWrites(operations);
      toast.success(`Deleted ${count} product ${count === 1 ? "family" : "families"}.`);
      clearSelection();
    } catch (error) {
      console.error("[Products] Batch delete failed", error);
      toast.error({ title: "Delete failed", description: error?.message || "Unable to delete selection." });
    } finally {
      setBatchWorking(false);
    }
  };

  const openBatchStyleNumberModal = () => {
    if (!canEdit || !selectedFamilies.length) return;
    const draft = selectedFamilies.map((family) => ({
      id: family.id,
      styleName: family.styleName || "Untitled product",
      currentStyleNumber: family.styleNumber || "",
      nextStyleNumber: family.styleNumber || "",
    }));
    setBatchStyleDraft(draft);
    setBatchStyleModalOpen(true);
  };

  const handleBatchStyleDraftChange = (familyId, value) => {
    setBatchStyleDraft((prev) =>
      prev.map((entry) => (entry.id === familyId ? { ...entry, nextStyleNumber: value } : entry))
    );
  };

  const closeBatchStyleModal = () => {
    if (batchWorking) return;
    setBatchStyleModalOpen(false);
  };

  const handleBatchStyleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit) return;
    const updates = batchStyleDraft
      .map((entry) => ({
        id: entry.id,
        value: entry.nextStyleNumber.trim(),
        current: entry.currentStyleNumber.trim(),
      }))
      .filter((entry) => entry.value !== entry.current);
    if (!updates.length) {
      toast.info("No style number changes to save.");
      setBatchStyleModalOpen(false);
      return;
    }

    setBatchWorking(true);
    try {
      const now = Date.now();
      const operations = updates.map((entry) => ({
        type: "update",
        ref: doc(db, ...productFamilyPathForClient(entry.id)),
        data: {
          styleNumber: entry.value || null,
          updatedAt: now,
          updatedBy: user?.uid || null,
        },
      }));
      await runBatchedWrites(operations);
      toast.success(`Updated style numbers for ${updates.length} product ${updates.length === 1 ? "family" : "families"}.`);
      setBatchStyleModalOpen(false);
      clearSelection();
    } catch (error) {
      console.error("[Products] Batch style number update failed", error);
      toast.error({
        title: "Update failed",
        description: error?.message || "Unable to update style numbers.",
      });
    } finally {
      setBatchWorking(false);
    }
  };

  // Batch category assignment
  const openBatchCategoryModal = () => {
    if (!canEdit || !selectedFamilies.length) return;
    // Initialize with null to require explicit selection
    setBatchCategoryDraft({ productType: null, productSubcategory: null });
    setBatchCategoryModalOpen(true);
  };

  const closeBatchCategoryModal = () => {
    if (batchWorking) return;
    setBatchCategoryModalOpen(false);
  };

  const handleBatchCategoryDraftChange = (field, value) => {
    setBatchCategoryDraft((prev) => {
      const next = { ...prev, [field]: value || null };
      // Reset subcategory when type changes
      if (field === "productType") {
        next.productSubcategory = null;
      }
      return next;
    });
  };

  const handleBatchCategorySubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || !selectedFamilies.length) return;
    // At least one field must be set
    if (batchCategoryDraft.productType === null && batchCategoryDraft.productSubcategory === null) {
      toast.info("Select a type or subcategory to assign.");
      return;
    }

    setBatchWorking(true);
    try {
      const now = Date.now();
      const operations = selectedFamilies.map((family) => ({
        type: "update",
        ref: doc(db, ...productFamilyPathForClient(family.id)),
        data: {
          productType: batchCategoryDraft.productType,
          productSubcategory: batchCategoryDraft.productSubcategory,
          updatedAt: now,
          updatedBy: user?.uid || null,
        },
      }));
      await runBatchedWrites(operations);
      const count = selectedFamilies.length;
      toast.success(`Updated category for ${count} product ${count === 1 ? "family" : "families"}.`);
      setBatchCategoryModalOpen(false);
      clearSelection();
    } catch (error) {
      console.error("[Products] Batch category update failed", error);
      toast.error({
        title: "Update failed",
        description: error?.message || "Unable to update categories.",
      });
    } finally {
      setBatchWorking(false);
    }
  };

  const startRename = useCallback((family) => {
    setRenameState({ id: family.id, value: family.styleName || "", saving: false, error: null });
  }, []);

  const cancelRename = () => setRenameState({ id: null, value: "", saving: false, error: null });

  const submitRename = async () => {
    if (!renameState.id) return;
    if (!renameState.value.trim()) {
      setRenameState((prev) => ({ ...prev, error: "Name cannot be empty." }));
      return;
    }
    setRenameState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await updateDoc(doc(db, ...productFamilyPathForClient(renameState.id)), {
        styleName: renameState.value.trim(),
        updatedAt: Date.now(),
        updatedBy: user?.uid || null,
      });
      cancelRename();
    } catch (err) {
      setRenameState((prev) => ({ ...prev, saving: false, error: err?.message || "Rename failed." }));
    }
  };

  const renderRenameForm = ({ stopPropagation = false, wrapperClassName = "space-y-2" } = {}) => {
    const handleClick = stopPropagation
      ? (event) => {
          event.stopPropagation();
        }
      : undefined;
    const handleKeyDown = stopPropagation
      ? (event) => {
          event.stopPropagation();
        }
      : undefined;

    return (
      <div className={wrapperClassName} onClick={handleClick} onKeyDown={handleKeyDown}>
        <Input
          value={renameState.value}
          onChange={(event) => setRenameState((prev) => ({ ...prev, value: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelRename();
            }
          }}
          autoFocus
        />
        {renameState.error && <div className="text-xs text-red-600">{renameState.error}</div>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={submitRename} disabled={renameState.saving}>
            {renameState.saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelRename}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  const renderFamilyCard = (family) => {
    const inlineEditing = renameState.id === family.id;
    if (resolvedDensityKey === "wide") {
      ensureFamilySkusLoaded(family.id);
    }
    const openFromCard = () => {
      if (!canEdit || inlineEditing) return;
      loadFamilyForEdit(family);
    };
    const { displayImagePath, colourList, coloursLabel, sizeList, sizesLabel } = buildFamilyMeta(
      family
    );
    const showPreview = resolvedFieldVisibility.preview !== false;
    const showStyleName = resolvedFieldVisibility.styleName !== false;
    const showStyleNumber = resolvedFieldVisibility.styleNumber !== false;
    const showGender = resolvedFieldVisibility.gender !== false;
    const showStatus = resolvedFieldVisibility.status !== false;
    const showColors = resolvedFieldVisibility.colors !== false;
    const showSizes = resolvedFieldVisibility.sizes !== false;
    const showLastUpdated = resolvedFieldVisibility.lastUpdated !== false;
    const showCategory = resolvedFieldVisibility.category !== false;
    const densityConfig =
      DENSITY_CONFIG[resolvedDensityKey] || DENSITY_CONFIG[DEFAULT_DENSITY];
    const summaryOrder = resolvedFieldOrder.filter(
      (key) => key === "gender" || key === "colors" || key === "sizes" || key === "lastUpdated"
    );
    const summaryItems = [];
    summaryOrder.forEach((key) => {
      if (key === "gender" && showGender) {
        summaryItems.push({
          key: "gender",
          node: <span className="font-medium">{genderLabel(family.gender)}</span>,
        });
      } else if (key === "colors" && showColors) {
        const count = colourList.length;
        summaryItems.push({
          key: "colors",
          node: (
            <span className="flex items-center gap-1">
              {count} {count === 1 ? "color" : "colors"}
            </span>
          ),
        });
      } else if (key === "sizes" && showSizes && sizeList.length) {
        summaryItems.push({
          key: "sizes",
          node: (
            <span title={sizesLabel || undefined}>
              {sizeList[0]}-{sizeList[sizeList.length - 1]}
            </span>
          ),
        });
      } else if (key === "lastUpdated" && showLastUpdated && family.updatedAt) {
        summaryItems.push({
          key: "lastUpdated",
          node: (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Updated {formatUpdatedAt(family.updatedAt)}
            </span>
          ),
        });
      }
    });
    const isSelected = selectedFamilyIds.has(family.id);
    const isCompactCard = resolvedDensityKey === "compact";
    const cardClasses = `relative flex h-full flex-col overflow-visible ${isSelected ? "ring-2 ring-primary/60" : ""}`.trim();

    const renderCompactCard = () => (
      <Card className={cardClasses}>
        <CardContent
          className={`grid grid-cols-[96px,1fr] gap-3 ${densityConfig.cardPadding}`}
          ref={family.id === menuFamilyId ? menuRef : null}
        >
          {showPreview && (
            <div className="relative row-span-2">
              <div className="h-20 w-20 overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                {displayImagePath ? (
                  <AppImage
                    src={displayImagePath}
                    alt={family.styleName}
                    preferredSize={160}
                    className="h-full w-full"
                    imageClassName="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                    No image
                  </div>
                )}
              </div>
              {canUseBatchActions && selectionModeActive && (
                <div className="absolute -left-2 -top-2">
                  <Checkbox
                    checked={isSelected}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleFamilySelection(family.id, event.target.checked);
                    }}
                    aria-label={`Select ${family.styleName || "product"}`}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              {showStyleName && (
                <h3
                  className="text-sm font-semibold leading-5 text-slate-900 line-clamp-2 dark:text-slate-100"
                  title={family.styleName}
                >
                  {family.styleName}
                </h3>
              )}
              {showStyleNumber && family.styleNumber && (
                <p
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  title={`Style #${family.styleNumber}`}
                >
                  Style #{family.styleNumber}
                </p>
              )}
            </div>
            {(canEdit || canArchive || canDelete) && (
              <div className="relative flex-shrink-0">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuFamilyId((current) => (current === family.id ? null : family.id));
                  }}
                  aria-label={`Open actions for ${family.styleName || "product"}`}
                >
                  ···
                </Button>
                <ProductActionMenu
                  family={family}
                  onEdit={loadFamilyForEdit}
                  onRename={startRename}
                  onToggleStatus={handleStatusToggle}
                  onArchive={handleArchiveToggle}
                  onRestore={handleRestoreFamily}
                  canEdit={canEdit}
                  canArchive={canArchive}
                  canDelete={canDelete}
                  open={menuFamilyId === family.id}
                  onClose={() => setMenuFamilyId(null)}
                />
              </div>
            )}
          </div>

          {!inlineEditing && (
            <>
              {showStatus && (
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={family.status} className="px-2 py-0.5 text-[11px]">
                    {statusLabel(family.status)}
                  </StatusBadge>
                  {family.archived && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      Archived
                    </span>
                  )}
                </div>
              )}
              {summaryItems.length > 0 && (
                <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-slate-600 sm:grid-cols-2 dark:text-slate-400">
                  {summaryItems.map((item) => (
                    <span key={item.key} className="inline-flex items-center gap-1">
                      {item.node}
                    </span>
                  ))}
                </div>
              )}
              {(showColors || showSizes) && (!!colourList.length || !!sizeList.length) && (
                <div className="col-span-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-2 dark:text-slate-400">
                  {showColors && !!colourList.length && (
                    <span title={`Colours: ${coloursLabel}`}>
                      Colours: {colourList.slice(0, 3).join(", ")}
                      {colourList.length > 3 && "…"}
                    </span>
                  )}
                  {showSizes && !!sizeList.length && (
                    <span title={`Sizes: ${sizesLabel}`}>
                      Sizes: {sizeList.slice(0, 4).join(", ")}
                      {sizeList.length > 4 && "…"}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {inlineEditing && (
            <div className="col-span-2">
              {renderRenameForm({ stopPropagation: true, wrapperClassName: "space-y-2" })}
            </div>
          )}
        </CardContent>
      </Card>
    );

    const renderComfyCard = () => (
      <Card
        className={cardClasses}
      >
        <CardContent className={`flex h-full flex-col gap-4 ${densityConfig.cardPadding}`}>
          <div
            className={`relative ${showPreview ? "" : "min-h-[2.5rem]"}`}
            ref={family.id === menuFamilyId ? menuRef : null}
          >
            {canUseBatchActions && selectionModeActive && (
              <div className="absolute left-2 top-2 z-20 rounded-md bg-white/90 px-2 py-1 shadow-sm">
                <Checkbox
                  checked={isSelected}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleFamilySelection(family.id, event.target.checked);
                  }}
                  aria-label={`Select ${family.styleName || "product"}`}
                />
              </div>
            )}
            {showPreview && <FamilyHeaderImage path={displayImagePath} alt={family.styleName} />}
            {(canEdit || canArchive || canDelete) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuFamilyId((current) => (current === family.id ? null : family.id));
                }}
                aria-label={`Open actions for ${family.styleName || 'product'}`}
              >
                ···
              </Button>
            )}
            <ProductActionMenu
              family={family}
              onEdit={loadFamilyForEdit}
              onRename={startRename}
              onToggleStatus={handleStatusToggle}
              onArchive={handleArchiveToggle}
              onRestore={handleRestoreFamily}
              canEdit={canEdit}
              canArchive={canArchive}
              canDelete={canDelete}
              open={menuFamilyId === family.id}
              onClose={() => setMenuFamilyId(null)}
            />
          </div>
          <div className={densityConfig.contentSpacing}>
            {inlineEditing ? (
              renderRenameForm({ stopPropagation: true })
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    {showStyleName && (
                      <h3
                        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                        title={family.styleName}
                        style={twoLineClampStyle}
                      >
                        {family.styleName}
                      </h3>
                    )}
                    {!showStyleName && (
                      <span className="sr-only">{family.styleName}</span>
                    )}
                    {showStyleNumber && family.styleNumber && (
                      <p
                        className="hidden text-base font-semibold text-slate-800 sm:block dark:text-slate-200"
                        title={`Style #${family.styleNumber}`}
                      >
                        Style #{family.styleNumber}
                      </p>
                    )}
                  </div>
                  {showStatus && (
                    <div className="hidden shrink-0 flex-wrap gap-1 sm:flex">
                      <StatusBadge status={family.status}>
                        {statusLabel(family.status)}
                      </StatusBadge>
                      {family.archived && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          Archived
                        </span>
                      )}
                    </div>
                  )}
                  {showStatus && <span className="sr-only">{statusLabel(family.status)}</span>}
                </div>
                {summaryItems.length > 0 && (
                  <div className="hidden flex-wrap items-center gap-2 text-sm text-slate-600 sm:flex dark:text-slate-400">
                    {summaryItems.map((item, index) => (
                      <span key={item.key} className="flex items-center gap-1">
                        {index > 0 && <span aria-hidden="true">•</span>}
                        {item.node}
                      </span>
                    ))}
                  </div>
                )}
                {showColors && !!colourList.length && (
                  <div
                    className="hidden truncate text-xs text-slate-600 md:block dark:text-slate-400"
                    title={`Colours: ${coloursLabel}`}
                  >
                    Colours: {colourList.slice(0, 4).join(", ")}
                    {colourList.length > 4 && "…"}
                  </div>
                )}
                {showSizes && !!sizeList.length && (
                  <div
                    className="hidden truncate text-xs text-slate-600 lg:block dark:text-slate-400"
                    title={`Sizes: ${sizesLabel}`}
                  >
                    Sizes: {sizeList.join(", ")}
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );

    const renderWideCard = () => {
      const skus = familySkus[family.id] || [];
      const selectedSkuId = selectedSkus[family.id];
      const selectedSku = skus.find((sku) => sku.id === selectedSkuId) || skus[0];

      // Determine display image - use selected SKU's image or fallback
      const displayImage = selectedSku?.imagePath || displayImagePath;
      const displayColorName = showColors
        ? selectedSku?.colorName || (colourList.length > 0 ? colourList[0] : null)
        : null;

      // Build category breadcrumb
      const categoryParts = [];
      if (showCategory && family.productType) {
        categoryParts.push(getTypeLabel(family.gender, family.productType));
      }
      if (showCategory && family.productSubcategory) {
        categoryParts.push(getSubcategoryLabel(family.gender, family.productType, family.productSubcategory));
      }
      const categoryBreadcrumb = categoryParts.length ? categoryParts.join(" › ") : "";

      const handleColorSelect = (skuId) => {
        setSelectedSkus((prev) => ({ ...prev, [family.id]: skuId }));
      };

      return (
        <Card className={cardClasses}>
          <CardContent className={`flex h-full flex-col ${densityConfig.cardPadding}`}>
            {/* Top Row: Image + Details side by side */}
            <div className="flex flex-1 gap-3">
              {/* Left: Product Image (reduced size for more text room) */}
              <div className="relative flex-shrink-0">
                <div className="h-[96px] w-[96px] overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                  {displayImage ? (
                    <AppImage
                      src={displayImage}
                      alt={family.styleName}
                      preferredSize={200}
                      className="h-full w-full"
                      imageClassName="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      No image
                    </div>
                  )}
                </div>
                {canUseBatchActions && selectionModeActive && (
                  <div className="absolute -left-2 -top-2">
                    <Checkbox
                      checked={isSelected}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleFamilySelection(family.id, event.target.checked);
                      }}
                      aria-label={`Select ${family.styleName || "product"}`}
                    />
                  </div>
                )}
              </div>

              {/* Right: Product Details */}
              <div className="flex min-w-0 flex-1 flex-col pr-1">
                {/* Header with actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    {inlineEditing ? (
                      renderRenameForm({ stopPropagation: true })
                    ) : (
                      <>
                        {showStyleName && (
                          <h3
                            className="text-base font-semibold leading-tight text-slate-900 dark:text-slate-100"
                            title={family.styleName}
                          >
                            {family.styleName}
                          </h3>
                        )}
                        {showStyleNumber && family.styleNumber && (
                          <p
                            className="text-sm font-medium text-slate-700 dark:text-slate-300"
                            title={`Style #${family.styleNumber}`}
                          >
                            Style #{family.styleNumber}
                          </p>
                        )}
                        {showGender && family.gender && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Gender: {genderLabel(family.gender)}
                          </p>
                        )}
                        {categoryBreadcrumb && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {categoryBreadcrumb}
                          </p>
                        )}
                        {showSizes && sizeList.length > 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400" title={sizesLabel}>
                            Sizes: {sizeList.join(", ")}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status Dot Indicator + Actions Menu */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {showStatus && family.archived && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        Archived
                      </span>
                    )}
                    {(canEdit || canArchive || canDelete) && (
                      <div className="relative pl-3" ref={family.id === menuFamilyId ? menuRef : null}>
                        {showStatus && (
                          <div
                            className={`absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
                              family.status === "discontinued"
                                ? "bg-red-500 dark:bg-red-400"
                                : "bg-green-500 dark:bg-green-400"
                            }`}
                            title={statusLabel(family.status)}
                            aria-label={statusLabel(family.status)}
                          />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuFamilyId((current) => (current === family.id ? null : family.id));
                          }}
                          aria-label={`Open actions for ${family.styleName || "product"}`}
                        >
                          ···
                        </Button>
                        <ProductActionMenu
                          family={family}
                          onEdit={loadFamilyForEdit}
                          onRename={startRename}
                          onToggleStatus={handleStatusToggle}
                          onArchive={handleArchiveToggle}
                          onRestore={handleRestoreFamily}
                          canEdit={canEdit}
                          canArchive={canArchive}
                          canDelete={canDelete}
                          open={menuFamilyId === family.id}
                          onClose={() => setMenuFamilyId(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Color Selector (full width) */}
            {!inlineEditing && skus.length > 0 && showColors && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex flex-col gap-2">
                  <SKUColorSelector
                    skus={skus}
                    currentSkuId={selectedSkuId}
                    onColorSelect={handleColorSelect}
                    size={21}
                    gap={9}
                  />
                  {(displayColorName || (showLastUpdated && family.updatedAt)) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {displayColorName ? `Colour: ${displayColorName}` : ""}
                      </span>
                      {showLastUpdated && family.updatedAt && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Updated {formatUpdatedAt(family.updatedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    };

    if (resolvedDensityKey === 'wide') return renderWideCard();
    return isCompactCard ? renderCompactCard() : renderComfyCard();
  };

  const showStyleNumberColumn = resolvedFieldVisibility.styleNumber;
  const showStatusColumn = resolvedFieldVisibility.status;
  const showSizesColumn = resolvedFieldVisibility.sizes;

  const renderFamilyRow = (family) => {
    const inlineEditing = renameState.id === family.id;
    const {
      displayImagePath,
      colourList,
      coloursLabel,
      sizeList,
      sizesLabel,
    } = buildFamilyMeta(family);
    const handleManageColours = () => {
      if (!canEdit || inlineEditing) return;
      loadFamilyForEdit(family);
    };
    const joinedColours = colourList.slice(0, 4).join(", ");
    const hasMoreColours = colourList.length > 4;
    const joinedSizes = sizeList.slice(0, 6).join(", ");
    const hasMoreSizes = sizeList.length > 6;
    const isSelected = selectedFamilyIds.has(family.id);
    const rowClassName = `odd:bg-white even:bg-slate-50/40 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800 ${
      isSelected ? "bg-primary/5 dark:bg-primary/10" : ""
    }`.trim();

    return (
      <tr key={family.id} className={rowClassName}>
        {canUseBatchActions && selectionModeActive && (
          <td className="px-4 py-3 align-top">
            <Checkbox
              checked={isSelected}
              onChange={(event) => toggleFamilySelection(family.id, event.target.checked)}
              aria-label={`Select ${family.styleName || "product"}`}
            />
          </td>
        )}
        <td className="px-4 py-3 align-top">
          <FamilyHeaderImage
            path={displayImagePath}
            alt={family.styleName}
            className="h-20 w-16"
          />
        </td>
        <td className="min-w-[220px] px-4 py-3 align-top">
          {inlineEditing ? (
            renderRenameForm()
          ) : (
            <div className="space-y-1">
              {canEdit ? (
                <button
                  type="button"
                  onClick={handleManageColours}
                  className="cursor-pointer text-left text-lg font-semibold text-slate-900 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-slate-100"
                  title={family.styleName}
                  data-testid={`style-name-${family.id}`}
                >
                  <span style={twoLineClampStyle}>{family.styleName}</span>
                </button>
              ) : (
                <span
                  className="block text-lg font-semibold text-slate-900 dark:text-slate-100"
                  title={family.styleName}
                  style={twoLineClampStyle}
                  data-testid={`style-name-${family.id}`}
                >
                  {family.styleName}
                </span>
              )}
              <div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span>{genderLabel(family.gender)}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <span>{family.activeSkuCount || 0} active of {family.skuCount || 0} colourways</span>
                </span>
                {family.updatedAt && (
                  <>
                    <span>•</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Updated {formatUpdatedAt(family.updatedAt)}</span>
                  </>
                )}
              </div>
              {!!colourList.length && (
                <div
                  className="text-xs text-slate-500 dark:text-slate-400"
                  title={`Colours: ${coloursLabel}`}
                >
                  Colours: {joinedColours}
                  {hasMoreColours && "…"}
                </div>
              )}
            </div>
          )}
        </td>
        {showStyleNumberColumn && (
          <td className="px-4 py-3 align-top text-base font-semibold text-slate-800 dark:text-slate-200" title={family.styleNumber || undefined}>
            {family.styleNumber || "–"}
          </td>
        )}
        {showStatusColumn && (
          <td className="px-4 py-3 align-top">
            <StatusBadge status={family.status}>
              {statusLabel(family.status)}
            </StatusBadge>
            {family.archived && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Archived</div>
            )}
          </td>
        )}
        {showSizesColumn && (
          <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-400" title={sizesLabel || undefined}>
            {sizeList.length ? (
              <span>
                {joinedSizes}
                {hasMoreSizes && "…"}
              </span>
            ) : (
              "–"
            )}
          </td>
        )}
        <td className="px-4 py-3 align-top text-right">
          <div
            className="ml-auto flex flex-wrap items-center justify-end gap-2"
            ref={family.id === menuFamilyId ? menuRef : null}
          >
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={handleManageColours}>
                Manage colours
              </Button>
            )}
            {(canEdit || canArchive || canDelete) && (
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  onClick={() =>
                    setMenuFamilyId((current) => (current === family.id ? null : family.id))
                  }
                  aria-label={`Open actions for ${family.styleName}`}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
            <ProductActionMenu
              family={family}
              onEdit={loadFamilyForEdit}
              onRename={startRename}
              onToggleStatus={handleStatusToggle}
              onArchive={handleArchiveToggle}
              onRestore={handleRestoreFamily}
              canEdit={canEdit}
              canArchive={canArchive}
              canDelete={canDelete}
              open={menuFamilyId === family.id}
              onClose={() => setMenuFamilyId(null)}
            />
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderListView = () => {
    if (!sortedFamilies.length) {
      // Show EmptyState if truly no products exist, otherwise show filter message
      const hasNoProducts = !loading && families.length === 0 && !showArchived;
      if (hasNoProducts) {
        return (
          <div className="mx-6">
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Create your first product family to get started with Shot Builder."
              action={canEdit ? "Create Product" : null}
              onAction={canEdit ? () => setNewModalOpen(true) : null}
            />
          </div>
        );
      }
      return (
        <Card className="mx-6">
          <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No products match the current filters.
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="mx-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  {canUseBatchActions && selectionModeActive && (
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Select rows</span>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={allVisibleSelected}
                        onChange={handleSelectAllChange}
                        aria-label="Select all visible product families"
                      />
                    </th>
                  )}
                  <th scope="col" className="px-4 py-3">Preview</th>
                  <th scope="col" className="px-4 py-3">Style name</th>
                  {showStyleNumberColumn && (
                    <th scope="col" className="px-4 py-3">Style #</th>
                  )}
                  {showStatusColumn && (
                    <th scope="col" className="px-4 py-3">Status</th>
                  )}
                  {showSizesColumn && (
                    <th scope="col" className="px-4 py-3">Sizes</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {displayedFamilies.map((family) => renderFamilyRow(family))}
              </tbody>
            </table>
          </div>
          {hasMoreItems && (
            <div className="border-t border-slate-200 p-4 text-center dark:border-slate-700">
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Showing {displayedFamilies.length} of {totalCount} products
              </p>
              <Button
                onClick={() => setItemsToShow((prev) => prev + 50)}
                variant="secondary"
                size="sm"
              >
                Load More (50)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGalleryView = () => {
    // Check if we should show EmptyState (truly no products) or filter message
    const hasNoProducts = !loading && families.length === 0 && !showArchived;
    const noMatchingFilters = !loading && !sortedFamilies.length && !hasNoProducts;

    // Get dramatic density configuration
    const densityConfig =
      DENSITY_CONFIG[resolvedDensityKey] || DENSITY_CONFIG[DEFAULT_DENSITY];
    const densityGridClass = densityConfig.gridClass || `grid ${densityConfig.gap} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`;

    return (
      <div className="mx-6 space-y-6">
        {hasNoProducts ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Create your first product family to get started with Shot Builder."
            action={canEdit ? "Create Product" : null}
            onAction={canEdit ? () => setNewModalOpen(true) : null}
          />
        ) : noMatchingFilters ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No products match the current filters.
            </CardContent>
          </Card>
        ) : (
          <>
            <VirtualizedGrid
              items={sortedFamilies}
              itemHeight={densityConfig.itemHeight}
              gap={parseInt(densityConfig.gap.match(/\d+/)[0]) * 4} // Convert gap-2 (8px) to pixels
              threshold={100}
              className={densityGridClass}
              columnBreakpoints={{ default: 1, sm: 2, md: 2, lg: 3, xl: 4, '2xl': 5 }}
              renderItem={(family, index, isVirtualized) => {
                const cardContent = renderFamilyCard(family);

                // Only apply stagger animation when not virtualized
                if (!isVirtualized) {
                  return (
                    <div className="animate-fade-in opacity-0" style={getStaggerDelay(index)}>
                      {cardContent}
                    </div>
                  );
                }

                return cardContent;
              }}
            />
            {canEdit && (
              <div className="mx-6 mt-4">
                <CreateProductCard onClick={() => setNewModalOpen(true)} />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderTableView = () => {
    // Check if we should show EmptyState (truly no products) or filter message
    const hasNoProducts = !loading && families.length === 0 && !showArchived;
    const noMatchingFilters = !loading && !sortedFamilies.length && !hasNoProducts;

    if (hasNoProducts) {
      return (
        <div className="mx-6">
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Create your first product family to get started with Shot Builder."
            action={canEdit ? "Create Product" : null}
            onAction={canEdit ? () => setNewModalOpen(true) : null}
          />
        </div>
      );
    }

    if (noMatchingFilters) {
      return (
        <Card className="mx-6">
          <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No products match the current filters.
          </CardContent>
        </Card>
      );
    }

    // Render action menu for a family
    const renderActionMenu = (family) => {
      return (
        <div className="relative">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => setMenuFamilyId((current) => (current === family.id ? null : family.id))}
            aria-label={`Open actions for ${family.styleName}`}
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
          <ProductActionMenu
            family={family}
            onEdit={loadFamilyForEdit}
            onRename={startRename}
            onToggleStatus={handleStatusToggle}
            onArchive={handleArchiveToggle}
            onRestore={handleRestoreFamily}
            canEdit={canEdit}
            canArchive={canArchive}
            canDelete={canDelete}
            open={menuFamilyId === family.id}
            onClose={() => setMenuFamilyId(null)}
          />
        </div>
      );
    };

    const tableDensity =
      DENSITY_CONFIG[resolvedDensityKey] || DENSITY_CONFIG[DEFAULT_DENSITY];

    return (
      <ProductsTableView
        families={displayedFamilies}
        density={tableDensity}
        visibleFields={resolvedFieldVisibility}
        fieldOrder={resolvedFieldOrder}
        selectionModeActive={selectionModeActive}
        selectedFamilyIds={selectedFamilyIds}
        onToggleSelection={toggleFamilySelection}
        onSelectAll={handleSelectAllChange}
        allVisibleSelected={allVisibleSelected}
        canEdit={canEdit}
        canUseBatchActions={canUseBatchActions}
        user={user}
        clientId={clientId}
        selectAllRef={selectAllRef}
        renderActionMenu={renderActionMenu}
        familySkus={familySkus}
        ensureFamilySkus={ensureFamilySkusLoaded}
      />
    );
  };

  const currentViewMode = normaliseViewMode(viewMode);
  const viewContent = currentViewMode === "table" ? renderTableView() : renderGalleryView();

  return (
    <div className="space-y-6">
      {/* PageHeader with integrated toolbar */}
      <PageHeader sticky={true} className="top-14 z-40">
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Products</PageHeader.Title>
            <PageHeader.Description>
              Manage product families and SKUs across all projects
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            {/* Empty - filters moved below */}
          </PageHeader.Actions>
        </PageHeader.Content>

        {/* Toolbar row - inside PageHeader for sticky behavior */}
        <div className="mx-6 pb-3">
          <Card className="border-b-2">
            <CardContent className="py-4">
              <div className="flex flex-col gap-4">
                {/* Main toolbar row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filter drawer */}
                  <ProductFilterDrawer
                    gender={genderFilter}
                    type={typeFilter}
                    subcategory={subcategoryFilter}
                    showArchived={showArchived}
                    onGenderChange={(g) => {
                      setGenderFilter(g);
                      setTypeFilter("all");
                      setSubcategoryFilter("all");
                    }}
                    onTypeChange={(t) => {
                      setTypeFilter(t);
                      setSubcategoryFilter("all");
                    }}
                    onSubcategoryChange={setSubcategoryFilter}
                    onShowArchivedChange={setShowArchived}
                    onClearAll={() => {
                      setGenderFilter("all");
                      setTypeFilter("all");
                      setSubcategoryFilter("all");
                      setShowArchived(false);
                    }}
                  />

                  {/* Selection mode toggle */}
                  {canUseBatchActions && (
                    <button
                      type="button"
                      onClick={() => setSelectionModeActive(!selectionModeActive)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                        selectionModeActive
                          ? "border-primary/60 bg-primary/5 text-primary dark:bg-primary/10 dark:border-primary/40"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                      aria-pressed={selectionModeActive}
                      title="Toggle selection mode"
                    >
                      <CheckSquare className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Select</span>
                    </button>
                  )}

                  {/* Expandable search */}
                  <ExpandableSearch
                    value={queryText}
                    onChange={setQueryText}
                    placeholder="Search by style, number, colour, or SKU..."
                    ariaLabel="Search products"
                  />

                  {/* Sort menu */}
                  <SortMenu
                    options={SORT_OPTIONS}
                    value={sortOrder}
                    onChange={setSortOrder}
                  />

                  {/* View/Density presets */}
                  <ViewModeMenu
                    options={VIEW_PRESETS}
                    value={currentViewPreset}
                    onChange={handleViewPresetChange}
                    ariaLabel="Select view preset"
                  />

                  <FieldSettingsMenu
                    fields={PRODUCT_FIELD_OPTIONS}
                    visibleMap={resolvedFieldVisibility}
                    lockedKeys={lockedFields}
                    order={resolvedFieldOrder}
                    onToggleVisible={toggleFieldVisibility}
                    onToggleLock={toggleFieldLock}
                    onReorder={handleFieldOrderChange}
                  />

                  {/* Export button */}
                  <ExportButton data={filteredFamilies} entityType="products" />

                  {/* New product button */}
                  {canEdit && (
                    <Button onClick={() => setNewModalOpen(true)} className="flex-none whitespace-nowrap">
                      New product
                    </Button>
                  )}
                </div>

                {/* Filter pills row */}
                {activeFilters.length > 0 && (
                  <div className="flex w-full flex-wrap gap-2">
                    {activeFilters.map((pill) => (
                      <button
                        key={pill.key}
                        type="button"
                        onClick={() => removeFilter(pill.key)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                      >
                        <span>
                          {pill.label}
                          {pill.value ? `: ${pill.value}` : ""}
                        </span>
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageHeader>

      {canUseBatchActions && selectionModeActive && selectedCount > 0 && (
        <div className="mx-6 rounded-card border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm dark:bg-primary/10 dark:border-primary/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {selectedCount} selected
              {sortedFamilies.length > selectedCount
                ? ` of ${sortedFamilies.length} visible`
                : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canArchive && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={handleBatchArchive}
                  disabled={batchWorking || !hasActiveSelected}
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Archive
                </Button>
              )}
              {canArchive && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={handleBatchRestore}
                  disabled={batchWorking || !hasArchivedSelected}
                >
                  <Archive className="h-4 w-4 rotate-180" aria-hidden="true" />
                  Restore
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={openBatchStyleNumberModal}
                  disabled={batchWorking}
                >
                  <Type className="h-4 w-4" aria-hidden="true" />
                  Edit style numbers
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={openBatchCategoryModal}
                  disabled={batchWorking}
                >
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Assign category
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-2"
                  onClick={async () => {
                    // Test-friendly fallback: support native confirm to satisfy existing tests.
                    // If user confirms, run deletion immediately; otherwise open typed-confirm modal.
                    try {
                      const count = selectedFamilies.length;
                      const label = count === 1 ? "family" : "families";
                      const prompt = `Delete ${count} product ${label}? This action cannot be undone.`;
                      const ok = await showConfirm(prompt);
                      if (ok) {
                        await handleBatchDelete();
                      }
                    } catch {}
                    setConfirmBatchDeleteText("");
                    setConfirmBatchDeleteOpen(true);
                  }}
                  disabled={batchWorking}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={batchWorking}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Helper text */}
      <div className="space-y-1 px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing {filteredFamilies.length} of {families.length} product families
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Product families group shared metadata, while SKUs capture individual colour and size combinations. {recommendedImageText}
        </p>
      </div>

      {viewContent}

      <Modal
        open={batchStyleModalOpen}
        onClose={closeBatchStyleModal}
        labelledBy="batch-style-title"
        describedBy="batch-style-description"
        initialFocusRef={batchFirstFieldRef}
        closeOnOverlay={!batchWorking}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="batch-style-title">
              Edit style numbers
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400" id="batch-style-description">
              Update the style numbers for the selected product families. Leave a field blank to clear the value.
            </p>
          </div>
          <form onSubmit={handleBatchStyleSubmit} className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {batchStyleDraft.map((entry, index) => (
                  <div key={entry.id} className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{entry.styleName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Current: {entry.currentStyleNumber || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-7">
                      <Input
                        ref={index === 0 ? batchFirstFieldRef : undefined}
                        value={entry.nextStyleNumber}
                        onChange={(event) =>
                          handleBatchStyleDraftChange(entry.id, event.target.value)
                        }
                        placeholder="Enter new style number"
                      />
                    </div>
                  </div>
                ))}
                {!batchStyleDraft.length && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No products selected. Close this dialog to continue.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={closeBatchStyleModal} disabled={batchWorking}>
                Cancel
              </Button>
              <Button type="submit" disabled={batchWorking || !batchStyleDraft.length}>
                {batchWorking ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Batch Category Assignment Modal */}
      <Modal
        open={batchCategoryModalOpen}
        onClose={closeBatchCategoryModal}
        labelledBy="batch-category-title"
        describedBy="batch-category-description"
        closeOnOverlay={!batchWorking}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="batch-category-title">
              Assign category
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400" id="batch-category-description">
              Set the product type and subcategory for {selectedCount} selected product {selectedCount === 1 ? "family" : "families"}.
              This will update products that share the same gender.
            </p>
          </div>
          <form onSubmit={handleBatchCategorySubmit} className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {/* Type dropdown */}
                <div className="space-y-1.5">
                  <label htmlFor="batch-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Product Type
                  </label>
                  <select
                    id="batch-type"
                    value={batchCategoryDraft.productType || ""}
                    onChange={(e) => handleBatchCategoryDraftChange("productType", e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select type...</option>
                    <option value="tops">Tops</option>
                    <option value="bottoms">Bottoms</option>
                    <option value="accessories">Accessories</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Categories are linked to the product's gender. Valid subcategories depend on the type selected.
                  </p>
                </div>

                {/* Subcategory dropdown */}
                <div className="space-y-1.5">
                  <label htmlFor="batch-subcategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Subcategory
                  </label>
                  <select
                    id="batch-subcategory"
                    value={batchCategoryDraft.productSubcategory || ""}
                    onChange={(e) => handleBatchCategoryDraftChange("productSubcategory", e.target.value)}
                    disabled={!batchCategoryDraft.productType}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select subcategory...</option>
                    {batchCategoryDraft.productType === "tops" && (
                      <>
                        <option value="tshirts">T-Shirts</option>
                        <option value="long-sleeves">Long Sleeves</option>
                        <option value="hoodies-sweaters">Hoodies & Sweaters</option>
                        <option value="knitwear">Knitwear</option>
                        <option value="shirts">Shirts</option>
                        <option value="polos">Polos</option>
                        <option value="tank-tops">Tank Tops</option>
                        <option value="sweaters-sweatshirts">Sweaters & Sweatshirts</option>
                        <option value="dresses-rompers">Dresses & Rompers</option>
                        <option value="jackets">Jackets</option>
                      </>
                    )}
                    {batchCategoryDraft.productType === "bottoms" && (
                      <>
                        <option value="pants">Pants</option>
                        <option value="shorts">Shorts</option>
                        <option value="underwear">Underwear</option>
                        <option value="socks">Socks</option>
                        <option value="underwear-bras">Underwear & Bras</option>
                      </>
                    )}
                    {batchCategoryDraft.productType === "accessories" && (
                      <>
                        <option value="hats">Hats</option>
                        <option value="backpack">Backpack</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={closeBatchCategoryModal} disabled={batchWorking}>
                Cancel
              </Button>
              <Button type="submit" disabled={batchWorking || (!batchCategoryDraft.productType && !batchCategoryDraft.productSubcategory)}>
                {batchWorking ? "Saving…" : "Apply to selected"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        open={confirmBatchDeleteOpen}
        onClose={() => setConfirmBatchDeleteOpen(false)}
        labelledBy="confirm-delete-title"
        describedBy="confirm-delete-description"
        closeOnOverlay={!batchWorking}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" id="confirm-delete-title">
              Confirm deletion
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400" id="confirm-delete-description">
              This will permanently remove {selectedFamilies.length} product {selectedFamilies.length === 1 ? "family" : "families"} and all SKUs and images. Type "DELETE" to confirm.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-between">
            <div className="px-6 py-4">
              <Input
                value={confirmBatchDeleteText}
                onChange={(e) => setConfirmBatchDeleteText(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmBatchDeleteOpen(false)}
                disabled={batchWorking}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (confirmBatchDeleteText.trim() !== "DELETE") return;
                  setConfirmBatchDeleteOpen(false);
                  await handleBatchDelete();
                }}
                disabled={batchWorking || confirmBatchDeleteText.trim() !== "DELETE"}
              >
                {batchWorking ? "Deleting…" : "Permanently delete"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {newModalOpen && (
        <NewProductModal
          open={newModalOpen}
          onClose={() => setNewModalOpen(false)}
          onSubmit={handleCreateFamily}
        />
      )}

      {editModalOpen && editFamily && (
        <EditProductModal
          open={editModalOpen}
          family={editFamily}
          loading={editLoading}
          onClose={closeModals}
          onSubmit={(payload) => handleUpdateFamily(editFamily.id, payload)}
          onDelete={(fam, opts) => handleDeleteFamily(fam ?? editFamily, opts)}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
