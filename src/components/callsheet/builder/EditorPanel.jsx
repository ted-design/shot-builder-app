import React from "react";
import { Clock } from "lucide-react";
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
  onTimeIncrementChange,
  onAddScene,
  onAddBanner,
  onAddQuickBanner,
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
  onDeleteEntry,
  tracks = [],
  readOnly = false,
  onEditTracks,
  onOpenDayStartModal,
  dayStartTimeFormatted,
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

    // Schedule block field visibility settings
    const blockFields = callSheetConfig?.scheduleBlockFields || {
      showShotNumber: true,
      showShotName: true,
      showDescription: true,
      showTalent: true,
      showLocation: true,
      showTags: true,
      showNotes: true,
    };

    const handleBlockFieldToggle = (fieldKey) => {
      if (readOnly || !onUpdateCallSheetConfig) return;
      onUpdateCallSheetConfig({
        scheduleBlockFields: {
          ...blockFields,
          [fieldKey]: !blockFields[fieldKey],
        },
      });
    };

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

          {/* Day Start Time button */}
          {onOpenDayStartModal && (
            <button
              type="button"
              onClick={onOpenDayStartModal}
              disabled={readOnly}
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
              title="Set day start time"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Day start: {dayStartTimeFormatted || "6:00 AM"}</span>
            </button>
          )}

          {/* Time Increment selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Increment</span>
            <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
              {[5, 15, 30].map((minutes) => {
                const isActive = (scheduleSettings?.timeIncrement || 15) === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => onTimeIncrementChange?.(minutes)}
                    disabled={readOnly || !onTimeIncrementChange}
                    className={`px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    } ${minutes !== 5 ? "border-l border-slate-300 dark:border-slate-600" : ""}`}
                  >
                    {minutes}m
                  </button>
                );
              })}
            </div>
          </div>

          {/* Track Focus Mode dropdown + Edit Tracks button */}
          <div className="flex items-center gap-2 ml-auto">
            {Array.isArray(schedule?.tracks) && schedule.tracks.length > 0 && (
              <>
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
              </>
            )}
            {onEditTracks && (
              <button
                type="button"
                onClick={onEditTracks}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit Tracks
              </button>
            )}
          </div>
        </div>

        {/* Preview Fields - toggles for which fields appear in schedule blocks */}
        <div className="px-4 py-2.5 bg-slate-50/50 border-b border-slate-200 dark:bg-slate-800/30 dark:border-slate-700">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Preview Fields</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showShotNumber !== false}
                onChange={() => handleBlockFieldToggle("showShotNumber")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Shot #</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showShotName !== false}
                onChange={() => handleBlockFieldToggle("showShotName")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Shot Name</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showDescription !== false}
                onChange={() => handleBlockFieldToggle("showDescription")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Description</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showTalent !== false}
                onChange={() => handleBlockFieldToggle("showTalent")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Talent</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showLocation !== false}
                onChange={() => handleBlockFieldToggle("showLocation")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Location</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showTags !== false}
                onChange={() => handleBlockFieldToggle("showTags")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Tags</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={blockFields.showNotes !== false}
                onChange={() => handleBlockFieldToggle("showNotes")}
                disabled={readOnly}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
              />
              <span>Notes</span>
            </label>
          </div>
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
            onDeleteEntry={onDeleteEntry}
            onAddEntry={(trackIdOrType) => {
              if (trackIdOrType === "custom") {
                onAddBanner?.();
              } else if (trackIdOrType === "banner") {
                // Quick banner creation - no modal
                onAddQuickBanner?.();
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
