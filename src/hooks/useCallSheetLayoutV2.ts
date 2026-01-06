import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callSheetLayoutPath } from "../lib/paths";
import type { CallSheetLayoutDocumentV2, CallSheetLayoutV2 } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

export function useCallSheetLayoutV2(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null
) {
  const { user } = useAuth();
  const [layoutDoc, setLayoutDoc] = useState<CallSheetLayoutDocumentV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setLayoutDoc(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, ...callSheetLayoutPath(projectId, scheduleId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLayoutDoc(null);
          setLoading(false);
          return;
        }
        const data = snap.data() || {};
        const layout = data.layout && typeof data.layout === "object" ? (data.layout as CallSheetLayoutV2) : null;
        setLayoutDoc({
          id: snap.id,
          projectId,
          scheduleId,
          layout: layout || (data as any),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          createdBy: data.createdBy ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[useCallSheetLayoutV2] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  const ensureLayout = useMutation({
    mutationFn: async ({ layout }: { layout: CallSheetLayoutV2 }) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { id: "layout" };
      const ref = doc(db, ...callSheetLayoutPath(projectId, scheduleId, clientId));
      await setDoc(
        ref,
        {
          projectId,
          scheduleId,
          schemaVersion: layout.schemaVersion,
          layout,
          createdBy: user?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { id: "layout" };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to initialize call sheet layout");
      toast.error({ title: "Failed to init call sheet layout", description: `${code}: ${message}` });
    },
  });

  const updateLayout = useMutation({
    mutationFn: async (updates: Partial<Pick<CallSheetLayoutDocumentV2, "layout">> & Record<string, unknown>) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { updates };
      const ref = doc(db, ...callSheetLayoutPath(projectId, scheduleId, clientId));
      const nextLayout = updates.layout as CallSheetLayoutV2 | undefined;
      await setDoc(
        ref,
        {
          ...updates,
          ...(nextLayout ? { schemaVersion: nextLayout.schemaVersion } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update call sheet layout");
      toast.error({ title: "Failed to update call sheet layout", description: `${code}: ${message}` });
    },
  });

  const hasRemoteLayout = useMemo(() => Boolean(layoutDoc), [layoutDoc]);

  return {
    layoutDoc,
    hasRemoteLayout,
    loading,
    error,
    ensureLayout,
    updateLayout,
  };
}

