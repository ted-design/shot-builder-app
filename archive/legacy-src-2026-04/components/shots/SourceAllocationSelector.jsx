/**
 * SourceAllocationSelector - Allocation source picker for shot products
 *
 * Progressive disclosure design:
 * - Default: "Bulk assumed" (calm, neutral state - bulk is the baseline)
 * - If shoot/pre-prod samples exist: show subtle "Samples exist" indicator
 * - Click to reveal options: Bulk (default) or Use specific supply
 * - Only show full source list when user explicitly chooses "Use specific supply"
 *
 * This is an in-memory workflow validation component (no Firestore persistence).
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { Package, Check, ChevronDown, X, Info } from "lucide-react";

/**
 * Mock supply data generator for workflow validation.
 * In production, this would come from Firestore samples collection.
 *
 * @param {string} colorwayId - The colorway ID to scope samples to
 * @param {Array} familySizes - Available sizes from the product family
 * @returns {Array} Mock supply records
 */
export function generateMockSupplyRecords(colorwayId, familySizes = []) {
  // Use a deterministic seed based on colorwayId so mock data is consistent
  const seed = colorwayId ? colorwayId.charCodeAt(0) % 5 : 0;
  const sizes = familySizes.length > 0 ? familySizes : ["XS", "S", "M", "L", "XL"];

  // Generate 0-3 mock samples per colorway
  const sampleCount = seed % 4;
  if (sampleCount === 0) return [];

  const mockSamples = [];
  const sampleTypes = ["Shoot sample", "Pre-prod", "Bulk ref"];
  const statuses = ["arrived", "in_transit", "requested"];

  for (let i = 0; i < sampleCount; i++) {
    // Each sample has a subset of sizes
    const startIdx = i % sizes.length;
    const endIdx = Math.min(startIdx + 2 + (i % 2), sizes.length);
    const sizeRun = sizes.slice(startIdx, endIdx);

    mockSamples.push({
      id: `mock-${colorwayId}-${i}`,
      label: `${sampleTypes[i % sampleTypes.length]} #${i + 1}`,
      type: sampleTypes[i % sampleTypes.length],
      sizeRun,
      status: statuses[(seed + i) % statuses.length],
      eta: statuses[(seed + i) % statuses.length] === "in_transit" ? "Jan 25" : null,
      arrivedAt: statuses[(seed + i) % statuses.length] === "arrived" ? "Jan 20" : null,
    });
  }

  return mockSamples;
}

/**
 * Status badge for supply source
 */
