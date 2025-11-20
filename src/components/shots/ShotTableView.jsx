import { memo, useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../ui/button";
import { TagList } from "../ui/TagBadge";
import { toDateInputValue } from "../../lib/shotDraft";
import { normaliseShotStatus, shotStatusOptions } from "../../lib/shotStatus";
import { getImageWithFallback, hasMultipleAttachments, getAttachmentCount } from "../../lib/imageHelpers";
import AppImage from "../common/AppImage";

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
}) {
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
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

  const columns = useMemo(() => {
    const result = [];
    if (selectionEnabled) {
      result.push({ key: "select", label: "Select", width: "48px", align: "center" });
    }

    // Core info columns
    if (showImage) result.push({ key: "image", label: "Image", width: "80px", align: "center" });
    if (showName) result.push({ key: "name", label: "Shot", width: "minmax(220px, 1.4fr)" });
    if (showType) result.push({ key: "type", label: "Type", width: "minmax(120px, 0.7fr)" });
    if (showStatus) result.push({ key: "status", label: "Status", width: "minmax(120px, 0.7fr)" });
    if (showDate) result.push({ key: "date", label: "Date", width: "minmax(120px, 0.6fr)" });

    if (showLocation) {
      result.push({ key: "location", label: "Location", width: "minmax(160px, 1fr)" });
    }
    if (showProducts) {
      result.push({ key: "products", label: "Products", width: "minmax(200px, 1.2fr)" });
    }
    if (showTalent) {
      result.push({ key: "talent", label: "Talent", width: "minmax(180px, 1fr)" });
    }
    if (showNotes) {
      result.push({ key: "notes", label: "Notes", width: "minmax(220px, 1.3fr)" });
    }

    if (actionsEnabled) {
      result.push({ key: "actions", label: "Actions", width: "120px", align: "center" });
    }

    return result;
  }, [
    selectionEnabled,
    actionsEnabled,
    // core visibility toggles
    showImage,
    showName,
    showType,
    showStatus,
    showDate,
    // extended visibility toggles
    showLocation,
    showProducts,
    showTalent,
    showNotes,
  ]);

  const columnTemplate = useMemo(
    () => columns.map((column) => column.width || "1fr").join(" "),
    [columns]
  );

  const selectedIds = selectedShotIds instanceof Set ? selectedShotIds : null;

  return (
    <div
      className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="table"
      aria-label="Shots table view"
    >
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
              className={`${densityConfig.tablePadding} ${densityConfig.tableRow} ${column.align === "center" ? "text-center" : "text-left"}`}
            >
              {column.label}
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

          // Get image data with product fallback (attachments → reference → product images)
          const { path: imagePath, style: imageStyle } = getImageWithFallback(shot, products);
          const multiImageCount = getAttachmentCount(shot);
          const showMultiImageBadge = hasMultipleAttachments(shot);

          return (
            <div
              key={shotId}
              role="row"
              className={`grid cursor-pointer items-start border-b border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 ${densityConfig.tableText} ${
                isSelected ? "bg-primary/5 dark:bg-primary/10" : "bg-transparent"
              } ${isFocused ? "outline outline-2 outline-primary/60 shadow-sm" : ""}`}
              style={{ gridTemplateColumns: columnTemplate }}
              aria-selected={isSelected}
              data-focused={isFocused ? "true" : undefined}
              onClick={() => onFocusShot?.(shot, { mirrorSelection: false })}
            >
              {columns.map((column) => {
                const columnKey = column.key;

                if (columnKey === "select" && selectionEnabled) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-center`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(shotId)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${shot?.name || "shot"}`}
                      />
                    </div>
                  );
                }

                if (columnKey === "image" && showImage) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-center`}>
                      <div className="relative inline-block w-16 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {imagePath ? (
                          <>
                            <AppImage
                              src={imagePath}
                              alt={shot?.name || "Shot"}
                              preferredSize={96}
                              loading="lazy"
                              className="w-full h-full"
                              imageClassName="w-full h-full object-cover"
                              style={imageStyle}
                              fallback={
                                <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                                  No image
                                </div>
                              }
                            />
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

                if (columnKey === "name" && showName) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-900 dark:text-slate-100`}>
                      <div className="font-semibold leading-5" title={shot?.name || "Unnamed shot"}>
                        {shot?.name || "Unnamed shot"}
                      </div>
                      {Array.isArray(shot?.tags) && shot.tags.length > 0 && (
                        <div className="mt-2">
                          <TagList tags={shot.tags} emptyMessage={null} />
                        </div>
                      )}
                    </div>
                  );
                }

                if (columnKey === "type" && showType) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {shot?.type || "—"}
                    </div>
                  );
                }

                if (columnKey === "status" && showStatus) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                }

                if (columnKey === "date" && showDate) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {formattedDate || "—"}
                    </div>
                  );
                }

                if (columnKey === "location" && showLocation) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`} title={locationName}>
                      {locationName || "Unassigned"}
                    </div>
                  );
                }

                if (columnKey === "products" && showProducts) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {productsSummary ? (
                        <p className="line-clamp-2 leading-5">{productsSummary}</p>
                      ) : (
                        <span className="text-xs text-slate-500">No products linked</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "talent" && showTalent) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
                      {talentSummary ? (
                        <p className="line-clamp-2 leading-5">{talentSummary}</p>
                      ) : (
                        <span className="text-xs text-slate-500">No talent assigned</span>
                      )}
                    </div>
                  );
                }

                if (columnKey === "notes" && showNotes) {
                  return (
                    <div key={columnKey} role="cell" className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-slate-600 dark:text-slate-300`}>
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
