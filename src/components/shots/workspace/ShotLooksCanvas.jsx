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
 *   order: number                 // Display order
 * }>
 *
 * NOTES:
 * - Looks are stored separately from shot.products (coexist without breaking existing usage)
 * - Hero product is used for header colorway/auto-name in future deltas (not this one)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { shotsPath, productFamiliesPath, productFamilySkusPath } from "../../../lib/paths";
import { useAuth } from "../../../context/AuthContext";
import { logActivity, createShotUpdatedActivity } from "../../../lib/activityLogger";
import ShotProductSelectorModal from "../ShotProductSelectorModal";
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
} from "lucide-react";

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTOSAVE_DEBOUNCE_MS = 800;

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
// LOOK OPTION PANEL - Decision card for a single look option
// ============================================================================

function LookOptionPanel({
  look,
  onAddProducts,
  onRemoveProduct,
  onSetHero,
  onRemoveLook,
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

  // ══════════════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ══════════════════════════════════════════════════════════════════════════

  // Local looks state (hydrated from shot.looks)
  const [looks, setLooks] = useState(() => shot?.looks || []);
  const [saveStatus, setSaveStatus] = useState("idle");

  // Product selector modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [targetLookId, setTargetLookId] = useState(null);

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
      setLooks(shot?.looks || []);
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

      await updateDoc(shotRef, {
        looks: newLooks,
        updatedAt: serverTimestamp(),
      });

      setSaveStatus("saved");

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
  }, [clientId, shot?.id, shot?.projectId, shot?.name, user, readOnly]);

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
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

  const handleRemoveLook = useCallback((lookId) => {
    const newLooks = looks.filter((l) => l.id !== lookId);
    setLooks(newLooks);
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

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

  const handleSetHero = useCallback((lookId, productId) => {
    const newLooks = looks.map((look) => {
      if (look.id !== lookId) return look;
      return {
        ...look,
        heroProductId: productId,
      };
    });

    setLooks(newLooks);
    debouncedSave(newLooks);
  }, [looks, debouncedSave]);

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
          {!readOnly && <TrustIndicator status={saveStatus} />}
          {!readOnly && (
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

      {/* Options grid - 2 columns on desktop for side-by-side comparison */}
      {hasLooks ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {looks.map((look) => (
            <LookOptionPanel
              key={look.id}
              look={look}
              onAddProducts={handleOpenProductSelector}
              onRemoveProduct={handleRemoveProduct}
              onSetHero={handleSetHero}
              onRemoveLook={() => handleRemoveLook(look.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
            No look options yet
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Create options to explore different product combinations
          </p>
        </div>
      )}

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
    </section>
  );
}
