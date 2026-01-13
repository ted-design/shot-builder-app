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
import { ChevronDown } from "lucide-react";

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
    const viewMode =
      activeSection?.config?.viewMode === "stacked" ? "stacked" : "parallel";

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

        {/* View mode tabs (underline style) - white background */}
        <div className="flex bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700 px-4">
          <button
            type="button"
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              viewMode === "parallel"
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
              viewMode === "stacked"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
            onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "stacked" })}
            disabled={readOnly}
          >
            Stacked
          </button>
        </div>

        {/* Main content area - white background for entries */}
        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">{scheduleEditor || null}</div>

        {/* Sticky footer with action buttons */}
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
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
      Editor for this section isn’t implemented yet.
    </div>
  );
}
