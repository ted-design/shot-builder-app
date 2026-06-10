/// <reference types="@testing-library/jest-dom" />
// Phase 5a fork A (build spec, "TWO coupled flag forks").
//
// Flag-ON counterpart of ShotListPage.desktopThreePanel.test.tsx: with
// featureUnifiedShotEditor enabled, a desktop shot click NAVIGATES to the
// detail route (same as the non-desktop branch) and the three-panel layout
// never mounts (threePanelActive folds the flag, permanently false).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"
import type { FeatureFlags } from "@/shared/lib/flags"

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

// 5b: pin the effective role to the global producer claim (member == global)
// so the pre-5b affordance expectations in this file stay byte-identical.
vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({ role: "producer", resolving: false }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

// Desktop: the branch that previously selected into three-panel.
vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsDesktop: () => true,
}))

// Flag mock: featureUnifiedShotEditor ON, everything else default-off.
// featureSurfaceResolver stays false so useShotListState keeps the legacy
// resolution path (the two flags are independent by spec).
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: keyof FeatureFlags) => flag === "featureUnifiedShotEditor",
  getFeatureFlags: () => ({
    featurePublishing: false,
    featureSurfaceResolver: false,
    featureUnifiedShotEditor: true,
  }),
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

// Stub the three-panel layout so the assertion "never mounts" is unambiguous.
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

describe("ShotListPage desktop click (featureUnifiedShotEditor ON — fork A)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it("navigates to the detail route instead of selecting into three-panel", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    fireEvent.click(screen.getByText("Alpha"))

    // Flag-on desktop click NAVIGATES (same as the non-desktop branch)...
    expect(screen.getByText("Shot detail route")).toBeInTheDocument()
    // ...and the three-panel layout never mounts.
    expect(screen.queryByTestId("three-panel-layout-stub")).not.toBeInTheDocument()
  })

  it("keeps the list chrome mounted (no three-panel early return) before any click", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    expect(screen.getByRole("button", { name: /New Shot/ })).toBeInTheDocument()
    expect(screen.queryByTestId("three-panel-layout-stub")).not.toBeInTheDocument()
  })
})
