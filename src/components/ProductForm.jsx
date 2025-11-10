import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input, Checkbox } from "./ui/input";

const GENDER_OPTIONS = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "unisex", label: "Unisex" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function normaliseSizes(value = []) {
  const seen = new Set();
  const result = [];
  value.forEach((size) => {
    const trimmed = (size || "").trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
}

function syncColorways(colorways, sizes) {
  return colorways.map((colorway) => {
    const map = new Map();
    (colorway.sizes || []).forEach((entry) => map.set(entry.size, entry));
    const nextSizes = sizes.map((size) => {
      const existing = map.get(size) || {};
      return {
        size,
        sku: existing.sku || "",
        oldSku: existing.oldSku || "",
      };
    });
    return {
      id: colorway.id || uid(),
      name: colorway.name || "",
      sizes: nextSizes,
    };
  });
}

function buildInitialState(initialValue) {
  const defaults = {
    name: "",
    styleNumber: "",
    category: "",
    gender: "men",
    sizes: [],
    colorways: [],
    active: true,
    skuList: [],
    thumbnailFile: null,
  };
  const base = { ...defaults, ...(initialValue || {}) };
  const baseSizes = normaliseSizes(base.sizes);
  const derivedSizes = base.colorways?.length
    ? normaliseSizes(
        base.colorways.flatMap((colorway) =>
          (colorway.sizes || []).map((entry) => entry.size)
        )
      )
    : [];
  const sizes = baseSizes.length ? baseSizes : derivedSizes;
  const colourwaySizes = sizes.length ? sizes : ["One Size"];
  const colorways = base.colorways?.length
    ? syncColorways(base.colorways, colourwaySizes)
    : [];
  return {
    name: base.name,
    styleNumber: base.styleNumber,
    category: base.category || "",
    gender: base.gender || "men",
    sizes: sizes.length ? sizes : [],
    colorways,
    active: base.active !== false,
    thumbnailFile: null,
  };
}

export default function ProductForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Save product",
  allowThumbnail = false,
}) {
  const [state, setState] = useState(() => buildInitialState(initialValue));
  const [newSize, setNewSize] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hasSizes = state.sizes.length > 0;

  const colorways = useMemo(() => syncColorways(state.colorways, state.sizes.length ? state.sizes : state.colorways.length ? normaliseSizes(state.colorways[0].sizes?.map((entry) => entry.size)) : []), [state.colorways, state.sizes]);

  const updateState = (updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const addSize = () => {
    const value = newSize.trim();
    if (!value) return;
    if (state.sizes.includes(value)) {
      setNewSize("");
      return;
    }
    const nextSizes = [...state.sizes, value];
    updateState({ sizes: nextSizes, colorways: syncColorways(colorways, nextSizes) });
    setNewSize("");
  };

  const removeSize = (value) => {
    const nextSizes = state.sizes.filter((size) => size !== value);
    updateState({ sizes: nextSizes, colorways: syncColorways(colorways, nextSizes) });
  };

  const addColorway = () => {
    const next = {
      id: uid(),
      name: "",
      sizes: (state.sizes.length ? state.sizes : ["One Size"]).map((size) => ({ size, sku: "", oldSku: "" })),
    };
    updateState({ colorways: [...colorways, next] });
  };

  const updateColorway = (id, updates) => {
    const next = colorways.map((colorway) =>
      colorway.id === id ? { ...colorway, ...updates } : colorway
    );
    updateState({ colorways: next });
  };

  const removeColorway = (id) => {
    updateState({ colorways: colorways.filter((colorway) => colorway.id !== id) });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const name = state.name.trim();
    const styleNumber = state.styleNumber.trim();
    const category = state.category.trim();
    const gender = state.gender || "men";
    const sizes = normaliseSizes(state.sizes);

    const normalisedColorways = syncColorways(colorways, sizes.length ? sizes : []);

    const preparedColorways = normalisedColorways
      .map((colorway) => ({
        id: colorway.id,
        name: (colorway.name || "").trim(),
        sizes: (colorway.sizes || [])
          .map((entry) => ({
            size: entry.size,
            sku: (entry.sku || "").trim(),
            oldSku: (entry.oldSku || "").trim() || null,
          }))
          .filter((entry) => entry.size && entry.sku),
      }))
      .filter((colorway) => colorway.name && colorway.sizes.length);

    const skuList = preparedColorways.flatMap((colorway) =>
      colorway.sizes.map((entry) => entry.sku)
    );

    if (!name) {
      setError("Product name is required.");
      return;
    }
    if (!styleNumber) {
      setError("Style number is required.");
      return;
    }
    if (!sizes.length) {
      setError("Add at least one size.");
      return;
    }
    if (!preparedColorways.length) {
      setError("Add at least one colourway with SKUs.");
      return;
    }
    if (!skuList.length) {
      setError("Each colourway needs at least one SKU.");
      return;
    }

    const payload = {
      name,
      styleNumber,
      category: category || null,
      gender,
      sizes,
      colorways: preparedColorways,
      skuList,
      primarySku: skuList[0] || null,
      active: state.active,
    };

    if (allowThumbnail) {
      payload.thumbnailFile = state.thumbnailFile || null;
    }

    try {
      setSubmitting(true);
      const result = await onSubmit?.(payload);
      setSubmitting(false);
      return result;
    } catch (err) {
      setSubmitting(false);
      setError(err?.message || "Failed to save product.");
      return undefined;
    }
  };

  const handleThumbnail = (event) => {
    const file = event.target.files?.[0] || null;
    updateState({ thumbnailFile: file });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Gender</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={state.gender}
            onChange={(event) => updateState({ gender: event.target.value })}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Category</label>
          <Input
            placeholder="Optional category"
            value={state.category}
            onChange={(event) => updateState({ category: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Product name</label>
          <Input
            placeholder="e.g. Honeycomb Knit Merino Henley"
            value={state.name}
            onChange={(event) => updateState({ name: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Style number</label>
          <Input
            placeholder="e.g. UM2026-3013-01"
            value={state.styleNumber}
            onChange={(event) => updateState({ styleNumber: event.target.value })}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={state.active}
          onChange={(event) => updateState({ active: event.target.checked })}
        />
        <span className="text-sm text-slate-700">Product is active</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Available sizes</label>
          <span className="text-xs text-slate-500">
            Press Enter to add. Sizes appear in colourway tables below.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.sizes.map((size) => (
            <span key={size} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
              {size}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => removeSize(size)}
              >
                ×
              </button>
            </span>
          ))}
          {!state.sizes.length && <span className="text-sm text-slate-500">No sizes yet</span>}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add size (e.g. S, 32R)"
            value={newSize}
            onChange={(event) => setNewSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSize();
              }
            }}
          />
          <Button type="button" onClick={addSize} disabled={!newSize.trim()}>
            Add size
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Colourways</label>
          <Button type="button" variant="secondary" size="sm" onClick={addColorway}>
            Add colourway
          </Button>
        </div>
        {!colorways.length && (
          <div className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Add colourways to capture SKUs for each size.
          </div>
        )}
        {colorways.map((colorway) => (
          <div key={colorway.id} className="rounded-card border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Colour name (e.g. Black)"
                value={colorway.name}
                onChange={(event) =>
                  updateColorway(colorway.id, { name: event.target.value })
                }
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeColorway(colorway.id)}>
                Remove
              </Button>
            </div>
            {hasSizes ? (
              <div className="space-y-2">
                {colorway.sizes.map((entry) => (
                  <div key={entry.size} className="grid gap-3 sm:grid-cols-[120px,1fr]">
                    <div className="text-sm font-medium text-slate-600">{entry.size}</div>
                    <Input
                      placeholder="SKU"
                      value={entry.sku}
                      onChange={(event) => {
                        const nextSizes = colorway.sizes.map((sizeEntry) =>
                          sizeEntry.size === entry.size
                            ? { ...sizeEntry, sku: event.target.value }
                            : sizeEntry
                        );
                        updateColorway(colorway.id, { sizes: nextSizes });
                      }}
                      required
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Add sizes before assigning SKUs.
              </div>
            )}
          </div>
        ))}
      </div>

      {allowThumbnail && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Thumbnail image</label>
          <Input type="file" accept="image/*" onChange={handleThumbnail} />
          {state.thumbnailFile && (
            <div className="text-xs text-slate-500">Selected: {state.thumbnailFile.name}</div>
          )}
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
