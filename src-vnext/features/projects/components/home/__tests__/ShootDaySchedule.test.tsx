/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { DayDetails, Schedule, ScheduleEntry } from "@/shared/types"

// Schedules + entries are now passed in as props (fetched once by
// ProjectHomePage); only the per-day crew-call detail stays a local hook.
vi.mock("@/features/schedules/hooks/useScheduleDayDetails", () => ({
  useScheduleDayDetails: vi.fn(),
}))

import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { ShootDaySchedule } from "@/features/projects/components/home/ShootDaySchedule"

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

function setDayDetails(data: DayDetails | null = null) {
  mockDayDetails.mockReturnValue({ data, loading: false, error: null })
}

interface RenderOpts {
  clientId?: string | null
  schedules?: Schedule[]
  schedulesLoading?: boolean
  scheduleEntries?: ScheduleEntry[]
  entriesLoading?: boolean
}

function renderComp(opts: RenderOpts = {}) {
  return render(
    <MemoryRouter>
      <ShootDaySchedule
        projectId="p1"
        clientId={opts.clientId === undefined ? "c1" : opts.clientId}
        schedules={opts.schedules ?? []}
        schedulesLoading={opts.schedulesLoading ?? false}
        scheduleEntries={opts.scheduleEntries ?? []}
        entriesLoading={opts.entriesLoading ?? false}
      />
    </MemoryRouter>,
  )
}

describe("ShootDaySchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDayDetails(null)
  })

  it("degrades to empty state when there is no schedule", () => {
    renderComp({ schedules: [] })
    expect(screen.getByText(/no schedule yet/i)).toBeInTheDocument()
  })

  it("degrades to empty state when clientId is null", () => {
    renderComp({ clientId: null, schedules: [makeSchedule()] })
    expect(screen.getByText(/no schedule yet/i)).toBeInTheDocument()
  })

  it("shows a loading skeleton while schedules load", () => {
    const { container } = renderComp({ schedules: [], schedulesLoading: true })
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0)
    expect(screen.queryByText(/no schedule yet/i)).not.toBeInTheDocument()
  })

  it("renders the shoot-day heading with the schedule date", () => {
    renderComp({ schedules: [makeSchedule()] })
    expect(screen.getByText(/shoot day · jun 9/i)).toBeInTheDocument()
  })

  it("renders the crew-call row from day details", () => {
    setDayDetails(makeDayDetails({ crewCallTime: "07:30" }))
    renderComp({ schedules: [makeSchedule()] })
    expect(screen.getByText("7:30 AM")).toBeInTheDocument()
    expect(screen.getByText(/crew call · setup/i)).toBeInTheDocument()
  })

  it("renders timed blocks with shot counts and collapses same-time/title shots", () => {
    renderComp({
      schedules: [makeSchedule()],
      scheduleEntries: [
        makeEntry({ id: "a", type: "shot", title: "Flat-lay block", startTime: "08:30", order: 0 }),
        makeEntry({ id: "b", type: "shot", title: "Flat-lay block", startTime: "08:30", order: 1 }),
        makeEntry({ id: "c", type: "shot", title: "On-figure · studio", startTime: "11:00", order: 2 }),
      ],
    })

    expect(screen.getByText("Flat-lay block")).toBeInTheDocument()
    expect(screen.getByText("2 shots")).toBeInTheDocument()
    expect(screen.getByText("On-figure · studio")).toBeInTheDocument()
    expect(screen.getByText("1 shot")).toBeInTheDocument()
    expect(screen.getByText("8:30 AM")).toBeInTheDocument()
    expect(screen.getByText("11:00 AM")).toBeInTheDocument()
  })

  it("orders blocks by start time regardless of fetch order", () => {
    renderComp({
      schedules: [makeSchedule()],
      scheduleEntries: [
        makeEntry({ id: "late", type: "shot", title: "Lifestyle", startTime: "14:30", order: 0 }),
        makeEntry({ id: "early", type: "shot", title: "Flat-lay", startTime: "08:30", order: 1 }),
      ],
    })

    const labels = screen.getAllByText(/Lifestyle|Flat-lay/).map((n) => n.textContent)
    expect(labels).toEqual(["Flat-lay", "Lifestyle"])
  })

  it("shows a block-level empty state when the schedule has no entries", () => {
    renderComp({ schedules: [makeSchedule()], scheduleEntries: [] })
    expect(screen.getByText(/shoot day · jun 9/i)).toBeInTheDocument()
    expect(screen.getByText(/no blocks scheduled/i)).toBeInTheDocument()
  })
})
