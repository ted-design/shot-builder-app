import { useEffect, useMemo, useRef, useState } from "react"
import { Users, Plus, X, Upload, Trash2, GripVertical, Search } from "lucide-react"
import type { ChangeEvent } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { toast } from "sonner"
import type { TalentRecord } from "@/shared/types"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { canManageTalent } from "@/shared/lib/rbac"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { TalentCastingPrintPortal } from "@/features/library/components/TalentCastingPrintPortal"
import {
  addTalentToProject,
  createTalent,
  deleteTalent,
  deleteTalentImagePaths,
  removeTalentFromProject,
  removeTalentHeadshot,
  setTalentHeadshot,
  uploadTalentCastingImages,
  uploadTalentPortfolioImages,
  updateTalent,
} from "@/features/library/lib/talentWrites"
import { getMeasurementOptionsForGender } from "@/features/library/lib/measurementOptions"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

function buildDisplayName(talent: TalentRecord): string {
  const name = talent.name?.trim()
  if (name) return name
  const first = (talent.firstName ?? "").trim()
  const last = (talent.lastName ?? "").trim()
  const combined = `${first} ${last}`.trim()
  return combined || "Unnamed talent"
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${first}${last}`.toUpperCase()
}

function HeadshotThumb({ talent }: { readonly talent: TalentRecord }) {
  const path = talent.headshotPath || talent.imageUrl || undefined
  const url = useStorageUrl(path)
  const name = buildDisplayName(talent)
  return (
    <div className="h-14 w-14 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--color-text-muted)]">
          {initials(name)}
        </div>
      )}
    </div>
  )
}

type TalentImage = NonNullable<TalentRecord["galleryImages"]>[number]
type CastingSession = NonNullable<TalentRecord["castingSessions"]>[number]

function normalizeImages(raw: TalentRecord["galleryImages"] | undefined): TalentImage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((img, index) => {
      if (!img || typeof img !== "object") return null
      const id = typeof img.id === "string" && img.id.trim().length > 0 ? img.id.trim() : null
      const path = typeof img.path === "string" && img.path.trim().length > 0 ? img.path.trim() : null
      if (!id || !path) return null
      const order = typeof img.order === "number" ? img.order : index
      const downloadURL =
        typeof img.downloadURL === "string" && img.downloadURL.trim().length > 0
          ? img.downloadURL.trim()
          : null
      const description =
        typeof img.description === "string" ? img.description : null
      return { ...img, id, path, downloadURL, description, order }
    })
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) as TalentImage[]
}

function normalizeSessions(raw: TalentRecord["castingSessions"] | undefined): CastingSession[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s) => {
      if (!s || typeof s !== "object") return null
      const id = typeof s.id === "string" && s.id.trim().length > 0 ? s.id.trim() : null
      const date = typeof s.date === "string" ? s.date.trim() : ""
      if (!id || !date) return null
      const title = typeof s.title === "string" ? s.title : null
      const projectId =
        typeof s.projectId === "string" && s.projectId.trim().length > 0 ? s.projectId.trim() : null
      const location =
        typeof s.location === "string" && s.location.trim().length > 0 ? s.location.trim() : null
      const brief = typeof s.brief === "string" && s.brief.trim().length > 0 ? s.brief.trim() : null
      const decision =
        typeof s.decision === "string" && s.decision.trim().length > 0 ? s.decision.trim() : null
      const rawRating = (s as { rating?: unknown }).rating
      const parsedRating =
        typeof rawRating === "number"
          ? rawRating
          : typeof rawRating === "string"
            ? Number.parseInt(rawRating, 10)
            : null
      const rating =
        typeof parsedRating === "number" && Number.isFinite(parsedRating) && parsedRating >= 1 && parsedRating <= 5
          ? parsedRating
          : null
      const notes = typeof s.notes === "string" ? s.notes : null
      const images = normalizeImages(s.images as TalentRecord["galleryImages"])
      return { ...s, id, date, title, projectId, location, brief, decision, rating, notes, images }
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date)) as CastingSession[]
}

function ImageThumb({ image, alt }: { readonly image: TalentImage; readonly alt: string }) {
  const url = useStorageUrl(image.downloadURL ?? image.path)
  return (
    <div className="aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-[var(--color-text-muted)]">
          —
        </div>
      )}
    </div>
  )
}

function SortableImageTile({
  image,
  disabled,
  onDelete,
  onCaptionSave,
}: {
  readonly image: TalentImage
  readonly disabled: boolean
  readonly onDelete: () => void
  readonly onCaptionSave: (next: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="rounded bg-black/40 p-1 text-[var(--color-text-inverted)] hover:bg-black/55 disabled:opacity-40"
          aria-label="Reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute right-2 top-2 z-10">
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="rounded bg-black/40 p-1 text-[var(--color-text-inverted)] hover:bg-black/55 disabled:opacity-40"
          aria-label="Remove image"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ImageThumb image={image} alt="Talent image" />

      <div className="mt-2">
        <InlineEdit
          value={(image.description ?? "").trim()}
          disabled={disabled}
          placeholder="Add caption"
          onSave={onCaptionSave}
          className="text-xs text-[var(--color-text-muted)]"
        />
      </div>
    </div>
  )
}

function InlineInput({
  value,
  disabled,
  placeholder,
  onCommit,
  className,
}: {
  readonly value: string
  readonly disabled: boolean
  readonly placeholder?: string
  readonly onCommit: (next: string) => void
  readonly className?: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next !== value.trim()) onCommit(next)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={className}
    />
  )
}

function InlineTextarea({
  value,
  disabled,
  placeholder,
  onCommit,
  className,
}: {
  readonly value: string
  readonly disabled: boolean
  readonly placeholder?: string
  readonly onCommit: (next: string) => void
  readonly className?: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Textarea
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
    />
  )
}

const MEASUREMENT_PLACEHOLDERS: Readonly<Record<string, string>> = {
  height: `e.g. 5'9"`,
  bust: `e.g. 34"`,
  waist: `e.g. 25"`,
  hips: `e.g. 35"`,
  inseam: `e.g. 32"`,
  dress: "e.g. 2",
  shoes: "e.g. 8",
  collar: `e.g. 15.5"`,
  sleeve: `e.g. 34"`,
  suit: "e.g. 40R",
}

