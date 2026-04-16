import { useCallback, useEffect, useMemo, useState } from "react"
import { UserPlus, X, Users, Clapperboard, Eye, EyeOff, Mail, MailX, Phone, PhoneOff } from "lucide-react"
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
import { destructiveActionWithUndo } from "@/shared/lib/destructiveActionWithUndo"
import type { UseUndoStackResult } from "@/shared/hooks/useUndoStack"
import type { UndoSnapshot } from "@/features/schedules/lib/undoSnapshots"
import { useLastSaved } from "@/shared/hooks/useLastSaved"
import { SaveIndicator } from "@/shared/components/SaveIndicator"
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs"
import { filterCrewCallsByTrack, filterTalentCallsByTrack } from "@/features/schedules/lib/trackFiltering"
import type { TalentCallSheet, CrewCallSheet, TalentRecord, CrewRecord, DayDetails, ScheduleTrack } from "@/shared/types"

// --- Props ---

interface CallOverridesEditorProps {
  readonly scheduleId: string
  readonly tracks: readonly ScheduleTrack[]
  readonly dayDetails: DayDetails | null
  readonly talentCalls: readonly TalentCallSheet[]
  readonly crewCalls: readonly CrewCallSheet[]
  readonly talentLibrary: readonly TalentRecord[]
  readonly crewLibrary: readonly CrewRecord[]
  readonly undoStack: UseUndoStackResult<UndoSnapshot>
}

// --- Talent override row ---

