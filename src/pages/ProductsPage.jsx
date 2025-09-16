// ProductsPage.jsx
//
// The products catalogue supports optional advanced search (controlled via
// FLAGS.productSearch). When enabled, Fuse.js provides fuzzy matching across
// name, SKU and category, and additional dropdowns allow filtering by status,
// category and shot usage. The default experience remains lightweight: a
// search box with simple status filtering. Creation and management actions
// continue to use shared UI primitives for consistency with the rest of the
// app.

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { canManageProducts, ROLE } from "../lib/rbac";
import { FLAGS } from "../lib/flags";
import Fuse from "fuse.js";

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
  const advancedSearch = FLAGS.productSearch;
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const { role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageProducts(role);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const fuse = useMemo(() => {
    if (!advancedSearch) return null;
    return new Fuse(items, {
      keys: ["name", "sku", "category"],
      threshold: 0.32,
      ignoreLocation: true,
    });
  }, [items, advancedSearch]);

  const searchedItems = useMemo(() => {
    const queryValue = queryText.trim();
    if (!advancedSearch) {
      if (!queryValue) return items;
      const lower = queryValue.toLowerCase();
      return items.filter((item) =>
        (item.name || "").toLowerCase().includes(lower) ||
        (item.sku || "").toLowerCase().includes(lower)
      );
    }
    if (!queryValue || !fuse) return items;
    return fuse.search(queryValue).map((result) => result.item);
  }, [items, queryText, advancedSearch, fuse]);

  const filteredItems = useMemo(() => {
    return searchedItems.filter((item) => {
      const isActive = item.active !== false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "discontinued" && !isActive);
      const matchesCategory =
        categoryFilter === "all" || (item.category || "") === categoryFilter;
      const usageCount = Array.isArray(item.shotIds) ? item.shotIds.length : 0;
      const matchesUsage =
        usageFilter === "all" ||
        (usageFilter === "used" && usageCount > 0) ||
        (usageFilter === "unused" && usageCount === 0);
      return matchesStatus && matchesCategory && matchesUsage;
    });
  }, [searchedItems, statusFilter, categoryFilter, usageFilter]);

  const getTimestamp = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value.seconds) return value.seconds * 1000;
    return 0;
  };

  const visibleItems = useMemo(() => {
    const list = [...filteredItems];
    switch (sortKey) {
      case "created":
        return list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
      case "updated":
        return list.sort((a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt));
      case "usage":
        return list.sort(
          (a, b) => (Array.isArray(b.shotIds) ? b.shotIds.length : 0) - (Array.isArray(a.shotIds) ? a.shotIds.length : 0)
        );
      case "name":
      default:
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  }, [filteredItems, sortKey]);

  const resetFilters = () => {
    setQueryText("");
    setStatusFilter("active");
    setCategoryFilter("all");
    setUsageFilter("all");
    setSortKey("name");
  };

  const formatDateLabel = (value) => {
    const ts = getTimestamp(value);
    if (!ts) return null;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <p className="text-sm text-slate-600">
          Manage the wardrobe catalogue, toggle availability, and attach thumbnails.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Search by name, SKU, or category…"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            className="md:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="active">Active only</option>
              <option value="all">All statuses</option>
              <option value="discontinued">Discontinued</option>
            </select>
            {advancedSearch && (
              <>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={usageFilter}
                  onChange={(event) => setUsageFilter(event.target.value)}
                >
                  <option value="all">All usage</option>
                  <option value="used">Attached to shots</option>
                  <option value="unused">Unused</option>
                </select>
              </>
            )}
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
            >
              <option value="name">Name A–Z</option>
              <option value="created">Newest first</option>
              <option value="updated">Recently updated</option>
              <option value="usage">Most used</option>
            </select>
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing {visibleItems.length} of {items.length} products
          </span>
          {advancedSearch && <span>Fuzzy search matches names, SKUs, and categories.</span>}
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
        {visibleItems.map((p) => {
          const usageCount = Array.isArray(p.shotIds) ? p.shotIds.length : 0;
          const updatedLabel = formatDateLabel(p.updatedAt || p.createdAt);
          return (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start sm:items-center gap-4">
                  <Thumb path={p.thumbnailPath} size={64} alt={p.name} />
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold text-base">
                      {p.name} <span className="text-sm text-gray-500">{p.sku}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.category || "–"} • {p.active ? "Active" : "Discontinued"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {usageCount > 0
                        ? `Used in ${usageCount} shot${usageCount === 1 ? "" : "s"}`
                        : "Not attached to shots"}
                      {updatedLabel && ` • Updated ${updatedLabel}`}
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
          );
        })}
        {!visibleItems.length && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-slate-500">
              No products match the current filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
