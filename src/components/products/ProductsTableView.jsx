// src/components/products/ProductsTableView.jsx
import { useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productFamilyPath } from '../../lib/paths';
import { Card, CardContent } from '../ui/card';
import { Input, Checkbox } from '../ui/input';
import AppImage from '../common/AppImage';
import { Package } from 'lucide-react';
import { genderLabel } from '../../lib/productMutations';
import { getCategoryLabel } from '../../lib/productCategories';
import { toast } from '../../lib/toast';
import { findPaletteMatch } from '../../lib/colorPalette';

const statusLabel = (status) => {
  if (status === "discontinued") return "Discontinued";
  return "Active";
};

/**
 * ProductsTableView - Compact table layout with inline editing
 *
 * Provides a data-focused table view of product families with inline editing
 * capabilities for Style Name, Style Number, and Status fields. Supports
 * density configuration for row height and padding.
 *
 * @param {Object} props
 * @param {Array} props.families - Array of product family objects
 * @param {Object} props.density - Density configuration object with tableRow props
 * @param {Object} props.visibleFields - Field visibility configuration
 * @param {Array<string>} props.fieldOrder - Preferred column order
 * @param {boolean} props.selectionModeActive - Whether selection mode is active
 * @param {Set} props.selectedFamilyIds - Set of selected family IDs
 * @param {Function} props.onToggleSelection - Callback for toggling selection
 * @param {Function} props.onSelectAll - Callback for select all
 * @param {boolean} props.allVisibleSelected - Whether all visible items are selected
 * @param {boolean} props.canEdit - Whether user can edit products
 * @param {boolean} props.canUseBatchActions - Whether user can use batch actions
 * @param {Object} props.user - Current user object
 * @param {string} props.clientId - Client ID for Firestore path
 * @param {React.Ref} props.selectAllRef - Ref for select all checkbox
 * @param {Function} props.renderActionMenu - Function to render action menu for a family
 */
