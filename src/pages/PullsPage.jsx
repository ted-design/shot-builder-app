// PullsPage.jsx
//
// Presents project pull sheets with status tracking, PDF export, and a
// message thread so producers can coordinate with warehouse staff. The active
// project is resolved at runtime via getActiveProjectId(), ensuring the view
// reacts when users switch campaigns from the dashboard.

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
import { db } from "../lib/firebase";
// Pull in the dynamic project helper instead of a constant.  The function
// returns whatever project ID is currently stored in localStorage.
import { pullsPath, getActiveProjectId, DEFAULT_PROJECT_ID } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManagePulls, ROLE } from "../lib/rbac";
import { pdf } from "@react-pdf/renderer";
import { PullPDF } from "../lib/pdfTemplates";
import { Modal } from "../components/ui/modal";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
// Optional: if you've created UI primitives (Card, Input, Button), import
// them here.  Otherwise, plain HTML elements will work fine.

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return null;
};

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const normalisePullRecord = (id, data, fallbackProjectId) => {
  const projectId = data.projectId || fallbackProjectId || DEFAULT_PROJECT_ID;
  const name = typeof data.name === "string" && data.name
    ? data.name
    : typeof data.title === "string"
    ? data.title
    : "";
  return {
    ...data,
    id,
    projectId,
    name,
    items: Array.isArray(data.items) ? data.items : [],
    shotIds: Array.isArray(data.shotIds) ? data.shotIds : [],
    status: typeof data.status === "string" && data.status
      ? data.status
      : "draft",
  };
};

