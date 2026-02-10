import type {
  Schedule,
  ScheduleEntry,
  ScheduleEntryType,
  DayDetails,
  TalentCallSheet,
  TalentCallStatus,
  CrewCallSheet,
  CallOffsetDirection,
  CrewRecord,
  LocationBlock,
  WeatherData,
  ScheduleTrack,
  ScheduleSettings,
  LocationRecord,
  ScheduleEntryHighlight,
} from "@/shared/types"
import { classifyTimeInput, minutesToHHMM, parseTimeToMinutes } from "@/features/schedules/lib/time"

function normalizeTimeOnly(value: unknown): string | null {
  if (typeof value !== "string") return null
  const parsed = classifyTimeInput(value)
  return parsed.kind === "time" ? parsed.canonical : null
}

function normalizeTimeOrText(
  rawTime: unknown,
  rawText: unknown,
): { readonly callTime: string | null; readonly callText: string | null } {
  const parsed = classifyTimeInput(typeof rawTime === "string" ? rawTime : null, {
    allowText: true,
  })
  const explicitText = typeof rawText === "string" ? rawText.trim() : ""

  if (parsed.kind === "time") {
    return {
      callTime: parsed.canonical,
      callText: null,
    }
  }

  if (parsed.kind === "text") {
    return {
      callTime: null,
      callText: explicitText || parsed.text,
    }
  }

  return {
    callTime: null,
    callText: explicitText || null,
  }
}

export function mapSchedule(id: string, data: Record<string, unknown>): Schedule {
  const rawTracks = data["tracks"]
  const tracks: readonly ScheduleTrack[] | undefined = Array.isArray(rawTracks)
    ? (rawTracks as unknown[])
        .map((t) => {
          if (!t || typeof t !== "object") return null
          const obj = t as Record<string, unknown>
          const tid = typeof obj["id"] === "string" ? obj["id"].trim() : ""
          if (!tid) return null
          const name = typeof obj["name"] === "string" ? obj["name"].trim() : ""
          const order = typeof obj["order"] === "number" ? obj["order"] : 0
          return { id: tid, name: name || "Track", order }
        })
        .filter(Boolean) as ScheduleTrack[]
    : undefined

  const rawSettings = data["settings"]
  const settings: ScheduleSettings | undefined =
    rawSettings && typeof rawSettings === "object"
      ? {
          cascadeChanges:
            (rawSettings as Record<string, unknown>)["cascadeChanges"] !== false,
          dayStartTime:
            typeof (rawSettings as Record<string, unknown>)["dayStartTime"] === "string"
              ? ((rawSettings as Record<string, unknown>)["dayStartTime"] as string)
              : "06:00",
          defaultEntryDurationMinutes:
            ((rawSettings as Record<string, unknown>)["defaultEntryDurationMinutes"] as number) ??
            15,
        }
      : undefined

  return {
    id,
    projectId: (data["projectId"] as string) ?? "",
    name: (data["name"] as string) ?? "",
    date: (data["date"] as Schedule["date"]) ?? null,
    participatingTalentIds: data["participatingTalentIds"] as readonly string[] | undefined,
    tracks,
    settings,
    createdAt: data["createdAt"] as Schedule["createdAt"],
    updatedAt: data["updatedAt"] as Schedule["updatedAt"],
    createdBy: data["createdBy"] as string | undefined,
  }
}

const VALID_ENTRY_TYPES = new Set<ScheduleEntryType>(["shot", "setup", "break", "move", "banner"])

function normalizeTrackId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed === "all") return "shared"
  return trimmed
}

export function mapScheduleEntry(id: string, data: Record<string, unknown>): ScheduleEntry {
  const rawType = data["type"] as string
  const type: ScheduleEntryType = VALID_ENTRY_TYPES.has(rawType as ScheduleEntryType)
    ? (rawType as ScheduleEntryType)
    : "shot"

  const rawStart = data["startTime"]
  const startTimeFromDoc =
    typeof rawStart === "string" && rawStart.trim().length > 0 ? rawStart.trim() : null
  const legacyTime = data["time"] as string | undefined
  const startTime =
    startTimeFromDoc ??
    (() => {
      const mins = parseTimeToMinutes(legacyTime)
      return mins == null ? null : minutesToHHMM(mins)
    })()

  return {
    id,
    type,
    title: (data["title"] as string) ?? "",
    shotId: data["shotId"] as string | undefined,
    startTime,
    time: legacyTime,
    duration: data["duration"] as number | undefined,
    order: (data["order"] as number) ?? 0,
    notes: data["notes"] as string | undefined,
    trackId: normalizeTrackId(data["trackId"]),
    appliesToTrackIds: data["appliesToTrackIds"] as readonly string[] | null | undefined,
    highlight: mapScheduleEntryHighlight(data["highlight"]),
    createdAt: data["createdAt"] as ScheduleEntry["createdAt"],
    updatedAt: data["updatedAt"] as ScheduleEntry["updatedAt"],
  }
}

