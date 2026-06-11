// Shoot shell — the compact on-set shot surface (Phase 5e-II, spec §PR partition 5e-II).
//
// Mounted by ShotDetailPageUnified INSTEAD of the editor body when
// `featureShootSurface` is ON and the resolved surface === 'shoot'
// (surface-keyed, not device-keyed — tablet/desktop crew get this same shell
// centered at desktop density, Decision F). This is a PRESENTATION choice,
// not a permission boundary (spec §Rules-vs-UI): crew's rules-level edit
// grant is full-field; the read-only blocks here are layout, not enforcement.
//
// Composition, phone-first (locked decisions A/B/D/F/G):
//   minimal top bar (explicit Back → the shots list, NEVER navigate(-1);
//   'N of M' position from the per-tab nav order) → shot identity (shot# /
//   title / read-only talent line — one typographic line each, DESIGN.md
//   meta-line law) → hero read-only (Decision B) → comments (today's
//   double gate carries over inside ShotCommentsSection — do not collapse) →
//   scene direction FULL text (laneById from useShotDetailBundle, zero new
//   reads; quietly absent when lanesUnavailable / no lane / no direction) →
//   read-only product list → prev/next large tap targets over the nav order
//   ([ / ] hardware keys kept) → STICKY BOTTOM status tap-row (Decision A,
//   thumb zone, safe-area padded).
//
// Planning fields are deliberately ABSENT (field→job principle): no
// InlineEdit/date/location/talent/tags/looks editors, no lifecycle menu, no
// share, no upload, no version history.
//
// Legacy shots (projectId === '', Decision D): the status tap-row renders
// disabled with a quiet one-line note — comments stay enabled (rules allow).
//
// Offline posture (Decision C): Firestore now runs on a durable local cache
// (firebase.ts, app-wide), so offline taps/comments queue on-device and sync
// on reconnect. The shell surfaces two honest signals — the app-wide
// OfflineBanner (AppShell, navigator.onLine) covers "you are offline"; this
// shell adds a pending indicator above the tap-row (hasPendingWrites via
// useShotPendingWrites) and hands the comment composer its queued-post
// affordance (`offline` prop). No custom sync engine.
import { useEffect, useMemo, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShotDetailBundle } from "@/features/shots/hooks/useShotDetailBundle"
import { useShotPendingWrites } from "@/features/shots/hooks/useShotPendingWrites"
import { useTalent } from "@/features/shots/hooks/usePickerData"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import { ShotStatusTapRow } from "@/features/shots/components/ShotStatusTapRow"
import { ProductColorwayStrip } from "@/features/shots/components/ProductColorwayStrip"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import { readShotListNavOrder } from "@/features/shots/lib/shotListNavOrder"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { canManageShots } from "@/shared/lib/rbac"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus"
import { Button } from "@/ui/button"

