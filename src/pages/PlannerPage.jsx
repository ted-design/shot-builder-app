// src/pages/PlannerPage.jsx (enhanced with legacy shot assignment)

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  lanesPath,
  projectPath,
  getActiveProjectId,
} from "../lib/paths";

// Reusable droppable and draggable components.
function DroppableLane({ laneId, children }) {
  const { setNodeRef } = useDroppable({ id: `lane-${laneId}` });
  return <div ref={setNodeRef}>{children}</div>;
}

function DraggableShot({ shot }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: shot.id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    border: "1px solid #eee",
    padding: "8px 10px",
    borderRadius: 8,
    background: "#fff",
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div style={{ fontWeight: 600 }}>{shot.name}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{shot.type || "-"} • {shot.date || "-"}</div>
    </div>
  );
}

export default function PlannerPage() {
  const [lanes, setLanes] = useState([]);
  const [name, setName] = useState("");
  const [shotsByLane, setShotsByLane] = useState({});
  const [legacyShots, setLegacyShots] = useState([]);

  const projectId = getActiveProjectId();

  // ID of the legacy project where shots were created before a project was selected.
  const legacyProjectId = "default-project";

  useEffect(() => {
    // Subscribe to lanes and shots for the current project.
    const laneRef = collection(db, ...lanesPath(projectId));
    const shotsRef = collection(db, ...projectPath(projectId), "shots");

    const unsubL = onSnapshot(query(laneRef, orderBy("order", "asc")), (s) =>
      setLanes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubS = onSnapshot(shotsRef, (s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const map = {};
      all.forEach((sh) => {
        const key = sh.laneId || "__unassigned__";
        (map[key] ||= []).push(sh);
      });
      setShotsByLane(map);
    });
    return () => {
      unsubL();
      unsubS();
    };
  }, [projectId]);

  useEffect(() => {
    // Fetch shots from the legacy project (default-project) if it isn't the current one.
    if (legacyProjectId === projectId) {
      setLegacyShots([]);
      return;
    }
    const legacyRef = collection(db, ...projectPath(legacyProjectId), "shots");
    const unsubLegacy = onSnapshot(legacyRef, (s) => {
      setLegacyShots(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubLegacy();
  }, [projectId]);

  const addLane = async () => {
    if (!name) return;
    await addDoc(collection(db, ...lanesPath(projectId)), { name, order: lanes.length });
    setName("");
  };

  const renameLane = async (lane) => {
    const newName = prompt("Lane name", lane.name);
    if (!newName) return;
    await updateDoc(doc(db, ...lanesPath(projectId), lane.id), { name: newName });
  };

  const removeLane = async (lane) => {
    if (!confirm("Delete lane?")) return;
    const q = query(collection(db, ...projectPath(projectId), "shots"), where("laneId", "==", lane.id));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((dref) =>
        updateDoc(doc(db, ...projectPath(projectId), "shots", dref.id), { laneId: null })
      )
    );
    await deleteDoc(doc(db, ...lanesPath(projectId), lane.id));
  };

  const onDragEnd = async (e) => {
    const shotId = e.active?.id;
    const overId = e.over?.id;
    if (!shotId || !overId) return;
    const laneId = overId.startsWith("lane-") ? overId.slice(5) : null;
    const patch = { laneId };
    if (laneId) {
      const lane = lanes.find((l) => l.id === laneId);
      if (lane && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) patch.date = lane.name;
    }
    await updateDoc(doc(db, ...projectPath(projectId), "shots", shotId), patch);
  };

  // Assign a legacy shot (from default-project) to the current project.
  //
  // When migrating a shot, attempt to preserve its scheduled date.  If the
  // shot has a `date` field, we look for a lane in the current project whose
  // name matches that date (e.g. "2025-09-12").  If none exists, we create
  // a new lane with that name and append it to the end of the lane list.  The
  // shot is then inserted with its `laneId` set to the found/created lane and
  // its `date` retained.  Shots without a date are left unassigned (laneId
  // null).  Finally, the original document is removed from the legacy
  // collection.
  const assignLegacyShot = async (sh) => {
    const { id, laneId: _oldLaneId, date, ...data } = sh;
    let targetLaneId = null;
    if (date) {
      // Find an existing lane with the same name as the shot's date
      const laneQuery = query(collection(db, ...lanesPath(projectId)), where("name", "==", date));
      const laneSnap = await getDocs(laneQuery);
      if (!laneSnap.empty) {
        targetLaneId = laneSnap.docs[0].id;
      } else {
        // Create a new lane at the end with this date as its name
        const newLaneRef = await addDoc(collection(db, ...lanesPath(projectId)), {
          name: date,
          order: lanes.length,
        });
        targetLaneId = newLaneRef.id;
      }
    }
    await addDoc(collection(db, ...projectPath(projectId), "shots"), {
      ...data,
      laneId: targetLaneId,
      date: date || null,
    });
    await deleteDoc(doc(db, ...projectPath(legacyProjectId), "shots", id));
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Planner</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="New lane (e.g., 2025-09-12 or Unassigned)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={addLane}>Add Lane</button>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div style={{ display: "grid", gridAutoFlow: "column", gap: 12, alignItems: "flex-start" }}>
          {/* Unassigned */}
          <DroppableLane laneId="__unassigned__">
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, minWidth: 280, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Unassigned</strong>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(shotsByLane["__unassigned__"] || []).map((sh) => (
                  <DraggableShot key={sh.id} shot={sh} />
                ))}
              </div>
            </div>
          </DroppableLane>
          {lanes.map((lane) => (
            <DroppableLane key={lane.id} laneId={lane.id}>
              <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, minWidth: 280, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{lane.name}</strong>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => renameLane(lane)}>Rename</button>
                    <button onClick={() => removeLane(lane)}>Delete</button>
                  </span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(shotsByLane[lane.id] || []).map((sh) => (
                    <DraggableShot key={sh.id} shot={sh} />
                  ))}
                </div>
              </div>
            </DroppableLane>
          ))}
        </div>
      </DndContext>
      {/* Legacy shots section */}
      {legacyShots.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <strong>Unassigned shots from previous sessions</strong>
          <ul style={{ padding: 0, marginTop: 8, listStyle: "none", display: "grid", gap: 8 }}>
            {legacyShots.map((sh) => (
              <li key={sh.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{sh.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{sh.type || "-"}</div>
                </div>
                <button onClick={() => assignLegacyShot(sh)}>Assign to current project</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}