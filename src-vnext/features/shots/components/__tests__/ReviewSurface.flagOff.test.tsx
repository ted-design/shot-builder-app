/// <reference types="@testing-library/jest-dom" />
// 5f-II — flag-OFF no-change contract for the Review surfaces.
//
// With `featureReviewSurface` OFF, a VIEWER must render exactly as today on
// BOTH the list and the detail page: the review-client forks NEVER mount, the
// page falls through to the existing (producer/editor) surfaces. The forks are
// surface-keyed (resolveSurface maps viewer → 'review-client'), so the resolver
// is REAL here — only the flag (pinned OFF) and the role inputs are mocked.
// ReviewClientGallery / ReviewShotDetail are stubbed with sentinel testids so
// "the review fork did not mount" is a direct assertion, not an inference.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "viewer" }))
const effectiveState = vi.hoisted(() => ({ role: null as string | null, resolving: false }))
const deviceState = vi.hoisted(() => ({
  device: "desktop" as "mobile" | "tablet" | "desktop",
}))

// featureReviewSurface pinned OFF for the whole file (the contract). Every
// other flag stays real except featureSurfaceResolver, pinned OFF so the
// viewer resolves the legacy card-grid (matches the legacy-pinned list suite).
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureReviewSurface"
        ? false
        : flag === "featureSurfaceResolver"
          ? false
          : actual.isFeatureEnabled(flag),
  }
})

// ── Shared providers/hooks (both pages) ──────────────────────────────────────

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role ?? authState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => deviceState.device === "mobile",
  useIsTablet: () => deviceState.device === "tablet",
  useIsDesktop: () => deviceState.device === "desktop",
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: [], loading: false, error: null }),
  useLocations: () => ({ data: [], loading: false, error: null }),
  useProductFamilies: () => ({ data: [], loading: false, error: null }),
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

// ── List-page data + heavy children ─────────────────────────────────────────

vi.mock("@/features/shots/hooks/useShots", () => ({ useShots: vi.fn() }))
vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], loading: false, error: null }),
}))

// Sentinel review/shoot list forks — assert they DO NOT mount when flag OFF.
vi.mock("@/features/shots/components/ReviewClientGallery", () => ({
  ReviewClientGallery: () => <div data-testid="review-client-gallery">Gallery</div>,
}))
vi.mock("@/features/shots/components/ShootShotList", () => ({
  ShootShotList: () => <div data-testid="shoot-shot-list">ShootList</div>,
}))

// ── Detail-page data + sentinel detail forks ─────────────────────────────────

vi.mock("@/features/shots/hooks/useShot", () => ({ useShot: vi.fn() }))
vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/features/shots/components/ReviewShotDetail", () => ({
  ReviewShotDetail: () => <div data-testid="review-shot-detail">ReviewDetail</div>,
}))
vi.mock("@/features/shots/components/ShootShotDetail", () => ({
  ShootShotDetail: () => <div data-testid="shoot-shot-detail">ShootDetail</div>,
}))

// Editor-body presentational stubs so the detail editor body renders without
// live subscriptions (the byte-identical fall-through surface).
vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: () => <div data-testid="hero-stub">Hero</div>,
}))
vi.mock("@/features/shots/components/ActiveLookCoverReferencesPanel", () => ({
  ActiveLookCoverReferencesPanel: () => <div data-testid="cover-refs-stub">CoverRefs</div>,
}))
vi.mock("@/features/shots/components/ShotLooksSection", () => ({
  ShotLooksSection: () => <div data-testid="looks-stub">Looks</div>,
}))
vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: () => <div data-testid="notes-stub">Notes</div>,
}))
vi.mock("@/features/shots/components/ShotReferenceLinksSection", () => ({
  ShotReferenceLinksSection: () => <div data-testid="reference-links-stub">Links</div>,
}))
vi.mock("@/features/shots/components/TagEditor", () => ({
  TagEditor: () => <div data-testid="tag-editor-stub">Tags</div>,
}))
vi.mock("@/features/shots/components/ShotVersionHistorySection", () => ({
  ShotVersionHistorySection: () => <div data-testid="history-stub">History</div>,
}))
vi.mock("@/features/shots/components/ShotLifecycleActionsMenu", () => ({
  ShotLifecycleActionsMenu: () => <div data-testid="lifecycle-actions-stub">Lifecycle</div>,
}))
vi.mock("@/features/shots/components/ShotsShareDialog", () => ({
  ShotsShareDialog: () => null,
}))
vi.mock("@/features/shots/components/SceneDetailSheet", () => ({
  SceneDetailSheet: () => null,
}))
vi.mock("@/features/shots/components/ActiveEditorsBar", () => ({
  ActiveEditorsBar: () => null,
}))
vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: () => <div data-testid="comments-stub">Comments</div>,
}))

import { useShots } from "@/features/shots/hooks/useShots"
import { useShot } from "@/features/shots/hooks/useShot"
import ShotListPage from "@/features/shots/components/ShotListPage"
import ShotDetailPage from "@/features/shots/components/ShotDetailPage"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Alpha",
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

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/shots"]}>
      <Routes>
        <Route path="/projects/:id/shots" element={<ShotListPage />} />
        <Route path="/projects/:id/shots/:sid" element={<div>detail route</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/shots/s1"]}>
      <Routes>
        <Route path="/projects/:id/shots/:sid" element={<ShotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Review surface — flag OFF (no-change contract for a viewer)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    authState.role = "viewer"
    effectiveState.role = null
    effectiveState.resolving = false
    deviceState.device = "desktop"
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })
    ;(useShot as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: makeShot({ id: "s1", title: "Alpha" }),
      loading: false,
      error: null,
    })
  })

  it("ShotListPage: a viewer falls through to the existing list — the review gallery never mounts", () => {
    renderList()

    // The review-client gallery fork is NOT mounted (flag OFF).
    expect(screen.queryByTestId("review-client-gallery")).not.toBeInTheDocument()
    expect(screen.queryByTestId("shoot-shot-list")).not.toBeInTheDocument()
    // The existing producer-style list renders the shot (the fall-through surface).
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("ShotDetailPage: a viewer falls through to the unified editor body — the review detail shell never mounts", () => {
    renderDetail()

    // The review-client detail fork is NOT mounted (flag OFF).
    expect(screen.queryByTestId("review-shot-detail")).not.toBeInTheDocument()
    expect(screen.queryByTestId("shoot-shot-detail")).not.toBeInTheDocument()
    // The unified editor body renders instead (notes section is body-only).
    expect(screen.getByTestId("notes-stub")).toBeInTheDocument()
  })
})