function mapScheduleEntryHighlight(raw: unknown): ScheduleEntryHighlight | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const variant = obj["variant"] === "outline" ? "outline" : obj["variant"] === "solid" ? "solid" : null
  const color = asTrimmedText(obj["color"])
  const emoji = asTrimmedText(obj["emoji"])
  if (!variant || !color) return null
  return {
    variant,
    color,
    emoji,
  }
}

export function mapDayDetails(id: string, data: Record<string, unknown>): DayDetails {
  return {
    id,
    scheduleId: (data["scheduleId"] as string) ?? "",
    crewCallTime: normalizeTimeOnly(data["crewCallTime"]) ?? "",
    shootingCallTime: normalizeTimeOnly(data["shootingCallTime"]) ?? "",
    breakfastTime: normalizeTimeOnly(data["breakfastTime"]),
    firstMealTime: normalizeTimeOnly(data["firstMealTime"]),
    secondMealTime: normalizeTimeOnly(data["secondMealTime"]),
    estimatedWrap: normalizeTimeOnly(data["estimatedWrap"]) ?? "",
    locations: mapDayDetailsLocations(data),
    weather: data["weather"] as WeatherData | null | undefined,
    keyPeople: data["keyPeople"] as string | null | undefined,
    setMedic: data["setMedic"] as string | null | undefined,
    scriptVersion: data["scriptVersion"] as string | null | undefined,
    scheduleVersion: data["scheduleVersion"] as string | null | undefined,
    notes: data["notes"] as string | null | undefined,
    createdAt: data["createdAt"] as DayDetails["createdAt"],
    updatedAt: data["updatedAt"] as DayDetails["updatedAt"],
    createdBy: data["createdBy"] as string | undefined,
  }
}

function asTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapLocationRef(raw: unknown): LocationBlock["ref"] {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const locationId = asTrimmedText(obj["locationId"])
  const label = asTrimmedText(obj["label"])
  const notes = asTrimmedText(obj["notes"])
  if (!locationId && !label && !notes) return null
  return { locationId, label, notes }
}

function hasLocationRefContent(ref: LocationBlock["ref"]): boolean {
  if (!ref) return false
  return Boolean(
    (ref.locationId && ref.locationId.trim()) ||
      (ref.label && ref.label.trim()) ||
      (ref.notes && ref.notes.trim()),
  )
}

function mapLocationBlock(raw: unknown, fallback: {
  readonly id: string
  readonly title: string
  readonly showName: boolean
  readonly showPhone: boolean
}): LocationBlock | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const ref = mapLocationRef(obj["ref"])
  const title = asTrimmedText(obj["title"]) ?? fallback.title
  const id = asTrimmedText(obj["id"]) ?? fallback.id
  const showName = typeof obj["showName"] === "boolean" ? obj["showName"] : fallback.showName
  const showPhone = typeof obj["showPhone"] === "boolean" ? obj["showPhone"] : fallback.showPhone

  if (!title && !hasLocationRefContent(ref)) return null

  return {
    id,
    title,
    ref,
    showName,
    showPhone,
  }
}

function mapLegacyLocationRef(raw: unknown): LocationBlock["ref"] {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const locationId = asTrimmedText(obj["locationId"])
  const label = asTrimmedText(obj["label"])
  const notes = asTrimmedText(obj["notes"])
  if (!locationId && !label && !notes) return null
  return { locationId, label, notes }
}

function mapDayDetailsLocations(data: Record<string, unknown>): readonly LocationBlock[] | null | undefined {
  const rawLocations = data["locations"]
  if (rawLocations === null) return null
  if (Array.isArray(rawLocations)) {
    return rawLocations
      .map((raw, index) =>
        mapLocationBlock(raw, {
          id: `location-${index + 1}`,
          title: "Location",
          showName: true,
          showPhone: false,
        }),
      )
      .filter((loc): loc is LocationBlock => loc != null)
  }

  const legacyFixed = [
    { key: "productionOffice", title: "Production Office", showName: true, showPhone: true },
    { key: "nearestHospital", title: "Hospital", showName: true, showPhone: true },
    { key: "basecamp", title: "Basecamp", showName: true, showPhone: false },
    { key: "parking", title: "Parking", showName: true, showPhone: false },
  ] as const

  const fromLegacyFixed = legacyFixed
    .map((entry) => {
      const ref = mapLegacyLocationRef(data[entry.key])
      if (!hasLocationRefContent(ref)) return null
      return {
        id: `legacy-${entry.key}`,
        title: entry.title,
        ref,
        showName: entry.showName,
        showPhone: entry.showPhone,
      } satisfies LocationBlock
    })
    .filter((loc): loc is LocationBlock => loc != null)

  const custom = Array.isArray(data["customLocations"])
    ? (data["customLocations"] as unknown[])
        .map((raw, index) => {
          if (!raw || typeof raw !== "object") return null
          const obj = raw as Record<string, unknown>
          const ref = {
            locationId: asTrimmedText(obj["locationId"]),
            label: asTrimmedText(obj["label"]),
            notes: asTrimmedText(obj["notes"]),
          } satisfies NonNullable<LocationBlock["ref"]>
          if (!hasLocationRefContent(ref)) return null
          return {
            id: asTrimmedText(obj["id"]) ?? `legacy-custom-${index + 1}`,
            title: asTrimmedText(obj["title"]) ?? "Location",
            ref,
            showName: true,
            showPhone: false,
          } satisfies LocationBlock
        })
        .filter((loc): loc is LocationBlock => loc != null)
    : []

  const combined = [...fromLegacyFixed, ...custom]
  return combined.length > 0 ? combined : undefined
}

