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
} from "@/shared/types"

export function mapSchedule(id: string, data: Record<string, unknown>): Schedule {
  return {
    id,
    projectId: (data["projectId"] as string) ?? "",
    name: (data["name"] as string) ?? "",
    date: (data["date"] as Schedule["date"]) ?? null,
    participatingTalentIds: data["participatingTalentIds"] as readonly string[] | undefined,
    createdAt: data["createdAt"] as Schedule["createdAt"],
    updatedAt: data["updatedAt"] as Schedule["updatedAt"],
    createdBy: data["createdBy"] as string | undefined,
  }
}

const VALID_ENTRY_TYPES = new Set<ScheduleEntryType>(["shot", "setup", "break", "move", "banner"])

export function mapScheduleEntry(id: string, data: Record<string, unknown>): ScheduleEntry {
  const rawType = data["type"] as string
  const type: ScheduleEntryType = VALID_ENTRY_TYPES.has(rawType as ScheduleEntryType)
    ? (rawType as ScheduleEntryType)
    : "shot"

  return {
    id,
    type,
    title: (data["title"] as string) ?? "",
    shotId: data["shotId"] as string | undefined,
    time: data["time"] as string | undefined,
    duration: data["duration"] as number | undefined,
    order: (data["order"] as number) ?? 0,
    notes: data["notes"] as string | undefined,
    createdAt: data["createdAt"] as ScheduleEntry["createdAt"],
    updatedAt: data["updatedAt"] as ScheduleEntry["updatedAt"],
  }
}

export function mapDayDetails(id: string, data: Record<string, unknown>): DayDetails {
  return {
    id,
    scheduleId: (data["scheduleId"] as string) ?? "",
    crewCallTime: (data["crewCallTime"] as string) ?? "",
    shootingCallTime: (data["shootingCallTime"] as string) ?? "",
    breakfastTime: data["breakfastTime"] as string | null | undefined,
    firstMealTime: data["firstMealTime"] as string | null | undefined,
    secondMealTime: data["secondMealTime"] as string | null | undefined,
    estimatedWrap: (data["estimatedWrap"] as string) ?? "",
    locations: data["locations"] as readonly LocationBlock[] | null | undefined,
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

const VALID_TALENT_STATUSES = new Set<TalentCallStatus>(["confirmed", "pending", "cancelled"])

export function mapTalentCall(id: string, data: Record<string, unknown>): TalentCallSheet {
  const rawStatus = data["status"] as string | null | undefined
  const status: TalentCallStatus | null =
    rawStatus && VALID_TALENT_STATUSES.has(rawStatus as TalentCallStatus)
      ? (rawStatus as TalentCallStatus)
      : null

  return {
    id,
    talentId: (data["talentId"] as string) ?? "",
    callTime: data["callTime"] as string | null | undefined,
    callText: data["callText"] as string | null | undefined,
    setTime: data["setTime"] as string | null | undefined,
    wrapTime: data["wrapTime"] as string | null | undefined,
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

  return {
    id,
    crewMemberId: (data["crewMemberId"] as string) ?? "",
    callTime: data["callTime"] as string | null | undefined,
    callText: data["callText"] as string | null | undefined,
    callOffsetDirection,
    callOffsetMinutes: data["callOffsetMinutes"] as number | null | undefined,
    wrapTime: data["wrapTime"] as string | null | undefined,
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
  return {
    id,
    name: (data["name"] as string) ?? "",
    department: data["department"] as string | undefined,
    position: data["position"] as string | undefined,
    email: data["email"] as string | undefined,
    phone: data["phone"] as string | undefined,
    notes: data["notes"] as string | undefined,
  }
}
