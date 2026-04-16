import { useMemo, useState, useCallback } from "react";
import { collection, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTalent, useLocations } from "../../hooks/useFirestoreQuery";
import { FLAGS } from "../../lib/flags";
import { toast } from "../../lib/toast";

export default function ProjectAssetsManager({ projectId }) {
  const { clientId } = useAuth();
  const [filter, setFilter] = useState("");

  const { data: allTalent = [], isLoading: loadingTalent } = useTalent(clientId);
  const { data: allLocations = [], isLoading: loadingLocations } = useLocations(clientId);

  const filteredTalent = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allTalent;
    return allTalent.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [filter, allTalent]);

  const filteredLocations = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allLocations;
    return allLocations.filter((l) => (l.name || "").toLowerCase().includes(q));
  }, [filter, allLocations]);

  const isInProject = useCallback((entity) => {
    if (!entity) return false;
    const ids = Array.isArray(entity.projectIds) ? entity.projectIds : [];
    return projectId ? ids.includes(projectId) : false;
  }, [projectId]);

  const toggleMembership = useCallback(async (kind, entity) => {
    if (!clientId || !projectId) return;
    const ref = doc(db, "clients", clientId, kind, entity.id);
    const already = isInProject(entity);
    try {
      if (already) {
        await updateDoc(ref, { projectIds: arrayRemove(projectId) });
        toast.success({ title: `Removed from project` });
      } else {
        await updateDoc(ref, { projectIds: arrayUnion(projectId) });
        toast.success({ title: `Added to project` });
      }
    } catch (e) {
      console.error("[ProjectAssetsManager] toggle failed", e);
      toast.error({ title: "Failed to update asset", description: e?.message });
    }
  }, [clientId, projectId, isInProject]);

  if (!FLAGS.projectScopedAssets) {
    return (
      <div className="rounded-card border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold">Project Assets</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Project-scoped assets flag is off.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Project Assets</h2>
        <input
          type="text"
          placeholder="Search assets"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-card border border-slate-200 dark:border-slate-700">
          <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Talent</h3>
            {loadingTalent ? <span className="text-xs text-slate-500">Loading…</span> : null}
          </header>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {filteredTalent.map((t) => {
              const checked = isInProject(t);
              return (
                <li key={t.id} className="flex items-center justify-between px-4 py-2">
                  <span className="truncate text-sm">{t.name || "Unnamed talent"}</span>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMembership("talent", t)}
                    />
                    <span>{checked ? "In project" : "Add"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-card border border-slate-200 dark:border-slate-700">
          <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Locations</h3>
            {loadingLocations ? <span className="text-xs text-slate-500">Loading…</span> : null}
          </header>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {filteredLocations.map((l) => {
              const checked = isInProject(l);
              return (
                <li key={l.id} className="flex items-center justify-between px-4 py-2">
                  <span className="truncate text-sm">{l.name || "Unnamed location"}</span>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMembership("locations", l)}
                    />
                    <span>{checked ? "In project" : "Add"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
