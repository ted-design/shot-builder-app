import { Trash2 } from "lucide-react"
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
import { Input } from "@/ui/input"
import { InlineEdit } from "@/shared/components/InlineEdit"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  SELECT_NONE,
  CASTING_DECISION_OPTIONS,
  type TalentImage,
  type CastingSession,
} from "@/features/library/components/talentUtils"
import { InlineTextarea } from "@/features/library/components/TalentInlineEditors"
import { SortableImageTile } from "@/features/library/components/SortableImageTile"

interface CastingSessionListProps {
  readonly castingSessions: CastingSession[]
  readonly canEdit: boolean
  readonly isMobile: boolean
  readonly busy: boolean
  readonly projects: Array<{ id: string; name?: string | null }>
  readonly sensors: ReturnType<typeof useSensors>
  readonly sessionExpanded: Record<string, boolean>
  readonly setSessionExpanded: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  readonly updateCastingSessions: (
    next: CastingSession[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onCastingFiles: (sessionId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly setGalleryRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveTarget: (target: TalentImage | null) => void
  readonly setSessionRemoveOpen: (open: boolean) => void
  readonly setSessionRemoveTarget: (target: CastingSession | null) => void
  readonly setCreateSessionOpen: (open: boolean) => void
  readonly setPrintSessionId: (id: string | null) => void
}

export function CastingSessionList({
  castingSessions,
  canEdit,
  isMobile,
  busy,
  projects,
  sensors,
  sessionExpanded,
  setSessionExpanded,
  updateCastingSessions,
  onCastingFiles,
  setGalleryRemoveOpen,
  setGalleryRemoveTarget,
  setSessionRemoveOpen,
  setSessionRemoveTarget,
  setCreateSessionOpen,
  setPrintSessionId,
}: CastingSessionListProps) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="label-meta">
          Castings
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setCreateSessionOpen(true)}
          >
            Add casting
          </Button>
        ) : null}
      </div>

      {castingSessions.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--color-text-muted)]">
          {canEdit
            ? "Create a casting session to group audition images and notes."
            : "No castings yet."}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {castingSessions.map((session) => {
            const expanded = sessionExpanded[session.id] === true
            return (
              <div
                key={session.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSessionExpanded((prev) => ({
                      ...prev,
                      [session.id]: !expanded,
                    }))
                  }
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {session.title?.trim() ? session.title : "Casting"}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {session.date} • {(session.images ?? []).length} image{(session.images ?? []).length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {expanded ? "Hide" : "Open"}
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--color-border)] px-3 py-3">
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Title</div>
                          <InlineEdit
                            value={(session.title ?? "").trim()}
                            disabled={!canEdit || busy}
                            placeholder="Add title"
                            onSave={(next) => {
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id ? { ...s, title: next || null } : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Date</div>
                          <Input
                            type="date"
                            value={session.date}
                            disabled={!canEdit || busy}
                            onChange={(e) => {
                              const nextDate = e.target.value
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id ? { ...s, date: nextDate } : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Project</div>
                          <Select
                            value={session.projectId ?? SELECT_NONE}
                            onValueChange={(next) => {
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id
                                  ? { ...s, projectId: next === SELECT_NONE ? null : next }
                                  : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            disabled={!canEdit || busy}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE}>—</SelectItem>
                              {session.projectId &&
                              !projects.some((p) => p.id === session.projectId) ? (
                                <SelectItem value={session.projectId}>
                                  {session.projectId}
                                </SelectItem>
                              ) : null}
                              {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name || p.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Location</div>
                          <InlineEdit
                            value={(session.location ?? "").trim()}
                            disabled={!canEdit || busy}
                            placeholder="—"
                            onSave={(next) => {
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id ? { ...s, location: next || null } : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Decision</div>
                          <Select
                            value={session.decision ?? SELECT_NONE}
                            onValueChange={(next) => {
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id
                                  ? { ...s, decision: next === SELECT_NONE ? null : next }
                                  : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            disabled={!canEdit || busy}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE}>—</SelectItem>
                              {session.decision &&
                              !CASTING_DECISION_OPTIONS.some((o) => o.value === session.decision) ? (
                                <SelectItem value={session.decision}>
                                  {session.decision}
                                </SelectItem>
                              ) : null}
                              {CASTING_DECISION_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--color-text-muted)]">Rating</div>
                          <Select
                            value={session.rating ? String(session.rating) : SELECT_NONE}
                            onValueChange={(next) => {
                              const parsed = next === SELECT_NONE ? null : Number.parseInt(next, 10)
                              const rating =
                                typeof parsed === "number" &&
                                Number.isFinite(parsed) &&
                                parsed >= 1 &&
                                parsed <= 5
                                  ? parsed
                                  : null
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id ? { ...s, rating } : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                            disabled={!canEdit || busy}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE}>—</SelectItem>
                              {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs text-[var(--color-text-muted)]">Role / brief</div>
                          <InlineTextarea
                            value={session.brief ?? ""}
                            disabled={!canEdit || busy}
                            placeholder="Role, brief, usage, etc…"
                            className="mt-1 min-h-[80px]"
                            onCommit={(next) => {
                              const trimmed = next.trim()
                              const nextSessions = castingSessions.map((s) =>
                                s.id === session.id ? { ...s, brief: trimmed ? trimmed : null } : s,
                              )
                              void updateCastingSessions(nextSessions)
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[var(--color-text-muted)]">Notes</div>
                        <InlineTextarea
                          value={session.notes ?? ""}
                          disabled={!canEdit || busy}
                          placeholder="Notes from casting…"
                          className="mt-1 min-h-[110px]"
                          onCommit={(next) => {
                            const nextSessions = castingSessions.map((s) =>
                              s.id === session.id ? { ...s, notes: next.trim() ? next : null } : s,
                            )
                            void updateCastingSessions(nextSessions)
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="label-meta">
                          Images
                        </div>
                        <div className="flex items-center gap-2">
                          {!isMobile ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setPrintSessionId(session.id)}
                            >
                              Export PDF
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <>
                              <label className="inline-flex">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => void onCastingFiles(session.id, e)}
                                  className="hidden"
                                />
                                <span className="inline-flex cursor-pointer select-none items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]">
                                  Upload
                                </span>
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setSessionRemoveTarget(session)
                                  setSessionRemoveOpen(true)
                                }}
                                className="gap-1 text-[var(--color-error)] hover:text-[var(--color-error)]"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {(session.images ?? []).length === 0 ? (
                        <div className="text-sm text-[var(--color-text-muted)]">
                          No casting images.
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event: DragEndEvent) => {
                            const { active, over } = event
                            if (!over || active.id === over.id) return
                            const imgs = session.images ?? []
                            const oldIndex = imgs.findIndex((i) => i.id === active.id)
                            const newIndex = imgs.findIndex((i) => i.id === over.id)
                            if (oldIndex === -1 || newIndex === -1) return
                            const reordered = arrayMove([...imgs], oldIndex, newIndex)
                            const nextSessions = castingSessions.map((s) =>
                              s.id === session.id ? { ...s, images: reordered } : s,
                            )
                            void updateCastingSessions(nextSessions)
                          }}
                        >
                          <SortableContext
                            items={(session.images ?? []).map((i) => i.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className="grid gap-3 sm:grid-cols-3">
                              {(session.images ?? []).map((img) => (
                                <SortableImageTile
                                  key={img.id}
                                  image={img}
                                  disabled={!canEdit || busy}
                                  onCaptionSave={(next) => {
                                    const nextSessions = castingSessions.map((s) => {
                                      if (s.id !== session.id) return s
                                      const nextImages = (s.images ?? []).map((i) =>
                                        i.id === img.id ? { ...i, description: next || null } : i,
                                      )
                                      return { ...s, images: nextImages }
                                    })
                                    void updateCastingSessions(nextSessions)
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
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
