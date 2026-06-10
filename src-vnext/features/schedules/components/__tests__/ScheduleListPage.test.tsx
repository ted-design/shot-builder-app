import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type React from "react"
import ScheduleListPage from "@/features/schedules/components/ScheduleListPage"
import type { Schedule } from "@/shared/types"

// --- Mock data ---

const mockSchedules: Schedule[] = [
  {
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
  },
]

// --- Provider mocks ---

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "client-1", role: "producer", loading: false }),
}))

// 5b: hoisted mutable effective-role state. role=null mirrors the global
// claim (default matrix); a string overrides it (downgrade rows);
// resolving=true pins the first-member-read gap.
const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role ?? "producer",
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "proj-1", projectName: "Test Project" }),
}))

// --- Data hook mocks ---

vi.mock("@/features/schedules/hooks/useSchedules", () => ({
  useSchedules: () => ({ data: mockSchedules, loading: false, error: null }),
}))

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
}))

// --- Child component stubs ---

vi.mock("@/features/schedules/components/ScheduleCard", () => ({
  ScheduleCard: ({
    canManage,
    canDelete,
  }: {
    readonly canManage: boolean
    readonly canDelete: boolean
  }) => (
    <div
      data-testid="schedule-card"
      data-can-manage={String(canManage)}
      data-can-delete={String(canDelete)}
    />
  ),
}))

vi.mock("@/features/schedules/components/CreateScheduleDialog", () => ({
  CreateScheduleDialog: () => <div data-testid="create-schedule-dialog" />,
}))

vi.mock("@/features/schedules/components/EditScheduleDialog", () => ({
  EditScheduleDialog: () => <div data-testid="edit-schedule-dialog" />,
}))

vi.mock("@/shared/components/ConfirmDialog", () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog" />,
}))

vi.mock("@/shared/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/shared/components/PageHeader", () => ({
  PageHeader: ({
    title,
    actions,
  }: {
    readonly title: React.ReactNode
    readonly actions?: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
    </div>
  ),
}))

vi.mock("@/shared/components/EmptyState", () => ({
  EmptyState: ({ title }: { readonly title: string }) => (
    <div data-testid="empty-state">{title}</div>
  ),
}))

vi.mock("@/shared/components/LoadingState", () => ({
  LoadingState: ({ loading }: { readonly loading: boolean }) =>
    loading ? <div data-testid="loading-state" /> : null,
}))

vi.mock("@/shared/components/Skeleton", () => ({
  ListPageSkeleton: () => <div data-testid="list-skeleton" />,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// --- Helpers ---

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/proj-1/schedules"]}>
      <ScheduleListPage />
    </MemoryRouter>,
  )
}

// --- Tests ---

describe("ScheduleListPage — effective role wiring (5b)", () => {
  beforeEach(() => {
    effectiveState.role = null
    effectiveState.resolving = false
  })

  it("shows manage affordances when the effective role mirrors the global producer claim", () => {
    renderPage()

    expect(
      screen.getByRole("button", { name: /new call sheet/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("schedule-card")).toHaveAttribute(
      "data-can-manage",
      "true",
    )
    // No downgrade — the chip stays hidden.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders no manage affordances while the effective role is resolving", () => {
    effectiveState.resolving = true
    renderPage()

    expect(
      screen.queryByRole("button", { name: /new call sheet/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("schedule-card")).toHaveAttribute(
      "data-can-manage",
      "false",
    )
    // The chip self-gates while resolving.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("project downgrade to viewer hides manage affordances and shows the role chip", () => {
    effectiveState.role = "viewer"
    renderPage()

    expect(
      screen.queryByRole("button", { name: /new call sheet/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("schedule-card")).toHaveAttribute(
      "data-can-manage",
      "false",
    )
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent(
      "Viewer on this project",
    )
  })

  it("effective crew gets no manage affordances (schedules are producer/warehouse-gated)", () => {
    // Member doc says crew: schedules are producer-only — still read-only.
    effectiveState.role = "crew"
    renderPage()

    expect(
      screen.queryByRole("button", { name: /new call sheet/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("schedule-card")).toHaveAttribute(
      "data-can-manage",
      "false",
    )
  })

  it("producer can manage but not delete (the /schedules delete arm is admin-only)", () => {
    renderPage()

    const card = screen.getByTestId("schedule-card")
    expect(card).toHaveAttribute("data-can-manage", "true")
    expect(card).toHaveAttribute("data-can-delete", "false")
  })

  it("admin gets the delete affordance", () => {
    effectiveState.role = "admin"
    renderPage()

    expect(screen.getByTestId("schedule-card")).toHaveAttribute(
      "data-can-delete",
      "true",
    )
  })
})
