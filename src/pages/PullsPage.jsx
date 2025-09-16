// updated PullsPage.jsx
//
// This version replaces the static ACTIVE_PROJECT_ID import with a call to
// getActiveProjectId() on each render.  When you switch projects via your
// existing "Set Active" UI (which writes to localStorage), this component
// will re‑compute the Firestore path and re‑subscribe to the appropriate
// collection.  This change avoids the Rollup build error you saw when
// ACTIVE_PROJECT_ID was removed from ../lib/paths.js and makes the planner
// more responsive to project changes.

import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
// Pull in the dynamic project helper instead of a constant.  The function
// returns whatever project ID is currently stored in localStorage.
import { pullsPath, getActiveProjectId } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManagePulls, ROLE } from "../lib/rbac";
// Optional: if you've created UI primitives (Card, Input, Button), import
// them here.  Otherwise, plain HTML elements will work fine.

export default function PullsPage() {
  // Local state for the list of pulls and the new pull title
  const [pulls, setPulls] = useState([]);
  const [title, setTitle] = useState("");
  // Keep a copy of the current project ID in state.  If the user changes
  // projects via your UI (which writes to localStorage), we listen for the
  // storage event and update this state accordingly.
  const [projectId, setProjectId] = useState(getActiveProjectId());
  const { role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManagePulls(role);

  // Listen for changes to localStorage so we can update the project ID
  // without reloading the entire page.  This allows the planner to react to
  // project changes at runtime.  We set up the listener once when the
  // component mounts and clean it up on unmount.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === "ACTIVE_PROJECT_ID") {
        setProjectId(getActiveProjectId());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Whenever the project ID changes, subscribe to the appropriate pulls
  // collection and update our state when the data changes.  The path is
  // derived from pullsPath(projectId), which returns an array of path
  // segments.  We include orderBy('createdAt') to preserve ordering.
  useEffect(() => {
    const pathSegments = pullsPath(projectId);
    const q = query(collection(db, ...pathSegments), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPulls(
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );
    });
    return () => unsubscribe();
  }, [projectId]);

  // Add a new pull to the current project's pulls collection.  We call
  // serverTimestamp() to populate the createdAt field so that ordering works.
  async function handleAddPull() {
    if (!canManage) {
      alert("You do not have permission to create pulls.");
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) return;
    const pathSegments = pullsPath(projectId);
    await addDoc(collection(db, ...pathSegments), {
      title: trimmed,
      createdAt: serverTimestamp(),
    });
    setTitle("");
  }

  // Update an existing pull's title.  You can extend this function to
  // support other fields as needed.
  async function handleUpdateTitle(id, newTitle) {
    if (!canManage) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const pathSegments = pullsPath(projectId);
    const docRef = doc(db, ...pathSegments, id);
    await updateDoc(docRef, { title: trimmed });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Pulls</h1>
        <p className="text-sm text-slate-600">
          Aggregate products needed for shoots, publish to the warehouse, and track fulfilment.
        </p>
      </div>
      <h1 className="text-2xl font-bold">Pulls</h1>
      {/* Render existing pulls.  For brevity, this example uses simple
          inputs to edit titles in place.  You can replace this with your
          Card/Input/Button primitives for a more consistent look. */}
      <ul className="space-y-2">
        {pulls.map((pull) => (
          <li
            key={pull.id}
            className="flex items-center justify-between p-2 bg-gray-100 rounded"
          >
            <input
              className="flex-1 mr-2 p-1 border rounded"
              value={pull.title || ""}
              disabled={!canManage}
              onChange={(e) => handleUpdateTitle(pull.id, e.target.value)}
            />
          </li>
        ))}
      </ul>
      {/* Form to create a new pull */}
      {canManage ? (
        <div className="flex space-x-2">
          <input
            className="flex-1 p-1 border rounded"
            placeholder="New pull title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-primary text-white rounded"
            onClick={handleAddPull}
          >
            Add
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Pulls are read-only for your role. Producers or warehouse staff can create and update them.
        </div>
      )}
    </div>
  );
}
