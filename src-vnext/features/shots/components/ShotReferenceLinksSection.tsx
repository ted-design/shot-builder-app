import { useMemo, useState } from "react"
import { Globe, Video, FileText, Link2, Plus, Sparkles, Trash2, PencilLine } from "lucide-react"
import type { ShotReferenceLink, ShotReferenceLinkType } from "@/shared/types"
import {
  inferReferenceLinkType,
  normalizeReferenceLinkUrl,
} from "@/features/shots/lib/referenceLinks"
import { extractReferenceLinkSuggestionsFromNotes } from "@/features/shots/lib/notesLinkMigration"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip"

type DraftType = "auto" | ShotReferenceLinkType

interface ShotReferenceLinksSectionProps {
  readonly shotId: string
  readonly referenceLinks: ReadonlyArray<ShotReferenceLink> | null | undefined
  readonly notesAddendum?: string | null
  readonly canEdit: boolean
  readonly onSaveReferenceLinks: (next: ReadonlyArray<ShotReferenceLink>) => Promise<void>
}

function getIcon(type: ShotReferenceLinkType) {
  switch (type) {
    case "video":
      return Video
    case "document":
      return FileText
    case "web":
    default:
      return Globe
  }
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "")
  } catch {
    return url
  }
}

function newLinkId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `link-${Date.now()}`
}

