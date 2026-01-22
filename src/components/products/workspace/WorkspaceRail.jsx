/**
 * WorkspaceRail - Collapsible left navigation rail for product workspace
 *
 * Design patterns:
 * - Collapses to icon-only by default (less admin sidebar feel)
 * - Expands on hover/focus for full labels + counts
 * - Active section is always visually clear
 * - Keyboard accessible with tooltips when collapsed
 */

import { useState, useCallback } from "react";
import {
  LayoutGrid,
  Palette,
  Box,
  FileText,
  Activity,
} from "lucide-react";
import { WORKSPACE_SECTIONS } from "./WorkspaceContext";

// Icon lookup for section icons
const SECTION_ICONS = {
  LayoutGrid,
  Palette,
  Box,
  FileText,
  Activity,
};

function NavRailItem({ section, isActive, onClick, count, isExpanded }) {
  const Icon = SECTION_ICONS[section.iconName] || LayoutGrid;

  return (
    <button
      type="button"
      onClick={onClick}
      title={!isExpanded ? `${section.label}${count ? ` (${count})` : ""}` : undefined}
      className={`
        w-full flex items-center gap-3 rounded-lg text-left transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1
        ${isExpanded ? "h-10 px-3" : "h-10 px-0 justify-center"}
        ${isActive
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50"
        }
      `}
      aria-current={isActive ? "page" : undefined}
      aria-label={section.label}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${
          isActive ? "text-white dark:text-slate-900" : "text-slate-400 dark:text-slate-500"
        }`}
      />
      {isExpanded && (
        <>
          <span className="text-sm font-medium flex-1 truncate">{section.label}</span>
          {count !== undefined && count > 0 && (
            <span
              className={`
                text-[10px] font-semibold tabular-nums min-w-[20px] text-center
                px-1.5 py-0.5 rounded-full
                ${isActive
                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                  : "bg-slate-200/80 text-slate-500 dark:bg-slate-600 dark:text-slate-300"
                }
              `}
            >
              {count}
            </span>
          )}
        </>
      )}
      {/* Badge dot when collapsed (shows count exists) */}
      {!isExpanded && count !== undefined && count > 0 && (
        <span
          className={`
            absolute top-1 right-1 w-2 h-2 rounded-full
            ${isActive
              ? "bg-white/60 dark:bg-slate-900/40"
              : "bg-slate-400 dark:bg-slate-500"
            }
          `}
        />
      )}
    </button>
  );
}

export default function WorkspaceRail({ activeSection, onSectionChange, counts }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMouseEnter = useCallback(() => setIsExpanded(true), []);
  const handleMouseLeave = useCallback(() => setIsExpanded(false), []);
  const handleFocus = useCallback(() => setIsExpanded(true), []);
  const handleBlur = useCallback((e) => {
    // Only collapse if focus leaves the entire nav
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsExpanded(false);
    }
  }, []);

  return (
    <nav
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`
        flex-shrink-0 border-r border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-800/80
        transition-all duration-200 ease-out
        ${isExpanded ? "w-48" : "w-14"}
      `}
      aria-label="Workspace sections"
    >
      <div className={`sticky top-0 p-2 space-y-1 ${isExpanded ? "px-3" : "px-2"}`}>
        {WORKSPACE_SECTIONS.map((section) => (
          <div key={section.id} className="relative">
            <NavRailItem
              section={section}
              isActive={activeSection === section.id}
              onClick={() => onSectionChange(section.id)}
              count={section.countKey ? counts[section.countKey] : undefined}
              isExpanded={isExpanded}
            />
          </div>
        ))}
      </div>
    </nav>
  );
}

export { NavRailItem };
