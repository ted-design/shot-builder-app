import { useCallback, useMemo } from "react"
import { UserPlus, X, Users, Clapperboard } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import {
  upsertTalentCall,
  removeTalentCall,
  upsertCrewCall,
  removeCrewCall,
} from "@/features/schedules/lib/scheduleWrites"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { classifyTimeInput, formatHHMMTo12h } from "@/features/schedules/lib/time"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import type { TalentCallSheet, CrewCallSheet, TalentRecord, CrewRecord, DayDetails } from "@/shared/types"

// --- Props ---

interface CallOverridesEditorProps {
  readonly scheduleId: string
  readonly dayDetails: DayDetails | null
  readonly talentCalls: readonly TalentCallSheet[]
  readonly crewCalls: readonly CrewCallSheet[]
  readonly talentLibrary: readonly TalentRecord[]
  readonly crewLibrary: readonly CrewRecord[]
}

// --- Talent override row ---

interface TalentOverrideRowProps {
  readonly call: TalentCallSheet
  readonly name: string
  readonly role: string
  readonly defaultTime: string
  readonly onSaveCallTime: (value: string) => void
  readonly onRemove: () => void
}

function displayCallValue(call: { readonly callTime?: string | null; readonly callText?: string | null }): string {
  if (call.callText && call.callText.trim()) return call.callText.trim()
  const formatted = formatHHMMTo12h(call.callTime ?? "")
  return formatted || (call.callTime ?? "")
}

function displayDefaultTime(value: string): string {
  const formatted = formatHHMMTo12h(value)
  return formatted || value
}

