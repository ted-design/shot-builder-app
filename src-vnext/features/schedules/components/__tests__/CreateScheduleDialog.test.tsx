import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CreateScheduleDialog } from "@/features/schedules/components/CreateScheduleDialog"

// --- Write mock ---

const createScheduleMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("sched-new"),
)

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  createSchedule: createScheduleMock,
}))

vi.mock("firebase/firestore", () => ({
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}))

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

// --- Helpers ---

function renderDialog() {
  return render(
    <CreateScheduleDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />,
  )
}

async function fillNameAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Name"), "Day 1")
  await user.click(screen.getByRole("button", { name: "Create" }))
}

// --- Tests ---

describe("CreateScheduleDialog — effective role guard (5b)", () => {
  beforeEach(() => {
    createScheduleMock.mockClear()
    effectiveState.role = null
    effectiveState.resolving = false
  })

  it("creates the schedule when the effective role mirrors the global producer claim", async () => {
    renderDialog()
    await fillNameAndSubmit()

    expect(createScheduleMock).toHaveBeenCalledTimes(1)
    expect(createScheduleMock).toHaveBeenCalledWith("client-1", "proj-1", {
      name: "Day 1",
      date: null,
    })
  })

  it("does not write while the effective role is resolving", async () => {
    effectiveState.resolving = true
    renderDialog()
    await fillNameAndSubmit()

    expect(createScheduleMock).not.toHaveBeenCalled()
  })

  it("does not write when the project member doc downgrades the role to viewer", async () => {
    effectiveState.role = "viewer"
    renderDialog()
    await fillNameAndSubmit()

    expect(createScheduleMock).not.toHaveBeenCalled()
  })
})