const SELECT_NONE = "__none__"

const CASTING_DECISION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "shortlist", label: "Shortlist" },
  { value: "hold", label: "Hold" },
  { value: "pass", label: "Pass" },
  { value: "booked", label: "Booked" },
]

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
  const portfolioInputRef = useRef<HTMLInputElement>(null)

  const [createName, setCreateName] = useState("")
  const [createAgency, setCreateAgency] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createGender, setCreateGender] = useState<string>("")
  const [createUrl, setCreateUrl] = useState("")
  const [createNotes, setCreateNotes] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return talent
    return talent.filter((t) => {
      const name = buildDisplayName(t).toLowerCase()
      const agency = (t.agency ?? "").toLowerCase()
      const email = (t.email ?? "").toLowerCase()
      const phone = (t.phone ?? "").toLowerCase()
      return name.includes(q) || agency.includes(q) || email.includes(q) || phone.includes(q)
    })
  }, [query, talent])

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

  const availableProjectOptions = useMemo(() => {
    if (!selected?.projectIds) return projects
    const set = new Set(selected.projectIds)
    return projects.filter((p) => !set.has(p.id))
  }, [projects, selected?.projectIds])

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

  const onHeadshotFile = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const onPortfolioFiles = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const onCastingFiles = async (sessionId: string, event: ChangeEvent<HTMLInputElement>) => {
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

  const submitCreate = async () => {
    if (!clientId) return
    const name = createName.trim()
    if (!name) {
      toast.error("Name is required")
      return
    }

    setBusy(true)
    try {
      const id = await createTalent({
        clientId,
        userId: user?.uid ?? null,
        name,
        agency: createAgency.trim() || null,
        email: createEmail.trim() || null,
        phone: createPhone.trim() || null,
        url: createUrl.trim() || null,
        gender: createGender.trim() || null,
        notes: createNotes.trim() || null,
        measurements: null,
        headshotFile: null,
      })
      toast.success("Talent created")
      setCreateOpen(false)
      setSelectedId(id)
      setCreateName("")
      setCreateAgency("")
      setCreateEmail("")
      setCreatePhone("")
      setCreateUrl("")
      setCreateGender("")
      setCreateNotes("")
    } catch (err) {
      toast.error("Failed to create talent", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
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
          <div className="max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search talent…"
            />
          </div>

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
                {filtered.map((t) => {
                  const selected = selectedId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId((prev) => (prev === t.id ? null : t.id))}
                      className={`rounded-md border p-3 text-left transition-[colors,box-shadow] ${
                        selected
                          ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] hover:shadow-md"
                      }`}
                    >
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

              {selected ? (
                <Card>
                  <CardContent className="py-5">
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
                          <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                            <div data-testid="talent-details-name">
                              <InlineEdit
                                value={buildDisplayName(selected)}
                                disabled={!canEdit || busy}
                                placeholder="Untitled"
                                onSave={(next) => void savePatch(selected.id, { name: next })}
                                className="text-xl font-semibold"
                              />
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {isMobile ? "Read-only on mobile." : canEdit ? "Click fields to edit." : "Read-only."}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedId(null)}
                          aria-label="Close details"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

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
                          <div className="mt-3 flex flex-col gap-2">
                            {(selected.projectIds ?? []).length === 0 ? (
                              <div className="text-sm text-[var(--color-text-muted)]">Not linked to any projects.</div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {(selected.projectIds ?? []).map((pid) => (
                                  <div
                                    key={pid}
                                    className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs text-[var(--color-text)]"
                                  >
                                    <span className="max-w-[200px] truncate">
                                      {projectLookup.get(pid) ?? pid}
                                    </span>
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                        disabled={busy}
                                        onClick={() => {
                                          if (!clientId) return
                                          setBusy(true)
                                          removeTalentFromProject({
                                            clientId,
                                            userId: user?.uid ?? null,
                                            talentId: selected.id,
                                            projectId: pid,
                                          })
                                            .then(() => toast.success("Removed from project"))
                                            .catch((err) =>
                                              toast.error("Failed to remove", {
                                                description:
                                                  err instanceof Error ? err.message : "Unknown error",
                                              }),
                                            )
                                            .finally(() => setBusy(false))
                                        }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}

                            {canEdit && availableProjectOptions.length > 0 ? (
                              <Select
                                value=""
                                onValueChange={(pid) => {
                                  if (!clientId) return
                                  if (!pid) return
                                  setBusy(true)
                                  addTalentToProject({
                                    clientId,
                                    userId: user?.uid ?? null,
                                    talentId: selected.id,
                                    projectId: pid,
                                  })
                                    .then(() => toast.success("Added to project"))
                                    .catch((err) =>
                                      toast.error("Failed to add", {
                                        description:
                                          err instanceof Error ? err.message : "Unknown error",
                                      }),
                                    )
                                    .finally(() => setBusy(false))
                                }}
                                disabled={busy}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Add to project…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableProjectOptions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name || p.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
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
                                      const nextMeasurements = { ...(selected.measurements ?? {}) }
                                      nextMeasurements[field.key] = next
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
                                                  disabled={!selected || busy}
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
                                                        // reuse gallery removal dialog; deletion handler will detect presence in session below
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create talent</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="label-meta">
                Name
              </div>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Full name"
                disabled={busy}
              />
            </div>
            <div>
              <div className="label-meta">
                Agency
              </div>
              <Input
                value={createAgency}
                onChange={(e) => setCreateAgency(e.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </div>
            <div>
              <div className="label-meta">
                Gender
              </div>
              <Select
                value={createGender || SELECT_NONE}
                onValueChange={(next) => setCreateGender(next === SELECT_NONE ? "" : next)}
                disabled={busy}
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
              <div className="label-meta">
                Email
              </div>
              <Input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </div>
            <div>
              <div className="label-meta">
                Phone
              </div>
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="label-meta">
                Reference URL
              </div>
              <Input
                value={createUrl}
                onChange={(e) => setCreateUrl(e.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="label-meta">
                Notes
              </div>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Optional"
                disabled={busy}
                className="mt-1 min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={busy}>
              {busy ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={headshotRemoveOpen}
        onOpenChange={setHeadshotRemoveOpen}
        title="Remove headshot?"
        description="This removes the headshot from this talent profile."
        confirmLabel={busy ? "Removing..." : "Remove"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          void confirmRemoveHeadshot()
        }}
      />

      <ConfirmDialog
        open={galleryRemoveOpen}
        onOpenChange={setGalleryRemoveOpen}
        title="Remove image?"
        description="This removes the image from this profile."
        confirmLabel={busy ? "Removing..." : "Remove"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          if (!galleryRemoveTarget || !selected) return
          const inPortfolio = portfolioImages.some((i) => i.id === galleryRemoveTarget.id)
          if (inPortfolio) {
            const next = portfolioImages.filter((i) => i.id !== galleryRemoveTarget.id)
            void updateGallery(next, [galleryRemoveTarget.path], "Image removed")
            setGalleryRemoveTarget(null)
            return
          }

          const session = castingSessions.find((s) =>
            (s.images ?? []).some((i) => i.id === galleryRemoveTarget.id),
          )
          if (!session) return
          const nextSessions = castingSessions.map((s) => {
            if (s.id !== session.id) return s
            return { ...s, images: (s.images ?? []).filter((i) => i.id !== galleryRemoveTarget.id) }
          })
          void updateCastingSessions(nextSessions, [galleryRemoveTarget.path], "Image removed")
          setGalleryRemoveTarget(null)
        }}
      />

      <ConfirmDialog
        open={sessionRemoveOpen}
        onOpenChange={setSessionRemoveOpen}
        title="Delete casting?"
        description="This deletes the casting session and all its images."
        confirmLabel={busy ? "Deleting..." : "Delete"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          if (!sessionRemoveTarget || !selected) return
          const removedPaths = (sessionRemoveTarget.images ?? []).map((i) => i.path)
          const nextSessions = castingSessions.filter((s) => s.id !== sessionRemoveTarget.id)
          void updateCastingSessions(nextSessions, removedPaths, "Casting deleted")
          setSessionRemoveTarget(null)
        }}
      />

      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add casting</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <div className="label-meta">
                Date
              </div>
              <Input
                type="date"
                value={createSessionDate}
                onChange={(e) => setCreateSessionDate(e.target.value)}
                disabled={busy}
                aria-label="Casting date"
              />
            </div>
            <div>
              <div className="label-meta">
                Title (optional)
              </div>
              <Input
                value={createSessionTitle}
                onChange={(e) => setCreateSessionTitle(e.target.value)}
                placeholder="e.g. Jan 30 casting"
                disabled={busy}
                aria-label="Casting title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSessionOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void createCastingSession()} disabled={busy}>
              {busy ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete talent?"
        description="This permanently deletes this talent profile and all associated images. This cannot be undone."
        confirmLabel={busy ? "Deleting..." : "Delete"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
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
        }}
      />

      {selected && printSession ? (
        <TalentCastingPrintPortal
          open={Boolean(printSessionId)}
          onOpenChange={(open) => {
            if (!open) setPrintSessionId(null)
          }}
          talent={selected}
          session={printSession}
          projectName={
            printSession.projectId
              ? projectLookup.get(printSession.projectId) ?? printSession.projectId
              : null
          }
        />
      ) : null}
    </ErrorBoundary>
  )
}
