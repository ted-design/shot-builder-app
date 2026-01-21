// src/components/callsheet/CallSheetToolbar.jsx
// Toolbar for the Call Sheet Builder (actions + settings)

import React, { useState } from "react";
import {
  Plus,
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
} from "../ui/dropdown-menu";

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
  onEditColumns,
  onEditTracks,
  onExport,
  onEditSchedule,
  onDeleteSchedule,
  onDuplicateSchedule,
}) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Schedule Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Schedule actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Call Sheet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEditSchedule}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Schedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicateSchedule}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Schedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

      {/* Delete Schedule Confirmation Modal */}
      <Modal
        open={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeleteConfirmText("");
        }}
        labelledBy="delete-schedule-title"
        contentClassName="max-w-md"
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <h2 id="delete-schedule-title" className="text-lg font-semibold text-red-600 dark:text-red-400">
              Delete Schedule
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This action cannot be undone. All schedule entries and settings will be permanently deleted.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                You are about to delete <strong>{schedule?.name || "this schedule"}</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="delete-confirm-input">
                Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
              <Input
                id="delete-confirm-input"
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteConfirmText !== "DELETE"}
                onClick={() => {
                  onDeleteSchedule?.();
                  setIsDeleteConfirmOpen(false);
                  setDeleteConfirmText("");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </Modal>
    </>
  );
}

export default CallSheetToolbar;
