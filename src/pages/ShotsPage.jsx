import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
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

/**
 * ShotsPage
 *
 * This page allows you to create and manage shots for the active project.  It
 * displays a simple form for capturing basic details (name, description,
 * type, date, location and associations with products and talent) and a list
 * of existing shots.  Each shot card includes quick actions to rename or
 * delete the shot as well as select dropdowns to update its associations.
 */
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

  // Helper to build collection/document references
  const collRef = (...segments) => collection(db, ...segments);
  const docRef = (...segments) => doc(db, ...segments);

  // Keep related reverse indexes up to date when products/talent/locations change on a shot
  async function updateReverseIndexes({ shotId, before, after }) {
    // Products
    const prevP = new Set(before.productIds || []);
    const nextP = new Set(after.productIds || []);
    const addsP = [...nextP].filter((id) => !prevP.has(id));
    const remsP = [...prevP].filter((id) => !nextP.has(id));
    await Promise.all(
      addsP.map((id) =>
        updateDoc(docRef(...productsPath, id), { shotIds: arrayUnion(shotId) }).catch(() => {})
      )
    );
    await Promise.all(
      remsP.map((id) =>
        updateDoc(docRef(...productsPath, id), { shotIds: arrayRemove(shotId) }).catch(() => {})
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

  // Subscribe to collections for shots, products, talent and locations
  useEffect(() => {
    const unsubShots = onSnapshot(
      query(collRef(...getShotsPath(projectId)), orderBy("date", "asc")),
      (snapshot) => {
        setShots(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
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

  // Create a new shot
  const createShot = async () => {
    if (!draft.name) return;
    const docRef = await addDoc(collRef(...getShotsPath(projectId)), {
      ...draft,
      productIds: draft.productIds || [],
      talentIds: draft.talentIds || [],
      locationId: draft.locationId || null,
      createdAt: Date.now(),
    });
    await updateReverseIndexes({
      shotId: docRef.id,
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

  // Update an existing shot. Patch only fields provided in `patch`.
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
    await updateDoc(docRef(...getShotsPath(projectId), shot.id), patch);
    if (
      patch.productIds !== undefined ||
      patch.talentIds !== undefined ||
      patch.locationId !== undefined
    ) {
      await updateReverseIndexes({ shotId: shot.id, before, after });
    }
  };

  // Delete a shot
  const removeShot = async (shot) => {
    await updateReverseIndexes({
      shotId: shot.id,
      before: {
        productIds: shot.productIds || [],
        talentIds: shot.talentIds || [],
        locationId: shot.locationId || null,
      },
      after: { productIds: [], talentIds: [], locationId: null },
    });
    await deleteDoc(docRef(...getShotsPath(projectId), shot.id));
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
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
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
              onChange={(e) =>
                setDraft({ ...draft, locationId: e.target.value || "" })
              }
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
          <div>
            <label className="block text-sm font-medium mb-1">
              Products (hold Ctrl/Cmd to multi-select)
            </label>
            <select
              className="w-full border rounded p-2"
              multiple
              value={draft.productIds}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  productIds: Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  ),
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
                  talentIds: Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  ),
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
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeShot(s)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>{s.description || "–"}</p>
              <p className="text-sm text-gray-600">
                Type: {s.type || "–"} • Date: {s.date || "–"}
              </p>
              {/* Quick editors for location, products, talent */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1">Location</label>
                  <select
                    className="w-full border rounded p-2"
                    value={s.locationId || ""}
                    onChange={(e) =>
                      updateShot(s, {
                        locationId: e.target.value || null,
                      })
                    }
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
                  <label className="text-sm font-medium mb-1">
                    Products
                  </label>
                    <select
                      className="w-full border rounded p-2"
                      multiple
                      value={s.productIds || []}
                      onChange={(e) =>
                        updateShot(s, {
                          productIds: Array.from(
                            e.target.selectedOptions
                          ).map((o) => o.value),
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
                        talentIds: Array.from(
                          e.target.selectedOptions
                        ).map((o) => o.value),
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
    </div>
  );
}
