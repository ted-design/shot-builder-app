/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { DayDetails, Schedule, ScheduleEntry } from "@/shared/types"

vi.mock("@/features/schedules/hooks/useSchedules", () => ({
  useSchedules: vi.fn(),
}))
vi.mock("@/features/schedules/hooks/useScheduleEntries", () => ({
  useScheduleEntries: vi.fn(),
}))
vi.mock("@/features/schedules/hooks/useScheduleDayDetails", () => ({
  useScheduleDayDetails: vi.fn(),
}))

import { useSchedules } from "@/features/schedules/hooks/useSchedules"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { ShootDaySchedule } from "@/features/projects/components/home/ShootDaySchedule"

const mockSchedules = useSchedules as unknown as { mockReturnValue: (v: unknown) => void }
const mockEntries = useScheduleEntries as unknown as { mockReturnValue: (v: unknown) => void }
const mockDayDetails = useScheduleDayDetails as unknown as { mockReturnValue: (v: unknown) => void }

const now = Timestamp.fromMillis(Date.now())

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: overrides.id ?? "s1",
    projectId: overrides.projectId ?? "p1",
    name: overrides.name ?? "Day 1",
    // 2026-06-09 (matches the locked mockup's "Jun 9")
    date: overrides.date ?? Timestamp.fromMillis(Date.UTC(2026, 5, 9, 12, 0, 0)),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function makeEntry(overrides: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: overrides.id ?? "e1",
    type: overrides.type ?? "shot",
    title: overrides.title ?? "Block",
    startTime: overrides.startTime,
    time: overrides.time,
    order: overrides.order ?? 0,
    ...overrides,
  }
}

function makeDayDetails(overrides: Partial<DayDetails> = {}): DayDetails {
  return {
    id: overrides.id ?? "d1",
    scheduleId: overrides.scheduleId ?? "s1",
    crewCallTime: overrides.crewCallTime ?? "07:30",
    shootingCallTime: overrides.shootingCallTime ?? "08:00",
    estimatedWrap: overrides.estimatedWrap ?? "18:00",
    ...overrides,
  }
}

function setHooks(opts: {
  schedules?: { data: Schedule[]; loading?: boolean }
  entries?: { data: ScheduleEntry[]; loading?: boolean }
  dayDetails?: { data: DayDetails | null }
}) {
  mockSchedules.mockReturnValue({
    data: opts.schedules?.data ?? [],
    loading: opts.schedules?.loading ?? false,
    error: null,
  })
  mockEntries.mockReturnValue({
    data: opts.entries?.data ?? [],
    loading: opts.entries?.loading ?? false,
    error: null,
  })
  mockDayDetails.mockReturnValue({
    data: opts.dayDetails?.data ?? null,
    loading: false,
    error: null,
  })
}

function renderComp(clientId: string | null = "c1") {
  return render(
    <MemoryRouter>
      <ShootDaySchedule projectId="p1" clientId={clientId} />
    </MemoryRouter>,
  )
}

describe("ShootDaySchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("degrades to empty state when there is no schedule", () => {
    setHooks({ schedules: { data: [] } })
    renderComp()
    expect(screen.getByText(/no schedule yet/i)).toBeInTheDocument()
  })

  it("degrades to empty state when clientId is null", () => {
    setHooks({ schedules: { data: [makeSchedule()] } })
    renderComp(null)
    expect(screen.getByText(/no schedule yet/i)).toBeInTheDocument()
  })

  it("shows a loading skeleton while schedules load", () => {
    setHooks({ schedules: { data: [], loading: true } })
    const { container } = renderComp()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0)
    expect(screen.queryByText(/no schedule yet/i)).not.toBeInTheDocument()
  })

  it("renders the shoot-day heading with the schedule date", () => {
    setHooks({ schedules: { data: [makeSchedule()] } })
    renderComp()
    expect(screen.getByText(/shoot day · jun 9/i)).toBeInTheDocument()
  })

  it("renders the crew-call row from day details", () => {
    setHooks({
      schedules: { data: [makeSchedule()] },
      dayDetails: { data: makeDayDetails({ crewCallTime: "07:30" }) },
    })
    renderComp()
    expect(screen.getByText("7:30 AM")).toBeInTheDocument()
    expect(screen.getByText(/crew call · setup/i)).toBeInTheDocument()
  })

  it("renders timed blocks with shot counts and collapses same-time/title shots", () => {
    setHooks({
      schedules: { data: [makeSchedule()] },
      entries: {
        data: [
          makeEntry({ id: "a", type: "shot", title: "Flat-lay block", startTime: "08:30", order: 0 }),
          makeEntry({ id: "b", type: "shot", title: "Flat-lay block", startTime: "08:30", order: 1 }),
          makeEntry({ id: "c", type: "shot", title: "On-figure · studio", startTime: "11:00", order: 2 }),
        ],
      },
    })
    renderComp()

    expect(screen.getByText("Flat-lay block")).toBeInTheDocument()
    expect(screen.getByText("2 shots")).toBeInTheDocument()
    expect(screen.getByText("On-figure · studio")).toBeInTheDocument()
    expect(screen.getByText("1 shot")).toBeInTheDocument()
    expect(screen.getByText("8:30 AM")).toBeInTheDocument()
    expect(screen.getByText("11:00 AM")).toBeInTheDocument()
  })

  it("orders blocks by start time regardless of fetch order", () => {
    setHooks({
      schedules: { data: [makeSchedule()] },
      entries: {
        data: [
          makeEntry({ id: "late", type: "shot", title: "Lifestyle", startTime: "14:30", order: 0 }),
          makeEntry({ id: "early", type: "shot", title: "Flat-lay", startTime: "08:30", order: 1 }),
        ],
      },
    })
    renderComp()

    const labels = screen.getAllByText(/Lifestyle|Flat-lay/).map((n) => n.textContent)
    expect(labels).toEqual(["Flat-lay", "Lifestyle"])
  })

  it("shows a block-level empty state when the schedule has no entries", () => {
    setHooks({
      schedules: { data: [makeSchedule()] },
      entries: { data: [] },
    })
    renderComp()
    expect(screen.getByText(/shoot day · jun 9/i)).toBeInTheDocument()
    expect(screen.getByText(/no blocks scheduled/i)).toBeInTheDocument()
  })
})
