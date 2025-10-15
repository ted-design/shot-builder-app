import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";
import ProgressBar from "../ui/ProgressBar";
import { Calendar, Camera, User, MapPin } from "lucide-react";

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

const formatShootDates = (dates) => {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const validDates = dates.filter(Boolean);
  if (validDates.length === 0) return null;

  // Format dates for display
  const formatted = validDates.map(dateStr => {
    try {
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

const renderStat = (label, value) => {
  if (typeof value === "number") {
    return `${label}: ${value}`;
  }
  return null;
};

export function ProjectCard({
  project,
  isActive = false,
  onSelect,
  onEdit,
  canManage = false,
}) {
  const cardClass = isActive
    ? "border-primary dark:border-indigo-500 bg-primary/5 dark:bg-indigo-900/20 ring-2 ring-primary/20 dark:ring-indigo-500/30 shadow-md"
    : "border-slate-200 dark:border-slate-700 hover:border-primary/40 dark:hover:border-indigo-500/40";
  const shootDates = formatShootDates(project?.shootDates);
  const shotCount = project?.shotCount ?? project?.stats?.shots;
  const updatedAt = formatTimestamp(project?.updatedAt || project?.createdAt);
  const talentCount = project?.stats?.talent ?? 0;
  const locationCount = project?.stats?.locations ?? 0;

  // Calculate planning progress
  const totalShots = project?.shotCount ?? project?.stats?.shots ?? 0;
  const shotsPlanned = project?.stats?.shotsPlanned ?? 0;
  const planningPercentage = totalShots > 0 ? (shotsPlanned / totalShots) * 100 : 0;
  const isPlanningStatus = project?.status === "planning";

  return (
    <Card className={`${cardClass} transition-all duration-150 hover:border-primary/50 dark:hover:border-indigo-500/50 hover:shadow-md`}>
      <CardContent className="flex h-full flex-col gap-4 py-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelect?.(project)}
              className="text-left flex-1 min-w-0"
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <div className={`text-lg font-semibold ${isActive ? 'text-primary dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {project?.name || "Untitled project"}
                </div>
                <StatusBadge status={project?.status === "archived" ? "archived" : "active"}>
                  {project?.status === "archived" ? "Archived" : "Active"}
                </StatusBadge>
              </div>
              {shootDates && (
                <div className="flex items-center gap-1.5 text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <span>{shootDates}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
                {typeof shotCount === "number" && (
                  <span className="flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    <span>{shotCount} {shotCount === 1 ? "shot" : "shots"}</span>
                  </span>
                )}
                {talentCount > 0 && (
                  <>
                    {typeof shotCount === "number" && <span>•</span>}
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>{talentCount} {talentCount === 1 ? "model" : "models"}</span>
                    </span>
                  </>
                )}
                {locationCount > 0 && (
                  <>
                    {(typeof shotCount === "number" || talentCount > 0) && <span>•</span>}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>{locationCount} {locationCount === 1 ? "location" : "locations"}</span>
                    </span>
                  </>
                )}
                {updatedAt && (
                  <>
                    {(typeof shotCount === "number" || talentCount > 0 || locationCount > 0) && <span>•</span>}
                    <span className="text-xs text-slate-500 dark:text-slate-500">Updated {updatedAt}</span>
                  </>
                )}
              </div>
            </button>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onEdit?.(project)}
              >
                Edit
              </Button>
            )}
          </div>
          {project?.notes && (
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{project.notes}</p>
          )}
          {isPlanningStatus && totalShots > 0 && (
            <ProgressBar
              label="Planning progress"
              percentage={planningPercentage}
              showPercentage={true}
            />
          )}
        </div>
        <div className="mt-auto flex justify-between items-center text-sm">
          {isActive && (
            <span className="flex items-center gap-1.5 text-primary dark:text-indigo-400 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-primary dark:bg-indigo-400 animate-pulse"></span>
              Current project
            </span>
          )}
          {!isActive && <span></span>}
          <Button
            type="button"
            size="sm"
            onClick={() => onSelect?.(project)}
            variant={isActive ? "default" : "outline"}
          >
            {isActive ? "Open" : "Enter"}
          </Button>
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