export default function ProductsTableView({
  families,
  density,
  visibleFields,
  fieldOrder = [],
  selectionModeActive,
  selectedFamilyIds,
  onToggleSelection,
  onSelectAll,
  allVisibleSelected,
  canEdit,
  canUseBatchActions,
  user,
  clientId,
  selectAllRef,
  renderActionMenu,
  familySkus = {},
  ensureFamilySkus,
  paletteIndex = null,
}) {
  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // { familyId, field }
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());
  const [loadingFamilies, setLoadingFamilies] = useState(new Set());
  const inputRef = useRef(null);

  // Get density-based classes
  const densityConfig = density || {
    tableRow: 'py-2',
    tablePadding: 'px-4',
    tableText: 'text-sm',
  };

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Start editing a cell
  const startEdit = useCallback((familyId, field, currentValue) => {
    if (!canEdit) return;
    setEditingCell({ familyId, field });
    setEditValue(currentValue || '');
  }, [canEdit]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setSaving(false);
  }, []);

  // Save edited value
  const saveEdit = useCallback(async () => {
    if (!editingCell || saving) return;

    const { familyId, field } = editingCell;
    const trimmedValue = editValue.trim();

    // Validate required fields
    if (field === 'styleName' && !trimmedValue) {
      toast.error('Style name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        [field]: trimmedValue || null,
        updatedAt: Date.now(),
        updatedBy: user?.uid || null,
      };

      await updateDoc(doc(db, productFamilyPath(clientId, familyId)), updateData);

      cancelEdit();
      toast.success(`${field === 'styleName' ? 'Style name' : 'Style number'} updated`);
    } catch (error) {
      console.error('[ProductsTableView] Save failed:', error);
      toast.error('Failed to save changes');
      setSaving(false);
    }
  }, [editingCell, editValue, saving, user, clientId, cancelEdit]);

  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [saveEdit, cancelEdit]);

  // Render editable cell
  const renderEditableCell = (family, field, displayValue) => {
    const isEditing = editingCell?.familyId === family.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            disabled={saving}
            className="h-8 text-sm"
          />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => startEdit(family.id, field, displayValue)}
        className="w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1 -mx-2 -my-1 rounded transition"
        disabled={!canEdit}
      >
        {displayValue || '–'}
      </button>
    );
  };

  // Render status dropdown (inline editing)
  const renderStatusCell = (family) => {
    return (
      <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
        {statusLabel(family.status)}
      </span>
    );
  };

  const toggleColourRows = useCallback(async (familyId) => {
    if (expandedFamilies.has(familyId)) {
      setExpandedFamilies((prev) => {
        const next = new Set(prev);
        next.delete(familyId);
        return next;
      });
      return;
    }

    setLoadingFamilies((prev) => {
      const next = new Set(prev);
      next.add(familyId);
      return next;
    });

    if (ensureFamilySkus) {
      await ensureFamilySkus(familyId);
    }

    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      next.add(familyId);
      return next;
    });

    setLoadingFamilies((prev) => {
      const next = new Set(prev);
      next.delete(familyId);
      return next;
    });
  }, [ensureFamilySkus, expandedFamilies]);

  const visibility = {
    preview: true,
    styleName: true,
    styleNumber: true,
    category: true,
    status: true,
    colors: true,
    sizes: true,
    ...(visibleFields || {}),
  };

  const defaultOrder = ["preview", "styleName", "styleNumber", "category", "status", "colors", "sizes", "lastUpdated"];
  const normaliseOrder = (order) => {
    if (!Array.isArray(order)) return defaultOrder;
    const base = order.filter((key) => defaultOrder.includes(key));
    return [...base, ...defaultOrder.filter((key) => !base.includes(key))];
  };

  const columnOrder = normaliseOrder(fieldOrder);
  const selectionEnabled = canUseBatchActions && selectionModeActive;
  const baseHeaderClass = `${densityConfig.tablePadding} ${densityConfig.tableRow}`;
  const baseCellClass = `${densityConfig.tablePadding} ${densityConfig.tableRow} align-top`;
  const textClass = densityConfig.tableText || "";

  const columnMap = {
    preview: {
      key: "preview",
      label: "Preview",
      cellClassName: baseCellClass,
      render: (family, meta) =>
        meta.previewSource ? (
          <AppImage
            src={meta.previewSource}
            alt={family.styleName}
            preferredSize={320}
            className="h-16 w-12 overflow-hidden rounded"
            imageClassName="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-12 items-center justify-center rounded bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Package className="h-6 w-6" aria-hidden="true" />
            <span className="sr-only">No preview</span>
          </div>
        ),
    },
    styleName: {
      key: "styleName",
      label: "Style name",
      headerClassName: "min-w-[200px]",
      cellClassName: `${baseCellClass} min-w-[200px]`,
      render: (family) => (
        <div className="space-y-1">
          <div className={`font-semibold text-slate-900 dark:text-slate-100 ${textClass}`}>
            {renderEditableCell(family, 'styleName', family.styleName)}
          </div>
          {visibility.styleNumber !== false && (
            <button
              type="button"
              onClick={() => startEdit(family.id, 'styleNumber', family.styleNumber)}
              className="text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              disabled={!canEdit}
            >
              {family.styleNumber ? `Style #${family.styleNumber}` : "Add style #"}
            </button>
          )}
        </div>
      ),
    },
    category: {
      key: "category",
      label: "Category",
      headerClassName: "min-w-[200px]",
      cellClassName: `${baseCellClass} min-w-[200px]`,
      render: (family) => {
        const categoryPath = getCategoryLabel(family.gender, family.productType, family.productSubcategory);
        const showGender = visibility.gender !== false && family.gender;
        const showCategory = visibility.category !== false && categoryPath;
        return (
          <div className={`space-y-0.5 text-slate-600 dark:text-slate-400 ${textClass}`}>
            {showGender && <div>{genderLabel(family.gender)}</div>}
            {showCategory && <div className="text-xs text-slate-500 dark:text-slate-500">{categoryPath}</div>}
            {!showGender && !showCategory && <span>–</span>}
          </div>
        );
      },
    },
    status: {
      key: "status",
      label: "Status",
      cellClassName: baseCellClass,
      render: (family) => renderStatusCell(family),
    },
    colors: {
      key: "colors",
      label: "Colors",
      cellClassName: baseCellClass,
      render: (family, meta) => {
        const isExpanded = expandedFamilies.has(family.id);
        const isLoading = loadingFamilies.has(family.id);
        const swatchList = (familySkus[family.id] || []).map((sku) => {
          const paletteMatch = findPaletteMatch(sku, paletteIndex);
          return {
            id: sku.id,
            label: sku.colorName || "Colour",
            color: paletteMatch?.hexColor || sku.hexColor || "#CBD5E1",
            imagePath: paletteMatch?.swatchImagePath || null,
          };
        });
        const fallbackList = meta.colourList.map((name, index) => ({
          id: `${family.id}-${index}`,
          label: name,
          color: "#CBD5E1",
          imagePath: null,
        }));
        const circles = swatchList.length ? swatchList : fallbackList;
        const visibleCircles = circles.slice(0, 6);
        const overflow = circles.length - visibleCircles.length;

        return (
          <button
            type="button"
            onClick={() => toggleColourRows(family.id)}
            className="flex items-center gap-2 text-left"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {isLoading ? (
                <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>Loading…</span>
              ) : (
                <>
                  {visibleCircles.map((circle) => (
                    <span
                      key={circle.id}
                      className="relative inline-block h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-600"
                      style={{ backgroundColor: circle.color }}
                      title={circle.label}
                    >
                      {circle.imagePath && (
                        <AppImage
                          src={circle.imagePath}
                          alt=""
                          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                          imageClassName="h-full w-full rounded-full object-cover"
                          placeholder={null}
                          fallback={null}
                        />
                      )}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className={`text-xs text-slate-600 dark:text-slate-400 ${textClass}`}>
                      +{overflow}
                    </span>
                  )}
                </>
              )}
            </div>
            <span className={`text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400 ${textClass}`}>
              {isExpanded ? "Collapse" : "Expand"}
            </span>
          </button>
        );
      },
    },
    sizes: {
      key: "sizes",
      label: "Sizes",
      cellClassName: baseCellClass,
      render: (_family, meta) => (
        <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
          {meta.sizeSummary || "–"}
        </span>
      ),
    },
    skus: {
      key: "skus",
      label: "SKUs",
      cellClassName: baseCellClass,
      render: (_family, meta) => (
        <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
          {meta.skuCounts.active} / {meta.skuCounts.total}
        </span>
      ),
    },
    lastUpdated: {
      key: "lastUpdated",
      label: "Updated",
      cellClassName: baseCellClass,
      render: (_family, meta) => (
        <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
          {meta.updatedAtLabel || "–"}
        </span>
      ),
    },
  };

  const activeColumns = columnOrder
    .map((key) => columnMap[key])
    .filter((column) => column && visibility[column.key] !== false);
  const totalColumns = activeColumns.length + 1 + (selectionEnabled ? 1 : 0); // action + optional selection

  const formatUpdatedAt = (value) => {
    if (!value) return "";
    const date =
      value instanceof Date
        ? value
        : new Date(typeof value.toMillis === "function" ? value.toMillis() : value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="mx-6">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className={`${baseHeaderClass} w-10`}>
                  <span className="sr-only">Actions</span>
                </th>
                {selectionEnabled && (
                  <th scope="col" className={baseHeaderClass}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={allVisibleSelected}
                      onChange={onSelectAll}
                      aria-label="Select all visible product families"
                    />
                  </th>
                )}
                {activeColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${baseHeaderClass} ${column.headerClassName || ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {families.map((family) => {
                const isSelected = selectedFamilyIds.has(family.id);
                const previewSource =
                  family?.thumbnailImagePath ||
                  family?.headerImagePath ||
                  family?.images?.[0]?.path ||
                  family?.skus?.[0]?.imagePath ||
                  null;
                const colourList = Array.isArray(family?.colorNames)
                  ? family.colorNames.filter(Boolean)
                  : Array.isArray(family?.colours)
                    ? family.colours.filter(Boolean)
                    : [];
                const sizeList = Array.isArray(family?.sizeOptions)
                  ? family.sizeOptions.filter(Boolean)
                  : [];
                const updatedAtLabel = family.updatedAt ? formatUpdatedAt(family.updatedAt) : "";

                const meta = {
                  previewSource,
                  colourList,
                  colourCount:
                    colourList.length ||
                    (familySkus[family.id]?.length ?? 0) ||
                    family.colourCount ||
                    family.colorsCount ||
                    family.skus?.length ||
                    0,
                  sizeList,
                  sizeSummary: sizeList.length ? `${sizeList[0]}-${sizeList[sizeList.length - 1]}` : "",
                  skuCounts: {
                    active: typeof family.activeSkuCount === "number" ? family.activeSkuCount : family.skuCount || 0,
                    total: typeof family.skuCount === "number" ? family.skuCount : family.skus?.length || 0,
                  },
                  updatedAtLabel,
                };

                const isExpanded = expandedFamilies.has(family.id);
                const loadingColours = loadingFamilies.has(family.id);

                return (
                  <Fragment key={family.id}>
                    <tr
                      className={`odd:bg-white even:bg-slate-50/40 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800 ${
                        isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      <td className={`${baseCellClass} w-10`}>
                        {renderActionMenu && renderActionMenu(family)}
                      </td>

                      {selectionEnabled && (
                        <td className={baseCellClass}>
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => onToggleSelection(family.id, e.target.checked)}
                            aria-label={`Select ${family.styleName || 'product'}`}
                          />
                        </td>
                      )}

                      {activeColumns.map((column) => (
                        <td key={column.key} className={column.cellClassName || baseCellClass}>
                          {column.render(family, meta)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                        <td colSpan={totalColumns} className={`${baseCellClass} pt-3`}>
                          {loadingColours ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400">Loading colours…</div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {(familySkus[family.id] || []).map((sku) => (
                                <div key={sku.id} className="flex items-center gap-3">
                                  <div className="h-14 w-14 overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                                    {sku.imagePath ? (
                                      <AppImage
                                        src={sku.imagePath}
                                        alt={sku.colorName}
                                        preferredSize={200}
                                        className="h-full w-full"
                                        imageClassName="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 text-slate-700 dark:text-slate-200">
                                    <div className="font-medium">{sku.colorName || "Unnamed colour"}</div>
                                    {Array.isArray(sku.sizes) && sku.sizes.length > 0 && (
                                      <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Sizes: {sku.sizes.join(", ")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {(!familySkus[family.id] || familySkus[family.id].length === 0) && (
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  No colour data available.
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
