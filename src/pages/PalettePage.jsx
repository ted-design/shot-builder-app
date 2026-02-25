/**
 * PalettePage — R.13: Grid + Expand-Down Cockpit
 *
 * DESIGN PHILOSOPHY (R.13 Delta)
 * ================================
 * This page transforms Palette from a Rail + Side Inspector layout to a
 * Grid + Expand-Down Cockpit pattern, matching Products → Colorways behavior.
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - MAIN: Grid of swatch tiles (scannable, color-first)
 * - BELOW GRID: Cockpit panel expands when a swatch is selected
 *
 * R.13 CHANGES FROM R.11/R.12:
 * - Replaced left rail (SwatchRail) with a grid of SwatchTile components
 * - Replaced right canvas (SwatchDetailCanvas) with expand-down SwatchCockpit
 * - Moved search to header band
 * - All R.12 content (product lens, inline editing) preserved in cockpit
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/colorSwatches (via colorSwatchesPath)
 * - Real-time subscription via useColorSwatches hook
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useColorSwatches } from "../hooks/useColorSwatches";
import { useProducts } from "../hooks/useFirestoreQuery";
import { productFamilySkusPath } from "../lib/paths";
import {
  normalizeColorName,
  upsertColorSwatch,
  deleteColorSwatch,
} from "../lib/colorPalette";
import { isValidHexColor, extractColorFromFile } from "../lib/colorExtraction";
import { canEditProducts } from "../lib/rbac";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../lib/toast";
import AppImage from "../components/common/AppImage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import InlineEditField from "../components/profiles/InlineEditField";
import SingleImageDropzone from "../components/common/SingleImageDropzone";
import SwatchCreateModal from "../components/palette/SwatchCreateModal";
import { Link } from "react-router-dom";
import {
  Palette,
  Plus,
  Search,
  Clock,
  Pipette,
  Package,
  ChevronDown,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const normaliseAliases = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function formatLastUpdated(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============================================================================
// SWATCH TILE (Grid Item)
// ============================================================================

function SwatchTile({ swatch, isSelected, onClick, usageCount, tileRef }) {
  const name = (swatch.name || "Unnamed swatch").trim();
  const hexColor = swatch.hexColor || "#CBD5E1";
  const hasImage = Boolean(swatch.swatchImagePath);

  return (
    <button
      ref={tileRef}
      type="button"
      onClick={onClick}
      className={`
        group relative flex flex-col items-center p-2 rounded-lg transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-500 shadow-sm"
          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700"
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${name}${isSelected ? " (selected)" : ""}`}
    >
      {/* Color/Texture preview */}
      <div className={`
        w-14 h-14 rounded-md overflow-hidden transition-all
        ${isSelected ? "shadow-md" : "shadow-sm group-hover:shadow-md"}
      `}>
        {hasImage ? (
          <AppImage
            src={swatch.swatchImagePath}
            alt={name}
            preferredSize={112}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover"
            placeholder={null}
            fallback={
              <div
                className="w-full h-full"
                style={{ backgroundColor: hexColor }}
              />
            }
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: hexColor }}
          />
        )}
      </div>

      {/* Name */}
      <p className={`
        mt-1.5 text-xxs font-medium text-center truncate w-full max-w-[72px]
        ${isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
      `}>
        {name}
      </p>

      {/* Usage count badge */}
      {usageCount > 0 && (
        <span className="mt-0.5 text-3xs text-slate-400 dark:text-slate-500">
          {usageCount} product{usageCount !== 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// INLINE HEX COLOR EDITOR
// ============================================================================

function InlineHexColorEditor({ value, onChange, disabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || "");
    }
  }, [value, isEditing]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim().toUpperCase();

    if (trimmed && !isValidHexColor(trimmed)) {
      setError("Must be #RRGGBB format");
      return;
    }

    if (trimmed === (value || "").toUpperCase()) {
      setIsEditing(false);
      setError(null);
      return;
    }

    try {
      await onChange(trimmed || null);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err?.message || "Failed to save");
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(value || "");
      setError(null);
    } else if (e.key === "Enter") {
      handleSave();
    }
  }, [handleSave, value]);

  if (disabled) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="h-6 w-6 rounded border border-slate-300 dark:border-slate-700"
          style={{ backgroundColor: value || "#CBD5E1" }}
        />
        <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
          {value || "—"}
        </span>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-3 px-2 py-1 -mx-2 -my-1 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-all duration-150"
        title="Click to edit"
      >
        <div
          className="h-6 w-6 rounded border border-slate-300 dark:border-slate-700"
          style={{ backgroundColor: value || "#CBD5E1" }}
        />
        <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
          {value || "Click to add hex"}
        </span>
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="h-6 w-6 rounded border border-slate-300 dark:border-slate-700 flex-shrink-0"
          style={{ backgroundColor: isValidHexColor(editValue) ? editValue : "#CBD5E1" }}
        />
        <Input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="#RRGGBB"
          className="font-mono text-sm w-28 h-8"
          autoFocus
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// SWATCH COCKPIT (Expand-Down Panel)
// ============================================================================

