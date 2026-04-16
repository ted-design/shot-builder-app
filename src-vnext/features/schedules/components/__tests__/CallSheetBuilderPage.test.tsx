import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type React from "react"
import CallSheetBuilderPage from "@/features/schedules/components/CallSheetBuilderPage"
import { DEFAULT_SECTION_ORDER, type SectionKey } from "@/features/schedules/components/CallSheetRenderer"
import type { Schedule, DayDetails } from "@/shared/types"

// --- Mock data ---

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
  tracks: [],
}

const mockDayDetails: DayDetails = {
  id: "dd-1",
  location: null,
  parkingNotes: null,
  nearestHospital: null,
  covidProtocol: null,
  notes: null,
}

// --- Provider mocks ---

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "client-1", role: "producer" }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "proj-1", projectName: "Test Project" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/shared/lib/rbac", () => ({
  canManageSchedules: () => true,
}))

// --- Data hook mocks ---

const setSectionOrderMock = vi.fn().mockResolvedValue(undefined)

vi.mock("@/features/schedules/hooks/useCallSheetBundle", () => ({
  useCallSheetBundle: () => ({
    schedule: mockSchedule,
    dayDetails: mockDayDetails,
    entries: [],
    talentCalls: [],
    crewCalls: [],
    callSheet: {
      raw: null,
      config: {
        sections: {
          header: true,
          dayDetails: true,
          schedule: true,
          talent: true,
          crew: true,
          notes: true,
        },
        scheduleBlockFields: {},
        colors: {},
        headerLayout: "legacy",
        fieldConfigs: {},
        sectionOrder: DEFAULT_SECTION_ORDER,
      },
      loading: false,
      error: null,
      setSectionVisibility: vi.fn().mockResolvedValue(undefined),
      setScheduleBlockFields: vi.fn().mockResolvedValue(undefined),
      setColors: vi.fn().mockResolvedValue(undefined),
      setHeaderLayout: vi.fn().mockResolvedValue(undefined),
      setSectionFieldConfig: vi.fn().mockResolvedValue(undefined),
      setSectionOrder: setSectionOrderMock,
    },
    error: null,
    loading: false,
    loadingFlags: {
      schedule: false,
      dayDetails: false,
      entries: false,
      talentCalls: false,
      crewCalls: false,
      config: false,
    },
  }),
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/schedules/hooks/useCrew", () => ({
  useCrew: () => ({ data: [], loading: false, error: null }),
}))

// --- Heavyweight child mocks (stub to simple markers) ---

vi.mock("@/features/schedules/components/CallSheetRenderer", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/schedules/components/CallSheetRenderer")
  >("@/features/schedules/components/CallSheetRenderer")
  return {
    ...actual,
    CallSheetRenderer: () => <div data-testid="call-sheet-renderer" />,
  }
})

vi.mock("@/features/schedules/components/DayDetailsEditor", () => ({
  DayDetailsEditor: () => <div data-testid="day-details-editor" />,
}))

vi.mock("@/features/schedules/components/AdaptiveTimelineView", () => ({
  AdaptiveTimelineView: () => <div data-testid="adaptive-timeline" />,
}))

vi.mock("@/features/schedules/components/ScheduleTrackControls", () => ({
  ScheduleTrackControls: () => <div data-testid="schedule-track-controls" />,
}))

vi.mock("@/features/schedules/components/CallOverridesEditor", () => ({
  CallOverridesEditor: () => <div data-testid="call-overrides-editor" />,
}))

vi.mock("@/features/schedules/components/CallSheetOutputControls", () => ({
  CallSheetOutputControls: () => <div data-testid="call-sheet-output-controls" />,
}))

vi.mock("@/features/schedules/components/CallSheetPrintPortal", () => ({
  CallSheetPrintPortal: () => <div data-testid="call-sheet-print-portal" />,
}))

vi.mock("@/features/schedules/components/TrustChecks", () => ({
  TrustChecks: () => <div data-testid="trust-checks" />,
}))

vi.mock("@/features/schedules/components/OnSetViewer", () => ({
  OnSetViewer: () => <div data-testid="onset-viewer" />,
}))

vi.mock("@/features/schedules/components/ScheduleListPage", () => ({
  default: () => <div data-testid="schedule-list-page" />,
}))

vi.mock("@/features/schedules/components/SectionOrderDialog", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/schedules/components/SectionOrderDialog")
  >("@/features/schedules/components/SectionOrderDialog")
  return {
    ...actual,
    // Replace with a lightweight controllable stub so we don't need to
    // exercise the dnd-kit internals inside this page-level test.
    SectionOrderDialog: ({
      open,
      onOpenChange,
      onSave,
    }: {
      readonly open: boolean
      readonly onOpenChange: (open: boolean) => void
      readonly sectionOrder: readonly SectionKey[]
      readonly onSave: (order: readonly SectionKey[]) => void
    }) =>
      open ? (
        <div role="dialog" aria-label="Section Order">
          <button
            type="button"
            onClick={() => {
              onSave(["notes", "crew", "talent", "schedule", "dayDetails", "header"])
              onOpenChange(false)
            }}
          >
            Save Order
          </button>
          <button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
        </div>
      ) : null,
  }
})

vi.mock("@/shared/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/shared/components/LoadingState", () => ({
  LoadingState: ({ loading }: { readonly loading: boolean }) =>
    loading ? <div data-testid="loading-state" /> : null,
}))

vi.mock("@/shared/components/Skeleton", () => ({
  DetailPageSkeleton: () => <div data-testid="detail-skeleton" />,
}))

vi.mock("@/shared/components/EmptyState", () => ({
  EmptyState: ({ title }: { readonly title: string }) => (
    <div data-testid="empty-state">{title}</div>
  ),
}))

vi.mock("@/shared/components/InlineEdit", () => ({
  InlineEdit: ({ value }: { readonly value: string }) => <span>{value}</span>,
}))

vi.mock("@/shared/components/PageHeader", () => ({
  PageHeader: ({ title }: { readonly title: React.ReactNode }) => <h1>{title}</h1>,
}))

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// --- Helpers ---

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/proj-1/callsheet?scheduleId=sched-1"]}>
      <Routes>
        <Route
          path="/projects/:id/callsheet"
          element={<CallSheetBuilderPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// --- Tests ---

describe("CallSheetBuilderPage — Section Order wiring", () => {
  beforeEach(() => {
    setSectionOrderMock.mockClear()
  })

  it("renders a Section Order trigger button in the builder header", () => {
    renderPage()

    expect(
      screen.getByRole("button", { name: /section order/i }),
    ).toBeInTheDocument()
  })

  it("opens the SectionOrderDialog when the trigger is clicked", async () => {
    const user = userEvent.setup()
    renderPage()

    expect(
      screen.queryByRole("dialog", { name: /section order/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /section order/i }))

    expect(
      screen.getByRole("dialog", { name: /section order/i }),
    ).toBeInTheDocument()
  })

  it("persists a new order through setSectionOrder when the dialog saves", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /section order/i }))
    await user.click(screen.getByRole("button", { name: /save order/i }))

    expect(setSectionOrderMock).toHaveBeenCalledTimes(1)
    expect(setSectionOrderMock).toHaveBeenCalledWith([
      "notes",
      "crew",
      "talent",
      "schedule",
      "dayDetails",
      "header",
    ])
  })
})
