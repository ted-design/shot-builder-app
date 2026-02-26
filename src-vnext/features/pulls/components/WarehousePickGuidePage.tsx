import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { collectionGroup, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { WarehousePickProgress } from "./WarehousePickProgress"
import { WarehousePickStep } from "./WarehousePickStep"
import { WarehousePickOutcomeBar, type PickOutcome } from "./WarehousePickOutcomeBar"
import { mapPull } from "@/features/pulls/lib/mapPull"
import type { Pull, PullItem } from "@/shared/types"
import { ArrowLeft, ClipboardList } from "lucide-react"

interface ItemOutcome {
  readonly itemId: string
  readonly outcome: PickOutcome
  readonly substituteNote?: string
}

export default function WarehousePickGuidePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const navigate = useNavigate()
  const [pull, setPull] = useState<Pull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<readonly ItemOutcome[]>([])
  const [substituteNote, setSubstituteNote] = useState("")
  const [awaitingSubNote, setAwaitingSubNote] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!shareToken) {
        setError("No share token provided.")
        setLoading(false)
        return
      }

      try {
        const pullsRef = collectionGroup(db, "pulls")
        const q = query(
          pullsRef,
          where("shareToken", "==", shareToken),
          where("shareEnabled", "==", true),
          limit(1),
        )
        const snapshot = await getDocs(q)
        if (!active) return

        if (snapshot.empty) {
          setError("Pull not found or sharing is disabled.")
          setLoading(false)
          return
        }

        const doc = snapshot.docs[0]!
        setPull(mapPull(doc.id, doc.data() as Record<string, unknown>))
        setLoading(false)
      } catch {
        if (!active) return
        setError("Failed to load pull. Please check the link and try again.")
        setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [shareToken])

  const items: readonly PullItem[] = pull?.items ?? []
  const isComplete = currentIndex >= items.length

  const recordOutcome = useCallback((outcome: PickOutcome) => {
    const item = items[currentIndex]
    if (!item?.id) return

    if (outcome === "substitute") {
      setAwaitingSubNote(true)
      return
    }

    setOutcomes((prev) => [...prev, { itemId: item.id!, outcome }])
    setCurrentIndex((prev) => prev + 1)
  }, [currentIndex, items])

  const confirmSubstitute = useCallback(() => {
    const item = items[currentIndex]
    if (!item?.id) return

    setOutcomes((prev) => [
      ...prev,
      { itemId: item.id!, outcome: "substitute", substituteNote: substituteNote.trim() || undefined },
    ])
    setSubstituteNote("")
    setAwaitingSubNote(false)
    setCurrentIndex((prev) => prev + 1)
  }, [currentIndex, items, substituteNote])

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-base font-semibold text-[var(--color-text)]">Access denied</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  if (!pull) return null

  const title = pull.title || pull.name || "Pull Sheet"

  // -- Landing screen --
  if (!started) {
    return (
      <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="touch-target"
            onClick={() => navigate(`/pulls/shared/${shareToken}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-[var(--color-text)]">{title}</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <ClipboardList className="h-16 w-16 text-[var(--color-text-subtle)]" />
          <div>
            <p className="text-lg font-semibold text-[var(--color-text)]">Guided Pick</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {items.length} items to pick
            </p>
          </div>
          <Button
            className="min-h-[56px] w-full max-w-xs touch-target text-lg"
            onClick={() => setStarted(true)}
            disabled={items.length === 0}
            data-testid="start-picking"
          >
            Start Picking
          </Button>
        </div>
      </div>
      </ErrorBoundary>
    )
  }

  // -- Completion screen --
  if (isComplete) {
    const picked = outcomes.filter((o) => o.outcome === "picked").length
    const notAvailable = outcomes.filter((o) => o.outcome === "not_available").length
    const substituted = outcomes.filter((o) => o.outcome === "substitute").length

    return (
      <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <h1 className="text-base font-semibold text-[var(--color-text)]">Pick Complete</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="flex flex-col gap-3">
            <p className="text-3xl font-bold text-emerald-600">{picked}</p>
            <p className="text-sm text-[var(--color-text-muted)]">Picked</p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <p className="text-xl font-semibold text-red-600">{notAvailable}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Not Available</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <p className="text-xl font-semibold text-amber-600">{substituted}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Substituted</p>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Hand off to your producer for review.
          </p>
          <Button
            variant="outline"
            className="touch-target"
            onClick={() => navigate(`/pulls/shared/${shareToken}`)}
          >
            Back to Pull Sheet
          </Button>
        </div>
      </div>
      </ErrorBoundary>
    )
  }

  // -- Active picking --
  const currentItem = items[currentIndex]!

  return (
    <ErrorBoundary>
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <WarehousePickProgress current={outcomes.length} total={items.length} />

      <WarehousePickStep item={currentItem} />

      {awaitingSubNote ? (
        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <p className="text-sm font-medium text-[var(--color-text)]">Substitute note (optional)</p>
          <Input
            value={substituteNote}
            onChange={(e) => setSubstituteNote(e.target.value)}
            placeholder="e.g. Replaced with blue variant"
            autoFocus
          />
          <Button
            className="min-h-[56px] touch-target bg-amber-500 text-[var(--color-text-inverted)] hover:bg-amber-600"
            onClick={confirmSubstitute}
            data-testid="confirm-substitute"
          >
            Confirm Substitute
          </Button>
        </div>
      ) : (
        <WarehousePickOutcomeBar onOutcome={recordOutcome} />
      )}
    </div>
    </ErrorBoundary>
  )
}
