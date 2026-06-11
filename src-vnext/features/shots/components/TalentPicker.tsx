import { useEffect, useId, useRef, useState } from "react"
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
import { ChevronDown, ChevronUp, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { toast } from "sonner"
import type { CastingBoardStatus } from "@/shared/types"

/** Trailing debounce for the coalesced save while the popover stays open. */
const SAVE_DEBOUNCE_MS = 500

interface TalentPickerProps {
  readonly selectedIds: string[]
  /**
   * Called once per toggle burst with the coalesced, sorted talent ids.
   * May return a promise: resolving `false` signals the caller already
   * surfaced the failure (the picker reverts silently); a rejection makes
   * the picker revert AND surface one toast for the burst.
   */
  readonly onSave: (ids: string[]) => void | boolean | Promise<void | boolean>
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

  // Debounced-draft save model: while the popover is open the local draft is
  // the single source of truth (never re-derived from the refreshing
  // selectedIds prop, which would flicker when a write round-trips). Each
  // toggle updates the draft instantly and schedules ONE trailing-debounced
  // save per burst, flushed on close and on unmount.
  const draftRef = useRef<string[]>(selectedIds)
  const lastSavedRef = useRef<string[]>([...selectedIds].sort())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyDraft = (next: string[]) => {
    draftRef.current = next
    setDraft(next)
  }

  const commitDraft = () => {
    // Persisted order is sorted (call sheets consume this order) — copy
    // before sorting so the draft state array is never mutated in place.
    const ordered = [...draftRef.current].sort()
    const previous = lastSavedRef.current
    if (JSON.stringify(ordered) === JSON.stringify(previous)) return
    lastSavedRef.current = ordered

    const revert = () => {
      lastSavedRef.current = previous
      applyDraft(previous)
    }

    try {
      Promise.resolve(onSave(ordered))
        .then((ok) => {
          // The parent save path toasts on failure and resolves false —
          // revert silently so each failed burst surfaces exactly one toast.
          if (ok === false) revert()
        })
        .catch(() => {
          revert()
          toast.error("Failed to save talent")
        })
    } catch {
      revert()
      toast.error("Failed to save talent")
    }
  }

  // Latest-ref so the unmount flush and pending timers never call a stale
  // onSave closure.
  const commitRef = useRef(commitDraft)
  useEffect(() => {
    commitRef.current = commitDraft
  })

  // Flush a pending debounced save if the picker unmounts mid-burst.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        commitRef.current()
      }
    }
  }, [])

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
      applyDraft(selectedIds)
      lastSavedRef.current = [...selectedIds].sort()
    } else {
      // Closing is the flush: clear any pending debounce and commit once.
      // commitDraft no-ops when the burst already saved, so this never
      // produces a duplicate write.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      commitDraft()
    }
    setOpen(next)
  }

  const toggle = (id: string) => {
    const prev = draftRef.current
    applyDraft(
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      commitRef.current()
    }, SAVE_DEBOUNCE_MS)
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
      <PopoverContent
        className="w-64 p-0"
        align="start"
        // The shot page binds Escape -> navigate(-1); Escape inside the
        // picker must only dismiss it (the close-flush still runs via
        // handleOpenChange), never leave the page.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
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
  const [showHold, setShowHold] = useState(false)
  const [showShortlist, setShowShortlist] = useState(false)
  const [showOther, setShowOther] = useState(false)
  const [query, setQuery] = useState("")
  const groupIdBase = useId()

  // While a search query is active, force-mount every collapsed group so
  // cmdk can register (and match) their items, and hide the "Show N…"
  // disclosure buttons — otherwise collapsed talent is unmatchable and the
  // stale buttons linger under "No talent found."
  const searching = query.trim().length > 0

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
                aria-checked={draft.includes(t.id)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                <span>{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )
  }

  type TalentItem = { readonly id: string; readonly name: string }
  const grouped: { booked: TalentItem[]; hold: TalentItem[]; shortlist: TalentItem[]; other: TalentItem[] } = {
    booked: [],
    hold: [],
    shortlist: [],
    other: [],
  }

  for (const t of visibleTalent) {
    const status = castingMap.get(t.id)
    if (status === "booked") grouped.booked.push(t)
    else if (status === "hold") grouped.hold.push(t)
    else if (status === "shortlist") grouped.shortlist.push(t)
    else grouped.other.push(t) // "passed" and unstatused talent go to Other
  }

  const bookedIds = new Set(grouped.booked.map((t) => t.id))
  const assignedNonBooked = visibleTalent.filter(
    (t) => draft.includes(t.id) && !bookedIds.has(t.id),
  )

  const ChevronIcon = ({ expanded }: { readonly expanded: boolean }) =>
    expanded ? (
      <ChevronUp className="h-3 w-3 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0" />
    )

  const holdGroupId = `${groupIdBase}-hold`
  const shortlistGroupId = `${groupIdBase}-shortlist`
  const otherGroupId = `${groupIdBase}-other`

  return (
    <Command>
      <CommandInput
        placeholder="Search talent..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No talent found.</CommandEmpty>

        {assignedNonBooked.length > 0 && (
          <CommandGroup heading="Currently assigned">
            {assignedNonBooked.map((t) => {
              const status = castingMap.get(t.id)
              return (
                <CommandItem
                  key={t.id}
                  onSelect={() => toggle(t.id)}
                  aria-checked={draft.includes(t.id)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                  <span className="flex-1">{t.name}</span>
                  {status ? castingStatusBadge(status) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {grouped.booked.length > 0 && (
          <CommandGroup heading="Booked">
            {grouped.booked.map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => toggle(t.id)}
                aria-checked={draft.includes(t.id)}
                className="flex items-center gap-2"
              >
                <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                <span className="flex-1">{t.name}</span>
                {castingStatusBadge("booked")}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {grouped.hold.length > 0 && (
          <>
            {!searching && (
              <div className="px-2 py-1">
                <button
                  type="button"
                  aria-expanded={showHold}
                  aria-controls={holdGroupId}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-secondary)] transition-colors"
                  onClick={() => setShowHold((prev) => !prev)}
                >
                  <ChevronIcon expanded={showHold} />
                  <span className="flex-1">
                    {showHold ? "Hide hold" : `Show ${grouped.hold.length} on hold`}
                  </span>
                  <Badge className="h-4 rounded-sm px-1 text-2xs font-medium bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)] border-0">
                    {grouped.hold.length}
                  </Badge>
                </button>
              </div>
            )}
            {(showHold || searching) && (
              <CommandGroup id={holdGroupId} heading="Hold">
                {grouped.hold.map((t) => (
                  <CommandItem
                    key={t.id}
                    onSelect={() => toggle(t.id)}
                    aria-checked={draft.includes(t.id)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                    <span className="flex-1">{t.name}</span>
                    {castingStatusBadge("hold")}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {grouped.shortlist.length > 0 && (
          <>
            {!searching && (
              <div className="px-2 py-1">
                <button
                  type="button"
                  aria-expanded={showShortlist}
                  aria-controls={shortlistGroupId}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-secondary)] transition-colors"
                  onClick={() => setShowShortlist((prev) => !prev)}
                >
                  <ChevronIcon expanded={showShortlist} />
                  <span className="flex-1">
                    {showShortlist ? "Hide shortlist" : `Show ${grouped.shortlist.length} shortlisted`}
                  </span>
                  <Badge className="h-4 rounded-sm px-1 text-2xs font-medium bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)] border border-[var(--color-border)]">
                    {grouped.shortlist.length}
                  </Badge>
                </button>
              </div>
            )}
            {(showShortlist || searching) && (
              <CommandGroup id={shortlistGroupId} heading="Shortlist">
                {grouped.shortlist.map((t) => (
                  <CommandItem
                    key={t.id}
                    onSelect={() => toggle(t.id)}
                    aria-checked={draft.includes(t.id)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                    <span className="flex-1">{t.name}</span>
                    {castingStatusBadge("shortlist")}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {grouped.other.length > 0 && (
          <>
            {!searching && (
              <div className="px-2 py-1">
                <button
                  type="button"
                  aria-expanded={showOther}
                  aria-controls={otherGroupId}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-secondary)] transition-colors"
                  onClick={() => setShowOther((prev) => !prev)}
                >
                  <ChevronIcon expanded={showOther} />
                  <span className="flex-1">
                    {showOther ? "Hide other talent" : `Show ${grouped.other.length} more`}
                  </span>
                </button>
              </div>
            )}
            {(showOther || searching) && (
              <CommandGroup id={otherGroupId} heading="Other talent">
                {grouped.other.map((t) => (
                  <CommandItem
                    key={t.id}
                    onSelect={() => toggle(t.id)}
                    aria-checked={draft.includes(t.id)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={draft.includes(t.id)} aria-hidden="true" tabIndex={-1} />
                    <span>{t.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </Command>
  )
}
