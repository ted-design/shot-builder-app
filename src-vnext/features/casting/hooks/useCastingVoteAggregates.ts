/**
 * Subscribes to all castingShares for a project, fan-out subscribes to each
 * share's votes subcollection, and aggregates vote data per talent.
 *
 * De-duplicates same-reviewer votes across multiple shares (keeps latest share).
 * Excludes votes with decision === "withdrawn" from counts and detail list.
 */

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CastingVoteDetail {
  readonly reviewerName: string
  readonly reviewerEmail: string
  readonly decision: "approve" | "maybe" | "disapprove"
  readonly comment: string | null
  readonly shareTitle: string
}

export interface VoteAggregate {
  readonly approve: number
  readonly maybe: number
  readonly disapprove: number
  readonly votes: ReadonlyArray<CastingVoteDetail>
}

export type VoteAggregateMap = ReadonlyMap<string, VoteAggregate>

const EMPTY_MAP: VoteAggregateMap = new Map()

// ---------------------------------------------------------------------------
// Internal types for accumulation
// ---------------------------------------------------------------------------

interface RawVote {
  readonly talentId: string
  readonly reviewerEmail: string
  readonly reviewerName: string
  readonly decision: string
  readonly comment: string | null
  readonly shareToken: string
  readonly shareTitle: string
  readonly shareCreatedAt: number // epoch ms for ordering
}

interface ShareMeta {
  readonly token: string
  readonly title: string
  readonly createdAt: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timestampToMs(value: unknown): number {
  if (!value) return 0
  try {
    if (typeof (value as Timestamp).toMillis === "function") {
      return (value as Timestamp).toMillis()
    }
  } catch {
    // fall through
  }
  return 0
}

function buildAggregates(
  shareMetaMap: ReadonlyMap<string, ShareMeta>,
  votesByShare: ReadonlyMap<string, readonly RawVote[]>,
): VoteAggregateMap {
  // 1. Collect all non-withdrawn votes across all shares
  const allVotes: RawVote[] = []
  for (const votes of votesByShare.values()) {
    for (const v of votes) {
      if (v.decision === "withdrawn") continue
      allVotes.push(v)
    }
  }

  // 2. De-duplicate: same reviewer + same talent across multiple shares.
  //    Keep the vote from the share with the highest createdAt.
  const deduped = new Map<string, RawVote>()
  for (const vote of allVotes) {
    const key = `${vote.reviewerEmail.toLowerCase()}::${vote.talentId}`
    const existing = deduped.get(key)
    if (!existing || vote.shareCreatedAt > existing.shareCreatedAt) {
      deduped.set(key, vote)
    }
  }

  // 3. Group by talentId and build aggregates
  const grouped = new Map<string, RawVote[]>()
  for (const vote of deduped.values()) {
    const list = grouped.get(vote.talentId)
    if (list) {
      list.push(vote)
    } else {
      grouped.set(vote.talentId, [vote])
    }
  }

  const result = new Map<string, VoteAggregate>()
  for (const [talentId, votes] of grouped) {
    let approve = 0
    let maybe = 0
    let disapprove = 0
    const details: CastingVoteDetail[] = []

    for (const v of votes) {
      if (v.decision === "approve") approve += 1
      else if (v.decision === "maybe") maybe += 1
      else if (v.decision === "disapprove") disapprove += 1

      details.push({
        reviewerName: v.reviewerName,
        reviewerEmail: v.reviewerEmail,
        decision: v.decision as CastingVoteDetail["decision"],
        comment: v.comment,
        shareTitle: v.shareTitle,
      })
    }

    result.set(talentId, {
      approve,
      maybe,
      disapprove,
      votes: details,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCastingVoteAggregates(
  projectId: string | null,
  clientId: string | null,
): {
  readonly aggregates: VoteAggregateMap
  readonly loading: boolean
} {
  const [shareMetaMap, setShareMetaMap] = useState<ReadonlyMap<string, ShareMeta>>(new Map())
  const [votesByShare, setVotesByShare] = useState<ReadonlyMap<string, readonly RawVote[]>>(
    new Map(),
  )
  const [sharesLoading, setSharesLoading] = useState(true)
  const [votesLoading, setVotesLoading] = useState(true)

  const enabled = Boolean(projectId) && Boolean(clientId)

  // -------------------------------------------------------------------------
  // 1. Subscribe to castingShares for this project
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) {
      setShareMetaMap(new Map())
      setSharesLoading(false)
      return
    }

    setSharesLoading(true)
    const q = query(
      collection(db, "castingShares"),
      where("clientId", "==", clientId),
      where("projectId", "==", projectId),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Map<string, ShareMeta>()
        for (const d of snap.docs) {
          const data = d.data()
          next.set(d.id, {
            token: d.id,
            title:
              typeof data["title"] === "string" && data["title"].length > 0
                ? data["title"]
                : "Casting Share",
            createdAt: timestampToMs(data["createdAt"]),
          })
        }
        setShareMetaMap(next)
        setSharesLoading(false)
      },
      (err) => {
        console.error("[useCastingVoteAggregates] castingShares error:", err)
        setSharesLoading(false)
      },
    )

    return unsub
  }, [enabled, clientId, projectId])

  // -------------------------------------------------------------------------
  // 2. Fan-out: subscribe to votes subcollection for each share
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (shareMetaMap.size === 0) {
      setVotesByShare(new Map())
      setVotesLoading(false)
      return
    }

    setVotesLoading(true)
    const unsubs: Unsubscribe[] = []
    const pendingShares = new Set<string>(shareMetaMap.keys())
    const accum = new Map<string, readonly RawVote[]>()

    for (const [shareToken, meta] of shareMetaMap) {
      const votesCol = collection(db, "castingShares", shareToken, "votes")

      const unsub = onSnapshot(
        votesCol,
        (snap) => {
          const votes: RawVote[] = snap.docs.map((d) => {
            const data = d.data()
            return {
              talentId: (data["talentId"] as string) ?? "",
              reviewerEmail: (data["reviewerEmail"] as string) ?? "",
              reviewerName: (data["reviewerName"] as string) ?? "",
              decision: (data["decision"] as string) ?? "",
              comment:
                typeof data["comment"] === "string" ? data["comment"] : null,
              shareToken: meta.token,
              shareTitle: meta.title,
              shareCreatedAt: meta.createdAt,
            }
          })

          accum.set(shareToken, votes)
          pendingShares.delete(shareToken)

          // Update state with a new map to trigger re-render
          setVotesByShare(new Map(accum))

          if (pendingShares.size === 0) {
            setVotesLoading(false)
          }
        },
        (err) => {
          console.error(
            `[useCastingVoteAggregates] votes error (share ${shareToken}):`,
            err,
          )
          pendingShares.delete(shareToken)
          if (pendingShares.size === 0) {
            setVotesLoading(false)
          }
        },
      )

      unsubs.push(unsub)
    }

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [shareMetaMap])

  // -------------------------------------------------------------------------
  // 3. Aggregate
  // -------------------------------------------------------------------------
  const aggregates = useMemo(
    () =>
      votesByShare.size === 0
        ? EMPTY_MAP
        : buildAggregates(shareMetaMap, votesByShare),
    [shareMetaMap, votesByShare],
  )

  const loading = sharesLoading || votesLoading

  return { aggregates, loading }
}
