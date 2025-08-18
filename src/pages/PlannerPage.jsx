// src/pages/PlannerPage.jsx (global shots version)
//
// This Planner subscribes to lanes under the active project and to a global
// shots collection filtered by `projectId`.  Lanes are stored in
// `projects/{projectId}/lanes` and maintain their per‑project scope.  Shots
// live in `clients/{clientId}/shots` and include a `projectId` field so
// they can be filtered per project.  Dragging a shot between lanes updates
// its `laneId`, and if the lane name is a date (YYYY-MM-DD) the shot's
// `date` field is updated as well.  All other behaviour matches the
// previous Planner implementation.

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
  shotsPath,
  getActiveProjectId,
} from "../lib/paths";

// Simple droppable component for DnD kit
function DroppableLane({ laneId, children }) {
  const { setNodeRef } = useDroppable({ id: `lane-${laneId}` });
  return <div ref={setNodeRef}>{children}</div>;
}

// Simple draggable shot card for DnD kit
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
  const projectId = getActiveProjectId();

  useEffect(() => {
    // Subscribe to lanes for the current project
    const laneRef = collection(db, ...lanesPath(projectId));
    const unsubL = onSnapshot(query(laneRef, orderBy("order", "asc")), (s) =>
      setLanes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    // Subscribe to shots for the current project.  We query the global shots
    // collection and filter by projectId.  Snapshots update the map of shots
    // keyed by laneId, with "__unassigned__" used for null laneId.
    const shotsRef = collection(db, ...shotsPath());
    const shotsQuery = query(shotsRef, where("projectId", "==", projectId));
    const unsubS = onSnapshot(shotsQuery, (s) => {
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

  // Create a new lane with a given name.  Lanes are ordered sequentially
  // based on the length of the current lane array.  Names are arbitrary but
  // using a date format (YYYY-MM-DD) allows drag events to update shot dates.
  const addLane = async () => {
    if (!name) return;
    await addDoc(collection(db, ...lanesPath(projectId)), { name, order: lanes.length });
    setName("");
  };

  // Prompt to rename a lane.  Empty input aborts the rename.
  const renameLane = async (lane) => {
    const newName = prompt("Lane name", lane.name);
    if (!newName) return;
    await updateDoc(doc(db, ...lanesPath(projectId), lane.id), { name: newName });
  };

  // Remove a lane.  Before deleting the lane document we set laneId=null for
  // all shots that currently reference this lane.  Because shots live in a
  // central collection we need to query for the current project's shots with
  // this laneId and update them.  Only then do we delete the lane.
  const removeLane = async (lane) => {
    if (!confirm("Delete lane?")) return;
    const q = query(
      collection(db, ...shotsPath()),
      where("projectId", "==", projectId),
      where("laneId", "==", lane.id)
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((dref) =>
        updateDoc(doc(db, ...shotsPath(), dref.id), { laneId: null })
      )
    );
    await deleteDoc(doc(db, ...lanesPath(projectId), lane.id));
  };

  // Handle drag end events.  Update the shot's laneId (and date if the lane
  // name looks like a date).  Because shots are stored in a central
  // collection we update via shotsPath().
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
    await updateDoc(doc(db, ...shotsPath(), shotId), patch);
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
          {/* Unassigned column */}
          <DroppableLane laneId="__unassigned__">
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                minWidth: 280,
                display: "grid",
                gap: 8,
              }}
            >
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
          {/* Project lanes */}
          {lanes.map((lane) => (
            <DroppableLane key={lane.id} laneId={lane.id}>
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 12,
                  minWidth: 280,
                  display: "grid",
                  gap: 8,
                }}
              >
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
    </div>
  );
}