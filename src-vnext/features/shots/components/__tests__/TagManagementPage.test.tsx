/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

// 5b test convention: hoisted mutable state — effectiveState.role null means
// "mirror the global claim" (default matrix), a string overrides it
// (downgrade rows), resolving=true pins the first-read gap.
const authState = vi.hoisted(() => ({ role: "producer" }))
const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", role: authState.role }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role ?? authState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project One" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project One" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
}))

vi.mock("@/features/shots/lib/tagManagementWrites", () => ({
  renameTagAcrossShots: vi.fn(),
  recolorTagAcrossShots: vi.fn(),
  deleteTagAcrossShots: vi.fn(),
  mergeTagsAcrossShots: vi.fn(),
}))

import { useShots } from "@/features/shots/hooks/useShots"
import { renameTagAcrossShots } from "@/features/shots/lib/tagManagementWrites"
import TagManagementPage from "@/features/shots/components/TagManagementPage"

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
    description: overrides.description,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    looks: overrides.looks,
    activeLookId: overrides.activeLookId,
    tags: overrides.tags,
    deleted: overrides.deleted ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TagManagementPage />
    </MemoryRouter>,
  )
}

function setShots(shots: readonly Shot[]) {
  ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: shots,
    loading: false,
    error: null,
  })
}

const taggedShot = () =>
  makeShot({
    id: "s1",
    tags: [{ id: "tag-1", label: "Outdoor", color: "blue" }],
  })

describe("TagManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
    effectiveState.role = null
    effectiveState.resolving = false
  })

  it("renames a tag across shots from the Details panel", async () => {
    const user = userEvent.setup()
    const shots = [
      makeShot({
        id: "s1",
        tags: [{ id: "tag-1", label: "Outdoor", color: "blue" }],
      }),
    ]

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: shots,
      loading: false,
      error: null,
    })

    ;(renameTagAcrossShots as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      1,
    )

    renderPage()

    await user.click(screen.getAllByText("Outdoor")[0]!)

    const nameField = within(screen.getByTestId("tag-details-name")).getByText("Outdoor")
    await user.click(nameField)

    const input = screen.getByDisplayValue("Outdoor")
    fireEvent.change(input, { target: { value: "Outdoor 2" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(renameTagAcrossShots).toHaveBeenCalledTimes(1)
    })

    expect(renameTagAcrossShots).toHaveBeenCalledWith({
      clientId: "c1",
      shots,
      tagId: "tag-1",
      nextLabel: "Outdoor 2",
    })
  })

  it("renders tag-write affordances when the effective role mirrors the global producer claim", async () => {
    const user = userEvent.setup()
    setShots([taggedShot()])

    renderPage()

    // Merge checkboxes render only for canEdit roles.
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0)

    await user.click(screen.getAllByText("Outdoor")[0]!)
    expect(screen.getByRole("button", { name: /delete/i })).toBeEnabled()

    // No per-project downgrade → the chip renders nothing.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders no tag-write affordances while the effective role is resolving", async () => {
    const user = userEvent.setup()
    effectiveState.resolving = true
    setShots([taggedShot()])

    renderPage()

    // The first uncached member read is in flight: never show the
    // global-role guess.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)

    await user.click(screen.getAllByText("Outdoor")[0]!)
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled()

    // The chip is also quiet while resolving.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("hides tag-write affordances when the project member doc downgrades a global producer to viewer", async () => {
    const user = userEvent.setup()
    effectiveState.role = "viewer"
    setShots([taggedShot()])

    renderPage()

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)

    await user.click(screen.getAllByText("Outdoor")[0]!)
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled()

    // The downgrade is surfaced quietly in the header.
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent(
      "Viewer on this project",
    )
  })

  it("keeps tag-write affordances when the member doc promotes a global viewer to producer", () => {
    authState.role = "viewer"
    effectiveState.role = "producer"
    setShots([taggedShot()])

    renderPage()

    // Project role WINS over the global claim, including upgrades (locked
    // Q5/Q6) — the /shots update arm is project-scoped, so the affordance
    // is honest here (unlike the pinned global-rule surfaces).
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0)
    // Upgrades render no chip (downgrade-only indicator).
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })
})
