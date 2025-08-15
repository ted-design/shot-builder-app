// src/pages/PlannerPage.jsx
import { useEffect, useState } from "react";
import { DndContext, closestCenter, useDroppable, useDraggable } from "@dnd-kit/core";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  query, orderBy, where, getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { lanesPath, projectPath, ACTIVE_PROJECT_ID } from "../lib/paths";

const laneColl = () => collection(db, ...lanesPath(ACTIVE_PROJECT_ID));
const shotsColl = () => collection(db, ...projectPath(ACTIVE_PROJECT_ID), "shots");

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

  useEffect(() => {
    const unsubL = onSnapshot(query(laneColl(), orderBy("order", "asc")),
      s => setLanes(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubS = onSnapshot(shotsColl(), s => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const map = {};
      all.forEach(sh => {
        const key = sh.laneId || "__unassigned__";
        (map[key] ||= []).push(sh);
      });
      setShotsByLane(map);
    });
    return () => { unsubL(); unsubS(); };
  }, []);

  const addLane = async () => {
    if (!name) return;
    await addDoc(laneColl(), { name, order: lanes.length });
    setName("");
  };

  const renameLane = async (lane) => {
    const newName = prompt("Lane name", lane.name); if (!newName) return;
    await updateDoc(doc(db, ...lanesPath(ACTIVE_PROJECT_ID), lane.id), { name: newName });
  };

  const removeLane = async (lane) => {
    if (!confirm("Delete lane?")) return;
    const q = query(shotsColl(), where("laneId", "==", lane.id));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map(dref =>
        updateDoc(doc(db, ...projectPath(ACTIVE_PROJECT_ID), "shots", dref.id), { laneId: null })
      )
    );
    await deleteDoc(doc(db, ...lanesPath(ACTIVE_PROJECT_ID), lane.id));
  };

  const onDragEnd = async (e) => {
    const shotId = e.active?.id;
    const overId = e.over?.id;
    if (!shotId || !overId) return;
    const laneId = overId.startsWith("lane-") ? overId.slice(5) : null;
    const patch = { laneId };
    if (laneId) {
      const lane = lanes.find(l => l.id === laneId);
      if (lane && /^\d{4}-\d{2}-\d{2}$/.test(lane.name)) patch.date = lane.name;
    }
    await updateDoc(doc(db, ...projectPath(ACTIVE_PROJECT_ID), "shots", shotId), patch);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Planner</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="New lane (e.g., 2025-09-12 or Unassigned)"
          value={name}
          onChange={e => setName(e.target.value)}
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
                {(shotsByLane["__unassigned__"] || []).map(sh => <DraggableShot key={sh.id} shot={sh} />)}
              </div>
            </div>
          </DroppableLane>

          {lanes.map(lane => (
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
                  {(shotsByLane[lane.id] || []).map(sh => <DraggableShot key={sh.id} shot={sh} />)}
                </div>
              </div>
            </DroppableLane>
          ))}
        </div>
      </DndContext>
    </div>
  );
}
