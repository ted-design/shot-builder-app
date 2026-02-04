import { useEffect, useMemo, useRef, useState } from "react"
import { Users, Plus, X, Upload } from "lucide-react"
import type { ChangeEvent } from "react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
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
import { useProjects } from "@/features/projects/hooks/useProjects"
import {
  addTalentToProject,
  createTalent,
  removeTalentFromProject,
  removeTalentHeadshot,
  setTalentHeadshot,
  updateTalent,
} from "@/features/library/lib/talentWrites"
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
        const next = draft.trim()
        if (next !== value.trim()) onCommit(next)
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

const MEASUREMENT_FIELDS: ReadonlyArray<{ key: string; label: string; placeholder: string }> = [
  { key: "height", label: "Height", placeholder: `e.g. 5'9"` },
  { key: "bust", label: "Bust", placeholder: `e.g. 34"` },
  { key: "waist", label: "Waist", placeholder: `e.g. 25"` },
  { key: "hips", label: "Hips", placeholder: `e.g. 35"` },
  { key: "inseam", label: "Inseam", placeholder: `e.g. 32"` },
  { key: "dress", label: "Dress", placeholder: `e.g. 2` },
  { key: "shoes", label: "Shoes", placeholder: `e.g. 8` },
]

const SELECT_NONE = "__none__"

export default function LibraryTalentPage() {
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = (role === "admin" || role === "producer") && !isMobile
  const { data: talent, loading, error } = useTalentLibrary()
  const { data: projects } = useProjects()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [headshotRemoveOpen, setHeadshotRemoveOpen] = useState(false)

  const [createName, setCreateName] = useState("")
  const [createAgency, setCreateAgency] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createGender, setCreateGender] = useState<string>("")
  const [createUrl, setCreateUrl] = useState("")
  const [createNotes, setCreateNotes] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  if (loading) return <LoadingState loading />

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
          canEdit ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New talent
            </Button>
          ) : null
        }
      />

      {talent.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No talent yet"
          description={
            canEdit
              ? "Add talent profiles to build a casting-ready library."
              : "Talent profiles will appear here."
          }
          actionLabel={canEdit ? "Create talent" : undefined}
          onAction={canEdit ? () => setCreateOpen(true) : undefined}
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
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">No results.</p>
            </div>
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
                      className={`rounded-md border p-3 text-left transition-colors ${
                        selected
                          ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]"
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
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedId(null)}
                        aria-label="Close details"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-6 lg:grid-cols-2">
                      <div className="flex flex-col gap-4">
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                            Measurements
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {MEASUREMENT_FIELDS.map((field) => {
                              const measurements = selected.measurements ?? {}
                              const value = (measurements as Record<string, unknown>)[field.key]
                              const display = typeof value === "string" || typeof value === "number" ? String(value) : ""
                              return (
                                <div key={field.key}>
                                  <div className="text-xs text-[var(--color-text-muted)]">{field.label}</div>
                                  <InlineInput
                                    value={display}
                                    placeholder={field.placeholder}
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
                            Tip: keep values flexible (e.g. 5&apos;9&quot;, 34&quot;).
                          </div>
                        </div>

                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                            Notes
                          </div>
                          <InlineTextarea
                            value={selected.notes ?? ""}
                            disabled={!canEdit || busy}
                            placeholder="Notes about sizing, fit, availability…"
                            className="mt-3 min-h-[140px]"
                            onCommit={(next) => {
                              void savePatch(selected.id, { notes: next || null })
                            }}
                          />
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
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
    </ErrorBoundary>
  )
}
