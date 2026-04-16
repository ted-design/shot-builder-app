import type { Timestamp } from "firebase/firestore"
import type { Lane } from "@/shared/types"

/**
 * Map a raw Firestore document to a typed Lane.
 *
 * Defensive normalization:
 * - `sortOrder` defaults to 0 when missing.
 * - `sceneNumber` has a critical fallback: pre-S29 lanes have no stored
 *   sceneNumber, so we synthesize `sortOrder + 1` so the UI never shows
 *   "undefined" and scene-aware renumbering can still address them.
 * - Nullable string fields collapse `null` to `undefined`.
 *
 * This is the single source of truth for Lane shaping across the app
 * (primary list view, Cmd+K lazy index, etc.).
 */
export function mapLane(id: string, data: Record<string, unknown>): Lane {
  const sortOrder = (data["sortOrder"] as number) ?? 0
  const storedSceneNumber = data["sceneNumber"] as number | null | undefined
  const sceneNumber = storedSceneNumber != null ? storedSceneNumber : sortOrder + 1
  return {
    id,
    name: (data["name"] as string) ?? "",
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    sortOrder,
    color: (data["color"] as string | null) ?? undefined,
    sceneNumber,
    direction: (data["direction"] as string | null) ?? undefined,
    notes: (data["notes"] as string | null) ?? undefined,
    createdAt: data["createdAt"] as Timestamp,
    updatedAt: data["updatedAt"] as Timestamp,
    createdBy: (data["createdBy"] as string) ?? "",
  }
}
