// src/pages/ShotsPage.jsx (global shots version)
//
// This version centralises all shots into a single collection at
// `clients/{clientId}/shots` and adds a `projectId` field to each shot
// document.  When fetching shots we filter on the active project ID using
// a `where('projectId', '==', projectId)` clause.  This makes it easy to
// reassign shots to other projects—simply update the `projectId` field.

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
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
  productsPath,
  talentPath,
  locationsPath,
} from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import ProductSelectorModal from "../components/ProductSelectorModal";

export default function ShotsPage() {
  const [shots, setShots] = useState([]);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    type: "",
    date: "",
    locationId: "",
    productIds: [],
    talentIds: [],
  });
  const [products, setProducts] = useState([]);
  const [talent, setTalent] = useState([]);
  const [locations, setLocations] = useState([]);
  const projectId = getActiveProjectId();

  // Toggle for the product selection modal during shot creation.  When true,
  // the ProductSelectorModal will be shown.  Use this only for creating new
  // shots; editing existing shots still uses the multi-select for now.
  const [showProductModal, setShowProductModal] = useState(false);

  // Helper to build references
  const collRef = (...segments) => collection(db, ...segments);
  const docRef = (...segments) => doc(db, ...segments);

  /**
   * Keep related reverse indexes up to date when products/talent/locations change
   * on a shot.  When a shot references a product, for example, we also add the
   * shot ID to that product's `shotIds` array.  When removing a reference we
   * remove the shot ID from the relevant document.  Errors are caught and
   * ignored so that missing documents don't break the operation.
   */
  async function updateReverseIndexes({ shotId, before, after }) {
    // Products
    const prevP = new Set(before.productIds || []);
    const nextP = new Set(after.productIds || []);
    const addsP = [...nextP].filter((id) => !prevP.has(id));
    const remsP = [...prevP].filter((id) => !nextP.has(id));
    await Promise.all(
      addsP.map((id) =>
        updateDoc(docRef(...productsPath, id), { shotIds: arrayUnion(shotId) }).catch(
          () => {}
        )
      )
    );
    await Promise.all(
      remsP.map((id) =>
        updateDoc(docRef(...productsPath, id), { shotIds: arrayRemove(shotId) }).catch(
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
    const unsubProducts = onSnapshot(
      query(collRef(...productsPath), orderBy("name", "asc")),
      (snapshot) => {
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
      unsubProducts();
      unsubTalent();
      unsubLocations();
    };
  }, [projectId]);

  // Create a new shot.  We record projectId explicitly so that cross‑project
  // queries can filter on it.  Other fields default to sensible values.
  const createShot = async () => {
    if (!draft.name) return;
    const docRefSnap = await addDoc(collRef(...getShotsPath()), {
      ...draft,
      projectId: projectId,
      productIds: draft.productIds || [],
      talentIds: draft.talentIds || [],
      locationId: draft.locationId || null,
      createdAt: Date.now(),
    });
    await updateReverseIndexes({
      shotId: docRefSnap.id,
      before: { productIds: [], talentIds: [], locationId: null },
      after: {
        productIds: draft.productIds,
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
      productIds: [],
      talentIds: [],
    });
  };

  // Update an existing shot.  We compute before/after arrays for reverse
  // indexing and only update fields that have changed.  Note: If you allow
  // editing the project assignment in the future, updating the `projectId`
  // here will effectively reassign the shot.
  const updateShot = async (shot, patch) => {
    const before = {
      productIds: shot.productIds || [],
      talentIds: shot.talentIds || [],
      locationId: shot.locationId || null,
    };
    const after = {
      productIds: patch.productIds ?? before.productIds,
      talentIds: patch.talentIds ?? before.talentIds,
      locationId: patch.locationId ?? before.locationId,
    };
    await updateDoc(docRef(...getShotsPath(), shot.id), patch);
    await updateReverseIndexes({ shotId: shot.id, before, after });
  };

  // Delete a shot.  We remove it from all reverse indexes before deleting
  // the document itself.
  const removeShot = async (shot) => {
    await updateReverseIndexes({
      shotId: shot.id,
      before: shot,
      after: { productIds: [], talentIds: [], locationId: null },
    });
    await deleteDoc(docRef(...getShotsPath(), shot.id));
  };

  return (
    <div className="p-4 space-y-6">
      {/* Form to create a new shot */}
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
          {/* Products select */}
          {/* Products select: display chosen products with the ability to add
              additional ones via a modal.  We no longer require users to
              scroll through thousands of items; instead they click “Add
              products” and search/facet through the list. */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Products</label>
            {/* Show the names of selected products */}
            <div className="flex flex-wrap gap-2">
              {draft.productIds.map((pid) => {
                const prod = products.find((p) => p.id === pid);
                return (
                  <span
                    key={pid}
                    className="bg-gray-200 text-sm px-2 py-1 rounded"
                  >
                    {prod ? prod.name : pid}
                  </span>
                );
              })}
              {!draft.productIds.length && (
                <span className="text-sm text-gray-500">No products selected</span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowProductModal(true)}
            >
              Add Products
            </Button>
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
      {/* List of existing shots */}
      <div className="space-y-4">
        {shots.map((s) => (
          <Card key={s.id} className="border p-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">{s.name}</h3>
                <div className="space-x-2">
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
                  <Button size="sm" variant="destructive" onClick={() => removeShot(s)}>
                    Delete
                  </Button>
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
                    onChange={(e) => updateShot(s, { type: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Date</label>
                  <input
                    className="w-full border rounded p-2"
                    type="date"
                    value={s.date || ""}
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
                  <select
                    className="w-full border rounded p-2"
                    multiple
                    value={s.productIds || []}
                    onChange={(e) =>
                      updateShot(s, {
                        productIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                      })
                    }
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1">Talent</label>
                  <select
                    className="w-full border rounded p-2"
                    multiple
                    value={s.talentIds || []}
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
        ))}
      </div>
      {/* Product selection modal for creating a new shot.  It only appears
          when showProductModal is true.  We pass the full product list,
          currently selected product IDs, a handler to add a product, and a
          close callback. */}
      {showProductModal && (
        <ProductSelectorModal
          products={products}
          selectedIds={draft.productIds}
          onAdd={(product) =>
            setDraft((prev) => ({
              ...prev,
              productIds: Array.from(new Set([...prev.productIds, product.id])),
            }))
          }
          onClose={() => setShowProductModal(false)}
        />
      )}
    </div>
  );
}