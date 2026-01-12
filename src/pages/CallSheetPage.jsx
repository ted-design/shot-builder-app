// src/pages/CallSheetPage.jsx
// Page component for the Call Sheet Builder

import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";
import { shotsPath, talentPath, locationsPath, productFamiliesPath } from "../lib/paths";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { useProjects } from "../hooks/useFirestoreQuery";
import { useSchedules, useCreateSchedule } from "../hooks/useSchedule";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Calendar,
  Plus,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "../lib/toast";
import ScheduleCreateModal from "../components/callsheet/ScheduleCreateModal";

// Lazy load the builder component
const CallSheetBuilder = lazy(() =>
  import("../components/callsheet/CallSheetBuilder")
);

/**
 * CallSheetPage - Main page for the Call Sheet Builder feature
 */
function CallSheetPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, clientId } = useAuth();
  const { data: projects = [] } = useProjects(clientId);
  const activeProject = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId]);
  const isPreviewMode = searchParams.get("preview") === "1";

  const isEnabled = FLAGS.callSheetBuilder;
  const effectiveClientId = isEnabled ? clientId : null;
  const effectiveProjectId = isEnabled ? projectId : null;

  // Active schedule ID (from URL or first available)
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const scheduleIdFromUrl = searchParams.get("scheduleId");

  // Schedule create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch schedules for this project
  const { schedules, loading: schedulesLoading, error: schedulesError } = useSchedules(
    effectiveClientId,
    effectiveProjectId
  );

  // Create schedule mutation
  const createSchedule = useCreateSchedule(effectiveClientId, effectiveProjectId, {
    onSuccess: (newSchedule) => {
      setActiveScheduleId(newSchedule.id);
      toast.success({ title: "Schedule created" });
    },
  });

  // Fetch shots for the project (for adding to schedule)
  const shotsRef = useMemo(() => {
    if (!effectiveClientId) return null;
    return collection(db, ...shotsPath(effectiveClientId));
  }, [effectiveClientId]);

  const shotsConstraints = useMemo(() => {
    if (!effectiveProjectId) return [];
    return [
      where("projectId", "==", effectiveProjectId),
      where("deleted", "==", false),
      orderBy("shotNumber", "asc"),
    ];
  }, [effectiveProjectId]);

  const { data: shots = [], loading: shotsLoading } = useFirestoreCollection(
    shotsRef,
    shotsConstraints
  );

  // Fetch talent (for resolving names)
  const talentRef = useMemo(() => {
    if (!effectiveClientId) return null;
    return collection(db, ...talentPath(effectiveClientId));
  }, [effectiveClientId]);

  const { data: talent = [] } = useFirestoreCollection(talentRef);

  // Fetch locations (for resolving names)
  const locationsRef = useMemo(() => {
    if (!effectiveClientId) return null;
    return collection(db, ...locationsPath(effectiveClientId));
  }, [effectiveClientId]);

  const { data: locations = [] } = useFirestoreCollection(locationsRef);

  // Fetch products (for resolving names)
  const productsRef = useMemo(() => {
    if (!effectiveClientId) return null;
    return collection(db, ...productFamiliesPath(effectiveClientId));
  }, [effectiveClientId]);

  const { data: products = [] } = useFirestoreCollection(productsRef);

  // Create lookup maps
  const shotsMap = useMemo(() => {
    return new Map(shots.map((s) => [s.id, s]));
  }, [shots]);

  const talentMap = useMemo(() => {
    return new Map(talent.map((t) => [t.id, t]));
  }, [talent]);

  const locationsMap = useMemo(() => {
    return new Map(locations.map((l) => [l.id, l]));
  }, [locations]);

  const productsMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  // Prefer scheduleId from URL when valid; otherwise fall back to the first schedule.
  React.useEffect(() => {
    if (schedules.length === 0) return;

    if (scheduleIdFromUrl && schedules.some((s) => s.id === scheduleIdFromUrl)) {
      setActiveScheduleId(scheduleIdFromUrl);
      return;
    }

    if (!activeScheduleId) {
      setActiveScheduleId(schedules[0].id);
    }
  }, [activeScheduleId, schedules, scheduleIdFromUrl]);

  // Keep the active schedule mirrored in the URL for shareable links.
  React.useEffect(() => {
    if (!activeScheduleId) return;
    if (searchParams.get("scheduleId") === activeScheduleId) return;
    const next = new URLSearchParams(searchParams);
    next.set("scheduleId", activeScheduleId);
    setSearchParams(next, { replace: true });
  }, [activeScheduleId, searchParams, setSearchParams]);

  // Active schedule object
  const activeSchedule = useMemo(() => {
    return schedules.find((s) => s.id === activeScheduleId);
  }, [schedules, activeScheduleId]);

  // Handle opening the create modal
  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  // Handle creating a new schedule from modal
  const handleCreateSchedule = useCallback(
    (scheduleData) => {
      createSchedule.mutate(scheduleData);
      setIsCreateModalOpen(false);
    },
    [createSchedule]
  );

  // Handle editing an entry (placeholder - will open modal in future phase)
  const handleEditEntry = useCallback((entry) => {
    console.log("Edit entry:", entry);
    toast.info({ title: "Entry editor coming soon" });
  }, []);

  // Format schedule date for display
  const formatScheduleDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Loading state
  if (!isEnabled) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p>Call Sheet Builder is not enabled</p>
        <p className="text-sm text-slate-400">
          Enable it with{" "}
          <code className="rounded bg-slate-100 px-1">?callSheetBuilder=1</code>
        </p>
      </div>
    );
  }

  if (schedulesLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Error state
  if (schedulesError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p>Failed to load schedules</p>
        <p className="text-sm text-slate-400">{schedulesError.message}</p>
      </div>
    );
  }

  return (
    <div className={isPreviewMode ? "flex h-full flex-col" : "flex h-full flex-col gap-4 p-4"}>
      {!isPreviewMode ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Call Sheet</h1>
                {activeProject?.name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{activeProject.name}</p>
                )}
              </div>
            </div>

            {schedules.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    {activeSchedule?.name || "Select Schedule"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {schedules.map((schedule) => (
                    <DropdownMenuItem
                      key={schedule.id}
                      onClick={() => setActiveScheduleId(schedule.id)}
                    >
                      <div className="flex flex-col">
                        <span>{schedule.name}</span>
                        <span className="text-xs text-slate-500">
                          {formatScheduleDate(schedule.date)}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <Button onClick={handleOpenCreateModal} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Schedule
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Call Sheet Preview</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{activeProject?.name}</div>
          </div>
          {schedules.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {activeSchedule?.name || "Select Schedule"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {schedules.map((schedule) => (
                  <DropdownMenuItem key={schedule.id} onClick={() => setActiveScheduleId(schedule.id)}>
                    <div className="flex flex-col">
                      <span>{schedule.name}</span>
                      <span className="text-xs text-slate-500">{formatScheduleDate(schedule.date)}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}

      {/* Main Content */}
      {schedules.length === 0 ? (
        // Empty state
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <Calendar className="h-16 w-16 text-slate-300" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
              No schedules yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a schedule to start planning your shoot day
            </p>
          </div>
          <Button onClick={handleOpenCreateModal} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create First Schedule
          </Button>
        </div>
      ) : activeScheduleId ? (
        // Builder view
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          }
        >
          <CallSheetBuilder
            clientId={clientId}
            projectId={projectId}
            scheduleId={activeScheduleId}
            viewMode={isPreviewMode ? "preview" : "builder"}
            projectTitle={activeProject?.name ?? ""}
            shots={shots}
            shotsLoading={shotsLoading}
            shotsMap={shotsMap}
            talentMap={talentMap}
            productsMap={productsMap}
            locationsMap={locationsMap}
            onEditEntry={handleEditEntry}
          />
        </Suspense>
      ) : (
        // No active schedule selected
        <div className="flex flex-1 items-center justify-center text-slate-500">
          Select a schedule from the dropdown
        </div>
      )}

      {/* Create Schedule Modal */}
      {!isPreviewMode ? (
        <ScheduleCreateModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateSchedule}
          existingDates={schedules.map((s) => s.date)}
          busy={createSchedule.isPending}
        />
      ) : null}
    </div>
  );
}

export default CallSheetPage;
