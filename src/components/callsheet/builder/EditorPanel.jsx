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
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "parallel" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "parallel" })}
                disabled={readOnly}
              >
                Parallel
              </Button>
              <Button
                type="button"
                variant={viewMode === "stacked" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "stacked" })}
                disabled={readOnly}
              >
                Stacked
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleShowDurations}
                disabled={readOnly || !onToggleShowDurations}
              >
                {scheduleSettings?.showDurations === false ? "Show durations: Off" : "Show durations: On"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleCascade}
                disabled={readOnly || !onToggleCascade}
              >
                {scheduleSettings?.cascadeChanges === false ? "Cascade changes: Off" : "Cascade changes: On"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={onAddScene} disabled={readOnly || !onAddScene}>
                + Add Scene
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
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick add</div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-slate-500">Time</span>
              <input
                type="time"
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                disabled={readOnly}
              />
            </label>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={readOnly || !onAddCustomAtTime}>
                  Add
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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

            <div className="flex-1" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onLookupSceneAtTime?.(quickTime)}
              disabled={readOnly || !onLookupSceneAtTime}
            >
              LOOKUP SCENE
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCreateSceneAtTime?.(quickTime)}
              disabled={readOnly || !onCreateSceneAtTime}
            >
              CREATE SCENE
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">{scheduleEditor || null}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
      Editor for this section isn’t implemented yet.
    </div>
  );
}
