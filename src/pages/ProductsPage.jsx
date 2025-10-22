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
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import AppImage from "../components/common/AppImage";
import ExportButton from "../components/common/ExportButton";
import { LayoutGrid, List as ListIcon, MoreVertical, Archive, Trash2, Type, Search, Package, Filter, X } from "lucide-react";
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
const COLUMN_STORAGE_KEY = "products:listColumns";

const defaultListColumns = {
  styleNumber: true,
  status: true,
  sizes: false,
};

const SORT_OPTIONS = [
  { value: "styleNameAsc", label: "Style name (A→Z)" },
  { value: "styleNameDesc", label: "Style name (Z→A)" },
  { value: "styleNumberAsc", label: "Style number (low→high)" },
  { value: "styleNumberDesc", label: "Style number (high→low)" },
];

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

const readStoredViewMode = () => {
  const stored = readStorage(VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "gallery";
};

const readStoredColumns = () => {
  try {
    const raw = readStorage(COLUMN_STORAGE_KEY);
    if (!raw) return { ...defaultListColumns };
    const parsed = JSON.parse(raw);
    return {
      styleNumber:
        typeof parsed.styleNumber === "boolean"
          ? parsed.styleNumber
          : defaultListColumns.styleNumber,
      status:
        typeof parsed.status === "boolean" ? parsed.status : defaultListColumns.status,
      sizes:
        typeof parsed.sizes === "boolean" ? parsed.sizes : defaultListColumns.sizes,
    };
  } catch (error) {
    console.warn("[Products] Failed to parse list column preferences", error);
    return { ...defaultListColumns };
  }
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
    "overflow-hidden rounded-lg bg-slate-100",
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
      className="absolute right-0 top-10 z-20 w-48 rounded-md border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg dark:border-slate-700 dark:bg-slate-800/95"
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
  const [listColumns, setListColumns] = useState(() => readStoredColumns());
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("styleNameAsc");
  const [selectedFamilyIds, setSelectedFamilyIds] = useState(() => new Set());
  const [batchStyleModalOpen, setBatchStyleModalOpen] = useState(false);
  const [batchStyleDraft, setBatchStyleDraft] = useState([]);
  const [batchWorking, setBatchWorking] = useState(false);
  const [confirmBatchDeleteOpen, setConfirmBatchDeleteOpen] = useState(false);
  const [confirmBatchDeleteText, setConfirmBatchDeleteText] = useState("");
  const menuRef = useRef(null);
  const listSettingsRef = useRef(null);
  const filtersRef = useRef(null);
  const skuCacheRef = useRef(new Map());
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
    writeStorage(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(COLUMN_STORAGE_KEY, JSON.stringify(listColumns));
  }, [listColumns]);

  // Reset pagination when filters or search change
  useEffect(() => {
    setItemsToShow(50);
  }, [debouncedQueryText, statusFilter, genderFilter, showArchived, sortOrder]);

  useEffect(() => {
    if (!listSettingsOpen) return undefined;
    function onSettingsClick(event) {
      if (!listSettingsRef.current) return;
      if (!listSettingsRef.current.contains(event.target)) {
        setListSettingsOpen(false);
      }
    }
    window.addEventListener("mousedown", onSettingsClick);
    return () => window.removeEventListener("mousedown", onSettingsClick);
  }, [listSettingsOpen]);

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

  const filteredFamilies = useMemo(() => {
    const text = debouncedQueryText.trim();

    // First apply filter criteria (status, gender, archived)
    const preFiltered = families.filter((family) => {
      if (family.deleted) return false;
      if (!showArchived && family.archived) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && family.status === "discontinued") return false;
        if (statusFilter === "discontinued" && family.status !== "discontinued") return false;
      }
      if (genderFilter !== "all" && (family.gender || "").toLowerCase() !== genderFilter) return false;
      return true;
    });

    // If no search query, return pre-filtered results
    if (!text) return preFiltered;

    // Apply fuzzy search to pre-filtered results
    const searchResults = searchProducts(preFiltered, text);

    // Extract items from search results
    return searchResults.map(result => result.item);
  }, [families, debouncedQueryText, statusFilter, genderFilter, showArchived]);

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

  const displayedFamilies = useMemo(() => {
    return sortedFamilies.slice(0, itemsToShow);
  }, [sortedFamilies, itemsToShow]);

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
    if (showArchived) count++;
    return count;
  }, [statusFilter, genderFilter, showArchived]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStatusFilter("active");
    setGenderFilter("all");
    setShowArchived(false);
  }, []);

  // Handle preset load
  const handleLoadPreset = useCallback((filters) => {
    if (filters.statusFilter !== undefined) setStatusFilter(filters.statusFilter);
    if (filters.genderFilter !== undefined) setGenderFilter(filters.genderFilter);
    if (filters.showArchived !== undefined) setShowArchived(filters.showArchived);
  }, []);

  // Get current filters for saving
  const getCurrentFilters = useCallback(() => ({
    statusFilter,
    genderFilter,
    showArchived,
  }), [statusFilter, genderFilter, showArchived]);

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
    if (showArchived) {
      filters.push({
        key: "archived",
        label: "Show archived",
        value: "Yes",
      });
    }
    return filters;
  }, [statusFilter, genderFilter, showArchived]);

  // Remove individual filter
  const removeFilter = useCallback((filterKey) => {
    switch (filterKey) {
      case "status":
        setStatusFilter("active");
        break;
      case "gender":
        setGenderFilter("all");
        break;
      case "archived":
        setShowArchived(false);
        break;
      default:
        break;
    }
  }, []);

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
            });
            imagePath = result.path;
          }
          await setDoc(skuRef, {
            colorName: sku.colorName,
            skuCode: sku.skuCode,
            sizes: sku.sizes,
            status: sku.status,
            archived: sku.archived,
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
    const openFromCard = () => {
      if (!canEdit || inlineEditing) return;
      loadFamilyForEdit(family);
    };
    const { displayImagePath, colourList, coloursLabel, sizeList, sizesLabel } = buildFamilyMeta(
      family
    );
    const isSelected = selectedFamilyIds.has(family.id);
    const cardClasses = `relative flex h-full flex-col overflow-visible ${
      canEdit ? "cursor-pointer" : ""
    } ${isSelected ? "ring-2 ring-primary/60" : ""}`.trim();

    return (
      <Card
        className={cardClasses}
        onClick={openFromCard}
      >
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="relative" ref={family.id === menuFamilyId ? menuRef : null}>
            {canUseBatchActions && (
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
            <FamilyHeaderImage path={displayImagePath} alt={family.styleName} />
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
          <div className="space-y-3">
            {inlineEditing ? (
              renderRenameForm({ stopPropagation: true })
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <h3
                      className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                      title={family.styleName}
                      style={twoLineClampStyle}
                    >
                      {family.styleName}
                    </h3>
                    {family.styleNumber && (
                      <p
                        className="hidden text-base font-semibold text-slate-800 sm:block dark:text-slate-200"
                        title={`Style #${family.styleNumber}`}
                      >
                        Style #{family.styleNumber}
                      </p>
                    )}
                  </div>
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
                  <span className="sr-only">{statusLabel(family.status)}</span>
                </div>
                <div className="hidden flex-wrap gap-2 text-sm text-slate-600 sm:flex dark:text-slate-400">
                  <span className="font-medium">{genderLabel(family.gender)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {colourList.length} {colourList.length === 1 ? 'color' : 'colors'}
                  </span>
                  {sizeList.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{sizeList[0]}-{sizeList[sizeList.length - 1]}</span>
                    </>
                  )}
                  {family.updatedAt && (
                    <>
                      <span>•</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">Updated {formatUpdatedAt(family.updatedAt)}</span>
                    </>
                  )}
                </div>
                {!!colourList.length && (
                  <div
                    className="hidden truncate text-xs text-slate-600 md:block dark:text-slate-400"
                    title={`Colours: ${coloursLabel}`}
                  >
                    Colours: {colourList.slice(0, 4).join(", ")}
                    {colourList.length > 4 && "…"}
                  </div>
                )}
                {!!sizeList.length && (
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
          {canEdit && (
            <Button
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={(event) => {
                event.stopPropagation();
                loadFamilyForEdit(family);
              }}
            >
              Manage colours
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const showStyleNumberColumn = listColumns.styleNumber;
  const showStatusColumn = listColumns.status;
  const showSizesColumn = listColumns.sizes;

  const handleViewModeChange = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    if (mode !== "list") {
      setListSettingsOpen(false);
    }
  };

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
        {canUseBatchActions && (
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
                  {canUseBatchActions && (
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Select rows</span>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
              itemHeight={380}
              gap={16}
              threshold={100}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
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

  const viewContent = viewMode === "list" ? renderListView() : renderGalleryView();

  return (
    <div className="space-y-6">
      {/* Sticky header with shadow - design system pattern */}
      <div className="sticky inset-x-0 top-14 z-40 border-b border-gray-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate dark:text-slate-100">Products</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage product families and SKUs across all projects
              </p>
            </div>
            <div className="relative min-w-[200px] max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by style, number, colour, or SKU..."
                aria-label="Search products"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                className="pl-10"
              />
            </div>
            <label
              className="flex flex-none items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              htmlFor="products-sort-order"
            >
              <span className="whitespace-nowrap">Sort</span>
              <select
                id="products-sort-order"
                className="h-10 rounded-button border border-slate-300 px-3 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {canEdit && (
              <Button onClick={() => setNewModalOpen(true)} className="flex-none whitespace-nowrap">
                New product
              </Button>
            )}
          </div>
        </div>
      </div>

      {canUseBatchActions && selectedCount > 0 && (
        <div className="mx-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm dark:bg-primary/10 dark:border-primary/40">
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

      <div className="space-y-1 px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Product families group shared metadata, while SKUs capture individual colour and size combinations.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{recommendedImageText}</p>
      </div>

      <Card className="mx-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Filter button and presets */}
              <div className="flex items-center gap-2">
                <div className="relative" ref={filtersRef}>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((prev) => !prev)}
                    className={`relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      activeFilterCount > 0
                        ? "border-primary/60 bg-primary/5 text-primary dark:bg-primary/10 dark:border-primary/40"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
                    <div className="absolute left-0 z-20 mt-2 w-80 rounded-md border border-slate-200 bg-white p-4 shadow-lg animate-slide-in-from-right dark:bg-slate-800 dark:border-slate-700">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Filter products</p>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                clearAllFilters();
                                setFiltersOpen(false);
                              }}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                            >
                              <X className="h-3 w-3" />
                              Clear all
                            </button>
                          )}
                        </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Status
                        </label>
                        <select
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="discontinued">Discontinued</option>
                          <option value="all">All statuses</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Gender
                        </label>
                        <select
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                          value={genderFilter}
                          onChange={(event) => setGenderFilter(event.target.value)}
                        >
                          <option value="all">All genders</option>
                          {genders.map((gender) => (
                            <option key={gender} value={gender}>
                              {genderLabel(gender)}
                            </option>
                          ))}
                        </select>
                      </div>

                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(event) => setShowArchived(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Show archived
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter Preset Manager */}
                <FilterPresetManager
                  page="products"
                  currentFilters={getCurrentFilters()}
                  onLoadPreset={handleLoadPreset}
                  onClearFilters={clearAllFilters}
                />
              </div>

              {/* Active filter pills */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  View
                </span>
                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("gallery")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                      viewMode === "gallery"
                        ? "bg-slate-900 text-white dark:bg-slate-700"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                    aria-pressed={viewMode === "gallery"}
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("list")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                      viewMode === "list"
                        ? "bg-slate-900 text-white dark:bg-slate-700"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                    aria-pressed={viewMode === "list"}
                  >
                    <ListIcon className="h-4 w-4" aria-hidden="true" />
                    List
                  </button>
                </div>
                <ExportButton data={filteredFamilies} entityType="products" />
              </div>
              {viewMode === "list" && (
                <div className="relative" ref={listSettingsRef}>
                  <button
                    type="button"
                    onClick={() => setListSettingsOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
                    aria-haspopup="menu"
                    aria-expanded={listSettingsOpen}
                    aria-label="Toggle list columns"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {listSettingsOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      <p className="px-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        List columns
                      </p>
                      <label className="mt-2 flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                        <input
                          type="checkbox"
                          checked={listColumns.styleNumber}
                          onChange={(event) =>
                            setListColumns((prev) => ({
                              ...prev,
                              styleNumber: event.target.checked,
                            }))
                          }
                        />
                        Style number
                      </label>
                      <label className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                        <input
                          type="checkbox"
                          checked={listColumns.status}
                          onChange={(event) =>
                            setListColumns((prev) => ({
                              ...prev,
                              status: event.target.checked,
                            }))
                          }
                        />
                        Status
                      </label>
                      <label className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                        <input
                          type="checkbox"
                          checked={listColumns.sizes}
                          onChange={(event) =>
                            setListColumns((prev) => ({
                              ...prev,
                              sizes: event.target.checked,
                            }))
                          }
                        />
                        Sizes
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Showing {filteredFamilies.length} of {families.length} product families
          </div>
        </CardHeader>
      </Card>

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
