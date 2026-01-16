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
import HeaderEditorV2 from "../sections/HeaderEditorV2";
import DayDetailsEditorV2 from "../sections/DayDetailsEditorV2";
import DayStreamView from "../daystream/DayStreamView";

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
  resolvedEntries = [],
  onToggleShowDurations,
  onToggleCascade,
  onAddScene,
  onAddBanner,
  dayDetails,
  callSheetConfig,
  onUpdateCallSheetConfig,
  layoutV2,
  onUpdateLayoutV2,
  generalCrewCallTime,
  onUpdateSectionConfig,
  onEditEntry,
  onReorderEntries,
  onMoveEntryToTrack,
  onUpdateEntry,
  tracks = [],
  readOnly = false,
}) {
  const activeType = activeSection?.type || "schedule";

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
    // Tracks from schedule for DayStreamView
    const scheduleTracks = schedule?.tracks || [];

    return (
      <div className="flex h-full flex-col">
        {/* Settings row with checkboxes */}
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

        {/* Main content area - Day Stream View */}
        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">
          <DayStreamView
            scheduleId={scheduleId}
            resolvedEntries={resolvedEntries}
            tracks={scheduleTracks}
            onEditEntry={onEditEntry}
            onReorderEntry={onReorderEntries}
            onMoveEntryToTrack={onMoveEntryToTrack}
            onUpdateEntry={onUpdateEntry}
            onAddEntry={(trackIdOrType) => {
              if (trackIdOrType === "custom") {
                onAddBanner?.();
              } else {
                // trackId passed, open shot modal with pre-selected track
                onAddScene?.(trackIdOrType);
              }
            }}
            readOnly={readOnly}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
      Editor for this section isn't implemented yet.
    </div>
  );
}
