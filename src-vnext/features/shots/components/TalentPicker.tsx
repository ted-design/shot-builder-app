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
import { useAuth } from "@/app/providers/AuthProvider"
import { addTalentToProject } from "@/features/assets/lib/projectAssetsWrites"
import { Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"

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
      </PopoverContent>
    </Popover>
  )
}
