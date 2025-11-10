// src/components/pulls/PullItemsGrid.jsx
// Inline-editable grid for pull items with quick add, expand/collapse for sizes,
// and basic keyboard shortcuts. Saving is delegated to the parent via onItemsChange
// (parent should autosave with debounce).

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ShotProductAddModal from "../shots/ShotProductAddModal";
import { getPullItemDisplayName, getTotalQuantity, getTotalFulfilled, calculateItemFulfillment, createPullItemFromProduct, upsertPullItem } from "../../lib/pullItems";

// Gender is locked to product; display only.

function StatusBadge({ status }) {
  const cls = {
    pending: "bg-slate-100 text-slate-700",
    partial: "bg-amber-100 text-amber-700",
    fulfilled: "bg-green-100 text-green-700",
    substituted: "bg-blue-100 text-blue-700",
  }[status] || "bg-slate-100 text-slate-700";
  const label = {
    pending: "Pending",
    partial: "Partial",
    fulfilled: "Fulfilled",
    substituted: "Substituted",
  }[status] || status;
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function PullItemsGrid({
  items,
  onItemsChange,
  canManage = true,
  canFulfill = false,
  families = [],
  loadFamilyDetails,
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editBuffer, setEditBuffer] = useState({}); // transient input values keyed by item:size:field
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterText, setFilterText] = useState("");
  const [changeRowIndex, setChangeRowIndex] = useState(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [colWidths, setColWidths] = useState({ product: 380, notes: 340 });
  const resizeStateRef = useRef(null);
  const [sortKey, setSortKey] = useState("none"); // none | name | gender
  const [sortDir, setSortDir] = useState("asc"); // asc | desc
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [showCols, setShowCols] = useState({
    gender: true,
    totalQty: true,
    fulfilled: true,
    status: true,
    notes: true,
    actions: true,
  });

  // Key handler: N to quick add
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.defaultPrevented) return;
      const target = e.target;
      const isTyping = target && ("value" in target || target.isContentEditable);
      if (isTyping) return;
      if ((e.key === "n" || e.key === "N")) {
        e.preventDefault();
        if (canManage) setProductModalOpen(true);
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [canManage]);

  const toggleExpand = (index) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Utilities for transient buffering of numeric inputs
  const keyOf = (itemIndex, sizeIndex, field) => `${itemIndex}:${sizeIndex}:${field}`;
  const getBufferedValue = (itemIndex, sizeIndex, field, fallback) => {
    const k = keyOf(itemIndex, sizeIndex, field);
    return Object.prototype.hasOwnProperty.call(editBuffer, k) ? editBuffer[k] : String(fallback ?? "");
  };
  const setBufferedValue = (itemIndex, sizeIndex, field, val) => {
    const k = keyOf(itemIndex, sizeIndex, field);
    setEditBuffer((prev) => ({ ...prev, [k]: val }));
  };
  const clearBufferedValue = (itemIndex, sizeIndex, field) => {
    const k = keyOf(itemIndex, sizeIndex, field);
    setEditBuffer((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };
  const commitNumber = (itemIndex, sizeIndex, field) => {
    const k = keyOf(itemIndex, sizeIndex, field);
    const raw = editBuffer[k];
    if (raw === undefined) return; // nothing to commit
    const n = Number.parseInt(raw, 10);
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    // Clamp fulfilled to quantity if needed
    if (field === "fulfilled") {
      const quantity = items[itemIndex]?.sizes?.[sizeIndex]?.quantity ?? safe;
      const clamped = Math.min(safe, quantity);
      updateSize(itemIndex, sizeIndex, field, clamped);
    } else {
      updateSize(itemIndex, sizeIndex, field, safe);
    }
    clearBufferedValue(itemIndex, sizeIndex, field);
  };

  const expandAll = () => {
    setExpandedRows(new Set(items.map((_, i) => i)));
  };
  const collapseAll = () => setExpandedRows(new Set());

  const updateItem = (index, updater) => {
    const next = items.map((it, i) => {
      if (i !== index) return it;
      const out = updater(it);
      // Keep fulfillmentStatus in sync when sizes change
      try {
        const status = calculateItemFulfillment(out);
        return { ...out, fulfillmentStatus: status };
      } catch {
        return out;
      }
    });
    onItemsChange(next);
  };

  const removeItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    onItemsChange(next);
  };

  const addSizeRow = (index) => {
    updateItem(index, (it) => ({
      ...it,
      sizes: [...(it.sizes || []), { size: "", quantity: 1, fulfilled: 0, status: "pending" }],
    }));
    setExpandedRows((prev) => new Set(prev).add(index));
  };

  const updateSize = (itemIndex, sizeIndex, field, value) => {
    updateItem(itemIndex, (it) => ({
      ...it,
      sizes: it.sizes.map((s, i) => (i === sizeIndex ? { ...s, [field]: value } : s)),
    }));
  };

  const removeSize = (itemIndex, sizeIndex) => {
    updateItem(itemIndex, (it) => ({
      ...it,
      sizes: it.sizes.filter((_, i) => i !== sizeIndex),
    }));
  };

  const handleProductQuickAdd = async (selection) => {
    try {
      const { family, colour, size } = selection;
      const item = createPullItemFromProduct(
        {
          familyId: family.id,
          familyName: family.styleName,
          styleNumber: family.styleNumber || null,
          colourId: colour?.id || null,
          colourName: colour?.colorName || null,
          size: size && size !== "__ALL_SIZES__" ? size : "All Sizes",
        },
        family,
        []
      );
      const merged = upsertPullItem(items, item);
      onItemsChange(merged);
    } catch (err) {
      // noop
    } finally {
      setProductModalOpen(false);
    }
  };

  // In-grid product changer
  const openChangeProduct = (rowIndex) => {
    if (!canManage) return;
    setChangeRowIndex(rowIndex);
    setChangeModalOpen(true);
  };
  const handleChangeProduct = async (selection) => {
    try {
      const { family, colour, size } = selection;
      const sourceItem = items[changeRowIndex];
      if (!sourceItem) return;
      const nextItem = {
        ...sourceItem,
        familyId: family.id,
        familyName: family.styleName,
        styleNumber: family.styleNumber || null,
        colourId: colour?.id || null,
        colourName: colour?.colorName || null,
        colourImagePath: colour?.imagePath || null,
        gender: family.gender || null,
        genderOverride: null,
      };
      const merged = upsertPullItem(items, nextItem, { excludeId: sourceItem.id });
      onItemsChange(merged);
    } finally {
      setChangeModalOpen(false);
      setChangeRowIndex(null);
    }
  };

  // Column resizing (product, notes)
  const beginResize = (colId, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = colWidths[colId] || 300;
    const onMove = (e) => {
      const delta = e.clientX - startX;
      const next = Math.max(200, Math.min(900, startWidth + delta));
      setColWidths((prev) => ({ ...prev, [colId]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Filtering
  const normalizedFilter = filterText.trim().toLowerCase();
  const display = useMemo(() => {
    let arr = items.map((it, i) => ({ item: it, sourceIndex: i }));
    if (normalizedFilter) {
      arr = arr.filter(({ item }) => {
        const name = (item.familyName || "").toLowerCase();
        const colour = (item.colourName || "").toLowerCase();
        const style = (item.styleNumber || "").toLowerCase();
        return name.includes(normalizedFilter) || colour.includes(normalizedFilter) || style.includes(normalizedFilter);
      });
    }
    if (sortKey !== "none") {
      const factor = sortDir === "desc" ? -1 : 1;
      const genderOrder = { mens: 1, womens: 2, kids: 3, unisex: 4 };
      arr = arr.slice().sort((a, b) => {
        if (sortKey === "name") {
          const an = (a.item.familyName || "").toLowerCase();
          const bn = (b.item.familyName || "").toLowerCase();
          if (an !== bn) return an < bn ? -1 * factor : 1 * factor;
          const ac = (a.item.colourName || "").toLowerCase();
          const bc = (b.item.colourName || "").toLowerCase();
          if (ac !== bc) return ac < bc ? -1 * factor : 1 * factor;
          return 0;
        }
        if (sortKey === "gender") {
          const ag = (a.item.gender || "").toLowerCase();
          const bg = (b.item.gender || "").toLowerCase();
          const ao = genderOrder[ag] || 999;
          const bo = genderOrder[bg] || 999;
          if (ao !== bo) return (ao - bo) * factor;
          // fallback to name
          const an = (a.item.familyName || "").toLowerCase();
          const bn = (b.item.familyName || "").toLowerCase();
          if (an !== bn) return an < bn ? -1 * factor : 1 * factor;
          const ac = (a.item.colourName || "").toLowerCase();
          const bc = (b.item.colourName || "").toLowerCase();
          if (ac !== bc) return ac < bc ? -1 * factor : 1 * factor;
          return 0;
        }
        return 0;
      });
    }
    return arr;
  }, [items, normalizedFilter, sortKey, sortDir]);

  // Selection helpers (by item.id)
  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectVisible = () => setSelectedIds(new Set(display.map(({ item }) => item.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const allVisibleSelected = display.length > 0 && display.every(({ item }) => selectedIds.has(item.id));

  const bulkDeleteSelected = () => {
    if (!selectedIds.size) return;
    const next = items.filter((it) => !selectedIds.has(it.id));
    onItemsChange(next);
    clearSelection();
  };
  const expandSelected = () => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      display.forEach(({ item, sourceIndex }) => {
        if (selectedIds.has(item.id)) next.add(sourceIndex);
      });
      return next;
    });
  };
  const collapseSelected = () => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      display.forEach(({ item, sourceIndex }) => {
        if (selectedIds.has(item.id)) next.delete(sourceIndex);
      });
      return next;
    });
  };

  const bulkSetStatus = (status) => {
    if (!selectedIds.size || !status) return;
    const next = items.map((it) => {
      if (!selectedIds.has(it.id)) return it;
      const sizes = (it.sizes || []).map((s) => ({ ...s, status }));
      const updated = { ...it, sizes };
      try {
        updated.fulfillmentStatus = calculateItemFulfillment(updated);
      } catch {}
      return updated;
    });
    onItemsChange(next);
  };

  const bulkMarkFulfilled = () => {
    if (!selectedIds.size) return;
    const next = items.map((it) => {
      if (!selectedIds.has(it.id)) return it;
      const sizes = (it.sizes || []).map((s) => ({ ...s, fulfilled: s.quantity || 0, status: "fulfilled" }));
      const updated = { ...it, sizes };
      try {
        updated.fulfillmentStatus = calculateItemFulfillment(updated);
      } catch {}
      return updated;
    });
    onItemsChange(next);
  };

  const bulkClearFulfilled = () => {
    if (!selectedIds.size) return;
    const next = items.map((it) => {
      if (!selectedIds.has(it.id)) return it;
      const sizes = (it.sizes || []).map((s) => ({ ...s, fulfilled: 0, status: "pending" }));
      const updated = { ...it, sizes };
      try {
        updated.fulfillmentStatus = calculateItemFulfillment(updated);
      } catch {}
      return updated;
    });
    onItemsChange(next);
  };

  // Keyboard navigation between rows for Notes field
  const focusNotesRow = (rowId, dir) => {
    const ids = display.map(({ item }) => item.id);
    const idx = ids.indexOf(rowId);
    if (idx === -1) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    const nextId = ids[nextIdx];
    const el = containerRef.current?.querySelector(`input[data-cell="notes"][data-rowid="${nextId}"]`);
    el?.focus();
  };

  // Keyboard navigation within size table (same item)
  const focusSizeCell = (rowIndex, sizeIndex, field, dir) => {
    const nextIdx = sizeIndex + dir;
    const el = containerRef.current?.querySelector(
      `input[data-cell="size-${field}"][data-rowindex="${rowIndex}"][data-sizeindex="${nextIdx}"]`
    );
    el?.focus();
  };

  return (
    <div ref={containerRef} className="rounded-card border border-slate-200 overflow-hidden">
      {/* Grid toolbar */}
      <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setProductModalOpen(true)} disabled={!canManage}>
            + Quick add
          </Button>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by product, color, style…"
            className="h-8 w-64 rounded border border-slate-200 px-2 text-sm"
            aria-label="Filter items"
          />
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-600">Sort</label>
            <select
              className="h-8 rounded border border-slate-200 bg-white px-2 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              aria-label="Sort by"
            >
              <option value="none">Default</option>
              <option value="name">Name</option>
              <option value="gender">Gender</option>
            </select>
            <button
              type="button"
              className="h-8 w-8 rounded border border-slate-200 text-xs"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
              aria-label="Toggle sort direction"
            >
              {sortDir === "asc" ? "A→Z" : "Z→A"}
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowColumnsPanel((v) => !v)}>
            Columns
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-slate-600">{selectedIds.size} selected</span>
              {canManage && (
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={bulkDeleteSelected}>
                  Delete selected
                </Button>
              )}
              <select
                className="h-8 rounded border border-slate-200 bg-white px-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  bulkSetStatus(val);
                  e.target.value = ""; // reset
                }}
                aria-label="Set size status for selected"
              >
                <option value="" disabled>
                  Set size status…
                </option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="substituted">Substituted</option>
                <option value="fulfilled">Fulfilled</option>
              </select>
              {canFulfill && (
                <>
                  <Button size="sm" variant="ghost" onClick={bulkMarkFulfilled}>
                    Fulfill sizes (set = qty)
                  </Button>
                  <Button size="sm" variant="ghost" onClick={bulkClearFulfilled}>
                    Clear sizes fulfilled
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={expandSelected}>Expand selected</Button>
              <Button size="sm" variant="ghost" onClick={collapseSelected}>Collapse selected</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={expandAll}>Expand all</Button>
          <Button size="sm" variant="ghost" onClick={collapseAll}>Collapse all</Button>
        </div>
      </div>
      {showColumnsPanel && (
        <div className="flex flex-wrap items-center gap-4 border-b bg-white px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.gender}
              onChange={(e) => setShowCols((c) => ({ ...c, gender: e.target.checked }))}
            />
            Gender
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.totalQty}
              onChange={(e) => setShowCols((c) => ({ ...c, totalQty: e.target.checked }))}
            />
            Total Qty
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.fulfilled}
              onChange={(e) => setShowCols((c) => ({ ...c, fulfilled: e.target.checked }))}
            />
            Fulfilled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.status}
              onChange={(e) => setShowCols((c) => ({ ...c, status: e.target.checked }))}
            />
            Status
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.notes}
              onChange={(e) => setShowCols((c) => ({ ...c, notes: e.target.checked }))}
            />
            Notes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCols.actions}
              onChange={(e) => setShowCols((c) => ({ ...c, actions: e.target.checked }))}
            />
            Actions
          </label>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={allVisibleSelected}
                  onChange={(e) => (e.target.checked ? selectVisible() : clearSelection())}
                />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 relative"
                style={{ minWidth: colWidths.product, width: colWidths.product }}
              >
                Product
                <span
                  role="separator"
                  aria-orientation="vertical"
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-slate-300"
                  onMouseDown={(e) => beginResize("product", e)}
                  title="Drag to resize column"
                />
              </th>
              {showCols.gender && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Gender</th>
              )}
              {showCols.totalQty && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Total Qty</th>
              )}
              {showCols.fulfilled && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Fulfilled</th>
              )}
              {showCols.status && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
              )}
              <th
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 relative"
                style={{ minWidth: colWidths.notes, width: colWidths.notes }}
              >
                Notes
                <span
                  role="separator"
                  aria-orientation="vertical"
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-slate-300"
                  onMouseDown={(e) => beginResize("notes", e)}
                  title="Drag to resize column"
                />
              </th>
              {showCols.actions && (
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {display.map(({ item, sourceIndex: index }) => {
              const totalQty = getTotalQuantity(item);
              const totalFulfilled = getTotalFulfilled(item);
              const status = calculateItemFulfillment(item);
              const productGender = item.gender || "Not specified";
              const expanded = expandedRows.has(index);
              return (
                <React.Fragment key={item.id || index}>
                  <tr className="border-b border-slate-200 hover:bg-slate-50 align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpand(index)}
                          className="rounded p-2 hover:bg-slate-100"
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          <span className="inline-block w-3 text-center">{expanded ? "▾" : "▸"}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2" style={{ minWidth: colWidths.product, width: colWidths.product }}>
                      <div className="text-sm font-medium text-slate-900">{getPullItemDisplayName(item)}</div>
                      {item.styleNumber && (
                        <div className="text-xs text-slate-500">Style: {item.styleNumber}</div>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => openChangeProduct(index)}>
                          Change
                        </Button>
                      )}
                    </td>
                    {showCols.gender && (
                      <td className="px-3 py-2 text-sm">
                        <span className="text-slate-700">{productGender}</span>
                      </td>
                    )}
                    {showCols.totalQty && (
                      <td className="px-3 py-2 text-center text-sm text-slate-700">{totalQty}</td>
                    )}
                    {showCols.fulfilled && (
                      <td className="px-3 py-2 text-center text-sm text-slate-700">{totalFulfilled}</td>
                    )}
                    {showCols.status && (
                      <td className="px-3 py-2 text-sm"><StatusBadge status={status} /></td>
                    )}
                    <td className="px-3 py-2 text-sm" style={{ minWidth: colWidths.notes, width: colWidths.notes }}>
                      {canManage ? (
                        <Input
                          value={item.notes || ""}
                          onChange={(e) =>
                            updateItem(index, (it) => ({ ...it, notes: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              focusNotesRow(item.id, -1);
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              focusNotesRow(item.id, 1);
                            }
                          }}
                          data-cell="notes"
                          data-rowid={item.id}
                          placeholder="Add notes…"
                        />
                      ) : (
                        <span className="text-slate-700">{item.notes || ""}</span>
                      )}
                    </td>
                    {showCols.actions && (
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => toggleExpand(index)}>
                            {expanded ? "Collapse" : "Expand"}
                          </Button>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => removeItem(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>

                  {expanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={3 + Object.values(showCols).filter(Boolean).length} className="px-3 py-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sizes</h4>
                            {canManage && (
                              <Button size="sm" variant="ghost" onClick={() => addSizeRow(index)}>
                                Add Size
                              </Button>
                            )}
                          </div>

                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs text-slate-600">
                                <th className="pb-2 text-left font-medium">Size</th>
                                <th className="pb-2 text-center font-medium">Requested</th>
                                <th className="pb-2 text-center font-medium">Fulfilled</th>
                                <th className="pb-2 text-left font-medium">Status</th>
                                <th className="pb-2 text-right font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(item.sizes || []).map((s, sIdx) => (
                                <tr key={sIdx} className="border-b border-slate-100">
                                  <td className="py-2">
                                    {canManage ? (
                                      <Input
                                        value={s.size}
                                        onChange={(e) => updateSize(index, sIdx, "size", e.target.value)}
                                        placeholder="e.g. S, M, L"
                                        className="max-w-[10rem]"
                                      />
                                    ) : (
                                      <span className="text-slate-800">{s.size}</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    {canManage ? (
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        value={getBufferedValue(index, sIdx, "quantity", s.quantity)}
                                        onChange={(e) => setBufferedValue(index, sIdx, "quantity", e.target.value)}
                                        onBlur={() => commitNumber(index, sIdx, "quantity")}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitNumber(index, sIdx, "quantity");
                                          if (e.key === "Escape") clearBufferedValue(index, sIdx, "quantity");
                                          if (e.key === "ArrowUp") { e.preventDefault(); focusSizeCell(index, sIdx, "quantity", -1); }
                                          if (e.key === "ArrowDown") { e.preventDefault(); focusSizeCell(index, sIdx, "quantity", 1); }
                                        }}
                                        data-cell="size-quantity"
                                        data-rowindex={index}
                                        data-sizeindex={sIdx}
                                        className="w-24 mx-auto"
                                      />
                                    ) : (
                                      <span className="text-slate-800">{s.quantity}</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    {canFulfill ? (
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        value={getBufferedValue(index, sIdx, "fulfilled", s.fulfilled || 0)}
                                        onChange={(e) => setBufferedValue(index, sIdx, "fulfilled", e.target.value)}
                                        onBlur={() => commitNumber(index, sIdx, "fulfilled")}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitNumber(index, sIdx, "fulfilled");
                                          if (e.key === "Escape") clearBufferedValue(index, sIdx, "fulfilled");
                                          if (e.key === "ArrowUp") { e.preventDefault(); focusSizeCell(index, sIdx, "fulfilled", -1); }
                                          if (e.key === "ArrowDown") { e.preventDefault(); focusSizeCell(index, sIdx, "fulfilled", 1); }
                                        }}
                                        data-cell="size-fulfilled"
                                        data-rowindex={index}
                                        data-sizeindex={sIdx}
                                        className="w-24 mx-auto"
                                      />
                                    ) : (
                                      <span className="text-slate-800">{s.fulfilled || 0}</span>
                                    )}
                                  </td>
                                  <td className="py-2">
                                    {canManage ? (
                                      <select
                                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                                        value={s.status || "pending"}
                                        onChange={(e) => updateSize(index, sIdx, "status", e.target.value)}
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="fulfilled">Fulfilled</option>
                                        <option value="partial">Partial</option>
                                        <option value="substituted">Substituted</option>
                                      </select>
                                    ) : (
                                      <StatusBadge status={s.status} />
                                    )}
                                  </td>
                                  <td className="py-2 text-right">
                                    {canManage && (
                                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => removeSize(index, sIdx)}>
                                        Remove
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {productModalOpen && (
        <ShotProductAddModal
          open={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          canCreateProduct={false}
          onSubmit={handleProductQuickAdd}
        />
      )}

      {changeModalOpen && changeRowIndex != null && (
        <ShotProductAddModal
          open={changeModalOpen}
          onClose={() => {
            setChangeModalOpen(false);
            setChangeRowIndex(null);
          }}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          initialProduct={{
            familyId: items[changeRowIndex]?.familyId,
            colourId: items[changeRowIndex]?.colourId,
          }}
          canCreateProduct={false}
          onSubmit={handleChangeProduct}
        />
      )}
    </div>
  );
}
