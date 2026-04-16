import { describe, it, expect, vi, beforeEach } from "vitest"

const mockUseSchedule = vi.fn()
const mockUseScheduleDayDetails = vi.fn()
const mockUseScheduleEntries = vi.fn()
const mockUseScheduleTalentCalls = vi.fn()
const mockUseScheduleCrewCalls = vi.fn()
const mockUseCallSheetConfig = vi.fn()

vi.mock("@/features/schedules/hooks/useSchedule", () => ({
  useSchedule: (...args: unknown[]) => mockUseSchedule(...args),
}))
vi.mock("@/features/schedules/hooks/useScheduleDayDetails", () => ({
  useScheduleDayDetails: (...args: unknown[]) => mockUseScheduleDayDetails(...args),
}))
vi.mock("@/features/schedules/hooks/useScheduleEntries", () => ({
  useScheduleEntries: (...args: unknown[]) => mockUseScheduleEntries(...args),
}))
vi.mock("@/features/schedules/hooks/useScheduleTalentCalls", () => ({
  useScheduleTalentCalls: (...args: unknown[]) => mockUseScheduleTalentCalls(...args),
}))
vi.mock("@/features/schedules/hooks/useScheduleCrewCalls", () => ({
  useScheduleCrewCalls: (...args: unknown[]) => mockUseScheduleCrewCalls(...args),
}))
vi.mock("@/features/schedules/hooks/useCallSheetConfig", () => ({
  useCallSheetConfig: (...args: unknown[]) => mockUseCallSheetConfig(...args),
}))

import { useCallSheetBundle } from "../useCallSheetBundle"

const defaultConfigReturn = {
  raw: null,
  config: {
    sections: {},
    scheduleBlockFields: {},
    colors: {},
    headerLayout: "legacy",
    fieldConfigs: {},
  },
  loading: false,
  error: null,
  setSectionVisibility: vi.fn(),
  setScheduleBlockFields: vi.fn(),
  setColors: vi.fn(),
  setHeaderLayout: vi.fn(),
  setSectionFieldConfig: vi.fn(),
}

describe("useCallSheetBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSchedule.mockReturnValue({ data: null, loading: false, error: null })
    mockUseScheduleDayDetails.mockReturnValue({ data: null, loading: false, error: null })
    mockUseScheduleEntries.mockReturnValue({ data: [], loading: false, error: null })
    mockUseScheduleTalentCalls.mockReturnValue({ data: [], loading: false, error: null })
    mockUseScheduleCrewCalls.mockReturnValue({ data: [], loading: false, error: null })
    mockUseCallSheetConfig.mockReturnValue({ ...defaultConfigReturn })
  })

  it("fans (clientId, projectId, scheduleId) out to every inner hook", () => {
    useCallSheetBundle("c1", "p1", "s1")
    expect(mockUseSchedule).toHaveBeenCalledWith("c1", "p1", "s1")
    expect(mockUseScheduleDayDetails).toHaveBeenCalledWith("c1", "p1", "s1")
    expect(mockUseScheduleEntries).toHaveBeenCalledWith("c1", "p1", "s1")
    expect(mockUseScheduleTalentCalls).toHaveBeenCalledWith("c1", "p1", "s1")
    expect(mockUseScheduleCrewCalls).toHaveBeenCalledWith("c1", "p1", "s1")
    expect(mockUseCallSheetConfig).toHaveBeenCalledWith("c1", "p1", "s1")
  })

  it("returns data for each slice under a stable name", () => {
    const schedule = { id: "s1", name: "Day 1" }
    const dayDetails = { id: "d1" }
    const entries = [{ id: "e1" }]
    const talentCalls = [{ id: "t1" }]
    const crewCalls = [{ id: "cr1" }]
    mockUseSchedule.mockReturnValue({ data: schedule, loading: false, error: null })
    mockUseScheduleDayDetails.mockReturnValue({ data: dayDetails, loading: false, error: null })
    mockUseScheduleEntries.mockReturnValue({ data: entries, loading: false, error: null })
    mockUseScheduleTalentCalls.mockReturnValue({ data: talentCalls, loading: false, error: null })
    mockUseScheduleCrewCalls.mockReturnValue({ data: crewCalls, loading: false, error: null })

    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.schedule).toBe(schedule)
    expect(result.dayDetails).toBe(dayDetails)
    expect(result.entries).toBe(entries)
    expect(result.talentCalls).toBe(talentCalls)
    expect(result.crewCalls).toBe(crewCalls)
    expect(result.callSheet).toBe(mockUseCallSheetConfig.mock.results[0]!.value)
  })

  it("loading is true when any inner hook is loading", () => {
    mockUseScheduleEntries.mockReturnValue({ data: [], loading: true, error: null })
    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.loading).toBe(true)
  })

  it("loading is false when every inner hook is idle", () => {
    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.loading).toBe(false)
  })

  it("surfaces per-slice loading flags for granular readiness", () => {
    mockUseScheduleDayDetails.mockReturnValue({ data: null, loading: true, error: null })
    mockUseScheduleCrewCalls.mockReturnValue({ data: [], loading: true, error: null })
    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.loadingFlags).toEqual({
      schedule: false,
      dayDetails: true,
      entries: false,
      talentCalls: false,
      crewCalls: true,
      config: false,
    })
  })

  it("surfaces the first non-null schedule error as a string", () => {
    mockUseSchedule.mockReturnValue({
      data: null,
      loading: false,
      error: "schedule missing",
    })
    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.error).toBe("schedule missing")
  })

  it("normalises a FirestoreCollectionError object to its message", () => {
    mockUseScheduleEntries.mockReturnValue({
      data: [],
      loading: false,
      error: { message: "missing index", isMissingIndex: true },
    })
    const result = useCallSheetBundle("c1", "p1", "s1")
    expect(result.error).toBe("missing index")
  })

  it("passes null ids through without crashing", () => {
    const result = useCallSheetBundle(null, "p1", null)
    expect(mockUseSchedule).toHaveBeenCalledWith(null, "p1", null)
    expect(result.loading).toBe(false)
    expect(result.error).toBe(null)
  })
})
