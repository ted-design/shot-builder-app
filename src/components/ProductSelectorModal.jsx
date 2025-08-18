// src/components/ProductSelectorModal.jsx
//
// A modal dialog for selecting one or more products to attach to a shot.  It
// supports fuzzy search via Fuse.js and basic faceted filtering on gender and
// category.  This component is self‑contained: it displays a search bar,
// filter drop‑downs, a results list, and an "Add" button on each product.
//
// Note: You need to install the Fuse.js dependency in your project.  Run
// `npm install fuse.js` in your project directory if it isn't already
// available.

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function ProductSelectorModal({ products, selectedIds, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");

  // Derive unique filter options from the products list.  We assume each
  // product document has `gender` and `category` fields; adjust these
  // properties to match your schema (e.g., `type`, `style`, etc.).
  const genders = useMemo(() => {
    const set = new Set();
    products.forEach((p) => p.gender && set.add(p.gender));
    return Array.from(set);
  }, [products]);
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  // Build a Fuse index on the products.  We search on name and category.
  const fuse = useMemo(() => {
    return new Fuse(products, { keys: ["name", "category"], threshold: 0.3 });
  }, [products]);

  // Apply filters and search.  Filtering comes first; then fuzzy search.  If
  // the query is empty, skip Fuse and return the filtered list as is.
  const filtered = useMemo(() => {
    let subset = products;
    if (gender) subset = subset.filter((p) => p.gender === gender);
    if (category) subset = subset.filter((p) => p.category === category);
    if (!query.trim()) return subset;
    return fuse.search(query.trim()).map((r) => r.item).filter((p) => subset.includes(p));
  }, [products, gender, category, query, fuse]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Stop propagation so clicks inside the modal don’t close it */}
      <div
        className="bg-white w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Select Products</h2>
              <button onClick={onClose} className="text-sm text-gray-500">×</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  className="w-full border rounded p-2"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">All</option>
                  {genders.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  className="w-full border rounded p-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {filtered.map((p) => {
                const added = selectedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between border rounded p-2 ${added ? "bg-gray-100" : ""}`}
                  >
                    <span>{p.name}</span>
                    <Button
                      size="sm"
                      variant={added ? "secondary" : "primary"}
                      onClick={() => !added && onAdd(p)}
                      disabled={added}
                    >
                      {added ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })}
              {!filtered.length && <p className="text-sm text-gray-500">No products found</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}