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
import { classifyCallsheetTimeInput } from "../lib/time/callsheetTimeEntry";

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeCallTimePair(
  updates: Partial<CrewCallSheet>,
  fieldLabel: string
): Partial<CrewCallSheet> {
  if (!hasOwn(updates as Record<string, unknown>, "callTime") && !hasOwn(updates as Record<string, unknown>, "callText")) {
    return updates;
  }

  const next: Partial<CrewCallSheet> = { ...updates };
  const rawCallTime = updates.callTime;
  const rawCallText = updates.callText;

  if (rawCallTime != null && String(rawCallTime).trim()) {
    const result = classifyCallsheetTimeInput(String(rawCallTime), { allowText: true });
    if (result.kind !== "time") throw new Error(`Invalid ${fieldLabel}`);
    next.callTime = result.canonical;
    next.callText = null;
    return next;
  }

  if (rawCallText != null && String(rawCallText).trim()) {
    const result = classifyCallsheetTimeInput(String(rawCallText), { allowText: true });
    if (result.kind === "invalid-time") throw new Error(`Invalid ${fieldLabel}`);
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
  updates: Partial<CrewCallSheet>,
  key: "wrapTime",
  fieldLabel: string
): Partial<CrewCallSheet> {
  if (!hasOwn(updates as Record<string, unknown>, key)) return updates;
  const next: Partial<CrewCallSheet> = { ...updates };
  const raw = updates[key];

  if (raw == null || !String(raw).trim()) {
    next[key] = null;
    return next;
  }

  const result = classifyCallsheetTimeInput(String(raw));
  if (result.kind !== "time") throw new Error(`Invalid ${fieldLabel}`);
  next[key] = result.canonical;
  return next;
}

function normalizeCrewCall(crewMemberId: string, raw: any): CrewCallSheet {
  const callResult = classifyCallsheetTimeInput(String(raw?.callTime || "").trim(), { allowText: true });
  const rawCallText = raw?.callText != null ? String(raw.callText).trim() : "";
  const wrapResult = classifyCallsheetTimeInput(String(raw?.wrapTime || "").trim());
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
    callTime: callResult.kind === "time" ? callResult.canonical : null,
    callText: callResult.kind === "time" ? null : rawCallText || null,
    callOffsetDirection,
    callOffsetMinutes,
    wrapTime: wrapResult.kind === "time" ? wrapResult.canonical : null,
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

      let normalizedUpdates: Partial<CrewCallSheet> = { ...updates };
      normalizedUpdates = normalizeCallTimePair(normalizedUpdates, "crew call time");
      normalizedUpdates = normalizeTimeOnlyField(normalizedUpdates, "wrapTime", "wrap time");

      const existed = callsByCrewMemberId.has(crewMemberId);
      const ref = doc(db, ...scheduleCrewCallPath(projectId, scheduleId, crewMemberId, clientId));
      await setDoc(
        ref,
        {
          ...normalizedUpdates,
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
