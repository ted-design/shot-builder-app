// updated ProductsPage.jsx
//
// This refactored version of the products page replaces inline CSS and
// native form elements with the shared UI primitives (`Card`, `Input`,
// `Checkbox`, `Button`) to achieve a consistent look across the app.  It
// preserves all existing functionality: you can search products, create
// new entries with optional thumbnails, toggle active status, and rename,
// update images or delete items.  The layout is organised into a search
// bar, a form card, and a list of product cards.

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
import { productsPath } from "../lib/paths";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input, Checkbox } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { canManageProducts, ROLE } from "../lib/rbac";

// Thumbnail component reused from the original implementation.  It shows a
// placeholder while loading and automatically fetches a 200x200 variant if
// available.  Styling is controlled via Tailwind classes.
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

export default function ProductsPage() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ name: "", sku: "", category: "", active: true });
  const [file, setFile] = useState(null);
  const [qText, setQText] = useState("");
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const { role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageProducts(role);

  // Subscribe to products collection
  useEffect(() => {
    const qy = query(collection(db, ...productsPath), orderBy("name", "asc"));
    const unsub = onSnapshot(qy, (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  // Create a new product
  const create = async () => {
    if (!canManage) {
      alert("You do not have permission to add products.");
      return;
    }
    if (!draft.name) return;
    const docRef = await addDoc(collection(db, ...productsPath), {
      ...draft,
      shotIds: [],
      thumbnailPath: null,
      createdAt: Date.now(),
    });
    if (file) {
      const { path } = await uploadImageFile(file, { folder: "products", id: docRef.id });
      await updateDoc(docRef, { thumbnailPath: path });
      setFile(null);
    }
    setDraft({ name: "", sku: "", category: "", active: true });
  };

  // Renaming and toggling helper functions
  const rename = async (item) => {
    if (!canManage) return;
    const name = prompt("New name", item.name);
    if (!name) return;
    await updateDoc(doc(db, ...productsPath, item.id), { name });
  };
  const toggleActive = async (item) => {
    if (!canManage) return;
    await updateDoc(doc(db, ...productsPath, item.id), { active: !item.active });
  };
  const changeImage = async (item) => {
    if (!canManage) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { path } = await uploadImageFile(f, { folder: "products", id: item.id });
      await updateDoc(doc(db, ...productsPath, item.id), { thumbnailPath: path });
      if (item.thumbnailPath) {
        try {
          await deleteImageByPath(item.thumbnailPath);
        } catch {}
      }
    };
    input.click();
  };
  const removeImage = async (item) => {
    if (!canManage) return;
    if (!item.thumbnailPath) return;
    try {
      await deleteImageByPath(item.thumbnailPath);
    } catch {}
    await updateDoc(doc(db, ...productsPath, item.id), { thumbnailPath: null });
  };
  const remove = async (id, prevPath) => {
    if (!canManage) return;
    await deleteDoc(doc(db, ...productsPath, id));
    if (prevPath) {
      try {
        await deleteImageByPath(prevPath);
      } catch {}
    }
  };

  // Filter products based on search and discontinued toggle
  const filtered = items.filter((i) => {
    const matchesSearch = qText ? (i.name || "").toLowerCase().includes(qText.toLowerCase()) : true;
    const matchesActive = showDiscontinued || i.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <p className="text-sm text-slate-600">
          Manage the wardrobe catalogue, toggle availability, and attach thumbnails.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
        {/* Search and discontinued toggle */}
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            className="sm:max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox
              checked={showDiscontinued}
              onChange={(e) => setShowDiscontinued(e.target.checked)}
            />
            Show discontinued
          </label>
        </div>
      </div>

      {/* Form to create a new product */}
      {canManage ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create New Product</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              placeholder="SKU"
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            />
            <Input
              placeholder="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Active
            </label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div>
              <Button onClick={create}>Add Product</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Your role has read-only access to the product catalogue. Producers can update inventory
          metadata and images.
        </div>
      )}

      {/* List of existing products */}
      <div className="space-y-4">
        {filtered.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start sm:items-center gap-4">
                <Thumb path={p.thumbnailPath} size={64} alt={p.name} />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-base">
                    {p.name} <span className="text-sm text-gray-500">{p.sku}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {p.category || "–"} • {p.active ? "Active" : "Discontinued"}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="secondary" onClick={() => changeImage(p)}>
                      Change Image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => removeImage(p)}>
                      Remove Image
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(p)}>
                      {p.active ? "Set Discontinued" : "Set Active"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => rename(p)}>
                      Rename
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(p.id, p.thumbnailPath)}>
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
