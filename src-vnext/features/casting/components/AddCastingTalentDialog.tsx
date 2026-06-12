import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Input } from "@/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { buildDisplayName, initials } from "@/features/library/components/talentUtils"
import {
  genderBadgeClasses,
  genderDisplayLabel,
} from "@/features/library/lib/measurementOptions"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import type { TalentRecord } from "@/shared/types"

/**
 * Avatar for a talent row. Resolves the headshot the SAME way the library list and
 * casting cards do — useStorageUrl(headshotPath || imageUrl) — instead of relying on
 * the denormalized headshotUrl field (which is only populated when a headshot was
 * uploaded through the library flow, so it was blank for most talent here). Extracted
 * into its own component because useStorageUrl is a hook and can't run inside .map().
 */
function CastingTalentAvatar({
  talent,
  name,
}: {
  readonly talent: TalentRecord
  readonly name: string
}) {
  const path = talent.headshotPath || talent.imageUrl || undefined
  const resolved = useStorageUrl(path)
  const src = talent.headshotUrl ?? resolved ?? null
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xs font-semibold text-[var(--color-text-muted)]">
          {initials(name)}
        </div>
      )}
    </div>
  )
}

interface AddCastingTalentDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly talent: readonly TalentRecord[]
  readonly existingTalentIds: ReadonlySet<string>
  readonly saving: boolean
  readonly onAdd: (talentIds: readonly string[]) => void
}

export function AddCastingTalentDialog({
  open,
  onOpenChange,
  talent,
  existingTalentIds,
  saving,
  onAdd,
}: AddCastingTalentDialogProps) {
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")

  const available = useMemo(
    () => talent.filter((t) => !existingTalentIds.has(t.id)),
    [talent, existingTalentIds],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return available
    return available.filter((t) => {
      const name = buildDisplayName(t).toLowerCase()
      const agency = (t.agency ?? "").toLowerCase()
      return name.includes(q) || agency.includes(q)
    })
  }, [available, query])

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => {
    setDraft(new Set())
    setQuery("")
  }

  const handleAdd = () => {
    const ids = [...draft]
    if (ids.length === 0) return
    onAdd(ids)
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
          <DialogTitle>Add Talent to Casting Board</DialogTitle>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-text-muted)]">
            All talent in the library have already been added.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <Input
                placeholder="Search by name or agency..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="max-h-[340px] overflow-y-auto rounded-md border border-[var(--color-border)]">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                  No matching talent.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {filtered.map((t) => {
                    const name = buildDisplayName(t)
                    const badgeClasses = genderBadgeClasses(t.gender)
                    const badgeLabel = genderDisplayLabel(t.gender)
                    const isSelected = draft.has(t.id)

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-subtle)] ${
                          isSelected ? "bg-[var(--color-surface-subtle)]" : ""
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          tabIndex={-1}
                          className="shrink-0"
                        />

                        <CastingTalentAvatar talent={t} name={name} />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[var(--color-text)]">
                            {name}
                          </div>
                          {t.agency ? (
                            <div className="truncate text-xs text-[var(--color-text-muted)]">
                              {t.agency}
                            </div>
                          ) : null}
                        </div>

                        {badgeClasses && badgeLabel ? (
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 text-2xs leading-none ${badgeClasses}`}
                          >
                            {badgeLabel}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {draft.size > 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                {draft.size} selected
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={draft.size === 0 || saving}
          >
            {saving
              ? "Adding..."
              : `Add${draft.size > 0 ? ` ${draft.size}` : ""} talent`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
