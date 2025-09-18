// src/pages/ShotsPage.jsx (global shots version)
//
// This version centralises all shots into a single collection at
// `clients/{clientId}/shots` and adds a `projectId` field to each shot
// document.  When fetching shots we filter on the active project ID using
// a `where('projectId', '==', projectId)` clause.  This makes it easy to
// reassign shots to other projects—simply update the `projectId` field.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  getActiveProjectId,
  shotsPath as getShotsPath,
  productFamiliesPath,
  productFamilyPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import ShotProductsEditor from "../components/shots/ShotProductsEditor";
import { useAuth } from "../context/AuthContext";
import { canManageShots, ROLE } from "../lib/rbac";

export default function ShotsPage() {
  const [shots, setShots] = useState([]);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    type: "",
    date: "",
    locationId: "",
    products: [],
    talentIds: [],
  });
  const [families, setFamilies] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const projectId = getActiveProjectId();
  const { role: globalRole } = useAuth();
  const userRole = globalRole || ROLE.VIEWER;
  const canEditShots = canManageShots(userRole);

  const familyDetailCacheRef = useRef(new Map());
  const [editingShotProducts, setEditingShotProducts] = useState(null);

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
        if (item?.familyId) ids.add(item.familyId);
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
        updateDoc(docRef(...productFamilyPath(id)), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsP.map((id) =>
        updateDoc(docRef(...productFamilyPath(id)), { shotIds: arrayRemove(shotId) }).catch(
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
        updateDoc(docRef(...talentPath, id), { shotIds: arrayUnion(shotId) }).catch(() => {})
      )
    );
    await Promise.all(
      remsT.map((id) =>
        updateDoc(docRef(...talentPath, id), { shotIds: arrayRemove(shotId) }).catch(() => {})
      )
    );
    // Location
    const prevL = before.locationId || null;
    const nextL = after.locationId || null;
    if (prevL && prevL !== nextL) {
      await updateDoc(docRef(...locationsPath, prevL), { shotIds: arrayRemove(shotId) }).catch(
        () => {}
      );
    }
    if (nextL && prevL !== nextL) {
      await updateDoc(docRef(...locationsPath, nextL), { shotIds: arrayUnion(shotId) }).catch(
        () => {}
      );
    }
  }

  const generateProductId = () => Math.random().toString(36).slice(2, 10);

  const computeProductIds = (products) => {
    const set = new Set();
    (products || []).forEach((product) => {
      if (product?.familyId) set.add(product.familyId);
    });
    return Array.from(set);
  };

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
        return shot.products.map((product) => withDerivedProductFields(product));
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

  const loadFamilyDetails = useCallback(
    async (familyId) => {
      if (familyDetailCacheRef.current.has(familyId)) {
        return familyDetailCacheRef.current.get(familyId);
      }
      const snapshot = await getDocs(
        query(collection(db, ...productFamilySkusPath(familyId)), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const details = {
        colours,
        sizes: families.find((family) => family.id === familyId)?.sizes || [],
      };
      familyDetailCacheRef.current.set(familyId, details);
      return details;
    },
    [families]
  );

  // Subscribe to collections.  We listen to the global shots collection but
  // filter on projectId so that switching projects automatically updates
  // the list without reloading.  Products, talent and locations remain
  // unfiltered because they are global resources.
  useEffect(() => {
    const shotsQuery = query(
      collRef(...getShotsPath()),
      where("projectId", "==", projectId),
      orderBy("date", "asc")
    );
    const unsubShots = onSnapshot(shotsQuery, (snapshot) => {
      setShots(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubFamilies = onSnapshot(
      query(collRef(...productFamiliesPath), orderBy("styleName", "asc")),
      (snapshot) => {
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubTalent = onSnapshot(
      query(collRef(...talentPath), orderBy("name", "asc")),
      (snapshot) => {
        setTalent(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubLocations = onSnapshot(
      query(collRef(...locationsPath), orderBy("name", "asc")),
      (snapshot) => {
        setLocations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    return () => {
      unsubShots();
      unsubFamilies();
      unsubTalent();
      unsubLocations();
    };
  }, [projectId]);

  // Create a new shot.  We record projectId explicitly so that cross‑project
  // queries can filter on it.  Other fields default to sensible values.
  const createShot = async () => {
    if (!canEditShots) {
      alert("You do not have permission to create shots.");
      return;
    }
    if (!draft.name) return;
    const productIds = computeProductIds(draft.products);
    const docRefSnap = await addDoc(collRef(...getShotsPath()), {
      ...draft,
      projectId: projectId,
      products: draft.products || [],
      productIds,
      talentIds: draft.talentIds || [],
      locationId: draft.locationId || null,
      createdAt: Date.now(),
    });
    await updateReverseIndexes({
      shotId: docRefSnap.id,
      before: { productIds: [], products: [], talentIds: [], locationId: null },
      after: {
        productIds,
        products: draft.products,
        talentIds: draft.talentIds,
        locationId: draft.locationId,
      },
    });
    setDraft({
      name: "",
      description: "",
      type: "",
      date: "",
      locationId: "",
      products: [],
      talentIds: [],
    });
  };

  // Update an existing shot.  We compute before/after arrays for reverse
  // indexing and only update fields that have changed.  Note: If you allow
  // editing the project assignment in the future, updating the `projectId`
  // here will effectively reassign the shot.
  const updateShot = async (shot, patch) => {
    if (!canEditShots) return;
    const before = {
      productIds: shot.productIds || computeProductIds(shot.products),
      products: shot.products || [],
      talentIds: shot.talentIds || [],
      locationId: shot.locationId || null,
    };
    const docPatch = { ...patch };
    if (patch.products != null) {
      docPatch.productIds = computeProductIds(patch.products);
    }
    const after = {
      productIds: docPatch.productIds ?? before.productIds,
      products: docPatch.products ?? before.products,
      talentIds: docPatch.talentIds ?? before.talentIds,
      locationId: docPatch.locationId ?? before.locationId,
    };
    await updateDoc(docRef(...getShotsPath(), shot.id), docPatch);
    await updateReverseIndexes({ shotId: shot.id, before, after });
  };

  // Delete a shot.  We remove it from all reverse indexes before deleting
  // the document itself.
  const removeShot = async (shot) => {
    if (!canEditShots) return;
    await updateReverseIndexes({
      shotId: shot.id,
      before: {
        productIds: shot.productIds || computeProductIds(shot.products),
        products: shot.products || [],
        talentIds: shot.talentIds || [],
        locationId: shot.locationId || null,
      },
      after: { productIds: [], products: [], talentIds: [], locationId: null },
    });
    await deleteDoc(docRef(...getShotsPath(), shot.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Shots</h1>
        <p className="text-sm text-slate-600">
          Build and manage the shot list for the active project. Set the active project from the Dashboard.
        </p>
      </div>
      {/* Form to create a new shot */}
      {canEditShots ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create New Shot</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <Input
                placeholder="Type"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              />
              <Input
                placeholder="Date (YYYY-MM-DD)"
                value={draft.date}
                type="date"
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            {/* Location select */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select
                className="w-full border rounded p-2"
                value={draft.locationId}
                onChange={(e) => setDraft({ ...draft, locationId: e.target.value || "" })}
              >
                <option value="">(none)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Products</label>
              <ShotProductsEditor
                value={draft.products}
                onChange={(next) => setDraft((prev) => ({ ...prev, products: next }))}
                families={families}
                loadFamilyDetails={loadFamilyDetails}
                createProduct={buildShotProduct}
                emptyHint="No products selected"
              />
            </div>
            {/* Talent select */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Talent (hold Ctrl/Cmd to multi-select)
              </label>
              <select
                className="w-full border rounded p-2"
                multiple
                value={draft.talentIds}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    talentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                  })
                }
              >
                {talent.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={createShot}>Add Shot</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You can browse shots but need producer or crew access to create or edit them.
        </div>
      )}
      {/* List of existing shots */}
      <div className="space-y-4">
        {shots.map((s) => {
          const shotProducts = normaliseShotProducts(s);
          return (
            <Card key={s.id} className="border p-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">{s.name}</h3>
                <div className="space-x-2">
                  {canEditShots && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const newName = prompt("New name", s.name) || s.name;
                        if (newName !== s.name) updateShot(s, { name: newName });
                      }}
                    >
                      Rename
                    </Button>
                  )}
                  {canEditShots && (
                    <Button size="sm" variant="destructive" onClick={() => removeShot(s)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>{s.description || "–"}</p>
              {/* Inline editors for type and date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1">Type</label>
                  <input
                    className="w-full border rounded p-2"
                    type="text"
                    value={s.type || ""}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { type: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Date</label>
                  <input
                    className="w-full border rounded p-2"
                    type="date"
                    value={s.date || ""}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { date: e.target.value })}
                  />
                </div>
              </div>
              {/* Quick editors for location, products, talent */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1">Location</label>
                  <select
                    className="w-full border rounded p-2"
                    value={s.locationId || ""}
                    disabled={!canEditShots}
                    onChange={(e) => updateShot(s, { locationId: e.target.value || null })}
                  >
                    <option value="">(none)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Products</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {shotProducts.map((product) => {
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
                          ? "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
                          : "rounded-full bg-slate-100 px-3 py-1 text-xs";
                      return (
                        <span key={product.id} className={chipClass}>
                          {product.familyName}
                          {product.colourName ? ` – ${product.colourName}` : ""}
                          {sizeDescriptor ? ` (${sizeDescriptor})` : ""}
                        </span>
                      );
                    })}
                  {!shotProducts.length && (
                    <span className="text-xs text-slate-500">No products linked</span>
                  )}
                  </div>
                  {canEditShots && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setEditingShotProducts({
                          shot: s,
                          products: shotProducts,
                        })
                      }
                    >
                      Manage products
                    </Button>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Talent</label>
                  <select
                    className="w-full border rounded p-2"
                    multiple
                    value={s.talentIds || []}
                    disabled={!canEditShots}
                    onChange={(e) =>
                      updateShot(s, {
                        talentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                      })
                    }
                  >
                    {talent.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
            </Card>
          );
        })}
      </div>
      {canEditShots && editingShotProducts && (
        <Modal
          open
          onClose={() => setEditingShotProducts(null)}
          labelledBy="manage-shot-products-title"
          contentClassName="p-0 max-h-[90vh] overflow-hidden"
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="manage-shot-products-title" className="text-lg font-semibold">
                    Products for {editingShotProducts.shot.name}
                  </h2>
                  <p className="text-sm text-slate-500">Update colourways and sizes, then save to refresh the shot.</p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-xl text-slate-400 hover:text-slate-600"
                  onClick={() => setEditingShotProducts(null)}
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ShotProductsEditor
                value={editingShotProducts.products}
                onChange={(next) =>
                  setEditingShotProducts((prev) => ({ ...prev, products: next }))
                }
                families={families}
                loadFamilyDetails={loadFamilyDetails}
                createProduct={buildShotProduct}
                emptyHint="No products linked"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingShotProducts(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await updateShot(editingShotProducts.shot, {
                      products: editingShotProducts.products,
                    });
                    setEditingShotProducts(null);
                  }}
                >
                  Save products
                </Button>
              </div>
            </CardContent>
          </Card>
        </Modal>
      )}
    </div>
  );
}
