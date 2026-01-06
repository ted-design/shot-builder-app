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
import { scheduleTalentCallPath, scheduleTalentCallsPath } from "../lib/paths";
import type { TalentCallSheet } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function normalizeTalentCall(talentId: string, raw: any): TalentCallSheet {
  return {
    talentId,
    callTime: raw?.callTime ?? null,
    callText: raw?.callText ?? null,
    setTime: raw?.setTime ?? null,
    wrapTime: raw?.wrapTime ?? null,
    role: raw?.role ?? null,
    blockRhs: raw?.blockRhs ?? null,
    muWard: raw?.muWard ?? null,
    status: raw?.status ?? null,
    transportation: raw?.transportation ?? null,
    notes: raw?.notes ?? null,
    colorCode: raw?.colorCode ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function useTalentCalls(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null
) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<TalentCallSheet[]>([]);
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

    const ref = collection(db, ...scheduleTalentCallsPath(projectId, scheduleId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.docs.map((d) => normalizeTalentCall(d.id, d.data()));
        setCalls(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useTalentCalls] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  const callsByTalentId = useMemo(() => new Map(calls.map((c) => [c.talentId, c])), [calls]);

  const upsertTalentCall = useMutation({
    mutationFn: async ({
      talentId,
      updates,
    }: {
      talentId: string;
      updates: Partial<TalentCallSheet>;
    }) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!talentId) throw new Error("Missing talentId");
      if (isDemoModeActive()) return { talentId, updates };

      const existed = callsByTalentId.has(talentId);
      const ref = doc(db, ...scheduleTalentCallPath(projectId, scheduleId, talentId, clientId));
      await setDoc(
        ref,
        {
          ...updates,
          talentId,
          ...(existed ? {} : { createdBy: user?.uid ?? null, createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { talentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update talent call");
      toast.error({ title: "Failed to update talent call", description: `${code}: ${message}` });
    },
  });

  const deleteTalentCall = useMutation({
    mutationFn: async (talentId: string) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (!talentId) throw new Error("Missing talentId");
      if (isDemoModeActive()) return { talentId };
      await deleteDoc(doc(db, ...scheduleTalentCallPath(projectId, scheduleId, talentId, clientId)));
      return { talentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete talent call");
      toast.error({ title: "Failed to delete talent call", description: `${code}: ${message}` });
    },
  });

  return {
    calls,
    callsByTalentId,
    loading,
    error,
    upsertTalentCall,
    deleteTalentCall,
  };
}
