/**
 * SamplesWorkspace - Sample tracking section for product workspace
 *
 * Contains all sample-related components:
 * - SampleStatusBadge, SampleSummaryChip
 * - StatusFilterChip, TypeFilterSegment, SortDropdown
 * - SampleDetailDrawer
 * - Main SamplesSection
 */

import { useCallback, useMemo, useState } from "react";
import {
  Plus,
  Box,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Eye,
  MessageSquare,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../ui/sheet";
import { useWorkspace } from "./WorkspaceContext";
import SectionHeader from "./SectionHeader";
import ScopeContextBar from "./ScopeContextBar";
import { WorkspaceTableEmpty } from "./WorkspaceEmptyState";

// ============================================================================
// SAMPLE CONSTANTS
// ============================================================================

export const SAMPLE_STATUSES = {
  requested: { label: "Requested", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_transit: { label: "In transit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  arrived: { label: "Arrived", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  returned: { label: "Returned", color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  issue: { label: "Issue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const SAMPLE_TABLE_COLUMNS = [
  { key: "label", header: "Sample ID", width: "w-28" },
  { key: "type", header: "Type", width: "w-28" },
  { key: "sizeRun", header: "Size run", width: "w-20" },
  { key: "status", header: "Status", width: "w-24" },
  { key: "carrier", header: "Carrier / Tracking", width: "w-36" },
  { key: "eta", header: "ETA / Arrived", width: "w-24" },
  { key: "notes", header: "Notes", width: "flex-1 min-w-[80px]" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Shoot sample", label: "Shoot" },
  { value: "Pre-production", label: "PP" },
  { value: "Bulk ref", label: "Bulk" },
];

// ============================================================================
// UI COMPONENTS
// ============================================================================

export function SampleStatusBadge({ status }) {
  const config = SAMPLE_STATUSES[status] || SAMPLE_STATUSES.requested;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export function SampleSummaryChip({ icon: Icon, label, count, variant = "default" }) {
  const variantClasses = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    transit: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    arrived: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    issue: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${variantClasses[variant]}`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function StatusFilterChip({ label, isActive, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all
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

function TypeFilterSegment({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50">
      {TYPE_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            px-2 py-0.5 rounded text-[10px] font-medium transition-all
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

function SortDropdown({ sortBy, sortDir, onSortChange }) {
  const sortOptions = [
    { value: "eta", label: "ETA" },
    { value: "status", label: "Status" },
    { value: "label", label: "Sample ID" },
  ];

  return (
    <div className="flex items-center gap-1">
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value, sortDir)}
        className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-0 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
        className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
      >
        {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ============================================================================
// SAMPLE DETAIL DRAWER
// ============================================================================

function SampleDetailDrawer({ sample, open, onOpenChange, scope, colorwayName, productName, onJumpToColorway }) {
  if (!sample) return null;

  const statusConfig = SAMPLE_STATUSES[sample.status] || SAMPLE_STATUSES.requested;
  const showJumpToColorway = scope === "product" && sample.scopeSkuId && onJumpToColorway;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mb-2">
            <span className="font-medium">{productName || "Product"}</span>
            <span>•</span>
            <span>{scope === "colorway" ? colorwayName : "All colorways"}</span>
          </div>

          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{sample.label}</SheetTitle>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <SheetDescription className="text-xs">{sample.type}</SheetDescription>

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
          {/* Size Run */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Size Run
            </h4>
            {sample.sizeRun?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {sample.sizeRun.map((size) => (
                  <span key={size} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {size}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No sizes specified</p>
            )}
          </section>

          {/* Shipping */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Shipping
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Truck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Carrier</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{sample.carrier || "Not specified"}</p>
                </div>
              </div>

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

              {sample.eta && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <Truck className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Expected Arrival</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{sample.eta}</p>
                  </div>
                </div>
              )}

              {sample.arrivedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Arrived</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{sample.arrivedAt}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Notes
            </h4>
            {sample.notes ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{sample.notes}</p>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No notes added</p>
            )}
          </section>

          {/* Tasks placeholder */}
          <section className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Tasks & Activity
            </h4>
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center">
              <MessageSquare className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500">Activity feed coming soon</p>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MAIN SAMPLES SECTION
// ============================================================================

export default function SamplesSection({ family, skus, samples }) {
  const { selectedColorwayId, setSelectedColorwayId, setActiveSection } = useWorkspace();

  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("eta");
  const [sortDir, setSortDir] = useState("asc");

  // Drawer state
  const [selectedSample, setSelectedSample] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Determine scope: colorway if one is selected, else product
  const scope = selectedColorwayId ? "colorway" : "product";

  // Get selected colorway info
  const selectedColorway = useMemo(() => {
    if (!selectedColorwayId) return null;
    return skus.find((sku) => sku.id === selectedColorwayId) || null;
  }, [selectedColorwayId, skus]);

  // Filter samples by scope
  const scopedSamples = useMemo(() => {
    if (scope === "product") return samples;
    return samples.filter((s) => s.scopeSkuId === selectedColorwayId);
  }, [samples, scope, selectedColorwayId]);

  // Compute status counts
  const statusCounts = useMemo(() => ({
    all: scopedSamples.length,
    requested: scopedSamples.filter((s) => s.status === "requested").length,
    in_transit: scopedSamples.filter((s) => s.status === "in_transit").length,
    arrived: scopedSamples.filter((s) => s.status === "arrived").length,
    returned: scopedSamples.filter((s) => s.status === "returned").length,
    issue: scopedSamples.filter((s) => s.status === "issue").length,
  }), [scopedSamples]);

  // Filter and sort
  const filteredSortedSamples = useMemo(() => {
    let result = [...scopedSamples];

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }

    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "eta":
          aVal = a.eta || a.arrivedAt || "9999-12-31";
          bVal = b.eta || b.arrivedAt || "9999-12-31";
          break;
        case "status": {
          const statusOrder = { issue: 0, in_transit: 1, requested: 2, arrived: 3, returned: 4 };
          aVal = statusOrder[a.status] ?? 5;
          bVal = statusOrder[b.status] ?? 5;
          break;
        }
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
  }, [scopedSamples, statusFilter, typeFilter, sortBy, sortDir]);

  // Summary stats
  const summaryStats = useMemo(() => ({
    total: filteredSortedSamples.length,
    inTransit: filteredSortedSamples.filter((s) => s.status === "in_transit").length,
    arrived: filteredSortedSamples.filter((s) => s.status === "arrived").length,
    issues: filteredSortedSamples.filter((s) => s.status === "issue").length,
  }), [filteredSortedSamples]);

  const handleRowClick = useCallback((sample) => {
    setSelectedSample(sample);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback((open) => {
    setDrawerOpen(open);
    if (!open) setTimeout(() => setSelectedSample(null), 200);
  }, []);

  // Jump to colorway from drawer
  const handleJumpToColorway = useCallback((targetSkuId) => {
    setSelectedColorwayId(targetSkuId);
    setActiveSection("colorways");
  }, [setSelectedColorwayId, setActiveSection]);

  // Clear colorway selection
  const handleClearColorway = useCallback(() => {
    setSelectedColorwayId(null);
  }, [setSelectedColorwayId]);

  // Navigate to colorways to change selection
  const handleChangeColorway = useCallback(() => {
    setActiveSection("colorways");
  }, [setActiveSection]);

  const handleSortChange = useCallback((by, dir) => {
    setSortBy(by);
    setSortDir(dir);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <SectionHeader
        title="Samples"
        context={
          <ScopeContextBar
            colorway={selectedColorway}
            onClear={handleClearColorway}
            onChange={handleChangeColorway}
          />
        }
        actions={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Add sample
          </button>
        }
      />

      {/* Filters bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filters */}
          <div className="flex items-center gap-1">
            <StatusFilterChip label="All" isActive={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={statusCounts.all} />
            <StatusFilterChip label="Requested" isActive={statusFilter === "requested"} onClick={() => setStatusFilter("requested")} />
            <StatusFilterChip label="In transit" isActive={statusFilter === "in_transit"} onClick={() => setStatusFilter("in_transit")} />
            <StatusFilterChip label="Arrived" isActive={statusFilter === "arrived"} onClick={() => setStatusFilter("arrived")} />
            <StatusFilterChip label="Returned" isActive={statusFilter === "returned"} onClick={() => setStatusFilter("returned")} />
            <StatusFilterChip label="Issue" isActive={statusFilter === "issue"} onClick={() => setStatusFilter("issue")} />
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />

          {/* Type filter */}
          <TypeFilterSegment value={typeFilter} onChange={setTypeFilter} />

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />

          {/* Sort */}
          <SortDropdown sortBy={sortBy} sortDir={sortDir} onSortChange={handleSortChange} />
        </div>

        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          Showing {filteredSortedSamples.length} of {scopedSamples.length}
        </span>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-50 dark:border-slate-700/50">
        <SampleSummaryChip icon={Box} label="Total" count={summaryStats.total} />
        <SampleSummaryChip icon={Truck} label="In transit" count={summaryStats.inTransit} variant="transit" />
        <SampleSummaryChip icon={CheckCircle2} label="Arrived" count={summaryStats.arrived} variant="arrived" />
        <SampleSummaryChip icon={AlertTriangle} label="Issues" count={summaryStats.issues} variant="issue" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <tr>
              {SAMPLE_TABLE_COLUMNS.map((col) => (
                <th key={col.key} className={`px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${col.width}`}>
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
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{sample.label || "-"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{sample.type || "-"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{Array.isArray(sample.sizeRun) ? sample.sizeRun.join(", ") : sample.sizeRun || "-"}</td>
                  <td className="px-3 py-2"><SampleStatusBadge status={sample.status || "requested"} /></td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-[10px] truncate max-w-[120px]">
                    {sample.carrier && sample.tracking ? `${sample.carrier} ${sample.tracking}` : sample.carrier || sample.tracking || "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{sample.eta || sample.arrivedAt || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{sample.notes || "-"}</td>
                </tr>
              ))
            ) : (
              <WorkspaceTableEmpty
                icon={Box}
                title={statusFilter !== "all" || typeFilter !== "all" ? "No samples match filters" : "No samples tracked yet"}
                subtitle={
                  statusFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your filters"
                    : scope === "colorway"
                      ? "Add a sample to start tracking"
                      : "Add samples to individual colorways"
                }
                colSpan={SAMPLE_TABLE_COLUMNS.length}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Sample detail drawer */}
      <SampleDetailDrawer
        sample={selectedSample}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        scope={scope}
        colorwayName={selectedColorway?.colorName}
        productName={family?.styleName}
        onJumpToColorway={handleJumpToColorway}
      />
    </div>
  );
}
