import { useMemo, useState, type ReactNode } from "react"
import { Package, Users, MapPin, Plus, HardHat } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { PageHeader } from "@/shared/components/PageHeader"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useAuth } from "@/app/providers/AuthProvider"
import { useShots } from "@/features/shots/hooks/useShots"
import { useTalent, useLocations, useProductFamilies } from "@/features/shots/hooks/usePickerData"
import { useCrew } from "@/features/schedules/hooks/useCrew"
import { canManageProjects } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { Checkbox } from "@/ui/checkbox"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"
import {
  addCrewToProject,
  addLocationsToProject,
  addTalentToProject,
  createCrewAndAddToProject,
  createLocationAndAddToProject,
  createTalentAndAddToProject,
  removeCrewFromProject,
  removeLocationFromProject,
  removeTalentFromProject,
} from "@/features/assets/lib/projectAssetsWrites"

type UsageRow = {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly sublabel?: string
}

type AssetItem = {
  readonly id: string
  readonly name: string
  readonly sublabel?: string
  readonly projectIds?: readonly string[]
}

function countHeroImages(shots: readonly Shot[]): number {
  let count = 0
  for (const shot of shots) {
    if (shot.heroImage?.path) count += 1
  }
  return count
}

export default function ProjectAssetsPage() {
  const { projectId, projectName } = useProjectScope()
  const { clientId, role } = useAuth()
  const isMobile = useIsMobile()
  const { data: shots, loading: shotsLoading, error: shotsError } = useShots()
  const { data: talent, loading: talentLoading, error: talentError } = useTalent()
  const { data: locations, loading: locationsLoading, error: locationsError } = useLocations()
  const { data: families, loading: familiesLoading, error: familiesError } = useProductFamilies()
  const { data: crew, loading: crewLoading, error: crewError } = useCrew(clientId)

  const loading =
    shotsLoading ||
    talentLoading ||
    locationsLoading ||
    familiesLoading ||
    crewLoading
  const error =
    shotsError || talentError || locationsError || familiesError || crewError

  const canEdit = canManageProjects(role) && !isMobile

  const heroCount = useMemo(() => countHeroImages(shots), [shots])

  const talentUsageRows = useMemo(() => {
    const usage = new Map<string, number>()
    for (const shot of shots) {
      const ids = shot.talentIds ?? shot.talent ?? []
      for (const id of ids) {
        if (!id) continue
        usage.set(id, (usage.get(id) ?? 0) + 1)
      }
    }

    const byId = new Map(talent.map((t) => [t.id, t]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.name ?? `Missing (${id})`,
        sublabel: byId.get(id)?.agency ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, talent])

  const locationUsageRows = useMemo(() => {
    const usage = new Map<string, number>()
    const fallback = new Map<string, string>()
    for (const shot of shots) {
      const id = shot.locationId
      if (!id) continue
      usage.set(id, (usage.get(id) ?? 0) + 1)
      if (shot.locationName) fallback.set(id, shot.locationName)
    }

    const byId = new Map(locations.map((l) => [l.id, l]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.name ?? fallback.get(id) ?? `Missing (${id})`,
        sublabel: byId.get(id)?.address ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, locations])

  const productUsageRows = useMemo(() => {
    const usage = new Map<string, number>()
    const fallback = new Map<string, string>()
    for (const shot of shots) {
      for (const assignment of shot.products) {
        const id = assignment.familyId
        if (!id) continue
        usage.set(id, (usage.get(id) ?? 0) + 1)
        if (assignment.familyName) fallback.set(id, assignment.familyName)
      }
    }

    const byId = new Map(families.map((f) => [f.id, f]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.styleName ?? fallback.get(id) ?? `Missing (${id})`,
        sublabel: byId.get(id)?.styleNumber ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, families])

  const talentItems = useMemo<readonly AssetItem[]>(() => {
    return talent.map((t) => ({
      id: t.id,
      name: t.name,
      sublabel: t.agency,
      projectIds: t.projectIds,
    }))
  }, [talent])

  const locationItems = useMemo<readonly AssetItem[]>(() => {
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      sublabel: loc.address,
      projectIds: loc.projectIds,
    }))
  }, [locations])

  const crewItems = useMemo<readonly AssetItem[]>(() => {
    return crew.map((c) => ({
      id: c.id,
      name: c.name,
      sublabel: [c.department, c.position].filter(Boolean).join(" • ") || undefined,
      projectIds: c.projectIds,
    }))
  }, [crew])

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
        title="Assets"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || projectId || "Project" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProjectScopedAssetCard
          title="Talent"
          icon={<Users className="h-4 w-4" />}
          kindLabel="talent"
          projectId={projectId}
          clientId={clientId}
          items={talentItems}
          usageRows={talentUsageRows}
          canEdit={canEdit}
          onAdd={async (ids) => addTalentToProject({ clientId, projectId, ids })}
          onRemove={async (id) => removeTalentFromProject({ clientId, projectId, id })}
          onCreate={async ({ name, sublabel, notes }) =>
            createTalentAndAddToProject({
              clientId,
              projectId,
              name,
              agency: sublabel,
              notes,
            })
          }
          createFields={{
            nameLabel: "Name",
            sublabelLabel: "Agency",
            notesLabel: "Notes",
          }}
        />

        <ProjectScopedAssetCard
          title="Locations"
          icon={<MapPin className="h-4 w-4" />}
          kindLabel="locations"
          projectId={projectId}
          clientId={clientId}
          items={locationItems}
          usageRows={locationUsageRows}
          canEdit={canEdit}
          onAdd={async (ids) => addLocationsToProject({ clientId, projectId, ids })}
          onRemove={async (id) => removeLocationFromProject({ clientId, projectId, id })}
          onCreate={async ({ name, sublabel, notes }) =>
            createLocationAndAddToProject({
              clientId,
              projectId,
              name,
              address: sublabel,
              notes,
            })
          }
          createFields={{
            nameLabel: "Name",
            sublabelLabel: "Address",
            notesLabel: "Notes",
          }}
        />

        <ProjectScopedAssetCard
          title="Crew"
          icon={<HardHat className="h-4 w-4" />}
          kindLabel="crew"
          projectId={projectId}
          clientId={clientId}
          items={crewItems}
          usageRows={[]}
          canEdit={canEdit}
          onAdd={async (ids) => addCrewToProject({ clientId, projectId, ids })}
          onRemove={async (id) => removeCrewFromProject({ clientId, projectId, id })}
          onCreate={async ({ name, sublabel, notes }) =>
            createCrewAndAddToProject({
              clientId,
              projectId,
              name,
              position: sublabel,
              notes,
            })
          }
          createFields={{
            nameLabel: "Name",
            sublabelLabel: "Role",
            notesLabel: "Notes",
          }}
        />

        <AssetUsageCard
          title="Products (from shots)"
          icon={<Package className="h-4 w-4" />}
          rows={productUsageRows}
          emptyLabel={shots.length === 0 ? "No shots yet" : "No products assigned"}
        />

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Images</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <div>
              <div className="text-2xl font-semibold text-[var(--color-text)]">
                {heroCount}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Shots with hero images
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-[var(--color-text)]">
                {shots.length}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Total shots
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}

function AssetUsageCard({
  title,
  icon,
  rows,
  emptyLabel,
}: {
  readonly title: string
  readonly icon: ReactNode
  readonly rows: readonly UsageRow[]
  readonly emptyLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <span className="ml-auto text-xs font-normal text-[var(--color-text-muted)]">
            {rows.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.slice(0, 18).map((row) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--color-text)]">
                    {row.label}
                  </div>
                  {row.sublabel ? (
                    <div className="truncate text-xs text-[var(--color-text-muted)]">
                      {row.sublabel}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {row.count} shot{row.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
            {rows.length > 18 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                Showing top 18 by usage.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProjectScopedAssetCard({
  title,
  icon,
  kindLabel,
  clientId,
  projectId,
  items,
  usageRows,
  canEdit,
  onAdd,
  onRemove,
  onCreate,
  createFields,
}: {
  readonly title: string
  readonly icon: ReactNode
  readonly kindLabel: string
  readonly clientId: string | null
  readonly projectId: string | null
  readonly items: readonly AssetItem[]
  readonly usageRows: readonly UsageRow[]
  readonly canEdit: boolean
  readonly onAdd: (ids: readonly string[]) => Promise<void>
  readonly onRemove: (id: string) => Promise<void>
  readonly onCreate: (input: {
    readonly name: string
    readonly sublabel: string
    readonly notes: string
  }) => Promise<void>
  readonly createFields: {
    readonly nameLabel: string
    readonly sublabelLabel: string
    readonly notesLabel: string
  }
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const usageById = useMemo(() => {
    return new Map(usageRows.map((r) => [r.id, r.count]))
  }, [usageRows])

  const projectItems = useMemo(() => {
    if (!projectId) return [] as AssetItem[]
    const inProject = items.filter((i) => (i.projectIds ?? []).includes(projectId))
    return [...inProject].sort((a, b) => {
      const ua = usageById.get(a.id) ?? 0
      const ub = usageById.get(b.id) ?? 0
      return ub - ua || a.name.localeCompare(b.name)
    })
  }, [items, projectId, usageById])

  const existingIds = useMemo(() => new Set(projectItems.map((i) => i.id)), [projectItems])

  const missingFromLibrary = useMemo(() => {
    const missing: UsageRow[] = []
    for (const row of usageRows) {
      if (!row.id) continue
      if (items.some((i) => i.id === row.id)) continue
      missing.push(row)
    }
    return missing.slice(0, 3)
  }, [items, usageRows])

  if (!clientId || !projectId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-muted)]">
            Select a project to manage assets.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <span className="ml-auto text-xs font-normal text-[var(--color-text-muted)]">
            {projectItems.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {missingFromLibrary.length > 0 ? (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
            <div className="text-xs font-medium text-[var(--color-text)]">
              Needs attention
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              {missingFromLibrary.length} {kindLabel} referenced by shots{" "}
              {missingFromLibrary.length === 1 ? "is" : "are"} missing from the org
              library.
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            Manage what’s available for this project.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              disabled={!canEdit}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canEdit}
            >
              New
            </Button>
          </div>
        </div>

        {projectItems.length === 0 ? (
          <CompactEmptyState
            icon={icon}
            title={`No ${kindLabel} in this project`}
            description="Add existing library items, or create new ones."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {projectItems.slice(0, 18).map((item) => (
              <ProjectAssetRow
                key={item.id}
                item={item}
                usageCount={usageById.get(item.id) ?? 0}
                canEdit={canEdit}
                onRemove={onRemove}
              />
            ))}
            {projectItems.length > 18 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                Showing first 18. Use search in Add to find more.
              </p>
            ) : null}
          </div>
        )}

        <AddAssetsDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          title={`Add ${title}`}
          items={items}
          existingIds={existingIds}
          onAdd={onAdd}
        />

        <CreateAssetDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={`New ${title}`}
          fields={createFields}
          onCreate={onCreate}
        />
      </CardContent>
    </Card>
  )
}

function CompactEmptyState({
  icon,
  title,
  description,
}: {
  readonly icon: ReactNode
  readonly title: string
  readonly description?: string
}) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center">
      <div className="mx-auto flex w-fit items-center justify-center text-[var(--color-text-subtle)]">
        {icon}
      </div>
      <div className="mt-2 text-sm font-medium text-[var(--color-text)]">
        {title}
      </div>
      {description ? (
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
          {description}
        </div>
      ) : null}
    </div>
  )
}

function ProjectAssetRow({
  item,
  usageCount,
  canEdit,
  onRemove,
}: {
  readonly item: AssetItem
  readonly usageCount: number
  readonly canEdit: boolean
  readonly onRemove: (id: string) => Promise<void>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await onRemove(item.id)
      toast.success("Removed from project")
    } catch (err) {
      toast.error("Failed to remove", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const needsConfirm = usageCount > 0

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">
          {item.name}
        </div>
        {item.sublabel ? (
          <div className="truncate text-xs text-[var(--color-text-muted)]">
            {item.sublabel}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {usageCount > 0 ? (
          <div className="text-xs text-[var(--color-text-muted)]">
            {usageCount} shot{usageCount === 1 ? "" : "s"}
          </div>
        ) : (
          <div className="text-xs text-[var(--color-text-muted)]">—</div>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!canEdit || busy}
          onClick={() => {
            if (needsConfirm) setConfirmOpen(true)
            else remove()
          }}
        >
          Remove
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove from project?"
        description={`This item is referenced by ${usageCount} shot${usageCount === 1 ? "" : "s"}. Removing it may make pickers harder to use, but existing shot references will remain.`}
        confirmLabel={busy ? "Removing..." : "Remove"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          remove()
        }}
      />
    </div>
  )
}

function AddAssetsDialog({
  open,
  onOpenChange,
  title,
  items,
  existingIds,
  onAdd,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly items: readonly AssetItem[]
  readonly existingIds: ReadonlySet<string>
  readonly onAdd: (ids: readonly string[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const available = useMemo(() => {
    return items.filter((i) => !existingIds.has(i.id))
  }, [existingIds, items])

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => setDraft(new Set())

  const save = async () => {
    const ids = [...draft]
    if (ids.length === 0) return
    setSaving(true)
    try {
      await onAdd(ids)
      toast.success(`Added ${ids.length} item${ids.length === 1 ? "" : "s"}`)
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error("Failed to add", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Everything in the org library is already in this project.
          </p>
        ) : (
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {available.map((i) => (
                  <CommandItem
                    key={i.id}
                    onSelect={() => toggle(i.id)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={draft.has(i.id)} />
                    <div className="min-w-0">
                      <div className="truncate">{i.name}</div>
                      {i.sublabel ? (
                        <div className="truncate text-xs text-[var(--color-text-muted)]">
                          {i.sublabel}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={draft.size === 0 || saving}>
            {saving ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateAssetDialog({
  open,
  onOpenChange,
  title,
  fields,
  onCreate,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly fields: {
    readonly nameLabel: string
    readonly sublabelLabel: string
    readonly notesLabel: string
  }
  readonly onCreate: (input: {
    readonly name: string
    readonly sublabel: string
    readonly notes: string
  }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [sublabel, setSublabel] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setSublabel("")
    setNotes("")
    setSaving(false)
    setError(null)
  }

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      await onCreate({ name, sublabel, notes })
      toast.success("Created")
      onOpenChange(false)
      reset()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error("Failed to create", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-name">{fields.nameLabel}</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Required"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-sublabel">{fields.sublabelLabel}</Label>
            <Input
              id="asset-sublabel"
              value={sublabel}
              onChange={(e) => setSublabel(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-notes">{fields.notesLabel}</Label>
            <Input
              id="asset-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {error ? (
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
