import React from "react";
import DayDetailsEditorCard from "../DayDetailsEditorCard";
import CrewCallsCard from "../CrewCallsCard";
import TalentCallsCard from "../TalentCallsCard";
import NotesContactsEditorCard from "../NotesContactsEditorCard";
import RemindersEditorCard from "../RemindersEditorCard";
import CustomBannerEditorCard from "../CustomBannerEditorCard";
import HeaderEditorCard from "../HeaderEditorCard";
import { Button } from "../../ui/button";

export default function EditorPanel({
  activeSection,
  clientId,
  projectId,
  scheduleId,
  schedule,
  dayDetails,
  callSheetConfig,
  onUpdateCallSheetConfig,
  scheduleEditor,
  generalCrewCallTime,
  onUpdateSectionConfig,
}) {
  const activeType = activeSection?.type || "schedule";

  if (activeType === "header") {
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
        <DayDetailsEditorCard clientId={clientId} projectId={projectId} scheduleId={scheduleId} />
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

  if (activeType === "notes-contacts") {
    return (
      <div className="space-y-3">
        <NotesContactsEditorCard clientId={clientId} projectId={projectId} scheduleId={scheduleId} />
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
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                Today’s Schedule
              </div>
              <div className="text-xs text-slate-500">
                Multi-track preview: parallel columns or stacked tracks.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "parallel" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "parallel" })}
              >
                Parallel
              </Button>
              <Button
                type="button"
                variant={viewMode === "stacked" ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateSectionConfig?.(activeSection.id, { viewMode: "stacked" })}
              >
                Stacked
              </Button>
            </div>
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
