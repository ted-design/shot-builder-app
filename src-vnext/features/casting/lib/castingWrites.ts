/**
 * Firestore write operations for the casting board feature.
 *
 * Casting board entries live under:
 *   clients/{clientId}/projects/{projectId}/castingBoard/{talentId}
 *
 * Casting shares (public links) live at root level:
 *   castingShares/{shareToken}
 *
 * Casting votes (unauthenticated) live under:
 *   castingShares/{shareToken}/votes/{voteId}
 */

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  updateDoc,
  setDoc,
  arrayUnion,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  castingBoardPath,
  castingBoardDocPath,
  castingShareDocPath,
  castingShareVoteDocPath,
  talentPath,
} from "@/shared/lib/paths"
import type {
  CastingBoardStatus,
  CastingShareVisibility,
  CastingVoteDecision,
  ResolvedCastingTalent,
} from "@/shared/types"

const BATCH_CHUNK_SIZE = 250

/** Build a Firestore doc ref from a path-helper string array. */
function docRef(path: string[]) {
  return doc(db, path[0]!, ...path.slice(1))
}

/** Build a Firestore collection ref from a path-helper string array. */
function colRef(path: string[]) {
  return collection(db, path[0]!, ...path.slice(1))
}

// ---------------------------------------------------------------------------
// Casting Board CRUD
// ---------------------------------------------------------------------------

/**
 * Add one or more talent entries to a project's casting board.
 * Doc ID = talentId. Sets status to "shortlist" and assigns sortOrder
 * based on the current entry count.
 */
