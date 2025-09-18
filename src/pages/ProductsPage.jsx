import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import NewProductModal from "../components/products/NewProductModal";
import EditProductModal from "../components/products/EditProductModal";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { useStorageImage } from "../hooks/useStorageImage";
import { LayoutGrid, List as ListIcon, MoreVertical } from "lucide-react";
import {
  productFamiliesPath,
  productFamilyPath,
  productFamilySkuPath,
  productFamilySkusPath,
} from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { ROLE, canArchiveProducts, canDeleteProducts, canEditProducts } from "../lib/rbac";

const genderLabel = (value) => {
  switch ((value || "").toLowerCase()) {
    case "men":
    case "mens":
      return "Men's";
    case "women":
    case "womens":
      return "Women's";
    case "unisex":
      return "Unisex";
    case "other":
      return "Other";
    default:
      return "Unspecified";
  }
};

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

const readStoredViewMode = () => {
  if (typeof window === "undefined") return "gallery";
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "list" ? "list" : "gallery";
};

const readStoredColumns = () => {
  if (typeof window === "undefined") return { ...defaultListColumns };
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
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

const buildSkuAggregates = (skus, familySizes = []) => {
  const skuCodes = new Set();
  const colorNames = new Set();
  const sizes = new Set((familySizes || []).filter(Boolean));
  let activeSkuCount = 0;
  skus.forEach((sku) => {
    if (sku.skuCode) skuCodes.add(sku.skuCode);
    if (sku.colorName) colorNames.add(sku.colorName);
    (sku.sizes || []).forEach((size) => size && sizes.add(size));
    if (sku.status === "active") activeSkuCount += 1;
  });
  return {
    skuCodes: Array.from(skuCodes),
    colorNames: Array.from(colorNames),
    sizeOptions: Array.from(sizes),
    skuCount: skus.length,
    activeSkuCount,
  };
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

function FamilyHeaderImage({ path, alt, className }) {
  const url = useStorageImage(path);
  const containerClass = [
    "overflow-hidden rounded-lg bg-slate-100",
    className || "aspect-[4/5] w-full",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={containerClass}>
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
      )}
    </div>
  );
}

