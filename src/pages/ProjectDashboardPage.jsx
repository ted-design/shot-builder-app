import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, Link as LinkIcon, MapPin, Camera, Star, Wrench } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProjects, useShots, useLocations, useTalent } from "../hooks/useFirestoreQuery";
import { useProjectCrew } from "../hooks/useProjectCrew";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent } from "../components/ui/card";

function formatShootDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const cleaned = dates.map((d) => String(d || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : null;
}

function StatCard({ to, label, value, description, icon: Icon, className }) {
  return (
    <Link
      to={to}
      className={`group rounded-card border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 ${className || ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </div>
          <div className="mt-1 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
            {value}
          </div>
          {description ? (
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {description}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-neutral-100 p-2 text-neutral-600 group-hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:group-hover:bg-neutral-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export default function ProjectDashboardPage() {
  const { projectId } = useParams();
  const { clientId } = useAuth();

  const { data: projects = [], isLoading: loadingProject } = useProjects(clientId, {
    enabled: Boolean(clientId),
  });
  const project = useMemo(
    () => projects.find((item) => item.id === projectId) || null,
    [projects, projectId]
  );

  const { data: shots = [] } = useShots(clientId, projectId, { enabled: Boolean(clientId && projectId) });
  const { data: projectLocations = [] } = useLocations(clientId, {
    projectId,
    scope: "project",
    enabled: Boolean(clientId && projectId),
  });
  const { data: projectTalent = [] } = useTalent(clientId, {
    projectId,
    scope: "project",
    enabled: Boolean(clientId && projectId),
  });
  const { assignments: crewAssignments = [] } = useProjectCrew(clientId, projectId);

  const crewCount = useMemo(() => {
    const ids = new Set();
    crewAssignments.forEach((assignment) => {
      if (assignment.crewMemberId) ids.add(assignment.crewMemberId);
    });
    return ids.size;
  }, [crewAssignments]);

  const shootDates = formatShootDates(project?.shootDates);
  const notes = (project?.notes || "").trim();
  const briefUrl = (project?.briefUrl || "").trim();

  return (
    <div className="space-y-6">
      <PageHeader sticky={true} className="top-16 z-30">
        <PageHeader.Content>
          <div className="min-w-0">
            <PageHeader.Title>Project Dashboard</PageHeader.Title>
            <PageHeader.Description>Project overview and quick access.</PageHeader.Description>
          </div>
        </PageHeader.Content>
      </PageHeader>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-sky-600 p-6 text-white">
            <div className="text-sm/6 text-white/80">Welcome back</div>
            <div className="mt-1 text-3xl font-semibold">
              {project?.name || (loadingProject ? "Loading…" : "Untitled Project")}
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="space-y-3 rounded-card border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Briefing</div>
              <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                {shootDates ? (
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                    <div>
                      <div className="font-medium">Shoot Dates</div>
                      <div className="text-neutral-600 dark:text-neutral-400">{shootDates}</div>
                    </div>
                  </div>
                ) : null}
                {briefUrl ? (
                  <div className="flex items-start gap-2">
                    <LinkIcon className="mt-0.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="font-medium">Relevant URLs</div>
                      <a
                        href={briefUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-indigo-600 hover:underline dark:text-indigo-400"
                        title={briefUrl}
                      >
                        {briefUrl}
                      </a>
                    </div>
                  </div>
                ) : null}
                {notes ? (
                  <div>
                    <div className="font-medium">Notes</div>
                    <div className="mt-1 whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
                      {notes}
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500 dark:text-neutral-400">
                    Add notes, brief links, and shoot dates in Settings.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                to={`/projects/${projectId}/catalogue/people/talent`}
                label="Talent"
                value={projectTalent.length}
                description="In this project"
                icon={Star}
                className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-neutral-900"
              />
              <StatCard
                to={`/projects/${projectId}/catalogue/people/crew`}
                label="Crew"
                value={crewCount}
                description="In this project"
                icon={Wrench}
                className="bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/30 dark:to-neutral-900"
              />
              <StatCard
                to={`/projects/${projectId}/catalogue/locations`}
                label="Locations"
                value={projectLocations.length}
                description="In this project"
                icon={MapPin}
                className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-neutral-900"
              />
              <StatCard
                to={`/projects/${projectId}/shots`}
                label="Shots"
                value={shots.length}
                description="In this project"
                icon={Camera}
                className="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-neutral-900"
              />
              <StatCard
                to={`/projects/${projectId}/schedule`}
                label="Schedule"
                value="→"
                description="Call sheet & timeline"
                icon={Calendar}
                className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-neutral-900"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
