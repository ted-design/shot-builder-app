/// <reference types="@testing-library/jest-dom" />
// Phase 5a characterization pin (build spec, Test plan 1d).
//
// Pins TODAY's ThreePanelCanvasPanel lifecycle gate, against unchanged source:
// the lifecycle actions menu renders behind `canDoOperational`, which the
// parent ThreePanelLayout derives from canManageShots(role) — so CREW see the
// lifecycle menu here, while the detail page gates it admin/producer-only.
// This is the divergence the 5a Editor phase converges (strict: lifecycle =
// admin || producer, spec invariant 6). Red→green diff on this pin makes the
// crew capability delta explicit in the PR.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import { canManageShots, ROLE } from "@/shared/lib/rbac"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "crew", clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: () => <div>Hero</div>,
}))

vi.mock("@/features/shots/components/ActiveLookCoverReferencesPanel", () => ({
  ActiveLookCoverReferencesPanel: () => <div>CoverRefs</div>,
}))

vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: () => <div>Notes</div>,
}))

vi.mock("@/features/shots/components/ShotReferenceLinksSection", () => ({
  ShotReferenceLinksSection: () => <div>RefLinks</div>,
}))

vi.mock("@/features/shots/components/ProductSummaryStrip", () => ({
  ProductSummaryStrip: () => <div>ProductStrip</div>,
}))

vi.mock("@/features/shots/components/ActiveEditorsBar", () => ({
  ActiveEditorsBar: () => null,
  CompactActiveEditors: () => null,
}))

// Behavior-free stub that records the disabled prop the panel passes today.
vi.mock("@/features/shots/components/ShotLifecycleActionsMenu", () => ({
  ShotLifecycleActionsMenu: ({ disabled }: { readonly disabled?: boolean }) => (
    <div data-testid="lifecycle-actions-stub" data-disabled={String(disabled)}>
      Lifecycle
    </div>
  ),
}))

import { ThreePanelCanvasPanel } from "@/features/shots/components/ThreePanelCanvasPanel"

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

function renderPanel(props: {
  readonly canEdit: boolean
  readonly canDoOperational: boolean
}) {
  return render(
    <MemoryRouter>
      <ThreePanelCanvasPanel
        shot={makeShot({})}
        save={vi.fn(() => Promise.resolve(true))}
        canEdit={props.canEdit}
        canDoOperational={props.canDoOperational}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe("ThreePanelCanvasPanel lifecycle gate (pre-5a pin)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the lifecycle menu for CREW (canDoOperational gate, crew-inclusive today)", () => {
    // The parent ThreePanelLayout computes canDoOperational = canManageShots(role),
    // which INCLUDES crew — assert that premise so the pin can't silently drift.
    expect(canManageShots(ROLE.CREW)).toBe(true)

    renderPanel({ canEdit: true, canDoOperational: canManageShots(ROLE.CREW) })

    const menu = screen.getByTestId("lifecycle-actions-stub")
    expect(menu).toBeInTheDocument()
    // Today's call site passes disabled={!canDoOperational} → enabled for crew.
    expect(menu).toHaveAttribute("data-disabled", "false")
  })

  it("hides the lifecycle menu when canDoOperational is false (viewer)", () => {
    expect(canManageShots(ROLE.VIEWER)).toBe(false)

    renderPanel({ canEdit: false, canDoOperational: canManageShots(ROLE.VIEWER) })

    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
  })
})
