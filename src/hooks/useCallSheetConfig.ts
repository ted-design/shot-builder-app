import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { callSheetConfigPath } from "../lib/paths";
import type { CallSheetConfig } from "../types/callsheet";
import { CALL_SHEET_CONFIG_SCHEMA_VERSION, DEFAULT_SCHEDULE_BLOCK_FIELDS } from "../types/callsheet";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";
import { isDemoModeActive } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function buildDefaultConfig(projectId: string, scheduleId: string): Omit<CallSheetConfig, "id"> {
  return {
    projectId,
    scheduleId,
    schemaVersion: CALL_SHEET_CONFIG_SCHEMA_VERSION,
    headerLayout: "classic",
    headerElements: [],
    sections: [
      { id: "section-header", type: "header", isVisible: true, order: 0, config: {} },
      { id: "section-day-details", type: "day-details", isVisible: true, order: 1, config: {} },
      { id: "section-reminders", type: "reminders", isVisible: true, order: 2, config: {} },
      { id: "section-schedule", type: "schedule", isVisible: true, order: 3, config: { viewMode: "parallel" } },
      { id: "section-talent", type: "talent", isVisible: true, order: 4, config: {} },
      { id: "section-crew", type: "crew", isVisible: true, order: 5, config: {} },
      { id: "section-notes", type: "notes-contacts", isVisible: true, order: 6, config: {} },
    ],
    pageSize: "auto",
    spacing: "normal",
    timeFormat: "12h",
    temperatureFormat: "fahrenheit",
    showFooterLogo: false,
    colors: {
      primary: "#0F172A",
      accent: "#2563EB",
      text: "#0F172A",
      background: "#FFFFFF",
      primaryText: "#FFFFFF",
      rowAlternate: "#F8FAFC",
    },
    scheduleBlockFields: { ...DEFAULT_SCHEDULE_BLOCK_FIELDS },
    createdAt: null,
    updatedAt: null,
    createdBy: null,
  };
}

/**
 * Computes a SAFE backfill patch for an existing config document.
 *
 * RULES (strictly enforced):
 * 1. NEVER touch arrays at any depth (sections, headerElements, etc.)
 * 2. NEVER overwrite existing keys - only add missing ones
 * 3. For nested objects (like colors), backfill missing scalar keys ONE level deep
 * 4. Returns empty object if nothing needs backfilling
 *
 * This ensures user-edited visibility toggles and section arrays are NEVER overwritten.
 */
export function computeSafeBackfillPatch(
  existing: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const existingValue = existing[key];

    // RULE: Never touch arrays
    if (Array.isArray(defaultValue)) {
      continue;
    }

    // If key is completely missing or null/undefined in existing doc
    if (existingValue === undefined || existingValue === null) {
      // Only backfill non-array values
      patch[key] = defaultValue;
      continue;
    }

    // Handle nested objects (one level deep only)
    if (
      typeof defaultValue === "object" &&
      defaultValue !== null &&
      typeof existingValue === "object" &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      const nestedPatch: Record<string, unknown> = {};
      const existingObj = existingValue as Record<string, unknown>;
      const defaultObj = defaultValue as Record<string, unknown>;

      for (const nestedKey of Object.keys(defaultObj)) {
        const nestedDefault = defaultObj[nestedKey];
        const nestedExisting = existingObj[nestedKey];

        // RULE: Never touch arrays, even nested ones
        if (Array.isArray(nestedDefault)) {
          continue;
        }

        // Only add if missing
        if (nestedExisting === undefined || nestedExisting === null) {
          nestedPatch[nestedKey] = nestedDefault;
        }
      }

      // Only include nested patch if it has keys
      if (Object.keys(nestedPatch).length > 0) {
        // Merge with existing nested object
        patch[key] = { ...existingObj, ...nestedPatch };
      }
    }
    // If existing value exists and is not a nested object, leave it alone
  }

  return patch;
}

export function useCallSheetConfig(
  clientId: string | null,
  projectId: string | null,
  scheduleId: string | null
) {
  const { user } = useAuth();
  const [config, setConfig] = useState<CallSheetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, ...callSheetConfigPath(projectId, scheduleId, clientId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setConfig(null);
          setLoading(false);
          return;
        }
        const data = snap.data() || {};
        setConfig({
          id: snap.id,
          projectId,
          scheduleId,
          schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : undefined,
          headerLayout: data.headerLayout ?? "classic",
          headerElements: Array.isArray(data.headerElements) ? data.headerElements : [],
          sections: Array.isArray(data.sections) ? data.sections : [],
          pageSize: data.pageSize ?? "auto",
          spacing: data.spacing ?? "normal",
          timeFormat: data.timeFormat ?? "12h",
          temperatureFormat: data.temperatureFormat ?? "fahrenheit",
          showFooterLogo: data.showFooterLogo === true,
          colors: data.colors ?? { primary: "#0F172A", accent: "#2563EB", text: "#0F172A" },
          scheduleBlockFields: data.scheduleBlockFields ?? { ...DEFAULT_SCHEDULE_BLOCK_FIELDS },
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          createdBy: data.createdBy ?? null,
        });
        setLoading(false);
      },
      (err) => {
        console.error("[useCallSheetConfig] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  const ensureConfig = useMutation({
    mutationFn: async () => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { id: "default" };
      const ref = doc(db, ...callSheetConfigPath(projectId, scheduleId, clientId));
      // Use transaction to atomically check-and-create OR backfill missing keys
      return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);

        if (snap.exists()) {
          // Doc exists: compute SAFE backfill patch (never touches arrays or existing values)
          const existingData = snap.data() || {};
          const defaults = buildDefaultConfig(projectId, scheduleId);
          const patch = computeSafeBackfillPatch(
            existingData as Record<string, unknown>,
            defaults as unknown as Record<string, unknown>
          );

          // Only write if patch is non-empty
          if (Object.keys(patch).length > 0) {
            transaction.update(ref, {
              ...patch,
              updatedAt: serverTimestamp(),
            });
          }

          return { id: snap.id };
        }

        // Doc doesn't exist: create with full defaults
        transaction.set(ref, {
          ...buildDefaultConfig(projectId, scheduleId),
          createdBy: user?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: "default" };
      });
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to initialize call sheet config");
      toast.error({ title: "Failed to init call sheet config", description: `${code}: ${message}` });
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<Omit<CallSheetConfig, "id" | "projectId" | "scheduleId">>) => {
      if (!clientId || !projectId || !scheduleId) throw new Error("Missing clientId/projectId/scheduleId");
      if (isDemoModeActive()) return { updates };
      const ref = doc(db, ...callSheetConfigPath(projectId, scheduleId, clientId));
      await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true };
    },
    onError: (err) => {
      const { code, message } = describeFirebaseError(err, "Failed to update call sheet config");
      toast.error({ title: "Failed to update call sheet config", description: `${code}: ${message}` });
    },
  });

  const resolvedConfig = useMemo(() => {
    if (config) return config;
    if (!projectId || !scheduleId) return null;
    // Use a local default so the builder can render even before the doc exists.
    return { id: "default", ...buildDefaultConfig(projectId, scheduleId) };
  }, [config, projectId, scheduleId]);

  return {
    config: resolvedConfig,
    hasRemoteConfig: Boolean(config),
    loading,
    error,
    ensureConfig,
    updateConfig,
  };
}
