/**
 * ProductDetailPageV2 - Read-Only Product Explore Surface
 *
 * DESIGN PHILOSOPHY & REASONING
 * =============================
 *
 * This page introduces a full-screen, read-only "Explore mode" for product details.
 * It is designed to be non-destructive, feature-flagged, and reversible.
 *
 * DESIGN PRINCIPLES APPLIED:
 *
 * 1. PROGRESSIVE DISCLOSURE (Apple iOS Settings pattern)
 *    - Information is revealed in layers: Overview first, then details
 *    - Card-based sections allow users to focus on one area at a time
 *    - Future expansion points (Samples, Assets, Notes) are visible but
 *      clearly marked as upcoming, setting expectations without confusion
 *
 * 2. READ-FIRST / EDIT-SECOND INTERACTION (Linear, Stripe patterns)
 *    - Default state is purely read-only; no inline editable fields
 *    - Edit button is visible but disabled (placeholder for future)
 *    - This reduces cognitive load and prevents accidental edits
 *    - Users can safely explore product data without risk
 *
 * 3. CARD-BASED GROUPING WITH VISUAL HIERARCHY (Kobo Labs, Linear)
 *    - Each section is a distinct card with clear boundaries
 *    - Headers use consistent typography scale for scanability
 *    - White space between cards reduces density and improves focus
 *    - Cards don't hover/lift - intentionally static for reading
 *
 * 4. EXPLICIT MODE SEPARATION (Notion, Linear patterns)
 *    - This page IS the "Explore mode" - no mode toggle needed
 *    - Edit mode will remain in the existing modal (separate surface)
 *    - Clear mental model: this page = read, modal = edit
 *
 * 5. REDUCING COGNITIVE LOAD FOR LARGE OBJECTS
 *    - Colorways displayed in a scannable list format
 *    - Count shown prominently in section header
 *    - No inline editing or interactive elements in read mode
 *    - Calm, consistent density throughout
 *
 * VISUAL REFERENCES (conceptual, not copied):
 * - Apple iOS Settings: Card grouping, progressive disclosure
 * - Stripe Dashboard: Object detail pages, clear hierarchy
 * - Linear: Issue detail vs edit mode separation
 * - Kobo Labs (public imagery): PLM-inspired clarity, calm density
 *
 * FUTURE EVOLUTION:
 * - Samples section: Track sample status, requests, approvals
 * - Assets section: Link documents, images, specifications
 * - Notes & Activity: Timeline of changes, comments, decisions
 * - These are placeholders with intentional empty states
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { productFamilyPath, productFamilySkusPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
// Card components not used in new layout - inline markup preferred for clarity
import { Button } from "../components/ui/button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import AppImage from "../components/common/AppImage";
import { ArrowLeft, Edit3, Package, Palette, Box, FileText, MessageSquare, X, ChevronDown, Plus, Truck, CheckCircle2, AlertTriangle, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import { genderLabel } from "../lib/productMutations";
import { getCategoryLabel } from "../lib/productCategories";
import { getProductNotesText } from "../lib/productNotes";

/**
 * ColorwayTile - Compact colorway representation for grid view
 *
 * Design: Minimal footprint showing thumbnail + name only.
 * Selected state indicated by ring + subtle background + scale.
 * Click to expand detail panel below grid.
 */
