import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useMutation } from "@tanstack/react-query";
import { db } from "../lib/firebase";
import {
  departmentPath,
  departmentPositionPath,
  departmentPositionsPath,
  departmentsPath,
} from "../lib/paths";
import type { Department, DepartmentWithPositions, Position } from "../types/departments";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_DEPARTMENTS } from "../lib/callsheet/defaults";

function normalizeDepartment(id: string, raw: any, fallbackOrder: number): Department {
  return {
    id,
    name: raw?.name ?? "Untitled",
    order: Number.isFinite(raw?.order) ? raw.order : fallbackOrder,
    isVisible: raw?.isVisible !== false,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

function normalizePosition(id: string, departmentId: string, raw: any, fallbackOrder: number): Position {
  return {
    id,
    departmentId,
    title: raw?.title ?? "Untitled",
    order: Number.isFinite(raw?.order) ? raw.order : fallbackOrder,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function useDepartments(clientId: string | null) {
  const { user } = useAuth();
  const [baseDepartments, setBaseDepartments] = useState<Department[]>([]);
  const [positionsByDepartmentId, setPositionsByDepartmentId] = useState<Record<string, Position[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const positionsUnsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    positionsUnsubsRef.current.forEach((unsub) => unsub());
    positionsUnsubsRef.current.clear();
    setPositionsByDepartmentId({});

    if (!clientId) {
      setBaseDepartments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const departmentsRef = collection(db, ...departmentsPath(clientId));
    const q = query(departmentsRef, orderBy("order", "asc"));

    const unsubDepartments = onSnapshot(
      q,
      (snap) => {
        const departments = snap.docs.map((d, index) =>
          normalizeDepartment(d.id, d.data(), index)
        );
        setBaseDepartments(departments);
        setLoading(false);

        const nextIds = new Set(departments.map((d) => d.id));
        // Remove listeners for departments that disappeared
        positionsUnsubsRef.current.forEach((unsub, deptId) => {
          if (!nextIds.has(deptId)) {
            unsub();
            positionsUnsubsRef.current.delete(deptId);
            setPositionsByDepartmentId((prev) => {
              const copy = { ...prev };
              delete copy[deptId];
              return copy;
            });
          }
        });

        // Add listeners for new departments
        departments.forEach((dept) => {
          if (positionsUnsubsRef.current.has(dept.id)) return;
          const positionsRef = collection(db, ...departmentPositionsPath(dept.id, clientId));
          const positionsQuery = query(positionsRef, orderBy("order", "asc"));
          const unsub = onSnapshot(
            positionsQuery,
            (positionsSnap) => {
              const positions = positionsSnap.docs.map((p, index) =>
                normalizePosition(p.id, dept.id, p.data(), index)
              );
              setPositionsByDepartmentId((prev) => ({ ...prev, [dept.id]: positions }));
            },
            (err) => {
              console.error("[useDepartments] Positions subscription error:", err);
            }
          );
          positionsUnsubsRef.current.set(dept.id, unsub);
        });
      },
      (err) => {
        console.error("[useDepartments] Departments subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubDepartments();
      positionsUnsubsRef.current.forEach((unsub) => unsub());
      positionsUnsubsRef.current.clear();
    };
  }, [clientId]);

  const departments: DepartmentWithPositions[] = useMemo(() => {
    return baseDepartments
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((dept) => ({
        ...dept,
        positions: (positionsByDepartmentId[dept.id] ?? []).slice().sort((a, b) => a.order - b.order),
      }));
  }, [baseDepartments, positionsByDepartmentId]);

  const nextDepartmentOrder = useMemo(() => {
    if (departments.length === 0) return 0;
    const max = Math.max(...departments.map((d) => d.order ?? 0));
    return Number.isFinite(max) ? max + 1 : departments.length;
  }, [departments]);

  const createDepartment = useMutation({
    mutationFn: async (input: { name: string; order?: number; isVisible?: boolean }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) {
        return { id: `demo-dept-${Date.now()}`, ...input };
      }
      const ref = collection(db, ...departmentsPath(clientId));
      const docRef = await addDoc(ref, {
        name: input.name.trim() || "Untitled",
        order: Number.isFinite(input.order) ? input.order : nextDepartmentOrder,
        isVisible: input.isVisible !== false,
        createdBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to create department");
      toast.error({ title: "Failed to create department", description: `${code}: ${message}` });
    },
  });

  const updateDepartment = useMutation({
    mutationFn: async ({
      departmentId,
      updates,
    }: {
      departmentId: string;
      updates: Partial<Pick<Department, "name" | "order" | "isVisible">>;
    }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { departmentId, updates };
      const ref = doc(db, ...departmentPath(departmentId, clientId));
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { departmentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update department");
      toast.error({ title: "Failed to update department", description: `${code}: ${message}` });
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: async (departmentId: string) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { departmentId };

      const positionsRef = collection(db, ...departmentPositionsPath(departmentId, clientId));
      const positionsSnap = await getDocs(positionsRef);
      const batch = writeBatch(db);
      positionsSnap.docs.forEach((p) => batch.delete(p.ref));
      batch.delete(doc(db, ...departmentPath(departmentId, clientId)));
      await batch.commit();
      return { departmentId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete department");
      toast.error({ title: "Failed to delete department", description: `${code}: ${message}` });
    },
  });

  const createPosition = useMutation({
    mutationFn: async ({
      departmentId,
      title,
      order,
    }: {
      departmentId: string;
      title: string;
      order?: number;
    }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) {
        return { id: `demo-pos-${Date.now()}`, departmentId, title, order };
      }

      const existing = positionsByDepartmentId[departmentId] ?? [];
      const nextOrder = Number.isFinite(order)
        ? order!
        : existing.length > 0
        ? Math.max(...existing.map((p) => p.order ?? 0)) + 1
        : 0;

      const ref = collection(db, ...departmentPositionsPath(departmentId, clientId));
      const docRef = await addDoc(ref, {
        departmentId,
        title: title.trim() || "Untitled",
        order: nextOrder,
        createdBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to create position");
      toast.error({ title: "Failed to create position", description: `${code}: ${message}` });
    },
  });

  const updatePosition = useMutation({
    mutationFn: async ({
      departmentId,
      positionId,
      updates,
    }: {
      departmentId: string;
      positionId: string;
      updates: Partial<Pick<Position, "title" | "order">>;
    }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { departmentId, positionId, updates };
      const ref = doc(db, ...departmentPositionPath(departmentId, positionId, clientId));
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { departmentId, positionId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update position");
      toast.error({ title: "Failed to update position", description: `${code}: ${message}` });
    },
  });

  const deletePosition = useMutation({
    mutationFn: async ({ departmentId, positionId }: { departmentId: string; positionId: string }) => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { departmentId, positionId };
      await deleteDoc(doc(db, ...departmentPositionPath(departmentId, positionId, clientId)));
      return { departmentId, positionId };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to delete position");
      toast.error({ title: "Failed to delete position", description: `${code}: ${message}` });
    },
  });

  const seedDefaultDepartments = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Missing clientId");
      if (isDemoModeActive()) return { seeded: true };

      const batch = writeBatch(db);
      let deptOrder = nextDepartmentOrder;

      for (const template of DEFAULT_DEPARTMENTS) {
        const deptRef = doc(collection(db, ...departmentsPath(clientId)));
        batch.set(deptRef, {
          name: template.name,
          order: deptOrder,
          isVisible: true,
          createdBy: user?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        template.positions.forEach((title, index) => {
          const posRef = doc(collection(db, ...departmentPositionsPath(deptRef.id, clientId)));
          batch.set(posRef, {
            departmentId: deptRef.id,
            title,
            order: index,
            createdBy: user?.uid ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        deptOrder += 1;
      }

      await batch.commit();
      return { seeded: true };
    },
    onSuccess: () => {
      toast.success({ title: "Departments seeded" });
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to seed departments");
      toast.error({ title: "Failed to seed departments", description: `${code}: ${message}` });
    },
  });

  return {
    departments,
    loading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    createPosition,
    updatePosition,
    deletePosition,
    seedDefaultDepartments,
  };
}
