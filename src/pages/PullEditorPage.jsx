// src/pages/PullEditorPage.jsx
// Full-screen editor for a single pull with a larger canvas and inline workflows.

import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "../lib/demoSafeFirestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { pullsPath, productFamiliesPath, productFamilySkusPath } from "../lib/paths";
import {
  calculateItemFulfillment,
  sortPullItemsByGender,
  upsertPullItem,
} from "../lib/pullItems";
import { canFulfillPulls, canManagePulls } from "../lib/rbac";
import { toast } from "../lib/toast";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import PullItemEditor from "../components/pulls/PullItemEditor";
import PullItemsGrid from "../components/pulls/PullItemsGrid";
import BulkAddItemsModal from "../components/pulls/BulkAddItemsModal";
const PullExportModal = lazy(() => import("../components/pulls/PullExportModal"));
import PullShareModal from "../components/pulls/PullShareModal";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export default function PullEditorPage() {
  const { pullId } = useParams();
  const navigate = useNavigate();
  const { currentProjectId: projectId } = useProjectScope();
  const { clientId, role } = useAuth();
  const canManage = canManagePulls(role);
  const canFulfill = canFulfillPulls(role);

  const [pull, setPull] = useState(null);
  const [items, setItems] = useState([]);
  const [families, setFamilies] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [savingItems, setSavingItems] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef(null);
  const historyRef = useRef([]); // undo stack
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [bulkAddModalOpen, setBulkAddModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const familyDetailCacheRef = useRef(new Map());

  // Load pull
  useEffect(() => {
    if (!projectId || !clientId || !pullId) return;
    const ref = doc(db, ...pullsPath(projectId, clientId), pullId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        toast.error({ title: "Pull not found" });
        navigate("/pulls", { replace: true });
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setPull(data);
      const normalized = (data.items || []).map((it) => it);
      setItems(sortPullItemsByGender(normalized));
      setLoading(false);
    });
    return () => unsub();
  }, [projectId, clientId, pullId, navigate]);

  // Load families (for product editor)
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const familiesRef = collection(db, ...productFamiliesPath(clientId));
        const snapshot = await getDocs(familiesRef);
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("[PullEditorPage] Failed to load families", err);
      }
    })();
  }, [clientId]);

  const loadFamilyDetails = async (familyId) => {
    if (familyDetailCacheRef.current.has(familyId)) {
      return familyDetailCacheRef.current.get(familyId);
    }
    try {
      const skusPath = productFamilySkusPath(familyId, clientId);
      const snapshot = await getDocs(query(collection(db, ...skusPath), orderBy("colorName", "asc")));
      const colours = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const family = families.find((f) => f.id === familyId);
      const details = { colours, sizes: family?.sizes || [] };
      familyDetailCacheRef.current.set(familyId, details);
      return details;
    } catch (error) {
      console.error("[PullEditorPage] Failed to load family details", error);
      return { colours: [], sizes: [] };
    }
  };

  const handleStatusChange = async (event) => {
    if (!pull) return;
    const nextStatus = event.target.value;
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  };

  const handleEditItem = (item, index) => {
    setEditingItem(item);
    setEditingIndex(index);
    setItemEditorOpen(true);
  };

  const handleAddNewItem = () => {
    setEditingItem(null);
    setEditingIndex(null);
    setItemEditorOpen(true);
  };

  const applyItemsChange = (nextItems) => {
    historyRef.current = [...historyRef.current.slice(-19), items];
    setItems(nextItems);
    setDirty(true);
    scheduleSave(nextItems);
  };

  const scheduleSave = (itemsToSave) => {
    if (!pull) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSavingItems(true);
        await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
          items: itemsToSave,
          updatedAt: serverTimestamp(),
        });
        setDirty(false);
      } catch (error) {
        console.error("[PullEditorPage] Autosave failed", error);
        toast.error({ title: "Failed to autosave changes" });
      } finally {
        setSavingItems(false);
      }
    }, 500);
  };

  useEffect(() => () => saveTimerRef.current && clearTimeout(saveTimerRef.current), []);

  const handleSaveItem = async (item) => {
    if (!pull) return;
    const excludeId = editingItem?.id || null;
    const updated = upsertPullItem(items, item, { excludeId });
    const sorted = sortPullItemsByGender(updated);
    applyItemsChange(sorted);
    setEditingItem(null);
    setEditingIndex(null);
    setItemEditorOpen(false);
    toast.success({ title: editingIndex !== null ? "Item updated" : "Item added (merged)" });
  };

  const handleDeleteItem = async (index) => {
    if (!pull) return;
    const updated = items.filter((_, i) => i !== index);
    applyItemsChange(updated);
  };

  const handleToggleFulfillment = async (itemIndex, sizeIndex) => {
    if (!pull || !canFulfill) return;
    const item = items[itemIndex];
    const size = item.sizes[sizeIndex];
    const newFulfilled = (size.fulfilled || 0) >= (size.quantity || 0) ? 0 : (size.quantity || 0);
    const newStatus = newFulfilled >= (size.quantity || 0) ? "fulfilled" : "pending";
    const updatedItem = {
      ...item,
      sizes: item.sizes.map((s, idx) => (idx === sizeIndex ? { ...s, fulfilled: newFulfilled, status: newStatus } : s)),
    };
    updatedItem.fulfillmentStatus = calculateItemFulfillment(updatedItem);
    const next = items.map((it, idx) => (idx === itemIndex ? updatedItem : it));
    applyItemsChange(next);
  };

  const handleBulkAddItems = async (aggregatedItems) => {
    if (!pull) return;
    const sorted = sortPullItemsByGender(aggregatedItems);
    applyItemsChange(sorted);
    setBulkAddModalOpen(false);
  };

  // Undo (Cmd/Ctrl+Z)
  useEffect(() => {
    const onKey = (e) => {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z");
      if (!isUndo) return;
      const active = document.activeElement;
      const isTyping = active && ("value" in active || active.isContentEditable);
      if (isTyping) return;
      const prev = historyRef.current.pop();
      if (prev) {
        setItems(prev);
        setDirty(true);
        scheduleSave(prev);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleGenerateShareLink = async (token) => {
    if (!pull) return;
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      shareToken: token,
      shareEnabled: true,
      updatedAt: serverTimestamp(),
    });
  };

  const handleRevokeShareLink = async () => {
    if (!pull) return;
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      shareEnabled: false,
      updatedAt: serverTimestamp(),
    });
  };

  if (loading || !pull) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{pull.title || "Pull Editor"}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Edit your pull in a full-screen view</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {savingItems ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="secondary" onClick={() => setExportModalOpen(true)}>Export</Button>
          <Button variant="secondary" onClick={() => setShareModalOpen(true)}>Share</Button>
        </div>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium dark:text-slate-200">Status</span>
              <select
                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                value={pull.status || "draft"}
                onChange={handleStatusChange}
                disabled={!canManage}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="in-progress">In progress</option>
                <option value="fulfilled">Fulfilled</option>
              </select>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{items.length} line item{items.length === 1 ? "" : "s"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Line items</h3>
            {canManage && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setBulkAddModalOpen(true)}>
                  Bulk Add from Shots
                </Button>
                <Button size="sm" onClick={handleAddNewItem}>Add Item</Button>
              </div>
            )}
          </div>

          <PullItemsGrid
            items={items}
            onItemsChange={applyItemsChange}
            canManage={canManage}
            canFulfill={canFulfill}
            families={families}
            loadFamilyDetails={loadFamilyDetails}
          />
        </CardContent>
      </Card>

      {itemEditorOpen && canManage && (
        <PullItemEditor
          item={editingItem}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          onSave={handleSaveItem}
          onClose={() => {
            setEditingItem(null);
            setEditingIndex(null);
            setItemEditorOpen(false);
          }}
          canEdit={canManage}
        />
      )}

      {exportModalOpen && (
        <Suspense fallback={null}>
          <PullExportModal pull={{ ...pull, items }} onClose={() => setExportModalOpen(false)} />
        </Suspense>
      )}

      {shareModalOpen && (
        <PullShareModal
          pull={pull}
          onGenerateLink={handleGenerateShareLink}
          onRevokeLink={handleRevokeShareLink}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {bulkAddModalOpen && (
        <BulkAddItemsModal
          projectId={projectId}
          clientId={clientId}
          existingItems={items}
          onAddItems={handleBulkAddItems}
          onClose={() => setBulkAddModalOpen(false)}
        />
      )}
    </div>
  );
}
