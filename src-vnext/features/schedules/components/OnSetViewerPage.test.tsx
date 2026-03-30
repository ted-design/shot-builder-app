import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import OnSetViewerPage from "@/features/schedules/components/OnSetViewerPage"
import type { Schedule, DayDetails, ScheduleEntry, CrewRecord } from "@/shared/types"

// --- Shared mock data ---

const mockSchedule: Schedule = {
  id: "sched-1",
  name: "Day 1",
  date: { toDate: () => new Date("2026-04-01") } as never,
  projectId: "proj-1",
  clientId: "client-1",
  status: "draft",
  generalCall: "07:00",
  wrapTime: null,
  notes: null,
}

const mockDayDetails: DayDetails = {
  id: "dd-1",
  location: null,
  parkingNotes: null,
  nearestHospital: null,
  covidProtocol: null,
  notes: null,
}

const mockEntries: ScheduleEntry[] = []
const mockCrew: CrewRecord[] = []

// --- Mocks ---

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "client-1", role: "crew" }),
}))

vi.mock("@/features/schedules/hooks/useSchedule", () => ({
  useSchedule: vi.fn(),
}))

vi.mock("@/features/schedules/hooks/useScheduleDayDetails", () => ({
  useScheduleDayDetails: vi.fn(),
}))

vi.mock("@/features/schedules/hooks/useScheduleEntries", () => ({
  useScheduleEntries: vi.fn(),
}))

vi.mock("@/features/schedules/hooks/useCrew", () => ({
  useCrew: vi.fn(),
}))

vi.mock("@/features/schedules/components/OnSetViewer", () => ({
  OnSetViewer: ({
    schedule,
  }: {
    readonly schedule: Schedule
    readonly dayDetails: DayDetails | null
    readonly entries: ScheduleEntry[]
    readonly crewLibrary: CrewRecord[]
  }) => <div data-testid="onset-viewer">{schedule.name}</div>,
}))

vi.mock("@/shared/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { readonly children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/shared/components/LoadingState", () => ({
  LoadingState: ({ loading }: { readonly loading: boolean }) =>
    loading ? <div data-testid="loading-state" /> : null,
}))

vi.mock("@/shared/components/Skeleton", () => ({
  DetailPageSkeleton: () => <div data-testid="detail-skeleton" />,
}))

vi.mock("@/shared/components/EmptyState", () => ({
  EmptyState: ({
    title,
    description,
  }: {
    readonly icon?: React.ReactNode
    readonly title: string
    readonly description: string
    readonly actionLabel?: string
    readonly onAction?: () => void
  }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}))

// --- Helpers ---

import { useSchedule } from "@/features/schedules/hooks/useSchedule"
import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { useCrew } from "@/features/schedules/hooks/useCrew"
import type React from "react"

const mockedUseSchedule = vi.mocked(useSchedule)
const mockedUseScheduleDayDetails = vi.mocked(useScheduleDayDetails)
const mockedUseScheduleEntries = vi.mocked(useScheduleEntries)
const mockedUseCrew = vi.mocked(useCrew)

function setupReadyMocks() {
  mockedUseSchedule.mockReturnValue({
    data: mockSchedule,
    loading: false,
    error: null,
  })
  mockedUseScheduleDayDetails.mockReturnValue({
    data: mockDayDetails,
    loading: false,
    error: null,
  })
  mockedUseScheduleEntries.mockReturnValue({
    data: mockEntries,
    loading: false,
    error: null,
  })
  mockedUseCrew.mockReturnValue({
    data: mockCrew,
    loading: false,
    error: null,
  })
}

function renderPage(scheduleId = "sched-1") {
  return render(
    <MemoryRouter
      initialEntries={[`/projects/proj-1/schedules/${scheduleId}/onset`]}
    >
      <Routes>
        <Route
          path="/projects/:id/schedules/:scheduleId/onset"
          element={<OnSetViewerPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// --- Tests ---

describe("OnSetViewerPage", () => {
  it("shows loading state while data is fetching", () => {
    mockedUseSchedule.mockReturnValue({ data: null, loading: true, error: null })
    mockedUseScheduleDayDetails.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    })
    mockedUseScheduleEntries.mockReturnValue({
      data: [],
      loading: true,
      error: null,
    })
    mockedUseCrew.mockReturnValue({ data: [], loading: true, error: null })

    renderPage()

    expect(screen.getByTestId("loading-state")).toBeInTheDocument()
    expect(screen.queryByTestId("onset-viewer")).not.toBeInTheDocument()
  })

  it("renders OnSetViewer when data is ready", () => {
    setupReadyMocks()

    renderPage()

    expect(screen.getByTestId("onset-viewer")).toBeInTheDocument()
    expect(screen.getByText("Day 1")).toBeInTheDocument()
  })

  it("shows error message when schedule fetch fails", () => {
    mockedUseSchedule.mockReturnValue({
      data: null,
      loading: false,
      error: "Permission denied",
    })
    mockedUseScheduleDayDetails.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
    mockedUseScheduleEntries.mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    mockedUseCrew.mockReturnValue({ data: [], loading: false, error: null })

    renderPage()

    expect(screen.getByText("Permission denied")).toBeInTheDocument()
    expect(screen.queryByTestId("onset-viewer")).not.toBeInTheDocument()
  })

  it("shows empty state when schedule is not found", () => {
    mockedUseSchedule.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
    mockedUseScheduleDayDetails.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
    mockedUseScheduleEntries.mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    mockedUseCrew.mockReturnValue({ data: [], loading: false, error: null })

    renderPage()

    expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    expect(screen.getByText("Schedule not found")).toBeInTheDocument()
    expect(screen.queryByTestId("onset-viewer")).not.toBeInTheDocument()
  })

  it("passes crewLibrary from useCrew to OnSetViewer", () => {
    const crewWithData: CrewRecord[] = [
      {
        id: "crew-1",
        name: "Alice Smith",
        role: "DOP",
        phone: null,
        email: null,
        department: null,
      },
    ]
    mockedUseSchedule.mockReturnValue({
      data: mockSchedule,
      loading: false,
      error: null,
    })
    mockedUseScheduleDayDetails.mockReturnValue({
      data: mockDayDetails,
      loading: false,
      error: null,
    })
    mockedUseScheduleEntries.mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    mockedUseCrew.mockReturnValue({
      data: crewWithData,
      loading: false,
      error: null,
    })

    renderPage()

    expect(screen.getByTestId("onset-viewer")).toBeInTheDocument()
  })
})
