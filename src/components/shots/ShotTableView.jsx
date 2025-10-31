import { memo, useMemo } from "react";
import { Button } from "../ui/button";
import { TagList } from "../ui/TagBadge";
import { toDateInputValue } from "../../lib/shotDraft";
import { normaliseShotStatus, shotStatusOptions } from "../../lib/shotStatus";

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
  canEditShots = false,
  selectedShotIds,
  onToggleSelect,
  onEditShot,
  focusedShotId = null,
  onFocusShot = null,
}) {
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
  } = viewPrefs || {};

  const selectionEnabled = typeof onToggleSelect === "function";
  const actionsEnabled = typeof onEditShot === "function" && canEditShots;

  const columns = useMemo(() => {
    const result = [];
    if (selectionEnabled) {
      result.push({ key: "select", label: "Select", width: "48px", align: "center" });
    }

    result.push({ key: "name", label: "Shot", width: "minmax(220px, 1.4fr)" });
    result.push({ key: "type", label: "Type", width: "minmax(120px, 0.7fr)" });
    result.push({ key: "status", label: "Status", width: "minmax(120px, 0.7fr)" });
    result.push({ key: "date", label: "Date", width: "minmax(120px, 0.6fr)" });

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
      result.push({ key: "actions", label: "Actions", width: "72px", align: "center" });
    }

    return result;
  }, [selectionEnabled, showLocation, showProducts, showTalent, showNotes, actionsEnabled]);

  const columnTemplate = useMemo(
    () => columns.map((column) => column.width || "1fr").join(" "),
    [columns]
  );

  const selectedIds = selectedShotIds instanceof Set ? selectedShotIds : null;

  return (
    <div
      className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="table"
      aria-label="Shots table view"
    >
      <div className="min-w-[960px]" role="rowgroup">
        <div
          className="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
          style={{ gridTemplateColumns: columnTemplate }}
          role="row"
        >
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={`px-3 py-2 ${column.align === "center" ? "text-center" : "text-left"}`}
            >
              {column.label}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => {
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

          return (
            <div
              key={shotId}
              role="row"
              className={`grid cursor-pointer items-start border-b border-slate-200 text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 ${
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
                    <div key={columnKey} role="cell" className="px-3 py-3 text-center">
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

                if (columnKey === "name") {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-900 dark:text-slate-100">
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

                if (columnKey === "type") {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {shot?.type || "—"}
                    </div>
                  );
                }

                if (columnKey === "status") {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                }

                if (columnKey === "date") {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {formattedDate || "—"}
                    </div>
                  );
                }

                if (columnKey === "location" && showLocation) {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300" title={locationName}>
                      {locationName || "Unassigned"}
                    </div>
                  );
                }

                if (columnKey === "products" && showProducts) {
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300">
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
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300">
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
                    <div key={columnKey} role="cell" className="px-3 py-3 text-slate-600 dark:text-slate-300">
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
                  return (
                    <div key={columnKey} role="cell" className="px-3 py-2 text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditShot?.(shot);
                        }}
                      >
                        Edit
                      </Button>
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
