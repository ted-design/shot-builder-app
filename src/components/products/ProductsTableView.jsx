// src/components/products/ProductsTableView.jsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productFamilyPath } from '../../lib/paths';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input, Checkbox } from '../ui/input';
import AppImage from '../common/AppImage';
import { Package } from 'lucide-react';
import { genderLabel } from '../../lib/productMutations';
import { getCategoryLabel } from '../../lib/productCategories';
import { toast } from '../../lib/toast';

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
 * @param {Function} props.onManageColours - Callback to open edit modal
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
  onManageColours,
  user,
  clientId,
  selectAllRef,
  renderActionMenu,
}) {
  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // { familyId, field }
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
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

  // Save status change (dropdown)
  const saveStatus = useCallback(async (familyId, newStatus) => {
    if (!canEdit) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, productFamilyPath(clientId, familyId)), {
        status: newStatus,
        updatedAt: Date.now(),
        updatedBy: user?.uid || null,
      });

      toast.success('Status updated');
    } catch (error) {
      console.error('[ProductsTableView] Status update failed:', error);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  }, [canEdit, user, clientId]);

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
      <select
        value={family.status || 'active'}
        onChange={(e) => saveStatus(family.id, e.target.value)}
        disabled={!canEdit || saving}
        className="h-8 rounded border border-slate-300 px-2 text-sm dark:bg-slate-800 dark:border-slate-600 disabled:opacity-50"
      >
        <option value="active">Active</option>
        <option value="discontinued">Discontinued</option>
      </select>
    );
  };

  const visibility = {
    preview: true,
    styleName: true,
    styleNumber: true,
    gender: true,
    category: true,
    status: true,
    colors: true,
    sizes: true,
    skus: true,
    ...(visibleFields || {}),
  };

  const defaultOrder = ["preview", "styleName", "styleNumber", "gender", "category", "status", "colors", "sizes", "skus", "lastUpdated"];
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
        <div className={`font-semibold text-slate-900 dark:text-slate-100 ${textClass}`}>
          {renderEditableCell(family, 'styleName', family.styleName)}
        </div>
      ),
    },
    styleNumber: {
      key: "styleNumber",
      label: "Style #",
      headerClassName: "min-w-[120px]",
      cellClassName: `${baseCellClass} min-w-[140px]`,
      render: (family) => (
        <div className={`text-slate-700 dark:text-slate-300 ${textClass}`}>
          {renderEditableCell(family, 'styleNumber', family.styleNumber)}
        </div>
      ),
    },
    gender: {
      key: "gender",
      label: "Gender",
      cellClassName: baseCellClass,
      render: (family) => (
        <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
          {genderLabel(family.gender)}
        </span>
      ),
    },
    category: {
      key: "category",
      label: "Category",
      headerClassName: "min-w-[180px]",
      cellClassName: `${baseCellClass} min-w-[180px]`,
      render: (family) => {
        const categoryPath = getCategoryLabel(family.gender, family.productType, family.productSubcategory);
        return (
          <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
            {categoryPath || "–"}
          </span>
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
      render: (_family, meta) => (
        <span className={`text-slate-600 dark:text-slate-400 ${textClass}`}>
          {meta.colourCount}
        </span>
      ),
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
                <th scope="col" className={`${baseHeaderClass} text-right`}>
                  Actions
                </th>
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
                  colourCount: colourList.length || family.colourCount || family.colorsCount || family.skus?.length || 0,
                  sizeList,
                  sizeSummary: sizeList.length ? `${sizeList[0]}-${sizeList[sizeList.length - 1]}` : "",
                  skuCounts: {
                    active: typeof family.activeSkuCount === "number" ? family.activeSkuCount : family.skuCount || 0,
                    total: typeof family.skuCount === "number" ? family.skuCount : family.skus?.length || 0,
                  },
                  updatedAtLabel,
                };

                return (
                  <tr
                    key={family.id}
                    className={`odd:bg-white even:bg-slate-50/40 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800 ${
                      isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
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

                    <td className={`${baseCellClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onManageColours(family)}
                          >
                            Manage
                          </Button>
                        )}
                        {renderActionMenu && renderActionMenu(family)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
