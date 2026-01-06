import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { crewMemberPath, crewPath } from "../lib/paths";
import type { CrewMember } from "../types/crew";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function normalizeCrewMember(id: string, raw: any): CrewMember {
  return {
    id,
    firstName: raw?.firstName ?? "",
    lastName: raw?.lastName ?? "",
    email: raw?.email ?? null,
    phone: raw?.phone ?? null,
    positionId: raw?.positionId ?? null,
    departmentId: raw?.departmentId ?? null,
    company: raw?.company ?? null,
    notes: raw?.notes ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function useOrganizationCrew(clientId: string | null) {
  const { user } = useAuth();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId) {
      setCrew([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = collection(db, ...crewPath(clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.docs.map((d) => normalizeCrewMember(d.id, d.data()));
        next.sort((a, b) => {
          const aKey = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
          const bKey = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
          return aKey.localeCompare(bKey);
        });
        setCrew(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useOrganizationCrew] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [clientId]);

  const createCrewMember = useMutation({
    mutationFn: async (input: Omit<CrewMember, "id" | "createdAt" | "updatedAt">) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { id: `demo-crew-${Date.now()}`, ...input };

      const ref = collection(db, ...crewPath(clientId));
      const docRef = await addDoc(ref, {
        ...input,
        firstName: input.firstName?.trim?.() ?? "",
        lastName: input.lastName?.trim?.() ?? "",
        email: input.email?.trim?.() ?? null,
        phone: input.phone?.trim?.() ?? null,
        createdBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to create crew member");
      toast.error({ title: "Failed to create crew member", description: `${code}: ${message}` });
    },
  });

  const updateCrewMember = useMutation({
    mutationFn: async ({
      crewMemberId,
      updates,
    }: {
      crewMemberId: string;
      updates: Partial<Omit<CrewMember, "id">>;
    }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { crewMemberId, updates };
      const ref = doc(db, ...crewMemberPath(crewMemberId, clientId));
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { crewMemberId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update crew member");
      toast.error({ title: "Failed to update crew member", description: `${code}: ${message}` });
    },
  });

  const deleteCrewMember = useMutation({
    mutationFn: async (crewMemberId: string) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { crewMemberId };
      await deleteDoc(doc(db, ...crewMemberPath(crewMemberId, clientId)));
      return { crewMemberId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete crew member");
      toast.error({ title: "Failed to delete crew member", description: `${code}: ${message}` });
    },
  });

  const crewById = useMemo(() => new Map(crew.map((m) => [m.id, m])), [crew]);

  return {
    crew,
    crewById,
    loading,
    error,
    createCrewMember,
    updateCrewMember,
    deleteCrewMember,
  };
}

