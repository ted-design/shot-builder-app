import React, { useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";
import ProgressBar from "../ui/ProgressBar";
import Avatar from "../ui/Avatar";
import { Calendar, Camera, MoreVertical } from "lucide-react";

// Date validation constants
const MIN_VALID_YEAR = 1900;
const MAX_VALID_YEAR = 2100;
const MIN_MONTH = 0;
const MAX_MONTH = 11;
const MIN_DAY = 1;
const MAX_DAY = 31;

/**
 * Formats a Firestore timestamp to a localized date string.
 * @param {Date|Object|number} value - Firestore timestamp, Date object, or milliseconds
 * @returns {string|null} Formatted date string (e.g., "Jan 15, 2025") or null if invalid
 */
const formatTimestamp = (value) => {
  if (!value) return null;
  try {
    let date = null;
    if (value instanceof Date) date = value;
    else if (typeof value.toDate === "function") date = value.toDate();
    else if (typeof value === "number") date = new Date(value);
    else if (value && typeof value.seconds === "number") {
      date = new Date(value.seconds * 1000);
    }
    if (date && !Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch (error) {
    console.warn("[ProjectCard] Failed to format timestamp", error);
  }
  return null;
};

/**
 * Formats shoot dates for display, avoiding timezone shifts.
 * YYYY-MM-DD strings are parsed as local dates to prevent timezone issues
 * (e.g., "2025-10-17" displaying as "Oct 16" in some timezones).
 *
 * @param {string[]} dates - Array of YYYY-MM-DD date strings
 * @returns {string|null} Formatted date(s) as string or range, or null if no valid dates
 *
 * @example
 * formatShootDates(['2025-10-17']) // "Oct 17, 2025"
 * formatShootDates(['2025-10-17', '2025-10-18']) // "Oct 17, 2025 - Oct 18, 2025"
 * formatShootDates(['2025-10-17', '2025-10-18', '2025-10-19']) // "Oct 17, 2025, Oct 18, 2025, Oct 19, 2025"
 */
const formatShootDates = (dates) => {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const validDates = dates.filter(Boolean);
  if (validDates.length === 0) return null;

  // Format dates for display
  const formatted = validDates.map(dateStr => {
    try {
      // Parse date string as local date to avoid timezone issues
      // "2025-10-17" should display as Oct 17, not Oct 16
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);

        // Validate parsed values
        if (year < MIN_VALID_YEAR || year > MAX_VALID_YEAR || month < MIN_MONTH || month > MAX_MONTH || day < MIN_DAY || day > MAX_DAY) {
          console.warn("[ProjectCard] Invalid date components", { year, month: month + 1, day });
          return dateStr;
        }

        const date = new Date(year, month, day);

        // Check if JavaScript rolled the date forward (e.g., Feb 30 → Mar 2)
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
          console.warn("[ProjectCard] Date rolled forward - likely invalid", dateStr);
          return dateStr;
        }

        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
      }
      // Fallback for other date formats
      const date = new Date(dateStr);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch (error) {
      console.warn("[ProjectCard] Failed to format shoot date", error);
    }
    return dateStr;
  });

  // Show as range if 2 dates, or list if more
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} - ${formatted[1]}`;
  return formatted.join(", ");
};

/**
 * Renders a stat label-value pair if value is a number.
 * @param {string} label - The stat label
 * @param {number} value - The stat value
 * @returns {string|null} Formatted stat string or null
 */
const renderStat = (label, value) => {
  if (typeof value === "number") {
    return `${label}: ${value}`;
  }
  return null;
};

const ACCENT_COLORS = ["bg-immediate-red", "bg-orange-500", "bg-slate-400"];

function pickAccentColor(projectId) {
  if (!projectId) return ACCENT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    hash = projectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function normaliseProjectStatus(value) {
  if (!value || typeof value !== "string") return "active";
  return value.trim().toLowerCase();
}

function formatStatusLabel(status) {
  const cleaned = normaliseProjectStatus(status);
  if (cleaned === "on-hold") return "On-hold";
  if (cleaned === "in-progress") return "In progress";
  return cleaned
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProjectCard({
  project,
  isActive = false,
  onSelect,
  onEdit,
  canManage = false,
}) {
  const cardClass = isActive
    ? "border-primary/40 dark:border-indigo-500/40 ring-2 ring-primary/15 dark:ring-indigo-500/25 shadow-md"
    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600";

  // Memoize expensive date formatting to avoid recalculation on every render
  const shootDates = useMemo(() => formatShootDates(project?.shootDates), [project?.shootDates]);
  const updatedAt = useMemo(() => formatTimestamp(project?.updatedAt || project?.createdAt), [project?.updatedAt, project?.createdAt]);

  const shotCount = project?.shotCount ?? project?.stats?.shots;
  const memberIds = useMemo(() => Object.keys(project?.members || {}), [project?.members]);
  const visibleMemberIds = memberIds.slice(0, 4);
  const extraMembers = Math.max(0, memberIds.length - visibleMemberIds.length);

  // Calculate planning progress
  const totalShots = project?.shotCount ?? project?.stats?.shots ?? 0;
  const shotsPlanned = project?.stats?.shotsPlanned ?? 0;
  const planningPercentage = totalShots > 0 ? (shotsPlanned / totalShots) * 100 : 0;
  const status = normaliseProjectStatus(project?.status);
  const isPlanningStatus = status === "planning";

  const statusLabel = formatStatusLabel(project?.status);
  const accentClass = pickAccentColor(project?.id);
  const dateLabel = shootDates || updatedAt;

  return (
    <Card
      className={`relative overflow-hidden ${cardClass}`}
      onClick={() => onSelect?.(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(project);
        }
      }}
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1.5 ${accentClass}`} aria-hidden="true" />

      <CardContent className="flex h-full flex-col gap-4 py-5 pl-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={`text-lg font-semibold ${isActive ? "text-slate-900 dark:text-slate-50" : "text-slate-900 dark:text-slate-100"}`}
                  >
                    {project?.name || "Untitled project"}
                  </div>
                  {project?.notes ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {project.notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {canManage && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEdit?.(project);
                }}
                aria-label="Edit project"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={status}>{statusLabel}</StatusBadge>
            {typeof shotCount === "number" ? (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <Camera className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {shotCount} {shotCount === 1 ? "shot" : "shots"}
                </span>
              </div>
            ) : null}
          </div>

          {isPlanningStatus && totalShots > 0 && (
            <ProgressBar
              label="Planning progress"
              percentage={planningPercentage}
              showPercentage={true}
            />
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {visibleMemberIds.length ? (
              <div className="flex -space-x-2">
                {visibleMemberIds.map((memberId) => (
                  <div key={memberId} className="rounded-full ring-2 ring-white dark:ring-slate-900">
                    <Avatar name={memberId} size="xs" />
                  </div>
                ))}
                {extraMembers ? (
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-900">
                    +{extraMembers}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">No members</div>
            )}
          </div>

          {dateLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate max-w-[160px]">{dateLabel}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function CreateProjectCard({ onClick }) {
  return (
    <Card className="border-dashed border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/40 dark:hover:border-indigo-500/40 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
      <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">Create Project</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Spin up a new campaign to scope shots, pulls, and planner lanes.
        </p>
        <Button type="button" onClick={onClick}>
          New Project
        </Button>
      </CardContent>
    </Card>
  );
}
