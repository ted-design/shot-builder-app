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
import { db, deleteImageByPath, uploadImageFile } from "../firebase";
import { useStorageImage } from "../hooks/useStorageImage";
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

function FamilyHeaderImage({ path, alt }) {
  const url = useStorageImage(path);
  return (
    <div className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100">
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
  const { role: globalRole, user } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canEdit = canEditProducts(role);
  const canArchive = canArchiveProducts(role);
  const canDelete = canDeleteProducts(role);

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
  const menuRef = useRef(null);
  const skuCacheRef = useRef(new Map());

  useEffect(() => {
    const familiesQuery = query(collection(db, ...productFamiliesPath), orderBy("styleName", "asc"));
    const unsub = onSnapshot(familiesQuery, (snapshot) => {
      setFamilies(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
      const familiesCollection = collection(db, ...productFamiliesPath);
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

      const skuCollection = collection(db, ...productFamilySkusPath(familyId));
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
      const skuSnapshot = await getDocs(query(collection(db, ...productFamilySkusPath(family.id)), orderBy("colorName", "asc")));
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
      const familyRef = doc(db, ...productFamilyPath(familyId));
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
          const skuRef = doc(db, ...productFamilySkuPath(familyId, sku.id));
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
          const skuCollection = collection(db, ...productFamilySkusPath(familyId));
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
        await deleteDoc(doc(db, ...productFamilySkuPath(familyId, removedId)));
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
    await updateDoc(doc(db, ...productFamilyPath(family.id)), update);
  };

  const handleStatusToggle = async (family) => {
    if (!canEdit) return;
    await updateDoc(doc(db, ...productFamilyPath(family.id)), {
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

    const skuSnapshot = await getDocs(collection(db, ...productFamilySkusPath(family.id)));
    for (const docSnap of skuSnapshot.docs) {
      const data = docSnap.data();
      if (data.imagePath) {
        await deleteImageByPath(data.imagePath).catch(() => {});
      }
      await deleteDoc(doc(db, ...productFamilySkuPath(family.id, docSnap.id)));
    }
    if (family.headerImagePath) {
      await deleteImageByPath(family.headerImagePath).catch(() => {});
    }
    if (family.thumbnailImagePath) {
      await deleteImageByPath(family.thumbnailImagePath).catch(() => {});
    }
    await deleteDoc(doc(db, ...productFamilyPath(family.id)));
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
      await updateDoc(doc(db, ...productFamilyPath(renameState.id)), {
        styleName: renameState.value.trim(),
        updatedAt: Date.now(),
        updatedBy: user?.uid || null,
      });
      cancelRename();
    } catch (err) {
      setRenameState((prev) => ({ ...prev, saving: false, error: err?.message || "Rename failed." }));
    }
  };

  const renderFamilyCard = (family) => {
    const inlineEditing = renameState.id === family.id;
    const openFromCard = () => {
      if (!canEdit || inlineEditing) return;
      loadFamilyForEdit(family);
    };
    const displayImagePath = family.thumbnailImagePath || family.headerImagePath;
    const colourList = family.colorNames || [];
    const sizeList = family.sizeOptions || [];
    const coloursLabel = colourList.join(", ");
    const sizesLabel = sizeList.join(", ");

    return (
      <Card
        key={family.id}
        className={`relative overflow-visible ${canEdit ? "cursor-pointer" : ""}`.trim()}
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
              <div
                className="space-y-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Input
                  value={renameState.value}
                  onChange={(event) =>
                    setRenameState((prev) => ({ ...prev, value: event.target.value }))
                  }
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
                {renameState.error && (
                  <div className="text-xs text-red-600">{renameState.error}</div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={submitRename} disabled={renameState.saving}>
                    {renameState.saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelRename}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <h3
                      className="truncate text-base font-semibold text-slate-800"
                      title={family.styleName}
                    >
                      {family.styleName}
                    </h3>
                    {family.styleNumber && (
                      <p
                        className="hidden sm:block truncate text-sm text-slate-600"
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Search by style, number, colour or SKU…"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              className="md:max-w-sm"
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
          <div className="text-xs text-slate-500">
            Showing {filteredFamilies.length} of {families.length} product families
          </div>
        </CardHeader>
      </Card>

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
