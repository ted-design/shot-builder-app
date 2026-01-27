// src/components/callsheet/entries/ShotPickerCard.jsx
// Rich shot card component for multi-select shot picker

import React from "react";
import { Image as ImageIcon, Check, Tag, Square, CheckSquare } from "lucide-react";
import { resolveShotShortDescriptionText } from "../../../lib/shotDescription";
import { getShotImagePath } from "../../../lib/imageHelpers";
import { getShotNotesPreview } from "../../../lib/shotNotes";
import AppImage from "../../common/AppImage";

/**
 * ShotPickerCard - Rich display card for shot selection with multi-select support
 *
 * @param {object} props
 * @param {object} props.shot - Shot object with resolved data
 * @param {boolean} props.isSelected - Whether checkbox is checked
 * @param {boolean} props.isAlreadyAdded - Whether shot is already in schedule
 * @param {Function} props.onToggle - Callback when selection toggled
 * @param {Map} props.talentMap - Map of talent ID to talent data
 * @param {Map} props.productsMap - Map of product ID to product data
 */
function ShotPickerCard({
  shot,
  isSelected,
  isAlreadyAdded,
  onToggle,
  talentMap = new Map(),
  productsMap = new Map(),
}) {
  // Resolve talent names
  const talentNames = (shot.talent || [])
    .map((id) => talentMap.get(id)?.name)
    .filter(Boolean);

  // Resolve product names with formatting
  // Note: shot.products is an array of product objects, not IDs
  const productNames = (shot.products || [])
    .map((product) => {
      if (!product) return null;
      // Product is already an object with productName, familyName, colourName, size
      let label = product.familyName || product.productName || "Product";
      if (product.colourName) label += ` - ${product.colourName}`;
      if (product.size) label += ` (${product.size})`;
      return label;
    })
    .filter(Boolean);

  // Get shot title (prefer name over shotNumber)
  const shotTitle = shot.name || `Shot ${shot.shotNumber || "—"}`;

  // Get description (strip HTML)
  const description = resolveShotShortDescriptionText(shot) || null;

  // Get notes preview
  const notes = getShotNotesPreview(shot) || null;

  // Get tags
  const tags = shot.tags || [];

  // Get image URL using correct schema (attachments or referenceImagePath)
  const imageUrl = getShotImagePath(shot);

  const handleClick = () => {
    if (!isAlreadyAdded) {
      onToggle(shot.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isAlreadyAdded ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex gap-4 rounded-lg border p-3 transition-all ${
        isAlreadyAdded
          ? "cursor-not-allowed border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-700 dark:bg-slate-800/50"
          : isSelected
          ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500 dark:border-amber-500 dark:bg-amber-950/20"
          : "cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
      }`}
    >
      {/* Checkbox */}
      <div className="flex flex-shrink-0 items-start pt-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select ${shotTitle}`}
          disabled={isAlreadyAdded}
          onClick={(e) => {
            e.stopPropagation();
            if (!isAlreadyAdded) onToggle(shot.id);
          }}
          className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
            isAlreadyAdded
              ? "opacity-50"
              : isSelected
              ? "text-amber-600 dark:text-amber-500"
              : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          }`}
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Thumbnail */}
      <div className="h-24 w-32 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700">
        {imageUrl ? (
          <AppImage
            src={imageUrl}
            alt={shotTitle}
            className="h-full w-full"
            imageClassName="h-full w-full object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
            }
            placeholder={
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-6 w-6 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
              </div>
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Header with title and badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-slate-900 dark:text-slate-100">
            {shotTitle}
          </h3>
          {isAlreadyAdded && (
            <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Added
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}

        {/* Products */}
        {productNames.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Products:{" "}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {productNames.slice(0, 3).join(", ")}
              {productNames.length > 3 && (
                <span className="text-slate-500"> +{productNames.length - 3} more</span>
              )}
            </span>
          </div>
        )}

        {/* Talent */}
        {talentNames.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Talent:{" "}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {talentNames.join(", ")}
            </span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.slice(0, 5).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              >
                <Tag className="h-2.5 w-2.5" />
                {typeof tag === "string" ? tag : tag.name || tag.label}
              </span>
            ))}
            {tags.length > 5 && (
              <span className="text-xs text-slate-500">+{tags.length - 5}</span>
            )}
          </div>
        )}

        {/* Notes preview */}
        {notes && !description && (
          <p className="line-clamp-1 text-sm italic text-slate-500 dark:text-slate-500">
            Notes: {notes}
          </p>
        )}
      </div>
    </div>
  );
}

export default ShotPickerCard;
