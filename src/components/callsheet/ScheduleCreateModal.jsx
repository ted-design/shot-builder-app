// src/components/callsheet/ScheduleCreateModal.jsx
// Modal for creating/editing schedules with date picker

import React, { useState, useMemo, useEffect } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Calendar, AlertCircle, Pencil } from "lucide-react";

/**
 * ScheduleCreateModal - Modal with date picker for creating/editing schedules
 *
 * @param {object} props
 * @param {boolean} props.open - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSubmit - Submit handler receives { name, date }
 * @param {Array} props.existingDates - Array of existing schedule dates (Date or Firestore Timestamp)
 * @param {boolean} props.busy - Whether form is submitting
 * @param {string} props.mode - 'create' | 'edit' (default: 'create')
 * @param {object} props.schedule - Schedule object for edit mode { id, name, date }
 */
function ScheduleCreateModal({
  open,
  onClose,
  onSubmit,
  existingDates = [],
  busy = false,
  mode = "create",
  schedule = null,
}) {
  const isEditMode = mode === "edit" && schedule;

  // Date state
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [name, setName] = useState("");

  // Convert existing dates to a Set of date strings for quick lookup
  // In edit mode, exclude the current schedule's date from the duplicate check
  const existingDateSet = useMemo(() => {
    let dates = existingDates;

    // In edit mode, filter out the current schedule's date
    if (isEditMode && schedule?.date) {
      const currentDateStr = (schedule.date?.toDate ? schedule.date.toDate() : new Date(schedule.date))
        .toISOString()
        .split("T")[0];
      dates = existingDates.filter((d) => {
        const dateStr = (d?.toDate ? d.toDate() : new Date(d)).toISOString().split("T")[0];
        return dateStr !== currentDateStr;
      });
    }

    return new Set(
      dates.map((d) => {
        const dateObj = d?.toDate ? d.toDate() : new Date(d);
        return dateObj.toISOString().split("T")[0];
      })
    );
  }, [existingDates, isEditMode, schedule]);

  // Check if selected date already has a schedule
  const isDuplicate = existingDateSet.has(date);

  // Format the date for display in the default name
  const formattedDate = useMemo(() => {
    if (!date) return "";
    const d = new Date(date + "T12:00:00"); // Use noon to avoid timezone issues
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [date]);

  // Generate default name based on date
  const defaultName = `Shoot Day - ${formattedDate}`;

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDuplicate) return;

    // Create date at noon to avoid timezone issues
    const scheduleDate = new Date(date + "T12:00:00");

    onSubmit({
      name: name.trim() || defaultName,
      date: scheduleDate,
      ...(isEditMode && { id: schedule.id }),
    });

    // Reset form only in create mode
    if (!isEditMode) {
      setName("");
    }
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (isEditMode && schedule) {
        // Pre-fill with existing schedule data
        const scheduleDate = schedule.date?.toDate ? schedule.date.toDate() : new Date(schedule.date);
        setDate(scheduleDate.toISOString().split("T")[0]);
        setName(schedule.name || "");
      } else {
        // Reset to defaults for create mode
        const today = new Date();
        setDate(today.toISOString().split("T")[0]);
        setName("");
      }
    }
  }, [open, isEditMode, schedule]);

  // Dynamic content based on mode
  const title = isEditMode ? "Edit Schedule" : "Create Schedule";
  const subtitle = isEditMode ? "Update schedule details" : "Plan your shoot day";
  const submitText = isEditMode
    ? busy ? "Saving..." : "Save Changes"
    : busy ? "Creating..." : "Create Schedule";
  const Icon = isEditMode ? Pencil : Calendar;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOverlay={!busy}
      labelledBy="schedule-modal-title"
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSubmit}>
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2
                  id="schedule-modal-title"
                  className="text-lg font-semibold dark:text-slate-200"
                >
                  {title}
                </h2>
                <p className="text-sm text-slate-500">
                  {subtitle}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <label
                htmlFor="schedule-date"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Shoot Date <span className="text-red-500">*</span>
              </label>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={busy}
                className="w-full"
              />
              {isDuplicate && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>A schedule for this date already exists</span>
                </div>
              )}
            </div>

            {/* Schedule Name */}
            <div className="space-y-2">
              <label
                htmlFor="schedule-name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Schedule Name{" "}
                <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                id="schedule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultName}
                disabled={busy}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Leave blank to use the default name
              </p>
            </div>
          </CardContent>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 pt-4 pb-6 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || isDuplicate}>
              {submitText}
            </Button>
          </div>
        </Card>
      </form>
    </Modal>
  );
}

export default ScheduleCreateModal;
