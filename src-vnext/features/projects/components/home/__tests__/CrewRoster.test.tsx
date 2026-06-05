/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { CrewRecord, CrewCallSheet, Schedule } from "@/shared/types"

vi.mock("@/features/library/hooks/useCrewLibrary", () => ({
  useCrewLibrary: vi.fn(),
}))

vi.mock("@/features/schedules/hooks/useScheduleCrewCalls", () => ({
  useScheduleCrewCalls: vi.fn(),
}))

import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { useScheduleCrewCalls } from "@/features/schedules/hooks/useScheduleCrewCalls"
import { CrewRoster } from "@/features/projects/components/home/CrewRoster"

const mockCrew = useCrewLibrary as unknown as { mockReturnValue: (v: unknown) => void }
const mockCalls = useScheduleCrewCalls as unknown as { mockReturnValue: (v: unknown) => void }

function crew(overrides: Partial<CrewRecord>): CrewRecord {
  return {
    id: overrides.id ?? "cr1",
    name: overrides.name ?? "Sarah Kemp",
    position: overrides.position,
    department: overrides.department,
    firstName: overrides.firstName,
    lastName: overrides.lastName,
  }
}

function schedule(id: string): Schedule {
  return { id, projectId: "p1", name: "Shoot Day" } as Schedule
}

function call(crewMemberId: string): CrewCallSheet {
  return { id: `call-${crewMemberId}`, crewMemberId } as CrewCallSheet
}

function setHooks(opts: {
  crewData?: CrewRecord[]
  crewLoading?: boolean
  callsData?: CrewCallSheet[]
}) {
  mockCrew.mockReturnValue({
    data: opts.crewData ?? [],
    loading: opts.crewLoading ?? false,
    error: null,
  })
  mockCalls.mockReturnValue({
    data: opts.callsData ?? [],
    loading: false,
    error: null,
  })
}

// Schedules are now passed in as a prop (fetched once by ProjectHomePage),
// not via a hook subscription inside CrewRoster.
function renderRoster(
  opts: { schedules?: Schedule[]; schedulesLoading?: boolean } = {},
) {
  return render(
    <MemoryRouter>
      <CrewRoster
        clientId="c1"
        projectId="p1"
        schedules={opts.schedules ?? []}
        schedulesLoading={opts.schedulesLoading ?? false}
      />
    </MemoryRouter>,
  )
}

describe("CrewRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders a loading skeleton while crew is loading", () => {
    setHooks({ crewLoading: true })
    renderRoster()
    expect(screen.getByTestId("crew-roster-loading")).toBeInTheDocument()
    expect(screen.queryByTestId("crew-roster-row")).not.toBeInTheDocument()
  })

  it("degrades to an empty state when there is no crew", () => {
    setHooks({ crewData: [] })
    renderRoster()
    expect(screen.getByText(/no crew yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId("crew-roster-row")).not.toBeInTheDocument()
  })

  it("lists crew members with role and name", () => {
    setHooks({
      crewData: [
        crew({ id: "a", name: "Sarah Kemp", position: "Producer" }),
        crew({ id: "b", name: "Devon Reyes", department: "Camera" }),
      ],
    })
    renderRoster()
    const rows = screen.getAllByTestId("crew-roster-row")
    expect(rows).toHaveLength(2)
    expect(screen.getByText("Sarah Kemp")).toBeInTheDocument()
    expect(screen.getByText("Producer")).toBeInTheDocument()
    expect(screen.getByText("Devon Reyes")).toBeInTheDocument()
    expect(screen.getByText("Camera")).toBeInTheDocument()
  })

  it("marks on-call status when the project has a schedule", () => {
    setHooks({
      crewData: [
        crew({ id: "a", name: "Sarah Kemp", position: "Producer" }),
        crew({ id: "b", name: "Devon Reyes", position: "Photographer" }),
      ],
      callsData: [call("a")],
    })
    renderRoster({ schedules: [schedule("s1")] })
    expect(screen.getByText("On call")).toBeInTheDocument()
    expect(screen.getByText("Not scheduled")).toBeInTheDocument()
    expect(screen.getByText(/1 on call/)).toBeInTheDocument()
  })

  it("degrades to a plain roster (no call status) when there is no schedule", () => {
    setHooks({
      crewData: [crew({ id: "a", name: "Sarah Kemp", position: "Producer" })],
    })
    renderRoster({ schedules: [] })
    expect(screen.getByText("Sarah Kemp")).toBeInTheDocument()
    expect(screen.queryByText("On call")).not.toBeInTheDocument()
    expect(screen.queryByText("Not scheduled")).not.toBeInTheDocument()
    expect(screen.getByText(/call status appears once a call sheet is built/i)).toBeInTheDocument()
  })

  it("derives initials from first/last name when present", () => {
    setHooks({
      crewData: [crew({ id: "a", name: "Sarah Kemp", firstName: "Sarah", lastName: "Kemp" })],
    })
    renderRoster()
    expect(screen.getByText("SK")).toBeInTheDocument()
  })
})