export default function PullsPage() {
  // Local state for the list of pulls and the new pull title
  const [pulls, setPulls] = useState([]);
  const [title, setTitle] = useState("");
  const [activePull, setActivePull] = useState(null);
  // Keep a copy of the current project ID in state.  If the user changes
  // projects via your UI (which writes to localStorage), we listen for the
  // storage event and update this state accordingly.
  const [projectId, setProjectId] = useState(getActiveProjectId());
  const { clientId, role: globalRole, user: authUser } = useAuth();
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
    const pathSegments = pullsPath(projectId, clientId);
    const q = query(collection(db, ...pathSegments), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPulls(
        snapshot.docs.map((docSnap) =>
          normalisePullRecord(docSnap.id, docSnap.data(), projectId)
        )
      );
    });
    return () => unsubscribe();
  }, [projectId, clientId]);

  // Add a new pull to the current project's pulls collection.  We call
  // serverTimestamp() to populate the createdAt field so that ordering works.
  async function handleAddPull() {
    if (!canManage) {
      alert("You do not have permission to create pulls.");
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) return;
    const pathSegments = pullsPath(projectId, clientId);
    await addDoc(collection(db, ...pathSegments), {
      title: trimmed,
      name: trimmed,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "draft",
      items: [],
      shotIds: [],
      projectId: projectId || DEFAULT_PROJECT_ID,
    });
    setTitle("");
  }

  // Update an existing pull's title.  You can extend this function to
  // support other fields as needed.
  async function handleUpdateTitle(id, newTitle) {
    if (!canManage) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const pathSegments = pullsPath(projectId, clientId);
    const docRef = doc(db, ...pathSegments, id);
    await updateDoc(docRef, {
      title: trimmed,
      name: trimmed,
      updatedAt: serverTimestamp(),
    });
  }

  const statusLabel = (status) => {
    const map = {
      draft: "Draft",
      published: "Published",
      "in-progress": "In progress",
      fulfilled: "Fulfilled",
    };
    return map[status] || status || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Pulls</h1>
        <p className="text-sm text-slate-600">
          Aggregate products needed for shoots, publish to the warehouse, and track fulfilment.
        </p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Create Pull</h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {canManage ? (
            <>
              <Input
                className="sm:flex-1"
                placeholder="New pull title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Button onClick={handleAddPull}>Create</Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Pulls are read-only for your role. Producers or warehouse staff can create and update them.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="space-y-3">
        {pulls.map((pull) => {
          const updatedMillis = toMillis(pull.updatedAt);
          const updatedLabel = updatedMillis ? new Date(updatedMillis).toLocaleDateString() : null;
          const itemCount = Array.isArray(pull.items) ? pull.items.length : 0;
          return (
            <Card key={pull.id}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-base font-semibold">{pull.title || "Untitled pull"}</div>
                  <div className="text-xs text-slate-500">
                    {statusLabel(pull.status)} · {itemCount} item{itemCount === 1 ? "" : "s"}
                    {updatedLabel && ` · Updated ${updatedLabel}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const next = prompt("Rename pull", pull.title || "");
                        if (!next || next.trim() === (pull.title || "")) return;
                        handleUpdateTitle(pull.id, next);
                      }}
                    >
                      Rename
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setActivePull(pull)}>
                    Open details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!pulls.length && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-slate-500">
              No pulls created yet.
            </CardContent>
          </Card>
        )}
      </div>
      {activePull && (
        <PullDetailsModal
          pull={activePull}
          projectId={projectId}
          clientId={clientId}
          onClose={() => setActivePull(null)}
          canManage={canManage}
          role={role}
          user={authUser}
        />
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "in-progress", label: "In progress" },
  { value: "fulfilled", label: "Fulfilled" },
];

function PullDetailsModal({ pull, projectId, clientId, onClose, canManage, role, user }) {
  const [items, setItems] = useState(pull.items || []);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, notes: "" });

  useEffect(() => {
    setItems(pull.items || []);
  }, [pull.items]);

  useEffect(() => {
    const messagesRef = query(
      collection(db, ...pullsPath(projectId, clientId), pull.id, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(messagesRef, (snapshot) => {
      setMessages(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsub();
  }, [projectId, clientId, pull.id]);

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value;
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  };

  const handleAddItem = async () => {
    const name = newItem.name.trim();
    if (!name) return;
    const quantity = Number(newItem.quantity) > 0 ? Number(newItem.quantity) : 1;
    const item = {
      id: generateId(),
      name,
      quantity,
      notes: newItem.notes.trim(),
    };
    const updated = [...items, item];
    setItems(updated);
    setSavingItems(true);
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      items: updated,
      updatedAt: serverTimestamp(),
    });
    setNewItem({ name: "", quantity: 1, notes: "" });
    setSavingItems(false);
  };

  const handleRemoveItem = async (itemId) => {
    const updated = items.filter((item) => item.id !== itemId);
    setItems(updated);
    setSavingItems(true);
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      items: updated,
      updatedAt: serverTimestamp(),
    });
    setSavingItems(false);
  };

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setSavingMessage(true);
    await addDoc(collection(db, ...pullsPath(projectId, clientId), pull.id, "messages"), {
      text: trimmed,
      createdAt: serverTimestamp(),
      authorId: user?.uid || null,
      authorName: user?.displayName || user?.email || "Unknown",
      role,
    });
    setMessageText("");
    setSavingMessage(false);
  };

  const handleDownloadPdf = async () => {
    const blob = await pdf(<PullPDF pull={{ ...pull, items }} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pull.title || "pull"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const createdMillis = toMillis(pull.createdAt);
  const createdLabel = createdMillis ? new Date(createdMillis).toLocaleString() : "Unknown";

  return (
    <Modal open onClose={onClose} labelledBy="pull-details-title" contentClassName="max-w-3xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 id="pull-details-title" className="text-lg font-semibold">
                {pull.title || "Untitled pull"}
              </h2>
              <p className="text-xs text-slate-500">Created {createdLabel}</p>
            </div>
            <Button variant="secondary" onClick={handleDownloadPdf}>
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status</span>
              <select
                className="rounded border px-3 py-2 text-sm"
                value={pull.status || "draft"}
                onChange={handleStatusChange}
                disabled={!canManage}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-500">
              {items.length} line item{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      Qty {item.quantity}
                      {item.notes && ` · ${item.notes}`}
                    </div>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveItem(item.id)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {!items.length && <p className="text-xs text-slate-500">No items added yet.</p>}
            </div>
            {canManage && (
              <div className="rounded border border-dashed border-slate-300 p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="Item name"
                    value={newItem.name}
                    onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={newItem.quantity}
                    onChange={(event) => setNewItem((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                  <Input
                    placeholder="Notes (optional)"
                    value={newItem.notes}
                    onChange={(event) => setNewItem((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
                <Button size="sm" onClick={handleAddItem} disabled={savingItems}>
                  Add item
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Messages</h3>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded border border-slate-200 p-3">
              {messages.map((message) => {
                const timestampMillis = toMillis(message.createdAt);
                const timestamp = timestampMillis ? new Date(timestampMillis).toLocaleString() : "";
                return (
                  <div key={message.id} className="text-xs text-slate-700">
                    <span className="font-medium">{message.authorName || "Unknown"}</span>
                    <span className="text-slate-400"> · {message.role}</span>
                    {timestamp && <span className="text-slate-400"> · {timestamp}</span>}
                    <div className="text-slate-600">{message.text}</div>
                  </div>
                );
              })}
              {!messages.length && <p className="text-xs text-slate-500">No messages yet.</p>}
            </div>
            <div className="space-y-2">
              <textarea
                className="w-full rounded border border-slate-300 p-2 text-sm"
                rows={3}
                placeholder="Message the warehouse…"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSendMessage} disabled={savingMessage || !messageText.trim()}>
                  Send message
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
