// src/pages/PullPublicViewPage.jsx
//
// Public read-only view for shared pulls
// Accessible via /pulls/shared/:shareToken without authentication

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { validateShareToken } from "../lib/pullSharing";
import { normalizePullItem, sortPullItemsByGender, getPullItemDisplayName, getTotalQuantity } from "../lib/pullItems";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import PullItemsTable from "../components/pulls/PullItemsTable";

export default function PullPublicViewPage() {
  const { shareToken } = useParams();
  const [pull, setPull] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shareToken) {
      setError("No share token provided");
      setLoading(false);
      return;
    }

    const loadPull = async () => {
      setLoading(true);
      setError(null);

      try {
        // Search for pull with matching share token
        // We need to query across all clients and projects
        // This is a simplified version - in production, you'd optimize this
        const clientsRef = collection(db, "clients");
        const clientsSnapshot = await getDocs(clientsRef);

        let foundPull = null;

        for (const clientDoc of clientsSnapshot.docs) {
          if (foundPull) break;

          const projectsRef = collection(db, "clients", clientDoc.id, "projects");
          const projectsSnapshot = await getDocs(projectsRef);

          for (const projectDoc of projectsSnapshot.docs) {
            if (foundPull) break;

            const pullsRef = collection(
              db,
              "clients",
              clientDoc.id,
              "projects",
              projectDoc.id,
              "pulls"
            );

            const pullsQuery = query(
              pullsRef,
              where("shareToken", "==", shareToken),
              where("shareEnabled", "==", true)
            );

            const pullsSnapshot = await getDocs(pullsQuery);

            if (!pullsSnapshot.empty) {
              const pullDoc = pullsSnapshot.docs[0];
              foundPull = { id: pullDoc.id, ...pullDoc.data() };
              break;
            }
          }
        }

        if (!foundPull) {
          setError("Pull not found or link is invalid");
          setLoading(false);
          return;
        }

        // Validate the share token
        const validation = validateShareToken(shareToken, foundPull);
        if (!validation.valid) {
          setError(validation.reason || "Invalid share link");
          setLoading(false);
          return;
        }

        setPull(foundPull);
      } catch (err) {
        console.error("[PullPublicViewPage] Failed to load pull", err);
        setError("Failed to load pull");
      } finally {
        setLoading(false);
      }
    };

    loadPull();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold text-slate-900">Loading pull...</div>
          <div className="text-sm text-slate-600">Please wait</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!pull) {
    return null;
  }

  const items = (pull.items || []).map((item) => normalizePullItem(item));
  const sortedItems = sortPullItemsByGender(items);

  const createdDate = pull.createdAt
    ? new Date(
        pull.createdAt.seconds ? pull.createdAt.seconds * 1000 : pull.createdAt
      ).toLocaleDateString()
    : "Unknown";

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + getTotalQuantity(item), 0);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Shared View
            </span>
            <span className="text-xs text-slate-500">Read-only</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{pull.title || "Pull Sheet"}</h1>
          <div className="mt-1 flex gap-4 text-sm text-slate-600">
            <span>Created: {createdDate}</span>
            <span>•</span>
            <span>
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </span>
            <span>•</span>
            <span>Total Qty: {totalQuantity}</span>
          </div>
        </div>

        {/* Pull Items */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Line Items</h2>
          </CardHeader>
          <CardContent>
            <PullItemsTable items={sortedItems} canManage={false} canFulfill={false} canRequestChange={false} />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          This is a read-only view. Contact the pull creator to request changes.
        </div>
      </div>
    </div>
  );
}