const VALID_TALENT_STATUSES = new Set<TalentCallStatus>(["confirmed", "pending", "cancelled"])

export function mapTalentCall(id: string, data: Record<string, unknown>): TalentCallSheet {
  const rawStatus = data["status"] as string | null | undefined
  const status: TalentCallStatus | null =
    rawStatus && VALID_TALENT_STATUSES.has(rawStatus as TalentCallStatus)
      ? (rawStatus as TalentCallStatus)
      : null

  const call = normalizeTimeOrText(data["callTime"], data["callText"])

  return {
    id,
    talentId: (data["talentId"] as string) ?? "",
    callTime: call.callTime,
    callText: call.callText,
    setTime: normalizeTimeOnly(data["setTime"]),
    wrapTime: normalizeTimeOnly(data["wrapTime"]),
    role: data["role"] as string | null | undefined,
    status,
    notes: data["notes"] as string | null | undefined,
    createdAt: data["createdAt"] as TalentCallSheet["createdAt"],
    updatedAt: data["updatedAt"] as TalentCallSheet["updatedAt"],
    createdBy: data["createdBy"] as string | undefined,
  }
}

const VALID_OFFSET_DIRS = new Set<CallOffsetDirection>(["early", "delay"])

export function mapCrewCall(id: string, data: Record<string, unknown>): CrewCallSheet {
  const rawDir = data["callOffsetDirection"] as string | null | undefined
  const callOffsetDirection: CallOffsetDirection | null =
    rawDir && VALID_OFFSET_DIRS.has(rawDir as CallOffsetDirection)
      ? (rawDir as CallOffsetDirection)
      : null

  const call = normalizeTimeOrText(data["callTime"], data["callText"])

  return {
    id,
    crewMemberId: (data["crewMemberId"] as string) ?? "",
    callTime: call.callTime,
    callText: call.callText,
    callOffsetDirection,
    callOffsetMinutes: data["callOffsetMinutes"] as number | null | undefined,
    wrapTime: normalizeTimeOnly(data["wrapTime"]),
    wrapText: data["wrapText"] as string | null | undefined,
    department: data["department"] as string | null | undefined,
    position: data["position"] as string | null | undefined,
    notes: data["notes"] as string | null | undefined,
    createdAt: data["createdAt"] as CrewCallSheet["createdAt"],
    updatedAt: data["updatedAt"] as CrewCallSheet["updatedAt"],
    createdBy: data["createdBy"] as string | undefined,
  }
}

export function mapCrewRecord(id: string, data: Record<string, unknown>): CrewRecord {
  const rawProjectIds = data["projectIds"]
  return {
    id,
    name: (data["name"] as string) ?? "",
    department: data["department"] as string | undefined,
    position: data["position"] as string | undefined,
    email: data["email"] as string | undefined,
    phone: data["phone"] as string | undefined,
    notes: data["notes"] as string | undefined,
    projectIds: Array.isArray(rawProjectIds) ? (rawProjectIds as string[]) : undefined,
  }
}

export function mapLocationRecord(id: string, data: Record<string, unknown>): LocationRecord {
  const rawProjectIds = data["projectIds"]
  const explicitAddress = asTrimmedText(data["address"])
  const street = asTrimmedText(data["street"])
  const unit = asTrimmedText(data["unit"])
  const city = asTrimmedText(data["city"])
  const province = asTrimmedText(data["province"])
  const postal = asTrimmedText(data["postal"])

  const line1 = [street, unit].filter(Boolean).join(" ").trim()
  const line2 = [city, province].filter(Boolean).join(", ").trim()
  const derivedAddress = [line1, line2, postal].filter(Boolean).join(" · ").trim()

  return {
    id,
    name: (data["name"] as string) ?? "",
    address: explicitAddress ?? (derivedAddress || undefined),
    notes: data["notes"] as string | undefined,
    projectIds: Array.isArray(rawProjectIds) ? (rawProjectIds as string[]) : undefined,
  }
}
