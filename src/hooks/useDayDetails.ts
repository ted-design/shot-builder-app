import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { scheduleDayDetailPath } from "../lib/paths";
import type { DayDetails } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function buildDefaultDayDetails(scheduleId: string): DayDetails {
  return {
    scheduleId,
    crewCallTime: "",
    shootingCallTime: "",
    estimatedWrap: "",
    breakfastTime: null,
    firstMealTime: null,
    secondMealTime: null,
    productionOffice: null,
    nearestHospital: null,
    parking: null,
    basecamp: null,
    weather: null,
    keyPeople: null,
    setMedic: null,
    scriptVersion: null,
    scheduleVersion: null,
    notes: null,
    createdAt: null,
    updatedAt: null,
    createdBy: null,
  };
}

export function useDayDetails(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null,
  detailId = "default"
) {
  const { user } = useAuth();
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setDetails(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, ...scheduleDayDetailPath(projectId, scheduleId, detailId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setDetails(null);
          setLoading(false);
          return;
        }
        const data = snap.data() || {};
        setDetails({
          ...buildDefaultDayDetails(scheduleId),
          ...data,
          scheduleId,
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          createdBy: data.createdBy ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[useDayDetails] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId, detailId]);

  const ensureDayDetails = useMutation({
    mutationFn: async () => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { id: detailId };
      const ref = doc(db, ...scheduleDayDetailPath(projectId, scheduleId, detailId, clientId));
      await setDoc(
        ref,
        {
          ...buildDefaultDayDetails(scheduleId),
          createdBy: user?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { id: detailId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to initialize day details");
      toast.error({ title: "Failed to init day details", description: `${code}: ${message}` });
    },
  });

  const updateDayDetails = useMutation({
    mutationFn: async (updates: Partial<Omit<DayDetails, "scheduleId">>) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { updates };
      const ref = doc(db, ...scheduleDayDetailPath(projectId, scheduleId, detailId, clientId));
      await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update day details");
      toast.error({ title: "Failed to update day details", description: `${code}: ${message}` });
    },
  });

  const resolved = useMemo(() => {
    if (details) return details;
    if (!scheduleId) return null;
    return buildDefaultDayDetails(scheduleId);
  }, [details, scheduleId]);

  return {
    dayDetails: resolved,
    hasRemoteDayDetails: Boolean(details),
    loading,
    error,
    ensureDayDetails,
    updateDayDetails,
  };
}

