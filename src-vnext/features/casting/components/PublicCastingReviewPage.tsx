import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { ImageLightbox } from "@/shared/components/ImageLightbox"
import { submitCastingVote } from "@/features/casting/lib/castingWrites"
import { PublicCastingCard, getInitials, type TalentVoteState } from "@/features/casting/components/PublicCastingCard"
import { TalentDetailSheet } from "@/features/casting/components/TalentDetailSheet"
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

type OtherVote = {
  readonly reviewerName: string
  readonly reviewerEmail: string
  readonly decision: CastingVoteDecision
  readonly comment: string | null
}

type LightboxState = {
  readonly images: readonly string[]
  readonly index: number
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
    if (
      typeof parsed.name === "string" &&
      typeof parsed.email === "string" &&
      parsed.name &&
      parsed.email
    ) {
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


// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PublicCastingReviewPage() {
  const { shareToken } = useParams<{ shareToken: string }>()

  // Share data
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
  const [otherVotesMap, setOtherVotesMap] = useState<
    Record<string, readonly OtherVote[]>
  >({})

  // Detail sheet
  const [sheetTalentId, setSheetTalentId] = useState<string | null>(null)

  // Page-level lightbox (for portfolio thumbnail strip clicks)
  const [lightboxState, setLightboxState] = useState<LightboxState | null>(null)

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
                message:
                  "This casting review link has expired. Ask the sender for a new one.",
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
        const shareTitle =
          typeof data.title === "string" ? data.title : "Casting Review"
        const shareVisibility = data.visibleFields as CastingShareVisibility | undefined
        const shareInstructions =
          typeof data.reviewerInstructions === "string"
            ? data.reviewerInstructions
            : null
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
            decision?: string
            comment?: string | null
          }

          // 'withdrawn' votes are treated as "not voted" — skip them entirely
          if (!vData.talentId || !vData.decision || vData.decision === "withdrawn") {
            continue
          }

          const decision = vData.decision as CastingVoteDecision

          const voteEmail =
            typeof vData.reviewerEmail === "string"
              ? vData.reviewerEmail.trim().toLowerCase()
              : ""

          if (myEmail && voteEmail === myEmail) {
            myVotes[vData.talentId] = {
              decision,
              comment: vData.comment ?? "",
            }
          } else {
            const existing = otherMap[vData.talentId] ?? []
            otherMap[vData.talentId] = [
              ...existing,
              {
                reviewerName: vData.reviewerName ?? "Anonymous",
                reviewerEmail: voteEmail,
                decision,
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

  const handleChangeIdentity = useCallback(() => {
    if (reviewer) {
      setNameInput(reviewer.name)
      setEmailInput(reviewer.email)
    }
    setShowIdentityForm(true)
  }, [reviewer])

  /**
   * Vote handler.
   * Toggling the same decision writes 'withdrawn' to Firestore instead of null,
   * so the vote doc exists but is excluded from tallies.
   *
   * IMPORTANT: Firestore rules must allow 'withdrawn' as a decision value.
   * See the TODO comment on TalentVoteState above.
   */
  const handleVote = useCallback(
    (talentId: string, decision: CastingVoteDecision | null) => {
      if (!reviewer || !shareToken) return

      const prev = voteStates[talentId] ?? { decision: null, comment: "" }

      if (decision === null) {
        // Toggle off: write 'withdrawn' to Firestore so the doc exists but is
        // excluded from progress tracking and other-vote displays.
        const prevDecision = prev.decision
        setVoteStates((s) => ({
          ...s,
          [talentId]: { ...prev, decision: null },
        }))

        void submitCastingVote({
          shareToken,
          talentId,
          reviewerEmail: reviewer.email,
          reviewerName: reviewer.name,
          decision: "withdrawn",
          comment: null,
        }).catch(() => {
          // Rollback optimistic update on failure
          setVoteStates((s) => ({
            ...s,
            [talentId]: { ...prev, decision: prevDecision },
          }))
        })
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

  // Comment blur: persist to Firestore only if there's a real vote
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

  // Open detail sheet
  const handleOpenDetail = useCallback((talentId: string) => {
    setSheetTalentId(talentId)
  }, [])

  // Portfolio thumbnail click: collect all images for this talent and open lightbox
  const handlePortfolioImageClick = useCallback(
    (talentId: string, index: number) => {
      const t = talent.find((x) => x.talentId === talentId)
      if (!t) return
      const images = [
        ...(t.castingImageUrls ?? []),
        ...t.galleryUrls,
      ]
      if (images.length === 0) return
      setLightboxState({ images, index })
    },
    [talent],
  )

  // Progress: 'withdrawn' and null both count as not voted
  const reviewedCount = useMemo(() => {
    return talent.filter((t) => voteStates[t.talentId]?.decision != null).length
  }, [talent, voteStates])

  const progressPct = talent.length > 0 ? (reviewedCount / talent.length) * 100 : 0

  const sheetTalent = talent.find((t) => t.talentId === sheetTalentId) ?? null
  const sheetVoteState = sheetTalent
    ? (voteStates[sheetTalent.talentId] ?? { decision: null, comment: "" })
    : { decision: null, comment: "" }

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

        {/* Reviewer identity banner */}
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
                  onOpenDetail={handleOpenDetail}
                  onPortfolioImageClick={handlePortfolioImageClick}
                />
              ))}
            </div>
          )}
        </main>

        {/* Progress footer */}
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

        {/* Detail sheet (single instance) */}
        <TalentDetailSheet
          talent={sheetTalent}
          open={sheetTalentId !== null}
          onOpenChange={(v) => { if (!v) setSheetTalentId(null) }}
          visibleFields={visibleFields}
          voteState={sheetVoteState}
          identified={reviewer != null}
          onVote={handleVote}
          onCommentChange={handleCommentChange}
          onCommentBlur={handleCommentBlur}
        />

        {/* Page-level lightbox for portfolio thumbnail strip */}
        {lightboxState && (
          <ImageLightbox
            open
            onOpenChange={(v) => { if (!v) setLightboxState(null) }}
            images={lightboxState.images}
            initialIndex={lightboxState.index}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
