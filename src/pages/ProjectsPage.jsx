import { useEffect, useState } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { CLIENT_ID } from "../lib/paths";

const projectsPath = ["clients", CLIENT_ID, "projects"];

export default function ProjectsPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [briefUrl, setBriefUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [dates, setDates] = useState([""]); // one date input to start

  useEffect(() => {
    // sort by first shoot date if available, else createdAt
    const q = query(collection(db, ...projectsPath), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, s => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      // lightweight client sort: earliest shoot date asc
      list.sort((a, b) => {
        const A = (a.shootDates && a.shootDates[0]) || "9999-12-31";
        const B = (b.shootDates && b.shootDates[0]) || "9999-12-31";
        return A.localeCompare(B);
      });
      setItems(list);
    }, (err) => {
      alert("Error loading projects: " + err.message);
      console.error(err);
    });
    return () => unsub();
  }, []);

  const addDateField = () => setDates([...dates, ""]);
  const changeDate = (i, v) => {
    const copy = [...dates]; copy[i] = v; setDates(copy);
  };
  const removeDate = (i) => {
    const copy = [...dates]; copy.splice(i, 1); setDates(copy.length ? copy : [""]);
  };

  const create = async () => {
    if (!name.trim()) return alert("Project name is required");
    const shootDates = dates.map(d => d.trim()).filter(Boolean);
    try {
      await addDoc(collection(db, ...projectsPath), {
        name: name.trim(),
        shootDates,              // array of "YYYY-MM-DD"
        briefUrl: briefUrl.trim() || "",
        notes: notes.trim() || "",
        createdAt: Date.now()
      });
      setName(""); setBriefUrl(""); setNotes(""); setDates([""]);
    } catch (e) {
      alert("Failed to create project: " + e.message);
      console.error(e);
    }
  };

  const rename = async (p) => {
    const n = prompt("New name", p.name); if (!n) return;
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
    <div style={{ padding: 24 }}>
      <h1>Projects</h1>

      {/* Create */}
      <div style={{ display: "grid", gap: 8, maxWidth: 700, marginBottom: 24 }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Shoot dates</div>
          {dates.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" value={d} onChange={e => changeDate(i, e.target.value)} />
              <button onClick={() => removeDate(i)}>-</button>
            </div>
          ))}
          <button onClick={addDateField}>Add date</button>
        </div>

        <input placeholder="Brief URL (optional)" value={briefUrl} onChange={e => setBriefUrl(e.target.value)} />
        <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
        <button onClick={create}>Create Project</button>
      </div>

      {/* List */}
      <ul style={{ display: "grid", gap: 8 }}>
        {items.map(p => (
          <li key={p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between" }}>
            <div>
              <div><strong>{p.name}</strong></div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {Array.isArray(p.shootDates) && p.shootDates.length
                  ? `Shoot dates: ${p.shootDates.join(", ")}`
                  : "No dates"}
              </div>
              {p.briefUrl && <div><a href={p.briefUrl} target="_blank" rel="noreferrer">Brief</a></div>}
              {p.notes && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{p.notes}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => rename(p)}>Rename</button>
              <button onClick={() => setActive(p.id)}>
                {localStorage.getItem("ACTIVE_PROJECT_ID") === p.id ? "Active ✓" : "Set Active"}
              </button>
              <button onClick={() => remove(p)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
