import { useCallback, useEffect, useMemo, useState } from "react"
import { Users, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react"
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { toast } from "sonner"
import type { TalentRecord } from "@/shared/types"
import { canManageTalent } from "@/shared/lib/rbac"
import { useProjects } from "@/features/projects/hooks/useProjects"
import {
  createTalent,
  deleteTalent,
  deleteTalentImagePaths,
  removeTalentHeadshot,
  setTalentHeadshot,
  uploadTalentCastingImages,
  uploadTalentPortfolioImages,
  updateTalent,
} from "@/features/library/lib/talentWrites"
import type { TalentSearchFilters } from "@/features/library/lib/talentFilters"
import { EMPTY_TALENT_FILTERS, filterTalent } from "@/features/library/lib/talentFilters"
import { TalentSearchFilterSheet, TalentFilterToolbar } from "@/features/library/components/TalentSearchFilters"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import {
  buildDisplayName,
  normalizeImages,
  normalizeSessions,
  type TalentImage,
  type CastingSession,
} from "@/features/library/components/talentUtils"
import { HeadshotThumb } from "@/features/library/components/HeadshotThumb"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/ui/sheet"
import { TalentDetailPanel } from "@/features/library/components/TalentDetailPanel"
import { CreateTalentDialog, type CreateTalentFields } from "@/features/library/components/CreateTalentDialog"
import { TalentDialogCluster } from "@/features/library/components/TalentDialogs"
import type { CastingBrief, TalentMatchResult } from "@/features/library/lib/castingMatch"
import { EMPTY_CASTING_BRIEF, rankTalentForBrief } from "@/features/library/lib/castingMatch"
import { CastingBriefPanel, CastingModeButton, ScoreBadge } from "@/features/library/components/CastingBriefPanel"

export default function LibraryTalentPage() {
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const canCreate = canManageTalent(role)
  const canEdit = canCreate && !isMobile
  const { data: talent, loading, error } = useTalentLibrary()
  const { data: projects } = useProjects()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filters, setFilters] = useState<TalentSearchFilters>(EMPTY_TALENT_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"detail" | "history">("detail")
  const [castingBrief, setCastingBrief] = useState<CastingBrief>(EMPTY_CASTING_BRIEF)
  const [castingPanelOpen, setCastingPanelOpen] = useState(false)

  useKeyboardShortcuts([
    { key: "c", handler: () => { if (canCreate) setCreateOpen(true) } },
  ])

  const [busy, setBusy] = useState(false)
  const [headshotRemoveOpen, setHeadshotRemoveOpen] = useState(false)
  const [galleryRemoveOpen, setGalleryRemoveOpen] = useState(false)
  const [galleryRemoveTarget, setGalleryRemoveTarget] = useState<TalentImage | null>(null)
  const [sessionRemoveOpen, setSessionRemoveOpen] = useState(false)
  const [sessionRemoveTarget, setSessionRemoveTarget] = useState<CastingSession | null>(null)
  const [sessionExpanded, setSessionExpanded] = useState<Record<string, boolean>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createSessionOpen, setCreateSessionOpen] = useState(false)
  const [printSessionId, setPrintSessionId] = useState<string | null>(null)
  const [createSessionDate, setCreateSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [createSessionTitle, setCreateSessionTitle] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const filtersWithQuery = useMemo(
    (): TalentSearchFilters => ({ ...filters, query }),
    [filters, query],
  )

  const filtered = useMemo(
    () => filterTalent(talent, filtersWithQuery),
    [talent, filtersWithQuery],
  )

  const castingHasRequirements = useMemo(
    () => Object.values(castingBrief.requirements).some((r) => r.min !== null || r.max !== null),
    [castingBrief.requirements],
  )

  const castingResults = useMemo((): readonly TalentMatchResult[] => {
    if (!castingHasRequirements) return []
    return rankTalentForBrief(talent, castingBrief)
  }, [talent, castingBrief, castingHasRequirements])

  const castingScoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of castingResults) m.set(r.talent.id, r.overallScore)
    return m
  }, [castingResults])

  const castingMode = castingPanelOpen && castingHasRequirements

  const displayTalent = useMemo(() => {
    if (!castingMode) return filtered
    return [...filtered].sort((a, b) => {
      const sa = castingScoreMap.get(a.id) ?? 0
      const sb = castingScoreMap.get(b.id) ?? 0
      return sb - sa
    })
  }, [filtered, castingMode, castingScoreMap])

  // Clear selection when the selected talent is no longer in the filtered list
  useEffect(() => {
    if (!selectedId) return
    const stillVisible = displayTalent.some((t) => t.id === selectedId)
    if (!stillVisible) setSelectedId(null)
  }, [selectedId, displayTalent])

  const handleFiltersChange = useCallback((next: TalentSearchFilters) => {
    setFilters(next)
  }, [])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return talent.find((t) => t.id === selectedId) ?? null
  }, [selectedId, talent])

  const selectedHeadshotPath = selected?.headshotPath || selected?.imageUrl || null
  const selectedHeadshotUrl = useStorageUrl(selectedHeadshotPath ?? undefined)

  const portfolioImages = useMemo(() => normalizeImages(selected?.galleryImages), [selected?.galleryImages])
  const castingSessions = useMemo(() => normalizeSessions(selected?.castingSessions), [selected?.castingSessions])
  const printSession = useMemo(() => {
    if (!printSessionId) return null
    return castingSessions.find((s) => s.id === printSessionId) ?? null
  }, [castingSessions, printSessionId])

  const projectLookup = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of projects) m.set(p.id, p.name || p.id)
    return m
  }, [projects])

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1
    return displayTalent.findIndex((t) => t.id === selectedId)
  }, [selectedId, displayTalent])

  const navigatePrev = useCallback(() => {
    if (displayTalent.length === 0) return
    const idx = selectedIndex <= 0 ? displayTalent.length - 1 : selectedIndex - 1
    const target = displayTalent[idx]
    if (target) setSelectedId(target.id)
  }, [displayTalent, selectedIndex])

  const navigateNext = useCallback(() => {
    if (displayTalent.length === 0) return
    const idx = selectedIndex >= displayTalent.length - 1 ? 0 : selectedIndex + 1
    const target = displayTalent[idx]
    if (target) setSelectedId(target.id)
  }, [displayTalent, selectedIndex])

  useEffect(() => {
    if (!selectedId) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === "ArrowLeft") { e.preventDefault(); navigatePrev() }
      if (e.key === "ArrowRight") { e.preventDefault(); navigateNext() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectedId, navigatePrev, navigateNext])

  const updateGallery = async (
    next: TalentImage[],
    removedPaths: readonly (string | null | undefined)[] = [],
    successLabel?: string,
  ) => {
    if (!clientId || !selected) return
    setBusy(true)
    try {
      const normalized = next.map((img, index) => ({
        ...img,
        order: index,
      }))
      await updateTalent({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        patch: { galleryImages: normalized },
      })
      await deleteTalentImagePaths(removedPaths)
      if (successLabel) toast.success(successLabel)
    } catch (err) {
      toast.error("Failed to update portfolio", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const updateCastingSessions = async (
    next: CastingSession[],
    removedPaths: readonly (string | null | undefined)[] = [],
    successLabel?: string,
  ) => {
    if (!clientId || !selected) return
    setBusy(true)
    try {
      const normalized = [...next]
        .map((s) => ({
          ...s,
          images: (s.images ?? []).map((img, index) => ({ ...img, order: index })),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
      await updateTalent({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        patch: { castingSessions: normalized },
      })
      await deleteTalentImagePaths(removedPaths)
      if (successLabel) toast.success(successLabel)
    } catch (err) {
      toast.error("Failed to update castings", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const savePatch = async (id: string, patch: Record<string, unknown>) => {
    if (!clientId) return
    setBusy(true)
    try {
      await updateTalent({
        clientId,
        userId: user?.uid ?? null,
        talentId: id,
        patch,
      })
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!printSessionId) return
    if (!selected || !printSession) setPrintSessionId(null)
  }, [printSession, printSessionId, selected])

  const onHeadshotFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!clientId || !selected) return
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return

    setBusy(true)
    try {
      await setTalentHeadshot({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        file,
        previousPath: selectedHeadshotPath,
      })
      toast.success("Headshot updated")
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const onPortfolioFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!clientId || !selected) return
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    setBusy(true)
    try {
      const uploaded = await uploadTalentPortfolioImages({
        talentId: selected.id,
        files,
      })
      const next = [
        ...portfolioImages,
        ...uploaded.map((u, idx) => ({
          id: u.id,
          path: u.path,
          downloadURL: u.downloadURL,
          description: null,
          order: portfolioImages.length + idx,
        })),
      ]
      await updateTalent({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        patch: { galleryImages: next },
      })
      toast.success(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const onCastingFiles = async (sessionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!clientId || !selected) return
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    const session = castingSessions.find((s) => s.id === sessionId) ?? null
    if (!session) return

    setBusy(true)
    try {
      const uploaded = await uploadTalentCastingImages({
        talentId: selected.id,
        sessionId,
        files,
      })
      const nextSessions = castingSessions.map((s) => {
        if (s.id !== sessionId) return s
        const start = (s.images ?? []).length
        const nextImages = [
          ...(s.images ?? []),
          ...uploaded.map((u, idx) => ({
            id: u.id,
            path: u.path,
            downloadURL: u.downloadURL,
            description: null,
            order: start + idx,
          })),
        ]
        return { ...s, images: nextImages }
      })
      await updateTalent({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        patch: { castingSessions: nextSessions },
      })
      toast.success(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const confirmRemoveHeadshot = async () => {
    if (!clientId || !selected) return
    setBusy(true)
    try {
      await removeTalentHeadshot({
        clientId,
        userId: user?.uid ?? null,
        talentId: selected.id,
        previousPath: selectedHeadshotPath,
      })
      toast.success("Headshot removed")
      setHeadshotRemoveOpen(false)
    } catch (err) {
      toast.error("Failed to remove headshot", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const createCastingSession = async () => {
    if (!clientId || !selected) return
    const date = createSessionDate.trim()
    if (!date) {
      toast.error("Date is required")
      return
    }
    const title = createSessionTitle.trim() || null

    const next: CastingSession[] = [
      {
        id: crypto.randomUUID(),
        date,
        title,
        projectId: null,
        location: null,
        brief: null,
        decision: null,
        rating: null,
        notes: null,
        images: [],
      },
      ...castingSessions,
    ]

    setCreateSessionOpen(false)
    setCreateSessionTitle("")
    await updateCastingSessions(next, [], "Casting added")
  }

  const submitCreate = async (fields: CreateTalentFields): Promise<boolean> => {
    if (!clientId) return false
    const name = fields.name.trim()
    if (!name) {
      toast.error("Name is required")
      return false
    }

    setBusy(true)
    try {
      const id = await createTalent({
        clientId,
        userId: user?.uid ?? null,
        name,
        agency: fields.agency.trim() || null,
        email: fields.email.trim() || null,
        phone: fields.phone.trim() || null,
        url: fields.url.trim() || null,
        gender: fields.gender.trim() || null,
        notes: fields.notes.trim() || null,
        measurements: null,
        headshotFile: null,
      })
      toast.success("Talent created")
      setCreateOpen(false)
      setSelectedId(id)
      return true
    } catch (err) {
      toast.error("Failed to create talent", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDeleteTalent = () => {
    if (!clientId || !selected) return
    const allPaths: (string | null | undefined)[] = [
      selected.headshotPath,
      ...(selected.galleryImages ?? []).map((i) => i.path),
      ...(selected.castingSessions ?? []).flatMap((s) =>
        (s.images ?? []).map((i) => i.path),
      ),
    ]
    setBusy(true)
    deleteTalent({ clientId, talentId: selected.id, imagePaths: allPaths })
      .then(() => {
        toast.success("Talent deleted")
        setSelectedId(null)
        setDeleteOpen(false)
      })
      .catch((err) =>
        toast.error("Failed to delete", {
          description: err instanceof Error ? err.message : "Unknown error",
        }),
      )
      .finally(() => setBusy(false))
  }

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Talent"
        breadcrumbs={[{ label: "Library" }]}
        actions={
          canCreate ? (
            isMobile ? (
              <Button size="icon" aria-label="New talent" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New talent
              </Button>
            )
          ) : null
        }
      />

      {talent.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No talent yet"
          description={
            canCreate
              ? "Add talent profiles to build a casting-ready library."
              : "Talent profiles will appear here."
          }
          actionLabel={canCreate ? "Create talent" : undefined}
          onAction={canCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="max-w-md flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search talent…"
              />
            </div>
            <TalentFilterToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onOpenSheet={() => setFilterSheetOpen(true)}
            />
            <CastingModeButton
              active={castingPanelOpen}
              onToggle={() => setCastingPanelOpen((prev) => !prev)}
              matchCount={castingResults.length}
            />
          </div>

          <CastingBriefPanel
            open={castingPanelOpen}
            onToggle={() => setCastingPanelOpen(false)}
            talent={talent}
            brief={castingBrief}
            onBriefChange={setCastingBrief}
            hasRequirements={castingHasRequirements}
            matchCount={castingResults.length}
            results={castingResults}
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="No matching talent"
              description="Try adjusting your search."
              actionLabel="Clear search"
              onAction={() => setQuery("")}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayTalent.map((t) => {
                  const isSelected = selectedId === t.id
                  const score = castingMode ? castingScoreMap.get(t.id) : undefined
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedId((prev) => (prev === t.id ? null : t.id))
                        setActiveTab("detail")
                      }}
                      className={`relative rounded-md border p-3 text-left transition-[colors,box-shadow] ${
                        isSelected
                          ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-surface-subtle)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] hover:shadow-md"
                      }`}
                    >
                      {score !== undefined ? <ScoreBadge score={score} /> : null}
                      <div className="flex items-center gap-3">
                        <HeadshotThumb talent={t} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--color-text)]">
                            {buildDisplayName(t)}
                          </div>
                          {t.agency ? (
                            <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                              {t.agency}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

            </>
          )}
        </div>
      )}

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={`overflow-y-auto p-0 ${isMobile ? "max-h-[90vh] rounded-t-xl" : "sm:max-w-xl lg:max-w-2xl"}`}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected ? buildDisplayName(selected) : "Talent"}</SheetTitle>
            <SheetDescription>Talent profile details</SheetDescription>
          </SheetHeader>
          {selected ? (
            <>
              <div className="sticky top-0 z-10 flex items-center border-b border-[var(--color-border)] bg-background px-4 py-2 pr-12">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigatePrev} aria-label="Previous talent">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {selectedIndex + 1} of {displayTalent.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigateNext} aria-label="Next talent">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-5">
                <TalentDetailPanel
                  selected={selected}
                  canEdit={canEdit}
                  isMobile={isMobile}
                  busy={busy}
                  setBusy={setBusy}
                  clientId={clientId}
                  userId={user?.uid ?? null}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  selectedHeadshotUrl={selectedHeadshotUrl ?? null}
                  selectedHeadshotPath={selectedHeadshotPath}
                  portfolioImages={portfolioImages}
                  castingSessions={castingSessions}
                  projects={projects}
                  projectLookup={projectLookup}
                  sensors={sensors}
                  savePatch={savePatch}
                  updateGallery={updateGallery}
                  updateCastingSessions={updateCastingSessions}
                  onHeadshotFile={onHeadshotFile}
                  onPortfolioFiles={onPortfolioFiles}
                  onCastingFiles={onCastingFiles}
                  setHeadshotRemoveOpen={setHeadshotRemoveOpen}
                  setGalleryRemoveOpen={setGalleryRemoveOpen}
                  setGalleryRemoveTarget={setGalleryRemoveTarget}
                  setSessionRemoveOpen={setSessionRemoveOpen}
                  setSessionRemoveTarget={setSessionRemoveTarget}
                  sessionExpanded={sessionExpanded}
                  setSessionExpanded={setSessionExpanded}
                  setDeleteOpen={setDeleteOpen}
                  setCreateSessionOpen={setCreateSessionOpen}
                  setPrintSessionId={setPrintSessionId}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <TalentSearchFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        talent={talent}
      />

      <CreateTalentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        busy={busy}
        onSubmit={submitCreate}
      />

      <TalentDialogCluster
        busy={busy}
        selected={selected}
        clientId={clientId}
        portfolioImages={portfolioImages}
        castingSessions={castingSessions}
        projectLookup={projectLookup}
        printSession={printSession}
        printSessionId={printSessionId}
        setPrintSessionId={setPrintSessionId}
        headshotRemoveOpen={headshotRemoveOpen}
        setHeadshotRemoveOpen={setHeadshotRemoveOpen}
        galleryRemoveOpen={galleryRemoveOpen}
        setGalleryRemoveOpen={setGalleryRemoveOpen}
        galleryRemoveTarget={galleryRemoveTarget}
        setGalleryRemoveTarget={setGalleryRemoveTarget}
        sessionRemoveOpen={sessionRemoveOpen}
        setSessionRemoveOpen={setSessionRemoveOpen}
        sessionRemoveTarget={sessionRemoveTarget}
        setSessionRemoveTarget={setSessionRemoveTarget}
        deleteOpen={deleteOpen}
        setDeleteOpen={setDeleteOpen}
        createSessionOpen={createSessionOpen}
        setCreateSessionOpen={setCreateSessionOpen}
        createSessionDate={createSessionDate}
        setCreateSessionDate={setCreateSessionDate}
        createSessionTitle={createSessionTitle}
        setCreateSessionTitle={setCreateSessionTitle}
        onConfirmRemoveHeadshot={confirmRemoveHeadshot}
        onUpdateGallery={updateGallery}
        onUpdateCastingSessions={updateCastingSessions}
        onCreateCastingSession={createCastingSession}
        onConfirmDeleteTalent={handleConfirmDeleteTalent}
      />
    </ErrorBoundary>
  )
}
