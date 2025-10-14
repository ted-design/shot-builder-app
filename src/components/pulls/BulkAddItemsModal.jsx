// src/components/pulls/BulkAddItemsModal.jsx
//
// Modal for bulk adding items from shots to an existing pull

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { shotsPath, lanesPath, productFamiliesPath } from "../../lib/paths";
import { createPullItemFromProduct, aggregatePullItems } from "../../lib/pullItems";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { LoadingOverlay, LoadingSpinner } from "../ui/LoadingSpinner";
import { EmptyState } from "../ui/EmptyState";
import { toast } from "../../lib/toast";

export default function BulkAddItemsModal({
  projectId,
  clientId,
  existingItems,
  onAddItems,
  onClose,
}) {
  const [lanes, setLanes] = useState([]);
  const [shots, setShots] = useState([]);
  const [families, setFamilies] = useState([]);
  const [selectedShots, setSelectedShots] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!projectId || !clientId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load lanes for organization
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

        // Load product families for metadata
        const familiesRef = collection(db, ...productFamiliesPath(clientId));
        const familiesSnapshot = await getDocs(familiesRef);
        const loadedFamilies = familiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFamilies(loadedFamilies);
      } catch (error) {
        console.error("[BulkAddItemsModal] Failed to load data", error);
        toast.error({ title: "Failed to load shots" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, clientId]);

  const toggleShot = (shotId) => {
    setSelectedShots((prev) => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  };

  const toggleLane = (laneId) => {
    const laneShots = shots.filter((shot) => shot.laneId === laneId).map((s) => s.id);
    setSelectedShots((prev) => {
      const next = new Set(prev);
      const allSelected = laneShots.every((id) => next.has(id));

      if (allSelected) {
        // Deselect all shots in this lane
        laneShots.forEach((id) => next.delete(id));
      } else {
        // Select all shots in this lane
        laneShots.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedShots.size === shots.length) {
      setSelectedShots(new Set());
    } else {
      setSelectedShots(new Set(shots.map((shot) => shot.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedShots.size === 0) {
      toast.error({ title: "Please select at least one shot" });
      return;
    }

    setAdding(true);
    try {
      // Filter selected shots
      const filteredShots = shots.filter((shot) => selectedShots.has(shot.id));

      // Build family lookup map
      const familyMap = new Map();
      families.forEach((family) => {
        familyMap.set(family.id, family);
      });

      // Extract products from shots and create pull items
      const newItems = [];
      filteredShots.forEach((shot) => {
        if (Array.isArray(shot.products)) {
          shot.products.forEach((product) => {
            const familyId = product.familyId || product.productId;
            const family = familyMap.get(familyId);
            const pullItem = createPullItemFromProduct(product, family, [shot.id]);
            newItems.push(pullItem);
          });
        }
      });

      if (newItems.length === 0) {
        toast.info({ title: "No products found in selected shots" });
        setAdding(false);
        return;
      }

      // Aggregate with existing items
      const allItems = [...existingItems, ...newItems];
      const aggregated = aggregatePullItems(allItems);

      onAddItems(aggregated);
      toast.success({
        title: "Items added",
        description: `Added products from ${selectedShots.size} shot${selectedShots.size === 1 ? "" : "s"}`
      });
      onClose();
    } catch (error) {
      console.error("[BulkAddItemsModal] Failed to add items", error);
      toast.error({ title: "Failed to add items" });
    } finally {
      setAdding(false);
    }
  };

  // Group shots by lane
  const shotsByLane = lanes.map((lane) => ({
    lane,
    shots: shots.filter((shot) => shot.laneId === lane.id),
  }));

  const unassignedShots = shots.filter((shot) => !shot.laneId);

  return (
    <Modal open onClose={onClose} labelledBy="bulk-add-title" contentClassName="max-w-3xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="bulk-add-title" className="text-lg font-semibold">
            Bulk Add Items from Shots
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select shots to add all their products to this pull at once. Products will be aggregated automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <LoadingOverlay message="Loading shots..." />
          ) : shots.length === 0 ? (
            <EmptyState
              icon="🎬"
              title="No shots in project"
              description="Create shots with products first to use bulk add."
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedShots.size} shot{selectedShots.size === 1 ? "" : "s"} selected
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedShots.size === shots.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="max-h-96 space-y-4 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                {/* Shots grouped by lane */}
                {shotsByLane.map(({ lane, shots: laneShots }) => {
                  if (laneShots.length === 0) return null;
                  const allSelected = laneShots.every((shot) => selectedShots.has(shot.id));

                  return (
                    <div key={lane.id} className="space-y-2">
                      <div className="flex items-center justify-between rounded-md bg-slate-50 dark:bg-slate-900 px-3 py-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleLane(lane.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {lane.name || "Untitled lane"}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({laneShots.length} shot{laneShots.length === 1 ? "" : "s"})
                          </span>
                        </label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {laneShots.map((shot) => {
                          const productCount = shot.products?.length || 0;
                          return (
                            <label
                              key={shot.id}
                              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedShots.has(shot.id)}
                                  onChange={() => toggleShot(shot.id)}
                                  className="h-4 w-4"
                                />
                                <div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {shot.title || "Untitled shot"}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {productCount} product{productCount === 1 ? "" : "s"}
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Unassigned shots */}
                {unassignedShots.length > 0 && (
                  <div className="space-y-2">
                    <div className="rounded-md bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Unassigned Shots
                      </span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {unassignedShots.map((shot) => {
                        const productCount = shot.products?.length || 0;
                        return (
                          <label
                            key={shot.id}
                            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedShots.has(shot.id)}
                                onChange={() => toggleShot(shot.id)}
                                className="h-4 w-4"
                              />
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {shot.title || "Untitled shot"}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {productCount} product{productCount === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={loading || adding || shots.length === 0}>
              {adding ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Adding items...
                </>
              ) : (
                `Add Items from ${selectedShots.size} Shot${selectedShots.size === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
