import React, { useMemo, useState, useCallback } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useLocations } from "../../hooks/useFirestoreQuery";
import { canManageLocations } from "../../lib/rbac";
import { Button } from "../ui/button";
import Thumb from "../Thumb";
import AssetSelectModal from "../shots/AssetSelectModal";
import { toast } from "../../lib/toast";

function Table({ rows, onRemove, disabled = false }) {
  if (!rows?.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
        No locations added to this project yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
            <th className="px-3 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                    {row.photoPath ? (
                      <Thumb
                        path={row.photoPath}
                        size={128}
                        alt={row.name || ""}
                        className="h-8 w-8"
                        imageClassName="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <span className="truncate">{row.name || "Untitled"}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="secondary" onClick={() => onRemove(row)} disabled={disabled}>
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ScopedLocationList
 * Displays locations for a given scope (project or org).
 *
 * CRITICAL: Uses scope.projectId as single source of truth.
 * Does NOT fall back to context - scope prop must be fully specified by parent.
 */
export default function ScopedLocationList({ scope }) {
  const { clientId, role: globalRole } = useAuth();
  // Use scope.projectId directly - no fallback to context
  const projectId = scope?.type === "project" ? scope.projectId : null;
  const canEdit = canManageLocations(globalRole);

  // Project-scoped list for table
  const { data: projectLocations = [], isLoading } = useLocations(clientId, {
    projectId,
    scope: "project",
  });
  // Global list for selection modal
  const { data: allLocations = [] } = useLocations(clientId, { scope: "all" });

  const projectLocationIds = useMemo(() => new Set(projectLocations.map((l) => l.id)), [projectLocations]);
  const [openModal, setOpenModal] = useState(false);

  const addLocationsToProject = useCallback(
    async (ids) => {
      if (!clientId || !projectId) return;
      try {
        await Promise.all(
          ids.map((id) => updateDoc(doc(db, "clients", clientId, "locations", id), { projectIds: arrayUnion(projectId) }))
        );
        toast.success({ title: `Added ${ids.length} locations to project` });
      } catch (e) {
        console.error("[ScopedLocationList] addLocationsToProject failed", e);
        toast.error({ title: "Failed to add locations", description: e?.message });
      }
    },
    [clientId, projectId]
  );

  const removeLocation = useCallback(
    async (item) => {
      if (!clientId || !projectId) return;
      try {
        await updateDoc(doc(db, "clients", clientId, "locations", item.id), { projectIds: arrayRemove(projectId) });
        toast.success({ title: `Removed ${item.name || "location"} from project` });
      } catch (e) {
        console.error("[ScopedLocationList] removeLocation failed", e);
        toast.error({ title: "Failed to remove location", description: e?.message });
      }
    },
    [clientId, projectId]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Locations</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Only locations in this list appear in dropdowns while building shots.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpenModal(true)} disabled={isLoading}>Add Locations</Button>
        )}
      </div>
      <Table rows={projectLocations} onRemove={removeLocation} disabled={!canEdit} />

      {openModal && (
        <AssetSelectModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          title="Add Locations to Project"
          items={allLocations}
          alreadyInProject={projectLocationIds}
          onSave={addLocationsToProject}
        />
      )}
    </section>
  );
}

