import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { CLIENT_ID } from "../lib/paths";

// Import the shared UI primitives.  These provide consistent styling
// out of the box using your Tailwind palette and spacing tokens.
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const projectsPath = ["clients", CLIENT_ID, "projects"];

export default function ProjectsPage() {
  // Firestore subscription: listen for projects ordered by createdAt desc.
  const projectsRef = collection(db, ...projectsPath);
  const { data: itemsRaw, loading: loadingProjects, error: projectsError } =
    useFirestoreCollection(projectsRef, [orderBy("createdAt", "desc")]);

  // Derive a sorted list based on earliest shoot date so that upcoming shoots
  // appear first.  This computation is memoised to avoid re‑sorting on
  // every render when the list hasn't changed.
  const items = useMemo(() => {
    if (!itemsRaw) return [];
    const list = [...itemsRaw];
    list.sort((a, b) => {
      const A = (a.shootDates && a.shootDates[0]) || "9999-12-31";
      const B = (b.shootDates && b.shootDates[0]) || "9999-12-31";
      return A.localeCompare(B);
    });
    return list;
  }, [itemsRaw]);
  const [name, setName] = useState("");
  const [briefUrl, setBriefUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [dates, setDates] = useState([""]); // one date input to start

  // Show an alert if the subscription reports an error.  This effect runs
  // whenever `projectsError` changes.
  useEffect(() => {
    if (projectsError) {
      alert("Error loading projects: " + projectsError.message);
      console.error(projectsError);
    }
  }, [projectsError]);

  const addDateField = () => setDates([...dates, ""]);
  const changeDate = (i, v) => {
    const copy = [...dates];
    copy[i] = v;
    setDates(copy);
  };
  const removeDate = (i) => {
    const copy = [...dates];
    copy.splice(i, 1);
    setDates(copy.length ? copy : [""]);
  };

  const create = async () => {
    if (!name.trim()) return alert("Project name is required");
    const shootDates = dates.map((d) => d.trim()).filter(Boolean);
    try {
      await addDoc(collection(db, ...projectsPath), {
        name: name.trim(),
        shootDates, // array of "YYYY-MM-DD"
        briefUrl: briefUrl.trim() || "",
        notes: notes.trim() || "",
        createdAt: Date.now(),
      });
      setName("");
      setBriefUrl("");
      setNotes("");
      setDates([""]);
    } catch (e) {
      alert("Failed to create project: " + e.message);
      console.error(e);
    }
  };

  const rename = async (p) => {
    const n = prompt("New name", p.name);
    if (!n) return;
    await updateDoc(doc(db, ...projectsPath, p.id), { name: n });
  };
  const setActive = (id) => {
    localStorage.setItem("ACTIVE_PROJECT_ID", id);
    alert(`Active project set to ${id}. Planner/Shots will use this.`);
  };
  const remove = async (p) => {
    if (!confirm("Delete project?")) return;
    await deleteDoc(doc(db, ...projectsPath, p.id));
  };

  return (
    <div className="mx-auto max-w-screen-lg p-4 space-y-6">
      {/* Show a simple loading state while the projects subscription is
          initialising. A more sophisticated implementation could use a
          skeleton loader component. */}
      {loadingProjects && items.length === 0 && (
        <div className="text-center text-sm text-gray-600">Loading projects…</div>
      )}
      {/* Create project form */}
      <Card>
        <CardHeader className="text-lg font-medium">Create Project</CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid gap-2">
              <div className="text-xs text-gray-600">Shoot dates</div>
              {dates.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => changeDate(i, e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDate(i)}
                  >
                    -
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={addDateField}
              >
                Add date
              </Button>
            </div>
            <Input
              placeholder="Brief URL (optional)"
              value={briefUrl}
              onChange={(e) => setBriefUrl(e.target.value)}
            />
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
            />
            <Button onClick={create}>Create Project</Button>
          </div>
        </CardContent>
      </Card>
      {/* Project list */}
      <div className="grid gap-4">
        {items.map((p) => {
          const active = localStorage.getItem("ACTIVE_PROJECT_ID") === p.id;
          return (
            <Card key={p.id}>
              <CardContent className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-gray-600">
                    {Array.isArray(p.shootDates) && p.shootDates.length
                      ? `Shoot dates: ${p.shootDates.join(", ")}`
                      : "No dates"}
                  </div>
                  {p.briefUrl && (
                    <div className="text-xs">
                      <a
                        href={p.briefUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Brief
                      </a>
                    </div>
                  )}
                  {p.notes && (
                    <div className="text-xs text-gray-700">{p.notes}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => rename(p)}>
                    Rename
                  </Button>
                    <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActive(p.id)}
                  >
                    {active ? "Active ✓" : "Set Active"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(p)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}