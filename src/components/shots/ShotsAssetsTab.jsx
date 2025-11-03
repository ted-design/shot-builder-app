import React, { useMemo, useState, useCallback } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useProjectScope } from "../../context/ProjectScopeContext";
import { useTalent, useLocations } from "../../hooks/useFirestoreQuery";
import { canManageLocations, canManageTalent } from "../../lib/rbac";
import { Button } from "../ui/button";
import AssetSelectModal from "./AssetSelectModal";
import { toast } from "../../lib/toast";

import Thumb from "../Thumb";

function Table({ rows, onRemove, removeLabel = "Remove", disabled = false }) {
  if (!rows?.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
        Nothing added yet.
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
                    {row.headshotPath || row.photoPath ? (
                      <Thumb
                        path={row.headshotPath || row.photoPath}
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
                  {removeLabel}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ShotsAssetsTab() {
  const { clientId, role: globalRole } = useAuth();
  const { currentProjectId } = useProjectScope();
  const canEditTalent = canManageTalent(globalRole);
  const canEditLocations = canManageLocations(globalRole);

  // Project-scoped lists for tables
  const { data: projectTalent = [], isLoading: loadingTalent } = useTalent(clientId, { projectId: currentProjectId, scope: "project" });
  const { data: projectLocations = [], isLoading: loadingLocations } = useLocations(clientId, { projectId: currentProjectId, scope: "project" });

  // Global lists for selection modals
  const { data: allTalent = [] } = useTalent(clientId, { scope: "all" });
  const { data: allLocations = [] } = useLocations(clientId, { scope: "all" });

  const [openTalentModal, setOpenTalentModal] = useState(false);
  const [openLocationsModal, setOpenLocationsModal] = useState(false);

  const projectTalentIds = useMemo(() => new Set(projectTalent.map((t) => t.id)), [projectTalent]);
  const projectLocationIds = useMemo(() => new Set(projectLocations.map((l) => l.id)), [projectLocations]);

  const addTalentToProject = useCallback(async (ids) => {
    if (!clientId || !currentProjectId) return;
    try {
      await Promise.all(
        ids.map((id) => updateDoc(doc(db, "clients", clientId, "talent", id), { projectIds: arrayUnion(currentProjectId) }))
      );
      toast.success({ title: `Added ${ids.length} talent to project` });
    } catch (e) {
      console.error("[Assets] addTalentToProject failed", e);
      toast.error({ title: "Failed to add talent", description: e?.message });
    }
  }, [clientId, currentProjectId]);

  const addLocationsToProject = useCallback(async (ids) => {
    if (!clientId || !currentProjectId) return;
    try {
      await Promise.all(
        ids.map((id) => updateDoc(doc(db, "clients", clientId, "locations", id), { projectIds: arrayUnion(currentProjectId) }))
      );
      toast.success({ title: `Added ${ids.length} locations to project` });
    } catch (e) {
      console.error("[Assets] addLocationsToProject failed", e);
      toast.error({ title: "Failed to add locations", description: e?.message });
    }
  }, [clientId, currentProjectId]);

  const removeTalent = useCallback(async (item) => {
    if (!clientId || !currentProjectId) return;
    try {
      await updateDoc(doc(db, "clients", clientId, "talent", item.id), { projectIds: arrayRemove(currentProjectId) });
      toast.success({ title: `Removed ${item.name || "talent"} from project` });
    } catch (e) {
      console.error("[Assets] removeTalent failed", e);
      toast.error({ title: "Failed to remove talent", description: e?.message });
    }
  }, [clientId, currentProjectId]);

  const removeLocation = useCallback(async (item) => {
    if (!clientId || !currentProjectId) return;
    try {
      await updateDoc(doc(db, "clients", clientId, "locations", item.id), { projectIds: arrayRemove(currentProjectId) });
      toast.success({ title: `Removed ${item.name || "location"} from project` });
    } catch (e) {
      console.error("[Assets] removeLocation failed", e);
      toast.error({ title: "Failed to remove location", description: e?.message });
    }
  }, [clientId, currentProjectId]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Talent</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Only talent in this list appear in dropdowns while building shots.</p>
          </div>
          {canEditTalent && (
            <Button onClick={() => setOpenTalentModal(true)}>Add Talent</Button>
          )}
        </div>
        <Table rows={projectTalent} onRemove={removeTalent} removeLabel="Remove Talent" disabled={!canEditTalent} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Locations</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Only locations in this list appear in dropdowns while building shots.</p>
          </div>
          {canEditLocations && (
            <Button onClick={() => setOpenLocationsModal(true)}>Add Locations</Button>
          )}
        </div>
        <Table rows={projectLocations} onRemove={removeLocation} removeLabel="Remove Location" disabled={!canEditLocations} />
      </section>

      {openTalentModal && (
        <AssetSelectModal
          open={openTalentModal}
          onClose={() => setOpenTalentModal(false)}
          title="Add Talent to Project"
          items={allTalent}
          alreadyInProject={projectTalentIds}
          onSave={addTalentToProject}
        />
      )}
      {openLocationsModal && (
        <AssetSelectModal
          open={openLocationsModal}
          onClose={() => setOpenLocationsModal(false)}
          title="Add Locations to Project"
          items={allLocations}
          alreadyInProject={projectLocationIds}
          onSave={addLocationsToProject}
        />
      )}
    </div>
  );
}
