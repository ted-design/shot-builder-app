import { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { shotsPath } from "../../lib/paths";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "../../lib/toast";
import { writeDoc } from "../../lib/firestoreWrites";
import { describeFirebaseError } from "../../lib/firebaseErrors";

export default function OrphanedShotsMigration({ clientId }) {
  const [orphanedShots, setOrphanedShots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [creatingLegacy, setCreatingLegacy] = useState(false);

  const currentShotsPath = useMemo(() => shotsPath(clientId), [clientId]);
  const projectsPath = useMemo(() => ["clients", clientId, "projects"], [clientId]);

  const loadOrphanedShots = async () => {
    setLoading(true);
    try {
      // Query for shots with null projectId
      const nullQuery = query(
        collection(db, ...currentShotsPath),
        where("projectId", "==", null),
        where("deleted", "==", false)
      );

      // Query for shots with empty string projectId
      const emptyQuery = query(
        collection(db, ...currentShotsPath),
        where("projectId", "==", ""),
        where("deleted", "==", false)
      );

      const [nullSnapshot, emptySnapshot] = await Promise.all([
        getDocs(nullQuery),
        getDocs(emptyQuery)
      ]);

      const shots = [
        ...nullSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
        ...emptySnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      ];

      setOrphanedShots(shots);
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to load orphaned shots.");
      toast.error({ title: "Failed to load shots", description: `${code}: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const projectsQuery = query(
        collection(db, ...projectsPath),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(projectsQuery);
      setProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deletedAt));
    } catch (error) {
      console.error("Failed to load projects", error);
    }
  };

  useEffect(() => {
    if (clientId) {
      loadOrphanedShots();
      loadProjects();
    }
  }, [clientId]);

  const handleCreateLegacyProject = async () => {
    if (!clientId) return;
    setCreatingLegacy(true);
    try {
      const projectDoc = await writeDoc("create legacy project", () =>
        addDoc(collection(db, ...projectsPath), {
          name: "Legacy Shots",
          shootDates: [],
          briefUrl: "",
          notes: "Auto-created project for shots without a project assignment",
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          members: {},
        })
      );

      setSelectedProject(projectDoc.id);
      await loadProjects();
      toast.success("Legacy project created. You can now migrate shots to it.");
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to create legacy project.");
      toast.error({ title: "Failed to create project", description: `${code}: ${message}` });
    } finally {
      setCreatingLegacy(false);
    }
  };

  const handleMigrateAll = async () => {
    if (!selectedProject) {
      toast.error("Please select a project first.");
      return;
    }

    const targetProject = projects.find(p => p.id === selectedProject);
    if (!targetProject) {
      toast.error("Selected project not found.");
      return;
    }

    setMigrating(true);
    try {
      await Promise.all(
        orphanedShots.map(shot =>
          writeDoc("migrate orphaned shot", () =>
            updateDoc(doc(db, ...currentShotsPath, shot.id), {
              projectId: selectedProject,
              updatedAt: serverTimestamp(),
            })
          )
        )
      );

      toast.success({
        title: "Migration complete",
        description: `${orphanedShots.length} shot(s) migrated to "${targetProject.name}".`,
      });

      await loadOrphanedShots();
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to migrate shots.");
      toast.error({ title: "Migration failed", description: `${code}: ${message}` });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Orphaned Shots Migration</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Find and migrate shots that don't have a project assignment. These shots won't appear in the normal project views.
        </p>

        <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Found {orphanedShots.length} orphaned shot{orphanedShots.length !== 1 ? 's' : ''}
              </p>
              {orphanedShots.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  These shots have null or empty projectId values
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={loadOrphanedShots}
              disabled={loading}
            >
              {loading ? "Scanning..." : "Refresh"}
            </Button>
          </div>

          {orphanedShots.length > 0 && (
            <div className="space-y-2">
              <div className="max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                <ul className="space-y-1 text-sm">
                  {orphanedShots.map(shot => (
                    <li key={shot.id} className="text-slate-700">
                      • {shot.name || `Unnamed shot (${shot.id.substring(0, 8)}...)`}
                      {shot.date && <span className="text-slate-500"> - {shot.date}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Migrate to project:
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                    disabled={migrating || creatingLegacy}
                  >
                    <option value="">Select a project...</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.status === "archived" && " (Archived)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleMigrateAll}
                    disabled={!selectedProject || migrating || creatingLegacy}
                  >
                    {migrating ? "Migrating..." : `Migrate ${orphanedShots.length} shot${orphanedShots.length !== 1 ? 's' : ''}`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCreateLegacyProject}
                    disabled={migrating || creatingLegacy}
                  >
                    {creatingLegacy ? "Creating..." : "Create Legacy Project"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {orphanedShots.length === 0 && !loading && (
            <p className="text-sm text-green-700">
              ✓ All shots have valid project assignments
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
