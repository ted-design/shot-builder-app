import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { submitCastingVote } from "@/features/casting/lib/castingWrites"
import type {
  CastingShareVisibility,
  CastingVoteDecision,
  ResolvedCastingTalent,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ErrorInfo = {
  readonly heading: string
  readonly message: string
}

type ReviewerIdentity = {
  readonly name: string
  readonly email: string
}

/** Local representation of a vote (keyed by talentId). */
type TalentVoteState = {
  readonly decision: CastingVoteDecision | null
  readonly comment: string
}

/** Other reviewer vote for display. */
type OtherVote = {
  readonly reviewerName: string
  readonly reviewerEmail: string
  readonly decision: CastingVoteDecision
  readonly comment: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOTE_OPTIONS: readonly {
  readonly decision: CastingVoteDecision
  readonly label: string
  readonly emoji: string
  readonly selectedClass: string
}[] = [
  {
    decision: "approve",
    label: "Approve",
    emoji: "\uD83D\uDC4D",
    selectedClass:
      "bg-green-500/10 border-green-500/35 text-green-500",
  },
  {
    decision: "maybe",
    label: "Maybe",
    emoji: "\uD83E\uDD14",
    selectedClass:
      "bg-amber-500/10 border-amber-500/35 text-amber-500",
  },
  {
    decision: "disapprove",
    label: "Pass",
    emoji: "\uD83D\uDC4E",
    selectedClass:
      "bg-red-500/10 border-red-500/35 text-red-500",
  },
]

const DECISION_LABELS: Record<CastingVoteDecision, string> = {
  approve: "Approved",
  maybe: "Maybe",
  disapprove: "Passed",
}

const DECISION_COLOR_CLASSES: Record<CastingVoteDecision, { text: string; avatar: string }> = {
  approve: { text: "text-green-500", avatar: "bg-green-500/15 text-green-500" },
  maybe: { text: "text-amber-500", avatar: "bg-amber-500/15 text-amber-500" },
  disapprove: { text: "text-red-500", avatar: "bg-red-500/15 text-red-500" },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStorageKey(shareToken: string): string {
  return `sb:casting-reviewer:${shareToken}`
}

function loadReviewer(shareToken: string): ReviewerIdentity | null {
  try {
    const raw = localStorage.getItem(getStorageKey(shareToken))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { name?: string; email?: string }
    if (typeof parsed.name === "string" && typeof parsed.email === "string" && parsed.name && parsed.email) {
      return { name: parsed.name, email: parsed.email }
    }
    return null
  } catch {
    return null
  }
}

function saveReviewer(shareToken: string, identity: ReviewerIdentity): void {
  localStorage.setItem(getStorageKey(shareToken), JSON.stringify(identity))
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function formatMeasurements(
  measurements: Record<string, string | number | null> | null | undefined,
): string | null {
  if (!measurements) return null
  const parts: string[] = []
  for (const [key, val] of Object.entries(measurements)) {
    if (val != null && val !== "") {
      parts.push(`${key} ${String(val)}`)
    }
  }
  return parts.length > 0 ? parts.join(" \u00B7 ") : null
}

// ---------------------------------------------------------------------------
// PublicCastingCard
// ---------------------------------------------------------------------------

function PublicCastingCard(props: {
  readonly talent: ResolvedCastingTalent
  readonly visibleFields: CastingShareVisibility
  readonly voteState: TalentVoteState
  readonly otherVotes: readonly OtherVote[]
  readonly showVoteTallies: boolean
  readonly identified: boolean
  readonly onVote: (talentId: string, decision: CastingVoteDecision | null) => void
  readonly onCommentChange: (talentId: string, comment: string) => void
  readonly onCommentBlur: (talentId: string) => void
}) {
  const {
    talent,
    visibleFields,
    voteState,
    otherVotes,
    showVoteTallies,
    identified,
    onVote,
    onCommentChange,
    onCommentBlur,
  } = props

  const measurementText =
    visibleFields.measurements ? formatMeasurements(talent.measurements) : null

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      {/* Headshot */}
      {talent.headshotUrl ? (
        <img
          src={talent.headshotUrl}
          alt={talent.name}
          className="aspect-[3/4] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-[var(--color-surface-subtle)]">
          <span className="text-2xl font-semibold text-[var(--color-text-subtle)]">
            {getInitials(talent.name)}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Name + agency */}
        <div>
          <div className="text-base font-semibold text-[var(--color-text)]">{talent.name}</div>
          {visibleFields.agency && talent.agency && (
            <div className="text-sm text-[var(--color-text-muted)]">{talent.agency}</div>
          )}
        </div>

        {/* Measurements */}
        {measurementText && (
          <div className="text-xs text-[var(--color-text-muted)]">{measurementText}</div>
        )}

        {/* Role label */}
        {talent.roleLabel && (
          <div className="inline-flex self-start rounded border border-[var(--color-border)] px-2 py-0.5 text-2xs text-[var(--color-text-secondary)]">
            {talent.roleLabel}
          </div>
        )}

        {/* Vote buttons */}
        <div className="flex gap-2">
          {VOTE_OPTIONS.map((opt) => {
            const isSelected = voteState.decision === opt.decision
            return (
              <button
                key={opt.decision}
                type="button"
                disabled={!identified}
                onClick={() =>
                  onVote(talent.talentId, isSelected ? null : opt.decision)
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded border text-sm transition-colors ${
                  isSelected
                    ? opt.selectedClass
                    : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
                } min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="text-base">{opt.emoji}</span>
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Comment input */}
        <textarea
          value={voteState.comment}
          onChange={(e) => onCommentChange(talent.talentId, e.target.value)}
          onBlur={() => onCommentBlur(talent.talentId)}
          placeholder={identified ? "Add a note\u2026" : "Enter your info above to comment"}
          disabled={!identified}
          rows={1}
          className="w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Other reviewers' votes */}
        {showVoteTallies && otherVotes.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="mb-2 text-3xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
              Other reviews
            </div>
            <div className="flex flex-col gap-1.5">
              {otherVotes.map((v) => {
                const colors = DECISION_COLOR_CLASSES[v.decision]
                return (
                  <div key={v.reviewerEmail} className="flex items-center gap-2">
                    <div
                      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-3xs font-semibold ${colors.avatar}`}
                    >
                      {getInitials(v.reviewerName)}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {v.reviewerName}
                    </span>
                    <span className={`ml-auto text-xxs ${colors.text}`}>
                      {DECISION_LABELS[v.decision]}
                    </span>
                  </div>
                )
              })}

              {/* Other reviewer comments */}
              {otherVotes
                .filter((v) => v.comment)
                .map((v) => (
                  <div
                    key={`comment-${v.reviewerEmail}`}
                    className="mt-1 rounded border-l-2 border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2"
                  >
                    <div className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {v.comment}
                    </div>
                    <div className="mt-1 text-3xs text-[var(--color-text-subtle)]">
                      {v.reviewerName}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PublicCastingReviewPage() {
  const { shareToken } = useParams<{ shareToken: string }>()

  // Data
  const [talent, setTalent] = useState<readonly ResolvedCastingTalent[]>([])
  const [title, setTitle] = useState("")
  const [visibleFields, setVisibleFields] = useState<CastingShareVisibility>({
    agency: true,
    measurements: true,
    portfolio: false,
    castingNotes: false,
  })
  const [instructions, setInstructions] = useState<string | null>(null)
  const [showVoteTallies, setShowVoteTallies] = useState(false)

  // UI states
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)

  // Reviewer identity
  const [reviewer, setReviewer] = useState<ReviewerIdentity | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [showIdentityForm, setShowIdentityForm] = useState(false)

  // Votes: talentId -> vote state
  const [voteStates, setVoteStates] = useState<Record<string, TalentVoteState>>({})
  // Other reviewers' votes: talentId -> other votes
  const [otherVotesMap, setOtherVotesMap] = useState<Record<string, readonly OtherVote[]>>({})

  // Load reviewer identity from localStorage
  useEffect(() => {
    if (!shareToken) return
    const stored = loadReviewer(shareToken)
    if (stored) {
      setReviewer(stored)
    } else {
      setShowIdentityForm(true)
    }
  }, [shareToken])

  // Load share data + votes
  useEffect(() => {
    let active = true

    const load = async () => {
      if (!shareToken || shareToken.length < 10) {
        setErrorInfo({
          heading: "Invalid link",
          message: "This casting review link is invalid.",
        })
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorInfo(null)

      try {
        const shareRef = doc(db, "castingShares", shareToken)
        const snap = await getDoc(shareRef)

        if (!active) return

        if (!snap.exists()) {
          setErrorInfo({
            heading: "Link not found",
            message: "This casting review link is invalid. It may have been deleted.",
          })
          setLoading(false)
          return
        }

        const data = snap.data() as Record<string, unknown>

        if (data.enabled !== true) {
          setErrorInfo({
            heading: "Link expired",
            message: "This casting review link has expired or been disabled.",
          })
          setLoading(false)
          return
        }

        // Check expiration
        if (data.expiresAt) {
          try {
            const expiresAt = (data.expiresAt as { toDate: () => Date }).toDate()
            if (expiresAt.getTime() < Date.now()) {
              setErrorInfo({
                heading: "Link expired",
                message: "This casting review link has expired. Ask the sender for a new one.",
              })
              setLoading(false)
              return
            }
          } catch {
            // Ignore malformed expiresAt
          }
        }

        const resolvedTalent = Array.isArray(data.resolvedTalent)
          ? (data.resolvedTalent as ResolvedCastingTalent[])
          : []
        const shareTitle = typeof data.title === "string" ? data.title : "Casting Review"
        const shareVisibility = data.visibleFields as CastingShareVisibility | undefined
        const shareInstructions =
          typeof data.reviewerInstructions === "string" ? data.reviewerInstructions : null
        const shareShowTallies = data.showVoteTallies === true

        setTalent(resolvedTalent)
        setTitle(shareTitle)
        if (shareVisibility) setVisibleFields(shareVisibility)
        setInstructions(shareInstructions)
        setShowVoteTallies(shareShowTallies)

        // Load existing votes
        const votesCol = collection(db, "castingShares", shareToken, "votes")
        const votesSnap = await getDocs(votesCol)

        if (!active) return

        const otherMap: Record<string, OtherVote[]> = {}
        const myVotes: Record<string, TalentVoteState> = {}
        const storedReviewer = loadReviewer(shareToken)
        const myEmail = storedReviewer?.email?.trim().toLowerCase() ?? null

        for (const vDoc of votesSnap.docs) {
          const vData = vDoc.data() as {
            talentId?: string
            reviewerEmail?: string
            reviewerName?: string
            decision?: CastingVoteDecision
            comment?: string | null
          }

          if (!vData.talentId || !vData.decision) continue

          const voteEmail = typeof vData.reviewerEmail === "string"
            ? vData.reviewerEmail.trim().toLowerCase()
            : ""

          if (myEmail && voteEmail === myEmail) {
            myVotes[vData.talentId] = {
              decision: vData.decision,
              comment: vData.comment ?? "",
            }
          } else {
            const existing = otherMap[vData.talentId] ?? []
            otherMap[vData.talentId] = [
              ...existing,
              {
                reviewerName: vData.reviewerName ?? "Anonymous",
                reviewerEmail: voteEmail,
                decision: vData.decision,
                comment: vData.comment ?? null,
              },
            ]
          }
        }

        setVoteStates(myVotes)
        setOtherVotesMap(otherMap)
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error("[PublicCastingReviewPage] Failed to load:", err)
        setErrorInfo({
          heading: "Failed to load",
          message: "Something went wrong. Please check the link and try again.",
        })
        setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [shareToken])

  // Identity form submit
  const handleIdentitySubmit = useCallback(() => {
    const trimmedName = nameInput.trim()
    const trimmedEmail = emailInput.trim().toLowerCase()
    if (!trimmedName || !trimmedEmail || !shareToken) return

    const identity: ReviewerIdentity = { name: trimmedName, email: trimmedEmail }
    saveReviewer(shareToken, identity)
    setReviewer(identity)
    setShowIdentityForm(false)
  }, [nameInput, emailInput, shareToken])

  // Change reviewer identity
  const handleChangeIdentity = useCallback(() => {
    if (reviewer) {
      setNameInput(reviewer.name)
      setEmailInput(reviewer.email)
    }
    setShowIdentityForm(true)
  }, [reviewer])

  // Vote handler
  const handleVote = useCallback(
    (talentId: string, decision: CastingVoteDecision | null) => {
      if (!reviewer || !shareToken) return

      const prev = voteStates[talentId] ?? { decision: null, comment: "" }

      if (decision === null) {
        // Clear vote: set to null locally. We still write to Firestore with "approve"
        // then immediately the user sees it cleared. For a true clear we write a neutral state.
        // Since the schema only supports approve/maybe/disapprove, toggling off re-submits is
        // handled by not showing a selected state. We won't write a null decision to Firestore.
        setVoteStates((s) => ({
          ...s,
          [talentId]: { ...prev, decision: null },
        }))
        return
      }

      setVoteStates((s) => ({
        ...s,
        [talentId]: { ...prev, decision },
      }))

      void submitCastingVote({
        shareToken,
        talentId,
        reviewerEmail: reviewer.email,
        reviewerName: reviewer.name,
        decision,
        comment: prev.comment || null,
      }).catch((err) => {
        console.error("[PublicCastingReviewPage] Vote failed:", err)
      })
    },
    [reviewer, shareToken, voteStates],
  )

  // Comment change (local only)
  const handleCommentChange = useCallback((talentId: string, comment: string) => {
    setVoteStates((s) => {
      const prev = s[talentId] ?? { decision: null, comment: "" }
      return { ...s, [talentId]: { ...prev, comment } }
    })
  }, [])

  // Comment blur: persist to Firestore if there's a vote
  const handleCommentBlur = useCallback(
    (talentId: string) => {
      if (!reviewer || !shareToken) return
      const state = voteStates[talentId]
      if (!state?.decision) return

      void submitCastingVote({
        shareToken,
        talentId,
        reviewerEmail: reviewer.email,
        reviewerName: reviewer.name,
        decision: state.decision,
        comment: state.comment || null,
      }).catch((err) => {
        console.error("[PublicCastingReviewPage] Comment save failed:", err)
      })
    },
    [reviewer, shareToken, voteStates],
  )

  // Progress
  const reviewedCount = useMemo(() => {
    return talent.filter((t) => voteStates[t.talentId]?.decision != null).length
  }, [talent, voteStates])

  const progressPct = talent.length > 0 ? (reviewedCount / talent.length) * 100 : 0

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />

  if (errorInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="heading-subsection">{errorInfo.heading}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{errorInfo.message}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-bg)]">
        {/* Header */}
        <header className="border-b border-[var(--color-border)] px-4 py-4">
          <div className="mx-auto max-w-5xl">
            <span className="mb-2 inline-block rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Casting Review
            </span>
            <h1 className="heading-page">{title}</h1>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {talent.length} talent for review
            </p>
          </div>
        </header>

        {/* Reviewer instructions */}
        {instructions && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3">
            <div className="mx-auto max-w-5xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {instructions}
            </div>
          </div>
        )}

        {/* Reviewer identity banner (sticky, solid bg to prevent content bleed-through) */}
        <div className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 shadow-sm">
          <div className="mx-auto max-w-5xl">
            {showIdentityForm ? (
              <div>
                <p className="mb-2.5 text-sm text-[var(--color-text-muted)]">
                  Enter your info to review
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Your name"
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleIdentitySubmit()
                    }}
                  />
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Email address"
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleIdentitySubmit()
                    }}
                  />
                  <Button
                    onClick={handleIdentitySubmit}
                    disabled={!nameInput.trim() || !emailInput.trim()}
                    className="bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : reviewer ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-2xs font-semibold text-[var(--color-accent)]">
                    {getInitials(reviewer.name)}
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-text)]">
                      Reviewing as {reviewer.name}
                    </div>
                    <div className="text-xxs text-[var(--color-text-muted)]">
                      {reviewer.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleChangeIdentity}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Change
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Talent grid */}
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">
          {talent.length === 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No talent to review.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {talent.map((t) => (
                <PublicCastingCard
                  key={t.talentId}
                  talent={t}
                  visibleFields={visibleFields}
                  voteState={voteStates[t.talentId] ?? { decision: null, comment: "" }}
                  otherVotes={otherVotesMap[t.talentId] ?? []}
                  showVoteTallies={showVoteTallies}
                  identified={reviewer != null}
                  onVote={handleVote}
                  onCommentChange={handleCommentChange}
                  onCommentBlur={handleCommentBlur}
                />
              ))}
            </div>
          )}
        </main>

        {/* Progress footer (sticky bottom) */}
        {talent.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2.5">
            <div className="mx-auto max-w-5xl">
              <p className="mb-1.5 text-center text-xs text-[var(--color-text-muted)]">
                Reviewed{" "}
                <span className="font-medium text-[var(--color-text)]">
                  {reviewedCount} of {talent.length}
                </span>
              </p>
              <div className="mx-auto h-[3px] max-w-[600px] overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
