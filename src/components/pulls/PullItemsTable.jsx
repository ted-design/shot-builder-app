// src/components/pulls/PullItemsTable.jsx
//
// Display pull items in a table with expandable size details, sorting,
// and action buttons.

import React, { useState } from "react";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/EmptyState";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import {
  getPullItemDisplayName,
  getTotalQuantity,
  getTotalFulfilled,
  calculateItemFulfillment,
} from "../../lib/pullItems";
import { hasPendingChangeOrders } from "../../lib/changeOrders";

const FulfillmentBadge = ({ status }) => {
  const badgeClass = {
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

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badgeClass}`}>
      {label}
    </span>
  );
};

function PullItemRow({
  item,
  index,
  onEdit,
  onDelete,
  onRequestChange,
  onToggleFulfillment,
  canManage,
  canFulfill,
  canRequestChange,
  expanded,
  onToggleExpand
}) {
  const totalQty = getTotalQuantity(item);
  const totalFulfilled = getTotalFulfilled(item);
  const fulfillmentStatus = calculateItemFulfillment(item);
  const displayGender = item.gender || "—";
  const hasPendingChanges = hasPendingChangeOrders(item);

  return (
    <>
      {/* Main Row */}
      <tr className="border-b border-slate-200 hover:bg-slate-50">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center p-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium text-slate-900">{getPullItemDisplayName(item)}</div>
              {item.styleNumber && (
                <div className="text-xs text-slate-500">Style: {item.styleNumber}</div>
              )}
            </div>
            {hasPendingChanges && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <AlertCircle className="h-3 w-3" />
                Pending Change
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-700">{displayGender}</td>
        <td className="px-4 py-3 text-center text-sm text-slate-700">{totalQty}</td>
        <td className="px-4 py-3 text-center text-sm text-slate-700">{totalFulfilled}</td>
        <td className="px-4 py-3">
          <FulfillmentBadge status={fulfillmentStatus} />
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            {canRequestChange && onRequestChange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRequestChange(item, index)}
                className="text-amber-600 hover:bg-amber-50"
              >
                Request Change
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onEdit(item, index)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(index)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Size Details */}
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-4 py-3">
            <div className="space-y-3">
              {/* Size Breakdown */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Size Breakdown
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-600">
                      {canFulfill && <th className="w-12 pb-2"></th>}
                      <th className="pb-2 text-left font-medium">Size</th>
                      <th className="pb-2 text-center font-medium">Requested</th>
                      <th className="pb-2 text-center font-medium">Fulfilled</th>
                      <th className="pb-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.sizes.map((size, sizeIndex) => (
                      <tr key={sizeIndex} className="border-b border-slate-100">
                        {canFulfill && (
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={size.fulfilled >= size.quantity}
                              onChange={() => onToggleFulfillment && onToggleFulfillment(index, sizeIndex)}
                              className="h-5 w-5 rounded border-slate-300 cursor-pointer"
                              aria-label={`Mark size ${size.size} as ${size.fulfilled >= size.quantity ? 'unfulfilled' : 'fulfilled'}`}
                            />
                          </td>
                        )}
                        <td className="py-2 text-slate-900">{size.size}</td>
                        <td className="py-2 text-center text-slate-700">{size.quantity}</td>
                        <td className="py-2 text-center text-slate-700">{size.fulfilled}</td>
                        <td className="py-2">
                          <FulfillmentBadge status={size.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {item.notes && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes
                  </h4>
                  <p className="text-sm text-slate-700">{item.notes}</p>
                </div>
              )}

              {/* Shot IDs */}
              {item.shotIds && item.shotIds.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Related Shots
                  </h4>
                  <p className="text-xs text-slate-600">
                    {item.shotIds.length} shot{item.shotIds.length === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Mobile Card View Component
function PullItemCard({
  item,
  index,
  onEdit,
  onDelete,
  onRequestChange,
  onToggleFulfillment,
  canManage,
  canFulfill,
  canRequestChange,
  expanded,
  onToggleExpand
}) {
  const totalQty = getTotalQuantity(item);
  const totalFulfilled = getTotalFulfilled(item);
  const fulfillmentStatus = calculateItemFulfillment(item);
  const displayGender = item.gender || "—";
  const hasPendingChanges = hasPendingChangeOrders(item);

  return (
    <div className="border-b border-slate-200 bg-white p-4">
      {/* Header with product name and expand button */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 mb-1">{getPullItemDisplayName(item)}</div>
          {item.styleNumber && (
            <div className="text-xs text-slate-500 mb-2">Style: {item.styleNumber}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600">Gender: {displayGender}</span>
            <span className="text-slate-300">•</span>
            <span className="text-sm text-slate-600">Qty: {totalQty}</span>
            <span className="text-slate-300">•</span>
            <span className="text-sm text-slate-600">Fulfilled: {totalFulfilled}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center p-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded shrink-0"
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Status and badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FulfillmentBadge status={fulfillmentStatus} />
        {hasPendingChanges && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Pending Change
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {canRequestChange && onRequestChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRequestChange(item, index)}
            className="text-amber-600 hover:bg-amber-50"
          >
            Request Change
          </Button>
        )}
        {canManage && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onEdit(item, index)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(index)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Remove
            </Button>
          </>
        )}
      </div>

      {/* Expanded size details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          {/* Size Breakdown */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Size Breakdown
            </h4>
            <div className="space-y-2">
              {item.sizes.map((size, sizeIndex) => (
                <div key={sizeIndex} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3 flex-1">
                    {canFulfill && (
                      <input
                        type="checkbox"
                        checked={size.fulfilled >= size.quantity}
                        onChange={() => onToggleFulfillment && onToggleFulfillment(index, sizeIndex)}
                        className="h-5 w-5 rounded border-slate-300 cursor-pointer shrink-0"
                        aria-label={`Mark size ${size.size} as ${size.fulfilled >= size.quantity ? 'unfulfilled' : 'fulfilled'}`}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-900">{size.size}</div>
                      <div className="text-xs text-slate-600">
                        Requested: {size.quantity} • Fulfilled: {size.fulfilled}
                      </div>
                    </div>
                  </div>
                  <FulfillmentBadge status={size.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </h4>
              <p className="text-sm text-slate-700">{item.notes}</p>
            </div>
          )}

          {/* Shot IDs */}
          {item.shotIds && item.shotIds.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Related Shots
              </h4>
              <p className="text-xs text-slate-600">
                {item.shotIds.length} shot{item.shotIds.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PullItemsTable({
  items,
  onEditItem,
  onDeleteItem,
  onRequestChange,
  onToggleFulfillment,
  canManage = true,
  canFulfill = false,
  canRequestChange = false,
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (index) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="No items yet"
        description={canManage ? "Click 'Add Item' above to start building your pull sheet." : "No items have been added to this pull yet."}
      />
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden rounded-lg border border-slate-200 overflow-hidden">
        {items.map((item, index) => (
          <PullItemCard
            key={item.id || index}
            item={item}
            index={index}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onRequestChange={onRequestChange}
            onToggleFulfillment={onToggleFulfillment}
            canManage={canManage}
            canFulfill={canFulfill}
            canRequestChange={canRequestChange}
            expanded={expandedRows.has(index)}
            onToggleExpand={() => toggleRow(index)}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                {/* Expand/Collapse */}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Gender
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                Total Qty
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fulfilled
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {items.map((item, index) => (
              <PullItemRow
                key={item.id || index}
                item={item}
                index={index}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
                onRequestChange={onRequestChange}
                onToggleFulfillment={onToggleFulfillment}
                canManage={canManage}
                canFulfill={canFulfill}
                canRequestChange={canRequestChange}
                expanded={expandedRows.has(index)}
                onToggleExpand={() => toggleRow(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
