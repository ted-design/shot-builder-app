import React, { useState } from "react";
import { ChevronDown, Check, Settings } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "../../ui/dropdown-menu";

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
          <label
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Shows/hides duration labels in the call sheet preview"
          >
            <input
              type="checkbox"
              checked={scheduleSettings?.showDurations !== false}
              onChange={onToggleShowDurations}
              disabled={readOnly || !onToggleShowDurations}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
            />
            <span>Show durations</span>
          </label>
          <label
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="When on, moving or resizing an item shifts later items to stay continuous"
          >
            <input
              type="checkbox"
              checked={scheduleSettings?.cascadeChanges !== false}
              onChange={onToggleCascade}
              disabled={readOnly || !onToggleCascade}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 accent-blue-600"
            />
            <span>Cascade changes</span>
          </label>

          {/* Track Focus Mode dropdown with integrated Manage tracks action */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-slate-600 dark:text-slate-400">Track</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 min-w-[120px] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <span className="truncate">
                    {trackFocusId === "all"
                      ? "All"
                      : schedule?.tracks?.find((t) => t.id === trackFocusId)?.name || "All"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuRadioGroup value={trackFocusId} onValueChange={onTrackFocusChange}>
                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                  {Array.isArray(schedule?.tracks) &&
                    schedule.tracks.map((track) => (
                      <DropdownMenuRadioItem key={track.id} value={track.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: track.color || "#64748B" }}
                          />
                          <span className="truncate">{track.name || track.id}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {onEditTracks && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onEditTracks} className="gap-2">
                      <Settings className="h-4 w-4" />
                      Manage tracks…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
