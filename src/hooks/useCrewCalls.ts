import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { scheduleCrewCallPath, scheduleCrewCallsPath } from "../lib/paths";
import type { CrewCallSheet } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function normalizeCrewCall(crewMemberId: string, raw: any): CrewCallSheet {
  // Normalize offset direction to valid values or null
  const rawDirection = raw?.callOffsetDirection;
  const callOffsetDirection =
    rawDirection === "early" || rawDirection === "delay" ? rawDirection : null;
  // Normalize offset minutes to a finite number or null
  const rawMinutes = raw?.callOffsetMinutes;
  const callOffsetMinutes =
    typeof rawMinutes === "number" && Number.isFinite(rawMinutes) ? rawMinutes : null;

  return {
    crewMemberId,
    callTime: raw?.callTime ?? null,
    callText: raw?.callText ?? null,
    callOffsetDirection,
    callOffsetMinutes,
    wrapTime: raw?.wrapTime ?? null,
    wrapText: raw?.wrapText ?? null,
    notes: raw?.notes ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function useCrewCalls(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null
) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CrewCallSheet[]>([]);
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

    const ref = collection(db, ...scheduleCrewCallsPath(projectId, scheduleId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.docs.map((d) => normalizeCrewCall(d.id, d.data()));
        setCalls(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useCrewCalls] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  const callsByCrewMemberId = useMemo(() => new Map(calls.map((c) => [c.crewMemberId, c])), [calls]);

  const upsertCrewCall = useMutation({
    mutationFn: async ({
      crewMemberId,
      updates,
    }: {
      crewMemberId: string;
      updates: Partial<CrewCallSheet>;
    }) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!crewMemberId) throw new Error("Missing crewMemberId");
      if (isDemoModeActive()) return { crewMemberId, updates };

      const existed = callsByCrewMemberId.has(crewMemberId);
      const ref = doc(db, ...scheduleCrewCallPath(projectId, scheduleId, crewMemberId, clientId));
      await setDoc(
        ref,
        {
          ...updates,
          crewMemberId,
          ...(existed ? {} : { createdBy: user?.uid ?? null, createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { crewMemberId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update crew call");
      toast.error({ title: "Failed to update crew call", description: `${code}: ${message}` });
    },
  });

  const deleteCrewCall = useMutation({
    mutationFn: async (crewMemberId: string) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!crewMemberId) throw new Error("Missing crewMemberId");
      if (isDemoModeActive()) return { crewMemberId };
      await deleteDoc(doc(db, ...scheduleCrewCallPath(projectId, scheduleId, crewMemberId, clientId)));
      return { crewMemberId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete crew call");
      toast.error({ title: "Failed to delete crew call", description: `${code}: ${message}` });
    },
  });

  return {
    calls,
    callsByCrewMemberId,
    loading,
    error,
    upsertCrewCall,
    deleteCrewCall,
  };
}
