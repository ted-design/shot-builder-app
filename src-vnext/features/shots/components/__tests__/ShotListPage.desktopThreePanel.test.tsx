/// <reference types="@testing-library/jest-dom" />
// Phase 5a characterization pin (build spec, Test plan 1a).
//
// Pins TODAY's desktop click behavior on ShotListPage, against unchanged
// source: on desktop (useIsDesktop=true), clicking a shot SELECTS it into the
// three-panel layout (ShotListPage.tsx handleShotClick desktop branch +
// threePanelActive early return) and does NOT navigate to the detail route.
// Nothing pinned this before — ShotListPage.test.tsx forces useIsDesktop=false.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: [], loading: false, error: null }),
  useLocations: () => ({ data: [], loading: false, error: null }),
  useProductFamilies: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1" }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

// Desktop: the branch the legacy ShotListPage.test.tsx never exercises.
vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsDesktop: () => true,
}))

vi.mock("@/features/shots/components/ShotStatusSelect", () => ({
  ShotStatusSelect: ({ currentStatus }: { readonly currentStatus: string }) => (
    <span>status:{currentStatus}</span>
  ),
}))

vi.mock("@/features/shots/components/CreateShotDialog", () => ({
  CreateShotDialog: () => null,
}))

vi.mock("@/features/pulls/components/CreatePullFromShotsDialog", () => ({
  CreatePullFromShotsDialog: () => null,
}))

// Stub the three-panel layout: this pin is about ShotListPage's click routing,
// not the panel internals.
vi.mock("@/features/shots/components/ThreePanelLayout", () => ({
  ThreePanelLayout: ({ selectedShotId }: { readonly selectedShotId: string }) => (
    <div data-testid="three-panel-layout-stub">selected:{selectedShotId}</div>
  ),
}))

import { useShots } from "@/features/shots/hooks/useShots"
import ShotListPage from "@/features/shots/components/ShotListPage"

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
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    referenceLinks: overrides.referenceLinks,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:id/shots" element={<ShotListPage />} />
        <Route path="/projects/:id/shots/:sid" element={<div>Shot detail route</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShotListPage desktop click (three-panel pin)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it("selects the shot into the three-panel layout instead of navigating", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    // Sanity: three-panel not mounted before any selection.
    expect(screen.queryByTestId("three-panel-layout-stub")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Alpha"))

    // Desktop click SELECTS (three-panel early return renders)...
    expect(screen.getByTestId("three-panel-layout-stub")).toBeInTheDocument()
    expect(screen.getByText("selected:a")).toBeInTheDocument()
    // ...and does NOT navigate to the detail route.
    expect(screen.queryByText("Shot detail route")).not.toBeInTheDocument()
  })

  it("replaces the list chrome while three-panel is active (early return)", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    expect(screen.getByRole("button", { name: /New Shot/ })).toBeInTheDocument()

    fireEvent.click(screen.getByText("Alpha"))

    // The early return swaps the entire page body for ThreePanelLayout.
    expect(screen.queryByRole("button", { name: /New Shot/ })).not.toBeInTheDocument()
    expect(screen.getByTestId("three-panel-layout-stub")).toBeInTheDocument()
  })
})