function SwatchCockpit({
  swatch,
  canEdit,
  usageCount,
  families,
  onUpdateName,
  onUpdateHex,
  onUpdateAliases,
  onUpdateTexture,
  onDelete,
  onClose,
}) {
  const [textureFile, setTextureFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [samplingMode, setSamplingMode] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Reset state when swatch changes
  useEffect(() => {
    setTextureFile(null);
    setSamplingMode(false);
    setDetailsExpanded(false);
  }, [swatch?.colorKey]);

  // R.12: Compute products using this swatch
  const productsUsingColor = useMemo(() => {
    if (!swatch || !families) return [];
    const normalizedName = normalizeColorName(swatch.name);
    if (!normalizedName) return [];
    return families.filter((family) =>
      (family.colorNames || []).some(
        (cn) => normalizeColorName(cn) === normalizedName
      )
    );
  }, [swatch, families]);

  // Handle texture file change with auto-extraction
  const handleTextureChange = useCallback(async (file) => {
    setTextureFile(file);

    if (!file) return;

    // Auto-extract color from new image
    setExtracting(true);
    try {
      const extracted = await extractColorFromFile(file);
      if (extracted && onUpdateHex) {
        await onUpdateHex(extracted);
      }
    } catch (error) {
      console.error("Failed to extract color:", error);
    } finally {
      setExtracting(false);
    }

    // Save the texture
    if (onUpdateTexture) {
      await onUpdateTexture(file);
    }
  }, [onUpdateHex, onUpdateTexture]);

  // Sample color from image
  const handleImageClick = useCallback((e) => {
    if (!samplingMode) return;
    const imgElement = e.target;
    if (imgElement.tagName !== "IMG") return;

    try {
      const rect = imgElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scaleX = imgElement.naturalWidth / rect.width;
      const scaleY = imgElement.naturalHeight / rect.height;

      const pixelX = Math.floor(x * scaleX);
      const pixelY = Math.floor(y * scaleY);

      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      ctx.drawImage(imgElement, 0, 0);

      const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
      const [r, g, b] = imageData.data;

      const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };

      const sampledColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      if (onUpdateHex) {
        onUpdateHex(sampledColor);
      }
      setSamplingMode(false);
      toast.success(`Sampled color: ${sampledColor}`);
    } catch (error) {
      console.error("Failed to sample color:", error);
      toast.error("Unable to sample color from image");
      setSamplingMode(false);
    }
  }, [samplingMode, onUpdateHex]);

  if (!swatch) return null;

  const name = (swatch.name || "Unnamed swatch").trim();
  const aliasesString = Array.isArray(swatch.aliases) ? swatch.aliases.join(", ") : "";
  const hasImage = Boolean(swatch.swatchImagePath);
  const hexColor = swatch.hexColor || "#CBD5E1";

  return (
    <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</h3>
          <span className="text-3xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
            Swatch Workspace
          </span>
          {!canEdit && (
            <span className="text-3xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              View only
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Two-column layout: Identity | Content */}
      <div className="flex">
        {/* Left: Identity column */}
        <div className="flex-shrink-0 w-44 p-4 border-r border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          {/* Hero color/texture */}
          <div
            onClick={handleImageClick}
            className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 ${
              samplingMode ? "cursor-crosshair ring-2 ring-primary ring-offset-2" : ""
            }`}
          >
            {hasImage ? (
              <AppImage
                src={swatch.swatchImagePath}
                alt={name}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover"
                crossOrigin="anonymous"
                placeholder={null}
                fallback={
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: hexColor }}
                  />
                }
              />
            ) : (
              <div
                className="w-full h-full"
                style={{ backgroundColor: hexColor }}
              />
            )}
          </div>

          {/* Eye dropper toggle */}
          {canEdit && hasImage && (
            <div className="mt-2">
              <Button
                type="button"
                variant={samplingMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setSamplingMode(!samplingMode)}
                className="w-full gap-1.5 text-xs h-7"
              >
                <Pipette className="w-3.5 h-3.5" />
                {samplingMode ? "Click image" : "Eye dropper"}
              </Button>
            </div>
          )}

          {/* Minimal meta */}
          <div className="mt-3 space-y-2">
            <p className="text-2xs text-slate-400 dark:text-slate-500 truncate" title={swatch.colorKey}>
              Key: {swatch.colorKey}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3" />
              <span>{formatLastUpdated(swatch.updatedAt || swatch.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Right: Content area */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[min(60vh,560px)]">
          {/* Editable name */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            {canEdit && onUpdateName ? (
              <InlineEditField
                value={name}
                onSave={onUpdateName}
                placeholder="Enter swatch name"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                inputClassName="text-lg font-semibold"
              />
            ) : (
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {name}
              </h2>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              R.12: PRODUCTS SECTION — PRIMARY CONTENT
              ════════════════════════════════════════════════════════════════ */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Products Using This Color
              </h3>
              <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {usageCount}
              </span>
            </div>

            {productsUsingColor.length > 0 ? (
              <div className="space-y-1">
                {productsUsingColor.slice(0, 6).map((family) => {
                  const familyImage = family.thumbnailImagePath || family.headerImagePath;
                  return (
                    <Link
                      key={family.id}
                      to={`/products/${family.id}?returnTo=${encodeURIComponent('/library/palette')}`}
                      className="flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group"
                    >
                      {familyImage ? (
                        <AppImage
                          src={familyImage}
                          alt={family.styleName || "Product"}
                          className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0"
                          imageClassName="w-full h-full object-cover"
                          fallback={
                            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                          }
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                          {family.styleName || "Unnamed product"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors flex-shrink-0" />
                    </Link>
                  );
                })}
                {productsUsingColor.length > 6 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 pl-3">
                    +{productsUsingColor.length - 6} more products
                  </p>
                )}
              </div>
            ) : usageCount > 0 ? (
              <div className="py-4 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {usageCount} product{usageCount !== 1 ? "s" : ""} use this color name
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Products may be loading or filtered from the current view
                </p>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No products are using this color yet
                </p>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SWATCH DETAILS — SECONDARY CONTENT (Collapsible)
              ════════════════════════════════════════════════════════════════ */}
          <div className="border-b border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Swatch Details
              </span>
              {detailsExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {detailsExpanded && (
              <div className="px-4 pb-4 space-y-4">
                {/* Hex Color */}
                <div>
                  <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Hex Value
                  </p>
                  <InlineHexColorEditor
                    value={swatch.hexColor}
                    onChange={onUpdateHex}
                    disabled={!canEdit}
                  />
                </div>

                {/* Texture Image */}
                <div>
                  <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Texture Image
                  </p>

                  {/* Existing texture thumbnail with View action */}
                  {swatch.swatchImagePath && !textureFile && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                        <AppImage
                          src={swatch.swatchImagePath}
                          alt={name}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-cover"
                          fallback={
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: hexColor }}
                            />
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Current texture
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => {
                            // Open image in new tab for full view
                            window.open(swatch.swatchImagePath, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View full size
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload zone */}
                  {canEdit ? (
                    <div>
                      <SingleImageDropzone
                        value={textureFile}
                        onChange={handleTextureChange}
                        disabled={extracting}
                        showPreview={true}
                        existingImageUrl={null}
                      />
                      {extracting && (
                        <p className="mt-1.5 text-sm text-slate-500">
                          Extracting color...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      {!swatch.swatchImagePath && (
                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                          No texture image
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Aliases */}
                <div>
                  <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Alternative Names
                  </p>
                  {canEdit && onUpdateAliases ? (
                    <InlineEditField
                      value={aliasesString}
                      onSave={onUpdateAliases}
                      placeholder="Add aliases (comma-separated)"
                      className="text-sm"
                    />
                  ) : (
                    <p className={`text-sm ${aliasesString ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500 italic"}`}>
                      {aliasesString || "—"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DANGER ZONE — Delete
              ════════════════════════════════════════════════════════════════ */}
          {canEdit && (
            <div className="px-4 py-4">
              <h3 className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-3">
                Danger Zone
              </h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={usageCount > 0}
                title={usageCount > 0 ? "Cannot delete: swatch is in use by products" : "Delete this swatch"}
              >
                Delete Swatch
              </Button>
              {usageCount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  Relink SKUs before deleting this swatch.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER BAND (with search)
// ============================================================================

function PaletteHeaderBand({
  canEdit,
  onCreateClick,
  onSeedClick,
  seeding,
  swatchCount,
  searchQuery,
  onSearchChange,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Palette
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Standardize color swatches across products
            </p>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search swatches..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {swatchCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {swatchCount} {swatchCount === 1 ? "swatch" : "swatches"}
              </span>
            )}
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onSeedClick}
                  disabled={seeding}
                >
                  {seeding ? "Seeding..." : "Seed from products"}
                </Button>
                <Button onClick={onCreateClick} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  New swatch
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// FULL-PAGE EMPTY STATE
// ============================================================================

function PaletteEmptyState({ canEdit, onCreateClick }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <Palette className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No swatches yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Color swatches help you standardize colors across your product catalog.
          Create swatches manually or seed them from existing products.
        </p>
        {canEdit ? (
          <Button onClick={onCreateClick} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Create your first swatch
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Users with edit permissions can create swatches.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NO RESULTS STATE (for search)
// ============================================================================

function NoResultsState({ searchQuery }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <Search className="w-6 h-6 text-slate-300 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
        No matches found for "{searchQuery}"
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500">
        Try a different search term
      </p>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function PalettePage() {
  const { clientId, role } = useAuth();
  const canEdit = canEditProducts(role);
  const { swatches = [], paletteIndex, loading } = useColorSwatches(clientId);
  const { data: families = [] } = useProducts(clientId);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [seeding, setSeeding] = useState(false);

  // Refs for tiles and cockpit
  const tileRefs = useRef({});
  const cockpitRef = useRef(null);

  // Compute usage counts
  const usageCounts = useMemo(() => {
    const counts = new Map();
    families.forEach((family) => {
      (family.colorNames || []).forEach((colorName) => {
        const norm = normalizeColorName(colorName);
        if (!norm) return;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      });
    });
    return counts;
  }, [families]);

  // Filter swatches based on search
  const filteredSwatches = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return swatches;
    return swatches.filter((swatch) => {
      const aliases = Array.isArray(swatch.aliases) ? swatch.aliases : [];
      return (
        swatch.name?.toLowerCase().includes(term) ||
        aliases.some((alias) => alias.toLowerCase().includes(term))
      );
    });
  }, [swatches, searchQuery]);

  // Selected swatch
  const selectedSwatch = useMemo(() => {
    if (!selectedId) return null;
    return swatches.find((s) => s.colorKey === selectedId) || null;
  }, [swatches, selectedId]);

  const selectedUsageCount = useMemo(() => {
    if (!selectedSwatch) return 0;
    return usageCounts.get(normalizeColorName(selectedSwatch.name)) || 0;
  }, [selectedSwatch, usageCounts]);

  // Clear selection if selected swatch was deleted
  useEffect(() => {
    if (selectedId && !swatches.find((s) => s.colorKey === selectedId)) {
      setSelectedId(null);
    }
  }, [swatches, selectedId]);

  // Ref callback for each tile
  const setTileRef = useCallback((colorKey) => (el) => {
    tileRefs.current[colorKey] = el;
  }, []);

  // Scroll cockpit into view when opening
  useEffect(() => {
    if (!selectedId || !cockpitRef.current) return;

    let rafId1;
    let rafId2;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        const cockpit = cockpitRef.current;
        if (!cockpit) return;

        const rect = cockpit.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        const isBottomOffscreen = rect.bottom > viewportHeight - 40;
        const isTopOffscreen = rect.top < 0;

        if (isBottomOffscreen || isTopOffscreen) {
          cockpit.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [selectedId]);

  // Keyboard navigation for swatches when cockpit is open
  useEffect(() => {
    if (!selectedId || filteredSwatches.length === 0) return;

    const handleKeyDown = (event) => {
      const tag = event.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        event.target.isContentEditable
      ) {
        return;
      }

      const isLeft = event.key === "ArrowLeft";
      const isRight = event.key === "ArrowRight";

      if (!isLeft && !isRight) return;

      event.preventDefault();

      const currentIndex = filteredSwatches.findIndex((s) => s.colorKey === selectedId);
      if (currentIndex === -1) return;

      let nextIndex;
      if (isLeft) {
        nextIndex = currentIndex === 0 ? filteredSwatches.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === filteredSwatches.length - 1 ? 0 : currentIndex + 1;
      }

      const nextSwatch = filteredSwatches[nextIndex];
      if (nextSwatch) {
        setSelectedId(nextSwatch.colorKey);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, filteredSwatches]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleSelect = useCallback((colorKey) => {
    setSelectedId((prev) => (prev === colorKey ? null : colorKey));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleCreate = useCallback(async (draft) => {
    if (!canEdit) return;

    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    if (draft.hexColor && !isValidHexColor(draft.hexColor)) {
      toast.error("Hex must be in #RRGGBB format");
      return;
    }

    setSavingKey("new");
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name,
        hexColor: draft.hexColor || null,
        aliases: normaliseAliases(draft.aliases),
        swatchImageFile: draft.file || null,
      });
      toast.success(`Created ${name}`);
      setCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create swatch", error);
      toast.error(error?.message || "Unable to create swatch");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, clientId]);

  const handleUpdateName = useCallback(async (newName) => {
    if (!canEdit || !selectedSwatch) return;

    const trimmed = (newName || "").trim();
    if (!trimmed) {
      throw new Error("Name cannot be empty");
    }

    setSavingKey(selectedSwatch.colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name: trimmed,
        hexColor: selectedSwatch.hexColor || null,
        aliases: selectedSwatch.aliases || [],
        swatchImagePath: selectedSwatch.swatchImagePath || null,
      });
      toast.success("Name updated");
    } catch (error) {
      console.error("Failed to update name", error);
      throw new Error(error?.message || "Unable to update name");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, selectedSwatch, clientId]);

  const handleUpdateHex = useCallback(async (newHex) => {
    if (!canEdit || !selectedSwatch) return;

    setSavingKey(selectedSwatch.colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name: selectedSwatch.name,
        hexColor: newHex || null,
        aliases: selectedSwatch.aliases || [],
        swatchImagePath: selectedSwatch.swatchImagePath || null,
      });
      toast.success("Color updated");
    } catch (error) {
      console.error("Failed to update hex", error);
      throw new Error(error?.message || "Unable to update color");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, selectedSwatch, clientId]);

  const handleUpdateAliases = useCallback(async (newAliasesString) => {
    if (!canEdit || !selectedSwatch) return;

    const aliases = normaliseAliases(newAliasesString || "");

    setSavingKey(selectedSwatch.colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name: selectedSwatch.name,
        hexColor: selectedSwatch.hexColor || null,
        aliases,
        swatchImagePath: selectedSwatch.swatchImagePath || null,
      });
      toast.success("Aliases updated");
    } catch (error) {
      console.error("Failed to update aliases", error);
      throw new Error(error?.message || "Unable to update aliases");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, selectedSwatch, clientId]);

  const handleUpdateTexture = useCallback(async (file) => {
    if (!canEdit || !selectedSwatch) return;

    setSavingKey(selectedSwatch.colorKey);
    try {
      await upsertColorSwatch({
        db,
        clientId,
        name: selectedSwatch.name,
        hexColor: selectedSwatch.hexColor || null,
        aliases: selectedSwatch.aliases || [],
        swatchImageFile: file,
      });
      toast.success("Texture updated");
    } catch (error) {
      console.error("Failed to update texture", error);
      toast.error(error?.message || "Unable to update texture");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, selectedSwatch, clientId]);

  const handleDelete = useCallback(() => {
    if (!canEdit || !selectedSwatch) return;
    setDeleteConfirmOpen(true);
  }, [canEdit, selectedSwatch]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!canEdit || !selectedSwatch) return;

    if (selectedUsageCount > 0) {
      toast.error("Swatch is in use by products. Relink SKUs before deleting.");
      setDeleteConfirmOpen(false);
      return;
    }

    setSavingKey(selectedSwatch.colorKey);
    try {
      await deleteColorSwatch({
        db,
        clientId,
        colorKey: selectedSwatch.colorKey,
        swatchImagePath: selectedSwatch.swatchImagePath,
      });
      toast.success(`Deleted ${selectedSwatch.name}`);
      setDeleteConfirmOpen(false);
      setSelectedId(null);
    } catch (error) {
      console.error("Failed to delete swatch", error);
      toast.error(error?.message || "Unable to delete swatch");
    } finally {
      setSavingKey(null);
    }
  }, [canEdit, selectedSwatch, selectedUsageCount, clientId]);

  const handleSeed = useCallback(async () => {
    if (!clientId || !canEdit) return;
    setSeeding(true);
    try {
      const seen = new Map();

      // First pass: use already-loaded families (colorNames)
      families.forEach((family) => {
        (family.colorNames || []).forEach((name) => {
          const norm = normalizeColorName(name);
          if (!norm) return;
          if (paletteIndex?.byName?.has(norm)) return;
          if (!seen.has(norm)) {
            seen.set(norm, { name, hexColor: null });
          }
        });
      });

      // Optional best-effort: load SKUs for hex if allowed
      for (const family of families) {
        try {
          const skusSnap = await getDocs(
            collection(db, ...productFamilySkusPath(family.id, clientId))
          );
          skusSnap.forEach((skuDoc) => {
            const sku = skuDoc.data();
            const name = sku.colorName || "";
            const norm = normalizeColorName(name);
            if (!norm) return;
            if (paletteIndex?.byName?.has(norm)) return;
            if (seen.has(norm) && seen.get(norm)?.hexColor) return;
            const hex = isValidHexColor(sku.hexColor) ? sku.hexColor : null;
            seen.set(norm, { name: sku.colorName, hexColor: hex });
          });
        } catch (err) {
          continue;
        }
      }

      let created = 0;
      for (const { name, hexColor } of seen.values()) {
        await upsertColorSwatch({
          db,
          clientId,
          name,
          hexColor: hexColor || null,
        });
        created += 1;
      }
      toast.success(
        created
          ? `Seeded ${created} swatch${created === 1 ? "" : "es"} from products`
          : "No new swatches to seed"
      );
    } catch (error) {
      console.error("Failed to seed palette", error);
      if (error?.code === "permission-denied") {
        toast.error(
          "Insufficient permissions to create swatches. Please check Firestore rules or use an account with product edit rights."
        );
      } else {
        toast.error(error?.message || "Unable to seed palette");
      }
    } finally {
      setSeeding(false);
    }
  }, [clientId, canEdit, paletteIndex, families]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && swatches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading swatches...
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no swatches at all)
  if (!loading && swatches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <PaletteHeaderBand
          canEdit={canEdit}
          onCreateClick={() => setCreateModalOpen(true)}
          onSeedClick={handleSeed}
          seeding={seeding}
          swatchCount={0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <PaletteEmptyState
          canEdit={canEdit}
          onCreateClick={() => setCreateModalOpen(true)}
        />
        {canEdit && (
          <SwatchCreateModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSave={handleCreate}
            saving={savingKey === "new"}
          />
        )}
      </div>
    );
  }

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band with search */}
      <PaletteHeaderBand
        canEdit={canEdit}
        onCreateClick={() => setCreateModalOpen(true)}
        onSeedClick={handleSeed}
        seeding={seeding}
        swatchCount={swatches.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main content */}
      <div className="flex-1 px-6 py-6">
        {filteredSwatches.length > 0 ? (
          <>
            {/* Swatch grid — dense, scannable tiles */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1">
              {filteredSwatches.map((swatch) => (
                <SwatchTile
                  key={swatch.colorKey}
                  swatch={swatch}
                  isSelected={selectedId === swatch.colorKey}
                  onClick={() => handleSelect(swatch.colorKey)}
                  usageCount={usageCounts.get(normalizeColorName(swatch.name)) || 0}
                  tileRef={setTileRef(swatch.colorKey)}
                />
              ))}
            </div>

            {/* Cockpit panel — only when swatch selected */}
            {selectedSwatch && (
              <div ref={cockpitRef}>
                <SwatchCockpit
                  swatch={selectedSwatch}
                  canEdit={canEdit}
                  usageCount={selectedUsageCount}
                  families={families}
                  onUpdateName={handleUpdateName}
                  onUpdateHex={handleUpdateHex}
                  onUpdateAliases={handleUpdateAliases}
                  onUpdateTexture={handleUpdateTexture}
                  onDelete={handleDelete}
                  onClose={handleCloseDetail}
                />
              </div>
            )}
          </>
        ) : (
          <NoResultsState searchQuery={searchQuery} />
        )}
      </div>

      {/* Create Modal */}
      {canEdit && (
        <SwatchCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSave={handleCreate}
          saving={savingKey === "new"}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Swatch"
        message={
          selectedSwatch
            ? `Are you sure you want to delete "${selectedSwatch.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={savingKey === selectedSwatch?.colorKey}
      />
    </div>
  );
}
