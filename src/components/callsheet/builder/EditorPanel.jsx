import React, { useEffect, useMemo, useState } from "react";
import DayDetailsEditorCard from "../DayDetailsEditorCard";
import CrewCallsCard from "../CrewCallsCard";
import TalentCallsCard from "../TalentCallsCard";
import ClientsCallsCard from "../ClientsCallsCard";
import NotesContactsEditorCard from "../NotesContactsEditorCard";
import RemindersEditorCard from "../RemindersEditorCard";
import CustomBannerEditorCard from "../CustomBannerEditorCard";
import ExtrasEditorCard from "../ExtrasEditorCard";
import AdvancedScheduleEditorCard from "../AdvancedScheduleEditorCard";
import QuoteEditorCard from "../QuoteEditorCard";
import HeaderEditorCard from "../HeaderEditorCard";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import HeaderEditorV2 from "../sections/HeaderEditorV2";
import DayDetailsEditorV2 from "../sections/DayDetailsEditorV2";
import TimelineView from "../timeline/TimelineView";
import { ChevronDown, List, Layers, Calendar } from "lucide-react";

export default function EditorPanel({
  activeSection,
  clientId,
  projectId,
  scheduleId,
  schedule,
  scheduleSettings,
  scheduledTalentIds,
  trackFocusId = "all",
  onTrackFocusChange,
  scheduleViewMode = "list",
  onScheduleViewModeChange,
  resolvedEntries = [],
  onToggleShowDurations,
  onToggleCascade,
  onOpenScheduleFields,
  onAddScene,
  onAddBanner,
  onAddMove,
  onLookupSceneAtTime,
  onCreateSceneAtTime,
  onAddCustomAtTime,
  dayDetails,
  callSheetConfig,
  onUpdateCallSheetConfig,
  layoutV2,
  onUpdateLayoutV2,
  scheduleEditor,
  generalCrewCallTime,
  onUpdateSectionConfig,
  onEditEntry,
  onEditShotEntry,
  readOnly = false,
}) {
  const activeType = activeSection?.type || "schedule";
  const defaultQuickTime = scheduleSettings?.dayStartTime || "06:00";
  const [quickTime, setQuickTime] = useState(defaultQuickTime);

  useEffect(() => {
    setQuickTime(defaultQuickTime);
  }, [defaultQuickTime, scheduleId]);

  const addOptions = useMemo(
    () => [
      { category: "other", label: "Banner" },
      { category: "travel", label: "Move" },
      { category: "setup", label: "Setup" },
      { category: "break", label: "Break" },
      { category: "lunch", label: "Lunch" },
      { category: "wrap", label: "Wrap" },
      { category: "meeting", label: "Meeting" },
    ],
    []
  );

  if (activeType === "header") {
    if (layoutV2 && onUpdateLayoutV2) {
      return (
        <div className="space-y-3">
          <HeaderEditorV2
            layout={layoutV2}
            schedule={schedule}
            dayDetails={dayDetails}
            onUpdateLayout={onUpdateLayoutV2}
            readOnly={readOnly}
          />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <HeaderEditorCard
          section={activeSection}
          schedule={schedule}
          dayDetails={dayDetails}
          callSheetConfig={callSheetConfig}
          onUpdateSectionConfig={onUpdateSectionConfig}
          onUpdateCallSheetConfig={onUpdateCallSheetConfig}
        />
      </div>
    );
  }

  if (activeType === "day-details") {
    return (
      <div className="space-y-3">
        <DayDetailsEditorV2 clientId={clientId} projectId={projectId} scheduleId={scheduleId} readOnly={readOnly} />
      </div>
    );
  }

  if (activeType === "reminders") {
    return (
      <div className="space-y-3">
        <RemindersEditorCard section={activeSection} onUpdateSectionConfig={onUpdateSectionConfig} />
      </div>
    );
  }

  if (activeType === "custom-banner") {
    return (
      <div className="space-y-3">
        <CustomBannerEditorCard section={activeSection} onUpdateSectionConfig={onUpdateSectionConfig} />
      </div>
    );
  }

  if (activeType === "extras") {
    return (
      <div className="space-y-3">
        <ExtrasEditorCard section={activeSection} onUpdateSectionConfig={onUpdateSectionConfig} readOnly={readOnly} />
      </div>
    );
  }

  if (activeType === "advanced-schedule") {
    return (
      <div className="space-y-3">
        <AdvancedScheduleEditorCard
          section={activeSection}
          onUpdateSectionConfig={onUpdateSectionConfig}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (activeType === "quote") {
    return (
      <div className="space-y-3">
        <QuoteEditorCard section={activeSection} onUpdateSectionConfig={onUpdateSectionConfig} readOnly={readOnly} />
      </div>
    );
  }

  if (activeType === "page-break") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          This is a page break marker. Drag it in the Outline to control where the call sheet splits in export.
        </div>
      </div>
    );
  }

  if (activeType === "notes-contacts") {
    return (
      <div className="space-y-3">
        <NotesContactsEditorCard
          clientId={clientId}
          projectId={projectId}
          scheduleId={scheduleId}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (activeType === "talent") {
    return (
      <div className="space-y-3">
        <TalentCallsCard
          clientId={clientId}
          projectId={projectId}
          scheduleId={scheduleId}
          scheduledTalentIds={scheduledTalentIds}
          section={activeSection}
          onUpdateSectionConfig={onUpdateSectionConfig}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (activeType === "clients") {
    return (
      <div className="space-y-3">
        <ClientsCallsCard
          clientId={clientId}
          projectId={projectId}
          scheduleId={scheduleId}
          section={activeSection}
          onUpdateSectionConfig={onUpdateSectionConfig}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (activeType === "crew") {
    return (
      <div className="space-y-3">
        <CrewCallsCard
          clientId={clientId}
          projectId={projectId}
          scheduleId={scheduleId}
          generalCrewCallTime={generalCrewCallTime || null}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (activeType === "schedule") {
    // Entry layout mode (parallel vs stacked) - only relevant for List view
    const entryLayoutMode =
      activeSection?.config?.viewMode === "stacked" ? "stacked" : "parallel";

    // Tracks from schedule for TimelineView
    const tracks = schedule?.tracks || [];

    // Render main content based on scheduleViewMode
    const renderMainContent = () => {
      if (scheduleViewMode === "timeline") {
        return (
          <TimelineView
            entries={resolvedEntries}
            tracks={tracks}
            settings={scheduleSettings}
            onEditEntry={onEditEntry}
            onEditShotEntry={onEditShotEntry}
          />
        );
      }

      if (scheduleViewMode === "byTrack") {
        return (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Layers className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              By Track View
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Coming soon: View entries grouped by track with separate lanes for each track.
            </p>
          </div>
        );
      }

      // Default: List view (scheduleViewMode === "list")
      return scheduleEditor || null;
    };

    return (
      <div className="flex h-full flex-col">
        {/* Settings row with checkboxes - light gray background for separation */}
        <div className="flex items-center gap-6 px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <input
              type="checkbox"
              checked={scheduleSettings?.showDurations !== false}
              onChange={onToggleShowDurations}
              disabled={readOnly || !onToggleShowDurations}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
            />
            <span>Show durations</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <input
              type="checkbox"
              checked={scheduleSettings?.cascadeChanges !== false}
              onChange={onToggleCascade}
              disabled={readOnly || !onToggleCascade}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
            />
            <span>Cascade changes</span>
          </label>

          {/* Track Focus Mode dropdown */}
          {Array.isArray(schedule?.tracks) && schedule.tracks.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-600 dark:text-slate-400">Track</span>
              <select
                value={trackFocusId}
                onChange={(e) => onTrackFocusChange?.(e.target.value)}
                className="h-8 w-[120px] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All</option>
                {schedule.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name || track.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View mode segmented control */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 border-b border-slate-200 dark:bg-slate-800/30 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">View</span>
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              className={[
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scheduleViewMode === "list"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              ].join(" ")}
              onClick={() => onScheduleViewModeChange?.("list")}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              className={[
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scheduleViewMode === "byTrack"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              ].join(" ")}
              onClick={() => onScheduleViewModeChange?.("byTrack")}
            >
              <Layers className="h-3.5 w-3.5" />
              By Track
            </button>
            <button
              type="button"
              className={[
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scheduleViewMode === "timeline"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              ].join(" ")}
              onClick={() => onScheduleViewModeChange?.("timeline")}
            >
              <Calendar className="h-3.5 w-3.5" />
              Timeline
            </button>
          </div>
        </div>

        {/* Entry layout mode tabs (Parallel/Stacked) - only show for List view */}
        {scheduleViewMode === "list" && (
          <div className="flex bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 px-4">
            <button
              type="button"
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                entryLayoutMode === "parallel"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
              onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "parallel" })}
              disabled={readOnly}
            >
              Parallel
            </button>
            <button
              type="button"
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                entryLayoutMode === "stacked"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
              onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "stacked" })}
              disabled={readOnly}
            >
              Stacked
            </button>
          </div>
        )}

        {/* Main content area - white background for entries */}
        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">{renderMainContent()}</div>

        {/* Sticky footer with action buttons - only show for List view */}
        {scheduleViewMode === "list" && (
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 px-4 py-3 bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <Button type="button" size="sm" onClick={onAddScene} disabled={readOnly || !onAddScene}>
              + Add Shots
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddBanner}
              disabled={readOnly || !onAddBanner}
            >
              + Add Banner
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddMove}
              disabled={readOnly || !onAddMove}
            >
              + Add Move
            </Button>

            <div className="flex-1" />

            {/* Quick add section */}
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                disabled={readOnly}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1" disabled={readOnly || !onAddCustomAtTime}>
                    Quick Add
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onLookupSceneAtTime?.(quickTime)} disabled={!onLookupSceneAtTime}>
                    Lookup Scene
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateSceneAtTime?.(quickTime)} disabled={!onCreateSceneAtTime}>
                    Create Scene
                  </DropdownMenuItem>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  {addOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.category}
                      onClick={() => onAddCustomAtTime?.(opt.category, quickTime)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
      Editor for this section isn’t implemented yet.
    </div>
  );
}
