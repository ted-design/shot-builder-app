import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { projectMemberPath } from "../lib/paths";
import { normalizeRole } from "../lib/rbac";
import { useAuth } from "../context/AuthContext";

export function useProjectMemberRole(clientId: string | null, projectId: string | null) {
  const { user, role: globalRole } = useAuth();
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId || !user?.uid) {
      setProjectRole(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, ...projectMemberPath(projectId, user.uid, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() || {};
        const nextRole = normalizeRole(data.role) || null;
        setProjectRole(nextRole);
        setLoading(false);
      },
      (err) => {
        console.error("[useProjectMemberRole] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, user?.uid]);

  const canWrite = useMemo(() => {
    const isAdmin = globalRole === "admin";
    if (isAdmin) return true;
    return projectRole === "producer" || projectRole === "wardrobe";
  }, [globalRole, projectRole]);

  const canRead = useMemo(() => {
    const isAdmin = globalRole === "admin";
    if (isAdmin) return true;
    return projectRole === "producer" || projectRole === "wardrobe" || projectRole === "viewer";
  }, [globalRole, projectRole]);

  return { projectRole, canRead, canWrite, loading, error };
}

