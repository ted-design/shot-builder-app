import { useEffect, useMemo, useState } from "react"
import { Tag, Merge, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { TagBadge } from "@/shared/components/TagBadge"
import { TagColorPicker } from "@/shared/components/TagColorPicker"
import { DEFAULT_TAGS } from "@/shared/lib/defaultTags"
import { isTagColorKey, type TagColorKey } from "@/shared/lib/tagColors"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useShots } from "@/features/shots/hooks/useShots"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { Shot, ShotTag, ShotTagCategory } from "@/shared/types"
import { getShotTagCategoryLabel, normalizeShotTagCategory, resolveShotTagCategory } from "@/shared/lib/tagCategories"
import {
  deleteTagAcrossShots,
  mergeTagsAcrossShots,
  recategorizeTagAcrossShots,
  recolorTagAcrossShots,
  renameTagAcrossShots,
} from "@/features/shots/lib/tagManagementWrites"
import { toast } from "sonner"

type TagEntry = ShotTag & {
  readonly usageCount: number
  readonly shotIds: readonly string[]
  readonly isDefault: boolean
}

const DEFAULT_TAG_INDEX = new Map(DEFAULT_TAGS.map((t) => [t.id, t]))

function normalizeTag(raw: unknown): ShotTag | null {
  if (!raw || typeof raw !== "object") return null
  const t = raw as { id?: unknown; label?: unknown; color?: unknown; category?: unknown }
  if (typeof t.id !== "string") return null
  if (typeof t.label !== "string") return null
  if (typeof t.color !== "string") return null
  const label = t.label.trim()
  if (!label) return null
  return {
    id: t.id,
    label,
    color: t.color,
    category: resolveShotTagCategory({
      id: t.id,
      category: normalizeShotTagCategory(t.category),
    }),
  }
}

