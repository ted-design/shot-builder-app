/// <reference types="@testing-library/jest-dom" />
// Phase 5a characterization pin (build spec, Test plan 1b).
//
// Pins TODAY's desktop-mode (isMobile=false) ShotDetailPage behavior, against
// unchanged source. The legacy ShotDetailPage.test.tsx forces isMobile=true,
// so none of the desktop affordances were pinned:
//   - Export button present (device-gated only — viewer/crew still see it)
//   - lifecycle menu gated admin/producer (present for producer, ABSENT for
//     crew — this is the divergence from ThreePanelCanvasPanel's crew-inclusive
//     gate that the 5a editor converges)
//   - meta-date / meta-location / meta-talent testids present
//   - tags-section present
//   - shot-status-select-trigger present
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "producer" }))

vi.mock("@/features/shots/hooks/useShot", () => ({
  useShot: vi.fn(),
}))

vi.mock("@/features/shots/hooks/useLanes", () => ({
  useLanes: () => ({
    data: [],
    laneById: new Map(),
    laneNameById: new Map(),
    loading: false,
    error: null,
  }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

// Desktop mode — the branch the legacy ShotDetailPage.test.tsx never renders.
vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsDesktop: () => true,
}))

// Pin the legacy (flag-off) detail body — the 5c rollback path. The real
// featureUnifiedShotEditor default is ON since the default-flip PR.
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: () => false,
  getFeatureFlags: () => ({
    featurePublishing: false,
    featureSurfaceResolver: false,
    featureUnifiedShotEditor: false,
  }),
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: [], loading: false, error: null }),
  useLocations: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/shots/components/TalentPicker", () => ({
  TalentPicker: () => <div>Talent</div>,
}))

vi.mock("@/features/shots/components/LocationPicker", () => ({
  LocationPicker: () => <div>Location</div>,
}))

vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: () => <div>Notes</div>,
}))

vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: () => <div>Hero</div>,
}))

vi.mock("@/features/shots/components/ActiveLookCoverReferencesPanel", () => ({
  ActiveLookCoverReferencesPanel: () => <div>CoverRefs</div>,
}))

vi.mock("@/features/shots/components/ShotLooksSection", () => ({
  ShotLooksSection: () => <div>Looks</div>,
}))

vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: () => <div>Comments</div>,
}))

vi.mock("@/features/shots/components/ShotVersionHistorySection", () => ({
  ShotVersionHistorySection: () => <div>History</div>,
}))

vi.mock("@/features/shots/components/TagEditor", () => ({
  TagEditor: () => <div>Tags</div>,
}))

// Behavior-free stub so the page-level admin/producer gate is what's asserted.
vi.mock("@/features/shots/components/ShotLifecycleActionsMenu", () => ({
  ShotLifecycleActionsMenu: () => (
    <div data-testid="lifecycle-actions-stub">Lifecycle</div>
  ),
}))

import { useShot } from "@/features/shots/hooks/useShot"
import ShotDetailPage from "@/features/shots/components/ShotDetailPage"

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
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/shots/s1"]}>
      <Routes>
        <Route path="/projects/:id/shots/:sid" element={<ShotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockShot(overrides: Partial<Shot> = {}) {
  ;(useShot as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: makeShot(overrides),
    loading: false,
    error: null,
  })
}

describe("ShotDetailPage desktop mode (pre-5a pin)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
  })

  it("renders the desktop affordances for a producer", () => {
    mockShot()

    renderPage()

    // Export is device-gated only (canExport = !isMobile).
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
    // Lifecycle menu: admin/producer gate (canManageLifecycle).
    expect(screen.getByTestId("lifecycle-actions-stub")).toBeInTheDocument()
    // Status select trigger renders on desktop (!isMobile branch).
    expect(screen.getByTestId("shot-status-select-trigger")).toBeInTheDocument()
    // Meta editor card testids.
    expect(screen.getByTestId("meta-date")).toBeInTheDocument()
    expect(screen.getByTestId("meta-location")).toBeInTheDocument()
    expect(screen.getByTestId("meta-talent")).toBeInTheDocument()
    // Tags section wrapper.
    expect(screen.getByTestId("tags-section")).toBeInTheDocument()
  })

  it("hides the lifecycle menu for crew (today's admin/producer-only page gate)", () => {
    authState.role = "crew"
    mockShot()

    renderPage()

    // The detail page gates lifecycle to admin/producer — crew get NO menu
    // here, even though ThreePanelCanvasPanel shows it to crew. 5a converges
    // this; the pin makes the convergence an explicit red→green diff.
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    // Export stays visible — device-gated only, deliberate (spec invariant 10).
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
    // Crew still see the status trigger (operational write, canDoOperational).
    expect(screen.getByTestId("shot-status-select-trigger")).toBeInTheDocument()
  })
})
