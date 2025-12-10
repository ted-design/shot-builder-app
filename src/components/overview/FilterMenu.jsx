import { useMemo } from "react";
import { Filter, Check, Calendar, User, Circle, Archive } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { SHOT_STATUS_VALUES } from "../../lib/shotStatus";

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", color: "bg-slate-400" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { value: "complete", label: "Complete", color: "bg-emerald-500" },
  { value: "on_hold", label: "On Hold", color: "bg-amber-500" },
];

/**
 * FilterMenu - Dropdown menu for filtering shots
 *
 * Provides filtering by:
 * - Archived toggle (show/hide archived shots)
 * - Status (multi-select: todo, in_progress, complete, on_hold)
 * - Date range (with project shoot dates highlighted)
 * - Talent (multi-select)
 *
 * Uses Radix UI DropdownMenu for automatic menu coordination.
 */
export default function FilterMenu({
  filters = {},
  onFilterChange,
  talentOptions = [],
  projectShootDates = [],
  variant = "outline",
}) {
  // Compute active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.showArchived) count++;
    if (Array.isArray(filters.statusFilter) && filters.statusFilter.length > 0) count++;
    if (filters.dateRange?.start || filters.dateRange?.end) count++;
    if (Array.isArray(filters.talentIds) && filters.talentIds.length > 0) count++;
    return count;
  }, [filters]);

  const handleToggleArchived = () => {
    onFilterChange?.({ ...filters, showArchived: !filters.showArchived });
  };

  const handleToggleStatus = (status) => {
    const currentStatuses = Array.isArray(filters.statusFilter) ? filters.statusFilter : [];
    const nextStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    onFilterChange?.({ ...filters, statusFilter: nextStatuses });
  };

  const handleToggleTalent = (talentId) => {
    const currentTalent = Array.isArray(filters.talentIds) ? filters.talentIds : [];
    const nextTalent = currentTalent.includes(talentId)
      ? currentTalent.filter((id) => id !== talentId)
      : [...currentTalent, talentId];
    onFilterChange?.({ ...filters, talentIds: nextTalent });
  };

  const handleClearFilters = () => {
    onFilterChange?.({
      ...filters,
      showArchived: false,
      statusFilter: [],
      dateRange: null,
      talentIds: [],
    });
  };

  const hasFilters = activeFilterCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={hasFilters ? "secondary" : variant}
          size="icon"
          aria-label="Filter shots"
          className={hasFilters ? "text-primary" : ""}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 p-2"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header with Clear button */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filters
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearFilters();
              }}
              className="text-xs text-primary hover:underline"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Archived Toggle */}
        <div className="px-2 py-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleArchived();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
          >
            <Archive className="h-4 w-4 text-slate-500" />
            <span className="flex-1 text-left">Show Archived</span>
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center ${
                filters.showArchived
                  ? "bg-primary border-primary"
                  : "border-slate-300 dark:border-slate-600"
              }`}
            >
              {filters.showArchived && <Check className="h-3 w-3 text-white" />}
            </div>
          </button>
        </div>

        <DropdownMenuSeparator />

        {/* Status Filters */}
        <div className="px-2 py-2">
          <p className="text-xs font-medium text-slate-500 mb-2 px-2">Status</p>
          <div className="space-y-1">
            {STATUS_OPTIONS.map((option) => {
              const isSelected = Array.isArray(filters.statusFilter) && filters.statusFilter.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(option.value);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.label}</span>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Talent Filters - only show if there are options */}
        {talentOptions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <p className="text-xs font-medium text-slate-500 mb-2 px-2">Talent</p>
              <div className="max-h-32 overflow-auto space-y-1">
                {talentOptions.map((talent) => {
                  const isSelected = Array.isArray(filters.talentIds) && filters.talentIds.includes(talent.value);
                  return (
                    <button
                      key={talent.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTalent(talent.value);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="flex-1 text-left truncate">{talent.label}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Date Range Filters */}
        {projectShootDates.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <p className="text-xs font-medium text-slate-500 mb-2 px-2">
                Project Dates
                <span className="ml-1 text-slate-400">({projectShootDates.length})</span>
              </p>
              <div className="text-xs text-slate-500 px-2">
                {projectShootDates.slice(0, 3).map((date) => (
                  <span key={date} className="inline-flex items-center gap-1 mr-2">
                    <Calendar className="h-3 w-3" />
                    {new Date(date).toLocaleDateString()}
                  </span>
                ))}
                {projectShootDates.length > 3 && (
                  <span className="text-slate-400">+{projectShootDates.length - 3} more</span>
                )}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
