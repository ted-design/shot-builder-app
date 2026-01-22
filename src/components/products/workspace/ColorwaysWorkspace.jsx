/**
 * ColorwaysWorkspace - Colorway management section for product workspace
 *
 * Contains:
 * - ColorwayTile - Thumbnail selector for colorways
 * - ColorwayCockpit - Detail panel for selected colorway with workspace tabs
 * - ColorwaysSection - Main section component
 *
 * V3 UPGRADE: Cockpit now has a two-column layout:
 * - Left: Identity column (image, hex, minimal meta)
 * - Right: Workspace tabs (Samples, Activity, Assets)
 */

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Palette, X, Box, Activity, FileText, Package, AlertCircle, CalendarClock, Boxes, Check, Truck } from "lucide-react";
import AppImage from "../../common/AppImage";
import { useWorkspace } from "./WorkspaceContext";
import SectionHeader from "./SectionHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";

// ============================================================================
// SHARED SAMPLE STATUS HELPERS
// ============================================================================

/**
 * Single source of truth for classifying sample status.
 * Used by both tile micro-metrics and cockpit at-a-glance row.
 */
const SAMPLE_STATUS_MAP = {
  arrived: (s) => s.status === "arrived",
  inTransit: (s) => s.status === "in_transit",
  issue: (s) => s.status === "issue" || s.status === "delayed",
};

/**
 * Compute unified stats for a set of samples.
 * Centralizes status mapping so tile metrics and cockpit at-a-glance stay in sync.
 *
 * @param {Array} samples - Array of sample objects
 * @returns {Object} { arrivedCount, transitCount, issuesCount, nextEta, total }
 */
function computeSampleStats(samples) {
  const total = samples.length;
  const arrivedCount = samples.filter(SAMPLE_STATUS_MAP.arrived).length;
  const transitCount = samples.filter(SAMPLE_STATUS_MAP.inTransit).length;
  const issuesCount = samples.filter(SAMPLE_STATUS_MAP.issue).length;

  // Find next ETA from samples that have an eta field and are in transit/requested
  const upcomingEtas = samples
    .filter((s) => s.eta && (s.status === "in_transit" || s.status === "requested"))
    .map((s) => new Date(s.eta))
    .filter((d) => !isNaN(d.getTime()) && d > new Date())
    .sort((a, b) => a - b);

  const nextEta = upcomingEtas.length > 0 ? upcomingEtas[0] : null;

  return { arrivedCount, transitCount, issuesCount, nextEta, total };
}

// ============================================================================
// COLORWAY TILE
// ============================================================================

/**
 * Hook to compute micro-metrics for a colorway's samples
 */
function useColorwayMetrics(sku, samples = []) {
  return useMemo(() => {
    const colorwaySamples = samples.filter((s) => s.scopeSkuId === sku.id);
    const stats = computeSampleStats(colorwaySamples);
    // Alias for backward compat with tile rendering
    return {
      arrived: stats.arrivedCount,
      inTransit: stats.transitCount,
      issues: stats.issuesCount,
      total: stats.total,
    };
  }, [sku.id, samples]);
}

