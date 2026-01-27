/**
 * ShotLooksCanvas - Decision surface for Look Options with products and hero selection
 *
 * DESIGN PHILOSOPHY
 * =================
 * This is a visual decision surface, not a data table. Users can:
 * - Create Look Options (A, B, C) to explore styling alternatives
 * - Add products to each option via the existing ShotProductSelectorModal
 * - Designate one product as HERO per option (identity anchor)
 *
 * PATTERNS REUSED
 * ===============
 * - Product selection: ShotProductSelectorModal (same as ShotsPage)
 * - Product data shape: shotProductSchema from schemas/shot.js
 * - Audit fields: updatedAt, serverTimestamp() pattern from ShotNotesCanvas
 * - Activity logging: logActivity from lib/activityLogger
 *
 * DATA MODEL
 * ==========
 * shot.looks: Array<{
 *   id: string,
 *   label: "Option A" | "Option B" | "Option C" | ...,
 *   products: ShotProduct[],      // Same shape as shot.products
 *   heroProductId: string | null, // productId of hero product
 *   order: number,                // Display order
 *   references: Array<{           // Reference images (F.1)
 *     id: string,
 *     path: string,
 *     downloadURL: string,
 *     uploadedAt: number,
 *     uploadedBy: string
 *   }>,
 *   displayImageId: string | null // Reference ID designated as shot's display image (F.5)
 * }>
 *
 * NOTES:
 * - Looks are stored separately from shot.products (coexist without breaking existing usage)
 * - Hero product colorway drives header display AND auto-fills shot.description for e-comm shots
 *   (per UX.Shots.HeroAutoFillWriteThrough delta)
 * - displayImageId: ONE reference per look can be designated as the shot's display image
 *   (used in shots table/gallery; inside editor all references remain peers)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { db, uploadImageFile } from "../../../lib/firebase";
import { shotsPath, productFamiliesPath, productFamilySkusPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import { shouldAutoFillDescriptionOnHeroChange } from "../../../lib/shotDescription";
import { compressImageFile } from "../../../lib/images";
import { showConfirm } from "../../../lib/toast";
import { queryKeys } from "../../../hooks/useFirestoreQuery";
import ShotProductSelectorModal from "../ShotProductSelectorModal";
import AdvancedImageCropEditor from "../AdvancedImageCropEditor";
import AppImage from "../../common/AppImage";
import { Button } from "../../ui/button";
import {
  Sparkles,
  Plus,
  Star,
  Trash2,
  Eye,
  Loader2,
  Check,
  AlertCircle,
  ImageIcon,
  Upload,
  X,
  RotateCcw,
  Image,
  Package,
  Wand2,
  Crop,
} from "lucide-react";
import {
  getCoverSourceType,
  COVER_SOURCE,
  getCropTransformStyle,
  getCropObjectPosition,
} from "../../../lib/imageHelpers";

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * LOOK LABEL CONFIGURATION
 * Per design-spec.md: A shot has ONE primary Look and zero or more alternates.
 * - order === 0 → "Primary"
 * - order === 1 → "Alt A"
 * - order === 2 → "Alt B"
 * - etc.
 */
function getLookLabel(order) {
  if (order === 0) return "Primary";
  // Alt A, Alt B, Alt C, ...
  return `Alt ${String.fromCharCode(64 + order)}`;
}

// Legacy labels (kept for backward compatibility during transition)
const OPTION_LABELS = ["Option A", "Option B", "Option C", "Option D", "Option E"];

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a simple unique ID for look options
 */
