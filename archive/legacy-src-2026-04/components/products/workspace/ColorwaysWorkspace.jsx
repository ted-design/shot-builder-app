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
import { Palette, X, Box, Activity, FileText, Package, AlertCircle, CalendarClock, Boxes, Check, Truck, Plus } from "lucide-react";
import AppImage from "../../common/AppImage";
import { useWorkspace } from "./WorkspaceContext";
import SectionHeader from "./SectionHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { Modal } from "../../ui/modal";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

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
        mt-1.5 text-xxs font-medium text-center truncate w-full max-w-[72px]
        ${isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}
      `}>
        {sku.colorName}
      </p>

      {/* Micro-metrics row - subtle sample counts */}
      {hasMetrics && (
        <div className="mt-1 flex items-center justify-center gap-1.5">
          {metrics.arrived > 0 && (
            <span className="flex items-center gap-0.5 text-3xs text-emerald-600/70 dark:text-emerald-400/70" title={`${metrics.arrived} arrived`}>
              <Check className="w-2.5 h-2.5" />
              <span>{metrics.arrived}</span>
            </span>
          )}
          {metrics.inTransit > 0 && (
            <span className="flex items-center gap-0.5 text-3xs text-blue-500/70 dark:text-blue-400/70" title={`${metrics.inTransit} in transit`}>
              <Truck className="w-2.5 h-2.5" />
              <span>{metrics.inTransit}</span>
            </span>
          )}
          {metrics.issues > 0 && (
            <span className="flex items-center gap-0.5 text-3xs text-amber-600 dark:text-amber-400" title={`${metrics.issues} issues`}>
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
          <p className="text-2xs text-slate-400/70 dark:text-slate-500/70 mt-3 uppercase tracking-wider">
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
              {sample.type === "shoot" ? "Shoot" : sample.type === "pre_production" ? "Pre-Prod" : sample.type === "bulk" ? "Bulk" : sample.type} · {sample.sizeRun?.join(" · ") || "No sizes"}
              {sample.type === "bulk" && sample.quantity && ` · ${sample.quantity} units`}
            </p>
            {/* DEV-only: Subtle scoping indicator for verification */}
            {import.meta.env.DEV && sample.scopeSkuId && (
              <p className="text-3xs text-slate-400/60 dark:text-slate-500/60 font-mono mt-0.5 truncate">
                scope: {sample.scopeSkuId}
              </p>
            )}
          </div>
          <span
            className={`
              px-1.5 py-0.5 rounded text-2xs font-medium
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
        <p className="text-2xs font-medium uppercase tracking-wider opacity-60">{label}</p>
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

// ============================================================================
// ADD SAMPLE MODAL (In-Memory Only)
// ============================================================================

const SAMPLE_TYPES = [
  { value: "shoot", label: "Shoot", description: "For photo/video production" },
  { value: "pre_production", label: "Pre-Prod", description: "For fitting & planning" },
  { value: "bulk", label: "Bulk", description: "Production supply" },
];

const SAMPLE_STATUSES = [
  { value: "arrived", label: "Arrived" },
  { value: "in_transit", label: "In Transit" },
  { value: "requested", label: "Requested" },
  { value: "delayed", label: "Delayed" },
  { value: "issue", label: "Issue" },
];

/**
 * Size chip multi-select picker
 * Renders available sizes as toggleable chips for intuitive selection.
 */
function SizeChipPicker({ availableSizes = [], selectedSizes = [], onChange }) {
  // Fallback if no canonical sizes available
  const sizes = availableSizes.length > 0 ? availableSizes : ["XS", "S", "M", "L", "XL"];

  const toggleSize = (size) => {
    if (selectedSizes.includes(size)) {
      onChange(selectedSizes.filter((s) => s !== size));
    } else {
      onChange([...selectedSizes, size]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sizes.map((size) => {
          const isSelected = selectedSizes.includes(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`
                px-2.5 py-1 rounded-md text-xs font-medium transition-all
                ${isSelected
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                }
              `}
            >
              {size}
            </button>
          );
        })}
      </div>
      <p className="text-2xs text-slate-400 dark:text-slate-500">
        Select sizes available for this sample
      </p>
    </div>
  );
}

/**
 * Type selector pills - segmented control style
 */
