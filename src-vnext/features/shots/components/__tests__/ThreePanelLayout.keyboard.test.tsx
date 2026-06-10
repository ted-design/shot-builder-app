/// <reference types="@testing-library/jest-dom" />
// Phase 5a characterization pin (build spec, Test plan 1c).
//
// Pins ThreePanelLayout keyboard behavior:
//   - 1-4 keys write the matching STATUS_CYCLE status via updateShotWithVersion
//     (source "ThreePanelLayout:keyboard") for roles with canDoOperational
//     (canManageShots: admin/producer/crew). Viewers NO-OP — the Core 5a phase
//     closed the previously-pinned ungated hole with the canDoOperational
//     early return (flag-independent fix, spec invariant 3); the viewer pin
//     below was flipped red→green to the new behavior in the same commit.
//   - [ / ] move selection through the `shots` prop order via onSelectShot.
//   - Escape calls onDeselect.
//   - Deleted-shot guard: a soft-deleted selected shot deselects with a toast.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "producer" }))

vi.mock("@/features/shots/hooks/useShot", () => ({
  useShot: vi.fn(),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsDesktop: () => true,
}))

// Panels are not under test — keyboard handling lives in ThreePanelLayout.
vi.mock("react-resizable-panels", () => ({
  PanelGroup: ({ children }: { readonly children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Panel: ({ children }: { readonly children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PanelResizeHandle: () => null,
}))

vi.mock("@/features/shots/components/ThreePanelListPanel", () => ({
  ThreePanelListPanel: () => <div data-testid="list-panel-stub" />,
}))

vi.mock("@/features/shots/components/ThreePanelCanvasPanel", () => ({
  ThreePanelCanvasPanel: () => <div data-testid="canvas-panel-stub" />,
}))

vi.mock("@/features/shots/components/ThreePanelPropertiesPanel", () => ({
  ThreePanelPropertiesPanel: () => <div data-testid="properties-panel-stub" />,
}))

vi.mock("@/features/shots/components/ShotsShareDialog", () => ({
  ShotsShareDialog: () => null,
}))

vi.mock("@/features/shots/components/SceneDetailSheet", () => ({
  SceneDetailSheet: () => null,
}))

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import { useShot } from "@/features/shots/hooks/useShot"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { ThreePanelLayout } from "@/features/shots/components/ThreePanelLayout"
import { toast } from "sonner"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

const SHOTS: ReadonlyArray<Shot> = [
  makeShot({ id: "s1", title: "First", sortOrder: 0 }),
  makeShot({ id: "s2", title: "Second", sortOrder: 1 }),
  makeShot({ id: "s3", title: "Third", sortOrder: 2 }),
]

function mockSelectedShot(overrides: Partial<Shot> = {}) {
  ;(useShot as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: makeShot({ id: "s2", title: "Second", ...overrides }),
    loading: false,
    error: null,
  })
}

function renderLayout(props: {
  readonly selectedShotId?: string
  readonly onDeselect?: () => void
  readonly onSelectShot?: (shotId: string) => void
} = {}) {
  return render(
    <MemoryRouter>
      <ThreePanelLayout
        selectedShotId={props.selectedShotId ?? "s2"}
        shots={SHOTS}
        allShots={SHOTS}
        showCreate
        onDeselect={props.onDeselect ?? vi.fn()}
        onSelectShot={props.onSelectShot ?? vi.fn()}
      />
    </MemoryRouter>,
  )
}

function pressKey(key: string) {
  fireEvent.keyDown(document.body, { key })
}

describe("ThreePanelLayout keyboard (pre-5a pin)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    authState.role = "producer"
  })

  it("writes the matching STATUS_CYCLE status for keys 2-4 and no-ops on the current status key", () => {
    mockSelectedShot({ status: "todo" })
    renderLayout()

    pressKey("2")
    expect(updateShotWithVersion).toHaveBeenCalledTimes(1)
    expect(updateShotWithVersion).toHaveBeenLastCalledWith({
      clientId: "c1",
      shotId: "s2",
      patch: { status: "in_progress" },
      shot: expect.objectContaining({ id: "s2", status: "todo" }),
      user: { uid: "u1" },
      source: "ThreePanelLayout:keyboard",
    })

    pressKey("3")
    expect(updateShotWithVersion).toHaveBeenCalledTimes(2)
    expect(updateShotWithVersion).toHaveBeenLastCalledWith(
      expect.objectContaining({ patch: { status: "on_hold" } }),
    )

    pressKey("4")
    expect(updateShotWithVersion).toHaveBeenCalledTimes(3)
    expect(updateShotWithVersion).toHaveBeenLastCalledWith(
      expect.objectContaining({ patch: { status: "complete" } }),
    )

    // "1" maps to "todo" — same as current status, so no write.
    pressKey("1")
    expect(updateShotWithVersion).toHaveBeenCalledTimes(3)
  })

  it("NO-OPs all of 1-4 for a VIEWER role (canDoOperational gate, flag-independent 5a fix)", () => {
    authState.role = "viewer"
    mockSelectedShot({ status: "todo" })
    renderLayout()

    pressKey("1")
    pressKey("2")
    pressKey("3")
    pressKey("4")

    // handleStatusKey early-returns unless canDoOperational (canManageShots:
    // admin/producer/crew). A viewer keypress must never reach
    // updateShotWithVersion.
    expect(updateShotWithVersion).not.toHaveBeenCalled()
  })

  it("moves selection through the shots prop order with ] and [", () => {
    mockSelectedShot()
    const onSelectShot = vi.fn()
    renderLayout({ selectedShotId: "s2", onSelectShot })

    pressKey("]")
    expect(onSelectShot).toHaveBeenCalledTimes(1)
    expect(onSelectShot).toHaveBeenLastCalledWith("s3")

    pressKey("[")
    expect(onSelectShot).toHaveBeenCalledTimes(2)
    expect(onSelectShot).toHaveBeenLastCalledWith("s1")
  })

  it("does not navigate past the ends of the shots order", () => {
    mockSelectedShot({ id: "s3" })
    const onSelectShot = vi.fn()
    renderLayout({ selectedShotId: "s3", onSelectShot })

    pressKey("]")
    expect(onSelectShot).not.toHaveBeenCalled()
  })

  it("deselects on Escape", () => {
    mockSelectedShot()
    const onDeselect = vi.fn()
    renderLayout({ onDeselect })

    pressKey("Escape")
    expect(onDeselect).toHaveBeenCalledTimes(1)
  })

  it("deselects with a toast when the selected shot is soft-deleted", () => {
    mockSelectedShot({ deleted: true })
    const onDeselect = vi.fn()
    renderLayout({ onDeselect })

    expect(toast.info).toHaveBeenCalledWith("This shot has been deleted")
    expect(onDeselect).toHaveBeenCalledTimes(1)
  })
})
