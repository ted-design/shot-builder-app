import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";

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
    ? "border-primary/60 shadow-sm"
    : "border-gray-200 hover:border-primary/40";
  const updatedAt = formatTimestamp(project?.updatedAt || project?.createdAt);
  const stats = [
    renderStat("Shots", project?.shotCount ?? project?.stats?.shots),
    renderStat("Pulls", project?.pullCount ?? project?.stats?.pulls),
  ].filter(Boolean);

  return (
    <Card className={`${cardClass} transition-all duration-150 hover:border-primary/50 hover:shadow-md`}>
      <CardContent className="flex h-full flex-col gap-4 py-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelect?.(project)}
              className="text-left"
            >
              <div className="text-lg font-semibold text-slate-900">
                {project?.name || "Untitled project"}
              </div>
              {updatedAt && (
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Updated {updatedAt}
                </div>
              )}
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
            <p className="text-sm text-slate-600 line-clamp-2">{project.notes}</p>
          )}
          {stats.length > 0 && (
            <div className="text-xs font-medium text-slate-500">
              {stats.join(" • ")}
            </div>
          )}
        </div>
        <div className="mt-auto flex justify-between text-sm">
          <span className="text-slate-500">{isActive ? "Current project" : ""}</span>
          <Button
            type="button"
            size="sm"
            onClick={() => onSelect?.(project)}
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
    <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
      <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="text-lg font-semibold text-slate-700">Create Project</div>
        <p className="text-sm text-slate-500">
          Spin up a new campaign to scope shots, pulls, and planner lanes.
        </p>
        <Button type="button" onClick={onClick}>
          New Project
        </Button>
      </CardContent>
    </Card>
  );
}
