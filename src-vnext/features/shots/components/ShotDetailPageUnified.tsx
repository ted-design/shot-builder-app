// Unified two-column shot editor — the only shot detail surface (rendered unconditionally by ShotDetailPage since Phase 5c).
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Breadcrumbs } from "@/shared/components/Breadcrumbs"
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useShotDetailBundle } from "@/features/shots/hooks/useShotDetailBundle"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { ShotStatusTapRow } from "@/features/shots/components/ShotStatusTapRow"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { NotesSection } from "@/features/shots/components/NotesSection"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ActiveLookCoverReferencesPanel } from "@/features/shots/components/ActiveLookCoverReferencesPanel"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import { ShotVersionHistorySection } from "@/features/shots/components/ShotVersionHistorySection"
import { TagEditor } from "@/features/shots/components/TagEditor"
import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"
import { ShotReferenceLinksSection } from "@/features/shots/components/ShotReferenceLinksSection"
import { SceneContextBanner } from "@/features/shots/components/SceneContextBanner"
import { SceneDetailSheet } from "@/features/shots/components/SceneDetailSheet"
import { ShotDetailSidebar } from "@/features/shots/components/ShotDetailSidebar"
import { ShotDetailQuickAdd } from "@/features/shots/components/ShotDetailQuickAdd"
import { readShotListNavOrder } from "@/features/shots/lib/shotListNavOrder"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { formatDateOnly, parseDateOnly } from "@/features/shots/lib/dateOnly"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { EffectiveRoleChip } from "@/shared/components/EffectiveRoleChip"
import { canEditScene as canEditSceneForRole, canManageShots } from "@/shared/lib/rbac"
import { shotWriteErrorDescription } from "@/features/shots/lib/shotWriteError"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { textPreview } from "@/shared/lib/textPreview"
import {
  SectionLabel,
  ReadOnlyMetaValue,
  DescriptionEditor,
  DateEditor,
} from "@/features/shots/components/ShotDetailShared"
import { Button } from "@/ui/button"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { ActiveEditorsBar } from "@/features/shots/components/ActiveEditorsBar"
import { SHOT_STATUS_CYCLE } from "@/shared/lib/statusMappings"
import type { ShotLook } from "@/shared/types"

// ---------------------------------------------------------------------------
// Meta line segment (one editorial line replacing the three MetaEditorCards)
// ---------------------------------------------------------------------------