export function ShootShotDetail() {
  const { sid } = useParams<{ sid: string }>()
  const navigate = useNavigate()
  const { shot, laneById, loading, error } = useShotDetailBundle(sid)
  const { clientId } = useAuth()
  const { projectName } = useProjectScope()
  // Role term stays at the consumer (presentation-only law): the shell only
  // mounts for the shoot surface (crew), but the operational gate below is
  // still spelled from rbac, never inferred from the resolver output.
  const { role, resolving: roleResolving } = useEffectiveRole()
  const { data: talentRecords } = useTalent()
  // Decision C offline affordances — two honest signals, no sync engine:
  // navigator.onLine (radio state; same signal as the app-wide OfflineBanner
  // in AppShell) + the shot doc's hasPendingWrites metadata (write queued in
  // the durable cache, unacked by the server).
  const online = useOnlineStatus()
  const pendingWrite = useShotPendingWrites(sid)

  const talentNameById = useMemo(
    () => new Map(talentRecords.map((t) => [t.id, t.name])),
    [talentRecords],
  )

  // Explicit back target — NEVER navigate(-1): deep-linked / new-tab on-set
  // phones exit the app on history-back. Legacy shots have no project; fall
  // back to the projects dashboard quietly.
  const goToList = () => {
    if (!shot) return
    navigate(shot.projectId ? `/projects/${shot.projectId}/shots` : "/projects")
  }

  // Prev/next over the SAME order source as the editor's [ / ] keys — the
  // per-tab sessionStorage nav order. Read fresh at action time. Deep links /
  // new tabs have no snapshot: the tap targets render disabled, no fallback
  // order is invented (contract: nothing-disabled when absent).
  const goPrevNext = (delta: -1 | 1) => {
    if (!shot || !clientId || !shot.projectId) return
    const orderIds = readShotListNavOrder(clientId, shot.projectId)
    if (!orderIds) return
    const currentIndex = orderIds.indexOf(shot.id)
    if (currentIndex === -1) return
    const targetId = orderIds[currentIndex + delta]
    if (!targetId) return
    navigate(`/projects/${shot.projectId}/shots/${targetId}`)
  }

  // Hardware-keyboard parity with the editor: Escape → the explicit list
  // target (not -1), [ / ] prev-next. useKeyboardShortcuts already skips
  // input/textarea/contentEditable targets, so the comment composer is safe.
  useKeyboardShortcuts([
    { key: "Escape", handler: goToList },
    { key: "[", handler: () => goPrevNext(-1) },
    { key: "]", handler: () => goPrevNext(1) },
  ])

  // Deleted-shot guard — same effect-based one-shot shape as the editor body.
  const deletedHandledRef = useRef(false)
  useEffect(() => {
    if (shot?.deleted !== true || deletedHandledRef.current) return
    deletedHandledRef.current = true
    navigate(shot.projectId ? `/projects/${shot.projectId}/shots` : "/projects", {
      replace: true,
    })
    toast.info("This shot has been archived.")
  }, [shot?.deleted, shot?.projectId, navigate])

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    )
  }
  if (!shot) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Shot not found.</p>
      </div>
    )
  }
  if (shot.deleted === true) return null

  // Decision D: legacy shots are crew-uneditable at the rules level
  // (shotProjectRole's legacy arm admits only admin/global-producer) — render
  // read-only instead of letting the primary tap guarantee a denied toast.
  const isLegacy = shot.projectId === ""
  const canOperate = !roleResolving && canManageShots(role)

  const orderIds =
    clientId && shot.projectId ? readShotListNavOrder(clientId, shot.projectId) : null
  const orderIndex = orderIds ? orderIds.indexOf(shot.id) : -1
  const hasOrder = orderIds !== null && orderIndex !== -1
  const prevId = hasOrder && orderIndex > 0 ? orderIds![orderIndex - 1] : null
  const nextId =
    hasOrder && orderIndex < orderIds!.length - 1 ? orderIds![orderIndex + 1] : null

  const talentIds = shot.talentIds ?? shot.talent ?? []
  const resolvedTalentNames = talentIds
    .map((id) => talentNameById.get(id))
    .filter((name): name is string => Boolean(name && name.trim()))
  const talentLine =
    talentIds.length === 0
      ? "—"
      : resolvedTalentNames.length > 0
        ? resolvedTalentNames.join(" · ")
        : `${talentIds.length} assigned`

  const lane = shot.laneId ? laneById.get(shot.laneId) : undefined
  const direction = lane?.direction?.trim()

  return (
    <ErrorBoundary>
      {/* Single column phone-first; tablet/desktop center at desktop density
          (max-width container, Decision F) — no separate desktop layout. */}
      <div className="mx-auto flex w-full max-w-2xl flex-col" data-testid="shoot-shell">
        {/* ── Minimal top bar: explicit Back + project + position counter ── */}
        <div className="flex items-center gap-2 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToList}
            className="gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            data-testid="shoot-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Shots
          </Button>
          <div className="ml-auto min-w-0 text-right">
            {projectName && (
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {projectName}
              </p>
            )}
            {hasOrder && (
              <p
                className="text-xs tabular-nums text-[var(--color-text-subtle)]"
                data-testid="shoot-shot-counter"
              >
                {orderIndex + 1} of {orderIds!.length}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* ── Shot identity — one typographic line per fact ── */}
          <header className="flex flex-col gap-1.5" data-testid="shoot-shot-identity">
            <span className="text-2xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Shot{shot.shotNumber ? ` #${shot.shotNumber}` : ""}
            </span>
            <div className="flex flex-wrap items-baseline text-3xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-serif)]">
                {shot.title || "Untitled Shot"}
              </h1>
              {/* The iconic period — the single red accent (DESIGN.md masthead law). */}
              <span className="iconic-period" aria-hidden="true">
                .
              </span>
            </div>
            <p
              className="text-sm text-[var(--color-text-secondary)]"
              data-testid="shoot-talent-line"
            >
              <span className="text-3xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                Talent
              </span>{" "}
              &middot; <span className="font-medium text-[var(--color-text)]">{talentLine}</span>
            </p>
          </header>

          {/* ── Hero / reference imagery — read-only (Decision B): on a photo
              set the reference image IS the execution read. Renders nothing
              quietly when there is no hero (display path, canUpload=false). ── */}
          <HeroImageSection
            heroImage={shot.heroImage}
            shot={shot}
            shotId={shot.id}
            canUpload={false}
            frame="natural"
          />

          {/* ── Comments — the section's global-claim double gate carries over
              unchanged (collapse is a 5f Q4 decision; do NOT collapse here). ── */}
          <ShotCommentsSection
            shotId={shot.id}
            canComment={canOperate}
            offline={!online}
          />

          {/* ── Scene direction — FULL text from the lanes bundle (zero new
              reads). Quietly absent when lanesUnavailable / no lane / empty. ── */}
          {direction && (
            <section data-testid="shoot-scene-direction">
              <SectionLabel>Scene direction</SectionLabel>
              {lane?.name && (
                <p className="mt-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
                  {lane.name}
                </p>
              )}
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                {direction}
              </p>
            </section>
          )}

          {/* ── Read-only product list (the extracted 5e/5f seam). ── */}
          <ProductColorwayStrip
            looks={shot.looks ?? []}
            activeLookId={shot.activeLookId}
            readOnly
          />

          {/* ── Shot-to-shot navigation — large tap targets over the nav
              order; disabled at the ends and on deep links (no snapshot). ── */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12 justify-start gap-1.5"
              disabled={!prevId}
              onClick={() => goPrevNext(-1)}
              data-testid="shoot-prev"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-end gap-1.5"
              disabled={!nextId}
              onClick={() => goPrevNext(1)}
              data-testid="shoot-next"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Status tap-row — STICKY BOTTOM-ANCHORED (Decision A, thumb
            zone), safe-area padded. Legacy: disabled + quiet note; the role
            term (canManageShots) stays spelled at this consumer. ── */}
        <div
          className="sticky bottom-0 z-10 mt-5 border-t border-[var(--color-border)] bg-[var(--color-surface)] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          data-testid="shoot-status-bar"
        >
          {isLegacy && (
            <p
              className="mb-2 text-xs text-[var(--color-text-muted)]"
              data-testid="shoot-legacy-note"
            >
              Legacy shot — ask a producer to file it under a project
            </p>
          )}
          {/* Pending indicator (Decision C): hasPendingWrites = the write is
              queued in the durable local cache, unacked. Copy forks on the
              radio signal — online means it is actively syncing, offline
              means it is safe on-device and sends on reconnect. */}
          {pendingWrite && (
            <p
              className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
              data-testid="shoot-pending-indicator"
              role="status"
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-status-amber-text)]"
                aria-hidden="true"
              />
              {online
                ? "Syncing…"
                : "Saved on this device — syncs when you’re back online"}
            </p>
          )}
          <ShotStatusTapRow shot={shot} disabled={isLegacy || !canOperate} />
        </div>
      </div>
    </ErrorBoundary>
  )
}
