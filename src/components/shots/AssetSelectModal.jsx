import React, { useMemo, useState, useRef } from "react";
import { Modal } from "../ui/modal";
import Avatar from "../ui/Avatar";
import Thumb from "../Thumb";
import { Button } from "../ui/button";

export default function AssetSelectModal({
  open,
  title = "Select Items",
  items = [],
  alreadyInProject = new Set(),
  onClose,
  onSave,
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.name || "").toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id, disabled) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!onSave) return;
    const ids = Array.from(selected).filter((id) => !alreadyInProject.has(id));
    if (!ids.length) {
      onClose?.();
      return;
    }
    try {
      setBusy(true);
      await onSave(ids);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="asset-select-title" contentClassName="max-w-4xl">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 id="asset-select-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
          <div className="text-xs text-slate-500">
            {selected.size} selected
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const disabled = alreadyInProject.has(item.id);
            const isSelected = selected.has(item.id);
            const imagePath = item.headshotPath || item.photoPath || item.imagePath || null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id, disabled)}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                  disabled
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed"
                    : isSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {imagePath ? (
                  <div className="h-8 w-8 overflow-hidden rounded-full">
                    <Thumb path={imagePath} size={128} alt={item.name || ""} className="h-8 w-8" imageClassName="h-full w-full object-cover" />
                  </div>
                ) : (
                  <Avatar name={item.name} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-900 dark:text-slate-100">{item.name || "Untitled"}</div>
                  {disabled && <div className="text-[10px] uppercase text-slate-500">In Project</div>}
                </div>
                {!disabled && (
                  <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSave} disabled={busy || selected.size === 0}>Save</Button>
      </div>
    </Modal>
  );
}