function ProductActionMenu({
  family,
  onEdit,
  onRename,
  onToggleStatus,
  onArchive,
  onDelete,
  canEdit,
  canArchive,
  canDelete,
  open,
  onClose,
}) {
  if (!open) return null;
  return (
    <div
      className="absolute right-0 top-10 z-20 w-48 rounded-md border border-slate-200 bg-white shadow-lg"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
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
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
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
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
          onClick={() => {
            onToggleStatus(family);
            onClose();
          }}
        >
          {family.status === "discontinued" ? "Set active" : "Set discontinued"}
        </button>
      )}
      {canArchive && (
        <button
          type="button"
          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
          onClick={() => {
            onArchive(family);
            onClose();
          }}
        >
          {family.archived ? "Restore from archive" : "Archive"}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          onClick={() => {
            onDelete(family);
            onClose();
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

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

  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [genderFilter, setGenderFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFamily, setEditFamily] = useState(null);
  const [menuFamilyId, setMenuFamilyId] = useState(null);
  const [renameState, setRenameState] = useState({ id: null, value: "", saving: false, error: null });
  const [viewMode, setViewMode] = useState(() => readStoredViewMode());
  const [listColumns, setListColumns] = useState(() => readStoredColumns());
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const menuRef = useRef(null);
  const listSettingsRef = useRef(null);
  const skuCacheRef = useRef(new Map());

  useEffect(() => {
    const familiesQuery = query(collection(db, ...currentProductFamiliesPath), orderBy("styleName", "asc"));
    const unsub = onSnapshot(familiesQuery, (snapshot) => {
      setFamilies(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentProductFamiliesPath]);

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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(listColumns));
  }, [listColumns]);

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

  const filteredFamilies = useMemo(() => {
    const text = queryText.trim().toLowerCase();
    return families.filter((family) => {
      if (!showArchived && family.archived) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && family.status === "discontinued") return false;
        if (statusFilter === "discontinued" && family.status !== "discontinued") return false;
      }
      if (genderFilter !== "all" && (family.gender || "").toLowerCase() !== genderFilter) return false;
      if (!text) return true;
      const fields = [
        family.styleName,
        family.styleNumber,
        family.previousStyleNumber,
        ...(family.skuCodes || []),
        ...(family.colorNames || []),
        ...(family.sizeOptions || []),
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return fields.some((value) => value.includes(text));
    });
  }, [families, queryText, statusFilter, genderFilter, showArchived]);

  const genders = useMemo(() => {
    const set = new Set();
    families.forEach((family) => family.gender && set.add(family.gender.toLowerCase()));
    return Array.from(set);
  }, [families]);

  const closeModals = () => {
    setNewModalOpen(false);
    setEditModalOpen(false);
    setEditFamily(null);
    skuCacheRef.current = new Map();
  };

  const handleCreateFamily = useCallback(
    async (payload) => {
      if (!canEdit) throw new Error("You do not have permission to create products.");
      const now = Date.now();
      const familySizes = Array.isArray(payload.family.sizes) ? payload.family.sizes : [];
      const aggregates = buildSkuAggregates(payload.skus, familySizes);
      const baseData = {
        styleName: payload.family.styleName,
        styleNumber: payload.family.styleNumber,
        previousStyleNumber: payload.family.previousStyleNumber,
        gender: payload.family.gender,
        status: payload.family.status,
        archived: payload.family.archived,
        notes: payload.family.notes,
        headerImagePath: null,
        thumbnailImagePath: null,
        sizes: familySizes,
        skuCount: aggregates.skuCount,
        activeSkuCount: aggregates.activeSkuCount,
        skuCodes: aggregates.skuCodes,
        colorNames: aggregates.colorNames,
        sizeOptions: aggregates.sizeOptions,
        shotIds: [],
        createdAt: now,
        updatedAt: now,
        createdBy: user?.uid || null,
        updatedBy: user?.uid || null,
      };
      const familiesCollection = collection(db, ...currentProductFamiliesPath);
      const familyRef = await addDoc(familiesCollection, baseData);
      const familyId = familyRef.id;

      let thumbnailPath = null;

      if (payload.family.thumbnailImageFile) {
        const { path } = await uploadImageFile(payload.family.thumbnailImageFile, {
          folder: "productFamilies",
          id: `${familyId}/thumbnail`,
        });
        thumbnailPath = path;
        await updateDoc(familyRef, {
          thumbnailImagePath: path,
          updatedAt: Date.now(),
          updatedBy: user?.uid || null,
        });
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
      }

      const skuCollection = collection(db, ...productFamilySkusPathForClient(familyId));
      let fallbackImagePath = null;
      for (const sku of payload.skus) {
        const skuRef = doc(skuCollection);
        let imagePath = sku.imagePath || null;
        if (sku.imageFile) {
          const result = await uploadImageFile(sku.imageFile, {
            folder: `productFamilies/${familyId}/skus`,
            id: skuRef.id,
          });
          imagePath = result.path;
        }
        if (!fallbackImagePath && imagePath && !sku.removeImage) {
          fallbackImagePath = imagePath;
        }
        await setDoc(skuRef, {
          colorName: sku.colorName,
          skuCode: sku.skuCode,
          sizes: sku.sizes,
          status: sku.status,
          archived: sku.archived,
          imagePath,
          createdAt: now,
          updatedAt: now,
          createdBy: user?.uid || null,
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

  const loadFamilyForEdit = useCallback(
    async (family) => {
      setEditLoading(true);
      setEditFamily({ ...family, skus: [] });
      setEditModalOpen(true);
      const skuSnapshot = await getDocs(
        query(collection(db, ...productFamilySkusPathForClient(family.id)), orderBy("colorName", "asc"))
      );
      const skus = skuSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      skuCacheRef.current = new Map(skus.map((sku) => [sku.id, sku]));
      setEditFamily({ ...family, skus });
      setEditLoading(false);
    },
    []
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
            const result = await uploadImageFile(sku.imageFile, {
              folder: `productFamilies/${familyId}/skus`,
              id: sku.id,
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
            const result = await uploadImageFile(sku.imageFile, {
              folder: `productFamilies/${familyId}/skus`,
              id: skuRef.id,
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
        const skuInfo = skuCacheRef.current.get(removedId);
        if (skuInfo?.imagePath) {
          await deleteImageByPath(skuInfo.imagePath).catch(() => {});
        }
        await deleteDoc(doc(db, ...productFamilySkuPathForClient(familyId, removedId)));
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

  const handleArchiveToggle = async (family) => {
    if (!canArchive) return;
    const update = {
      archived: !family.archived,
      updatedAt: Date.now(),
      updatedBy: user?.uid || null,
    };
    await updateDoc(doc(db, ...productFamilyPathForClient(family.id)), update);
  };

  const handleStatusToggle = async (family) => {
    if (!canEdit) return;
    await updateDoc(doc(db, ...productFamilyPathForClient(family.id)), {
      status: family.status === "discontinued" ? "active" : "discontinued",
      updatedAt: Date.now(),
      updatedBy: user?.uid || null,
    });
  };

  const handleDeleteFamily = async (family) => {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Delete ${family.styleName}? This permanently removes the family and all SKUs.`
    );
    if (!confirmed) return;

    const skuSnapshot = await getDocs(collection(db, ...productFamilySkusPathForClient(family.id)));
    for (const docSnap of skuSnapshot.docs) {
      const data = docSnap.data();
      if (data.imagePath) {
        await deleteImageByPath(data.imagePath).catch(() => {});
      }
      await deleteDoc(doc(db, ...productFamilySkuPathForClient(family.id, docSnap.id)));
    }
    if (family.headerImagePath) {
      await deleteImageByPath(family.headerImagePath).catch(() => {});
    }
    if (family.thumbnailImagePath) {
      await deleteImageByPath(family.thumbnailImagePath).catch(() => {});
    }
    await deleteDoc(doc(db, ...productFamilyPathForClient(family.id)));
  };

  const startRename = (family) => {
    setRenameState({ id: family.id, value: family.styleName || "", saving: false, error: null });
  };

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

    return (
      <Card
        key={family.id}
        className={`relative flex h-full flex-col overflow-visible ${
          canEdit ? "cursor-pointer" : ""
        }`.trim()}
        onClick={openFromCard}
      >
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="relative" ref={family.id === menuFamilyId ? menuRef : null}>
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
              onDelete={handleDeleteFamily}
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
                      className="text-base font-semibold text-slate-800"
                      title={family.styleName}
                      style={twoLineClampStyle}
                    >
                      {family.styleName}
                    </h3>
                    {family.styleNumber && (
                      <p
                        className="hidden text-sm text-slate-600 sm:block"
                        title={`Style #${family.styleNumber}`}
                      >
                        Style #{family.styleNumber}
                      </p>
                    )}
                  </div>
                  <div className="hidden shrink-0 flex-wrap gap-1 sm:flex">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(family.status)}`}
                    >
                      {statusLabel(family.status)}
                    </span>
                    {family.archived && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                        Archived
                      </span>
                    )}
                  </div>
                  <span className="sr-only">{statusLabel(family.status)}</span>
                </div>
                <div className="hidden flex-wrap gap-2 text-xs text-slate-500 sm:flex">
                  <span>{genderLabel(family.gender)}</span>
                  <span>•</span>
                  <span>
                    {family.activeSkuCount || 0} active of {family.skuCount || 0} colourways
                  </span>
                  {family.updatedAt && (
                    <>
                      <span>•</span>
                      <span>Updated {formatUpdatedAt(family.updatedAt)}</span>
                    </>
                  )}
                </div>
                {!!colourList.length && (
                  <div
                    className="hidden truncate text-xs text-slate-600 md:block"
                    title={`Colours: ${coloursLabel}`}
                  >
                    Colours: {colourList.slice(0, 4).join(", ")}
                    {colourList.length > 4 && "…"}
                  </div>
                )}
                {!!sizeList.length && (
                  <div
                    className="hidden truncate text-xs text-slate-600 lg:block"
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

    return (
      <tr key={family.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-slate-100">
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
                  className="cursor-pointer text-left text-base font-semibold text-slate-800 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  title={family.styleName}
                >
                  <span style={twoLineClampStyle}>{family.styleName}</span>
                </button>
              ) : (
                <span className="block text-base font-semibold text-slate-800" title={family.styleName} style={twoLineClampStyle}>
                  {family.styleName}
                </span>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{genderLabel(family.gender)}</span>
                <span>•</span>
                <span>
                  {family.activeSkuCount || 0} active of {family.skuCount || 0} colourways
                </span>
                {family.updatedAt && (
                  <>
                    <span>•</span>
                    <span>Updated {formatUpdatedAt(family.updatedAt)}</span>
                  </>
                )}
              </div>
              {!!colourList.length && (
                <div
                  className="text-xs text-slate-500"
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
          <td className="px-4 py-3 align-top text-sm text-slate-600" title={family.styleNumber || undefined}>
            {family.styleNumber || "–"}
          </td>
        )}
        {showStatusColumn && (
          <td className="px-4 py-3 align-top">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(
                family.status
              )}`}
            >
              {statusLabel(family.status)}
            </span>
            {family.archived && (
              <div className="mt-2 text-xs text-slate-500">Archived</div>
            )}
          </td>
        )}
        {showSizesColumn && (
          <td className="px-4 py-3 align-top text-sm text-slate-600" title={sizesLabel || undefined}>
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
                  className="text-slate-600 hover:text-slate-900"
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
                  onDelete={handleDeleteFamily}
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
    if (!filteredFamilies.length) {
      return (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">
            No products match the current filters.
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
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
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredFamilies.map((family) => renderFamilyRow(family))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGalleryView = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {canEdit && (
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600 transition hover:border-primary hover:text-primary"
        >
          <span className="text-2xl">＋</span>
          <span>Create product</span>
        </button>
      )}
      {filteredFamilies.map((family) => renderFamilyCard(family))}
      {!loading && !filteredFamilies.length && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">
            No products match the current filters.
          </CardContent>
        </Card>
      )}
    </div>
  );

  const viewContent = viewMode === "list" ? renderListView() : renderGalleryView();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-600">
            Product families group shared metadata, while SKUs capture individual colour and size combinations.
          </p>
          <p className="text-xs text-slate-500">{recommendedImageText}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setNewModalOpen(true)}>New product</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Input
                placeholder="Search by style, number, colour or SKU…"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                className="lg:max-w-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="discontinued">Discontinued</option>
                  <option value="all">All statuses</option>
                </select>
                <select
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
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
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                  />
                  Show archived
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  View
                </span>
                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("gallery")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                      viewMode === "gallery"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
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
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-pressed={viewMode === "list"}
                  >
                    <ListIcon className="h-4 w-4" aria-hidden="true" />
                    List
                  </button>
                </div>
              </div>
              {viewMode === "list" && (
                <div className="relative" ref={listSettingsRef}>
                  <button
                    type="button"
                    onClick={() => setListSettingsOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                    aria-haspopup="menu"
                    aria-expanded={listSettingsOpen}
                    aria-label="Toggle list columns"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {listSettingsOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                      <p className="px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        List columns
                      </p>
                      <label className="mt-2 flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
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
                      <label className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
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
                      <label className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
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
          <div className="text-xs text-slate-500">
            Showing {filteredFamilies.length} of {families.length} product families
          </div>
        </CardHeader>
      </Card>

      {viewContent}

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
          onDelete={() => handleDeleteFamily(editFamily)}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
