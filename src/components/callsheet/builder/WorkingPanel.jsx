import React, { useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  LayoutTemplate,
  Bell,
  StickyNote,
  ScrollText,
  Users,
  Star,
  Wrench,
  FileText,
  MessageSquare,
  Quote,
} from "lucide-react";
import { Button } from "../../ui/button";
import LayoutPanel from "./LayoutPanel";
import EditorPanel from "./EditorPanel";

function sectionLabel(type) {
  const labels = {
    header: "Header",
    "day-details": "Day Details",
    reminders: "Reminders",
    schedule: "Today's Schedule",
    clients: "Clients",
    talent: "Talent",
    extras: "Extras",
    "advanced-schedule": "Advanced Schedule",
    "page-break": "Page Break",
    crew: "Crew",
    "notes-contacts": "Notes / Contacts",
    "custom-banner": "Custom Banner",
    quote: "Quote of the Day",
  };
  return labels[type] || type;
}

function sectionIcon(type) {
  const icons = {
    header: LayoutTemplate,
    "day-details": Calendar,
    reminders: Bell,
    schedule: ClipboardList,
    clients: Users,
    talent: Star,
    crew: Users,
    "notes-contacts": FileText,
    "custom-banner": MessageSquare,
    extras: StickyNote,
    "advanced-schedule": Wrench,
    "page-break": ScrollText,
    quote: Quote,
  };
  return icons[type] || ClipboardList;
}

/** Toggle switch component for header (styled for light background) */
function HeaderToggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium transition-colors",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
      title={label}
      disabled={disabled}
    >
      <span
        className={[
          "h-4 w-7 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-3" : "translate-x-0",
          ].join(" ")}
        />
      </span>
      <span className="text-slate-600 dark:text-slate-300">{checked ? "Visible" : "Hidden"}</span>
    </button>
  );
}

/** Width constants for panel modes */
const OUTLINE_WIDTH = 280;
const EDITOR_WIDTH = 550;

export default function WorkingPanel({
  panelView,
  setPanelView,
  sections,
  orderedSections,
  activeSectionId,
  activeSection,
  canWrite,
  onSelectSection,
  onReorderSections,
  onToggleSection,
  onAddSection,
  onDeleteSection,
  editorProps,
  onDone,
  onEditFields,
  readOnly = false,
  onWidthChange,
}) {
  const mode = panelView?.mode === "section" ? "section" : "outline";
  const panelWidth = mode === "section" ? EDITOR_WIDTH : OUTLINE_WIDTH;

  // Notify parent of width changes
  React.useEffect(() => {
    onWidthChange?.(panelWidth);
  }, [panelWidth, onWidthChange]);

  const handleSelectSection = useCallback(
    (sectionId) => {
      onSelectSection?.(sectionId);
      const section = orderedSections.find((s) => s.id === sectionId) || null;
      setPanelView?.({ mode: "section", section: section?.type || "schedule" });
    },
    [onSelectSection, orderedSections, setPanelView]
  );

  const activeType = activeSection?.type || "schedule";
  const title = sectionLabel(activeType);
  const Icon = useMemo(() => sectionIcon(activeType), [activeType]);
  const enabled = activeSection ? activeSection.isVisible !== false : true;

  const showEditFields = activeType === "schedule" && typeof onEditFields === "function";

  return (
    <div
      className="flex h-full flex-col overflow-hidden transition-[width] duration-250 ease-in-out flex-shrink-0 relative z-10"
      style={{ width: panelWidth }}
    >
      {mode === "outline" ? (
        <LayoutPanel
          title="Layout"
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={handleSelectSection}
          onReorderSections={onReorderSections}
          onToggleSection={onToggleSection}
          onAddSection={onAddSection}
          onDeleteSection={onDeleteSection}
        />
      ) : (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {/* Light header bar with subtle border */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2.5 rounded-t-lg dark:bg-slate-800 dark:border-slate-700">
            {/* Two-row layout for better space distribution */}
            <div className="flex items-center justify-between gap-2 mb-2">
              {/* Left: Back button + Icon + Title (gets full width) */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  onClick={onDone}
                  title="Back to outline"
                  aria-label="Back to outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-700">
                  <Icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100" title={title}>{title}</h2>
              </div>

              {/* Right: Toggle switch (compact) */}
              {activeSection ? (
                <div className="flex-shrink-0">
                  <HeaderToggle
                    checked={enabled}
                    onChange={(next) => onToggleSection?.(activeSection.id, next)}
                    label="Toggle section visibility"
                    disabled={!canWrite}
                  />
                </div>
              ) : null}
            </div>

            {/* Second row: Action buttons */}
            <div className="flex items-center justify-end gap-2">
              {showEditFields ? (
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:pointer-events-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  onClick={onEditFields}
                  disabled={readOnly}
                >
                  Fields
                </button>
              ) : null}
              <button
                type="button"
                className="h-7 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-dark transition-colors"
                onClick={onDone}
              >
                Done
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeSection ? (
              <div className="h-full overflow-auto p-3">
                <EditorPanel activeSection={activeSection} readOnly={readOnly} {...editorProps} />
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-600 dark:text-slate-400">Select a section from the outline.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export width constants for parent components
WorkingPanel.OUTLINE_WIDTH = OUTLINE_WIDTH;
WorkingPanel.EDITOR_WIDTH = EDITOR_WIDTH;

