import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Utensils, Sun, Camera, MapPin, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useLocations } from "@/features/schedules/hooks/useLocations"
import {
  createLocationAndAssignToProject,
  ensureLocationAssignedToProject,
  updateDayDetails,
} from "@/features/schedules/lib/scheduleWrites"
import { classifyTimeInput } from "@/features/schedules/lib/time"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import type { DayDetails, LocationBlock, LocationRecord } from "@/shared/types"

const TIME_FIELD_NAMES = new Set([
  "crewCallTime",
  "shootingCallTime",
  "breakfastTime",
  "firstMealTime",
  "secondMealTime",
  "estimatedWrap",
])

const LOCATION_LABEL_PRESETS = [
  "Basecamp",
  "Hospital",
  "Parking",
  "Production Office",
] as const

const LOCATION_CUSTOM_VALUE = "__custom__"
const LOCATION_NONE_VALUE = "__none__"

interface DayDetailsEditorProps {
  readonly scheduleId: string
  readonly scheduleName: string
  readonly dateStr: string
  readonly dayDetails: DayDetails | null
}

interface TimeAnchorProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string
  readonly placeholder: string
  readonly onSave: (value: string) => void
  readonly required?: boolean
}

interface LocationDraft {
  readonly id: string
  readonly title: string
  readonly locationId: string
  readonly label: string
  readonly notes: string
}

function TimeAnchor({ icon, label, value, placeholder, onSave, required }: TimeAnchorProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
          {required && !value && (
            <span className="ml-1 normal-case tracking-normal text-[var(--color-warning)]">
              required
            </span>
          )}
        </span>
        <TypedTimeInput
          value={value}
          onSave={onSave}
          placeholder={placeholder}
          triggerClassName="w-full text-sm font-semibold"
        />
      </div>
    </div>
  )
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

function normalizeLocationDrafts(
  value: readonly LocationBlock[] | null | undefined,
): readonly LocationDraft[] {
  if (!Array.isArray(value)) return []
  return value.map((loc, index) => ({
    id: loc.id || `location-${index + 1}`,
    title: (loc.title || "").trim() || "Location",
    locationId: (loc.ref?.locationId || "").trim(),
    label: (loc.ref?.label || "").trim(),
    notes: (loc.ref?.notes || "").trim(),
  }))
}

function toLocationBlock(draft: LocationDraft): LocationBlock {
  const locationId = draft.locationId.trim()
  const label = draft.label.trim()
  const notes = draft.notes.trim()
  const hasRef = Boolean(locationId || label || notes)

  return {
    id: draft.id,
    title: draft.title.trim() || "Location",
    ref: hasRef
      ? {
          locationId: locationId || null,
          label: label || null,
          notes: notes || null,
        }
      : null,
    showName: true,
    showPhone: false,
  }
}

function nextSuggestedLocationTitle(drafts: readonly LocationDraft[]): string {
  const used = new Set(drafts.map((draft) => draft.title.trim().toLowerCase()))
  for (const preset of LOCATION_LABEL_PRESETS) {
    if (!used.has(preset.toLowerCase())) return preset
  }
  return "Location"
}

function sortLocationsForProject(
  locations: readonly LocationRecord[],
  projectId: string,
): readonly LocationRecord[] {
  const inProject: LocationRecord[] = []
  const orgOnly: LocationRecord[] = []

  for (const loc of locations) {
    if ((loc.projectIds ?? []).includes(projectId)) {
      inProject.push(loc)
    } else {
      orgOnly.push(loc)
    }
  }

  return [...inProject, ...orgOnly]
}

