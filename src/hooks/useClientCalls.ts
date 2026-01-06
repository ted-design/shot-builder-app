import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { scheduleClientCallPath, scheduleClientCallsPath } from "../lib/paths";
import type { ClientCallSheet } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function normalizeClientCall(id: string, raw: any): ClientCallSheet {
  return {
    id,
    name: raw?.name ?? "",
    role: raw?.role ?? null,
    callTime: raw?.callTime ?? null,
    callText: raw?.callText ?? null,
    setTime: raw?.setTime ?? null,
    status: raw?.status ?? null,
    transportation: raw?.transportation ?? null,
    blockRhs: raw?.blockRhs ?? null,
    muWard: raw?.muWard ?? null,
    notes: raw?.notes ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `client-call-${Date.now()}`;
}

export function useClientCalls(clientId: string | null, projectId: string | null, scheduleId: string | null) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<ClientCallSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setCalls([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = collection(db, ...scheduleClientCallsPath(projectId, scheduleId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.docs.map((d) => normalizeClientCall(d.id, d.data()));
        next.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        setCalls(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useClientCalls] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  const callsById = useMemo(() => new Map(calls.map((c) => [c.id, c])), [calls]);

  const createClientCall = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Missing name");
      const id = makeId();
      if (isDemoModeActive()) return { id };

      const ref = doc(db, ...scheduleClientCallPath(projectId, scheduleId, id, clientId));
      await setDoc(ref, {
        id,
        name: trimmed,
        createdBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to create client row");
      toast.error({ title: "Failed to create client row", description: `${code}: ${message}` });
    },
  });

  const upsertClientCall = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ClientCallSheet>;
    }) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!id) throw new Error("Missing id");
      if (isDemoModeActive()) return { id, updates };

      const existed = callsById.has(id);
      const ref = doc(db, ...scheduleClientCallPath(projectId, scheduleId, id, clientId));
      await setDoc(
        ref,
        {
          ...updates,
          id,
          ...(existed ? {} : { createdBy: user?.uid ?? null, createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update client row");
      toast.error({ title: "Failed to update client row", description: `${code}: ${message}` });
    },
  });

  const deleteClientCall = useMutation({
    mutationFn: async (id: string) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!id) throw new Error("Missing id");
      if (isDemoModeActive()) return { id };
      await deleteDoc(doc(db, ...scheduleClientCallPath(projectId, scheduleId, id, clientId)));
      return { id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete client row");
      toast.error({ title: "Failed to delete client row", description: `${code}: ${message}` });
    },
  });

  return {
    calls,
    callsById,
    loading,
    error,
    createClientCall,
    upsertClientCall,
    deleteClientCall,
  };
}

