/**
 * ShotContextDock - Left-side context dock for shot editor workspace
 *
 * DESIGN CONTRACT (per design-spec.md)
 * ====================================
 * This dock is READ-ONLY. It answers: "What is true about this shot right now?"
 *
 * Rules:
 * - No dropdowns
 * - No pickers
 * - No inline editing
 * - No hover-revealed controls
 *
 * Clicking a row may focus the corresponding canvas section (future).
 * If editing is needed, it happens in the Primary Canvas, not here.
 *
 * Design patterns (matching ProductDetailPageV3 / WorkspaceRail):
 * - LEFT side positioning (border-r)
 * - Collapsible icon rail (w-14 collapsed, w-48 expanded)
 * - Context and orientation focus (not navigation-centric)
 */

import { useState, useCallback, useMemo } from "react";
import {
  CircleDot,
  Package,
  Tags,
  MessageSquare,
  Users,
  MapPin,
  ImageIcon,
} from "lucide-react";
import { StatusBadge } from "../../ui/StatusBadge";

// Context dock sections - orientation + context, not navigation
const DOCK_SECTIONS = [
  {
    id: "status",
    label: "Status",
    icon: CircleDot,
    description: "Shot status and identity",
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    description: "Assigned products",
  },
  {
    id: "talent",
    label: "Talent",
    icon: Users,
    description: "Assigned talent",
  },
  {
    id: "location",
    label: "Location",
    icon: MapPin,
    description: "Shooting location",
  },
  {
    id: "tags",
    label: "Tags",
    icon: Tags,
    description: "Shot tags",
  },
  {
    id: "references",
    label: "References",
    icon: ImageIcon,
    description: "Reference images",
  },
  {
    id: "activity",
    label: "Activity",
    icon: MessageSquare,
    description: "Comments and activity",
  },
];

// Status configuration for display
const STATUS_CONFIGS = {
  todo: { label: "To Do", variant: "pending" },
  in_progress: { label: "In Progress", variant: "info" },
  complete: { label: "Complete", variant: "complete" },
  on_hold: { label: "On Hold", variant: "on-hold" },
};

function DockItem({ section, isExpanded, count, children }) {
  const Icon = section.icon;

  return (
    <div className="relative">
      <div
        className={`
          flex items-center gap-3 rounded-lg transition-all
          ${isExpanded ? "h-auto min-h-[40px] px-3 py-2" : "h-10 px-0 justify-center"}
          text-slate-600 dark:text-slate-400
        `}
      >
        <Icon
          className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500"
          title={!isExpanded ? section.label : undefined}
        />
        {isExpanded && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {section.label}
              </span>
              {count !== undefined && count > 0 && (
                <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-500 dark:bg-slate-600 dark:text-slate-300">
                  {count}
                </span>
              )}
            </div>
            {children && <div className="mt-1">{children}</div>}
          </div>
        )}
        {/* Badge dot when collapsed (shows count exists) */}
        {!isExpanded && count !== undefined && count > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
        )}
      </div>
    </div>
  );
}

export default function ShotContextDock({
  shot,
  counts = {},
  locationOptions = [],
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMouseEnter = useCallback(() => setIsExpanded(true), []);
  const handleMouseLeave = useCallback(() => setIsExpanded(false), []);
  const handleFocus = useCallback(() => setIsExpanded(true), []);
  const handleBlur = useCallback((e) => {
    // Only collapse if focus leaves the entire dock
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsExpanded(false);
    }
  }, []);

  // Stable ID-based section lookup - avoids fragile array index coupling
  const sectionById = useMemo(
    () => Object.fromEntries(DOCK_SECTIONS.map((s) => [s.id, s])),
    []
  );

  // Safe talent count - doesn't rely on counts.talent being passed
  const talentCount = Array.isArray(shot?.talent) ? shot.talent.length : 0;

  const statusConfig = STATUS_CONFIGS[shot?.status] || STATUS_CONFIGS.todo;

  // Derive selected location label for display
  const selectedLocationLabel = useMemo(() => {
    if (!shot?.locationId) return null;
    const match = locationOptions.find((loc) => loc.id === shot.locationId);
    return match?.name || null;
  }, [shot?.locationId, locationOptions]);

  const tagSummary = useMemo(() => {
    const tags = Array.isArray(shot?.tags) ? shot.tags : [];
    const labels = tags
      .map((tag) => (typeof tag === "string" ? tag : tag?.label || tag?.name || ""))
      .filter((label) => typeof label === "string" && label.trim());
    if (labels.length === 0) return null;
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [shot?.tags]);

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`
        flex-shrink-0 border-r border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-800/80
        transition-all duration-200 ease-out
        ${isExpanded ? "w-52" : "w-14"}
      `}
      aria-label="Shot context"
    >
      <div className={`sticky top-20 p-2 space-y-1 ${isExpanded ? "px-3" : "px-2"}`}>
        {/* Status section */}
        <DockItem
          section={sectionById.status}
          isExpanded={isExpanded}
        >
          <StatusBadge variant={statusConfig.variant} className="text-[10px]">
            {statusConfig.label}
          </StatusBadge>
        </DockItem>

        {/* Products section */}
        <DockItem
          section={sectionById.products}
          isExpanded={isExpanded}
          count={counts.products}
        >
          {counts.products > 0 ? (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {counts.products} assigned
            </span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              None assigned
            </span>
          )}
        </DockItem>

        {/* Talent section - read-only summary */}
        <DockItem
          section={sectionById.talent}
          isExpanded={isExpanded}
          count={talentCount}
        >
          {talentCount > 0 ? (
            <div className="space-y-0.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {talentCount} assigned
              </span>
              {shot?.talent?.length > 0 && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {shot.talent.map((t) => t.name).join(", ")}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              None assigned
            </span>
          )}
        </DockItem>

        {/* Location section - read-only summary */}
        <DockItem
          section={sectionById.location}
          isExpanded={isExpanded}
        >
          {selectedLocationLabel ? (
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">
              {selectedLocationLabel}
            </span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              None selected
            </span>
          )}
        </DockItem>

        {/* Tags section - read-only summary */}
        <DockItem
          section={sectionById.tags}
          isExpanded={isExpanded}
          count={counts.tags}
        >
          {counts.tags > 0 ? (
            <div className="space-y-0.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {counts.tags} tags
              </span>
              {tagSummary ? (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {tagSummary}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              No tags
            </span>
          )}
        </DockItem>

        {/* References section - read-only indicator (F.2) */}
        <DockItem
          section={sectionById.references}
          isExpanded={isExpanded}
          count={counts.references}
        >
          {counts.references > 0 ? (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {counts.references} {counts.references === 1 ? "image" : "images"}
            </span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              None
            </span>
          )}
        </DockItem>

        {/* Divider */}
        <div className="!my-3 h-px bg-slate-100 dark:bg-slate-700" />

        {/* Activity section - scrollable placeholder */}
        <DockItem
          section={sectionById.activity}
          isExpanded={isExpanded}
        >
          <div className="text-xs text-slate-400 dark:text-slate-500 italic">
            Activity coming soon
          </div>
        </DockItem>
      </div>
    </aside>
  );
}
