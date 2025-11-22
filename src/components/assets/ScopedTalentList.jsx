import React, { useMemo, useState, useCallback } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useProjectScope } from "../../context/ProjectScopeContext";
import { useTalent } from "../../hooks/useFirestoreQuery";
import { canManageTalent } from "../../lib/rbac";
import { Button } from "../ui/button";
import Thumb from "../Thumb";
import AssetSelectModal from "../shots/AssetSelectModal";
import { toast } from "../../lib/toast";

function Table({ rows, onRemove, disabled = false }) {
  if (!rows?.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
        No talent added to this project yet.
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
                    {row.headshotPath ? (
                      <Thumb
                        path={row.headshotPath}
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

export default function ScopedTalentList({ scope }) {
  const { clientId, role: globalRole } = useAuth();
  const { currentProjectId } = useProjectScope();
  const projectId = scope?.type === "project" ? scope.projectId : currentProjectId;
  const canEdit = canManageTalent(globalRole);

  // Project-scoped list for table
  const { data: projectTalent = [], isLoading } = useTalent(clientId, {
    projectId,
    scope: "project",
  });
  // Global list for selection modal
  const { data: allTalent = [] } = useTalent(clientId, { scope: "all" });

  const projectTalentIds = useMemo(() => new Set(projectTalent.map((t) => t.id)), [projectTalent]);
  const [openModal, setOpenModal] = useState(false);

  const addTalentToProject = useCallback(
    async (ids) => {
      if (!clientId || !projectId) return;
      try {
        await Promise.all(
          ids.map((id) => updateDoc(doc(db, "clients", clientId, "talent", id), { projectIds: arrayUnion(projectId) }))
        );
        toast.success({ title: `Added ${ids.length} talent to project` });
      } catch (e) {
        console.error("[ScopedTalentList] addTalentToProject failed", e);
        toast.error({ title: "Failed to add talent", description: e?.message });
      }
    },
    [clientId, projectId]
  );

  const removeTalent = useCallback(
    async (item) => {
      if (!clientId || !projectId) return;
      try {
        await updateDoc(doc(db, "clients", clientId, "talent", item.id), { projectIds: arrayRemove(projectId) });
        toast.success({ title: `Removed ${item.name || "talent"} from project` });
      } catch (e) {
        console.error("[ScopedTalentList] removeTalent failed", e);
        toast.error({ title: "Failed to remove talent", description: e?.message });
      }
    },
    [clientId, projectId]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Talent</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Only talent in this list appear in dropdowns while building shots.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpenModal(true)} disabled={isLoading}>Add Talent</Button>
        )}
      </div>
      <Table rows={projectTalent} onRemove={removeTalent} disabled={!canEdit} />

      {openModal && (
        <AssetSelectModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          title="Add Talent to Project"
          items={allTalent}
          alreadyInProject={projectTalentIds}
          onSave={addTalentToProject}
        />
      )}
    </section>
  );
}

