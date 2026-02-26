import { useMemo, useRef, useState } from "react"
import { orderBy } from "firebase/firestore"
import { Palette, Search, Trash2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageHeader } from "@/shared/components/PageHeader"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { colorSwatchesPath } from "@/shared/lib/paths"
import { ROLE, canManageProducts } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { ColorSwatch } from "@/shared/types"
import { toast } from "sonner"
import {
  buildColorKey,
  normalizeHexColor,
} from "@/features/library/lib/colorSwatches"
import {
  deleteColorSwatch,
  saveColorSwatch,
} from "@/features/library/lib/colorSwatchWrites"

function mapSwatchDoc(id: string, data: Record<string, unknown>): ColorSwatch {
  const name =
    typeof data["name"] === "string" && data["name"].trim().length > 0
      ? data["name"].trim()
      : id

  const hexColorRaw = data["hexColor"]
  const hexColor =
    typeof hexColorRaw === "string" ? normalizeHexColor(hexColorRaw) : null

  return {
    id,
    name,
    colorKey: typeof data["colorKey"] === "string" ? data["colorKey"] : undefined,
    normalizedName:
      typeof data["normalizedName"] === "string" ? data["normalizedName"] : undefined,
    hexColor,
    aliases: Array.isArray(data["aliases"])
      ? (data["aliases"].filter((x) => typeof x === "string" && x.trim().length > 0) as string[])
      : undefined,
    swatchImagePath:
      typeof data["swatchImagePath"] === "string" ? data["swatchImagePath"] : null,
    createdAt: data["createdAt"],
    updatedAt: data["updatedAt"],
  }
}

function InlineHexEdit({
  value,
  disabled,
  onSave,
}: {
  readonly value: string | null | undefined
  readonly disabled: boolean
  readonly onSave: (next: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const normalizedValue = value ? normalizeHexColor(value) : null

  const cancel = () => {
    setDraft(normalizedValue ?? "")
    setEditing(false)
    setError(null)
  }

  const trySave = async () => {
    const next = draft.trim()
    if (!next) {
      await onSave(null)
      setEditing(false)
      setError(null)
      return
    }

    const normalized = normalizeHexColor(next)
    if (!normalized) {
      setError("Use #RRGGBB")
      inputRef.current?.focus()
      inputRef.current?.select()
      return
    }

    if (normalized === normalizedValue) {
      setEditing(false)
      setError(null)
      return
    }

    await onSave(normalized)
    setEditing(false)
    setError(null)
  }

  if (!editing) {
    const display = normalizedValue ?? ""
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setDraft(display)
          setEditing(true)
          setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
          }, 0)
        }}
        className="flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--color-surface-subtle)] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span
          className="h-4 w-4 rounded border border-[var(--color-border)]"
          style={{ backgroundColor: display || "#CBD5E1" }}
        />
        <span className="font-mono text-xs text-[var(--color-text-muted)]">
          {display || "—"}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void trySave()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void trySave()
          if (e.key === "Escape") cancel()
        }}
        className="h-8 font-mono text-xs"
      />
      {error ? <div className="text-xs text-[var(--color-error)]">{error}</div> : null}
    </div>
  )
}