function generateLookId() {
  return `look_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty look option
 */
function createEmptyLook(order) {
  const label = OPTION_LABELS[order] || `Option ${String.fromCharCode(65 + order)}`;
  return {
    id: generateLookId(),
    label,
    products: [],
    heroProductId: null,
    order,
  };
}

/**
 * Generate a unique ID for reference images
 */
function generateReferenceId() {
  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recursively removes undefined values from an object or array.
 * Firestore rejects documents containing undefined values, so we strip them
 * before saving. This is scoped to this file to handle looks array sanitization.
 *
 * - For arrays: recursively processes each item
 * - For objects: creates a new object excluding keys with undefined values
 * - Primitives pass through unchanged
 */
function sanitizeForFirestore(value) {
  if (value === undefined) {
    return null; // Convert top-level undefined to null (shouldn't happen, but safety)
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore);
  }
  if (typeof value === "object" && value !== null) {
    const result = {};
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (v !== undefined) {
        result[key] = sanitizeForFirestore(v);
      }
      // Omit keys with undefined values entirely
    }
    return result;
  }
  // Primitives (string, number, boolean) pass through
  return value;
}

/**
 * Build a shot product payload from selector modal selection
 * Reuses the same pattern from ShotsPage.jsx buildShotProduct
 */
function buildShotProductFromSelection(selection) {
  const { family, colour, size, sizeScope, status, allocation } = selection;

  return {
    productId: family.id,
    productName: family.styleName || family.name || "Unknown Product",
    styleNumber: family.styleNumber || null,
    colourId: colour?.id || null,
    colourName: colour?.colorName || colour?.colourName || null,
    colourImagePath: colour?.imagePath || null,
    thumbnailImagePath: family.thumbnailImagePath || family.headerImagePath || null,
    size: size || null,
    sizeScope: sizeScope || "all",
    status: status || "complete",
    allocation: allocation || null,
  };
}

// ============================================================================
// TRUST INDICATOR (reused pattern from ShotNotesCanvas)
// ============================================================================

function TrustIndicator({ status }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Saving...</span>
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500">
        <Check className="w-3 h-3" />
        <span>Saved</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
        <AlertCircle className="w-3 h-3" />
        <span>Error</span>
      </span>
    );
  }
  return null;
}

// ============================================================================
// COVER SOURCE INDICATOR (S.3)
// Shows which source is providing the shot's cover image + Reset to Auto
// ============================================================================

const COVER_SOURCE_CONFIG = {
  [COVER_SOURCE.REFERENCE]: {
    label: "Reference",
    shortLabel: "REF",
    icon: Image,
    colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40",
    description: "Cover from selected reference image",
  },
  [COVER_SOURCE.HERO_PRODUCT]: {
    label: "Hero Product",
    shortLabel: "HERO",
    icon: Package,
    colorClass: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40",
    description: "Cover from hero product image",
  },
  [COVER_SOURCE.AUTO]: {
    label: "Auto",
    shortLabel: "AUTO",
    icon: Wand2,
    colorClass: "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    description: "Cover auto-selected from available images",
  },
};

function CoverSourceIndicator({ shot, onResetToAuto, readOnly }) {
  const sourceType = getCoverSourceType(shot);
  const config = COVER_SOURCE_CONFIG[sourceType] || COVER_SOURCE_CONFIG[COVER_SOURCE.AUTO];
  const Icon = config.icon;
  const canReset = sourceType !== COVER_SOURCE.AUTO;

  return (
    <div className="flex items-center gap-2">
      {/* Current source badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${config.colorClass}`}
        title={config.description}
      >
        <Icon className="w-3 h-3" />
        <span>Cover: {config.label}</span>
      </div>

      {/* Reset to Auto button (only shown when not already auto) */}
      {!readOnly && canReset && (
        <button
          type="button"
          onClick={onResetToAuto}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Reset to automatic cover selection"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// LOOK TAB SELECTOR - Segmented control for Look switching
// Per design-spec.md: "Look tabs or segmented control"
// ============================================================================

function LookTabSelector({ looks, activeLookId, onSelectLook, onAddLook, readOnly }) {
  if (looks.length === 0) return null;

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      {looks.map((look, index) => {
        const isActive = look.id === activeLookId;
        const label = getLookLabel(index);
        const productCount = look.products?.length || 0;

        return (
          <button
            key={look.id}
            type="button"
            onClick={() => onSelectLook(look.id)}
            className={`
              relative px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${isActive
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            <span className="flex items-center gap-1.5">
              {index === 0 && (
                <Star className={`w-3 h-3 ${isActive ? "text-amber-500 fill-amber-400" : "text-slate-400"}`} />
              )}
              {label}
              {productCount > 0 && (
                <span className={`
                  text-[10px] tabular-nums px-1 py-0.5 rounded-full
                  ${isActive
                    ? "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    : "bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }
                `}>
                  {productCount}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* Add Look button integrated into tab bar */}
      {!readOnly && (
        <button
          type="button"
          onClick={onAddLook}
          className="px-2 py-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
          title="Add Look"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// HERO PRODUCT TILE - Prominent display for the hero product
// ============================================================================

function HeroProductTile({ product, onRemove, readOnly }) {
  const imagePath = product.colourImagePath || product.thumbnailImagePath;

  return (
    <div className="group relative rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200/60 dark:border-amber-700/40 p-3 transition-colors">
      <div className="flex items-start gap-3">
        {/* Large thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-white dark:bg-slate-700 overflow-hidden flex-shrink-0 shadow-sm">
          <AppImage
            src={imagePath}
            alt={product.productName}
            preferredSize={128}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover"
            fallback={
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                —
              </div>
            }
            placeholder={null}
          />
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 flex-shrink-0" />
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Hero
            </span>
          </div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {product.productName}
          </div>
          {product.colourName && (
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
              {product.colourName}
              {product.sizeScope === "single" && product.size && ` · ${product.size}`}
            </div>
          )}
        </div>

        {/* Remove button (edit-only, visible on hover) */}
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
            title="Remove product"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUPPORTING PRODUCT ROW - Compact row for supporting products
// ============================================================================

function SupportingProductRow({ product, onSetHero, onRemove, readOnly }) {
  const imagePath = product.colourImagePath || product.thumbnailImagePath;

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      {/* Small thumbnail */}
      <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
        <AppImage
          src={imagePath}
          alt={product.productName}
          preferredSize={64}
          className="w-full h-full"
          imageClassName="w-full h-full object-cover"
          fallback={
            <div className="flex items-center justify-center h-full text-[8px] text-slate-400">
              —
            </div>
          }
          placeholder={null}
        />
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
          {product.productName}
        </div>
        {product.colourName && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {product.colourName}
          </div>
        )}
      </div>

      {/* Action buttons (edit-only, visible on hover) */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onSetHero}
            className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            title="Set as hero product"
          >
            <Star className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Remove product"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOOK REFERENCES SECTION - Reference images scoped to the active Look
// Per design-spec.md: References support creative direction within Looks
// ============================================================================

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function LookReferencesSection({
  references = [],
  displayImageId,
  onAddReference,
  onRemoveReference,
  onSetDisplayImage,
  onEditCrop,
  readOnly,
  isUploading,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const validateFile = useCallback((file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return "Invalid file type. Please select JPEG, PNG, WebP, or GIF.";
    }
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return `File too large (${sizeMB}MB). Maximum is 50MB.`;
    }
    return null;
  }, []);

  const handleFileSelection = useCallback((file) => {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    onAddReference(file);
  }, [validateFile, onAddReference]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly || isUploading) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items?.length > 0) {
      setIsDragging(true);
    }
  }, [readOnly, isUploading]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (readOnly || isUploading) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [readOnly, isUploading, handleFileSelection]);

  const handleClickBrowse = useCallback(() => {
    if (readOnly || isUploading) return;
    fileInputRef.current?.click();
  }, [readOnly, isUploading]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
    e.target.value = "";
  }, [handleFileSelection]);

  const hasReferences = references.length > 0;

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          References
        </span>
        {hasReferences && (
          <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
            ({references.length})
          </span>
        )}
      </div>

      {/* Thumbnail grid */}
      {hasReferences && (
        <div className="grid grid-cols-3 gap-2">
          {references.map((ref, index) => {
            const isDisplayImage = ref.id === displayImageId;
            const hasCrop = Boolean(ref.cropData);
            // S.4: Apply crop transform for zoom/rotation, fallback to objectPosition for pan-only
            const hasCropTransform = hasCrop && (ref.cropData.zoom !== 1 || ref.cropData.rotation !== 0);
            const cropTransformStyle = hasCropTransform ? getCropTransformStyle(ref.cropData) : undefined;
            const imagePosition = !hasCropTransform && hasCrop ? getCropObjectPosition(ref.cropData) : undefined;
            return (
              <div
                key={ref.id}
                className={`
                  group relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700
                  border transition-colors
                  ${isDisplayImage
                    ? "border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/30"
                    : "border-slate-200 dark:border-slate-600"
                  }
                `}
              >
                <AppImage
                  src={ref.downloadURL || ref.path}
                  alt={`Reference ${index + 1}`}
                  preferredSize={160}
                  className="w-full h-full"
                  imageClassName="w-full h-full object-cover"
                  imageStyle={cropTransformStyle}
                  position={imagePosition}
                  placeholder={
                    <div className="flex items-center justify-center h-full text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  }
                  fallback={
                    <div className="flex items-center justify-center h-full text-xs text-slate-400">
                      —
                    </div>
                  }
                />
                {/* Display image indicator (always visible when set) */}
                {isDisplayImage && (
                  <div className="absolute top-1 left-1 p-1 rounded-full bg-amber-500 text-white shadow-sm">
                    <Star className="w-2.5 h-2.5 fill-current" />
                  </div>
                )}
                {/* Crop indicator (always visible when set, positioned after star) */}
                {hasCrop && (
                  <div
                    className={`absolute ${isDisplayImage ? "top-1 left-7" : "top-1 left-1"} px-1 py-0.5 rounded text-[7px] font-semibold leading-none bg-blue-500 text-white shadow-sm`}
                    title="Image has custom crop"
                  >
                    CROP
                  </div>
                )}
                {/* Action buttons overlay (visible on hover) */}
                {!readOnly && (
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors">
                    {/* Set/clear display image button (bottom-left) */}
                    <button
                      type="button"
                      onClick={() => onSetDisplayImage(isDisplayImage ? null : ref.id)}
                      className={`
                        absolute bottom-1 left-1 p-1 rounded-full transition-all
                        ${isDisplayImage
                          ? "bg-amber-500 text-white opacity-100 hover:bg-amber-600"
                          : "bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 hover:bg-amber-500"
                        }
                      `}
                      title={isDisplayImage ? "Remove as display image" : "Set as display image"}
                    >
                      <Star className={`w-3 h-3 ${isDisplayImage ? "fill-current" : ""}`} />
                    </button>
                    {/* Edit crop button (bottom-center) */}
                    <button
                      type="button"
                      onClick={() => onEditCrop(ref)}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 p-1 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 hover:bg-blue-500 transition-all"
                      title="Edit crop"
                    >
                      <Crop className="w-3 h-3" />
                    </button>
                    {/* Remove button (top-right) */}
                    <button
                      type="button"
                      onClick={() => onRemoveReference(ref.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                      title="Remove reference"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload dropzone (compact) */}
      {!readOnly && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickBrowse}
          className={`
            flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors
            ${isDragging
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30"
            }
            ${isUploading ? "opacity-50 cursor-wait" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={readOnly || isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {hasReferences ? "Add reference" : "Add reference image"}
              </span>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOOK OPTION PANEL - Decision card for a single look option
// ============================================================================

function LookOptionPanel({
  look,
  onAddProducts,
  onRemoveProduct,
  onSetHero,
  onRemoveLook,
  onAddReference,
  onRemoveReference,
  onSetDisplayImage,
  onEditCrop,
  isUploadingReference,
  readOnly,
}) {
  const productCount = look.products?.length || 0;
  const heroProduct = look.heroProductId
    ? look.products?.find((p) => p.productId === look.heroProductId)
    : null;
  const heroIndex = heroProduct
    ? look.products?.findIndex((p) => p.productId === look.heroProductId)
    : -1;
  const supportingProducts = look.products?.filter(
    (p) => p.productId !== look.heroProductId
  ) || [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {look.label}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {productCount} {productCount === 1 ? "product" : "products"}
          </span>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={onRemoveLook}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Remove option"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Card content */}
      <div className="p-4 space-y-4">
        {productCount > 0 ? (
          <>
            {/* Hero section */}
            {heroProduct ? (
              <HeroProductTile
                product={heroProduct}
                onRemove={() => onRemoveProduct(look.id, heroIndex)}
                readOnly={readOnly}
              />
            ) : (
              /* No hero selected helper */
              !readOnly && (
                <div className="rounded-lg border-2 border-dashed border-amber-200 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5" />
                    <span>Click the star on a product to set it as hero</span>
                  </div>
                </div>
              )
            )}

            {/* Supporting products section */}
            {supportingProducts.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide px-1 mb-2">
                  Supporting
                </div>
                <div className="space-y-0.5">
                  {supportingProducts.map((product) => {
                    const originalIdx = look.products?.findIndex(
                      (p) =>
                        p.productId === product.productId &&
                        p.colourId === product.colourId
                    );
                    return (
                      <SupportingProductRow
                        key={`${product.productId}-${product.colourId || originalIdx}`}
                        product={product}
                        onSetHero={() => onSetHero(look.id, product.productId)}
                        onRemove={() => onRemoveProduct(look.id, originalIdx)}
                        readOnly={readOnly}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="py-6 text-center">
            <div className="text-xs text-slate-400 dark:text-slate-500">
              No products in this option
            </div>
          </div>
        )}

        {/* Add products button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => onAddProducts(look.id)}
            className="w-full py-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            Add products
          </button>
        )}

        {/* References section - scoped to this Look */}
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60">
          <LookReferencesSection
            references={look.references || []}
            displayImageId={look.displayImageId || null}
            onAddReference={(file) => onAddReference(look.id, file)}
            onRemoveReference={(refId) => onRemoveReference(look.id, refId)}
            onSetDisplayImage={(refId) => onSetDisplayImage(look.id, refId)}
            onEditCrop={(ref) => onEditCrop(look.id, ref)}
            readOnly={readOnly}
            isUploading={isUploadingReference}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ShotLooksCanvas({
  shot,
  families = [],
  loadFamilyDetails,
  readOnly = false,
}) {
  const auth = useAuth();
  const clientId = auth?.clientId;
  const user = auth?.user;
  const queryClient = useQueryClient();

  // ══════════════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ══════════════════════════════════════════════════════════════════════════

  // Local looks state (hydrated from shot.looks)
  const [looks, setLooks] = useState(() => shot?.looks || []);
  const [saveStatus, setSaveStatus] = useState("idle");

  // Active Look State (per design-spec.md: "One Look is always active")
  // Default to first look's id, or null if no looks exist
  const [activeLookId, setActiveLookId] = useState(() => {
    const initialLooks = shot?.looks || [];
    return initialLooks.length > 0 ? initialLooks[0].id : null;
  });

  // Product selector modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [targetLookId, setTargetLookId] = useState(null);

  // Reference image upload state
  const [isUploadingReference, setIsUploadingReference] = useState(false);

  // Crop editor modal state (S.4)
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [cropEditorLookId, setCropEditorLookId] = useState(null);
  const [cropEditorReference, setCropEditorReference] = useState(null);

  // Refs for debounced save
  const saveTimerRef = useRef(null);
  const savedIndicatorTimerRef = useRef(null);

  // Prevent concurrent save operations (race condition mitigation)
  const saveInProgressRef = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════
  // SYNC EXTERNAL CHANGES
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Sync from shot if not in the middle of a local edit
    if (!saveTimerRef.current) {
      const newLooks = shot?.looks || [];
      setLooks(newLooks);

      // Ensure activeLookId is valid (still exists in the array)
      setActiveLookId((prevId) => {
        const stillExists = newLooks.some((l) => l.id === prevId);
        if (stillExists) return prevId;
        // Default to first look if previous was deleted or doesn't exist
        return newLooks.length > 0 ? newLooks[0].id : null;
      });
    }
  }, [shot?.looks]);

  // ══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════════

  const saveLooks = useCallback(async (newLooks) => {
    if (!clientId || !shot?.id || readOnly) return;

    // Prevent concurrent saves (race condition mitigation)
    if (saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    setSaveStatus("saving");

    try {
      const shotRef = doc(db, ...shotsPath(clientId), shot.id);

      // H.3: Sanitize looks array to remove any undefined values before Firestore write.
      // Firestore rejects documents containing undefined, which can occur when spreading
      // look objects that have properties explicitly set to undefined in React state.
      //
      // H.4: IMPORTANT - This sanitization is a LAST-MILE GUARD, not a deletion mechanism.
      // Deletion handlers (handleRemoveReference, handleRemoveProduct) use explicit
      // .filter() and null assignments BEFORE this point. Sanitization only catches
      // stray undefined values in nested objects, not structural changes.
      const sanitizedLooks = sanitizeForFirestore(newLooks);

      await updateDoc(shotRef, {
        looks: sanitizedLooks,
        updatedAt: serverTimestamp(),
      });

      setSaveStatus("saved");

      // F.6: Invalidate shots cache so ShotsPage shows fresh data on navigation
      // This fixes the stale preview bug where deleted references still appeared
      if (shot.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.shots(clientId, shot.projectId) });
      }

      // Clear saved indicator after 2s
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
      savedIndicatorTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);

      // Log activity (non-blocking)
      if (shot.projectId) {
        logActivity(
          clientId,
          shot.projectId,
          createShotUpdatedActivity(
            user?.uid || "unknown",
            user?.displayName || "Unknown",
            user?.photoURL || null,
            shot.id,
            shot.name || "Untitled Shot",
            { looks: "updated" }
          )
        ).catch(() => {});
      }
    } catch (error) {
      console.error("[ShotLooksCanvas] Save failed:", error);
      setSaveStatus("error");
    } finally {
      saveInProgressRef.current = false;
    }
  }, [clientId, shot?.id, shot?.projectId, shot?.name, user, readOnly, queryClient]);

  const debouncedSave = useCallback((newLooks) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveLooks(newLooks);
      saveTimerRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [saveLooks]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleAddOption = useCallback(() => {
    const newLook = createEmptyLook(looks.length);
    const newLooks = [...looks, newLook];
    setLooks(newLooks);
    setActiveLookId(newLook.id); // New look becomes active
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

  const handleRemoveLook = useCallback((lookId) => {
    const newLooks = looks.filter((l) => l.id !== lookId);
    setLooks(newLooks);

    // If we removed the active look, switch to first remaining look
    if (lookId === activeLookId) {
      setActiveLookId(newLooks.length > 0 ? newLooks[0].id : null);
    }

    debouncedSave(newLooks);
  }, [looks, activeLookId, debouncedSave]);

  const handleOpenProductSelector = useCallback((lookId) => {
    setTargetLookId(lookId);
    setSelectorOpen(true);
  }, []);

  const handleProductsSelected = useCallback((selections) => {
    if (!targetLookId) return;

    const newProducts = selections.map(buildShotProductFromSelection);

    const newLooks = looks.map((look) => {
      if (look.id !== targetLookId) return look;
      return {
        ...look,
        products: [...(look.products || []), ...newProducts],
      };
    });

    setLooks(newLooks);
    debouncedSave(newLooks);
    setSelectorOpen(false);
    setTargetLookId(null);
  }, [targetLookId, looks, debouncedSave]);

  const handleRemoveProduct = useCallback((lookId, productIndex) => {
    const newLooks = looks.map((look) => {
      if (look.id !== lookId) return look;

      const removedProduct = look.products[productIndex];
      const newProducts = look.products.filter((_, idx) => idx !== productIndex);

      // Clear hero if it was removed
      let newHeroId = look.heroProductId;
      if (removedProduct && removedProduct.productId === look.heroProductId) {
        newHeroId = null;
      }

      return {
        ...look,
        products: newProducts,
        heroProductId: newHeroId,
      };
    });

    setLooks(newLooks);
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

  /**
   * Set a product as HERO for a look.
   *
   * E-COMM DESCRIPTION WRITE-THROUGH:
   * Per UX.Shots.HeroAutoFillWriteThrough delta:
   * When setting hero on an e-comm shot, auto-fill shot.description with the
   * hero product's colorway label. Only auto-fill if:
   * - shot.type === "E-comm" (or shotType === "ecomm")
   * - AND (description is empty OR description matches previous auto-derived colorway)
   *
   * PATTERN A (CONSERVATIVE OVERWRITE GUARD):
   * Only overwrite if description === "" OR description === prevDerived (previous hero's colorway).
   * This preserves any user-typed description, even if it happens to match another product's colorway.
   */
  const handleSetHero = useCallback(async (lookId, productId) => {
    // Find the look being modified
    const targetLook = looks.find((l) => l.id === lookId);
    if (!targetLook) return;

    // Get previous hero's colorway (prevDerived) before changing
    const prevHeroId = targetLook.heroProductId;
    const prevHeroProduct = prevHeroId
      ? targetLook.products?.find((p) => p.productId === prevHeroId)
      : null;
    const prevDerived = (prevHeroProduct?.colourName || "").trim().toLowerCase();

    // Find the new hero product
    const heroProduct = targetLook.products?.find((p) => p.productId === productId);
    const newColorway = heroProduct?.colourName?.trim() || "";

    // Build updated looks array
    const newLooks = looks.map((look) => {
      if (look.id !== lookId) return look;
      return {
        ...look,
        heroProductId: productId,
      };
    });

    setLooks(newLooks);

    // E-COMM DESCRIPTION WRITE-THROUGH
    // Check if this is an e-comm shot (type label or shotType id)
    const isEcommShot =
      shot?.type?.toLowerCase() === "e-comm" ||
      shot?.shotType?.toLowerCase() === "ecomm" ||
      shot?.type?.toLowerCase() === "ecommerce";

    if (isEcommShot && newColorway && clientId && shot?.id && !readOnly) {
      // Pattern A: only auto-fill if empty or matches previous hero's colorway
      const shouldAutoFill = shouldAutoFillDescriptionOnHeroChange(
        shot?.description,
        prevHeroProduct?.colourName
      );

      if (shouldAutoFill) {
        // Write description along with looks in a single update
        try {
          const shotRef = doc(db, ...shotsPath(clientId), shot.id);
          const sanitizedLooks = sanitizeForFirestore(newLooks);

          await updateDoc(shotRef, {
            looks: sanitizedLooks,
            description: newColorway,
            updatedAt: serverTimestamp(),
          });

          setSaveStatus("saved");

          // Invalidate shots cache
          if (shot.projectId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.shots(clientId, shot.projectId) });
          }

          // Clear saved indicator after 2s
          if (savedIndicatorTimerRef.current) {
            clearTimeout(savedIndicatorTimerRef.current);
          }
          savedIndicatorTimerRef.current = setTimeout(() => {
            setSaveStatus("idle");
          }, 2000);

          // Log activity (non-blocking)
          if (shot.projectId) {
            logActivity(
              clientId,
              shot.projectId,
              createShotUpdatedActivity(
                user?.uid || "unknown",
                user?.displayName || "Unknown",
                user?.photoURL || null,
                shot.id,
                shot.name || "Untitled Shot",
                { looks: "hero set", description: newColorway }
              )
            ).catch(() => {});
          }

          return; // Already saved, skip debouncedSave
        } catch (error) {
          console.error("[ShotLooksCanvas] Failed to save hero with description:", error);
          setSaveStatus("error");
        }
      }
    }

    // Fall back to standard looks-only save
    debouncedSave(newLooks);
  }, [looks, debouncedSave, shot, clientId, readOnly, user, queryClient, saveLooks]);

  // ══════════════════════════════════════════════════════════════════════════
  // REFERENCE IMAGE HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleAddReference = useCallback(async (lookId, file) => {
    if (!clientId || !shot?.id || readOnly || isUploadingReference) return;

    setIsUploadingReference(true);

    try {
      // Compress image (reuses existing pattern from MultiImageAttachmentManager)
      const compressedFile = await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.82,
      });

      // Upload to Firebase Storage
      const { downloadURL, path } = await uploadImageFile(compressedFile, {
        folder: "shots",
        id: shot.id,
        filename: `ref_${Date.now()}_${file.name}`,
        optimize: false, // already compressed above
      });

      // Create reference object
      const newReference = {
        id: generateReferenceId(),
        path,
        downloadURL,
        uploadedAt: Date.now(),
        uploadedBy: user?.uid || "unknown",
      };

      // Update looks with new reference
      const newLooks = looks.map((look) => {
        if (look.id !== lookId) return look;
        return {
          ...look,
          references: [...(look.references || []), newReference],
        };
      });

      setLooks(newLooks);
      // Save immediately (not debounced) since upload already took time
      saveLooks(newLooks);
    } catch (error) {
      console.error("[ShotLooksCanvas] Reference upload failed:", error);
      // Error is handled by LookReferencesSection's local error state
    } finally {
      setIsUploadingReference(false);
    }
  }, [clientId, shot?.id, user?.uid, looks, readOnly, isUploadingReference, saveLooks]);

  const handleRemoveReference = useCallback(async (lookId, referenceId) => {
    // F.6: Safety confirmation before removing reference image
    const confirmed = await showConfirm("Remove this reference image?");
    if (!confirmed) return;

    const newLooks = looks.map((look) => {
      if (look.id !== lookId) return look;

      // ═══════════════════════════════════════════════════════════════════════
      // H.4 DELETION SEMANTICS - EXPLICIT, NOT SANITIZATION-DEPENDENT
      // ═══════════════════════════════════════════════════════════════════════
      // 1. References removed via explicit .filter() - NOT sanitization
      // 2. displayImageId fallback is explicit null - NOT undefined stripping
      // 3. sanitizeForFirestore() in saveLooks() is ONLY a last-mile guard for
      //    stray undefined in reference objects, NOT the deletion mechanism
      // ═══════════════════════════════════════════════════════════════════════

      // EXPLICIT DELETION: .filter() creates new array without the deleted reference
      // This happens BEFORE sanitization - deletion does not rely on undefined stripping
      const filteredReferences = (look.references || []).filter(
        (ref) => ref.id !== referenceId
      );

      // EXPLICIT FALLBACK: If deleted ref was display image, set to null (Firestore-valid)
      // Uses nullish coalescing to handle legacy looks without displayImageId field
      const currentDisplayId = look.displayImageId ?? null;
      const newDisplayImageId = currentDisplayId === referenceId ? null : currentDisplayId;

      return {
        ...look,
        references: filteredReferences, // Always array (possibly empty), never undefined
        displayImageId: newDisplayImageId, // Always null or string, never undefined
      };
    });

    setLooks(newLooks);
    // Save immediately (not debounced) to ensure deletion persists even if user navigates away
    saveLooks(newLooks);
  }, [looks, saveLooks]);

  /**
   * Set or clear the display image for a Look
   * Per F.5: ONE reference can be designated as the shot's display image
   * Pass null to clear the designation
   */
  const handleSetDisplayImage = useCallback((lookId, referenceId) => {
    const newLooks = looks.map((look) => {
      if (look.id !== lookId) return look;
      return {
        ...look,
        displayImageId: referenceId, // null clears, string sets
      };
    });

    setLooks(newLooks);
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

  /**
   * Reset cover to auto by clearing displayImageId from all looks.
   * Per S.3: Provides explicit "Reset to Auto" action.
   * Note: heroProductId is preserved as it serves dual purpose (styling identity).
   * Users can clear hero manually if desired.
   */
  const handleResetCoverToAuto = useCallback(() => {
    const newLooks = looks.map((look) => {
      // Only clear displayImageId if it's set
      if (!look.displayImageId) return look;
      return {
        ...look,
        displayImageId: null,
      };
    });

    setLooks(newLooks);
    // Save immediately since this is an explicit user action
    saveLooks(newLooks);
  }, [looks, saveLooks]);

  // ══════════════════════════════════════════════════════════════════════════
  // CROP EDITING HANDLERS (S.4)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Open the crop editor for a reference image.
   * S.4: Entry point for editing crop on look references.
   */
  const handleEditCrop = useCallback((lookId, reference) => {
    setCropEditorLookId(lookId);
    setCropEditorReference(reference);
    setCropEditorOpen(true);
  }, []);

  /**
   * Save crop data to a reference.
   * S.4: Stores cropData on shot.looks[].references[].cropData
   * Note: aspect is stored as NUMBER (not string) per imageCropDataSchema semantics.
   */
  const handleSaveCrop = useCallback((cropData) => {
    if (!cropEditorLookId || !cropEditorReference) return;

    const newLooks = looks.map((look) => {
      if (look.id !== cropEditorLookId) return look;

      const newReferences = (look.references || []).map((ref) => {
        if (ref.id !== cropEditorReference.id) return ref;
        return {
          ...ref,
          cropData: cropData, // Contains x, y, width, height, zoom, rotation, aspect (number|null)
        };
      });

      return {
        ...look,
        references: newReferences,
      };
    });

    setLooks(newLooks);
    // Save immediately since this is an explicit user action
    saveLooks(newLooks);

    // Close the editor
    setCropEditorOpen(false);
    setCropEditorLookId(null);
    setCropEditorReference(null);
  }, [looks, saveLooks, cropEditorLookId, cropEditorReference]);

  /**
   * Close the crop editor without saving.
   */
  const handleCloseCropEditor = useCallback(() => {
    setCropEditorOpen(false);
    setCropEditorLookId(null);
    setCropEditorReference(null);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const hasLooks = looks.length > 0;

  // Get the currently active look (per design-spec.md: "One Look is always active")
  const activeLook = hasLooks ? looks.find((l) => l.id === activeLookId) : null;
  const activeLookIndex = activeLook ? looks.findIndex((l) => l.id === activeLookId) : -1;

  return (
    <section className="space-y-5">
      {/* Section header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Looks
          </h2>
          {readOnly && (
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              <Eye className="w-3 h-3" />
              View only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* S.3: Cover source indicator with Reset to Auto action */}
          {hasLooks && (
            <CoverSourceIndicator
              shot={shot}
              onResetToAuto={handleResetCoverToAuto}
              readOnly={readOnly}
            />
          )}
          {!readOnly && <TrustIndicator status={saveStatus} />}
          {/* Add Look button moves to tab bar when looks exist */}
          {!readOnly && !hasLooks && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Look Option
            </Button>
          )}
        </div>
      </div>

      {/* Look Tab Selector - per design-spec.md: "Look tabs or segmented control" */}
      {hasLooks && (
        <LookTabSelector
          looks={looks}
          activeLookId={activeLookId}
          onSelectLook={setActiveLookId}
          onAddLook={handleAddOption}
          readOnly={readOnly}
        />
      )}

      {/* Active Look Canvas - Only the active look is editable (per design-spec.md) */}
      {activeLook ? (
        <LookOptionPanel
          look={{ ...activeLook, label: getLookLabel(activeLookIndex) }}
          onAddProducts={handleOpenProductSelector}
          onRemoveProduct={handleRemoveProduct}
          onSetHero={handleSetHero}
          onRemoveLook={() => handleRemoveLook(activeLook.id)}
          onAddReference={handleAddReference}
          onRemoveReference={handleRemoveReference}
          onSetDisplayImage={handleSetDisplayImage}
          onEditCrop={handleEditCrop}
          isUploadingReference={isUploadingReference}
          readOnly={readOnly}
        />
      ) : !hasLooks ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
            No look options yet
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Create options to explore different product combinations
          </p>
        </div>
      ) : null}

      {/* Product selector modal */}
      {selectorOpen && (
        <ShotProductSelectorModal
          open={selectorOpen}
          onClose={() => {
            setSelectorOpen(false);
            setTargetLookId(null);
          }}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          onSubmit={handleProductsSelected}
        />
      )}

      {/* S.4: Crop editor modal for look references */}
      {cropEditorOpen && cropEditorReference && (
        <AdvancedImageCropEditor
          open={cropEditorOpen}
          onClose={handleCloseCropEditor}
          attachment={cropEditorReference}
          onSave={handleSaveCrop}
        />
      )}
    </section>
  );
}
