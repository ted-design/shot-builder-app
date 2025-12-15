// src/components/callsheet/CallSheetToolbar.jsx
// Toolbar for the Call Sheet Builder (actions + settings)

import React, { useState } from "react";
import {
  Plus,
  Settings,
  Clock,
  Link2,
  Unlink2,
  Download,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { useUpdateScheduleSettings } from "../../hooks/useSchedule";

/**
 * CallSheetToolbar - Toolbar for the call sheet builder
 *
 * @param {object} props
 * @param {object} props.schedule - Current schedule object
 * @param {Function} props.onAddShot - Callback for adding a shot
 * @param {object} props.settings - Schedule settings
 * @param {string} props.clientId - Client ID
 * @param {string} props.projectId - Project ID
 * @param {string} props.scheduleId - Schedule ID
 * @param {Function} props.onSetDayStartTime - Callback to set schedule day start time (and shift entries)
 * @param {Function} props.onEditColumns - Callback to open column config
 * @param {Function} props.onEditTracks - Callback to open track manager
 * @param {Function} props.onExport - Callback to open export modal
 * @param {Function} props.onEditSchedule - Callback to edit schedule
 * @param {Function} props.onDeleteSchedule - Callback to delete schedule
 * @param {Function} props.onDuplicateSchedule - Callback to duplicate schedule
 */
function CallSheetToolbar({
  schedule,
  onAddShot,
  settings,
  clientId,
  projectId,
  scheduleId,
  onSetDayStartTime,
  onEditColumns,
  onEditTracks,
  onExport,
  onEditSchedule,
  onDeleteSchedule,
  onDuplicateSchedule,
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDayStartModalOpen, setIsDayStartModalOpen] = useState(false);
  const [dayStartDraft, setDayStartDraft] = useState(settings.dayStartTime || "06:00");

  const { updateSettings } = useUpdateScheduleSettings(
    clientId,
    projectId,
    scheduleId
  );

  const handleToggleCascade = () => {
    updateSettings(
      { cascadeChanges: !settings.cascadeChanges },
      settings
    );
  };

  const handleToggleDurations = () => {
    updateSettings(
      { showDurations: !settings.showDurations },
      settings
    );
  };

  const handleTimeIncrementChange = (increment) => {
    updateSettings({ timeIncrement: increment }, settings);
  };

  React.useEffect(() => {
    if (!isDayStartModalOpen) return;
    setDayStartDraft(settings.dayStartTime || "06:00");
  }, [isDayStartModalOpen, settings.dayStartTime]);

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      {/* Left: Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Add Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="default" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onAddShot?.("shot")}>
              Add Shot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "setup")}>
              Add Setup / Load-in
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "break")}>
              Add Break
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "lunch")}>
              Add Lunch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "wrap")}>
              Add Wrap
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "travel")}>
              Add Location Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "meeting")}>
              Add Meeting
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddShot?.("custom", "other")}>
              Add Custom Item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: Schedule Name */}
      <div className="hidden flex-1 items-center justify-center md:flex">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {schedule?.name || "Untitled Schedule"}
        </h2>
      </div>

      {/* Right: Zoom & Settings */}
      <div className="flex items-center gap-2">
        {/* Cascade Toggle */}
        <Button
          type="button"
          variant={settings.cascadeChanges ? "secondary" : "ghost"}
          size="sm"
          onClick={handleToggleCascade}
          className="h-8 gap-1.5 px-2"
          title={
            settings.cascadeChanges
              ? "Auto-adjust times when moving entries"
              : "Move entries independently"
          }
        >
          {settings.cascadeChanges ? (
            <Link2 className="h-4 w-4" />
          ) : (
            <Unlink2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {settings.cascadeChanges ? "Cascade On" : "Cascade Off"}
          </span>
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Settings Dropdown */}
        <DropdownMenu open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Display Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuCheckboxItem
              checked={settings.showDurations}
              onCheckedChange={handleToggleDurations}
            >
              Show Durations
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={settings.cascadeChanges}
              onCheckedChange={handleToggleCascade}
            >
              Auto-cascade Times
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Time Increment</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(settings.timeIncrement || 15)}
              onValueChange={(value) => handleTimeIncrementChange(Number(value))}
            >
              <DropdownMenuRadioItem value="5">5 minutes</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="15">15 minutes</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30">30 minutes</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsDayStartModalOpen(true);
              }}
            >
              <Clock className="mr-2 h-4 w-4" />
              Set Day Start Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Call Sheet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditSchedule}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Schedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicateSchedule}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Schedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEditTracks}>Edit Tracks</DropdownMenuItem>
            <DropdownMenuItem onClick={onEditColumns}>Edit Columns</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400"
              onClick={onDeleteSchedule}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

      <Modal
        open={isDayStartModalOpen}
        onClose={() => setIsDayStartModalOpen(false)}
        labelledBy="callsheet-day-start-title"
        contentClassName="max-w-md"
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <h2 id="callsheet-day-start-title" className="text-lg font-semibold">
              Set Day Start Time
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Shifts the earliest entry and updates everything that follows.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="callsheet-day-start-input">
                Start time
              </label>
              <Input
                id="callsheet-day-start-input"
                type="time"
                value={dayStartDraft}
                onChange={(event) => setDayStartDraft(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setIsDayStartModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSetDayStartTime?.(dayStartDraft);
                  setIsDayStartModalOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      </Modal>
    </>
  );
}

export default CallSheetToolbar;