export default function LibraryPalettePage() {
  const { clientId, role } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = canManageProducts(role) && !isMobile
  const canDelete = role === ROLE.ADMIN && !isMobile

  const { data: swatches, loading, error } = useFirestoreCollection<ColorSwatch>(
    clientId ? colorSwatchesPath(clientId) : null,
    [orderBy("name", "asc")],
    mapSwatchDoc,
  )

  const [query, setQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [newHex, setNewHex] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ColorSwatch | null>(null)

  const createNameRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return swatches
    return swatches.filter((s) => {
      const name = (s.name ?? "").toLowerCase()
      const key = (s.colorKey ?? s.id).toLowerCase()
      return name.includes(q) || key.includes(q)
    })
  }, [query, swatches])

  const existingCreateId = useMemo(() => {
    const trimmed = newName.trim()
    if (!trimmed) return null
    const id = buildColorKey(trimmed)
    return swatches.some((s) => s.id === id) ? id : null
  }, [newName, swatches])

  const create = async () => {
    if (!clientId) return
    const name = newName.trim()
    if (!name) {
      toast.error("Name is required")
      createNameRef.current?.focus()
      return
    }

    const hexColor = newHex.trim() ? normalizeHexColor(newHex) : null
    if (newHex.trim() && !hexColor) {
      toast.error("Hex must be in #RRGGBB format")
      return
    }

    const swatchId = buildColorKey(name)
    const isNew = !swatches.some((s) => s.id === swatchId)

    setBusyKey("new")
    try {
      await saveColorSwatch({
        clientId,
        swatchId,
        name,
        hexColor,
        isNew,
      })
      toast.success(isNew ? "Swatch created" : "Swatch updated")
      setNewName("")
      setNewHex("")
      createNameRef.current?.focus()
    } catch (err) {
      toast.error("Failed to save swatch", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const update = async (
    swatch: ColorSwatch,
    patch: { readonly name?: string; readonly hexColor?: string | null },
  ) => {
    if (!clientId) return
    setBusyKey(swatch.id)
    try {
      await saveColorSwatch({
        clientId,
        swatchId: swatch.id,
        name: patch.name ?? swatch.name,
        hexColor: patch.hexColor ?? swatch.hexColor ?? null,
        isNew: false,
      })
      toast.success("Saved")
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const openDelete = (swatch: ColorSwatch) => {
    setDeleteTarget(swatch)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!clientId || !deleteTarget) return
    setBusyKey(deleteTarget.id)
    try {
      await deleteColorSwatch({ clientId, swatchId: deleteTarget.id })
      toast.success("Swatch deleted")
      setDeleteOpen(false)
      setDeleteTarget(null)
    } catch (err) {
      toast.error("Failed to delete swatch", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusyKey(null)
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
      <PageHeader title="Palette" breadcrumbs={[{ label: "Library" }]} />

      <div className="flex flex-col gap-4">
        {canEdit ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">New swatch</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <div className="label-meta">
                  Name
                </div>
                <Input
                  ref={createNameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Olive"
                />
              </div>
              <div className="w-full sm:w-48">
                <div className="label-meta">
                  Hex
                </div>
                <Input
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  placeholder="#AABBCC"
                  className="font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => void create()} disabled={busyKey === "new"}>
                  {busyKey === "new" ? "Saving..." : existingCreateId ? "Update" : "Create"}
                </Button>
              </div>
            </CardContent>
            {existingCreateId ? (
              <div className="px-6 pb-4 text-xs text-[var(--color-text-muted)]">
                Swatch key <span className="font-mono">{existingCreateId}</span> already exists.
                Creating will update it.
              </div>
            ) : null}
          </Card>
        ) : null}

        {swatches.length === 0 ? (
          <EmptyState
            icon={<Palette className="h-12 w-12" />}
            title="No swatches yet"
            description={
              canEdit
                ? "Create swatches to standardize product colors across your org."
                : "Swatches will appear here."
            }
            actionLabel={canEdit ? "Create a swatch" : undefined}
            onAction={
              canEdit
                ? () => {
                    createNameRef.current?.focus()
                  }
                : undefined
            }
          />
        ) : (
          <>
            <div className="max-w-md">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search swatches…"
              />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All swatches</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<Search className="h-12 w-12" />}
                    title="No matching swatches"
                    description="Try adjusting your search."
                    actionLabel="Clear search"
                    onAction={() => setQuery("")}
                  />
                ) : isMobile ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((s) => (
                      <Card key={s.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-10 w-10 rounded-md border border-[var(--color-border)]"
                              style={{ backgroundColor: s.hexColor || "#CBD5E1" }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--color-text)]">
                                {s.name}
                              </div>
                              <div className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
                                {s.hexColor || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                            Editing is available on desktop.
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[36px_1fr_160px_84px] gap-3 border-b border-[var(--color-border)] pb-2 label-meta">
                      <div> </div>
                      <div>Name</div>
                      <div>Hex</div>
                      <div className="text-right"> </div>
                    </div>
                    {filtered.map((s) => {
                      const busy = busyKey === s.id
                      return (
                        <div
                          key={s.id}
                          className="grid grid-cols-[36px_1fr_160px_84px] items-start gap-3 rounded-md border border-transparent py-2 hover:bg-[var(--color-surface-subtle)]"
                        >
                          <div className="pt-1.5">
                            <span
                              className="block h-6 w-6 rounded border border-[var(--color-border)]"
                              style={{ backgroundColor: s.hexColor || "#CBD5E1" }}
                            />
                          </div>
                          <div className="min-w-0 pt-1">
                            <InlineEdit
                              value={s.name}
                              disabled={!canEdit || busy}
                              placeholder="Untitled"
                              onSave={(next) => {
                                void update(s, { name: next })
                              }}
                              className="text-sm font-medium text-[var(--color-text)]"
                            />
                            <div className="mt-1 font-mono text-2xs text-[var(--color-text-muted)]">
                              {s.id}
                            </div>
                          </div>
                          <div className="pt-0.5">
                            <InlineHexEdit
                              value={s.hexColor}
                              disabled={!canEdit || busy}
                              onSave={async (next) => update(s, { hexColor: next })}
                            />
                          </div>
                          <div className="flex justify-end pt-0.5">
                            {canDelete ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => openDelete(s)}
                                className="gap-1 text-[var(--color-error)] hover:text-[var(--color-error)]"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-2 text-xs text-[var(--color-text-muted)]">
                      {swatches.length} swatch{swatches.length === 1 ? "" : "es"}
                      {canEdit && !canDelete ? " • Delete requires admin." : ""}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete swatch?"
        description={`Deletes "${deleteTarget?.name ?? "this swatch"}" from the org palette.`}
        confirmLabel={busyKey === deleteTarget?.id ? "Deleting..." : "Delete"}
        destructive
        confirmDisabled={busyKey === deleteTarget?.id}
        onConfirm={() => {
          void confirmDelete()
        }}
      />
    </ErrorBoundary>
  )
}