function buildTagLibrary(shots: readonly Shot[]): readonly TagEntry[] {
  const map = new Map<string, TagEntry>()

  for (const t of DEFAULT_TAGS) {
    map.set(t.id, { ...t, usageCount: 0, shotIds: [], isDefault: true })
  }

  for (const shot of shots) {
    const raw = shot.tags
    if (!Array.isArray(raw)) continue

    for (const maybeTag of raw) {
      const normalized = normalizeTag(maybeTag)
      if (!normalized) continue

      const defaultTag = DEFAULT_TAG_INDEX.get(normalized.id) ?? null
      const next: TagEntry = {
        id: normalized.id,
        label: normalized.label || defaultTag?.label || "Untitled",
        color: normalized.color || defaultTag?.color || "gray",
        category: resolveShotTagCategory({
          id: normalized.id,
          category: normalized.category ?? defaultTag?.category,
        }),
        usageCount: 1,
        shotIds: [shot.id],
        isDefault: Boolean(defaultTag),
      }

      const existing = map.get(normalized.id)
      if (existing) {
        map.set(normalized.id, {
          ...existing,
          label: next.label || existing.label,
          color: next.color || existing.color,
          category: next.category || existing.category,
          usageCount: existing.usageCount + 1,
          shotIds: [...existing.shotIds, shot.id],
          isDefault: existing.isDefault || next.isDefault,
        })
      } else {
        map.set(normalized.id, next)
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.usageCount - a.usageCount || a.label.localeCompare(b.label),
  )
}

export default function TagManagementPage() {
  const { clientId, role } = useAuth()
  const { projectId, projectName } = useProjectScope()
  const isMobile = useIsMobile()
  const canEdit = canManageShots(role) && !isMobile
  const navigate = useNavigate()

  const { data: shots, loading, error } = useShots()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mergeIds, setMergeIds] = useState<string[]>([])
  const [mergeOpen, setMergeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<TagEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const library = useMemo(() => buildTagLibrary(shots), [shots])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return library
    return library.filter((t) => t.label.toLowerCase().includes(q))
  }, [library, query])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return library.find((t) => t.id === selectedId) ?? null
  }, [library, selectedId])

  const mergeSelected = useMemo(() => {
    const set = new Set(mergeIds)
    return library.filter((t) => set.has(t.id))
  }, [library, mergeIds])

  const mergeTarget = mergeSelected[0] ?? null
  const mergeOthers = mergeSelected.slice(1)

  const toggleMerge = (id: string) => {
    setMergeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const clearMerge = () => setMergeIds([])

  const applyRename = async (tag: TagEntry, nextLabel: string) => {
    if (!clientId) return
    const label = nextLabel.trim()
    if (!label) {
      toast.error("Tag name cannot be empty")
      return
    }
    if (tag.usageCount === 0) {
      toast.info("Add this tag to a shot to customize it.")
      return
    }

    setBusy(true)
    try {
      const updated = await renameTagAcrossShots({
        clientId,
        shots,
        tagId: tag.id,
        nextLabel: label,
      })
      toast.success(`Updated ${updated} shot${updated === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Failed to rename tag", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const applyColor = async (tag: TagEntry, nextColor: TagColorKey) => {
    if (!clientId) return
    if (tag.usageCount === 0) {
      toast.info("Add this tag to a shot to customize it.")
      return
    }

    setBusy(true)
    try {
      const updated = await recolorTagAcrossShots({
        clientId,
        shots,
        tagId: tag.id,
        nextColor,
      })
      toast.success(`Updated ${updated} shot${updated === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Failed to update color", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const applyCategory = async (tag: TagEntry, nextCategory: ShotTagCategory) => {
    if (!clientId) return
    if (tag.usageCount === 0) {
      toast.info("Add this tag to a shot to customize it.")
      return
    }

    setBusy(true)
    try {
      const updated = await recategorizeTagAcrossShots({
        clientId,
        shots,
        tagId: tag.id,
        nextCategory,
      })
      toast.success(`Updated ${updated} shot${updated === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Failed to update category", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const openDelete = (tag: TagEntry) => {
    if (tag.isDefault) {
      toast.info("Default tags can’t be deleted.")
      return
    }
    setTagToDelete(tag)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!clientId || !tagToDelete) return
    setBusy(true)
    try {
      const updated = await deleteTagAcrossShots({
        clientId,
        shots,
        tagId: tagToDelete.id,
      })
      toast.success(`Removed from ${updated} shot${updated === 1 ? "" : "s"}`)
      if (selectedId === tagToDelete.id) setSelectedId(null)
      setDeleteOpen(false)
      setTagToDelete(null)
    } catch (err) {
      toast.error("Failed to delete tag", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const confirmMerge = async () => {
    if (!clientId || !mergeTarget || mergeOthers.length === 0) return
    setBusy(true)
    try {
      const updated = await mergeTagsAcrossShots({
        clientId,
        shots,
        target: {
          id: mergeTarget.id,
          label: mergeTarget.label,
          color: mergeTarget.color,
          category: resolveShotTagCategory(mergeTarget),
        },
        mergeIds: mergeOthers.map((t) => t.id),
      })
      toast.success(`Merged into "${mergeTarget.label}" (${updated} shot${updated === 1 ? "" : "s"})`)
      setMergeOpen(false)
      clearMerge()
    } catch (err) {
      toast.error("Failed to merge tags", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!isMobile) return
    if (!projectId) return
    toast.info("Tag management is available on desktop.")
    navigate(`/projects/${projectId}/shots`, { replace: true })
  }, [isMobile, navigate, projectId])

  if (isMobile) return null

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
        title="Tags"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || projectId || "Project" },
        ]}
        actions={
          canEdit && mergeIds.length >= 2 ? (
            <Button variant="outline" onClick={() => setMergeOpen(true)} className="gap-2">
              <Merge className="h-4 w-4" />
              Merge ({mergeIds.length})
            </Button>
          ) : null
        }
      />

      {library.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title="No tags yet"
          description="Tags are created when you add them to shots."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All tags</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags…"
              />

              {filtered.length === 0 ? (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-sm text-[var(--color-text-muted)]">No results.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map((t) => {
                    const selected = selectedId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
                            : "border-transparent hover:bg-[var(--color-surface-subtle)]"
                        }`}
                      >
                        {canEdit ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={mergeIds.includes(t.id)} onCheckedChange={() => toggleMerge(t.id)} />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <TagBadge tag={t} />
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {t.usageCount}
                          </span>
                        </div>
                        <div className="mt-1 text-2xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                          {getShotTagCategoryLabel(resolveShotTagCategory(t))}
                        </div>
                      </div>
                    </button>
                  )
                  })}
                </div>
              )}

              <div className="text-xs text-[var(--color-text-muted)]">
                {library.length} tag{library.length === 1 ? "" : "s"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!selected ? (
                <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">Select a tag.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="label-meta">
                        Name
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                        <div data-testid="tag-details-name">
                          <InlineEdit
                            value={selected.label}
                            disabled={!canEdit || busy || selected.usageCount === 0}
                            onSave={(next) => applyRename(selected, next)}
                            className="text-lg font-semibold"
                            placeholder="Untitled"
                          />
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Used by {selected.usageCount} shot{selected.usageCount === 1 ? "" : "s"}
                        {selected.usageCount === 0 ? " (add it to a shot first)" : ""}
                      </div>
                      {selected.isDefault ? (
                        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Default tag
                        </div>
                      ) : null}
                    </div>
                    <TagBadge tag={selected} className="mt-1" />
                  </div>

                  <div>
                    <div className="label-meta">
                      Color
                    </div>
                    <div className="mt-2">
                      <TagColorPicker
                        value={(isTagColorKey(selected.color) ? selected.color : "gray") as TagColorKey}
                        onChange={(next) => applyColor(selected, next)}
                        disabled={!canEdit || busy || selected.usageCount === 0}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="label-meta">
                      Category
                    </div>
                    <div className="mt-2 max-w-[220px]">
                      <Select
                        value={resolveShotTagCategory(selected)}
                        onValueChange={(next) => applyCategory(selected, next as ShotTagCategory)}
                        disabled={!canEdit || busy || selected.usageCount === 0}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="priority">
                            {getShotTagCategoryLabel("priority")}
                          </SelectItem>
                          <SelectItem value="gender">
                            {getShotTagCategoryLabel("gender")}
                          </SelectItem>
                          <SelectItem value="media">
                            {getShotTagCategoryLabel("media")}
                          </SelectItem>
                          <SelectItem value="other">
                            {getShotTagCategoryLabel("other")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="label-meta">
                      Danger zone
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text)]">
                          Delete tag
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Removes this tag from all shots in the project.
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!canEdit || busy || selected.usageCount === 0 || selected.isDefault}
                        onClick={() => openDelete(selected)}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                    {selected.isDefault ? (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        Default tags can’t be deleted.
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge tags</DialogTitle>
            <DialogDescription className="sr-only">
              Merge multiple tags into a single tag across all shots in this project.
            </DialogDescription>
          </DialogHeader>
          {mergeTarget && mergeOthers.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-[var(--color-text-secondary)]">
                Keep <TagBadge tag={mergeTarget} className="ml-2" /> and merge{" "}
                {mergeOthers.length} other tag{mergeOthers.length === 1 ? "" : "s"} into it.
              </div>
              <div className="flex flex-wrap gap-2">
                {mergeOthers.map((t) => (
                  <TagBadge key={t.id} tag={t} />
                ))}
              </div>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                This updates all shots in the project. It does not delete any shots.
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)]">
              Select at least 2 tags to merge.
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!busy) setMergeOpen(false)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={confirmMerge} disabled={busy || !mergeTarget || mergeOthers.length === 0}>
              {busy ? "Merging..." : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete tag?"
        description={`This removes the tag from ${tagToDelete?.usageCount ?? 0} shot${(tagToDelete?.usageCount ?? 0) === 1 ? "" : "s"} in this project.`}
        confirmLabel={busy ? "Deleting..." : "Delete"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          confirmDelete()
        }}
      />
    </ErrorBoundary>
  )
}