function MetaSegment({
  label,
  testId,
  children,
}: {
  readonly label: string
  readonly testId: string
  readonly children: React.ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5" data-testid={testId}>
      <span className="text-3xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
        {label}
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function MetaDot() {
  return (
    <span aria-hidden="true" className="text-[var(--color-text-subtle)]">
      &middot;
    </span>
  )
}

// ---------------------------------------------------------------------------
// Product colorway strip — pure-text typographic centerpiece (read-only; writes stay in the right rail).
// ---------------------------------------------------------------------------

function ProductColorwayStrip({
  looks,
  activeLookId,
}: {
  readonly looks: ReadonlyArray<ShotLook>
  readonly activeLookId: string | null | undefined
}) {
  const sorted = [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const productCount = sorted.reduce((acc, l) => acc + (l.products?.length ?? 0), 0)
  const resolvedActiveId =
    activeLookId && sorted.some((l) => l.id === activeLookId)
      ? activeLookId
      : sorted.length > 0
        ? sorted[0]!.id
        : null

  return (
    <section
      className="border-t border-[var(--color-border)] pt-4"
      data-testid="product-colorway-strip"
    >
      <div className="flex items-baseline gap-2">
        <SectionLabel>Products</SectionLabel>
        {sorted.length > 0 && (
          <span className="text-2xs text-[var(--color-text-subtle)]">
            {productCount} {productCount === 1 ? "item" : "items"} &middot; {sorted.length}{" "}
            {sorted.length === 1 ? "look" : "looks"}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
          No products yet. Add a look in the rail.
        </p>
      ) : (
        sorted.map((look) => (
          <div key={look.id} className="mt-3 first-of-type:mt-2">
            <p className="label-meta">
              {look.label || "Look"}
              {look.id === resolvedActiveId ? <> &middot; Active</> : null}
            </p>
            {(look.products ?? []).length === 0 ? (
              <p className="py-1 text-sm text-[var(--color-text-muted)]">
                No products in this look.
              </p>
            ) : (
              (look.products ?? []).map((p, i) => (
                <div
                  key={`${p.familyId}-${p.colourId ?? p.skuId ?? ""}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2.5 py-1"
                >
                  <span className="text-base font-semibold text-[var(--color-text)]">
                    {p.familyName ?? p.familyId}
                  </span>
                  {(p.colourName || p.size) && (
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {p.colourName && (
                        <>
                          &middot;{" "}
                          <span className="font-semibold text-[var(--color-text)]">
                            {p.colourName}
                          </span>
                        </>
                      )}
                      {p.size && <> &middot; {p.size}</>}
                    </span>
                  )}
                  {p.skuName && (
                    <span className="ml-auto text-2xs tabular-nums text-[var(--color-text-subtle)]">
                      {p.skuName}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        ))
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ShotDetailPageUnified() {
  const { sid } = useParams<{ sid: string }>()
  const navigate = useNavigate()
  const { shot, lanes, laneById, loading, error } = useShotDetailBundle(sid)
  const { role: globalRole, clientId, user } = useAuth()
  // 5b effective role: the project members doc WINS over the global claim
  // (locked Q5/Q6). Write affordances render NOTHING while the first uncached
  // member read for this project is in flight (resolving) — never the
  // global-role guess.
  const { role, resolving: roleResolving } = useEffectiveRole()
  const { projectName } = useProjectScope()

  // ONE device-authority read feeding named capability booleans. The rules
  // backstop shipped at 5b-I — mobile edit enablement is now Phase 5e's job
  // (mobile-crew edit / Shoot surface). Do NOT remove !isMobile here; 5e
  // removes it deliberately behind its own surface gating.
  // Backing rule for the shot writes below: hardened /shots
  // (firestore.rules:435-472, ['producer','crew'] arms).
  const isMobile = useIsMobile()
  const canEdit = !roleResolving && canManageShots(role) && !isMobile
  const canDoOperational = !roleResolving && canManageShots(role)
  const canManageLifecycle = !roleResolving && (role === "admin" || role === "producer") && !isMobile
  // PINNED to the GLOBAL claim: storage.rules sees only the auth token
  // (isProducerOrWardrobe, storage.rules:15-25 — no cross-service
  // firestore.get()), so a project-promoted crew still cannot upload and the
  // UI must not advertise it from the effective role.
  const canUploadShotImages = (globalRole === "admin" || globalRole === "producer") && !isMobile
  // NO role gate, by locked decision: export is device-only. The export
  // backend rules (exportTemplates firestore.rules:641-651, exportReports
  // :868-877) don't gate this affordance; the per-share export toggle is 5f.
  // Do not add an effective-role (or any role) source here.
  const canExport = !isMobile
  // PINNED to the GLOBAL claim: /shotShares create requires a global producer
  // claim (firestore.rules:193-204) — backend can't see a project promotion.
  const canShare = globalRole === "admin" || globalRole === "producer"
  const canComment = canDoOperational
  // Scene/lane writes consolidate on rbac.canEditScene, which mirrors the
  // /lanes rule (firestore.rules:880-882, :901-904 — already project-aware;
  // warehouse keeps lane-write until 5f per locked Q3).
  const canEditScene = !roleResolving && canEditSceneForRole(role)

  const [shareOpen, setShareOpen] = useState(false)
  const [sceneSheetOpen, setSceneSheetOpen] = useState(false)
  const [sceneSheetShotCount, setSceneSheetShotCount] = useState<number | undefined>(
    undefined,
  )

  const { search: locationSearch } = useLocation()

  // -- FAB integration: ?status_picker=1 (consume-only) and ?focus=notes --
  const [searchParams, setSearchParams] = useSearchParams()
  const notesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sp = searchParams.get("status_picker")
    const focus = searchParams.get("focus")
    let consumed = false

    if (sp === "1") {
      // Status picker will be handled by ShotStatusTapRow (5i) — for now just consume param
      consumed = true
    }
    if (focus === "notes" && notesRef.current) {
      notesRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
      consumed = true
    }
    if (consumed) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete("status_picker")
        next.delete("focus")
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Deleted-shot guard — effect-based since 5c (was a render-time legacy-parity
  // check). The ref keeps the navigate+toast one-shot under StrictMode's
  // double effect invoke.
  const deletedHandledRef = useRef(false)
  useEffect(() => {
    if (shot?.deleted !== true || deletedHandledRef.current) return
    deletedHandledRef.current = true
    navigate(`/projects/${shot.projectId}/shots`, { replace: true })
    toast.info("This shot has been archived.")
  }, [shot?.deleted, shot?.projectId, navigate])

  // Lazy one-shot count for SceneDetailSheet's "N shots in this scene" label.
  useEffect(() => {
    if (!sceneSheetOpen || !clientId || !shot?.laneId) {
      setSceneSheetShotCount(undefined)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const segs = shotsPath(clientId)
        const q = query(
          collection(db, segs[0]!, ...segs.slice(1)),
          where("projectId", "==", shot.projectId),
          where("laneId", "==", shot.laneId),
          where("deleted", "==", false),
        )
        const snap = await getCountFromServer(q)
        if (!cancelled) setSceneSheetShotCount(snap.data().count)
      } catch (err) {
        console.error("[ShotDetailPageUnified] scene count failed", err)
        if (!cancelled) setSceneSheetShotCount(undefined)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [sceneSheetOpen, clientId, shot?.laneId, shot?.projectId])

  // -- 1-4 status keys (ported from ThreePanel, role-gated) + Escape/Cmd+S --
  // useKeyboardShortcuts already skips input/textarea/contentEditable targets.
  const handleStatusKey = (index: number) => {
    // Early-return unless canManageShots(role) — viewers no-op (build spec
    // security invariant 2). canDoOperational is false while roleResolving,
    // so no write can fire during the effective-role gap.
    if (!canDoOperational) return
    if (!shot || !clientId) return
    const newStatus = SHOT_STATUS_CYCLE[index]
    if (!newStatus || shot.status === newStatus) return
    void updateShotWithVersion({
      clientId,
      shotId: shot.id,
      patch: { status: newStatus },
      shot,
      user,
      source: "ShotDetailPageUnified:keyboard",
    }).catch((err) => {
      toast.error("Failed to update status", {
        description: shotWriteErrorDescription(err),
      })
    })
  }

  // -- [ / ] prev-next over the list page's visible order (ported from
  // ThreePanel with list-ordering context). Clamps at the ends, no wrap —
  // navigation-only, so no role gate (parity with the retired panel). Deep
  // links and new tabs have no order snapshot and the keys no-op.
  const handlePrevNext = (delta: -1 | 1) => {
    if (!shot || !clientId) return
    const orderIds = readShotListNavOrder(clientId, shot.projectId)
    if (!orderIds) return
    const currentIndex = orderIds.indexOf(shot.id)
    if (currentIndex === -1) return
    const targetId = orderIds[currentIndex + delta]
    if (!targetId) return
    navigate(`/projects/${shot.projectId}/shots/${targetId}`)
  }

  useKeyboardShortcuts([
    { key: "Escape", handler: () => navigate(-1) },
    { key: "s", meta: true, handler: () => { /* auto-save flushes on blur; this just prevents browser save dialog */ } },
    { key: "1", handler: () => handleStatusKey(0) },
    { key: "2", handler: () => handleStatusKey(1) },
    { key: "3", handler: () => handleStatusKey(2) },
    { key: "4", handler: () => handleStatusKey(3) },
    { key: "[", handler: () => handlePrevNext(-1) },
    { key: "]", handler: () => handlePrevNext(1) },
  ])

  const save = async (fields: Record<string, unknown>): Promise<boolean> => {
    // Reachable only from canEdit/canDoOperational affordances, which render
    // nothing while roleResolving — the explicit guard keeps the invariant
    // even if a future affordance forgets its gate.
    if (roleResolving) return false
    if (!shot || !clientId) return false
    try {
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: fields,
        shot,
        user,
        source: "ShotDetailPageUnified",
      })
      return true
    } catch (err) {
      toast.error("Failed to save changes", {
        description: shotWriteErrorDescription(err),
      })
      return false
    }
  }

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

  // Archived: the deleted-shot effect above navigates away; render nothing.
  if (shot.deleted === true) return null

  // Strips HTML; Infinity means sanitize without truncating (same call as the legacy page).
  const safeDescription = textPreview(shot.description, Number.POSITIVE_INFINITY)
  const talentCount = (shot.talentIds ?? shot.talent ?? []).length

  return (
    <ErrorBoundary>
      <ActiveEditorsBar
        clientId={clientId}
        entityType="shots"
        entityId={shot.id}
      />
      <div className="flex flex-col gap-5">
        {/* ── Breadcrumb — preserves URL search so filter state survives going back to Shots ── */}
        <Breadcrumbs
          items={[
            { label: "Projects", to: "/projects" },
            {
              label: projectName || "Project",
              to: `/projects/${shot.projectId}/shots`,
            },
            {
              label: "Shots",
              to: `/projects/${shot.projectId}/shots${locationSearch}`,
            },
            { label: shot.shotNumber ? `#${shot.shotNumber}` : "Shot" },
          ]}
        />

        {/* ── Top actions: back + Export/Share/lifecycle ── */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Shots
          </Button>
          <EffectiveRoleChip />
          <div className="ml-auto flex items-center gap-2">
            {canExport && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/projects/${shot.projectId}/export?preset=shot-detail&shotId=${shot.id}`,
                  )
                }
              >
                Export
              </Button>
            )}
            {canShare && !isMobile && (
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                Share
              </Button>
            )}
            {canManageLifecycle && <ShotLifecycleActionsMenu shot={shot} />}
          </div>
        </div>

        {/* ── Masthead: shot# eyebrow + status badge, serif name + iconic period ── */}
        <header className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-baseline gap-1 text-2xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Shot
              {canEdit ? (
                <InlineEdit
                  value={shot.shotNumber ?? ""}
                  onSave={(shotNumber) => save({ shotNumber: shotNumber || null })}
                  className="text-2xs font-bold tracking-wider"
                  placeholder="#"
                />
              ) : (
                shot.shotNumber && <span>#{shot.shotNumber}</span>
              )}
            </span>
            {!isMobile && (
              <ShotStatusSelect
                shotId={shot.id}
                currentStatus={shot.status}
                shot={shot}
                disabled={!canDoOperational}
                variant="badge"
              />
            )}
          </div>

          <div className="flex flex-wrap items-baseline text-3xl md:text-4xl">
            {canEdit ? (
              <InlineEdit
                value={shot.title}
                onSave={(title) => save({ title })}
                className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-serif)] md:text-4xl"
                testId="shot-title-edit"
              />
            ) : (
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-serif)] md:text-4xl">
                {shot.title || "Untitled Shot"}
              </h1>
            )}
            {/* Editorial serif masthead per docs/DESIGN.md — intentionally not .heading-page. */}
            {/* The iconic period — the single red accent on this surface. */}
            <span className="iconic-period" aria-hidden="true">
              .
            </span>
          </div>

          {/* Mobile: full-width status tap row (today's behavior, unchanged) */}
          {isMobile && canDoOperational && <ShotStatusTapRow shot={shot} />}
        </header>

        {/* ── Scene context banner ── */}
        <SceneContextBanner
          laneId={shot.laneId}
          laneById={laneById}
          onViewScene={() => setSceneSheetOpen(true)}
        />

        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
          {/* ── Left main column — de-carded, scan-path order ── */}
          <div className="flex flex-col gap-5">
            <section>
              <SectionLabel>Description</SectionLabel>
              <div className="mt-1.5 max-w-prose">
                {canEdit ? (
                  <DescriptionEditor
                    value={safeDescription}
                    onSave={async (description) => {
                      const ok = await save({ description: description || null })
                      if (!ok) throw new Error("Save failed")
                    }}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {safeDescription || "No description"}
                  </p>
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Hero + References</SectionLabel>
              <div className="mt-1.5 grid items-start gap-3 lg:grid-cols-[minmax(0,420px)_minmax(220px,1fr)]">
                {/* Hero renders at the image's native ratio — no forced widescreen crop. */}
                <div className="w-full max-w-sm">
                  <HeroImageSection
                    heroImage={shot.heroImage}
                    shot={shot}
                    shotId={shot.id}
                    canUpload={canUploadShotImages}
                    frame="natural"
                  />
                </div>
                <ActiveLookCoverReferencesPanel
                  shot={shot}
                  canEdit={canUploadShotImages}
                />
              </div>
            </section>

            <ProductColorwayStrip
              looks={shot.looks ?? []}
              activeLookId={shot.activeLookId}
            />

            {/* ── ONE inline editorial meta line (Date / Location / Talent) ── */}
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 border-y border-[var(--color-border)] py-3.5 text-sm">
              <MetaSegment label="Date" testId="meta-date">
                {canEdit ? (
                  <DateEditor
                    value={formatDateOnly(shot.date)}
                    onSave={(dateStr) => {
                      if (!dateStr) {
                        void save({ date: null })
                        return
                      }
                      try {
                        const ts = parseDateOnly(dateStr)
                        void save({ date: ts })
                      } catch {
                        toast.error("Invalid date")
                      }
                    }}
                  />
                ) : (
                  <ReadOnlyMetaValue value={formatDateOnly(shot.date) || "Not set"} />
                )}
              </MetaSegment>

              <MetaDot />

              <MetaSegment label="Location" testId="meta-location">
                {canEdit ? (
                  <span className="inline-flex min-w-[140px] max-w-[280px]">
                    <LocationPicker
                      selectedId={shot.locationId}
                      selectedName={shot.locationName}
                      onSave={(locationId, locationName) =>
                        save({ locationId, locationName })
                      }
                      disabled={!canEdit}
                      compact
                      projectId={shot.projectId}
                    />
                  </span>
                ) : (
                  <ReadOnlyMetaValue value={shot.locationName?.trim() || "Not set"} />
                )}
              </MetaSegment>

              <MetaDot />

              <MetaSegment label="Talent" testId="meta-talent">
                {canEdit ? (
                  <span className="inline-flex min-w-[140px] max-w-[280px]">
                    <TalentPicker
                      selectedIds={shot.talentIds ?? shot.talent}
                      onSave={(ids) => save({ talent: ids, talentIds: ids })}
                      disabled={!canEdit}
                      compact
                      projectId={shot.projectId}
                    />
                  </span>
                ) : (
                  <ReadOnlyMetaValue value={`${talentCount} assigned`} />
                )}
              </MetaSegment>
            </div>

            <div ref={notesRef} className="flex flex-col gap-5">
              <section>
                <SectionLabel>Notes</SectionLabel>
                <div className="mt-1.5">
                  <NotesSection
                    notes={shot.notes}
                    notesAddendum={shot.notesAddendum}
                    onSaveAddendum={async (value) => {
                      const ok = await save({ notesAddendum: value || null })
                      if (!ok) throw new Error("Failed to save addendum")
                    }}
                    canEditAddendum={canDoOperational}
                  />
                </div>
              </section>

              {/* Reference links live with Notes. */}
              <ShotReferenceLinksSection
                shotId={shot.id}
                referenceLinks={shot.referenceLinks}
                notesAddendum={shot.notesAddendum}
                canEdit={canEdit}
                onSaveReferenceLinks={async (next) => {
                  const ok = await save({ referenceLinks: next })
                  if (!ok) throw new Error("Failed to save reference links")
                }}
              />

              <div data-testid="tags-section">
                <SectionLabel>Tags</SectionLabel>
                <TagEditor
                  tags={shot.tags ?? []}
                  onSave={(next) => save({ tags: next })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <ShotCommentsSection shotId={shot.id} canComment={canComment} />

            <ShotVersionHistorySection shot={shot} />
          </div>

          {/* ── Right sticky rail ── */}
          <ShotDetailSidebar
            shot={shot}
            canEditLooks={canEdit}
            footer={canDoOperational ? <ShotDetailQuickAdd /> : undefined}
          />
        </div>

        {canShare && (
          <ShotsShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            clientId={clientId}
            projectId={shot.projectId}
            projectName={projectName || "Project"}
            user={user}
            selectedShotIds={[shot.id]}
          />
        )}

        <SceneDetailSheet
          open={sceneSheetOpen}
          onOpenChange={setSceneSheetOpen}
          lane={shot.laneId ? laneById.get(shot.laneId) ?? null : null}
          projectId={shot.projectId}
          clientId={clientId}
          shotCount={sceneSheetShotCount}
          siblingLanes={lanes}
          canEditScene={canEditScene}
        />
      </div>
    </ErrorBoundary>
  )
}
