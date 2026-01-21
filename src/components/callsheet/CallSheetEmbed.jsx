// src/components/callsheet/CallSheetEmbed.jsx
// Embedded wrapper for CallSheetBuilder to use in ShotsPage

import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { FLAGS } from "../../lib/flags";
import { talentPath, locationsPath, productFamiliesPath } from "../../lib/paths";
import { useFirestoreCollection } from "../../hooks/useFirestoreCollection";
import { useShots, useProjects } from "../../hooks/useFirestoreQuery";
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useDuplicateSchedule,
} from "../../hooks/useSchedule";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Calendar,
  Plus,
  ChevronDown,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "../../lib/toast";
import ScheduleCreateModal from "./ScheduleCreateModal";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";

// Lazy load the builder component
const CallSheetBuilder = lazy(() => import("./CallSheetBuilder"));

/**
 * CallSheetEmbed - Embedded version of Call Sheet for ShotsPage tab
 */
function CallSheetEmbed() {
  const { projectId } = useParams();
  const { user, clientId } = useAuth();
  const { data: projects = [] } = useProjects(clientId);
  const activeProject = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId]);

  // Feature flag check
  if (!FLAGS.callSheetBuilder) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p>Call Sheet Builder is not enabled</p>
        <p className="text-sm text-slate-400">
          Enable it with <code className="rounded bg-slate-100 px-1">?callSheetBuilder=1</code>
        </p>
      </div>
    );
  }

  // No project selected
  if (!projectId) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <Calendar className="h-12 w-12 text-slate-300" />
        <p>Select a project to view schedules</p>
      </div>
    );
  }

  return <CallSheetEmbedContent clientId={clientId} projectId={projectId} activeProject={activeProject} />;
}

/**
 * Inner content component with data fetching
 */
function CallSheetEmbedContent({ clientId, projectId, activeProject }) {
  // Active schedule ID
  const [activeScheduleId, setActiveScheduleId] = useState(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Fetch schedules for this project
  const { schedules, loading: schedulesLoading, error: schedulesError } = useSchedules(
    clientId,
    projectId
  );

  // Schedule mutations
  const createSchedule = useCreateSchedule(clientId, projectId, {
    onSuccess: (newSchedule) => {
      setActiveScheduleId(newSchedule.id);
      toast.success({ title: "Schedule created" });
    },
  });

  const updateSchedule = useUpdateSchedule(clientId, projectId, {
    onSuccess: () => {
      toast.success({ title: "Schedule updated" });
      setIsEditModalOpen(false);
    },
  });

  const deleteSchedule = useDeleteSchedule(clientId, projectId, {
    onSuccess: () => {
      toast.success({ title: "Schedule deleted" });
      setIsDeleteConfirmOpen(false);
      // Switch to another schedule if available
      const remainingSchedules = schedules.filter((s) => s.id !== activeScheduleId);
      setActiveScheduleId(remainingSchedules[0]?.id || null);
    },
  });

  const duplicateSchedule = useDuplicateSchedule(clientId, projectId, {
    onSuccess: (newSchedule) => {
      setActiveScheduleId(newSchedule.id);
      toast.success({ title: "Schedule duplicated" });
    },
  });

  // Fetch shots for the project using the same hook as ShotsPage
  const { data: shots = [], isLoading: shotsLoading } = useShots(clientId, projectId);

  // Fetch talent
  const talentRef = useMemo(() => {
    if (!clientId) return null;
    return collection(db, ...talentPath(clientId));
  }, [clientId]);

  const { data: talent = [] } = useFirestoreCollection(talentRef);

  // Fetch locations
  const locationsRef = useMemo(() => {
    if (!clientId) return null;
    return collection(db, ...locationsPath(clientId));
  }, [clientId]);

  const { data: locations = [] } = useFirestoreCollection(locationsRef);

  // Fetch products
  const productsRef = useMemo(() => {
    if (!clientId) return null;
    return collection(db, ...productFamiliesPath(clientId));
  }, [clientId]);

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

  // Set active schedule to first one if not set
  React.useEffect(() => {
    if (!activeScheduleId && schedules.length > 0) {
      setActiveScheduleId(schedules[0].id);
    }
  }, [activeScheduleId, schedules]);

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

  // Handle editing an entry
  const handleEditEntry = useCallback((entry) => {
    console.log("Edit entry:", entry);
    toast.info({ title: "Entry editor coming soon" });
  }, []);

  // Handle editing the schedule
  const handleEditSchedule = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  // Handle deleting the schedule
  const handleDeleteSchedule = useCallback(() => {
    setIsDeleteConfirmOpen(true);
  }, []);

  // Handle confirming delete
  const handleConfirmDelete = useCallback(() => {
    if (activeScheduleId) {
      deleteSchedule.mutate({ scheduleId: activeScheduleId });
    }
  }, [activeScheduleId, deleteSchedule]);

  // Handle duplicating the schedule
  const handleDuplicateSchedule = useCallback(() => {
    if (activeSchedule) {
      duplicateSchedule.mutate({
        sourceSchedule: activeSchedule,
        newName: `${activeSchedule.name} (Copy)`,
      });
    }
  }, [activeSchedule, duplicateSchedule]);

  // Handle edit form submission
  const handleEditSubmit = useCallback(
    (scheduleData) => {
      if (activeScheduleId) {
        updateSchedule.mutate({
          scheduleId: activeScheduleId,
          updates: {
            name: scheduleData.name,
            date: scheduleData.date,
          },
        });
      }
    },
    [activeScheduleId, updateSchedule]
  );

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
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Schedule Selector Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Schedule Selector */}
          {schedules.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
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

        {/* Create Schedule Button */}
        <Button onClick={handleOpenCreateModal} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Schedule
        </Button>
      </div>

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
            projectTitle={activeProject?.name ?? ""}
            shots={shots}
            shotsLoading={shotsLoading}
            shotsMap={shotsMap}
            talentMap={talentMap}
            productsMap={productsMap}
            locationsMap={locationsMap}
            onEditEntry={handleEditEntry}
            onEditSchedule={handleEditSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onDuplicateSchedule={handleDuplicateSchedule}
          />
        </Suspense>
      ) : (
        // No active schedule selected
        <div className="flex flex-1 items-center justify-center text-slate-500">
          Select a schedule from the dropdown
        </div>
      )}

      {/* Create Schedule Modal */}
      <ScheduleCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSchedule}
        existingDates={schedules.map((s) => s.date)}
        busy={createSchedule.isPending}
        mode="create"
      />

      {/* Edit Schedule Modal */}
      <ScheduleCreateModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        existingDates={schedules.map((s) => s.date)}
        busy={updateSchedule.isPending}
        mode="edit"
        schedule={activeSchedule}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        closeOnOverlay={!deleteSchedule.isPending}
        labelledBy="delete-schedule-title"
        contentClassName="max-w-md"
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2
                  id="delete-schedule-title"
                  className="text-lg font-semibold dark:text-slate-200"
                >
                  Delete Schedule
                </h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {activeSchedule?.name}
              </span>
              ? All entries in this schedule will be permanently removed.
            </p>
          </CardContent>
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 pt-4 pb-6 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteSchedule.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSchedule.isPending}
            >
              {deleteSchedule.isPending ? "Deleting..." : "Delete Schedule"}
            </Button>
          </div>
        </Card>
      </Modal>
    </div>
  );
}

export default CallSheetEmbed;
