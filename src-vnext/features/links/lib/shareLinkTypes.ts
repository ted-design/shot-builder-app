/**
 * Unified share link types and mappers.
 *
 * Three share link sources are normalized into a single ShareLink shape:
 *   - shotShares (root collection, doc id = token)
 *   - castingShares (root collection, doc id = token)
 *   - pulls (project-scoped, shareToken field on pull doc)
 */

import type { Timestamp } from "firebase/firestore"

export type ShareLinkType = "shots" | "casting" | "pull"
export type ShareLinkStatus = "active" | "disabled" | "expired"

export interface ShareLink {
  readonly id: string
  readonly type: ShareLinkType
  readonly title: string
  readonly url: string
  readonly status: ShareLinkStatus
  readonly enabled: boolean
  readonly expiresAt: Date | null
  readonly createdAt: Date | null
  readonly createdBy: string | null
  readonly engagement: number | null
  readonly projectId: string
  readonly clientId: string
  /** For pulls: the pull doc ID. For shots/casting: same as id (the token). */
  readonly sourceDocId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timestampToDate(value: unknown): Date | null {
  if (!value) return null
  try {
    if (typeof (value as Timestamp).toDate === "function") {
      return (value as Timestamp).toDate()
    }
  } catch {
    // fall through
  }
  return null
}

export function computeShareLinkStatus(
  enabled: boolean,
  expiresAt: Date | null,
): ShareLinkStatus {
  if (!enabled) return "disabled"
  if (expiresAt && expiresAt.getTime() < Date.now()) return "expired"
  return "active"
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapShotShareDoc(
  id: string,
  data: Record<string, unknown>,
): ShareLink {
  const enabled = data["enabled"] === true
  const expiresAt = timestampToDate(data["expiresAt"])
  const createdAt = timestampToDate(data["createdAt"])
  const projectId = (typeof data["projectId"] === "string" ? data["projectId"] : "") as string
  const clientId = (typeof data["clientId"] === "string" ? data["clientId"] : "") as string
  const title =
    (typeof data["title"] === "string" && data["title"].length > 0
      ? data["title"]
      : "Shot Share") as string

  return {
    id,
    type: "shots",
    title,
    url: `/shots/shared/${id}`,
    status: computeShareLinkStatus(enabled, expiresAt),
    enabled,
    expiresAt,
    createdAt,
    createdBy: typeof data["createdBy"] === "string" ? data["createdBy"] : null,
    engagement: null,
    projectId,
    clientId,
    sourceDocId: id,
  }
}

export function mapCastingShareDoc(
  id: string,
  data: Record<string, unknown>,
  voteCount?: number,
): ShareLink {
  const enabled = data["enabled"] === true
  const expiresAt = timestampToDate(data["expiresAt"])
  const createdAt = timestampToDate(data["createdAt"])
  const projectId = (typeof data["projectId"] === "string" ? data["projectId"] : "") as string
  const clientId = (typeof data["clientId"] === "string" ? data["clientId"] : "") as string
  const title =
    (typeof data["title"] === "string" && data["title"].length > 0
      ? data["title"]
      : "Casting Share") as string

  return {
    id,
    type: "casting",
    title,
    url: `/casting/shared/${id}`,
    status: computeShareLinkStatus(enabled, expiresAt),
    enabled,
    expiresAt,
    createdAt,
    createdBy: typeof data["createdBy"] === "string" ? data["createdBy"] : null,
    engagement: voteCount ?? null,
    projectId,
    clientId,
    sourceDocId: id,
  }
}

export function mapPullToShareLink(
  pullId: string,
  data: Record<string, unknown>,
): ShareLink | null {
  const shareToken = typeof data["shareToken"] === "string" ? data["shareToken"] : null
  if (!shareToken) return null

  const enabled = data["shareEnabled"] === true
  const expiresAt =
    timestampToDate(data["shareExpireAt"]) ?? timestampToDate(data["shareExpiresAt"])
  const createdAt = timestampToDate(data["createdAt"])
  const projectId = (typeof data["projectId"] === "string" ? data["projectId"] : "") as string
  const clientId = (typeof data["clientId"] === "string" ? data["clientId"] : "") as string
  const title =
    (typeof data["title"] === "string" && data["title"].length > 0
      ? data["title"]
      : typeof data["name"] === "string" && data["name"].length > 0
        ? data["name"]
        : "Pull Share") as string

  return {
    id: shareToken,
    type: "pull",
    title,
    url: `/pulls/shared/${shareToken}`,
    status: computeShareLinkStatus(enabled, expiresAt),
    enabled,
    expiresAt,
    createdAt,
    createdBy: null,
    engagement: null,
    projectId,
    clientId,
    sourceDocId: pullId,
  }
}
