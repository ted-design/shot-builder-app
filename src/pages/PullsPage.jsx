// PullsPage.jsx
//
// Presents project pull sheets with status tracking, PDF export, and a
// message thread so producers can coordinate with warehouse staff. The active
// project is resolved via ProjectScopeProvider so the view reacts when users
// switch campaigns from the dashboard.

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { showError, showConfirm } from "../lib/toast";
import { pullsPath, DEFAULT_PROJECT_ID, lanesPath, shotsPath, productFamiliesPath, productFamilySkusPath } from "../lib/paths";
import { createPullItemFromProduct, aggregatePullItems, normalizePullItem, sortPullItemsByGender, calculateItemFulfillment, getPullItemDisplayName } from "../lib/pullItems";
import { createPullSchema } from "../schemas/index.js";
import PullItemEditor from "../components/pulls/PullItemEditor";
import PullItemsTable from "../components/pulls/PullItemsTable";
import ChangeOrderModal from "../components/pulls/ChangeOrderModal";
import ChangeOrderReviewModal from "../components/pulls/ChangeOrderReviewModal";
import PullExportModal from "../components/pulls/PullExportModal";
import PullShareModal from "../components/pulls/PullShareModal";
import BulkAddItemsModal from "../components/pulls/BulkAddItemsModal";
import { useAuth } from "../context/AuthContext";
import { canManagePulls, canFulfillPulls, canRequestChangeOrders, canApproveChangeOrders, ROLE } from "../lib/rbac";
import { createChangeOrder, addChangeOrderToItem, approveChangeOrder, rejectChangeOrder, getAllPendingChangeOrders, countPendingChangeOrders } from "../lib/changeOrders";
import { pdf } from "@react-pdf/renderer";
import { PullPDF } from "../lib/pdfTemplates";
import { Modal } from "../components/ui/modal";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner, LoadingOverlay, LoadingSkeleton } from "../components/ui/LoadingSpinner";
import { EmptyState } from "../components/ui/EmptyState";
import { useProjectScope } from "../context/ProjectScopeContext";
import { toast } from "../lib/toast";
import { FileText, MapPin } from "lucide-react";
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
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [loadingPulls, setLoadingPulls] = useState(true);
  const [creatingPull, setCreatingPull] = useState(false);
  const navigate = useNavigate();
  const { currentProjectId, ready: scopeReady, setLastVisitedPath } = useProjectScope();
  const redirectNotifiedRef = useRef(false);
  const projectId = currentProjectId;
  const { clientId, role: globalRole, user: authUser } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManagePulls(role);

  useEffect(() => {
    setLastVisitedPath("/pulls");
  }, [setLastVisitedPath]);

  useEffect(() => {
    if (!scopeReady) return;
    if (!projectId) {
      if (!redirectNotifiedRef.current) {
        redirectNotifiedRef.current = true;
        toast.info({ title: "Please select a project" });
      }
      navigate("/projects", { replace: true });
      return;
    }
    redirectNotifiedRef.current = false;
  }, [scopeReady, projectId, navigate]);

  // Whenever the project ID changes, subscribe to the appropriate pulls
  // collection and update our state when the data changes.  The path is
  // derived from pullsPath(projectId), which returns an array of path
  // segments.  We include orderBy('createdAt') to preserve ordering.
  useEffect(() => {
    if (!scopeReady || !projectId || !clientId) {
      setPulls([]);
      setLoadingPulls(false);
      return undefined;
    }
    setLoadingPulls(true);
    const pathSegments = pullsPath(projectId, clientId);
    const q = query(collection(db, ...pathSegments), orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPulls(
        snapshot.docs.map((docSnap) =>
          normalisePullRecord(docSnap.id, docSnap.data(), projectId)
        )
      );
      setLoadingPulls(false);
    });
    return () => unsubscribe();
  }, [scopeReady, projectId, clientId]);

  // Add a new pull to the current project's pulls collection.  We call
  // serverTimestamp() to populate the createdAt field so that ordering works.
  async function handleAddPull() {
    if (!canManage) {
      toast.error({ title: "You do not have permission to create pulls" });
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error({ title: "Please enter a pull title" });
      return;
    }
    if (!projectId) {
      toast.info({ title: "Select a project before creating pulls" });
      return;
    }

    // Validate pull data
    const pullData = {
      title: trimmed,
      name: trimmed,
      projectId: projectId || DEFAULT_PROJECT_ID,
      status: "draft",
      items: [],
      shotIds: [],
    };

    try {
      createPullSchema.parse(pullData);
    } catch (error) {
      toast.error({
        title: "Invalid pull data",
        description: error.errors.map(e => e.message).join(", ")
      });
      return;
    }

    setCreatingPull(true);
    try {
      const pathSegments = pullsPath(projectId, clientId);
      await addDoc(collection(db, ...pathSegments), {
        ...pullData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle("");
      toast.success({ title: "Pull created successfully" });
    } catch (error) {
      console.error("[PullsPage] Failed to create pull", error);
      toast.error({
        title: "Failed to create pull",
        description: "Please try again or contact support if the issue persists"
      });
    } finally {
      setCreatingPull(false);
    }
  }

  // Update an existing pull's title.  You can extend this function to
  // support other fields as needed.
  async function handleUpdateTitle(id, newTitle) {
    if (!canManage) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    if (!projectId) {
      toast.info({ title: "No project selected" });
      return;
    }
    const pathSegments = pullsPath(projectId, clientId);
    const docRef = doc(db, ...pathSegments, id);
    await updateDoc(docRef, {
      title: trimmed,
      name: trimmed,
      updatedAt: serverTimestamp(),
    });
  }

  // Delete a pull
  async function handleDeletePull(id, pullTitle) {
    if (!canManage) {
      showError("You do not have permission to delete pulls.");
      return;
    }
    const confirmed = await showConfirm(`Delete pull "${pullTitle}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    if (!projectId) {
      toast.info({ title: "No project selected" });
      return;
    }
    try {
      const pathSegments = pullsPath(projectId, clientId);
      const docRef = doc(db, ...pathSegments, id);
      await deleteDoc(docRef);
      toast.success({ title: "Pull deleted" });
    } catch (error) {
      console.error("[PullsPage] Failed to delete pull", error);
      toast.error({ title: "Failed to delete pull" });
    }
  }

  // Duplicate a pull
  async function handleDuplicatePull(sourcePull) {
    if (!canManage) {
      toast.error({ title: "You do not have permission to duplicate pulls" });
      return;
    }
    if (!projectId) {
      toast.info({ title: "No project selected" });
      return;
    }

    try {
      const pathSegments = pullsPath(projectId, clientId);
      const newTitle = `Copy of ${sourcePull.title || "Untitled pull"}`;

      await addDoc(collection(db, ...pathSegments), {
        title: newTitle,
        name: newTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "draft", // Always start as draft
        items: sourcePull.items || [],
        shotIds: sourcePull.shotIds || [],
        projectId: projectId || DEFAULT_PROJECT_ID,
        sortOrder: sourcePull.sortOrder || "gender",
      });

      toast.success({
        title: "Pull duplicated",
        description: `Created "${newTitle}"`
      });
    } catch (error) {
      console.error("[PullsPage] Failed to duplicate pull", error);
      toast.error({
        title: "Failed to duplicate pull",
        description: "Please try again or contact support if the issue persists"
      });
    }
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
        <CardContent className="flex flex-col gap-3">
          {canManage ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  className="sm:flex-1"
                  placeholder="New pull title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Button onClick={handleAddPull} disabled={creatingPull}>
                  {creatingPull ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Blank Pull"
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-500">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <Button variant="secondary" onClick={() => setShowAutoGenerateModal(true)}>
                Auto-generate from Planner Lanes
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Pulls are read-only for your role. Producers or warehouse staff can create and update them.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="space-y-3">
        {loadingPulls ? (
          // Loading skeleton
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <LoadingSkeleton className="h-5 w-48" />
                    <LoadingSkeleton className="h-4 w-64" />
                  </div>
                  <div className="flex gap-2">
                    <LoadingSkeleton className="h-9 w-24" />
                    <LoadingSkeleton className="h-9 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : pulls.length === 0 ? (
          // Empty state
          <EmptyState
            icon={FileText}
            title="No pulls yet"
            description="Create your first pull sheet to start aggregating products for shoots. You can create a blank pull or auto-generate one from your planner lanes."
            action={canManage ? () => setShowAutoGenerateModal(true) : null}
            actionLabel="Auto-generate from Planner"
          />
        ) : (
          // Pulls list
          pulls.map((pull) => {
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
                    <Button size="sm" variant="secondary" onClick={() => setActivePull(pull)}>
                      Open details
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicatePull(pull)}
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = prompt("Rename pull", pull.title || "");
                            if (!next || next.trim() === (pull.title || "")) return;
                            handleUpdateTitle(pull.id, next);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePull(pull.id, pull.title || "Untitled pull")}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
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
      {showAutoGenerateModal && (
        <AutoGeneratePullModal
          projectId={projectId}
          clientId={clientId}
          onClose={() => setShowAutoGenerateModal(false)}
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

function AutoGeneratePullModal({ projectId, clientId, onClose }) {
  const [lanes, setLanes] = useState([]);
  const [shots, setShots] = useState([]);
  const [families, setFamilies] = useState([]);
  const [selectedLanes, setSelectedLanes] = useState(new Set());
  const [pullTitle, setPullTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!projectId || !clientId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load lanes
        const lanesRef = collection(db, ...lanesPath(projectId, clientId));
        const lanesQuery = query(lanesRef, orderBy("order", "asc"));
        const lanesSnapshot = await getDocs(lanesQuery);
        const loadedLanes = lanesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setLanes(loadedLanes);

        // Load shots for this project
        const shotsRef = collection(db, ...shotsPath(clientId));
        const shotsQuery = query(shotsRef, where("projectId", "==", projectId));
        const shotsSnapshot = await getDocs(shotsQuery);
        const loadedShots = shotsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setShots(loadedShots);

        // Load product families for gender/category data
        const familiesRef = collection(db, ...productFamiliesPath(clientId));
        const familiesSnapshot = await getDocs(familiesRef);
        const loadedFamilies = familiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFamilies(loadedFamilies);
      } catch (error) {
        console.error("[AutoGeneratePullModal] Failed to load data", error);
        toast.error({ title: "Failed to load planner data" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, clientId]);

  const toggleLane = (laneId) => {
    setSelectedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLanes.size === lanes.length) {
      setSelectedLanes(new Set());
    } else {
      setSelectedLanes(new Set(lanes.map((lane) => lane.id)));
    }
  };

  const handleCreate = async () => {
    if (!pullTitle.trim()) {
      toast.error({ title: "Please enter a pull title" });
      return;
    }

    if (selectedLanes.size === 0) {
      toast.error({ title: "Please select at least one lane" });
      return;
    }

    setCreating(true);
    try {
      // Filter shots by selected lanes
      const filteredShots = shots.filter((shot) => selectedLanes.has(shot.laneId));

      // Build family lookup map
      const familyMap = new Map();
      families.forEach((family) => {
        familyMap.set(family.id, family);
      });

      // Extract products from shots and create pull items
      const tempItems = [];
      filteredShots.forEach((shot) => {
        if (Array.isArray(shot.products)) {
          shot.products.forEach((product) => {
            const familyId = product.familyId || product.productId;
            const family = familyMap.get(familyId);
            const pullItem = createPullItemFromProduct(product, family, [shot.id]);
            tempItems.push(pullItem);
          });
        }
      });

      // Aggregate items by product+colour (Option A - Full Aggregation)
      const items = aggregatePullItems(tempItems);

      // Create the pull with new schema
      const pathSegments = pullsPath(projectId, clientId);
      await addDoc(collection(db, ...pathSegments), {
        title: pullTitle.trim(),
        name: pullTitle.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "draft",
        items,
        shotIds: filteredShots.map((shot) => shot.id),
        projectId: projectId || DEFAULT_PROJECT_ID,
        sortOrder: "gender", // Default sort by gender
      });

      toast.success({ title: "Pull created from planner lanes" });
      onClose();
    } catch (error) {
      console.error("[AutoGeneratePullModal] Failed to create pull", error);
      toast.error({ title: "Failed to create pull" });
    } finally {
      setCreating(false);
    }
  };

  const shotsByLane = lanes.map((lane) => ({
    lane,
    shotCount: shots.filter((shot) => shot.laneId === lane.id).length,
  }));

  return (
    <Modal open onClose={onClose} labelledBy="auto-generate-title" contentClassName="max-w-2xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="auto-generate-title" className="text-lg font-semibold">
            Auto-generate Pull from Planner
          </h2>
          <p className="text-sm text-slate-600">
            Select which lanes to include. Products from shots in those lanes will be aggregated into the pull.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="pull-title" className="text-sm font-medium text-slate-700">
              Pull Title
            </label>
            <Input
              id="pull-title"
              placeholder="e.g., September 19th - v1.0"
              value={pullTitle}
              onChange={(e) => setPullTitle(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Select Lanes</span>
              {lanes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedLanes.size === lanes.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>

            {loading ? (
              <LoadingOverlay message="Loading planner lanes..." />
            ) : lanes.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No lanes in planner"
                description="Create lanes in your planner first to use auto-generation. Lanes help organize your shots for production."
              />
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {shotsByLane.map(({ lane, shotCount }) => (
                  <label
                    key={lane.id}
                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedLanes.has(lane.id)}
                        onChange={() => toggleLane(lane.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-slate-900">
                        {lane.name || "Untitled lane"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {shotCount} shot{shotCount === 1 ? "" : "s"}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading || creating || lanes.length === 0}>
              {creating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating pull...
                </>
              ) : (
                "Create Pull"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}

function PullDetailsModal({ pull, projectId, clientId, onClose, canManage, role, user }) {
  const [items, setItems] = useState([]);
  const [families, setFamilies] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);

  // Change order state
  const [changeOrderModalOpen, setChangeOrderModalOpen] = useState(false);
  const [changeOrderItem, setChangeOrderItem] = useState(null);
  const [changeOrderItemIndex, setChangeOrderItemIndex] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewingChangeOrder, setReviewingChangeOrder] = useState(null);

  // Export and share state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Bulk add state
  const [bulkAddModalOpen, setBulkAddModalOpen] = useState(false);

  // Family details cache
  const familyDetailCacheRef = useRef(new Map());

  // Permissions
  const canFulfill = canFulfillPulls(role);
  const canRequestChange = canRequestChangeOrders(role);
  const canApprove = canApproveChangeOrders(role);

  // Normalize items on load
  useEffect(() => {
    const normalized = (pull.items || []).map((item) => normalizePullItem(item));
    const sorted = sortPullItemsByGender(normalized);
    setItems(sorted);
  }, [pull.items]);

  // Load product families for item editor
  useEffect(() => {
    if (!clientId) return;
    const loadFamilies = async () => {
      try {
        const familiesRef = collection(db, ...productFamiliesPath(clientId));
        const snapshot = await getDocs(familiesRef);
        setFamilies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("[PullDetailsModal] Failed to load families", error);
      }
    };
    loadFamilies();
  }, [clientId]);

  // Batch load all SKUs for families in this pull to prevent N+1 queries
  useEffect(() => {
    if (!clientId || families.length === 0 || items.length === 0) return;

    const batchLoadFamilyDetails = async () => {
      // Extract unique family IDs from items
      const familyIds = new Set();
      items.forEach((item) => {
        if (item.familyId) {
          familyIds.add(item.familyId);
        }
      });

      // Load SKUs for all families in parallel
      const loadPromises = Array.from(familyIds).map(async (familyId) => {
        // Skip if already cached
        if (familyDetailCacheRef.current.has(familyId)) {
          return;
        }

        try {
          const skusPath = productFamilySkusPath(familyId, clientId);
          const snapshot = await getDocs(
            query(collection(db, ...skusPath), orderBy("colorName", "asc"))
          );
          const colours = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          const family = families.find((f) => f.id === familyId);
          const details = {
            colours,
            sizes: family?.sizes || [],
          };

          // Cache the result
          familyDetailCacheRef.current.set(familyId, details);
        } catch (error) {
          console.error(`[PullDetailsModal] Failed to load details for family ${familyId}`, error);
        }
      });

      await Promise.all(loadPromises);
    };

    batchLoadFamilyDetails();
  }, [clientId, families, items]);

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

  const loadFamilyDetails = async (familyId) => {
    // Check cache first
    if (familyDetailCacheRef.current.has(familyId)) {
      return familyDetailCacheRef.current.get(familyId);
    }

    // Load SKUs (colorways) from Firestore
    try {
      const skusPath = productFamilySkusPath(familyId, clientId);
      const snapshot = await getDocs(
        query(collection(db, ...skusPath), orderBy("colorName", "asc"))
      );
      const colours = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Get sizes from the family
      const family = families.find((f) => f.id === familyId);
      const details = {
        colours,
        sizes: family?.sizes || [],
      };

      // Cache the result
      familyDetailCacheRef.current.set(familyId, details);
      return details;
    } catch (error) {
      console.error("[PullDetailsModal] Failed to load family details", error);
      return { colours: [], sizes: [] };
    }
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

  const handleSaveItem = async (item) => {
    let updated;
    if (editingIndex !== null) {
      // Update existing item
      updated = items.map((existingItem, idx) =>
        idx === editingIndex ? item : existingItem
      );
    } else {
      // Add new item
      updated = [...items, item];
    }

    // Sort by gender before saving
    const sorted = sortPullItemsByGender(updated);
    setItems(sorted);
    setSavingItems(true);

    try {
      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: sorted,
        updatedAt: serverTimestamp(),
      });
      setEditingItem(null);
      setEditingIndex(null);
      setItemEditorOpen(false);
      toast.success({ title: editingIndex !== null ? "Item updated" : "Item added" });
    } catch (error) {
      console.error("[PullDetailsModal] Failed to save item", error);
      toast.error({ title: "Failed to save item" });
    } finally {
      setSavingItems(false);
    }
  };

  const handleDeleteItem = async (index) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    setSavingItems(true);

    try {
      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: updated,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[PullDetailsModal] Failed to delete item", error);
      toast.error({ title: "Failed to delete item" });
    } finally {
      setSavingItems(false);
    }
  };

  // Fulfillment handler
  const handleToggleFulfillment = async (itemIndex, sizeIndex) => {
    if (!canFulfill) return;

    const item = items[itemIndex];
    const size = item.sizes[sizeIndex];

    // Toggle: if fulfilled >= quantity, set to 0, otherwise set to quantity
    const newFulfilled = size.fulfilled >= size.quantity ? 0 : size.quantity;
    const newStatus = newFulfilled >= size.quantity ? "fulfilled" : "pending";

    const updatedItem = {
      ...item,
      sizes: item.sizes.map((s, idx) =>
        idx === sizeIndex
          ? { ...s, fulfilled: newFulfilled, status: newStatus }
          : s
      ),
    };

    // Recalculate overall fulfillment status
    updatedItem.fulfillmentStatus = calculateItemFulfillment(updatedItem);

    const updatedItems = items.map((it, idx) => (idx === itemIndex ? updatedItem : it));
    setItems(updatedItems);
    setSavingItems(true);

    try {
      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[PullDetailsModal] Failed to update fulfillment", error);
      toast.error({ title: "Failed to update fulfillment" });
    } finally {
      setSavingItems(false);
    }
  };

  // Change order handlers
  const handleRequestChange = (item, index) => {
    setChangeOrderItem(item);
    setChangeOrderItemIndex(index);
    setChangeOrderModalOpen(true);
  };

  const handleSubmitChangeOrder = async ({ substitution, reason }) => {
    if (!user) return;

    const changeOrderData = createChangeOrder({
      substitution,
      reason,
      userId: user.uid,
      userName: user.displayName || user.email || "Unknown",
    });

    const updatedItem = addChangeOrderToItem(changeOrderItem, changeOrderData);
    const updatedItems = items.map((it, idx) =>
      idx === changeOrderItemIndex ? updatedItem : it
    );

    setItems(updatedItems);
    setSavingItems(true);

    try {
      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });

      toast.success({ title: "Change request submitted" });
      setChangeOrderModalOpen(false);
      setChangeOrderItem(null);
      setChangeOrderItemIndex(null);
    } catch (error) {
      console.error("[PullDetailsModal] Failed to submit change order", error);
      toast.error({ title: "Failed to submit change request" });
    } finally {
      setSavingItems(false);
    }
  };

  const handleApproveChangeOrder = async (changeOrderId) => {
    if (!user || !reviewingItem) return;

    try {
      const updatedItem = approveChangeOrder(
        reviewingItem,
        changeOrderId,
        user.uid,
        user.displayName || user.email || "Unknown"
      );

      const updatedItems = items.map((it) =>
        it.id === reviewingItem.id ? updatedItem : it
      );

      // Sort after updating
      const sorted = sortPullItemsByGender(updatedItems);
      setItems(sorted);
      setSavingItems(true);

      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: sorted,
        updatedAt: serverTimestamp(),
      });

      toast.success({ title: "Change order approved" });
      setReviewModalOpen(false);
      setReviewingItem(null);
      setReviewingChangeOrder(null);
    } catch (error) {
      console.error("[PullDetailsModal] Failed to approve change order", error);
      toast.error({ title: error.message || "Failed to approve change order" });
    } finally {
      setSavingItems(false);
    }
  };

  const handleRejectChangeOrder = async (changeOrderId, reason) => {
    if (!user || !reviewingItem) return;

    try {
      const updatedItem = rejectChangeOrder(
        reviewingItem,
        changeOrderId,
        reason,
        user.uid,
        user.displayName || user.email || "Unknown"
      );

      const updatedItems = items.map((it) =>
        it.id === reviewingItem.id ? updatedItem : it
      );

      setItems(updatedItems);
      setSavingItems(true);

      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });

      toast.success({ title: "Change order rejected" });
      setReviewModalOpen(false);
      setReviewingItem(null);
      setReviewingChangeOrder(null);
    } catch (error) {
      console.error("[PullDetailsModal] Failed to reject change order", error);
      toast.error({ title: error.message || "Failed to reject change order" });
    } finally {
      setSavingItems(false);
    }
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

  const handleBulkAddItems = async (aggregatedItems) => {
    const sorted = sortPullItemsByGender(aggregatedItems);
    setItems(sorted);
    setSavingItems(true);

    try {
      await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
        items: sorted,
        updatedAt: serverTimestamp(),
      });
      setBulkAddModalOpen(false);
    } catch (error) {
      console.error("[PullDetailsModal] Failed to add items", error);
      toast.error({ title: "Failed to save items" });
    } finally {
      setSavingItems(false);
    }
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

  const handleGenerateShareLink = async (token) => {
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      shareToken: token,
      shareEnabled: true,
      updatedAt: serverTimestamp(),
    });
  };

  const handleRevokeShareLink = async () => {
    await updateDoc(doc(db, ...pullsPath(projectId, clientId), pull.id), {
      shareEnabled: false,
      updatedAt: serverTimestamp(),
    });
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
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setExportModalOpen(true)}>
                Export
              </Button>
              <Button variant="secondary" onClick={() => setShareModalOpen(true)}>
                Share
              </Button>
            </div>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setBulkAddModalOpen(true)}>
                    Bulk Add from Shots
                  </Button>
                  <Button size="sm" onClick={() => handleAddNewItem()}>
                    Add Item
                  </Button>
                </div>
              )}
            </div>

            <PullItemsTable
              items={items}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onRequestChange={handleRequestChange}
              onToggleFulfillment={handleToggleFulfillment}
              canManage={canManage}
              canFulfill={canFulfill}
              canRequestChange={canRequestChange}
            />
          </div>

          {/* Pending Change Orders Section */}
          {canApprove && (() => {
            const pendingOrders = getAllPendingChangeOrders(items);
            if (pendingOrders.length === 0) return null;

            return (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  Pending Change Requests
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {countPendingChangeOrders(items)}
                  </span>
                </h3>
                <div className="space-y-2">
                  {pendingOrders.map(({ item, changeOrders }) =>
                    changeOrders.map((co) => (
                      <div
                        key={co.id}
                        className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium text-amber-900">
                              {getPullItemDisplayName(item)}
                            </div>
                            <div className="text-xs text-amber-700">
                              Requested by {co.requestedByName || "Unknown"}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setReviewingItem(item);
                              setReviewingChangeOrder(co);
                              setReviewModalOpen(true);
                            }}
                          >
                            Review
                          </Button>
                        </div>
                        <p className="text-xs text-amber-800">{co.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Messages</h3>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded border border-slate-200 p-3">
              {messages.map((message) => {
                const timestampMillis = toMillis(message.createdAt);
                const timestamp = timestampMillis ? new Date(timestampMillis).toLocaleString() : "";
                return (
                  <div key={message.id} className="text-xs text-slate-700">
                    <span className="font-medium">{message.authorName || "Unknown"}</span>
                    <span className="text-slate-500"> · {message.role}</span>
                    {timestamp && <span className="text-slate-500"> · {timestamp}</span>}
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

      {/* Pull Item Editor Modal */}
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

      {/* Change Order Request Modal */}
      {changeOrderModalOpen && changeOrderItem && (
        <ChangeOrderModal
          originalItem={changeOrderItem}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          onSubmit={handleSubmitChangeOrder}
          onClose={() => {
            setChangeOrderModalOpen(false);
            setChangeOrderItem(null);
            setChangeOrderItemIndex(null);
          }}
        />
      )}

      {/* Change Order Review Modal */}
      {reviewModalOpen && reviewingItem && reviewingChangeOrder && (
        <ChangeOrderReviewModal
          item={reviewingItem}
          changeOrder={reviewingChangeOrder}
          onApprove={handleApproveChangeOrder}
          onReject={handleRejectChangeOrder}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewingItem(null);
            setReviewingChangeOrder(null);
          }}
        />
      )}

      {/* Export Modal */}
      {exportModalOpen && (
        <PullExportModal
          pull={{ ...pull, items }}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <PullShareModal
          pull={pull}
          onGenerateLink={handleGenerateShareLink}
          onRevokeLink={handleRevokeShareLink}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* Bulk Add Items Modal */}
      {bulkAddModalOpen && (
        <BulkAddItemsModal
          projectId={projectId}
          clientId={clientId}
          existingItems={items}
          onAddItems={handleBulkAddItems}
          onClose={() => setBulkAddModalOpen(false)}
        />
      )}
    </Modal>
  );
}
