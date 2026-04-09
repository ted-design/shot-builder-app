import { useMemo, useState } from "react"
import { MapPin, Tag, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/command"
import { StatusBadge } from "@/shared/components/StatusBadge"
import {
  SHOT_STATUSES,
} from "@/shared/lib/statusMappings"
import { canManageShots } from "@/shared/lib/rbac"
import { useAvailableTags } from "@/features/shots/hooks/useAvailableTags"
import {
  bulkUpdateShotStatus,
  bulkApplyTags,
  bulkUpdateLocation,
  bulkAddTalent,
} from "@/features/shots/lib/bulkShotUpdates"
import type { AuthUser, Role, Shot, ShotFirestoreStatus, ShotTag } from "@/shared/types"

interface BulkActionBarProps {
  readonly displayShots: ReadonlyArray<Shot>
  readonly selectedIds: ReadonlySet<string>
  readonly onSelectAll: () => void
  readonly onDeselectAll: () => void
  readonly clientId: string | null
  readonly user: AuthUser | null
  readonly role: Role
  // Handlers for existing actions
  readonly onShareOpen: () => void
  readonly onExportClick: () => void
  readonly onCreatePullOpen: () => void
  readonly onBulkDeleteOpen: () => void
  readonly onClearSelection: () => void
  // Flags
  readonly canShare: boolean
  readonly canExport: boolean
  // Location + talent data
  readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>
  readonly talent: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

export function BulkActionBar({
  displayShots,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  clientId,
  user,
  role,
  onShareOpen,
  onExportClick,
  onCreatePullOpen,
  onBulkDeleteOpen,
  onClearSelection,
  canShare,
  canExport,
  locations,
  talent,
}: BulkActionBarProps) {
  const selectedShots = useMemo(
    () => displayShots.filter((s) => selectedIds.has(s.id)),
    [displayShots, selectedIds],
  )
  const allSelected = displayShots.length > 0 && displayShots.every((s) => selectedIds.has(s.id))
  const someSelected = selectedIds.size > 0

  const { tags } = useAvailableTags()
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false)
  const [talentPopoverOpen, setTalentPopoverOpen] = useState(false)

  const handleBulkStatus = async (status: ShotFirestoreStatus) => {
    if (!clientId || selectedIds.size === 0) return
    try {
      const count = await bulkUpdateShotStatus(clientId, Array.from(selectedIds), status, user)
      toast.success(`Updated status on ${count} shot${count === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Failed to update status", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const handleApplyTag = async (tag: ShotTag) => {
    if (!clientId || selectedShots.length === 0) return
    try {
      const count = await bulkApplyTags(clientId, selectedShots, [tag], user)
      toast.success(`Applied "${tag.label}" to ${count} shot${count === 1 ? "" : "s"}`)
      setTagPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to apply tag", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const handleSetLocation = async (locationId: string, locationName: string) => {
    if (!clientId || selectedIds.size === 0) return
    try {
      const count = await bulkUpdateLocation(clientId, Array.from(selectedIds), locationId, locationName, user)
      toast.success(`Set location on ${count} shot${count === 1 ? "" : "s"}`)
      setLocationPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to set location", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const handleAddTalent = async (talentId: string) => {
    if (!clientId || selectedShots.length === 0) return
    try {
      const count = await bulkAddTalent(clientId, selectedShots, [talentId], user)
      toast.success(`Added talent to ${count} shot${count === 1 ? "" : "s"}`)
      setTalentPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to add talent", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      {/* Left: selection controls */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={(v) => { v ? onSelectAll() : onDeselectAll() }}
          aria-label={allSelected ? "Deselect all shots" : "Select all visible shots"}
        />
        <span className="text-xs text-[var(--color-text-muted)]">
          {selectedIds.size} selected
          {selectedIds.size < displayShots.length && (
            <button
              type="button"
              className="ml-1.5 text-[var(--color-primary)] hover:underline"
              onClick={onSelectAll}
            >
              Select all {displayShots.length}
            </button>
          )}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Batch status */}
        <Select
          value=""
          onValueChange={(v) => handleBulkStatus(v as ShotFirestoreStatus)}
          disabled={selectedIds.size === 0}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Set status" />
          </SelectTrigger>
          <SelectContent>
            {SHOT_STATUSES.map((s) => (
              <SelectItem key={s.firestoreValue} value={s.firestoreValue}>
                <StatusBadge label={s.label} color={s.color} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Batch tags */}
        <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => handleApplyTag(tag)}
                    >
                      <span
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color ?? "var(--color-text-subtle)" }}
                      />
                      {tag.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Batch location */}
        <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Location
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search locations..." />
              <CommandList>
                <CommandEmpty>No locations found.</CommandEmpty>
                <CommandGroup>
                  {locations.map((loc) => (
                    <CommandItem
                      key={loc.id}
                      onSelect={() => handleSetLocation(loc.id, loc.name)}
                    >
                      {loc.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Batch talent */}
        <Popover open={talentPopoverOpen} onOpenChange={setTalentPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <User className="mr-1.5 h-3.5 w-3.5" />
              Talent
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search talent..." />
              <CommandList>
                <CommandEmpty>No talent found.</CommandEmpty>
                <CommandGroup>
                  {talent.map((t) => (
                    <CommandItem
                      key={t.id}
                      onSelect={() => handleAddTalent(t.id)}
                    >
                      {t.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--color-border)]" />

        {/* Existing actions */}
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onShareOpen}
          >
            Share link
          </Button>
        )}
        {canExport && (
          <Button variant="outline" size="sm" onClick={onExportClick}>
            Export PDF
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
        <Button
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={onCreatePullOpen}
        >
          Create pull sheet
        </Button>
        {canManageShots(role) && (
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onBulkDeleteOpen}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
