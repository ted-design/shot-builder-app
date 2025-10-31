import React, { useMemo } from "react";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { CalendarDays, MapPin, Tag } from "lucide-react";
import { shotStatusOptions, normaliseShotStatus } from "../../lib/shotStatus";
import { StatusBadge } from "../ui/StatusBadge";
import { TagList } from "../ui/TagBadge";

const STATUS_VARIANTS = {
  todo: "planning",
  in_progress: "active",
  complete: "complete",
  on_hold: "pending",
};

const AUTO_SAVE_TONES = {
  pending: "text-amber-600 dark:text-amber-400",
  saving: "text-primary dark:text-indigo-400",
  saved: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
};

function formatAutoSaveMeta(entry) {
  if (!entry) return null;
  switch (entry.state) {
    case "pending":
      return { message: "Unsaved changes", tone: AUTO_SAVE_TONES.pending };
    case "saving":
      return { message: "Saving…", tone: AUTO_SAVE_TONES.saving };
    case "saved": {
      if (entry.timestamp) {
        const date = new Date(entry.timestamp);
        return {
          message: `Saved ${formatDistanceToNow(date, { addSuffix: true })}`,
          tone: AUTO_SAVE_TONES.saved,
        };
      }
      return { message: "Saved", tone: AUTO_SAVE_TONES.saved };
    }
    case "error":
      return { message: entry.message || "Auto-save failed", tone: AUTO_SAVE_TONES.error };
    default:
      return null;
  }
}

function buildScheduleDetails(dateValue) {
  if (!dateValue) {
    return {
      primary: "No date scheduled",
      secondary: "Set a target date in Basics.",
      tone: "text-slate-500 dark:text-slate-400",
    };
  }

  let parsedDate = null;
  if (dateValue instanceof Date) {
    parsedDate = dateValue;
  } else if (typeof dateValue === "string" && dateValue.trim()) {
    parsedDate = parseISO(dateValue);
  }

  if (!parsedDate || !isValid(parsedDate)) {
    return {
      primary: dateValue,
      secondary: null,
      tone: "text-slate-600 dark:text-slate-300",
    };
  }

  return {
    primary: format(parsedDate, "EEEE, MMM d, yyyy"),
    secondary: formatDistanceToNow(parsedDate, { addSuffix: true }),
    tone: "text-slate-700 dark:text-slate-200",
  };
}

export default function ShotSidebarSummary({
  status,
  onStatusChange,
  statusDisabled = false,
  statusOptions = shotStatusOptions,
  dateValue,
  locationLabel = "No location",
  tags = [],
  basicsStatus = null,
  logisticsStatus = null,
}) {
  const resolvedStatus = normaliseShotStatus(status);
  const statusList = Array.isArray(statusOptions) && statusOptions.length ? statusOptions : shotStatusOptions;
  const activeStatusOption = statusList.find((option) => option.value === resolvedStatus) || statusList[0];
  const statusBadgeVariant = STATUS_VARIANTS[resolvedStatus] || "inactive";
  const basicsMeta = useMemo(() => formatAutoSaveMeta(basicsStatus), [basicsStatus]);
  const logisticsMeta = useMemo(() => formatAutoSaveMeta(logisticsStatus), [logisticsStatus]);
  const scheduleDetails = useMemo(() => buildScheduleDetails(dateValue), [dateValue]);

  return (
    <aside className="rounded-lg border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status</h3>
            {activeStatusOption && (
              <StatusBadge variant={statusBadgeVariant} className="capitalize">
                {activeStatusOption.label}
              </StatusBadge>
            )}
          </div>
          <select
            className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500"
            value={resolvedStatus}
            onChange={(event) => {
              if (typeof onStatusChange === "function") {
                onStatusChange(event.target.value);
              }
            }}
            disabled={statusDisabled || typeof onStatusChange !== "function"}
          >
            {statusList.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {basicsMeta && (
            <p className={`text-xs ${basicsMeta.tone}`}>{basicsMeta.message}</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Schedule</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className={`text-sm font-medium ${scheduleDetails.tone}`}>{scheduleDetails.primary}</p>
                {scheduleDetails.secondary && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{scheduleDetails.secondary}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
              <p className="text-sm text-slate-700 dark:text-slate-200">{locationLabel || "No location"}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tags</h3>
          </div>
          <TagList tags={tags} className="text-xs" emptyMessage="No tags yet" />
          {logisticsMeta && (
            <p className={`text-xs ${logisticsMeta.tone}`}>{logisticsMeta.message}</p>
          )}
        </section>
      </div>
    </aside>
  );
}
