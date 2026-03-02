import { useRef } from "react"
import { Link } from "react-router-dom"
import { Upload, Trash2 } from "lucide-react"
import type { ChangeEvent } from "react"
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import type { useSensors } from "@dnd-kit/core"
import { Button } from "@/ui/button"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { TalentShotHistory } from "@/features/library/components/TalentShotHistory"
import { getMeasurementOptionsForGender } from "@/features/library/lib/measurementOptions"
import type { TalentRecord } from "@/shared/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  buildDisplayName,
  initials,
  SELECT_NONE,
  MEASUREMENT_PLACEHOLDERS,
  type TalentImage,
  type CastingSession,
} from "@/features/library/components/talentUtils"
import { InlineInput, InlineTextarea } from "@/features/library/components/TalentInlineEditors"
import { SortableImageTile } from "@/features/library/components/SortableImageTile"
import { CastingSessionList } from "@/features/library/components/CastingSessionList"

interface TalentDetailPanelProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly isMobile: boolean
  readonly busy: boolean
  readonly setBusy: (busy: boolean) => void
  readonly clientId: string | null
  readonly userId: string | null
  readonly activeTab: "detail" | "history"
  readonly setActiveTab: (tab: "detail" | "history") => void
  readonly selectedHeadshotUrl: string | null
  readonly selectedHeadshotPath: string | null
  readonly portfolioImages: TalentImage[]
  readonly castingSessions: CastingSession[]
  readonly projects: Array<{ id: string; name?: string | null }>
  readonly projectLookup: Map<string, string>
  readonly sensors: ReturnType<typeof useSensors>
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
  readonly updateGallery: (
    next: TalentImage[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly updateCastingSessions: (
    next: CastingSession[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onHeadshotFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly onPortfolioFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly onCastingFiles: (sessionId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly setHeadshotRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveTarget: (target: TalentImage | null) => void
  readonly setSessionRemoveOpen: (open: boolean) => void
  readonly setSessionRemoveTarget: (target: CastingSession | null) => void
  readonly sessionExpanded: Record<string, boolean>
  readonly setSessionExpanded: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  readonly setDeleteOpen: (open: boolean) => void
  readonly setCreateSessionOpen: (open: boolean) => void
  readonly setPrintSessionId: (id: string | null) => void
}

export function TalentDetailPanel({
  selected,
  canEdit,
  isMobile,
  busy,
  setBusy,
  clientId,
  userId,
  activeTab,
  setActiveTab,
  selectedHeadshotUrl,
  selectedHeadshotPath,
  portfolioImages,
  castingSessions,
  projects,
  projectLookup,
  sensors,
  savePatch,
  updateGallery,
  updateCastingSessions,
  onHeadshotFile,
  onPortfolioFiles,
  onCastingFiles,
  setHeadshotRemoveOpen,
  setGalleryRemoveOpen,
  setGalleryRemoveTarget,
  setSessionRemoveOpen,
  setSessionRemoveTarget,
  sessionExpanded,
  setSessionExpanded,
  setDeleteOpen,
  setCreateSessionOpen,
  setPrintSessionId,
}: TalentDetailPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const portfolioInputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              {selectedHeadshotUrl ? (
                <img
                  src={selectedHeadshotUrl}
                  alt={buildDisplayName(selected)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
                  {initials(buildDisplayName(selected))}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="label-meta">
                Name
              </div>
              <div className="mt-1 heading-page">
                <div data-testid="talent-details-name">
                  <InlineEdit
                    value={buildDisplayName(selected)}
                    disabled={!canEdit || busy}
                    placeholder="Untitled"
                    onSave={(next) => void savePatch(selected.id, { name: next })}
                    className="heading-page"
                  />
                </div>
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                {isMobile ? "Read-only on mobile." : canEdit ? "Click fields to edit." : "Read-only."}
              </div>
            </div>
          </div>
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
              aria-label="Delete talent"
              className="text-[var(--color-error)] hover:text-[var(--color-error)]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-0 overflow-x-auto border-b border-[var(--color-border)]">
          {(
            [
              { key: "detail" as const, label: "Profile" },
              { key: "history" as const, label: "Shot History" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Shot History tab */}
        {activeTab === "history" && clientId ? (
          <div className="mt-5">
            <TalentShotHistory talentId={selected.id} clientId={clientId} />
          </div>
        ) : null}

        {/* Profile tab (existing detail content) */}
        {activeTab === "detail" ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="label-meta">
                Headshot
              </div>
              <div className="mt-3 flex items-center gap-2">
                {canEdit ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onHeadshotFile}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !selectedHeadshotPath}
                      onClick={() => setHeadshotRemoveOpen(true)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-[var(--color-text-muted)]">
                    —
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="label-meta">
                Contact
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Agency</div>
                  <InlineEdit
                    value={selected.agency ?? ""}
                    disabled={!canEdit || busy}
                    placeholder="—"
                    onSave={(next) => void savePatch(selected.id, { agency: next || null })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Gender</div>
                  <Select
                    value={selected.gender ?? SELECT_NONE}
                    onValueChange={(next) =>
                      void savePatch(selected.id, {
                        gender: next === SELECT_NONE ? null : next,
                      })
                    }
                    disabled={!canEdit || busy}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>—</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Email</div>
                  <InlineEdit
                    value={selected.email ?? ""}
                    disabled={!canEdit || busy}
                    placeholder="—"
                    onSave={(next) => void savePatch(selected.id, { email: next || null })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Phone</div>
                  <InlineEdit
                    value={selected.phone ?? ""}
                    disabled={!canEdit || busy}
                    placeholder="—"
                    onSave={(next) => void savePatch(selected.id, { phone: next || null })}
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-[var(--color-text-muted)]">Reference URL</div>
                  <InlineEdit
                    value={selected.url ?? ""}
                    disabled={!canEdit || busy}
                    placeholder="—"
                    onSave={(next) => void savePatch(selected.id, { url: next || null })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="label-meta">
                Projects
              </div>
              <div className="mt-3">
                {(selected.projectIds ?? []).length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)]">Not linked to any projects.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selected.projectIds ?? []).map((pid) => (
                      <Link
                        key={pid}
                        to={`/projects/${pid}/assets`}
                        className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs text-[var(--color-text)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
                      >
                        <span className="max-w-[200px] truncate">
                          {projectLookup.get(pid) ?? pid}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="label-meta">
                Measurements
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {getMeasurementOptionsForGender(selected.gender).map((field) => {
                  const measurements = selected.measurements ?? {}
                  const value = (measurements as Record<string, unknown>)[field.key]
                  const display = typeof value === "string" || typeof value === "number" ? String(value) : ""
                  return (
                    <div key={field.key}>
                      <div className="text-xs text-[var(--color-text-muted)]">{field.label}</div>
                      <InlineInput
                        value={display}
                        placeholder={MEASUREMENT_PLACEHOLDERS[field.key] ?? "—"}
                        disabled={!canEdit || busy}
                        onCommit={(next) => {
                          const nextMeasurements = {
                            ...(selected.measurements ?? {}),
                            [field.key]: next,
                          }
                          void savePatch(selected.id, { measurements: nextMeasurements })
                        }}
                        className="mt-1"
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                {selected.gender ? `Showing fields for ${selected.gender}.` : "Set gender to show relevant fields."}
                {" "}Tip: keep values flexible (e.g. 5&apos;9&quot;, 34&quot;).
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="label-meta">
                Notes
              </div>
              <InlineTextarea
                value={selected.notes ?? ""}
                disabled={!canEdit || busy}
                placeholder="Notes about sizing, fit, availability…"
                className="mt-3 min-h-[140px]"
                onCommit={(next) => {
                  void savePatch(selected.id, { notes: next.trim() ? next : null })
                }}
              />
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="label-meta">
                  Portfolio
                </div>
                {canEdit ? (
                  <>
                    <input
                      ref={portfolioInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onPortfolioFiles}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => portfolioInputRef.current?.click()}
                    >
                      Upload images
                    </Button>
                  </>
                ) : null}
              </div>

              {portfolioImages.length === 0 ? (
                <div className="mt-3 text-sm text-[var(--color-text-muted)]">
                  {canEdit ? "Upload images to build a portfolio for this talent." : "No portfolio images."}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (!over || active.id === over.id) return
                    const oldIndex = portfolioImages.findIndex((i) => i.id === active.id)
                    const newIndex = portfolioImages.findIndex((i) => i.id === over.id)
                    if (oldIndex === -1 || newIndex === -1) return
                    const reordered = arrayMove([...portfolioImages], oldIndex, newIndex)
                    void updateGallery(reordered)
                  }}
                >
                  <SortableContext
                    items={portfolioImages.map((i) => i.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {portfolioImages.map((img) => (
                        <SortableImageTile
                          key={img.id}
                          image={img}
                          disabled={!canEdit || busy}
                          onCaptionSave={(next) => {
                            const nextImages = portfolioImages.map((i) =>
                              i.id === img.id ? { ...i, description: next || null } : i,
                            )
                            void updateGallery(nextImages)
                          }}
                          onDelete={() => {
                            setGalleryRemoveTarget(img)
                            setGalleryRemoveOpen(true)
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <CastingSessionList
              castingSessions={castingSessions}
              canEdit={canEdit}
              isMobile={isMobile}
              busy={busy}
              projects={projects}
              sensors={sensors}
              sessionExpanded={sessionExpanded}
              setSessionExpanded={setSessionExpanded}
              updateCastingSessions={updateCastingSessions}
              onCastingFiles={onCastingFiles}
              setGalleryRemoveOpen={setGalleryRemoveOpen}
              setGalleryRemoveTarget={setGalleryRemoveTarget}
              setSessionRemoveOpen={setSessionRemoveOpen}
              setSessionRemoveTarget={setSessionRemoveTarget}
              setCreateSessionOpen={setCreateSessionOpen}
              setPrintSessionId={setPrintSessionId}
            />
          </div>
        </div>
        ) : null}
    </div>
  )
}