function TypeSelector({ value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg">
      {SAMPLE_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          className={`
            flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
            ${value === type.value
              ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }
          `}
          title={type.description}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Bento block wrapper for visual grouping
 */
function BentoBlock({ title, children, className = "" }) {
  return (
    <div className={`rounded-lg border border-slate-150 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 ${className}`}>
      <div className="px-3 py-2 border-b border-slate-150 dark:border-slate-700">
        <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </p>
      </div>
      <div className="p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * Modal for adding a sample in-memory (no Firestore persistence).
 * Used for workflow validation during development.
 *
 * Layout: 3 bento blocks
 * 1. What is it? - Type, Status, Quantity (bulk only)
 * 2. Where is it? - ETA, Carrier, Tracking
 * 3. What can we use? - Size run, Notes
 */
function AddSampleModal({ open, onClose, onAdd, skuId, colorName, availableSizes = [] }) {
  // What is it?
  const [sampleType, setSampleType] = useState("shoot");
  const [status, setStatus] = useState("in_transit");
  const [quantity, setQuantity] = useState("");

  // Where is it?
  const [eta, setEta] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  // What can we use?
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Use selected sizes directly, or default fallback if empty
    const sizeRun = selectedSizes.length > 0 ? selectedSizes : ["S", "M", "L"];

    const newSample = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      scopeSkuId: skuId,
      label: `${colorName} Sample`,
      type: sampleType,
      sizeRun,
      status,
      quantity: sampleType === "bulk" && quantity ? parseInt(quantity, 10) : null,
      eta: eta || null,
      carrier: carrier || null,
      tracking: tracking || null,
      note: note || null,
    };
    onAdd(newSample);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSampleType("shoot");
    setStatus("in_transit");
    setQuantity("");
    setEta("");
    setCarrier("");
    setTracking("");
    setSelectedSizes([]);
    setNote("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} contentClassName="!max-w-lg">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Add Sample
            </h3>
            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 tracking-wide">
              Local only · Not persisted
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body - Bento Grid */}
        <div className="p-4 space-y-3">
          {/* Block 1: What is it? */}
          <BentoBlock title="What is it?">
            {/* Type selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Type
              </label>
              <TypeSelector value={sampleType} onChange={setSampleType} />
            </div>

            {/* Status + Quantity row */}
            <div className={`grid gap-3 ${sampleType === "bulk" ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-indigo-500/50"
                >
                  {SAMPLE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity - only for bulk */}
              {sampleType === "bulk" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Units"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          </BentoBlock>

          {/* Block 2: Where is it? */}
          <BentoBlock title="Where is it?">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  ETA
                </label>
                <Input
                  type="date"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Carrier
                </label>
                <Input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="UPS, FedEx..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Tracking
                </label>
                <Input
                  type="text"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="1Z..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </BentoBlock>

          {/* Block 3: What can we use? */}
          <BentoBlock title="What can we use?">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Size Run
              </label>
              <SizeChipPicker
                availableSizes={availableSizes}
                selectedSizes={selectedSizes}
                onChange={setSelectedSizes}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Notes
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any notes about this sample..."
                rows={2}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-indigo-500/50 resize-none"
              />
            </div>
          </BentoBlock>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Add Sample
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ColorwayCockpit({ sku, onClose, samples = [], onAddSample, availableSizes = [] }) {
  const hasImage = Boolean(sku.imagePath);
  const [activeTab, setActiveTab] = useState("samples");
  const [addSampleOpen, setAddSampleOpen] = useState(false);

  return (
    <>
      <AddSampleModal
        open={addSampleOpen}
        onClose={() => setAddSampleOpen(false)}
        onAdd={onAddSample}
        skuId={sku.id}
        colorName={sku.colorName}
        availableSizes={availableSizes}
      />
    <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sku.colorName}</h3>
          <span className="text-3xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
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
      <div className="flex max-h-[min(60vh,560px)]">
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
              <p className="text-2xs text-slate-400 dark:text-slate-500 truncate" title={sku.skuCode}>
                SKU: {sku.skuCode}
              </p>
            )}
            {sku.status === "discontinued" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Discontinued
              </span>
            )}
          </div>
        </div>

        {/* Right: Workspace tabs - scroll container */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {/* Sticky header area: At-a-glance + Tab triggers + Add Sample button */}
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 p-4 pb-2">
            {/* At-a-glance status row */}
            <AtAGlanceRow sku={sku} samples={samples} />

            <div className="flex items-center justify-between gap-2">
              <TabsList className="justify-start">
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

              {/* Add Sample button - aligned right */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddSampleOpen(true)}
                className="gap-1 text-xs h-7 px-2"
              >
                <Plus className="w-3 h-3" />
                Add sample
              </Button>
            </div>
          </div>

          {/* Tab content - scrolls under the sticky header */}
          <div className="px-4 pb-4">
            <TabsContent value="samples" className="mt-0">
              <CockpitSamplesTab sku={sku} samples={samples} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <CockpitTabPlaceholder
                icon={Activity}
                title="Activity timeline"
                description="Comments, updates, and changes for this colorway will appear here."
              />
            </TabsContent>

            <TabsContent value="assets" className="mt-0">
              <CockpitTabPlaceholder
                icon={FileText}
                title="Colorway assets"
                description="Tech packs, reference images, and documents for this colorway."
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
    </>
  );
}

// ============================================================================
// MAIN COLORWAYS SECTION
// ============================================================================

export default function ColorwaysSection({ family, skus, samples = [] }) {
  const { selectedColorwayId, setSelectedColorwayId } = useWorkspace();
  const tileRefs = useRef({});
  const cockpitRef = useRef(null);

  // Extract canonical sizes from product family
  const availableSizes = useMemo(() => {
    if (Array.isArray(family?.sizes) && family.sizes.length > 0) {
      return family.sizes.filter(Boolean);
    }
    if (Array.isArray(family?.sizeOptions) && family.sizeOptions.length > 0) {
      return family.sizeOptions.filter(Boolean);
    }
    return [];
  }, [family?.sizes, family?.sizeOptions]);

  // Local-only samples state - stores only samples added via the UI (not from props)
  // This separation prevents prop updates from clobbering local additions
  const [localSamples, setLocalSamples] = useState([]);

  // DEV-only: check if forceEmptySamples is active
  const forceEmptySamples = useMemo(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      return params.get("forceEmptySamples") === "1";
    }
    return false;
  }, []);

  // Effective samples: merge base (props) + local additions with deduplication
  // On id collision, base samples (from props) win since they represent "real" persisted data
  const effectiveSamples = useMemo(() => {
    if (forceEmptySamples) {
      return [];
    }
    // Build a Set of base sample IDs for O(1) collision detection
    const baseIds = new Set(samples.map((s) => s.id));
    // Filter out any local samples that would collide with base samples
    const uniqueLocalSamples = localSamples.filter((s) => !baseIds.has(s.id));
    // Return merged array: base samples first, then unique local additions
    return [...samples, ...uniqueLocalSamples];
  }, [samples, localSamples, forceEmptySamples]);

  // Handler to add a sample to local-only state (does not touch base samples from props)
  const handleAddSample = useCallback((newSample) => {
    setLocalSamples((prev) => [...prev, newSample]);
  }, []);

  const selectedColorway = useMemo(() => {
    if (!selectedColorwayId) return null;
    return skus.find((sku) => sku.id === selectedColorwayId) || null;
  }, [selectedColorwayId, skus]);

  const handleColorwaySelect = useCallback((skuId) => {
    setSelectedColorwayId((prev) => (prev === skuId ? null : skuId));
  }, [setSelectedColorwayId]);

  const handleCloseDetail = useCallback(() => {
    setSelectedColorwayId(null);
  }, [setSelectedColorwayId]);

  // Ref callback for each tile
  const setTileRef = useCallback((skuId) => (el) => {
    tileRefs.current[skuId] = el;
  }, []);

  // Scroll cockpit into view when opening (not when closing or already visible)
  // Uses double requestAnimationFrame for deterministic DOM/layout readiness:
  // - First rAF: React has committed DOM updates
  // - Second rAF: Browser has completed layout/paint
  useEffect(() => {
    if (!selectedColorwayId || !cockpitRef.current) return;

    let rafId1;
    let rafId2;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        const cockpit = cockpitRef.current;
        if (!cockpit) return;

        const rect = cockpit.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if cockpit bottom is below viewport (not visible) or top is above viewport
        // Using a 40px threshold to ensure some content is visible
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
  }, [selectedColorwayId]);

  // Scroll selected tile into view when selection changes (cockpit must be open)
  // Centralized handler for both click and keyboard navigation
  useEffect(() => {
    if (!selectedColorwayId) return;

    const tileEl = tileRefs.current[selectedColorwayId];
    if (!tileEl) return;

    // Small delay for DOM stability after state update
    const timeoutId = setTimeout(() => {
      tileEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [selectedColorwayId]);

  // Keyboard navigation for colorways when cockpit is open
  // Arrow keys move selection to prev/next colorway with wrap-around
  useEffect(() => {
    // Only active when cockpit is open and there are colorways to navigate
    if (!selectedColorwayId || skus.length === 0) return;

    const handleKeyDown = (event) => {
      // Guard: ignore if user is typing in an input, textarea, select, or contenteditable
      const tag = event.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        event.target.isContentEditable
      ) {
        return;
      }

      const isLeft = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const isRight = event.key === "ArrowRight" || event.key === "ArrowDown";

      if (!isLeft && !isRight) return;

      event.preventDefault();

      const currentIndex = skus.findIndex((s) => s.id === selectedColorwayId);
      if (currentIndex === -1) return;

      let nextIndex;
      if (isLeft) {
        // Previous with wrap: last → first
        nextIndex = currentIndex === 0 ? skus.length - 1 : currentIndex - 1;
      } else {
        // Next with wrap: first → last
        nextIndex = currentIndex === skus.length - 1 ? 0 : currentIndex + 1;
      }

      const nextSku = skus[nextIndex];
      if (nextSku) {
        setSelectedColorwayId(nextSku.id);
        // Scroll handled by centralized useEffect watching selectedColorwayId
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedColorwayId, skus, setSelectedColorwayId]);

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
                samples={effectiveSamples}
                tileRef={setTileRef(sku.id)}
              />
            ))}
          </div>

          {/* Cockpit panel with workspace tabs - only when colorway selected */}
          {selectedColorway && (
            <div ref={cockpitRef}>
              <ColorwayCockpit
                sku={selectedColorway}
                onClose={handleCloseDetail}
                samples={effectiveSamples}
                onAddSample={handleAddSample}
                availableSizes={availableSizes}
              />
            </div>
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