export async function addTalentToCastingBoard(args: {
  readonly clientId: string
  readonly projectId: string
  readonly userId: string
  readonly talentIds: readonly string[]
  readonly talentData: ReadonlyMap<string, { name: string; agency?: string | null }>
}): Promise<void> {
  const { clientId, projectId, userId, talentIds, talentData } = args
  if (talentIds.length === 0) return

  // Read existing entries to determine next sortOrder
  const boardCol = colRef(castingBoardPath(projectId, clientId))
  const existing = await getDocs(boardCol)
  let nextOrder = existing.size

  // Chunk writes at BATCH_CHUNK_SIZE to stay within Firestore batch limits
  for (let i = 0; i < talentIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = talentIds.slice(i, i + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const talentId of chunk) {
      const entryRef = docRef(castingBoardDocPath(talentId, projectId, clientId))
      const data = talentData.get(talentId)
      batch.set(entryRef, {
        talentId,
        talentName: data?.name ?? "Unknown",
        talentAgency: data?.agency ?? null,
        status: "shortlist" as CastingBoardStatus,
        notes: null,
        roleLabel: null,
        sortOrder: nextOrder,
        addedBy: userId,
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      nextOrder += 1
    }

    await batch.commit()
  }
}

/**
 * Remove a talent entry from the casting board.
 */
export async function removeTalentFromCastingBoard(args: {
  readonly clientId: string
  readonly projectId: string
  readonly talentId: string
}): Promise<void> {
  const { clientId, projectId, talentId } = args
  const batch = writeBatch(db)
  const entryRef = docRef(castingBoardDocPath(talentId, projectId, clientId))
  batch.delete(entryRef)
  await batch.commit()
}

/**
 * Update a single casting entry's mutable fields.
 */
export async function updateCastingEntry(args: {
  readonly clientId: string
  readonly projectId: string
  readonly talentId: string
  readonly patch: Partial<Pick<
    { status: CastingBoardStatus; notes: string | null; roleLabel: string | null; sortOrder: number },
    "status" | "notes" | "roleLabel" | "sortOrder"
  >>
}): Promise<void> {
  const { clientId, projectId, talentId, patch } = args
  const entryRef = docRef(castingBoardDocPath(talentId, projectId, clientId))
  await updateDoc(entryRef, {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Bulk update the status of multiple casting entries.
 */
export async function bulkUpdateCastingStatus(args: {
  readonly clientId: string
  readonly projectId: string
  readonly talentIds: readonly string[]
  readonly status: CastingBoardStatus
}): Promise<void> {
  const { clientId, projectId, talentIds, status } = args
  if (talentIds.length === 0) return

  for (let i = 0; i < talentIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = talentIds.slice(i, i + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const talentId of chunk) {
      const entryRef = docRef(castingBoardDocPath(talentId, projectId, clientId))
      batch.update(entryRef, {
        status,
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
  }
}

/**
 * Book a talent: updates the casting entry status to "booked" and
 * adds the projectId to the talent doc's projectIds array.
 */
export async function bookCastingTalent(args: {
  readonly clientId: string
  readonly projectId: string
  readonly userId: string
  readonly talentId: string
}): Promise<void> {
  const { clientId, projectId, userId, talentId } = args
  const batch = writeBatch(db)

  // 1. Update casting entry status to "booked"
  const entryRef = docRef(castingBoardDocPath(talentId, projectId, clientId))
  batch.update(entryRef, {
    status: "booked" as CastingBoardStatus,
    updatedAt: serverTimestamp(),
  })

  // 2. Add projectId to talent doc's projectIds array
  const talentSegments = talentPath(clientId)
  const talentRef = doc(db, talentSegments[0]!, ...talentSegments.slice(1), talentId)
  batch.update(talentRef, {
    projectIds: arrayUnion(projectId),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })

  await batch.commit()
}

// ---------------------------------------------------------------------------
// Casting Share (public link creation)
// ---------------------------------------------------------------------------

/**
 * Create a casting share link with denormalized talent data.
 * Returns the share token (used in the public URL).
 */
export async function createCastingShareLink(args: {
  readonly clientId: string
  readonly projectId: string
  readonly userId: string
  readonly title: string
  readonly resolvedTalent: readonly ResolvedCastingTalent[]
  readonly visibleFields: CastingShareVisibility
  readonly reviewerInstructions?: string | null
  readonly showVoteTallies: boolean
}): Promise<string> {
  const {
    clientId,
    projectId,
    userId,
    title,
    resolvedTalent,
    visibleFields,
    reviewerInstructions,
    showVoteTallies,
  } = args

  const shareToken = crypto.randomUUID()
  const shareRef = docRef(castingShareDocPath(shareToken))

  await setDoc(shareRef, {
    clientId,
    projectId,
    title: title.trim(),
    enabled: true,
    expiresAt: null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    resolvedTalent: resolvedTalent.map((t) => ({ ...t })),
    visibleFields: { ...visibleFields },
    reviewerInstructions: reviewerInstructions?.trim() || null,
    showVoteTallies,
  })

  return shareToken
}

// ---------------------------------------------------------------------------
// Casting Votes (unauthenticated public page)
// ---------------------------------------------------------------------------

/**
 * Normalize an email address into a Firestore-safe document ID segment.
 * Replaces @ with -at- and dots with -.
 */
function normalizeEmailForId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/@/g, "-at-")
    .replace(/\./g, "-")
}

/**
 * Submit or update a vote on a casting share.
 * Uses a deterministic doc ID so the same reviewer can update their vote.
 */
export async function submitCastingVote(args: {
  readonly shareToken: string
  readonly talentId: string
  readonly reviewerEmail: string
  readonly reviewerName: string
  readonly decision: CastingVoteDecision
  readonly comment?: string | null
}): Promise<void> {
  const { shareToken, talentId, reviewerEmail, reviewerName, decision, comment } = args

  const voteId = `${normalizeEmailForId(reviewerEmail)}_${talentId}`
  const voteRef = docRef(castingShareVoteDocPath(shareToken, voteId))

  await setDoc(
    voteRef,
    {
      reviewerEmail: reviewerEmail.trim().toLowerCase(),
      reviewerName: reviewerName.trim(),
      talentId,
      decision,
      comment: comment?.trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
