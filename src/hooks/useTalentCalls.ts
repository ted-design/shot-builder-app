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
import { classifyCallsheetTimeInput } from "../lib/time/callsheetTimeEntry";

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeCallTimePair(
  updates: Partial<TalentCallSheet>,
  fieldLabel: string
): Partial<TalentCallSheet> {
  if (!hasOwn(updates as Record<string, unknown>, "callTime") && !hasOwn(updates as Record<string, unknown>, "callText")) {
    return updates;
  }

  const next: Partial<TalentCallSheet> = { ...updates };
  const rawCallTime = updates.callTime;
  const rawCallText = updates.callText;

  if (rawCallTime != null && String(rawCallTime).trim()) {
    const result = classifyCallsheetTimeInput(String(rawCallTime), { allowText: true });
    if (result.kind !== "time") {
      throw new Error(`Invalid ${fieldLabel}`);
    }
    next.callTime = result.canonical;
    next.callText = null;
    return next;
  }

  if (rawCallText != null && String(rawCallText).trim()) {
    const result = classifyCallsheetTimeInput(String(rawCallText), { allowText: true });
    if (result.kind === "invalid-time") {
      throw new Error(`Invalid ${fieldLabel}`);
    }
    if (result.kind === "time") {
      next.callTime = result.canonical;
      next.callText = null;
    } else {
      next.callTime = null;
      next.callText = result.text;
    }
    return next;
  }

  next.callTime = null;
  next.callText = null;
  return next;
}

function normalizeTimeOnlyField(
  updates: Partial<TalentCallSheet>,
  key: "setTime" | "wrapTime",
  fieldLabel: string
): Partial<TalentCallSheet> {
  if (!hasOwn(updates as Record<string, unknown>, key)) return updates;
  const next: Partial<TalentCallSheet> = { ...updates };
  const raw = updates[key];

  if (raw == null || !String(raw).trim()) {
    next[key] = null;
    return next;
  }

  const result = classifyCallsheetTimeInput(String(raw));
  if (result.kind !== "time") {
    throw new Error(`Invalid ${fieldLabel}`);
  }

  next[key] = result.canonical;
  return next;
}

function normalizeTalentCall(talentId: string, raw: any): TalentCallSheet {
  const callResult = classifyCallsheetTimeInput(String(raw?.callTime || "").trim(), { allowText: true });
  const rawCallText = raw?.callText != null ? String(raw.callText).trim() : "";
  const setResult = classifyCallsheetTimeInput(String(raw?.setTime || "").trim());
  const wrapResult = classifyCallsheetTimeInput(String(raw?.wrapTime || "").trim());

  return {
    talentId,
    callTime: callResult.kind === "time" ? callResult.canonical : null,
    callText: callResult.kind === "time" ? null : rawCallText || null,
    setTime: setResult.kind === "time" ? setResult.canonical : null,
    wrapTime: wrapResult.kind === "time" ? wrapResult.canonical : null,
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

      let normalizedUpdates: Partial<TalentCallSheet> = { ...updates };
      normalizedUpdates = normalizeCallTimePair(normalizedUpdates, "call time");
      normalizedUpdates = normalizeTimeOnlyField(normalizedUpdates, "setTime", "set time");
      normalizedUpdates = normalizeTimeOnlyField(normalizedUpdates, "wrapTime", "wrap time");

      const existed = callsByTalentId.has(talentId);
      const ref = doc(db, ...scheduleTalentCallPath(projectId, scheduleId, talentId, clientId));
      await setDoc(
        ref,
        {
          ...normalizedUpdates,
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