export function DayDetailsEditor({
  scheduleId,
  scheduleName,
  dateStr,
  dayDetails,
}: DayDetailsEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()
  const { data: locations } = useLocations(clientId)

  const [locationDrafts, setLocationDrafts] = useState<readonly LocationDraft[]>([])
  const [createLocationOpen, setCreateLocationOpen] = useState(false)
  const [createLocationTargetId, setCreateLocationTargetId] = useState<string | null>(null)
  const [createLocationName, setCreateLocationName] = useState("")
  const [createLocationAddress, setCreateLocationAddress] = useState("")
  const [createLocationNotes, setCreateLocationNotes] = useState("")
  const [createLocationSaving, setCreateLocationSaving] = useState(false)

  const locationOptions = useMemo(
    () => sortLocationsForProject(locations, projectId),
    [locations, projectId],
  )

  const locationById = useMemo(() => {
    return new Map(locationOptions.map((loc) => [loc.id, loc]))
  }, [locationOptions])

  const remoteLocationDrafts = useMemo(
    () => normalizeLocationDrafts(dayDetails?.locations),
    [dayDetails?.locations],
  )

  const remoteLocationSnapshot = useMemo(
    () => JSON.stringify(remoteLocationDrafts),
    [remoteLocationDrafts],
  )

  useEffect(() => {
    setLocationDrafts(remoteLocationDrafts)
  }, [remoteLocationSnapshot, remoteLocationDrafts])

  const saveField = useCallback(
    (field: string) => (value: string) => {
      if (!clientId) return
      if (TIME_FIELD_NAMES.has(field)) {
        const parsed = classifyTimeInput(value)
        if (parsed.kind === "invalid-time") {
          toast.error("Invalid time. Use “6:00 AM” or “18:00”.")
          return
        }
        const normalized = parsed.kind === "time" ? parsed.canonical : null
        void updateDayDetails(clientId, projectId, scheduleId, dayDetails?.id ?? null, {
          [field]: normalized,
        })
        return
      }
      updateDayDetails(clientId, projectId, scheduleId, dayDetails?.id ?? null, {
        [field]: value || null,
      })
    },
    [clientId, projectId, scheduleId, dayDetails?.id],
  )

  const saveLocationDrafts = useCallback(
    (nextDrafts: readonly LocationDraft[]) => {
      if (!clientId) return
      const payload = nextDrafts.map(toLocationBlock)
      void updateDayDetails(clientId, projectId, scheduleId, dayDetails?.id ?? null, {
        locations: payload.length > 0 ? payload : null,
      }).catch(() => {
        toast.error("Failed to save location details.")
      })
    },
    [clientId, dayDetails?.id, projectId, scheduleId],
  )

  const applyLocationMutation = useCallback(
    (updater: (prev: readonly LocationDraft[]) => readonly LocationDraft[]) => {
      setLocationDrafts((prev) => {
        const next = updater(prev)
        saveLocationDrafts(next)
        return next
      })
    },
    [saveLocationDrafts],
  )

  const patchLocationDraft = useCallback(
    (locationId: string, patch: Partial<LocationDraft>) => {
      setLocationDrafts((prev) =>
        prev.map((loc) => (loc.id === locationId ? { ...loc, ...patch } : loc)),
      )
    },
    [],
  )

  const addLocationBlock = useCallback(() => {
    applyLocationMutation((prev) => [
      ...prev,
      {
        id: randomId(),
        title: nextSuggestedLocationTitle(prev),
        locationId: "",
        label: "",
        notes: "",
      },
    ])
  }, [applyLocationMutation])

  const removeLocationBlock = useCallback(
    (locationId: string) => {
      applyLocationMutation((prev) => prev.filter((loc) => loc.id !== locationId))
    },
    [applyLocationMutation],
  )

  const handleLabelPresetChange = useCallback(
    (locationId: string, value: string) => {
      applyLocationMutation((prev) =>
        prev.map((loc) => {
          if (loc.id !== locationId) return loc
          if (value === LOCATION_CUSTOM_VALUE) {
            return {
              ...loc,
              title: LOCATION_LABEL_PRESETS.includes(loc.title as (typeof LOCATION_LABEL_PRESETS)[number])
                ? "Location"
                : loc.title,
            }
          }
          return { ...loc, title: value }
        }),
      )
    },
    [applyLocationMutation],
  )

  const handleLibraryLocationChange = useCallback(
    (locationBlockId: string, value: string) => {
      const selectedLocationId = value === LOCATION_NONE_VALUE ? "" : value
      applyLocationMutation((prev) =>
        prev.map((loc) => {
          if (loc.id !== locationBlockId) return loc
          if (!selectedLocationId) {
            return { ...loc, locationId: "" }
          }

          const selected = locationById.get(selectedLocationId)
          const fallbackLabel = selected?.name?.trim() ?? ""
          const fallbackNotes = (selected?.address?.trim() ?? selected?.notes?.trim() ?? "")
          return {
            ...loc,
            locationId: selectedLocationId,
            label: fallbackLabel,
            notes: fallbackNotes,
          }
        }),
      )

      if (clientId && selectedLocationId) {
        void ensureLocationAssignedToProject(clientId, projectId, selectedLocationId).catch(() => {
          toast.error("Failed to attach location to this project.")
        })
      }
    },
    [applyLocationMutation, clientId, locationById, projectId],
  )

  const commitLocationDrafts = useCallback(() => {
    saveLocationDrafts(locationDrafts)
  }, [locationDrafts, saveLocationDrafts])

  const openCreateLocation = useCallback((targetLocationId: string) => {
    setCreateLocationTargetId(targetLocationId)
    setCreateLocationName("")
    setCreateLocationAddress("")
    setCreateLocationNotes("")
    setCreateLocationOpen(true)
  }, [])

  const handleCreateLocation = useCallback(async () => {
    if (!clientId) return
    if (!createLocationTargetId) return
    const name = createLocationName.trim()
    if (!name) {
      toast.error("Location name is required.")
      return
    }

    setCreateLocationSaving(true)
    try {
      const created = await createLocationAndAssignToProject(clientId, projectId, {
        name,
        address: createLocationAddress,
        notes: createLocationNotes,
      })

      applyLocationMutation((prev) =>
        prev.map((loc) => {
          if (loc.id !== createLocationTargetId) return loc
          return {
            ...loc,
            locationId: created.id,
            label: created.name,
            notes: created.address ?? "",
          }
        }),
      )

      setCreateLocationOpen(false)
      setCreateLocationTargetId(null)
      setCreateLocationName("")
      setCreateLocationAddress("")
      setCreateLocationNotes("")
      toast.success("Location created and assigned.")
    } catch {
      toast.error("Failed to create location.")
    } finally {
      setCreateLocationSaving(false)
    }
  }, [
    applyLocationMutation,
    clientId,
    createLocationAddress,
    createLocationName,
    createLocationNotes,
    createLocationTargetId,
    projectId,
  ])

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      {/* Schedule identity */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          {scheduleName}
        </h2>
        {dateStr && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{dateStr}</p>
        )}
      </div>

      {/* Day anchors */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <TimeAnchor
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Crew Call"
          value={dayDetails?.crewCallTime ?? ""}
          placeholder="e.g. 6:00 AM"
          onSave={saveField("crewCallTime")}
          required
        />
        <TimeAnchor
          icon={<Camera className="h-3.5 w-3.5" />}
          label="Shooting Call"
          value={dayDetails?.shootingCallTime ?? ""}
          placeholder="e.g. 7:00 AM"
          onSave={saveField("shootingCallTime")}
          required
        />
        <TimeAnchor
          icon={<Utensils className="h-3.5 w-3.5" />}
          label="Breakfast"
          value={dayDetails?.breakfastTime ?? ""}
          placeholder="optional"
          onSave={saveField("breakfastTime")}
        />
        <TimeAnchor
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Est. Wrap"
          value={dayDetails?.estimatedWrap ?? ""}
          placeholder="e.g. 7:00 PM"
          onSave={saveField("estimatedWrap")}
          required
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Location Details
            </h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={addLocationBlock}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </Button>
        </div>

        {locationDrafts.length === 0 ? (
          <p className="text-xs text-[var(--color-text-subtle)]">
            No location blocks yet. Add Basecamp, Hospital, Parking, or custom day locations.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {locationDrafts.map((loc) => {
              const isPreset = LOCATION_LABEL_PRESETS.includes(
                loc.title as (typeof LOCATION_LABEL_PRESETS)[number],
              )

              return (
                <div
                  key={loc.id}
                  className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {loc.title || "Location"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLocationBlock(loc.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                      aria-label="Remove location block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Label
                      </Label>
                      <Select
                        value={isPreset ? loc.title : LOCATION_CUSTOM_VALUE}
                        onValueChange={(value) => handleLabelPresetChange(loc.id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select label" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCATION_LABEL_PRESETS.map((preset) => (
                            <SelectItem key={preset} value={preset}>
                              {preset}
                            </SelectItem>
                          ))}
                          <SelectItem value={LOCATION_CUSTOM_VALUE}>Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        From Library
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={loc.locationId || LOCATION_NONE_VALUE}
                          onValueChange={(value) => handleLibraryLocationChange(loc.id, value)}
                        >
                          <SelectTrigger className="h-8 min-w-0 flex-1">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={LOCATION_NONE_VALUE}>No linked location</SelectItem>
                            {locationOptions.map((option) => {
                              const inProject = (option.projectIds ?? []).includes(projectId)
                              return (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name}
                                  {!inProject && " (Org)"}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => openCreateLocation(loc.id)}
                        >
                          New
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!isPreset && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Custom Label
                      </Label>
                      <Input
                        value={loc.title}
                        onChange={(event) => patchLocationDraft(loc.id, { title: event.target.value })}
                        onBlur={commitLocationDrafts}
                        placeholder="e.g. Studio Holding"
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Display Text
                      </Label>
                      <Input
                        value={loc.label}
                        onChange={(event) => patchLocationDraft(loc.id, { label: event.target.value })}
                        onBlur={commitLocationDrafts}
                        placeholder={loc.locationId ? (locationById.get(loc.locationId)?.name ?? "Location name") : "Optional"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Details
                      </Label>
                      <Textarea
                        value={loc.notes}
                        onChange={(event) => patchLocationDraft(loc.id, { notes: event.target.value })}
                        onBlur={commitLocationDrafts}
                        placeholder="Address, contact, access notes..."
                        className="min-h-[64px] text-xs"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={createLocationOpen}
        onOpenChange={(nextOpen) => {
          if (createLocationSaving) return
          setCreateLocationOpen(nextOpen)
          if (!nextOpen) {
            setCreateLocationTargetId(null)
            setCreateLocationName("")
            setCreateLocationAddress("")
            setCreateLocationNotes("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Location</DialogTitle>
            <DialogDescription>
              Add a new library location and link it to this day detail block.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="callsheet-location-name">Name</Label>
              <Input
                id="callsheet-location-name"
                value={createLocationName}
                onChange={(event) => setCreateLocationName(event.target.value)}
                placeholder="e.g. Downtown Hospital"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="callsheet-location-address">Address</Label>
              <Input
                id="callsheet-location-address"
                value={createLocationAddress}
                onChange={(event) => setCreateLocationAddress(event.target.value)}
                placeholder="Street, city, state"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="callsheet-location-notes">Notes</Label>
              <Textarea
                id="callsheet-location-notes"
                value={createLocationNotes}
                onChange={(event) => setCreateLocationNotes(event.target.value)}
                placeholder="Optional details"
                className="min-h-[96px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateLocationOpen(false)}
              disabled={createLocationSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateLocation()}
              disabled={createLocationSaving || createLocationName.trim().length === 0}
            >
              {createLocationSaving ? "Creating..." : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
