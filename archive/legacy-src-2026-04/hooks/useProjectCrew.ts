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
import { projectCrewAssignmentPath, projectCrewAssignmentsPath } from "../lib/paths";
import type { ProjectCrewAssignment } from "../types/crew";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function normalizeAssignment(id: string, raw: any, projectId: string): ProjectCrewAssignment {
  const departmentId = raw?.departmentId ?? null;
  const positionId = raw?.positionId ?? null;

  return {
    id,
    projectId,
    crewMemberId: raw?.crewMemberId ?? "",
    positionId,
    positionScope: raw?.positionScope ?? (positionId ? "org" : null),
    departmentId,
    departmentScope: raw?.departmentScope ?? (departmentId ? "org" : null),
    notes: raw?.notes ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function useProjectCrew(clientId: string | null, projectId: string | null) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ProjectCrewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = collection(db, ...projectCrewAssignmentsPath(projectId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.docs.map((d) => normalizeAssignment(d.id, d.data(), projectId));
        // Leave sorting to the UI (e.g. group by department)
        setAssignments(next);
        setLoading(false);
      },
      (err) => {
        console.error("[useProjectCrew] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [clientId, projectId]);

  const createAssignment = useMutation({
    mutationFn: async (
      input: Omit<ProjectCrewAssignment, "id" | "createdAt" | "updatedAt" | "projectId"> & {
        projectId?: string;
      }
    ) => {
      if (!clientId || !projectId) throw new Error("Missing clientId/projectId");
      if (isDemoModeActive()) return { id: `demo-crew-assignment-${Date.now()}`, ...input };

      const ref = collection(db, ...projectCrewAssignmentsPath(projectId, clientId));
      const docRef = await addDoc(ref, {
        ...input,
        departmentScope: input.departmentScope ?? (input.departmentId ? "org" : null),
        positionScope: input.positionScope ?? (input.positionId ? "org" : null),
        createdBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to add crew to project");
      toast.error({ title: "Failed to add crew", description: `${code}: ${message}` });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async ({
      assignmentId,
      updates,
    }: {
      assignmentId: string;
      updates: Partial<Omit<ProjectCrewAssignment, "id" | "projectId">>;
    }) => {
      if (!clientId || !projectId) throw new Error("Missing clientId/projectId");
      if (isDemoModeActive()) return { assignmentId, updates };
      const ref = doc(db, ...projectCrewAssignmentPath(projectId, assignmentId, clientId));
      await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
      return { assignmentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update project crew");
      toast.error({ title: "Failed to update crew", description: `${code}: ${message}` });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!clientId || !projectId) throw new Error("Missing clientId/projectId");
      if (isDemoModeActive()) return { assignmentId };
      await deleteDoc(doc(db, ...projectCrewAssignmentPath(projectId, assignmentId, clientId)));
      return { assignmentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to remove crew from project");
      toast.error({ title: "Failed to remove crew", description: `${code}: ${message}` });
    },
  });

  const assignmentsByCrewMemberId = useMemo(() => {
    const map = new Map<string, ProjectCrewAssignment>();
    assignments.forEach((a) => {
      if (a.crewMemberId) map.set(a.crewMemberId, a);
    });
    return map;
  }, [assignments]);

  return {
    assignments,
    assignmentsByCrewMemberId,
    loading,
    error,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  };
}