export function ColorwayTile({ sku, isSelected, onSelect, samples = [], tileRef }) {
  const hasImage = Boolean(sku.imagePath);
  const metrics = useColorwayMetrics(sku, samples);
  const hasMetrics = metrics.total > 0;

  return (
    <button
      ref={tileRef}
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col items-center p-2 rounded-lg transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-500 shadow-sm"
          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700"
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${sku.colorName}${isSelected ? " (selected)" : ""}`}
    >
      <div className={`
        w-14 h-14 rounded-md overflow-hidden transition-all
        ${isSelected ? "shadow-md" : "shadow-sm group-hover:shadow-md"}
        ${!hasImage && !sku.hexColor ? "bg-slate-100 dark:bg-slate-700" : ""}
      `}>
        {hasImage ? (
          <AppImage src={sku.imagePath} alt={sku.colorName} preferredSize={112} className="w-full h-full object-cover" />
        ) : sku.hexColor ? (
          <div className="w-full h-full" style={{ backgroundColor: sku.hexColor }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Palette className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>

      <p className={`
        mt-1.5 text-[11px] font-medium text-center truncate w-full max-w-[72px]
        ${isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
      `}>
        {sku.colorName}
      </p>

      {/* Micro-metrics row - subtle sample counts */}
      {hasMetrics && (
        <div className="mt-1 flex items-center justify-center gap-1.5">
          {metrics.arrived > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-emerald-600/70 dark:text-emerald-400/70" title={`${metrics.arrived} arrived`}>
              <Check className="w-2.5 h-2.5" />
              <span>{metrics.arrived}</span>
            </span>
          )}
          {metrics.inTransit > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-blue-500/70 dark:text-blue-400/70" title={`${metrics.inTransit} in transit`}>
              <Truck className="w-2.5 h-2.5" />
              <span>{metrics.inTransit}</span>
            </span>
          )}
          {metrics.issues > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400" title={`${metrics.issues} issues`}>
              <AlertCircle className="w-2.5 h-2.5" />
              <span>{metrics.issues}</span>
            </span>
          )}
        </div>
      )}

      {sku.status === "discontinued" && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" title="Discontinued" />
      )}
    </button>
  );
}

// ============================================================================
// COLORWAY COCKPIT (Detail Panel with Workspace Tabs)
// ============================================================================

/**
 * Placeholder content for cockpit workspace tabs
 */
function CockpitTabPlaceholder({ icon: Icon, title, description }) {
  return (
    <div className="py-8 text-center">
      <Icon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  );
}

/**
 * Empty state for Samples tab - designed for zero-sample colorways
 */
function SamplesEmptyState() {
  return (
    <div className="py-6 px-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center">
          <Box className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="pt-0.5">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No samples tracked
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
            Samples for this colorway will appear here once added.
          </p>
          <p className="text-[10px] text-slate-400/70 dark:text-slate-500/70 mt-3 uppercase tracking-wider">
            Next: Request or log a sample
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Samples tab content - shows samples scoped to the selected colorway
 */
function CockpitSamplesTab({ sku, samples = [] }) {
  // Filter samples that belong to this colorway
  const colorwaySamples = useMemo(
    () => samples.filter((s) => s.scopeSkuId === sku.id),
    [samples, sku.id]
  );

  if (colorwaySamples.length === 0) {
    return <SamplesEmptyState />;
  }

  return (
    <div className="space-y-2">
      {colorwaySamples.map((sample) => (
        <div
          key={sample.id}
          className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
        >
          <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
              {sample.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sample.type} · {sample.sizeRun?.join(", ") || "No sizes"}
            </p>
          </div>
          <span
            className={`
              px-1.5 py-0.5 rounded text-[10px] font-medium
              ${sample.status === "arrived" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
              ${sample.status === "in_transit" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : ""}
              ${sample.status === "requested" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}
              ${sample.status === "issue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : ""}
              ${sample.status === "returned" ? "bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300" : ""}
            `}
          >
            {sample.status?.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// AT-A-GLANCE STATUS ROW
// ============================================================================

/**
 * Compact status chip for the at-a-glance row
 */
function GlanceChip({ icon: Icon, label, value, variant = "default" }) {
  const variantStyles = {
    default: "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300",
    success: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    info: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${variantStyles[variant]}`}>
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider opacity-60">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

/**
 * At-a-glance status row - provides quick scannable metrics for the selected colorway
 */
function AtAGlanceRow({ sku, samples = [] }) {
  // Filter samples for this colorway and compute stats using shared helper
  const stats = useMemo(() => {
    const colorwaySamples = samples.filter((s) => s.scopeSkuId === sku.id);
    const computed = computeSampleStats(colorwaySamples);
    // Alias for template compatibility
    return {
      total: computed.total,
      arrived: computed.arrivedCount,
      inTransit: computed.transitCount,
      issues: computed.issuesCount,
      nextEta: computed.nextEta,
    };
  }, [samples, sku.id]);

  // Format ETA for display
  const formatEta = (date) => {
    if (!date) return "—";
    const options = { month: "short", day: "numeric" };
    return date.toLocaleDateString(undefined, options);
  };

  // Build samples display - deliberate formatting for zero state
  const samplesDisplay = stats.total === 0
    ? "None tracked"
    : `${stats.arrived} arrived · ${stats.inTransit} in transit`;

  // Issues display - handle zero-sample case deliberately
  const issuesDisplay = stats.total === 0
    ? "—"
    : stats.issues > 0
      ? `${stats.issues} flagged`
      : "None";

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
      <div className="flex flex-wrap gap-2">
        <GlanceChip
          icon={Boxes}
          label="Samples"
          value={samplesDisplay}
          variant="default"
        />
        <GlanceChip
          icon={CalendarClock}
          label="Next ETA"
          value={formatEta(stats.nextEta)}
          variant={stats.nextEta ? "info" : "default"}
        />
        <GlanceChip
          icon={AlertCircle}
          label="Issues"
          value={issuesDisplay}
          variant={stats.issues > 0 ? "warning" : stats.total === 0 ? "default" : "success"}
        />
      </div>
    </div>
  );
}

export function ColorwayCockpit({ sku, onClose, samples = [] }) {
  const hasImage = Boolean(sku.imagePath);
  const [activeTab, setActiveTab] = useState("samples");

  return (
    <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sku.colorName}</h3>
          <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
            Colorway Workspace
          </span>
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

      {/* Two-column layout: Identity | Workspace */}
      <div className="flex">
        {/* Left: Identity column */}
        <div className="flex-shrink-0 w-40 p-4 border-r border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          {/* Larger thumbnail */}
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shadow-sm">
            {hasImage ? (
              <AppImage src={sku.imagePath} alt={sku.colorName} preferredSize={240} className="w-full h-full object-cover" />
            ) : sku.hexColor ? (
              <div className="w-full h-full" style={{ backgroundColor: sku.hexColor }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Palette className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
            )}
          </div>

          {/* Minimal meta */}
          <div className="mt-3 space-y-2">
            {sku.hexColor && (
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded border border-slate-200 dark:border-slate-600 flex-shrink-0"
                  style={{ backgroundColor: sku.hexColor }}
                />
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{sku.hexColor}</p>
              </div>
            )}
            {sku.skuCode && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={sku.skuCode}>
                SKU: {sku.skuCode}
              </p>
            )}
            {sku.status === "discontinued" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Discontinued
              </span>
            )}
          </div>
        </div>

        {/* Right: Workspace tabs */}
        <div className="flex-1 p-4 min-w-0">
          {/* At-a-glance status row */}
          <AtAGlanceRow sku={sku} samples={samples} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="samples" className="gap-1.5">
                <Box className="w-3.5 h-3.5" />
                Samples
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Assets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="samples">
              <CockpitSamplesTab sku={sku} samples={samples} />
            </TabsContent>

            <TabsContent value="activity">
              <CockpitTabPlaceholder
                icon={Activity}
                title="Activity timeline"
                description="Comments, updates, and changes for this colorway will appear here."
              />
            </TabsContent>

            <TabsContent value="assets">
              <CockpitTabPlaceholder
                icon={FileText}
                title="Colorway assets"
                description="Tech packs, reference images, and documents for this colorway."
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COLORWAYS SECTION
// ============================================================================

export default function ColorwaysSection({ family, skus, samples = [] }) {
  const { selectedColorwayId, setSelectedColorwayId } = useWorkspace();
  const tileRefs = useRef({});

  const selectedColorway = useMemo(() => {
    if (!selectedColorwayId) return null;
    return skus.find((sku) => sku.id === selectedColorwayId) || null;
  }, [selectedColorwayId, skus]);

  const handleColorwaySelect = useCallback((skuId) => {
    setSelectedColorwayId((prev) => {
      const isOpening = prev !== skuId;
      // Scroll tile into view when opening (not closing)
      if (isOpening && tileRefs.current[skuId]) {
        // Small delay to allow state update before scroll
        setTimeout(() => {
          tileRefs.current[skuId]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }, 50);
      }
      return prev === skuId ? null : skuId;
    });
  }, [setSelectedColorwayId]);

  const handleCloseDetail = useCallback(() => {
    setSelectedColorwayId(null);
  }, [setSelectedColorwayId]);

  // Ref callback for each tile
  const setTileRef = useCallback((skuId) => (el) => {
    tileRefs.current[skuId] = el;
  }, []);

  return (
    <div className="p-6">
      <SectionHeader
        title="Colorways"
        count={skus.length}
        className="px-0 border-0 pb-4"
      />

      {skus.length > 0 ? (
        <>
          {/* Colorway grid - dense, scannable tiles */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1">
            {skus.map((sku) => (
              <ColorwayTile
                key={sku.id}
                sku={sku}
                isSelected={selectedColorwayId === sku.id}
                onSelect={() => handleColorwaySelect(sku.id)}
                samples={samples}
                tileRef={setTileRef(sku.id)}
              />
            ))}
          </div>

          {/* Cockpit panel with workspace tabs - only when colorway selected */}
          {selectedColorway && (
            <ColorwayCockpit
              sku={selectedColorway}
              onClose={handleCloseDetail}
              samples={samples}
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
  );
}
