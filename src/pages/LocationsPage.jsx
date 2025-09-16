// updated LocationsPage.jsx
//
// This version of the locations page replaces inline styles and native
// elements with the shared UI primitives (`Card`, `Input`, `Button`,
// `Checkbox`) defined in `src/components/ui`.  The underlying CRUD logic
// remains the same: you can search locations, create new ones, upload a
// thumbnail image and perform rename, image update and delete actions on
// existing records.  The main difference is that the layout is now
// composed of cards and properly spaced inputs for a consistent look
// across the application.

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, storage, uploadImageFile, deleteImageByPath } from "../firebase";
import { locationsPath } from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { canManageLocations, ROLE } from "../lib/rbac";

// Reuse the existing thumbnail component.  It fetches a resized image
// when available and falls back to the original.  No styling changes are
// required here because the image is contained within a flex layout in the
// list below.
const resizedPath = (originalPath, size = 200) =>
  originalPath.replace(/(\.[^./]+)$/, `_${size}x${size}$1`);

function Thumb({ path, size = 64, alt = "" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!path) return setUrl(null);
      try {
        const u200 = await getDownloadURL(storageRef(storage, resizedPath(path, size)));
        if (alive) setUrl(u200);
      } catch {
        const u = await getDownloadURL(storageRef(storage, path));
        if (alive) setUrl(u);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, size]);
  if (!url)
    return <div className="bg-gray-100 rounded" style={{ width: size, height: size }} />;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="object-cover rounded"
    />
  );
}

export default function LocationsPage() {
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    street: "",
    unit: "",
    city: "",
    province: "",
    postal: "",
    phone: "",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const { role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageLocations(role);

  // Subscribe to locations collection
  useEffect(() => {
    const qy = query(collection(db, ...locationsPath), orderBy("name", "asc"));
    const unsub = onSnapshot(qy, (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  // Event handlers
  const change = (k, v) => setDraft({ ...draft, [k]: v });

  const create = async () => {
    if (!canManage) {
      alert("You do not have permission to add locations.");
      return;
    }
    if (!draft.name) return;
    const docRef = await addDoc(collection(db, ...locationsPath), {
      ...draft,
      shotIds: [],
      photoPath: null,
      createdAt: Date.now(),
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder: "locations", id: docRef.id });
      await updateDoc(docRef, { photoPath: path });
      setFile(null);
    }
    setDraft({
      name: "",
      street: "",
      unit: "",
      city: "",
      province: "",
      postal: "",
      phone: "",
      notes: "",
    });
  };

  const rename = async (item) => {
    if (!canManage) return;
    const name = prompt("New name", item.name);
    if (!name) return;
    await updateDoc(doc(db, ...locationsPath, item.id), { name });
  };

  const changeImage = async (item) => {
    if (!canManage) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { path } = await uploadImageFile(f, { folder: "locations", id: item.id });
      await updateDoc(doc(db, ...locationsPath, item.id), { photoPath: path });
      if (item.photoPath) {
        try {
          await deleteImageByPath(item.photoPath);
        } catch {}
      }
    };
    input.click();
  };

  const removeImage = async (item) => {
    if (!canManage) return;
    if (!item.photoPath) return;
    try {
      await deleteImageByPath(item.photoPath);
    } catch {}
    await updateDoc(doc(db, ...locationsPath, item.id), { photoPath: null });
  };

  const remove = async (id, prevPath) => {
    if (!canManage) return;
    await deleteDoc(doc(db, ...locationsPath, id));
    if (prevPath) {
      try {
        await deleteImageByPath(prevPath);
      } catch {}
    }
  };

  // Filter items based on search text
  const filtered = qText
    ? items.filter((i) => (i.name || "").toLowerCase().includes(qText.toLowerCase()))
    : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Locations</h1>
        <p className="text-sm text-slate-600">
          Catalogue studios and on-site venues with reference photos and notes.
        </p>
      </div>
      {/* Page header and search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Locations</h1>
        <Input
          placeholder="Search…"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {/* Form to create a new location */}
      {canManage ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create New Location</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Name"
              value={draft.name}
              onChange={(e) => change("name", e.target.value)}
            />
            <Input
              placeholder="Street address"
              value={draft.street}
              onChange={(e) => change("street", e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Unit (optional)"
                value={draft.unit}
                onChange={(e) => change("unit", e.target.value)}
              />
              <Input
                placeholder="City"
                value={draft.city}
                onChange={(e) => change("city", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Province/State"
                value={draft.province}
                onChange={(e) => change("province", e.target.value)}
              />
              <Input
                placeholder="Postal/ZIP"
                value={draft.postal}
                onChange={(e) => change("postal", e.target.value)}
              />
            </div>
            <Input
              placeholder="Phone (optional)"
              value={draft.phone}
              onChange={(e) => change("phone", e.target.value)}
            />
            <textarea
              placeholder="Other notes / instructions (optional)"
              value={draft.notes}
              onChange={(e) => change("notes", e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
            />
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div>
              <Button onClick={create}>Add Location</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Locations are read-only for your role. Producers can create and update venue records.
        </div>
      )}

      {/* List of existing locations */}
      <div className="space-y-4">
        {filtered.map((l) => (
          <Card key={l.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start sm:items-center gap-4">
                <Thumb path={l.photoPath} size={64} alt={l.name} />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-base">{l.name}</div>
                  <div className="text-sm text-gray-600">
                    {[
                      l.street,
                      l.unit && `Unit ${l.unit}`,
                      l.city,
                      l.province,
                      l.postal,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {l.phone && (
                    <div className="text-sm text-gray-600">☎ {l.phone}</div>
                  )}
                  {l.notes && (
                    <div className="text-sm text-gray-600 mt-1">{l.notes}</div>
                  )}
                </div>
                {canManage ? (
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="secondary" onClick={() => changeImage(l)}>
                      Change Image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => removeImage(l)}>
                      Remove Image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => rename(l)}>
                      Rename
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(l.id, l.photoPath)}>
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Read only</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