function TalentOverrideRow({
  call,
  name,
  role,
  defaultTime,
  onSaveCallTime,
  onRemove,
}: TalentOverrideRowProps) {
  const hasOverride = !!(call.callTime || call.callText)
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-subtle)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-[var(--color-text)]">
          {name}
        </span>
        {role && (
          <span className="truncate text-2xs text-[var(--color-text-muted)]">
            {role}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-24">
          <TypedTimeInput
            value={displayCallValue(call)}
            onSave={onSaveCallTime}
            placeholder={displayDefaultTime(defaultTime) || "Set time"}
            allowText
            triggerClassName="w-full text-xs font-semibold"
          />
        </div>
        {hasOverride && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={`Remove override for ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// --- Crew override row ---

interface CrewOverrideRowProps {
  readonly call: CrewCallSheet
  readonly name: string
  readonly deptPosition: string
  readonly defaultTime: string
  readonly onSaveCallTime: (value: string) => void
  readonly onRemove: () => void
}

function CrewOverrideRow({
  call,
  name,
  deptPosition,
  defaultTime,
  onSaveCallTime,
  onRemove,
}: CrewOverrideRowProps) {
  const hasOverride = !!(call.callTime || call.callText)
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-subtle)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-[var(--color-text)]">
          {name}
        </span>
        {deptPosition && (
          <span className="truncate text-2xs text-[var(--color-text-muted)]">
            {deptPosition}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-24">
          <TypedTimeInput
            value={displayCallValue(call)}
            onSave={onSaveCallTime}
            placeholder={displayDefaultTime(defaultTime) || "Set time"}
            allowText
            triggerClassName="w-full text-xs font-semibold"
          />
        </div>
        {hasOverride && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={`Remove override for ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// --- Main component ---

export function CallOverridesEditor({
  scheduleId,
  dayDetails,
  talentCalls,
  crewCalls,
  talentLibrary,
  crewLibrary,
}: CallOverridesEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  // Build lookup maps
  const talentMap = useMemo(() => {
    const m = new Map<string, TalentRecord>()
    for (const t of talentLibrary) {
      m.set(t.id, t)
    }
    return m
  }, [talentLibrary])

  const crewMap = useMemo(() => {
    const m = new Map<string, CrewRecord>()
    for (const c of crewLibrary) {
      m.set(c.id, c)
    }
    return m
  }, [crewLibrary])

  // Talent IDs already overridden
  const overriddenTalentIds = useMemo(
    () => new Set(talentCalls.map((tc) => tc.talentId)),
    [talentCalls],
  )

  // Crew IDs already overridden
  const overriddenCrewIds = useMemo(
    () => new Set(crewCalls.map((cc) => cc.crewMemberId)),
    [crewCalls],
  )

  // Available talent (not yet overridden)
  const availableTalent = useMemo(
    () => talentLibrary.filter((t) => !overriddenTalentIds.has(t.id)),
    [talentLibrary, overriddenTalentIds],
  )

  // Available crew (not yet overridden)
  const availableCrew = useMemo(
    () => crewLibrary.filter((c) => !overriddenCrewIds.has(c.id)),
    [crewLibrary, overriddenCrewIds],
  )

  const defaultShootingCall = dayDetails?.shootingCallTime ?? ""
  const defaultCrewCall = dayDetails?.crewCallTime ?? ""

  // --- Talent handlers ---

  const handleAddTalent = useCallback(
    (talentId: string) => {
      if (!clientId || !talentId) return
      const talent = talentMap.get(talentId)
      upsertTalentCall(clientId, projectId, scheduleId, null, {
        talentId,
        role: talent?.notes ?? null,
      })
    },
    [clientId, projectId, scheduleId, talentMap],
  )

  const handleSaveTalentCallTime = useCallback(
    (talentCallId: string) => (value: string) => {
      if (!clientId) return
      const parsed = classifyTimeInput(value, { allowText: true })
      if (parsed.kind === "invalid-time") {
        toast.error("Invalid time. Use “6:00 AM” or “18:00”.")
        return
      }

      const patch =
        parsed.kind === "time"
          ? { callTime: parsed.canonical, callText: null }
          : parsed.kind === "text"
            ? { callTime: null, callText: parsed.text }
            : { callTime: null, callText: null }

      void upsertTalentCall(clientId, projectId, scheduleId, talentCallId, patch).catch(() => {
        toast.error("Failed to save talent override.")
      })
    },
    [clientId, projectId, scheduleId],
  )

  const handleRemoveTalent = useCallback(
    (talentCallId: string) => () => {
      if (!clientId) return
      removeTalentCall(clientId, projectId, scheduleId, talentCallId)
    },
    [clientId, projectId, scheduleId],
  )

  // --- Crew handlers ---

  const handleAddCrew = useCallback(
    (crewMemberId: string) => {
      if (!clientId || !crewMemberId) return
      const crew = crewMap.get(crewMemberId)
      upsertCrewCall(clientId, projectId, scheduleId, null, {
        crewMemberId,
        department: crew?.department ?? null,
        position: crew?.position ?? null,
      })
    },
    [clientId, projectId, scheduleId, crewMap],
  )

  const handleSaveCrewCallTime = useCallback(
    (crewCallId: string) => (value: string) => {
      if (!clientId) return
      const parsed = classifyTimeInput(value, { allowText: true })
      if (parsed.kind === "invalid-time") {
        toast.error("Invalid time. Use “6:00 AM” or “18:00”.")
        return
      }

      const patch =
        parsed.kind === "time"
          ? { callTime: parsed.canonical, callText: null }
          : parsed.kind === "text"
            ? { callTime: null, callText: parsed.text }
            : { callTime: null, callText: null }

      void upsertCrewCall(clientId, projectId, scheduleId, crewCallId, patch).catch(() => {
        toast.error("Failed to save crew override.")
      })
    },
    [clientId, projectId, scheduleId],
  )

  const handleRemoveCrew = useCallback(
    (crewCallId: string) => () => {
      if (!clientId) return
      removeCrewCall(clientId, projectId, scheduleId, crewCallId)
    },
    [clientId, projectId, scheduleId],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Talent Overrides */}
      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="label-meta text-[var(--color-text-muted)]">
            Talent Overrides
          </h3>
          {defaultShootingCall && (
            <span className="ml-auto text-2xs text-[var(--color-text-subtle)]">
              Default: {displayDefaultTime(defaultShootingCall)}
            </span>
          )}
        </div>

        {talentCalls.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {talentCalls.map((tc) => {
              const talent = talentMap.get(tc.talentId)
              return (
                <TalentOverrideRow
                  key={tc.id}
                  call={tc}
                  name={talent?.name ?? tc.talentId}
                  role={tc.role ?? ""}
                  defaultTime={defaultShootingCall}
                  onSaveCallTime={handleSaveTalentCallTime(tc.id)}
                  onRemove={handleRemoveTalent(tc.id)}
                />
              )
            })}
          </div>
        )}

        {availableTalent.length > 0 ? (
          <Select onValueChange={handleAddTalent} value="">
            <SelectTrigger className="h-8 text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <UserPlus className="h-3 w-3" />
                <SelectValue placeholder="Add talent override..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableTalent.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : talentLibrary.length === 0 ? (
          <p className="py-1 text-xs text-[var(--color-text-subtle)]">
            No talent in library.
          </p>
        ) : null}
      </div>

      {/* Crew Overrides */}
      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="label-meta text-[var(--color-text-muted)]">
            Crew Overrides
          </h3>
          {defaultCrewCall && (
            <span className="ml-auto text-2xs text-[var(--color-text-subtle)]">
              Default: {displayDefaultTime(defaultCrewCall)}
            </span>
          )}
        </div>

        {crewCalls.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {crewCalls.map((cc) => {
              const crew = crewMap.get(cc.crewMemberId)
              const deptPosition = [
                cc.department ?? crew?.department,
                cc.position ?? crew?.position,
              ]
                .filter(Boolean)
                .join(" — ")
              return (
                <CrewOverrideRow
                  key={cc.id}
                  call={cc}
                  name={crew?.name ?? cc.crewMemberId}
                  deptPosition={deptPosition}
                  defaultTime={defaultCrewCall}
                  onSaveCallTime={handleSaveCrewCallTime(cc.id)}
                  onRemove={handleRemoveCrew(cc.id)}
                />
              )
            })}
          </div>
        )}

        {availableCrew.length > 0 ? (
          <Select onValueChange={handleAddCrew} value="">
            <SelectTrigger className="h-8 text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <UserPlus className="h-3 w-3" />
                <SelectValue placeholder="Add crew override..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableCrew.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.department && (
                    <span className="ml-1 text-[var(--color-text-muted)]">
                      ({c.department})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : crewLibrary.length === 0 ? (
          <p className="py-1 text-xs text-[var(--color-text-subtle)]">
            No crew in library.
          </p>
        ) : null}
      </div>
    </div>
  )
}