interface TalentOverrideRowProps {
  readonly call: TalentCallSheet
  readonly name: string
  readonly role: string
  readonly defaultTime: string
  readonly onSaveCallTime: (value: string) => void
  readonly onRemove: () => void
  readonly isVisible: boolean
  readonly onToggleVisibility: () => void
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
  isVisible,
  onToggleVisibility,
}: TalentOverrideRowProps) {
  const hasOverride = !!(call.callTime || call.callText)
  return (
    <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-subtle)] ${!isVisible ? "opacity-40" : ""}`}>
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
          onClick={onToggleVisibility}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={isVisible ? `Hide ${name} from call sheet` : `Show ${name} on call sheet`}
        >
          {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
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
  readonly isVisible: boolean
  readonly showEmail: boolean
  readonly showPhone: boolean
  readonly onToggleVisibility: () => void
  readonly onToggleEmail: () => void
  readonly onTogglePhone: () => void
}

function CrewOverrideRow({
  call,
  name,
  deptPosition,
  defaultTime,
  onSaveCallTime,
  onRemove,
  isVisible,
  showEmail,
  showPhone,
  onToggleVisibility,
  onToggleEmail,
  onTogglePhone,
}: CrewOverrideRowProps) {
  const hasOverride = !!(call.callTime || call.callText)
  return (
    <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-subtle)] ${!isVisible ? "opacity-40" : ""}`}>
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
          onClick={onToggleVisibility}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={isVisible ? `Hide ${name} from call sheet` : `Show ${name} on call sheet`}
        >
          {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={onToggleEmail}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={showEmail ? `Hide email for ${name}` : `Show email for ${name}`}
        >
          {showEmail ? <Mail className="h-3 w-3" /> : <MailX className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={onTogglePhone}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          aria-label={showPhone ? `Hide phone for ${name}` : `Show phone for ${name}`}
        >
          {showPhone ? <Phone className="h-3 w-3" /> : <PhoneOff className="h-3 w-3" />}
        </button>
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

function talentCallToPatch(call: TalentCallSheet): Record<string, unknown> {
  return {
    talentId: call.talentId,
    callTime: call.callTime ?? null,
    callText: call.callText ?? null,
    setTime: call.setTime ?? null,
    wrapTime: call.wrapTime ?? null,
    role: call.role ?? null,
    status: call.status ?? null,
    notes: call.notes ?? null,
    isVisibleOverride: call.isVisibleOverride ?? null,
    trackId: call.trackId ?? null,
  }
}

function crewCallToPatch(call: CrewCallSheet): Record<string, unknown> {
  return {
    crewMemberId: call.crewMemberId,
    callTime: call.callTime ?? null,
    callText: call.callText ?? null,
    callOffsetDirection: call.callOffsetDirection ?? null,
    callOffsetMinutes: call.callOffsetMinutes ?? null,
    wrapTime: call.wrapTime ?? null,
    wrapText: call.wrapText ?? null,
    department: call.department ?? null,
    position: call.position ?? null,
    notes: call.notes ?? null,
    isVisibleOverride: call.isVisibleOverride ?? null,
    showEmailOverride: call.showEmailOverride ?? null,
    showPhoneOverride: call.showPhoneOverride ?? null,
    trackId: call.trackId ?? null,
  }
}

export function CallOverridesEditor({
  scheduleId,
  tracks,
  dayDetails,
  talentCalls,
  crewCalls,
  talentLibrary,
  crewLibrary,
  undoStack,
}: CallOverridesEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()
  // Single shared useLastSaved instance drives BOTH the Talent and
  // Crew section headers — every successful upsert/remove bumps the
  // same timestamp so the two pills tick in sync.
  const lastSaved = useLastSaved()

  // Unit filter state (null = "All Units")
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)

  // Reset tab if the selected track no longer exists
  useEffect(() => {
    if (activeTrackId !== null && !tracks.some(t => t.id === activeTrackId)) {
      setActiveTrackId(null)
    }
  }, [activeTrackId, tracks])

  // Filtered calls for rendering rows
  const filteredTalentCalls = useMemo(
    () => filterTalentCallsByTrack(talentCalls, activeTrackId),
    [talentCalls, activeTrackId],
  )
  const filteredCrewCalls = useMemo(
    () => filterCrewCallsByTrack(crewCalls, activeTrackId),
    [crewCalls, activeTrackId],
  )

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
    async (talentId: string): Promise<void> => {
      if (!clientId || !talentId) return
      const talent = talentMap.get(talentId)
      try {
        await upsertTalentCall(clientId, projectId, scheduleId, null, {
          talentId,
          role: talent?.notes ?? null,
          trackId: activeTrackId ?? null,
        })
        lastSaved.markSaved()
      } catch {
        toast.error("Failed to add talent override.")
      }
    },
    [activeTrackId, clientId, lastSaved, projectId, scheduleId, talentMap],
  )

  const handleSaveTalentCallTime = useCallback(
    (talentCallId: string) => async (value: string): Promise<void> => {
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

      try {
        await upsertTalentCall(clientId, projectId, scheduleId, talentCallId, patch)
        lastSaved.markSaved()
      } catch {
        toast.error("Failed to save talent override.")
      }
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  const handleRemoveTalent = useCallback(
    (call: TalentCallSheet) => () => {
      if (!clientId) return
      const talent = talentMap.get(call.talentId)
      const label = `Removed ${talent?.name ?? "talent"} override`
      void destructiveActionWithUndo<UndoSnapshot>({
        label,
        snapshot: { kind: "talentCallRemoved", payload: call },
        stack: undoStack,
        perform: async () => {
          await removeTalentCall(clientId, projectId, scheduleId, call.id)
          lastSaved.markSaved()
        },
        undo: async (snapshot) => {
          if (snapshot.kind !== "talentCallRemoved") return
          await upsertTalentCall(
            clientId,
            projectId,
            scheduleId,
            snapshot.payload.id,
            talentCallToPatch(snapshot.payload),
          )
          lastSaved.markSaved()
        },
      }).catch(() => {
        toast.error("Failed to remove talent override.")
      })
    },
    [clientId, lastSaved, projectId, scheduleId, talentMap, undoStack],
  )

  // --- Crew handlers ---

  const handleAddCrew = useCallback(
    async (crewMemberId: string): Promise<void> => {
      if (!clientId || !crewMemberId) return
      const crew = crewMap.get(crewMemberId)
      try {
        await upsertCrewCall(clientId, projectId, scheduleId, null, {
          crewMemberId,
          department: crew?.department ?? null,
          position: crew?.position ?? null,
          trackId: activeTrackId ?? null,
        })
        lastSaved.markSaved()
      } catch {
        toast.error("Failed to add crew override.")
      }
    },
    [activeTrackId, clientId, lastSaved, projectId, scheduleId, crewMap],
  )

  const handleSaveCrewCallTime = useCallback(
    (crewCallId: string) => async (value: string): Promise<void> => {
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

      try {
        await upsertCrewCall(clientId, projectId, scheduleId, crewCallId, patch)
        lastSaved.markSaved()
      } catch {
        toast.error("Failed to save crew override.")
      }
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  const handleRemoveCrew = useCallback(
    (call: CrewCallSheet) => () => {
      if (!clientId) return
      const crew = crewMap.get(call.crewMemberId)
      const label = `Removed ${crew?.name ?? "crew"} override`
      void destructiveActionWithUndo<UndoSnapshot>({
        label,
        snapshot: { kind: "crewCallRemoved", payload: call },
        stack: undoStack,
        perform: async () => {
          await removeCrewCall(clientId, projectId, scheduleId, call.id)
          lastSaved.markSaved()
        },
        undo: async (snapshot) => {
          if (snapshot.kind !== "crewCallRemoved") return
          await upsertCrewCall(
            clientId,
            projectId,
            scheduleId,
            snapshot.payload.id,
            crewCallToPatch(snapshot.payload),
          )
          lastSaved.markSaved()
        },
      }).catch(() => {
        toast.error("Failed to remove crew override.")
      })
    },
    [clientId, lastSaved, projectId, scheduleId, crewMap, undoStack],
  )

  // --- Visibility toggle handlers ---

  const handleToggleTalentVisibility = useCallback(
    (call: TalentCallSheet) => () => {
      if (!clientId) return
      const newValue = call.isVisibleOverride === false ? null : false
      void upsertTalentCall(clientId, projectId, scheduleId, call.id, {
        isVisibleOverride: newValue,
      }).then(() => lastSaved.markSaved())
        .catch(() => toast.error("Failed to update visibility."))
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  const handleToggleCrewVisibility = useCallback(
    (call: CrewCallSheet) => () => {
      if (!clientId) return
      const newValue = call.isVisibleOverride === false ? null : false
      void upsertCrewCall(clientId, projectId, scheduleId, call.id, {
        isVisibleOverride: newValue,
      }).then(() => lastSaved.markSaved())
        .catch(() => toast.error("Failed to update visibility."))
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  const handleToggleCrewEmail = useCallback(
    (call: CrewCallSheet) => () => {
      if (!clientId) return
      const newValue = call.showEmailOverride === false ? null : false
      void upsertCrewCall(clientId, projectId, scheduleId, call.id, {
        showEmailOverride: newValue,
      }).then(() => lastSaved.markSaved())
        .catch(() => toast.error("Failed to update email visibility."))
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  const handleToggleCrewPhone = useCallback(
    (call: CrewCallSheet) => () => {
      if (!clientId) return
      const newValue = call.showPhoneOverride === false ? null : false
      void upsertCrewCall(clientId, projectId, scheduleId, call.id, {
        showPhoneOverride: newValue,
      }).then(() => lastSaved.markSaved())
        .catch(() => toast.error("Failed to update phone visibility."))
    },
    [clientId, lastSaved, projectId, scheduleId],
  )

  return (
    <div className="flex flex-col gap-4">
      {tracks.length >= 2 && (
        <Tabs
          value={activeTrackId ?? "all"}
          onValueChange={(v) => setActiveTrackId(v === "all" ? null : v)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">
              All Units
            </TabsTrigger>
            {tracks.map((track) => (
              <TabsTrigger key={track.id} value={track.id} className="text-xs px-3">
                {track.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Talent Overrides */}
      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="label-meta text-[var(--color-text-muted)]">
            Talent Overrides
          </h3>
          <SaveIndicator savedAt={lastSaved.savedAt} />
          {defaultShootingCall && (
            <span className="ml-auto text-2xs text-[var(--color-text-subtle)]">
              Default: {displayDefaultTime(defaultShootingCall)}
            </span>
          )}
        </div>

        {filteredTalentCalls.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {filteredTalentCalls.map((tc) => {
              const talent = talentMap.get(tc.talentId)
              return (
                <TalentOverrideRow
                  key={tc.id}
                  call={tc}
                  name={talent?.name ?? tc.talentId}
                  role={tc.role ?? ""}
                  defaultTime={defaultShootingCall}
                  onSaveCallTime={handleSaveTalentCallTime(tc.id)}
                  onRemove={handleRemoveTalent(tc)}
                  isVisible={tc.isVisibleOverride !== false}
                  onToggleVisibility={handleToggleTalentVisibility(tc)}
                />
              )
            })}
          </div>
        )}

        {availableTalent.length > 0 ? (
          <Select
            onValueChange={(value) => {
              void handleAddTalent(value)
            }}
            value=""
          >
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
          <SaveIndicator savedAt={lastSaved.savedAt} />
          {defaultCrewCall && (
            <span className="ml-auto text-2xs text-[var(--color-text-subtle)]">
              Default: {displayDefaultTime(defaultCrewCall)}
            </span>
          )}
        </div>

        {filteredCrewCalls.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {filteredCrewCalls.map((cc) => {
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
                  onRemove={handleRemoveCrew(cc)}
                  isVisible={cc.isVisibleOverride !== false}
                  showEmail={cc.showEmailOverride !== false}
                  showPhone={cc.showPhoneOverride !== false}
                  onToggleVisibility={handleToggleCrewVisibility(cc)}
                  onToggleEmail={handleToggleCrewEmail(cc)}
                  onTogglePhone={handleToggleCrewPhone(cc)}
                />
              )
            })}
          </div>
        )}

        {availableCrew.length > 0 ? (
          <Select
            onValueChange={(value) => {
              void handleAddCrew(value)
            }}
            value=""
          >
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
