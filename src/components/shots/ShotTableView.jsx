import { memo, useMemo, useRef, useState, useEffect } from "react";
import { ArrowUp, ArrowDown, ChevronDown, Check } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toDateInputValue } from "../../lib/shotDraft";
import { normaliseShotStatus, shotStatusOptions } from "../../lib/shotStatus";
import {
  resolveShotCoverWithCrop,
  getCropObjectPosition,
  getCropTransformStyle,
  hasMultipleAttachments,
  getAttachmentCount,
  getCoverSourceType,
  COVER_SOURCE,
  COVER_SOURCE_LABELS,
} from "../../lib/imageHelpers";
import AppImage from "../common/AppImage";
import { readStorage, writeStorage } from "../../lib/safeStorage";
import { TagBadge } from "../ui/TagBadge";

const STATUS_LABEL_MAP = new Map(shotStatusOptions.map(({ value, label }) => [value, label]));
const CLEAN_TAG_REGEX = /<[^>]+>/g;
const NBSP_REGEX = /&nbsp;/g;

const statusBadgeClasses = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  on_hold: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
};

const toPlainText = (html) => {
  if (!html) return "";
  return html
    .replace(NBSP_REGEX, " ")
    .replace(CLEAN_TAG_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const summariseProduct = (product) => {
  if (!product) return "";
  const name = product.familyName || product.name || product.styleNumber || product.skuCode || "Product";
  const detailParts = [];
  if (product.colourName) detailParts.push(product.colourName);
  if (product.size) detailParts.push(product.size);
  if (detailParts.length === 0) return name;
  return `${name} (${detailParts.join(" • ")})`;
};

const ShotTableView = memo(function ShotTableView({
  rows = [],
  viewPrefs,
  density,
  canEditShots = false,
  selectedShotIds,
  onToggleSelect,
  onEditShot,
  onMoveShotUp,
  onMoveShotDown,
  focusedShotId = null,
  onFocusShot = null,
  onRowReorder = null,
  onChangeStatus = null,
  multilineLists = false,
  persistKey = null,
}) {
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
    showTags = true,
    showImage = true,
    showName = true,
    showType = true,
    showStatus = true,
    showDate = true,
  } = viewPrefs || {};

  // Get density-based classes with defaults
  const densityConfig = density || {
    tableRow: 'py-3',
    tablePadding: 'px-4',
    tableText: 'text-sm',
  };

  const selectionEnabled = typeof onToggleSelect === "function";
  const editEnabled = typeof onEditShot === "function" && canEditShots;
  const moveEnabled = typeof onMoveShotUp === "function" || typeof onMoveShotDown === "function";
  const actionsEnabled = editEnabled || moveEnabled;

  // When both name and type are visible, consolidate into a single "shotInfo" column
  const consolidatedShotColumn = showName && showType;

  const columns = useMemo(() => {
    const addIf = (condition, item, list) => {
      if (condition) list.push(item);
    };
    const prefOrderDefault = [
      "image",
      "name",
      "type",
      "status",
      "date",
      "location",
      "products",
      "talent",
      "tags",
      "notes",
    ];
    const rawOrder = Array.isArray(viewPrefs?.fieldOrder) ? viewPrefs.fieldOrder : prefOrderDefault;
    const baseOrder = rawOrder.filter((k) => prefOrderDefault.includes(k));
    const order = [...baseOrder, ...prefOrderDefault.filter((k) => !baseOrder.includes(k))];

    const defs = {
      image: { key: "image", label: "Image", width: "80px", align: "center" },
      // When consolidated, use wider column for shot info
      name: { key: "name", label: "Shot", width: consolidatedShotColumn ? "minmax(240px, 1.6fr)" : "minmax(220px, 1.4fr)" },
      type: { key: "type", label: "Description", width: "minmax(120px, 0.7fr)" },
      status: { key: "status", label: "Status", width: "minmax(120px, 0.7fr)" },
      date: { key: "date", label: "Date", width: "minmax(120px, 0.6fr)" },
      location: { key: "location", label: "Location", width: "minmax(160px, 1fr)" },
      products: { key: "products", label: "Products", width: "minmax(200px, 1.2fr)" },
      talent: { key: "talent", label: "Talent", width: "minmax(180px, 1fr)" },
      tags: { key: "tags", label: "Tags", width: "minmax(160px, 0.9fr)" },
      notes: { key: "notes", label: "Notes", width: "minmax(220px, 1.3fr)" },
    };

    // Skip "type" column if consolidated into "name"
    const visibility = {
      image: showImage,
      name: showName,
      type: showType && !consolidatedShotColumn, // Skip if consolidated
      status: showStatus,
      date: showDate,
      location: showLocation,
      products: showProducts,
      talent: showTalent,
      tags: showTags,
      notes: showNotes,
    };

    const result = [];
    if (selectionEnabled || typeof onRowReorder === 'function') {
      result.push({ key: "util", label: "", width: selectionEnabled ? "56px" : "32px", align: "center" });
    }
    order.forEach((key) => addIf(Boolean(visibility[key]), defs[key], result));
    if (actionsEnabled) result.push({ key: "actions", label: "Actions", width: "120px", align: "center" });
    return result;
  }, [
    selectionEnabled,
    actionsEnabled,
    viewPrefs?.fieldOrder,
    showImage,
    showName,
    showType,
    showStatus,
    showDate,
    showLocation,
    showProducts,
    showTalent,
    showTags,
    showNotes,
    onRowReorder,
    consolidatedShotColumn,
  ]);

  // Column resizing (persisted per-project/tab when persistKey is provided)
  const [columnWidths, setColumnWidths] = useState(() => {
    if (!persistKey) return {};
    try {
      const raw = readStorage(persistKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }); // key -> px number
  const resizeState = useRef(null); // { key, startX, startWidth }
  const stopResize = () => {
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', stopResize);
    resizeState.current = null;
    document.body.style.cursor = '';
    document.body.classList.remove('select-none');
    document.body.style.userSelect = '';
  };
  const onResizeMove = (e) => {
    const ctx = resizeState.current;
    if (!ctx) return;
    const delta = e.clientX - ctx.startX;
    const next = Math.max(96, Math.min(640, ctx.startWidth + delta));
    setColumnWidths((w) => (w[ctx.key] === next ? w : { ...w, [ctx.key]: next }));
  };
  const startResize = (key, startX, startWidth) => {
    resizeState.current = { key, startX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', stopResize);
  };

  // Persist widths when changed
  useEffect(() => {
    if (!persistKey) return;
    try {
      writeStorage(persistKey, JSON.stringify(columnWidths));
    } catch {}
  }, [persistKey, columnWidths]);

  const columnTemplate = useMemo(() => {
    return columns
      .map((column) => {
        const key = column.key;
        if (Object.prototype.hasOwnProperty.call(columnWidths, key)) {
          const px = columnWidths[key];
          return `${px}px`;
        }
        return column.width || "1fr";
      })
      .join(" ");
  }, [columns, columnWidths]);

  const selectedIds = selectedShotIds instanceof Set ? selectedShotIds : null;
  const rootRef = useRef(null);
  const [liveMsg, setLiveMsg] = useState("");

  // HTML5 DnD helpers
  const [dragOver, setDragOver] = useState(null); // { index, before }
  const dragGhostRef = useRef(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const dragCtxRef = useRef({ name: '', from: -1 });
  const handleDragStart = (event, index, shot) => {
    try {
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.effectAllowed = "move";
      setIsGrabbing(true);
      dragCtxRef.current = { name: shot?.name || 'Shot', from: index };
      setLiveMsg(`Reordering ${dragCtxRef.current.name}`);
      // Visible drag ghost
      const rowEl = event.currentTarget.closest('[role="row"]');
      const width = Math.min(800, rowEl?.offsetWidth || 480);
      const height = rowEl?.offsetHeight || 40;
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.left = '-9999px';
      ghost.style.top = '-9999px';
      ghost.style.zIndex = '99999';
      ghost.style.width = `${width}px`;
      ghost.style.height = `${height}px`;
      ghost.style.boxSizing = 'border-box';
      ghost.style.padding = '6px 12px';
      ghost.style.borderRadius = '8px';
      ghost.style.background = 'rgba(99, 102, 241, 0.15)'; /* primary/indigo-ish */
      ghost.style.border = '1px solid rgba(99, 102, 241, 0.5)';
      ghost.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
      ghost.style.color = '#0f172a';
      ghost.style.fontSize = '12px';
      ghost.style.fontWeight = '600';
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.gap = '8px';
      const text = document.createElement('div');
      text.textContent = (shot?.name || 'Shot');
      ghost.appendChild(text);
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, 12, Math.floor(height / 2));
    } catch (_) {}
  };
  const handleDragOver = (event) => {
    if (!onRowReorder) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (event, toIndex) => {
    if (!onRowReorder) return;
    event.preventDefault();
    const fromRaw = event.dataTransfer.getData("text/plain");
    const fromIndex = Number(fromRaw);
    if (Number.isFinite(fromIndex) && Number.isFinite(toIndex) && fromIndex !== toIndex) {
      onRowReorder(fromIndex, toIndex);
      const name = dragCtxRef.current?.name || 'Row';
      setLiveMsg(`${name} moved to position ${toIndex + 1}`);
    }
    setIsGrabbing(false);
    if (dragGhostRef.current) { try { document.body.removeChild(dragGhostRef.current); } catch {} dragGhostRef.current = null; }
  };

  return (
    <div
      ref={rootRef}
      className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="table"
      aria-label="Shots table view"
    >
      <div className="sr-only" aria-live="polite">{liveMsg}</div>
      <div className="min-w-[960px]" role="rowgroup">
        <div
          className={`grid border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200 ${densityConfig.tableText}`}
          style={{ gridTemplateColumns: columnTemplate }}
          role="row"
        >
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={`${densityConfig.tablePadding} ${densityConfig.tableRow} relative ${column.align === "center" ? "text-center" : "text-left"}`}
            >
              {column.label}
              {/* Resize handle for non-utility columns */}
              {!['util','actions','image'].includes(column.key) && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={(e) => {
                    if (e.button !== 0) return; // left click only
                    e.preventDefault();
                    const startWidth = e.currentTarget.parentElement?.offsetWidth || 120;
                    startResize(column.key, e.clientX, startWidth);
                  }}
                  onDoubleClick={() => {
                    // Auto-fit: measure content cells for this column within this table
                    try {
                      const cells = rootRef.current?.querySelectorAll(`[role="row"] [data-col="${column.key}"]`);
                      let max = 0;
                      cells?.forEach((cell) => {
                        const el = cell;
                        const w = el.scrollWidth || el.offsetWidth || 0;
                        if (w > max) max = w;
                      });
                      const padded = Math.min(640, Math.max(96, max + 24));
                      setColumnWidths((w) => ({ ...w, [column.key]: padded }));
                      setLiveMsg(`${column.label || 'Column'} auto-fitted`);
                    } catch {}
                  }}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-slate-300/20"
                  title="Drag to resize column"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row, rowIndex) => {
          const { shot, products, talent, notesHtml, locationName } = row;
          const shotId = shot?.id || row.id;
          const isSelected = selectedIds ? selectedIds.has(shotId) : false;
          const isFocused = focusedShotId ? shotId === focusedShotId : false;
          const statusValue = normaliseShotStatus(shot?.status);
          const statusLabel = STATUS_LABEL_MAP.get(statusValue) || shot?.status || "—";
          const statusClass = statusBadgeClasses[statusValue] || statusBadgeClasses.todo;
          const formattedDate = toDateInputValue(shot?.date);
          const productsSummary = Array.isArray(products)
            ? products
                .map(summariseProduct)
                .filter(Boolean)
                .join(", ")
            : "";
          const talentSummary = Array.isArray(talent)
            ? talent
                .map((entry) => entry?.name)
                .filter(Boolean)
                .join(", ")
            : "";
          const notesPlain = toPlainText(notesHtml);
          const tagLabels = Array.isArray(shot?.tags)
            ? shot.tags.map((t) => t?.label).filter(Boolean)
            : [];
          const tagsSummary = tagLabels.join(", ");

          // S.4: Get image data with crop support
          const { path: imagePath, cropData } = resolveShotCoverWithCrop(shot, products);
          // S.4.1: Apply full crop transform (zoom/rotation) when present
          const hasCropTransform = cropData && (cropData.zoom !== 1 || cropData.rotation !== 0);
          const cropTransformStyle = hasCropTransform ? getCropTransformStyle(cropData) : undefined;
          const imagePosition = !hasCropTransform ? getCropObjectPosition(cropData) : undefined;
          const multiImageCount = getAttachmentCount(shot);
          const showMultiImageBadge = hasMultipleAttachments(shot);

          // S.3: Cover source indicator (only show for non-auto sources)
          const coverSourceType = getCoverSourceType(shot);
          const showCoverSourceBadge = coverSourceType !== COVER_SOURCE.AUTO;

          return (
            <div
              key={shotId}
              role="row"
              tabIndex={0}
              className={`group relative grid cursor-pointer items-start border-b border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none ${densityConfig.tableText} ${
                isSelected ? "bg-primary/5 dark:bg-primary/10" : "bg-transparent"
              } ${isFocused ? "ring-2 ring-primary/60 shadow-sm" : ""}`}
              style={{ gridTemplateColumns: columnTemplate }}
              aria-selected={isSelected}
              data-focused={isFocused ? "true" : undefined}
              onClick={() => onFocusShot?.(shot, { mirrorSelection: false })}
              onKeyDown={(e) => {
                // Allow Enter/Space to activate (navigate) like a click
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onFocusShot?.(shot, { mirrorSelection: false });
                }
              }}
              onDragOver={(e) => {
                if (!onRowReorder) return;
                // Visual insert cue based on mouse position
                const rect = e.currentTarget.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const before = e.clientY < mid;
                e.preventDefault();
                setDragOver({ index: rowIndex, before });
              }}
              onDrop={(e) => {
                if (!onRowReorder) return;
                const fromRaw = e.dataTransfer.getData('text/plain');
                const fromIndex = Number(fromRaw);
                const before = dragOver?.index === rowIndex ? dragOver.before : true;
                const toIndex = before ? rowIndex : rowIndex + 1;
                handleDrop(e, toIndex);
                setDragOver(null);
              }}
              onDragLeave={() => setDragOver(null)}
            >
              {/* Insert indicator */}
              {dragOver && dragOver.index === rowIndex && (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute left-0 right-0 ${dragOver.before ? 'top-0' : 'bottom-0'} h-0.5 bg-primary`}
                />)
              }
              {columns.map((column) => {
                const columnKey = column.key;

                if (columnKey === 'util') {
                  return (
                    <div key="util" role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} flex items-center justify-center gap-1`} onDragEnd={() => { setDragOver(null); setIsGrabbing(false); if (dragGhostRef.current) { try { document.body.removeChild(dragGhostRef.current); } catch {} dragGhostRef.current = null; } }}>
                      {typeof onRowReorder === 'function' && (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handleDragStart(e, rowIndex, shot)}
                          onDragEnd={() => { if (dragGhostRef.current) { try { document.body.removeChild(dragGhostRef.current); } catch {} dragGhostRef.current = null; } }}
                          onKeyDown={(e) => {
                            if (!onRowReorder) return;
                            const isUp = e.key === 'ArrowUp';
                            const isDown = e.key === 'ArrowDown';
                            if ((e.altKey || e.metaKey || e.ctrlKey) && (isUp || isDown)) {
                              e.preventDefault();
                              const from = rowIndex;
                              const to = Math.max(0, from + (isUp ? -1 : 1));
                              if (to !== from) onRowReorder(from, to);
                            }
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label={`Drag ${shot?.name || 'shot'} to reorder`}
                          aria-grabbed={isGrabbing ? 'true' : 'false'}
                          title="Drag to reorder (Alt+↑/↓ to move)"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Dot grip to mirror screenshot */}
                          <span className="pointer-events-none inline-grid grid-cols-2 grid-rows-3 gap-x-0.5 gap-y-0.5 opacity-70 group-hover:opacity-100">
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                          </span>
                        </button>
                      )}
                      {selectionEnabled && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(shotId)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${shot?.name || 'shot'}`}
                        />
                      )}
                    </div>
                  );
                }

                if (columnKey === "image" && showImage) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-center`}>
                      <div className="relative inline-flex items-center justify-center w-16 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {imagePath ? (
                          <>
                            <AppImage
                              src={imagePath}
                              alt={shot?.name || "Shot"}
                              preferredSize={96}
                              loading="lazy"
                              className="w-full h-full flex items-center justify-center"
                              imageClassName={hasCropTransform ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain"}
                              imageStyle={cropTransformStyle}
                              position={imagePosition}
                              fallback={
                                <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                                  No image
                                </div>
                              }
                            />
                            {/* S.3: Cover source indicator (top-left) */}
                            {showCoverSourceBadge && (
                              <div
                                className={`absolute top-0 left-0 rounded-br-sm px-1 py-0.5 text-[7px] font-semibold leading-none ${
                                  coverSourceType === COVER_SOURCE.REFERENCE
                                    ? "bg-amber-500 text-white"
                                    : "bg-violet-500 text-white"
                                }`}
                                title={coverSourceType === COVER_SOURCE.REFERENCE
                                  ? "Cover from selected reference"
                                  : "Cover from hero product"
                                }
                              >
                                {COVER_SOURCE_LABELS[coverSourceType]}
                              </div>
                            )}
                            {showMultiImageBadge && (
                              <div className="absolute bottom-0 right-0 rounded-tl-sm bg-black/70 px-1 py-0.5 text-[8px] font-medium text-white leading-none">
                                {multiImageCount}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                            No image
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (columnKey === "tags" && showTags) {
                  const shotTags = Array.isArray(shot?.tags) ? shot.tags.filter(t => t?.label) : [];
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                      {shotTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {shotTags.map((tag) => (
                            <TagBadge key={tag.id || tag.label} tag={tag} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "name" && showName) {
                  // When consolidated, show both name and description in this column
                  const showDescriptionHere = consolidatedShotColumn && shot?.type;
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-900 dark:text-slate-100`}>
                      <div className="font-semibold leading-5 truncate" title={shot?.name || "Unnamed shot"}>
                        {shot?.name || "Unnamed shot"}
                      </div>
                      {showDescriptionHere && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={shot.type}>
                          {shot.type}
                        </div>
                      )}
                    </div>
                  );
                }

                if (columnKey === "type" && showType && !consolidatedShotColumn) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {shot?.type || "—"}
                    </div>
                  );
                }

                if (columnKey === "status" && showStatus) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                      {typeof onChangeStatus === 'function' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${statusClass}`}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Change status for ${shot?.name || 'shot'}`}
                            >
                              <span>{statusLabel}</span>
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                            {shotStatusOptions.map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() => onChangeStatus(shot, opt.value)}
                                className="flex items-center gap-2"
                              >
                                <span className="flex-1">{opt.label}</span>
                                {opt.value === statusValue && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "date" && showDate) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {formattedDate || "—"}
                    </div>
                  );
                }

                if (columnKey === "location" && showLocation) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`} title={locationName}>
                      {locationName || "Unassigned"}
                    </div>
                  );
                }

                if (columnKey === "products" && showProducts) {
                  const productLines = Array.isArray(products)
                    ? products.map(summariseProduct).filter(Boolean)
                    : [];
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {productLines.length ? (
                        <div className="space-y-0.5 leading-5">
                          {productLines.map((line, i) => (
                            <div key={i} className="truncate text-xs" title={line}>{line}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No products linked</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "talent" && showTalent) {
                  const talentLines = Array.isArray(talent)
                    ? talent.map((t) => t?.name).filter(Boolean)
                    : [];
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {multilineLists ? (
                        talentLines.length ? (
                          <div className="space-y-1 leading-5">
                            {talentLines.map((line, i) => (
                              <div key={i} className="truncate" title={line}>{line}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">No talent assigned</span>
                        )
                      ) : talentSummary ? (
                        <p className="line-clamp-2 leading-5">{talentSummary}</p>
                      ) : (
                        <span className="text-xs text-slate-500">No talent assigned</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "notes" && showNotes) {
                  return (
                    <div key={columnKey} role="cell" data-col={columnKey} className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {notesPlain ? (
                        <p className="line-clamp-2 leading-5" title={notesPlain}>
                          {notesPlain}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-500">No notes</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "actions" && actionsEnabled) {
                  const isFirst = rowIndex === 0;
                  const isLast = rowIndex === rows.length - 1;
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-center`}>
                      {moveEnabled && (
                        <span className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isFirst}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMoveShotUp?.(shot, rowIndex);
                            }}
                            aria-label={`Move ${shot?.name || 'shot'} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isLast}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMoveShotDown?.(shot, rowIndex);
                            }}
                            aria-label={`Move ${shot?.name || 'shot'} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </span>
                      )}
                      {editEnabled && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="ml-1"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditShot?.(shot);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ShotTableView;