export function ShotReferenceLinksSection({
  shotId,
  referenceLinks,
  notesAddendum,
  canEdit,
  onSaveReferenceLinks,
}: ShotReferenceLinksSectionProps) {
  const links = referenceLinks ?? []
  const [titleDraft, setTitleDraft] = useState("")
  const [urlDraft, setUrlDraft] = useState("")
  const [typeDraft, setTypeDraft] = useState<DraftType>("auto")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitleDraft, setEditTitleDraft] = useState("")
  const [editUrlDraft, setEditUrlDraft] = useState("")
  const [editTypeDraft, setEditTypeDraft] = useState<ShotReferenceLinkType>("web")
  const [editError, setEditError] = useState<string | null>(null)

  const normalizedTitle = titleDraft.trim()
  const normalizedUrlInput = urlDraft.trim()
  const migrationStorageKey = `sb:shots:ref-links-migration-dismissed:${shotId}:v1`

  const existingUrlSet = useMemo(() => {
    return new Set(links.map((entry) => entry.url.trim().toLowerCase()))
  }, [links])
  const [migrationDismissed, setMigrationDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(migrationStorageKey) === "1"
    } catch {
      return false
    }
  })
  const migrationSuggestions = useMemo(() => {
    return extractReferenceLinkSuggestionsFromNotes({
      notesAddendum,
      existingLinks: links,
    })
  }, [links, notesAddendum])

  const dismissMigration = () => {
    setMigrationDismissed(true)
    try {
      window.localStorage.setItem(migrationStorageKey, "1")
    } catch {
      // ignore localStorage failures
    }
  }

  const handleAdd = async () => {
    if (!canEdit || saving) return
    if (!normalizedTitle) {
      setError("Add a short title for this link.")
      return
    }
    const normalizedUrl = normalizeReferenceLinkUrl(normalizedUrlInput)
    if (!normalizedUrl) {
      setError("Enter a valid URL (http(s):// or domain).")
      return
    }
    if (existingUrlSet.has(normalizedUrl.toLowerCase())) {
      setError("This URL is already in the list.")
      return
    }

    const type = typeDraft === "auto" ? inferReferenceLinkType(normalizedUrl) : typeDraft
    const next: ReadonlyArray<ShotReferenceLink> = [
      ...links,
      {
        id: newLinkId(),
        title: normalizedTitle,
        url: normalizedUrl,
        type,
      },
    ]

    setSaving(true)
    setError(null)
    try {
      await onSaveReferenceLinks(next)
      setTitleDraft("")
      setUrlDraft("")
      setTypeDraft("auto")
    } finally {
      setSaving(false)
    }
  }

  const beginEdit = (entry: ShotReferenceLink) => {
    setEditingId(entry.id)
    setEditTitleDraft(entry.title)
    setEditUrlDraft(entry.url)
    setEditTypeDraft(entry.type)
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitleDraft("")
    setEditUrlDraft("")
    setEditTypeDraft("web")
    setEditError(null)
  }

  const handleSaveEdit = async () => {
    if (!canEdit || saving || !editingId) return

    const normalizedTitle = editTitleDraft.trim()
    if (!normalizedTitle) {
      setEditError("Add a short title for this link.")
      return
    }

    const normalizedUrl = normalizeReferenceLinkUrl(editUrlDraft)
    if (!normalizedUrl) {
      setEditError("Enter a valid URL (http(s):// or domain).")
      return
    }

    const duplicateUrlExists = links.some(
      (entry) =>
        entry.id !== editingId &&
        entry.url.trim().toLowerCase() === normalizedUrl.toLowerCase(),
    )
    if (duplicateUrlExists) {
      setEditError("This URL is already in the list.")
      return
    }

    const next: ReadonlyArray<ShotReferenceLink> = links.map((entry) =>
      entry.id === editingId
        ? {
            ...entry,
            title: normalizedTitle,
            url: normalizedUrl,
            type: editTypeDraft,
          }
        : entry,
    )

    setSaving(true)
    setEditError(null)
    try {
      await onSaveReferenceLinks(next)
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!canEdit || saving) return
    const next = links.filter((entry) => entry.id !== id)
    setSaving(true)
    setError(null)
    try {
      await onSaveReferenceLinks(next)
    } finally {
      setSaving(false)
    }
  }

  const handleImportSuggestions = async () => {
    if (!canEdit || saving || migrationSuggestions.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await onSaveReferenceLinks([...links, ...migrationSuggestions])
      dismissMigration()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
        Reference links
      </Label>

      {links.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          No reference links yet.
        </div>
      ) : (
        <TooltipProvider delayDuration={120}>
          <ul className="space-y-1.5">
            {links.map((entry) => {
              const isEditing = editingId === entry.id
              const Icon = getIcon(entry.type)
              return (
                <li
                  key={entry.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-2"
                >
                  {isEditing && canEdit ? (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={editTitleDraft}
                          onChange={(event) => setEditTitleDraft(event.target.value)}
                          placeholder="Title"
                          aria-label="Edit reference link title"
                          disabled={saving}
                        />
                        <Input
                          value={editUrlDraft}
                          onChange={(event) => setEditUrlDraft(event.target.value)}
                          placeholder="URL"
                          aria-label="Edit reference link URL"
                          disabled={saving}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Select
                          value={editTypeDraft}
                          onValueChange={(value) => setEditTypeDraft(value as ShotReferenceLinkType)}
                          disabled={saving}
                        >
                          <SelectTrigger className="w-[160px]" aria-label="Edit reference link type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="web">
                              <span className="inline-flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5" />
                                Webpage
                              </span>
                            </SelectItem>
                            <SelectItem value="video">
                              <span className="inline-flex items-center gap-2">
                                <Video className="h-3.5 w-3.5" />
                                Video
                              </span>
                            </SelectItem>
                            <SelectItem value="document">
                              <span className="inline-flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" />
                                Document
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void handleSaveEdit()
                            }}
                            disabled={saving}
                          >
                            Save changes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                      {editError && (
                        <p className="text-xs text-[var(--color-error)]">{editError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-start gap-2">
                              <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-subtle)]" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[var(--color-text)]">
                                  {entry.title}
                                </div>
                                <div className="truncate text-xxs text-[var(--color-text-subtle)]">
                                  {getHost(entry.url)}
                                </div>
                              </div>
                            </div>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[360px] break-all">
                          {entry.url}
                        </TooltipContent>
                      </Tooltip>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${entry.title}`}
                            title="Edit link"
                            onClick={() => beginEdit(entry)}
                            disabled={saving}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Remove ${entry.title}`}
                            title="Remove link"
                            onClick={() => {
                              void handleRemove(entry.id)
                            }}
                            disabled={saving}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </TooltipProvider>
      )}

      {canEdit && !migrationDismissed && migrationSuggestions.length > 0 && (
        <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
              Found {migrationSuggestions.length} URL{migrationSuggestions.length === 1 ? "" : "s"} in notes. Import as structured links?
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleImportSuggestions()
                }}
                disabled={saving}
              >
                Import links
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={dismissMigration}
                disabled={saving}
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="Title (e.g. Moodboard)"
              aria-label="Reference link title"
              disabled={saving}
            />
            <Input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="URL (e.g. vimeo.com/...)"
              aria-label="Reference link URL"
              disabled={saving}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={typeDraft}
                onValueChange={(value) => setTypeDraft(value as DraftType)}
                disabled={saving}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <span className="inline-flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5" />
                      Auto-detect
                    </span>
                  </SelectItem>
                  <SelectItem value="web">
                    <span className="inline-flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Webpage
                    </span>
                  </SelectItem>
                  <SelectItem value="video">
                    <span className="inline-flex items-center gap-2">
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </span>
                  </SelectItem>
                  <SelectItem value="document">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Document
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleAdd()
                }}
                disabled={saving || normalizedTitle.length === 0 || normalizedUrlInput.length === 0}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add link
              </Button>
            </div>
            <p className="text-xs text-[var(--color-text-subtle)]">
              Links render as icon + title. Hover any row to reveal the full URL.
            </p>
          </div>
          {error && (
            <p className="text-xs text-[var(--color-error)]">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
