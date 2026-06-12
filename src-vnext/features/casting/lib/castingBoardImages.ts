/**
 * Pure (no React / no Firestore) helpers that resolve a talent's gallery and
 * casting-session images into the structures the casting-board card, admin
 * sheet, and public-share use.
 *
 * Visibility curation lives on the `CastingBoardEntry` (`hiddenImageIds` /
 * `hiddenSessionIds`). These helpers translate the raw `TalentRecord` images
 * plus the entry's hidden ids into either a filtered "visible" view (card /
 * share parity) or an annotated "model" view (admin toggle UI).
 */

import type { CastingBoardEntry, TalentRecord } from "@/shared/types"

export interface BoardImage {
  readonly id: string
  readonly path: string
  readonly downloadURL: string | null
  readonly description: string | null
}

export interface BoardFolder {
  readonly id: string
  readonly title: string
  readonly date: string | null
  readonly images: readonly BoardImage[]
}

export interface ResolvedBoardImages {
  /** Visible gallery images (hidden filtered out). */
  readonly gallery: readonly BoardImage[]
  /** Visible session folders (hidden sessions removed; hidden images filtered within). */
  readonly folders: readonly BoardFolder[]
  /** Flat list, order: gallery then folders — for the card strip. */
  readonly allVisible: readonly BoardImage[]
  /** Whether the talent has ANY gallery/session image at all. */
  readonly hasHiddenCandidates: boolean
}

/** Per-image annotation for the admin toggle UI. */
export interface BoardImageModelEntry {
  readonly img: BoardImage
  readonly hidden: boolean
}

export interface BoardFolderModelEntry {
  readonly id: string
  readonly title: string
  readonly date: string | null
  readonly hidden: boolean
  readonly images: readonly BoardImageModelEntry[]
}

export interface BoardImageModel {
  readonly gallery: readonly BoardImageModelEntry[]
  readonly folders: readonly BoardFolderModelEntry[]
}

type RawImage = NonNullable<TalentRecord["galleryImages"]>[number]
type RawSession = NonNullable<TalentRecord["castingSessions"]>[number]

/** Map a raw gallery/session image to a normalized BoardImage. */
function toBoardImage(img: RawImage): BoardImage {
  return {
    id: img.id,
    path: img.path,
    downloadURL: img.downloadURL ?? null,
    description: img.description ?? null,
  }
}

/** Folder title fallback per spec. */
function folderTitle(session: RawSession): string {
  const trimmed = session.title?.trim()
  if (trimmed) return trimmed
  return session.date ? `Casting ${session.date}` : "Casting"
}

function hiddenImageIdSet(entry: CastingBoardEntry | null): ReadonlySet<string> {
  return new Set(entry?.hiddenImageIds ?? [])
}

function hiddenSessionIdSet(
  entry: CastingBoardEntry | null,
): ReadonlySet<string> {
  return new Set(entry?.hiddenSessionIds ?? [])
}

/**
 * Build the UNFILTERED structure plus per-image/per-folder `hidden` flags, so
 * the admin toggle UI can render hidden items dimmed. A `null` entry means
 * nothing is hidden; a `null`/empty talent yields empty arrays.
 */
export function buildBoardImageModel(
  talent: TalentRecord | null,
  entry: CastingBoardEntry | null,
): BoardImageModel {
  if (!talent) return { gallery: [], folders: [] }

  const hiddenImages = hiddenImageIdSet(entry)
  const hiddenSessions = hiddenSessionIdSet(entry)

  const gallery: BoardImageModelEntry[] = (talent.galleryImages ?? []).map(
    (img) => ({
      img: toBoardImage(img),
      hidden: hiddenImages.has(img.id),
    }),
  )

  const folders: BoardFolderModelEntry[] = (talent.castingSessions ?? []).map(
    (session) => {
      const folderHidden = hiddenSessions.has(session.id)
      return {
        id: session.id,
        title: folderTitle(session),
        date: session.date ?? null,
        hidden: folderHidden,
        images: (session.images ?? []).map((img) => ({
          img: toBoardImage(img),
          // An image is hidden when its own id is hidden OR its session is hidden.
          hidden: folderHidden || hiddenImages.has(img.id),
        })),
      }
    },
  )

  return { gallery, folders }
}

/**
 * Resolve only the VISIBLE images — hidden gallery images, hidden whole
 * sessions, and hidden images within kept sessions are filtered out. Used for
 * the card strip and to mirror the public-share's curation parity.
 */
export function resolveVisibleBoardImages(
  talent: TalentRecord | null,
  entry: CastingBoardEntry | null,
): ResolvedBoardImages {
  if (!talent) {
    return { gallery: [], folders: [], allVisible: [], hasHiddenCandidates: false }
  }

  const hiddenImages = hiddenImageIdSet(entry)
  const hiddenSessions = hiddenSessionIdSet(entry)

  const rawGallery = talent.galleryImages ?? []
  const rawSessions = talent.castingSessions ?? []

  const hasHiddenCandidates =
    rawGallery.length > 0 ||
    rawSessions.some((session) => (session.images ?? []).length > 0)

  const gallery: BoardImage[] = rawGallery
    .filter((img) => !hiddenImages.has(img.id))
    .map(toBoardImage)

  const folders: BoardFolder[] = rawSessions
    .filter((session) => !hiddenSessions.has(session.id))
    .map((session) => ({
      id: session.id,
      title: folderTitle(session),
      date: session.date ?? null,
      images: (session.images ?? [])
        .filter((img) => !hiddenImages.has(img.id))
        .map(toBoardImage),
    }))

  const allVisible: BoardImage[] = [
    ...gallery,
    ...folders.flatMap((folder) => folder.images),
  ]

  return { gallery, folders, allVisible, hasHiddenCandidates }
}