function ColorwayTile({ sku, isSelected, onSelect }) {
  const hasImage = Boolean(sku.imagePath);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col items-center p-2 rounded-lg transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-900/5 dark:bg-slate-100/10 ring-2 ring-slate-500 dark:ring-slate-400 scale-[1.02]"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${sku.colorName}${isSelected ? " (selected)" : ""}`}
    >
      {/* Thumbnail/Swatch */}
      <div className={`
        w-14 h-14 rounded-md overflow-hidden transition-all
        ${isSelected ? "shadow-md ring-1 ring-slate-300 dark:ring-slate-500" : "shadow-sm group-hover:shadow-md"}
        ${!hasImage && !sku.hexColor ? "bg-slate-100 dark:bg-slate-700" : ""}
      `}>
        {hasImage ? (
          <AppImage
            src={sku.imagePath}
            alt={sku.colorName}
            preferredSize={112}
            className="w-full h-full object-cover"
          />
        ) : sku.hexColor ? (
          <div
            className="w-full h-full"
            style={{ backgroundColor: sku.hexColor }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Palette className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>

      {/* Color name - truncated */}
      <p className={`
        mt-1.5 text-xxs font-medium text-center truncate w-full max-w-[72px]
        ${isSelected
          ? "text-slate-900 dark:text-slate-100"
          : "text-slate-500 dark:text-slate-400"
        }
      `}>
        {sku.colorName}
      </p>

      {/* Status dot for discontinued */}
      {sku.status === "discontinued" && (
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400"
          title="Discontinued"
        />
      )}
    </button>
  );
}

/**
 * ColorwayDetailPanel - Workspace cockpit for selected colorway
 *
 * Design: Two-column "cockpit" layout with explicit scope toggle.
 * - LEFT: Identity (thumbnail, name, hex, metadata) - compact when workspace open
 * - RIGHT: Bento-style workspace dashboard with scope toggle:
 *   - Scope: Colorway (default) vs Product
 *   - Row 1: Summary cards (Samples, Activity, Assets) - at-a-glance metrics
 *   - Row 2: Focus panel that expands based on selected card
 *
 * Scope model:
 * - COLORWAY scope: Data/actions specific to this colorway
 * - PRODUCT scope: Aggregated data across all colorways
 *
 * Work areas (read-only placeholders):
 * - Samples: Track sample units with sizes, carrier/tracking, ETA
 * - Activity: Comments, tasks, discussion thread
 * - Assets: Tech packs, sketches, material docs
 */

// Scope-specific workspace configurations
const COLORWAY_WORKSPACE_AREAS = [
  {
    id: "samples",
    label: "Samples",
    icon: Box,
    countKey: "samples",
    description: "Track sample units",
    focusTitle: "Sample Tracking",
    focusHints: [
      "Request samples by size",
      "Track carrier & ETA",
      "Log receipt status",
    ],
    ctaLabel: "Add sample",
  },
  {
    id: "activity",
    label: "Activity",
    icon: MessageSquare,
    countKey: "notes",
    description: "Comments & tasks",
    focusTitle: "Activity Feed",
    focusHints: [
      "Leave comments",
      "Tag team members",
      "Track decisions",
    ],
    ctaLabel: "Add note",
  },
  {
    id: "assets",
    label: "Assets",
    icon: FileText,
    countKey: "assets",
    description: "Files & docs",
    focusTitle: "Documents & Files",
    focusHints: [
      "Tech packs",
      "Material specs",
      "Reference images",
    ],
    ctaLabel: "Add file",
  },
];

const PRODUCT_WORKSPACE_AREAS = [
  {
    id: "samples",
    label: "Samples",
    sublabel: "(All colorways)",
    icon: Box,
    countKey: "samples",
    description: "Aggregated",
    focusTitle: "Sample Overview",
    focusDescription: "Aggregated view across all colorways. Drill into any colorway for details.",
    focusHints: [
      "View all sample requests at a glance",
      "Filter by colorway, status, or ETA",
      "Track aggregate delivery timeline",
    ],
    ctaLabel: "Request samples",
  },
  {
    id: "activity",
    label: "Activity",
    sublabel: "(Product)",
    icon: MessageSquare,
    countKey: "activity",
    description: "Decisions & tasks",
    focusTitle: "Product Activity",
    focusDescription: "Style-level decisions and tasks that span all colorways.",
    focusHints: [
      "Log cross-colorway decisions",
      "Track style-level approvals",
      "Coordinate team activity",
    ],
    ctaLabel: "Add note",
  },
  {
    id: "assets",
    label: "Assets",
    sublabel: "(Product)",
    icon: FileText,
    countKey: "assets",
    description: "Shared specs",
    focusTitle: "Product Assets",
    focusDescription: "Shared documents and specifications that apply to all colorways.",
    focusHints: [
      "Upload shared tech packs",
      "Link style specifications",
      "Store material certifications",
    ],
    ctaLabel: "Add file",
  },
];

/**
 * Aggregate counts across all colorways for product-scope view.
 * Pure function, safe optional chaining for future data fields.
 */
function aggregateProductCounts(family, skus, countKey) {
  // First check if product family has the field directly
  const familyData = family?.[countKey];
  if (Array.isArray(familyData)) return familyData.length;
  if (typeof familyData === "number") return familyData;

  // Otherwise, sum across all colorways
  if (!Array.isArray(skus)) return 0;
  return skus.reduce((sum, sku) => {
    const data = sku?.[countKey];
    if (Array.isArray(data)) return sum + data.length;
    if (typeof data === "number") return sum + data;
    return sum;
  }, 0);
}

/**
 * ScopeToggle - Segmented control for switching workspace scope
 */
function ScopeToggle({ scope, onScopeChange, colorwayName, productName }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/50">
      <button
        type="button"
        onClick={() => onScopeChange("colorway")}
        className={`
          px-2.5 py-1 rounded-md text-2xs font-medium transition-all
          focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
          ${scope === "colorway"
            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }
        `}
        aria-pressed={scope === "colorway"}
      >
        {colorwayName}
      </button>
      <button
        type="button"
        onClick={() => onScopeChange("product")}
        className={`
          px-2.5 py-1 rounded-md text-2xs font-medium transition-all
          focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
          ${scope === "product"
            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }
        `}
        aria-pressed={scope === "product"}
      >
        {productName}
      </button>
    </div>
  );
}

/**
 * CountBadge - Small pill badge for tab counts
 */
function CountBadge({ count, isActive }) {
  return (
    <span
      className={`
        ml-1.5 px-1.5 py-0.5 rounded-full text-2xs font-medium tabular-nums
        ${isActive
          ? "bg-white/20 text-white dark:bg-slate-800/40 dark:text-slate-200"
          : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300"
        }
      `}
    >
      {count}
    </span>
  );
}

/**
 * WorkspaceEmptyState - Empty state for workspace tabs
 */
function WorkspaceEmptyState({ config, scope }) {
  const Icon = config.icon;
  const scopeContext = scope === "colorway" ? "this colorway" : "all colorways";

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <div className="text-center max-w-xs">
        <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {config.focusTitle}
        </h4>
        {config.focusDescription && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {config.focusDescription}
          </p>
        )}
        <ul className="space-y-1.5 mb-4">
          {config.focusHints.map((hint, i) => (
            <li
              key={i}
              className="text-xxs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5"
            >
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              {hint}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          {config.ctaLabel}
        </button>
        <p className="mt-3 text-2xs text-slate-300 dark:text-slate-600 italic">
          Coming soon for {scopeContext}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SAMPLE TRACKING WORKSPACE
// ============================================================================
// Read-only scaffold for sample tracking feature.
// Supports two scopes:
// - Colorway: Samples tied to selected colorway
// - Product: Aggregated samples across all colorways
//
// Data model (in-memory only, no Firestore):
// - productSamples: Sample[] (product scope)
// - colorwaySamplesBySkuId: Record<string, Sample[]> (colorway scope)
// ============================================================================

/**
 * Sample type options for the tracking table
 */
const SAMPLE_TYPES = ["Shoot sample", "Pre-production", "Bulk ref"];

/**
 * Sample status options with associated colors
 */
const SAMPLE_STATUSES = {
  requested: { label: "Requested", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_transit: { label: "In transit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  arrived: { label: "Arrived", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  returned: { label: "Returned", color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  issue: { label: "Issue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

/**
 * Table column definitions for sample tracking
 */
const SAMPLE_TABLE_COLUMNS = [
  { key: "label", header: "Sample ID", width: "w-28" },
  { key: "type", header: "Type", width: "w-28" },
  { key: "sizeRun", header: "Size run", width: "w-20" },
  { key: "status", header: "Status", width: "w-24" },
  { key: "carrier", header: "Carrier / Tracking", width: "w-36" },
  { key: "eta", header: "ETA / Arrived", width: "w-24" },
  { key: "notes", header: "Notes", width: "flex-1 min-w-[80px]" },
];

/**
 * SampleStatusBadge - Small status indicator
 */
function SampleStatusBadge({ status }) {
  const config = SAMPLE_STATUSES[status] || SAMPLE_STATUSES.requested;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

/**
 * SampleSummaryChip - Summary metric chip for sample counts
 */
function SampleSummaryChip({ icon: Icon, label, count, variant = "default" }) {
  const variantClasses = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    transit: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    arrived: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    issue: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xxs font-medium ${variantClasses[variant]}`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </div>
  );
}

/**
 * SampleDetailDrawer - Right-side drawer for sample details
 *
 * Read-only view of a single sample with sections for:
 * - Scope breadcrumb (Product • Colorway context)
 * - Title + status badge
 * - Size run chips
 * - Shipping info (carrier, tracking, ETA, arrived)
 * - Notes
 * - Tasks/Activity placeholder
 * - "View colorway" button (when in PRODUCT scope)
 */
function SampleDetailDrawer({ sample, open, onOpenChange, scope, colorwayName, productName, onJumpToColorway }) {
  if (!sample) return null;

  const statusConfig = SAMPLE_STATUSES[sample.status] || SAMPLE_STATUSES.requested;
  const showJumpToColorway = scope === "product" && sample.scopeSkuId && onJumpToColorway;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          {/* Scope breadcrumb */}
          <div className="flex items-center gap-1.5 text-2xs text-slate-400 dark:text-slate-500 mb-2">
            <span className="font-medium">{productName || "Product"}</span>
            <span>•</span>
            <span>{scope === "colorway" ? colorwayName : "All colorways"}</span>
          </div>

          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{sample.label}</SheetTitle>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <SheetDescription className="text-xs">
            {sample.type}
          </SheetDescription>

          {/* View colorway button (product scope only) */}
          {showJumpToColorway && (
            <button
              type="button"
              onClick={() => onJumpToColorway(sample.scopeSkuId)}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              <Eye className="w-3 h-3" />
              View colorway
            </button>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Size Run Section */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Size Run
            </h4>
            {sample.sizeRun && sample.sizeRun.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {sample.sizeRun.map((size) => (
                  <span
                    key={size}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {size}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                No sizes specified
              </p>
            )}
          </section>

          {/* Shipping Section */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Shipping
            </h4>
            <div className="space-y-3">
              {/* Carrier & Tracking */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Truck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Carrier</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {sample.carrier || "Not specified"}
                  </p>
                </div>
              </div>

              {/* Tracking Number */}
              {sample.tracking && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <ExternalLink className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tracking</p>
                    <p className="text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded inline-block">
                      {sample.tracking}
                    </p>
                  </div>
                </div>
              )}

              {/* ETA */}
              {sample.eta && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <Truck className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Expected Arrival</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {sample.eta}
                    </p>
                  </div>
                </div>
              )}

              {/* Arrived Date */}
              {sample.arrivedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Arrived</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {sample.arrivedAt}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Notes Section */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Notes
            </h4>
            {sample.notes ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {sample.notes}
              </p>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                No notes added
              </p>
            )}
          </section>

          {/* Tasks / Activity Placeholder */}
          <section className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Tasks & Activity
            </h4>
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center">
              <MessageSquare className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Activity feed coming soon
              </p>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * StatusFilterChip - Clickable filter chip for status filtering
 */
function StatusFilterChip({ label, isActive, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
        ${isActive
          ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className={`tabular-nums ${isActive ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * TypeFilterSegment - Segmented control for sample type filtering
 */
function TypeFilterSegment({ value, options, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            px-2 py-0.5 rounded text-2xs font-medium transition-all
            focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
            ${value === opt.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * SortDropdown - Sort control with direction toggle
 */
function SortDropdown({ sortBy, sortDir, onSortChange }) {
  const sortOptions = [
    { value: "eta", label: "ETA" },
    { value: "status", label: "Status" },
    { value: "label", label: "Sample ID" },
  ];

  const handleSortByChange = (e) => {
    onSortChange(e.target.value, sortDir);
  };

  const toggleDirection = () => {
    onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc");
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={sortBy}
        onChange={handleSortByChange}
        className="text-2xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-0 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggleDirection}
        className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
      >
        {sortDir === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

/**
 * SamplesWorkspace - Sample tracking tab content
 *
 * @param {Object} props
 * @param {string} props.scope - "colorway" or "product"
 * @param {string} props.colorwayName - Name of selected colorway (for colorway scope)
 * @param {string} props.productName - Name of product (for drawer context)
 * @param {Array} props.samples - Sample data array (empty for scaffold)
 * @param {Function} props.onJumpToColorway - Callback to jump to a colorway (product scope only)
 */
function SamplesWorkspace({ scope, colorwayName, productName, samples = [], onJumpToColorway }) {
  // State for selected sample drawer
  const [selectedSample, setSelectedSample] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Sort state
  const [sortBy, setSortBy] = useState("eta");
  const [sortDir, setSortDir] = useState("asc");

  // Handle row click to open drawer
  const handleRowClick = useCallback((sample) => {
    setSelectedSample(sample);
    setDrawerOpen(true);
  }, []);

  // Handle drawer close
  const handleDrawerClose = useCallback((open) => {
    setDrawerOpen(open);
    if (!open) {
      // Delay clearing sample to allow close animation
      setTimeout(() => setSelectedSample(null), 200);
    }
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((newSortBy, newSortDir) => {
    setSortBy(newSortBy);
    setSortDir(newSortDir);
  }, []);

  // Type filter options
  const typeOptions = [
    { value: "all", label: "All" },
    { value: "Shoot sample", label: "Shoot" },
    { value: "Pre-production", label: "PP" },
    { value: "Bulk ref", label: "Bulk" },
  ];

  // Compute status counts for filter chips (from unfiltered samples)
  const statusCounts = useMemo(() => ({
    all: samples.length,
    requested: samples.filter((s) => s.status === "requested").length,
    in_transit: samples.filter((s) => s.status === "in_transit").length,
    arrived: samples.filter((s) => s.status === "arrived").length,
    returned: samples.filter((s) => s.status === "returned").length,
    issue: samples.filter((s) => s.status === "issue").length,
  }), [samples]);

  // Filter and sort samples
  const filteredSortedSamples = useMemo(() => {
    let result = [...samples];

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "eta":
          // Parse dates for comparison, null/undefined dates go last
          aVal = a.eta || a.arrivedAt || "9999-12-31";
          bVal = b.eta || b.arrivedAt || "9999-12-31";
          break;
        case "status":
          // Order: issue, in_transit, requested, arrived, returned
          const statusOrder = { issue: 0, in_transit: 1, requested: 2, arrived: 3, returned: 4 };
          aVal = statusOrder[a.status] ?? 5;
          bVal = statusOrder[b.status] ?? 5;
          break;
        case "label":
          aVal = (a.label || "").toLowerCase();
          bVal = (b.label || "").toLowerCase();
          break;
        default:
          aVal = a[sortBy] || "";
          bVal = b[sortBy] || "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [samples, statusFilter, typeFilter, sortBy, sortDir]);

  // Compute summary counts from FILTERED samples (visible set)
  const summaryStats = useMemo(() => ({
    total: filteredSortedSamples.length,
    inTransit: filteredSortedSamples.filter((s) => s.status === "in_transit").length,
    arrived: filteredSortedSamples.filter((s) => s.status === "arrived").length,
    issues: filteredSortedSamples.filter((s) => s.status === "issue").length,
  }), [filteredSortedSamples]);

  // Scope-aware header text
  const headerText = scope === "colorway"
    ? `Samples for ${colorwayName}`
    : "Samples across all colorways";

  return (
    <div className="flex flex-col h-full">
      {/* Header row with title and CTA */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {headerText}
        </h4>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Add sample
        </button>
      </div>

      {/* Scan Controls Bar - filters + sort + count */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter chips */}
          <div className="flex items-center gap-1">
            <StatusFilterChip
              label="All"
              isActive={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              count={statusCounts.all}
            />
            <StatusFilterChip
              label="Requested"
              isActive={statusFilter === "requested"}
              onClick={() => setStatusFilter("requested")}
            />
            <StatusFilterChip
              label="In transit"
              isActive={statusFilter === "in_transit"}
              onClick={() => setStatusFilter("in_transit")}
            />
            <StatusFilterChip
              label="Arrived"
              isActive={statusFilter === "arrived"}
              onClick={() => setStatusFilter("arrived")}
            />
            <StatusFilterChip
              label="Returned"
              isActive={statusFilter === "returned"}
              onClick={() => setStatusFilter("returned")}
            />
            <StatusFilterChip
              label="Issue"
              isActive={statusFilter === "issue"}
              onClick={() => setStatusFilter("issue")}
            />
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />

          {/* Type filter */}
          <TypeFilterSegment
            value={typeFilter}
            options={typeOptions}
            onChange={setTypeFilter}
          />

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />

          {/* Sort dropdown */}
          <SortDropdown
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />
        </div>

        {/* Showing count */}
        <span className="text-2xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
          Showing {filteredSortedSamples.length} of {samples.length}
        </span>
      </div>

      {/* Summary chips row - counts reflect filtered set */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-50 dark:border-slate-700/50 bg-slate-25 dark:bg-slate-800/20">
        <SampleSummaryChip icon={Box} label="Total" count={summaryStats.total} />
        <SampleSummaryChip icon={Truck} label="In transit" count={summaryStats.inTransit} variant="transit" />
        <SampleSummaryChip icon={CheckCircle2} label="Arrived" count={summaryStats.arrived} variant="arrived" />
        <SampleSummaryChip icon={AlertTriangle} label="Issues" count={summaryStats.issues} variant="issue" />
      </div>

      {/* Table container with fixed height scroll */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-h-[320px] overflow-auto">
          <table className="w-full text-xxs">
            {/* Table header - sticky */}
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
              <tr>
                {SAMPLE_TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-1.5 text-left font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${col.width}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filteredSortedSamples.length > 0 ? (
                filteredSortedSamples.map((sample, idx) => (
                  <tr
                    key={sample.id || idx}
                    onClick={() => handleRowClick(sample)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(sample);
                      }
                    }}
                  >
                    <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-300">
                      {sample.label || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                      {sample.type || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                      {Array.isArray(sample.sizeRun) ? sample.sizeRun.join(", ") : sample.sizeRun || "-"}
                    </td>
                    <td className="px-2 py-1.5">
                      <SampleStatusBadge status={sample.status || "requested"} />
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 font-mono text-2xs truncate max-w-[120px]" title={sample.carrier && sample.tracking ? `${sample.carrier} ${sample.tracking}` : undefined}>
                      {sample.carrier && sample.tracking
                        ? `${sample.carrier} ${sample.tracking}`
                        : sample.carrier || sample.tracking || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                      {sample.eta || sample.arrivedAt || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[100px]" title={sample.notes || undefined}>
                      {sample.notes || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                // Empty state row
                <tr>
                  <td colSpan={SAMPLE_TABLE_COLUMNS.length} className="px-2 py-8">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2">
                        <Box className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {statusFilter !== "all" || typeFilter !== "all"
                          ? "No samples match filters"
                          : "No samples tracked yet"
                        }
                      </p>
                      <p className="text-2xs text-slate-400 dark:text-slate-500">
                        {statusFilter !== "all" || typeFilter !== "all"
                          ? "Try adjusting your filters"
                          : scope === "colorway"
                            ? "Add a sample to start tracking"
                            : "Add samples to individual colorways"
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Detail Drawer with scope context */}
      <SampleDetailDrawer
        sample={selectedSample}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        scope={scope}
        colorwayName={colorwayName}
        productName={productName}
        onJumpToColorway={onJumpToColorway}
      />
    </div>
  );
}

function ColorwayDetailPanel({ sku, family, allSkus, onClose, onSelectColorway }) {
  const [activeTab, setActiveTab] = useState("samples");
  const [workspaceScope, setWorkspaceScope] = useState("colorway");
  const hasImage = Boolean(sku.imagePath);

  // Handle "View colorway" navigation from drawer
  // Switches to colorway scope and force-selects the target colorway
  const handleJumpToColorway = useCallback((targetSkuId) => {
    if (onSelectColorway && targetSkuId) {
      setWorkspaceScope("colorway");
      onSelectColorway(targetSkuId, true); // forceSelect=true to avoid toggle-off
    }
  }, [onSelectColorway]);

  // ========================================================================
  // MOCK DATA STRUCTURES (in-memory only, no Firestore)
  // ========================================================================
  // These structures scaffold the data shape for when we wire to Firestore.
  // Mock data provided to validate filtering/sorting UI. Keep obviously mock.
  //
  // Future Firestore paths:
  // - Product scope: /clients/{clientId}/productFamilies/{familyId}/samples
  // - Colorway scope: /clients/{clientId}/productFamilies/{familyId}/skus/{skuId}/samples
  // ========================================================================

  // Product-scope samples: aggregated across all colorways
  const productSamples = useMemo(() => [
    {
      id: "sample-001",
      label: "Shoot Sample A",
      type: "Shoot sample",
      sizeRun: ["S", "M", "L"],
      status: "arrived",
      carrier: "FedEx",
      tracking: "7489201234567890",
      eta: "Jan 15, 2025",
      arrivedAt: "Jan 14, 2025",
      notes: "Primary hero colorway for campaign shoot",
      scopeSkuId: sku.id, // Tied to current colorway
    },
    {
      id: "sample-002",
      label: "Shoot Sample B",
      type: "Shoot sample",
      sizeRun: ["M"],
      status: "in_transit",
      carrier: "UPS",
      tracking: "1Z999AA10123456784",
      eta: "Jan 20, 2025",
      arrivedAt: null,
      notes: "Backup for flat lay shots",
      scopeSkuId: sku.id,
    },
    {
      id: "sample-003",
      label: "PP Sample 1",
      type: "Pre-production",
      sizeRun: ["S", "M", "L", "XL"],
      status: "requested",
      carrier: null,
      tracking: null,
      eta: "Jan 28, 2025",
      arrivedAt: null,
      notes: "Initial pre-production run for fit review",
      scopeSkuId: allSkus[1]?.id || sku.id,
    },
    {
      id: "sample-004",
      label: "PP Sample 2",
      type: "Pre-production",
      sizeRun: ["M", "L"],
      status: "in_transit",
      carrier: "DHL",
      tracking: "1234567890",
      eta: "Jan 22, 2025",
      arrivedAt: null,
      notes: "Second colorway pre-production",
      scopeSkuId: allSkus[2]?.id || sku.id,
    },
    {
      id: "sample-005",
      label: "Bulk Ref 1",
      type: "Bulk ref",
      sizeRun: ["M"],
      status: "arrived",
      carrier: "FedEx",
      tracking: "7489207777777777",
      eta: "Jan 10, 2025",
      arrivedAt: "Jan 9, 2025",
      notes: "Reference for color matching during bulk production",
      scopeSkuId: sku.id,
    },
    {
      id: "sample-006",
      label: "Shoot Sample C",
      type: "Shoot sample",
      sizeRun: ["XS", "S"],
      status: "issue",
      carrier: "USPS",
      tracking: "9400111899223100001234",
      eta: "Jan 12, 2025",
      arrivedAt: null,
      notes: "Wrong color shipped - needs replacement",
      scopeSkuId: allSkus[1]?.id || sku.id,
    },
    {
      id: "sample-007",
      label: "Bulk Ref 2",
      type: "Bulk ref",
      sizeRun: ["L", "XL"],
      status: "returned",
      carrier: "UPS",
      tracking: "1Z999AA10987654321",
      eta: null,
      arrivedAt: "Dec 20, 2024",
      notes: "Returned to factory after review",
      scopeSkuId: sku.id,
    },
    {
      id: "sample-008",
      label: "PP Sample 3",
      type: "Pre-production",
      sizeRun: ["S"],
      status: "requested",
      carrier: null,
      tracking: null,
      eta: "Feb 1, 2025",
      arrivedAt: null,
      notes: null,
      scopeSkuId: allSkus[0]?.id || sku.id,
    },
  ], [sku.id, allSkus]);

  // Colorway-scope samples: filter from productSamples by scopeSkuId
  const colorwaySamplesBySkuId = useMemo(() => {
    const bySkuId = {};
    productSamples.forEach((sample) => {
      const skuId = sample.scopeSkuId || sku.id;
      if (!bySkuId[skuId]) bySkuId[skuId] = [];
      bySkuId[skuId].push(sample);
    });
    return bySkuId;
  }, [productSamples, sku.id]);

  // Get samples for current scope
  const currentSamples = useMemo(() => {
    if (workspaceScope === "product") {
      return productSamples;
    }
    return colorwaySamplesBySkuId[sku.id] || [];
  }, [workspaceScope, productSamples, colorwaySamplesBySkuId, sku.id]);

  // Get workspace areas based on current scope
  const workspaceAreas = workspaceScope === "colorway"
    ? COLORWAY_WORKSPACE_AREAS
    : PRODUCT_WORKSPACE_AREAS;

  // Count computation - scope-aware
  const getCount = (countKey) => {
    if (workspaceScope === "product") {
      return aggregateProductCounts(family, allSkus, countKey);
    }
    // Colorway scope - use selected colorway data
    const data = sku[countKey];
    if (Array.isArray(data)) return data.length;
    if (typeof data === "number") return data;
    return 0;
  };

  // Scope-aware labels
  const scopeLabel = workspaceScope === "colorway" ? "Colorway" : "Product";
  const headerTitle = workspaceScope === "colorway" ? sku.colorName : family?.styleName || "Product";

  return (
    <div className="mt-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Panel header with scope toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {headerTitle}
          </h3>
          <span className="text-3xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
            {scopeLabel} Workspace
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope toggle */}
          <ScopeToggle
            scope={workspaceScope}
            onScopeChange={setWorkspaceScope}
            colorwayName={sku.colorName}
            productName={family?.styleName || "Product"}
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-column cockpit layout */}
      <div className="flex">
        {/* LEFT: Identity column - compact, subordinate to workspace */}
        <div className="flex-shrink-0 w-36 p-2 bg-slate-25 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-700">
          {/* Thumbnail - smaller when workspace is open */}
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
            {hasImage ? (
              <AppImage
                src={sku.imagePath}
                alt={sku.colorName}
                preferredSize={160}
                className="w-full h-full object-cover"
              />
            ) : sku.hexColor ? (
              <div
                className="w-full h-full"
                style={{ backgroundColor: sku.hexColor }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Palette className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
            )}
          </div>

          {/* Metadata stack - compact */}
          <div className="space-y-1.5">
            {/* SKU Code */}
            {sku.skuCode && (
              <div>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  SKU
                </p>
                <p className="text-2xs font-mono text-slate-600 dark:text-slate-400">
                  {sku.skuCode}
                </p>
              </div>
            )}

            {/* Hex Color */}
            {sku.hexColor && (
              <div>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Hex
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded border border-slate-200 dark:border-slate-600"
                    style={{ backgroundColor: sku.hexColor }}
                  />
                  <p className="text-2xs font-mono text-slate-600 dark:text-slate-400">
                    {sku.hexColor}
                  </p>
                </div>
              </div>
            )}

            {/* Status */}
            {sku.status === "discontinued" && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Discontinued
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Tabs-based workspace - primary surface */}
        <div className="flex-1 min-w-0 flex flex-col p-3 bg-slate-50/40 dark:bg-slate-750/30 border-l border-slate-50 dark:border-transparent">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            {/* Tab navigation with count badges */}
            <TabsList className="w-full justify-start">
              {workspaceAreas.map((area) => {
                const Icon = area.icon;
                const count = getCount(area.countKey);
                const isActive = activeTab === area.id;

                return (
                  <TabsTrigger
                    key={area.id}
                    value={area.id}
                    className="flex items-center gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{area.label}</span>
                    <CountBadge count={count} isActive={isActive} />
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab content panels */}
            <div className="flex-1 min-h-[160px] mt-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden">
              {workspaceAreas.map((area) => (
                <TabsContent
                  key={area.id}
                  value={area.id}
                  className="h-full mt-0"
                >
                  {area.id === "samples" ? (
                    <SamplesWorkspace
                      scope={workspaceScope}
                      colorwayName={sku.colorName}
                      productName={family?.styleName}
                      samples={currentSamples}
                      onJumpToColorway={handleJumpToColorway}
                    />
                  ) : (
                    <WorkspaceEmptyState config={area} scope={workspaceScope} />
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPageV2() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { clientId } = useAuth();

  const [family, setFamily] = useState(null);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedColorwayId, setSelectedColorwayId] = useState(null);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  // DEV MARKER: Identify which product detail component is mounted
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[ProductDetail] Mounted: ProductDetailPageV2 (src/pages/ProductDetailPageV2.jsx)");
    }
  }, []);

  // Fetch product family and SKUs
  useEffect(() => {
    if (!clientId || !productId) {
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch family document
        const familyRef = doc(db, ...productFamilyPath(productId, clientId));
        const familySnap = await getDoc(familyRef);

        if (!familySnap.exists()) {
          setError("Product not found");
          setLoading(false);
          return;
        }

        const familyData = { id: familySnap.id, ...familySnap.data() };
        setFamily(familyData);

        // Fetch SKUs
        const skusRef = collection(db, ...productFamilySkusPath(productId, clientId));
        const skusQuery = query(skusRef, orderBy("colorName", "asc"));
        const skusSnap = await getDocs(skusQuery);
        const skusData = skusSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((sku) => !sku.deleted);
        setSkus(skusData);
      } catch (err) {
        console.error("[ProductDetailPageV2] Fetch error:", err);
        setError("Failed to load product details");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [clientId, productId]);

  // Computed values
  const displayImage = useMemo(() => {
    return family?.thumbnailImagePath || family?.headerImagePath || null;
  }, [family]);

  const categoryLabel = useMemo(() => {
    if (!family) return null;
    return getCategoryLabel(family.gender, family.productType, family.productSubcategory);
  }, [family]);

  const sizeLabel = useMemo(() => {
    if (!family) return null;
    if (family.sizes?.length > 0) return family.sizes.join(", ");
    if (family.sizeOptions?.length > 0) return family.sizeOptions.join(", ");
    return null;
  }, [family]);

  // Notes display text - handles both legacy string and new array format
  const notesDisplayText = useMemo(() => getProductNotesText(family?.notes), [family?.notes]);

  // Find selected colorway object
  const selectedColorway = useMemo(() => {
    if (!selectedColorwayId) return null;
    return skus.find((sku) => sku.id === selectedColorwayId) || null;
  }, [selectedColorwayId, skus]);

  const handleBack = useCallback(() => {
    navigate("/products");
  }, [navigate]);

  // Toggle colorway selection - click same to deselect, click different to switch
  // When forceSelect is true, always select (used by "View colorway" button)
  const handleColorwaySelect = useCallback((skuId, forceSelect = false) => {
    setSelectedColorwayId((prev) => {
      if (forceSelect) return skuId;
      return prev === skuId ? null : skuId;
    });
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedColorwayId(null);
  }, []);

  // Guard: Redirect to products list if no clientId (user not properly authenticated)
  if (!clientId) {
    return <Navigate to="/products" replace />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading product details...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <Package className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {error}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            The product you're looking for may have been moved or deleted.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  // No family loaded (shouldn't happen but defensive)
  if (!family) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/*
        NAVIGATION BAR
        --------------
        Simplified: Just navigation, no redundant product name.
        The identity hero below carries the product name prominently.
      */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Products
            </Button>

            <Button variant="outline" size="sm" disabled title="Edit mode coming soon">
              <Edit3 className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/*
          IDENTITY HERO
          -------------
          This IS the product, not a "section about" the product.
          No card wrapper - the product identity fills the space.
          Large image, prominent name, status badge, contextual metadata.
        */}
        <section className="mb-10">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Hero image - larger, more prominent */}
            <div className="flex-shrink-0 w-full md:w-64">
              <div className="aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm">
                {displayImage ? (
                  <AppImage
                    src={displayImage}
                    alt={family.styleName}
                    preferredSize={512}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Identity content */}
            <div className="flex-1 flex flex-col justify-center">
              {/* Status badge */}
              <div className="mb-3">
                {family.status === "discontinued" ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Discontinued
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Active
                  </span>
                )}
              </div>

              {/* Product name - large, commanding */}
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {family.styleName}
              </h1>

              {/* Style number */}
              {family.styleNumber && (
                <p className="text-lg text-slate-500 dark:text-slate-400 mb-4">
                  Style #{family.styleNumber}
                </p>
              )}

              {/* Metadata strip - horizontal, separated by dots */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                {genderLabel(family.gender) && (
                  <>
                    <span>{genderLabel(family.gender)}</span>
                    {(categoryLabel || sizeLabel || skus.length > 0) && (
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                    )}
                  </>
                )}
                {categoryLabel && (
                  <>
                    <span>{categoryLabel}</span>
                    {(sizeLabel || skus.length > 0) && (
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                    )}
                  </>
                )}
                {sizeLabel && (
                  <>
                    <span>Sizes: {sizeLabel}</span>
                    {skus.length > 0 && (
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                    )}
                  </>
                )}
                {skus.length > 0 && (
                  <span>{skus.length} colorway{skus.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {/* Notes - if present, subtle below metadata */}
              {notesDisplayText && (
                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {notesDisplayText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/*
          COLORWAYS - CORE WORKING SURFACE (v2)
          -------------------------------------
          Redesigned as a scannable matrix/grid instead of a vertical list.

          Mental model:
          - Grid view = "scan state" - all colorways visible at once
          - Selected colorway expands detail panel below = "focus state"
          - Sizes removed from colorway level (belong to product family)
          - Detail panel is the future zone for colorway-specific:
            samples, notes, tasks, tracking

          Layout principles:
          - CSS Grid for responsive tile arrangement
          - Tiles are compact: thumbnail + name only
          - Selection indicated by ring + background
          - Detail panel appears in-context below grid (no modals)
          - Clear visual boundary between scan and focus states
        */}
        <section className="mb-8">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
            {/* Section header - compact */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <Palette className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {skus.length} colorway{skus.length !== 1 ? "s" : ""}
                  </h2>
                  {selectedColorway && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedColorway.colorName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Colorway grid - scan state */}
            <div className="p-3">
              {skus.length > 0 ? (
                <>
                  {/* Dense responsive grid - tiles self-size, minimal gaps */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0.5">
                    {skus.map((sku) => (
                      <ColorwayTile
                        key={sku.id}
                        sku={sku}
                        isSelected={selectedColorwayId === sku.id}
                        onSelect={() => handleColorwaySelect(sku.id)}
                      />
                    ))}
                  </div>

                  {/* Detail panel - focus state (appears when colorway selected) */}
                  {selectedColorway && (
                    <ColorwayDetailPanel
                      sku={selectedColorway}
                      family={family}
                      allSkus={skus}
                      onClose={handleCloseDetail}
                      onSelectColorway={handleColorwaySelect}
                    />
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <Palette className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No colorways have been added to this product yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/*
          ROADMAP DISCLOSURE
          ------------------
          Collapsed by default. Hints at future features without competing
          with the cockpit workspace. Low visual priority.
        */}
        <section className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setRoadmapOpen((o) => !o)}
            className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors group"
            aria-expanded={roadmapOpen}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${roadmapOpen ? "" : "-rotate-90"}`}
            />
            <span className="text-xxs font-medium uppercase tracking-wider">
              Roadmap
            </span>
            <span className="text-2xs text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500">
              Upcoming features
            </span>
          </button>

          {roadmapOpen && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Sample Management */}
              <div className="rounded-md border border-dashed border-slate-150 dark:border-slate-700/50 bg-slate-25 dark:bg-slate-800/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                  <span className="text-xxs text-slate-400 dark:text-slate-500">
                    Sample Management
                  </span>
                </div>
              </div>

              {/* Asset Library */}
              <div className="rounded-md border border-dashed border-slate-150 dark:border-slate-700/50 bg-slate-25 dark:bg-slate-800/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                  <span className="text-xxs text-slate-400 dark:text-slate-500">
                    Asset Library
                  </span>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="rounded-md border border-dashed border-slate-150 dark:border-slate-700/50 bg-slate-25 dark:bg-slate-800/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                  <span className="text-xxs text-slate-400 dark:text-slate-500">
                    Activity Feed
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
