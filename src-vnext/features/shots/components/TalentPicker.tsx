import { useEffect, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Badge } from "@/ui/badge"
import { useTalent } from "@/features/shots/hooks/usePickerData"
import { useCastingBoard } from "@/features/casting/hooks/useCastingBoard"
import { useAuth } from "@/app/providers/AuthProvider"
import { addTalentToProject } from "@/features/assets/lib/projectAssetsWrites"
import { Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { CastingBoardStatus } from "@/shared/types"

interface TalentPickerProps {
  readonly selectedIds: string[]
  readonly onSave: (ids: string[]) => void
  readonly disabled?: boolean
  readonly compact?: boolean
  readonly projectId?: string
}

export function TalentPicker({
  selectedIds,
  onSave,
  disabled,
  compact = false,
  projectId,
}: TalentPickerProps) {
  const { data: talent } = useTalent()
  const { clientId } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selectedIds)
  const repairedProjectRef = useRef<string | null>(null)

  const visibleTalent = projectId
    ? talent.filter((t) => t.projectIds?.includes(projectId))
    : talent

  // Auto-repair: if selectedIds contains talent not yet linked to the project,
  // silently backfill the link using arrayUnion (idempotent).
  // Re-runs when projectId changes so different shots get repaired.
  useEffect(() => {
    if (!projectId || !clientId) return
    if (repairedProjectRef.current === projectId) return
    if (selectedIds.length === 0 || talent.length === 0) return

    const projectTalentIds = new Set(
      talent
        .filter((t) => t.projectIds?.includes(projectId))
        .map((t) => t.id),
    )
    const orphaned = selectedIds.filter((id) => !projectTalentIds.has(id))

    if (orphaned.length === 0) {
      repairedProjectRef.current = projectId
      return
    }

    addTalentToProject({ clientId, projectId, ids: orphaned })
      .then(() => {
        repairedProjectRef.current = projectId
      })
      .catch(() => {
        // Silent failure — will retry on next render cycle
      })
  }, [projectId, clientId, selectedIds, talent])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(selectedIds)
    } else {
      if (JSON.stringify(draft.sort()) !== JSON.stringify(selectedIds.slice().sort())) {
        onSave(draft)
      }
    }
    setOpen(next)
  }

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const selectedNames = visibleTalent
    .filter((t) => selectedIds.includes(t.id))
    .map((t) => t.name)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            compact ? "h-8 px-2 text-xs" : "h-auto min-h-[2.5rem]",
          )}
          disabled={disabled}
        >
          {selectedNames.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[var(--color-text-subtle)]">
              <Users className="h-4 w-4" />
              Select talent...
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {open && (
          <TalentPickerContent
            visibleTalent={visibleTalent}
            draft={draft}
            toggle={toggle}
            projectId={projectId ?? null}
            clientId={clientId}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

const CASTING_STATUS_ORDER: ReadonlyArray<CastingBoardStatus> = ["booked", "hold", "shortlist"]

function castingStatusBadge(status: CastingBoardStatus) {
  if (status === "booked") {
    return (
      <Badge className="ml-auto h-4 rounded-sm px-1 text-2xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0">
        Booked
      </Badge>
    )
  }
  if (status === "hold") {
    return (
      <Badge className="ml-auto h-4 rounded-sm px-1 text-2xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0">
        Hold
      </Badge>
    )
  }
  if (status === "shortlist") {
    return (
      <Badge className="ml-auto h-4 rounded-sm px-1 text-2xs font-medium bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)] border border-[var(--color-border)]">
        Shortlist
      </Badge>
    )
  }
  return null
}

function TalentPickerContent({
  visibleTalent,
  draft,
  toggle,
  projectId,
  clientId,
}: {
  readonly visibleTalent: ReadonlyArray<{ readonly id: string; readonly name: string }>
  readonly draft: string[]
  readonly toggle: (id: string) => void
  readonly projectId: string | null
  readonly clientId: string | null
}) {
  const { entries } = useCastingBoard(projectId, clientId)

  const castingMap = new Map<string, CastingBoardStatus>(
    entries.map((e) => [e.talentId, e.status]),
  )

  const hasCasting = castingMap.size > 0

  if (!hasCasting) {
    return (
      <Command>
        <CommandInput placeholder="Search talent..." />
        <CommandList>
          <CommandEmpty>No talent found.</CommandEmpty>
          <CommandGroup>
            {visibleTalent.map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => toggle(t.id)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={draft.includes(t.id)} />
                <span>{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )
  }

  const grouped: Record<CastingBoardStatus | "other", typeof visibleTalent> = {
    booked: [],
    hold: [],
    shortlist: [],
    passed: [],
    other: [],
  }

  for (const t of visibleTalent) {
    const status = castingMap.get(t.id)
    if (status === "booked") grouped.booked.push(t)
    else if (status === "hold") grouped.hold.push(t)
    else if (status === "shortlist") grouped.shortlist.push(t)
    else if (status === "passed") grouped.passed.push(t)
    else grouped.other.push(t)
  }

  return (
    <Command>
      <CommandInput placeholder="Search talent..." />
      <CommandList>
        <CommandEmpty>No talent found.</CommandEmpty>
        {CASTING_STATUS_ORDER.map((status) => {
          const group = grouped[status]
          if (group.length === 0) return null
          const heading = status === "booked" ? "Booked" : status === "hold" ? "Hold" : "Shortlist"
          return (
            <CommandGroup key={status} heading={heading}>
              {group.map((t) => (
                <CommandItem
                  key={t.id}
                  onSelect={() => toggle(t.id)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={draft.includes(t.id)} />
                  <span className="flex-1">{t.name}</span>
                  {castingStatusBadge(status)}
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
        {grouped.other.length > 0 && (
          <CommandGroup heading="Other talent">
            {grouped.other.map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => toggle(t.id)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={draft.includes(t.id)} />
                <span>{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
