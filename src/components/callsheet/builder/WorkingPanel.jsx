import React, { useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  LayoutTemplate,
  MessageSquare,
  StickyNote,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "../../ui/button";
import LayoutPanel from "./LayoutPanel";
import EditorPanel from "./EditorPanel";

function sectionLabel(type) {
  const labels = {
    header: "Header",
    "day-details": "Day Details",
    reminders: "Reminders",
    schedule: "Today’s Schedule",
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
    reminders: MessageSquare,
    schedule: ClipboardList,
    clients: Users,
    talent: Users,
    crew: Users,
    "notes-contacts": StickyNote,
    "custom-banner": ScrollText,
    extras: StickyNote,
    "advanced-schedule": Wrench,
    "page-break": ScrollText,
    quote: MessageSquare,
  };
  return icons[type] || ClipboardList;
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        disabled ? "opacity-60 pointer-events-none" : "",
      ].join(" ")}
      title={label}
      disabled={disabled}
    >
      <span
        className={[
          "h-4 w-7 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700",
        ].join(" ")}
      >
        <span
          className={[
            "block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-3" : "translate-x-0",
          ].join(" ")}
        />
      </span>
      <span className="hidden sm:inline">{checked ? "On" : "Off"}</span>
    </button>
  );
}

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
}) {
  const mode = panelView?.mode === "section" ? "section" : "outline";

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

  if (mode === "outline") {
    return (
      <LayoutPanel
        title="Outline"
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={handleSelectSection}
        onReorderSections={onReorderSections}
        onToggleSection={onToggleSection}
        onAddSection={onAddSection}
        onDeleteSection={onDeleteSection}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={onDone}
              title="Back to outline"
              aria-label="Back to outline"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</div>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {enabled ? "Editing" : "Disabled"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSection ? (
              <Switch
                checked={enabled}
                onChange={(next) => onToggleSection?.(activeSection.id, next)}
                label="Toggle section"
                disabled={!canWrite}
              />
            ) : null}
            {showEditFields ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditFields}
                disabled={readOnly}
              >
                Edit Fields
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={onDone}>
              Done
            </Button>
          </div>
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
  );
}

