// src/components/ProductSelectorModal.jsx
//
// Modal dialog that lets users curate a list of products for a shot. It
// provides fuzzy search (Fuse.js), optional gender/category filters, and a
// staging area that shows the current selection so items can be removed before
// saving.

import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

export default function ProductSelectorModal({
  products,
  selectedIds = [],
  onSubmit,
  onClose,
  title = "Select Products",
}) {
  const enrichedProducts = useMemo(
    () =>
      products
        .filter((product) => !product.archived)
        .map((product) => ({
          ...product,
          skuCodes: Array.isArray(product.skuCodes) ? product.skuCodes : [],
          colorNames: Array.isArray(product.colorNames) ? product.colorNames : [],
          sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions : [],
        })),
    [products]
  );

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [selection, setSelection] = useState(selectedIds);

  useEffect(() => {
    setSelection(selectedIds);
  }, [selectedIds]);

  const genders = useMemo(() => {
    const set = new Set();
    enrichedProducts.forEach((p) => p.gender && set.add(p.gender));
    return Array.from(set);
  }, [enrichedProducts]);
  const categories = useMemo(() => {
    const set = new Set();
    enrichedProducts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [enrichedProducts]);

  const productsById = useMemo(() => {
    const map = new Map();
    enrichedProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [enrichedProducts]);

  const fuse = useMemo(
    () =>
      new Fuse(enrichedProducts, {
        keys: [
          { name: "styleName", weight: 0.5 },
          { name: "styleNumber", weight: 0.4 },
          { name: "gender", weight: 0.2 },
          { name: "skuCodes", weight: 0.3 },
          { name: "colorNames", weight: 0.2 },
          { name: "sizeOptions", weight: 0.2 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [enrichedProducts]
  );

  const filtered = useMemo(() => {
    let subset = enrichedProducts;
    if (gender) subset = subset.filter((p) => p.gender === gender);
    if (category) subset = subset.filter((p) => p.category === category);
    if (!query.trim()) return subset;
    const matches = fuse.search(query.trim()).map((result) => result.item);
    return matches.filter((item) => subset.includes(item));
  }, [enrichedProducts, gender, category, query, fuse]);

  const toggleProduct = (id) => {
    setSelection((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onSubmit?.(selection);
    onClose?.();
  };

  const handleClear = () => setSelection([]);

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="product-selector-title"
      contentClassName="p-0 max-h-[80vh] overflow-hidden"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 id="product-selector-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">Selected products</div>
            <div className="flex flex-wrap gap-2">
              {!selection.length && <span className="text-xs text-slate-500">No products selected.</span>}
              {selection.map((id) => {
                const product = productsById.get(id);
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs"
                  >
                    {product ? product.styleName : id}
                    <button
                      type="button"
                      onClick={() => toggleProduct(id)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <Input placeholder="Search products…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Gender</label>
              <select
                className="w-full rounded border p-2 text-sm"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
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
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                className="w-full rounded border p-2 text-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
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
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {filtered.map((product) => {
              const added = selection.includes(product.id);
              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between rounded border p-2 ${
                    added ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="text-sm">
                    <div className="font-medium">{product.styleName}</div>
                    <div className="text-xs text-slate-500">
                      {product.styleNumber} • {product.activeSkuCount || 0} active of {product.skuCount || 0} SKUs
                    </div>
                  </div>
                  <Button size="sm" variant={added ? "secondary" : "primary"} onClick={() => toggleProduct(product.id)}>
                    {added ? "Remove" : "Add"}
                  </Button>
                </div>
              );
            })}
            {!filtered.length && <p className="text-sm text-gray-500">No products found</p>}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear selection
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{selection.length} selected</span>
              <Button onClick={handleSave} disabled={!selection.length}>
                Save selection
              </Button>
            </div>
          </div>
         </CardContent>
       </Card>
     </Modal>
   );
 }
