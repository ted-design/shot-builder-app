/**
 * Resolves talent data for denormalization into a castingShares document.
 *
 * Called at share-creation time (user is authenticated) so all Firestore
 * reads and Storage URL lookups succeed under normal security rules.
 * The resolved payload is stored in the share document so the public page
 * can render it without any further Firestore queries.
 */

import { doc, getDoc } from "firebase/firestore"
import { getDownloadURL, ref as storageRef } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import { talentPath } from "@/shared/lib/paths"
import type {
  CastingBoardEntry,
  CastingShareVisibility,
  ResolvedCastingTalent,
} from "@/shared/types"

const MAX_GALLERY_IMAGES = 6

/** Build a Firestore doc ref from a path-helper array + extra segment. */
function docRef(path: string[], ...extra: string[]) {
  const segments = [...path, ...extra]
  return doc(db, segments[0]!, ...segments.slice(1))
}

/**
 * Attempt to resolve a Storage path to a download URL.
 * Returns null on any error (missing file, permission denied, etc.).
 */
async function resolveStorageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path || typeof path !== "string" || path.trim().length === 0) return null
  try {
    return await getDownloadURL(storageRef(storage, path))
  } catch {
    return null
  }
}

/**
 * Resolve talent data for a casting share.
 *
 * Reads each talent doc from Firestore, resolves headshot/gallery Storage
 * paths to download URLs, and builds the ResolvedCastingTalent array.
 * Only includes fields based on the visibleFields config. Handles missing
 * talent docs gracefully using the denormalized talentName from the entry.
 */
export async function resolveTalentForCastingShare(args: {
  readonly clientId: string
  readonly entries: readonly CastingBoardEntry[]
  readonly visibleFields: CastingShareVisibility
}): Promise<readonly ResolvedCastingTalent[]> {
  const { clientId, entries, visibleFields } = args

  const results = await Promise.all(
    entries.map(async (entry): Promise<ResolvedCastingTalent> => {
      const talentRef = docRef(talentPath(clientId), entry.talentId)
      const snap = await getDoc(talentRef)
      const data = snap.exists()
        ? (snap.data() as Record<string, unknown>)
        : null

      // Name: prefer live doc, fall back to denormalized entry
      const name =
        (data && typeof data["name"] === "string" ? data["name"].trim() : null) ||
        entry.talentName

      // Headshot: resolve Storage path to download URL
      const headshotPath = data
        ? (data["headshotPath"] as string | null | undefined) ??
          (data["imageUrl"] as string | null | undefined)
        : null
      const headshotUrl = await resolveStorageUrl(headshotPath)

      // Gender
      const gender = data && typeof data["gender"] === "string"
        ? data["gender"].trim() || null
        : null

      // Agency (only if visible)
      const agency = visibleFields.agency && data && typeof data["agency"] === "string"
        ? data["agency"].trim() || null
        : null

      // Measurements (only if visible)
      const measurements = visibleFields.measurements && data && data["measurements"]
        ? (data["measurements"] as Record<string, string | number | null>)
        : null

      // Gallery / portfolio (only if visible)
      let galleryUrls: readonly string[] = []
      if (visibleFields.portfolio && data) {
        const gallery = Array.isArray(data["galleryImages"])
          ? (data["galleryImages"] as ReadonlyArray<{ path?: string; downloadURL?: string | null }>)
          : []

        const limited = gallery.slice(0, MAX_GALLERY_IMAGES)
        const urls = await Promise.all(
          limited.map(async (img) => {
            // Prefer pre-resolved downloadURL, fall back to resolving the path
            if (typeof img.downloadURL === "string" && img.downloadURL.trim().length > 0) {
              return img.downloadURL
            }
            return resolveStorageUrl(typeof img.path === "string" ? img.path : null)
          }),
        )
        galleryUrls = urls.filter((u): u is string => u !== null)
      }

      return {
        talentId: entry.talentId,
        name,
        headshotUrl,
        gender,
        agency,
        measurements,
        galleryUrls,
        roleLabel: entry.roleLabel ?? null,
      }
    }),
  )

  return results
}