function SourceStatusBadge({ status }) {
  const config = {
    arrived: {
      label: "Arrived",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    in_transit: {
      label: "In transit",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    requested: {
      label: "Requested",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
  };

  const { label, className } = config[status] || config.requested;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-medium ${className}`}>
      {label}
    </span>
  );
}

/**
 * SourceAllocationSelector - Progressive disclosure source picker
 *
 * States:
 * 1. "Bulk assumed" - Default calm state (bulk is baseline assumption)
 * 2. "Bulk assumed · Samples exist" - When shoot/pre-prod samples available
 * 3. "Allocated" - When user explicitly selects a specific supply source
 *
 * @param {string} selectedSize - Currently selected size (filters available sources)
 * @param {string} colorwayId - Colorway ID to scope supply lookup
 * @param {Array} supplySources - Array of supply/sample records (optional, uses mock if not provided)
 * @param {Array} familySizes - Available sizes from product family (for mock generation)
 * @param {string|null} selectedSourceId - Currently selected source ID
 * @param {function} onSourceChange - Callback when source selection changes
 * @param {function} onRequestSpecificSupply - Callback when user wants specific supply (triggers size selection)
 * @param {boolean} disabled - Whether the selector is disabled
 */
export default function SourceAllocationSelector({
  selectedSize,
  colorwayId,
  supplySources,
  familySizes = [],
  selectedSourceId,
  onSourceChange,
  onRequestSpecificSupply,
  disabled = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSourceList, setShowSourceList] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
        setShowSourceList(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Use provided sources or generate mock data
  const availableSources = useMemo(() => {
    if (supplySources && supplySources.length > 0) {
      return supplySources;
    }
    return generateMockSupplyRecords(colorwayId, familySizes);
  }, [supplySources, colorwayId, familySizes]);

  // Check if shoot/pre-prod samples exist (not just bulk refs)
  const hasSampleSupply = useMemo(() => {
    return availableSources.some(
      (s) => s.type === "Shoot sample" || s.type === "Pre-prod"
    );
  }, [availableSources]);

  // Filter sources that contain the selected size
  const viableSources = useMemo(() => {
    if (!selectedSize) return availableSources;
    return availableSources.filter(
      (source) => Array.isArray(source.sizeRun) && source.sizeRun.includes(selectedSize)
    );
  }, [availableSources, selectedSize]);

  // Get selected source details
  const selectedSource = useMemo(() => {
    if (!selectedSourceId) return null;
    return availableSources.find((s) => s.id === selectedSourceId) || null;
  }, [availableSources, selectedSourceId]);

  const handleSelectSource = (sourceId) => {
    onSourceChange(sourceId);
    setMenuOpen(false);
    setShowSourceList(false);
  };

  const handleUseBulk = () => {
    onSourceChange(null);
    setMenuOpen(false);
    setShowSourceList(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSourceChange(null);
  };

  // If user has explicitly selected a source, show allocated state
  if (selectedSource) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setMenuOpen(!menuOpen)}
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors min-w-[90px]
            bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400
            border border-emerald-200 dark:border-emerald-800
            hover:bg-emerald-100 dark:hover:bg-emerald-900/30
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{selectedSource.label}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </button>

        {/* Quick menu to change or clear */}
        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30 min-w-[160px]">
            <button
              type="button"
              onClick={handleUseBulk}
              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Package className="w-3 h-3 text-slate-400" />
              <span className="text-slate-600 dark:text-slate-300">Use bulk instead</span>
            </button>
            {viableSources.length > 1 && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                <button
                  type="button"
                  onClick={() => setShowSourceList(true)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Change source...</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default state: Bulk assumed (with optional "Samples exist" indicator)
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setMenuOpen(!menuOpen)}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors min-w-[90px]
          bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400
          border border-transparent
          hover:bg-slate-200 dark:hover:bg-slate-600
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Package className="w-3 h-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="truncate">Bulk</span>
        {hasSampleSupply && (
          <span className="flex items-center gap-0.5 text-3xs text-blue-600 dark:text-blue-400 ml-0.5" title="Samples available">
            <Info className="w-2.5 h-2.5" />
          </span>
        )}
        {availableSources.length > 0 && (
          <ChevronDown className="w-3 h-3 ml-auto flex-shrink-0 text-slate-400" />
        )}
      </button>

      {/* Progressive disclosure menu */}
      {menuOpen && !showSourceList && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30 min-w-[180px]">
          {/* Bulk option (default) */}
          <button
            type="button"
            onClick={handleUseBulk}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50"
          >
            <Package className="w-3 h-3 text-slate-400" />
            <div className="flex-1">
              <span className="text-slate-700 dark:text-slate-300">Bulk</span>
              <span className="text-slate-400 dark:text-slate-500 ml-1">(default)</span>
            </div>
            <Check className="w-3 h-3 text-slate-400" />
          </button>

          {/* Use specific supply option */}
          {availableSources.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => {
                  if (!selectedSize && onRequestSpecificSupply) {
                    // Size required for specific supply - trigger size picker
                    onRequestSpecificSupply();
                    setMenuOpen(false);
                  } else {
                    setShowSourceList(true);
                  }
                }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Use specific supply...</span>
                </div>
                {!selectedSize ? (
                  <div className="ml-5 mt-0.5 text-2xs text-amber-600 dark:text-amber-400">
                    Pick a size to view compatible supply
                  </div>
                ) : hasSampleSupply && (
                  <div className="ml-5 mt-0.5 text-2xs text-blue-600 dark:text-blue-400">
                    {viableSources.length} source{viableSources.length !== 1 ? "s" : ""} available
                  </div>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Source list (shown when "Use specific supply" is clicked) */}
      {menuOpen && showSourceList && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30 min-w-[200px] max-h-56 overflow-y-auto">
          {/* Back to menu */}
          <button
            type="button"
            onClick={() => setShowSourceList(false)}
            className="w-full px-3 py-1.5 text-left text-2xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700"
          >
            ← Back
          </button>

          <div className="px-3 py-1.5">
            <span className="text-3xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Available sources {selectedSize && `for ${selectedSize}`}
            </span>
          </div>

          {/* Viable sources */}
          {viableSources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => handleSelectSource(source.id)}
              className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {source.label}
                </span>
                <SourceStatusBadge status={source.status} />
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                {source.sizeRun?.join(", ") || "No sizes"}
                {source.eta && ` · ETA ${source.eta}`}
                {source.arrivedAt && ` · ${source.arrivedAt}`}
              </div>
            </button>
          ))}

          {/* Non-viable sources (shown dimmed if size selected) */}
          {selectedSize && viableSources.length < availableSources.length && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <div className="px-3 py-1">
                <span className="text-3xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Missing {selectedSize}
                </span>
              </div>
              {availableSources
                .filter((s) => !viableSources.includes(s))
                .map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => handleSelectSource(source.id)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                        {source.label}
                      </span>
                      <SourceStatusBadge status={source.status} />
                    </div>
                    <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {source.sizeRun?.join(", ") || "No sizes"}
                    </div>
                  </button>
                ))}
            </>
          )}

          {viableSources.length === 0 && availableSources.length > 0 && (
            <div className="px-3 py-2 text-center">
              <p className="text-2xs text-slate-400 dark:text-slate-500">
                No sources match size {selectedSize}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AllocationStatusBadge - Shows allocation status for a product in a shot
 *
 * States:
 * - "Bulk" (neutral) - Default assumption, no specific supply allocated
 * - "Allocated" (green) - User explicitly selected a specific supply source
 * - "Size N/A" (red) - Selected source doesn't have the required size
 */
export function AllocationStatusBadge({ allocation }) {
  // Default: Bulk assumed (calm, neutral state)
  if (!allocation || allocation.status === "unassigned" || !allocation.sourceSupplyId) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
        <Package className="w-2.5 h-2.5" />
        Bulk
      </span>
    );
  }

  // Size unavailable warning
  if (allocation.status === "size-unavailable") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <Info className="w-2.5 h-2.5" />
        Size N/A
      </span>
    );
  }

  // Explicitly allocated to a specific supply source
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <Check className="w-2.5 h-2.5" />
      Allocated
    </span>
  );
}
