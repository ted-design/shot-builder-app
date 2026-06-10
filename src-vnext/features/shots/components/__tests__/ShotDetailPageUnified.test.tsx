/// <reference types="@testing-library/jest-dom" />
// Phase 5a — unit matrix for the unified two-column editor (flag-on).
//
// Renders through the ShotDetailPage default export with the flag mocked ON,
// so the fork B entry is exercised too. Section components are stubbed to
// emit their capability props (behavior-free), so what's asserted here is the
// page-level capability wiring:
//   - scan-path order (DESIGN.md law)
//   - viewer mounts ZERO enabled write affordances
//   - crew sees no upload/lifecycle affordances (strict convergence,
//     Ted 2026-06-09) but keeps operational edits
//   - 1-4 status keys: viewer no-op, producer writes via the local
//     STATUS_CYCLE (never imported from ThreePanelLayout)
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "producer" }))

// Per-test lane state so the scene-banner member/non-member pair can flip
// between a readable lane map and the non-member empty degrade.
const laneState = vi.hoisted(() => ({
  lanes: [] as unknown[],
  laneById: new Map<string, unknown>(),
}))

// Flag ON — fork B renders the unified composition.
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => flag === "featureUnifiedShotEditor",
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/features/shots/hooks/useShot", () => ({
  useShot: vi.fn(),
}))

vi.mock("@/features/shots/hooks/useLanes", () => ({
  useLanes: () => ({
    data: laneState.lanes,
    laneById: laneState.laneById,
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

// Desktop mode.
vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsDesktop: () => true,
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: [], loading: false, error: null }),
  useLocations: () => ({ data: [], loading: false, error: null }),
}))

// Capability-emitting stubs (behavior-free) — the page wiring is the subject.
vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: ({ canUpload }: { readonly canUpload: boolean }) => (
    <div data-testid="hero-stub" data-can-upload={String(canUpload)}>
      Hero
    </div>
  ),
}))

vi.mock("@/features/shots/components/ActiveLookCoverReferencesPanel", () => ({
  ActiveLookCoverReferencesPanel: ({ canEdit }: { readonly canEdit: boolean }) => (
    <div data-testid="cover-refs-stub" data-can-edit={String(canEdit)}>
      CoverRefs
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotLooksSection", () => ({
  ShotLooksSection: ({ canEdit }: { readonly canEdit: boolean }) => (
    <div data-testid="looks-stub" data-can-edit={String(canEdit)}>
      Looks
    </div>
  ),
}))

vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: ({ canEditAddendum }: { readonly canEditAddendum: boolean }) => (
    <div data-testid="notes-stub" data-can-edit={String(canEditAddendum)}>
      Notes
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: ({ canComment }: { readonly canComment: boolean }) => (
    <div data-testid="comments-stub" data-can-comment={String(canComment)}>
      Comments
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotReferenceLinksSection", () => ({
  ShotReferenceLinksSection: ({ canEdit }: { readonly canEdit: boolean }) => (
    <div data-testid="reference-links-stub" data-can-edit={String(canEdit)}>
      Links
    </div>
  ),
}))

vi.mock("@/features/shots/components/TagEditor", () => ({
  TagEditor: ({ disabled }: { readonly disabled?: boolean }) => (
    <div data-testid="tag-editor-stub" data-disabled={String(disabled === true)}>
      Tags
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotVersionHistorySection", () => ({
  ShotVersionHistorySection: () => <div data-testid="history-stub">History</div>,
}))

vi.mock("@/features/shots/components/ShotLifecycleActionsMenu", () => ({
  ShotLifecycleActionsMenu: () => (
    <div data-testid="lifecycle-actions-stub">Lifecycle</div>
  ),
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

import { useShot } from "@/features/shots/hooks/useShot"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import ShotDetailPage from "@/features/shots/components/ShotDetailPage"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Active Merino T-Shirt",
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
    shotNumber: overrides.shotNumber ?? "31",
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

/** Asserts each element precedes the next one in document order. */
function expectDocumentOrder(elements: ReadonlyArray<HTMLElement>) {
  for (let i = 0; i < elements.length - 1; i++) {
    const a = elements[i]!
    const b = elements[i + 1]!
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}

describe("ShotDetailPageUnified (flag-on)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
    laneState.lanes = []
    laneState.laneById = new Map()
  })

  it("renders the scan-path order: description, hero, products, meta, notes, links, tags, comments, history, rail", () => {
    mockShot({
      looks: [
        {
          id: "l1",
          label: "Primary",
          order: 0,
          products: [
            { familyId: "f1", familyName: "Merino T-Shirt", colourName: "Ivory" },
          ],
        },
      ],
      activeLookId: "l1",
    })

    renderPage()

    // Carryover testids/copy on the flag-on layout.
    expect(screen.getByRole("button", { name: /Back to Shots/ })).toBeInTheDocument()
    expect(screen.getByTestId("shot-title-edit")).toBeInTheDocument()
    expect(screen.getByTestId("shot-status-select-trigger")).toBeInTheDocument()

    expectDocumentOrder([
      screen.getByText("Description"),
      screen.getByTestId("hero-stub"),
      screen.getByTestId("product-colorway-strip"),
      screen.getByTestId("meta-date"),
      screen.getByTestId("meta-location"),
      screen.getByTestId("meta-talent"),
      screen.getByTestId("notes-stub"),
      screen.getByTestId("reference-links-stub"),
      screen.getByTestId("tags-section"),
      screen.getByTestId("comments-stub"),
      screen.getByTestId("history-stub"),
      screen.getByTestId("shot-detail-sidebar"),
    ])

    // Colorway strip is the typographic centerpiece — product + colorway text.
    expect(screen.getByText("Merino T-Shirt")).toBeInTheDocument()
    expect(screen.getByText("Ivory")).toBeInTheDocument()
  })

  it("shows the zero-looks centerpiece state", () => {
    mockShot({ looks: [] })

    renderPage()

    expect(
      screen.getByText("No products yet. Add a look in the rail."),
    ).toBeInTheDocument()
  })

  it("falls back to the first sorted look as Active when activeLookId is stale", () => {
    mockShot({
      looks: [
        { id: "l2", label: "Alt", order: 1, products: [] },
        { id: "l1", label: "Primary", order: 0, products: [] },
      ],
      activeLookId: "gone",
    })

    renderPage()

    const strip = screen.getByTestId("product-colorway-strip")
    const headers = Array.from(strip.querySelectorAll("p")).map((p) => p.textContent ?? "")
    const primaryHeader = headers.find((t) => t.startsWith("Primary"))
    const altHeader = headers.find((t) => t.startsWith("Alt"))
    expect(primaryHeader).toContain("Active")
    expect(altHeader).toBeDefined()
    expect(altHeader).not.toContain("Active")
    expect(headers.findIndex((t) => t.startsWith("Primary"))).toBeLessThan(
      headers.findIndex((t) => t.startsWith("Alt")),
    )
  })

  it("viewer mounts zero enabled write affordances", () => {
    authState.role = "viewer"
    mockShot()

    renderPage()

    // Title is a plain heading — no inline edit affordance.
    expect(screen.queryByTestId("shot-title-edit")).not.toBeInTheDocument()
    // Status trigger present but disabled (canDoOperational=false).
    expect(screen.getByTestId("shot-status-select-trigger")).toBeDisabled()
    // No lifecycle, no uploads, no look/tag/notes/comment/link writes.
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "false")
    expect(screen.getByTestId("cover-refs-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("looks-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("notes-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-can-comment", "false")
    expect(screen.getByTestId("reference-links-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("tag-editor-stub")).toHaveAttribute("data-disabled", "true")
    // Read-only meta copy carried onto the segments (Date + Location empty).
    expect(screen.getAllByText("Not set")).toHaveLength(2)
    expect(screen.getByText("0 assigned")).toBeInTheDocument()
    // Export stays visible — device-gated only, deliberate (spec invariant 10).
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
    // Share is admin/producer only.
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument()
  })

  it("crew sees no upload or lifecycle affordances but keeps operational edits (strict convergence)", () => {
    authState.role = "crew"
    mockShot()

    renderPage()

    // Strict gates (Ted, 2026-06-09): uploads + lifecycle are admin/producer only.
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "false")
    expect(screen.getByTestId("cover-refs-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument()
    // Crew keep Firestore field edits.
    expect(screen.getByTestId("shot-status-select-trigger")).not.toBeDisabled()
    expect(screen.getByTestId("shot-title-edit")).toBeInTheDocument()
    expect(screen.getByTestId("looks-stub")).toHaveAttribute("data-can-edit", "true")
    expect(screen.getByTestId("notes-stub")).toHaveAttribute("data-can-edit", "true")
    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-can-comment", "true")
    expect(screen.getByTestId("reference-links-stub")).toHaveAttribute(
      "data-can-edit",
      "true",
    )
    expect(screen.getByTestId("tag-editor-stub")).toHaveAttribute("data-disabled", "false")
  })

  it("1-4 status keys are a no-op for viewers", () => {
    authState.role = "viewer"
    mockShot({ status: "todo" })

    renderPage()

    fireEvent.keyDown(document.body, { key: "1" })
    fireEvent.keyDown(document.body, { key: "2" })
    fireEvent.keyDown(document.body, { key: "3" })
    fireEvent.keyDown(document.body, { key: "4" })

    expect(updateShotWithVersion).not.toHaveBeenCalled()
  })

  it("1-4 status keys write for a producer via the unified editor source", () => {
    mockShot({ status: "todo" })

    renderPage()

    fireEvent.keyDown(document.body, { key: "2" })

    expect(updateShotWithVersion).toHaveBeenCalledTimes(1)
    expect(updateShotWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { status: "in_progress" },
        source: "ShotDetailPageUnified:keyboard",
      }),
    )
  })

  it("1-4 keys skip the write when the status is unchanged", () => {
    mockShot({ status: "todo" })

    renderPage()

    fireEvent.keyDown(document.body, { key: "1" })

    expect(updateShotWithVersion).not.toHaveBeenCalled()
  })

  // ── Per-role affordance matrix (build spec §Test plan item 2) ─────────────
  // viewer/warehouse: ZERO enabled write affordances. crew: status + fields +
  // comments yes; uploads/lifecycle/share no. producer/admin: all.

  /** Every write affordance enabled — the admin/producer row of the matrix. */
  function expectAllWriteAffordances() {
    expect(screen.getByTestId("shot-title-edit")).toBeInTheDocument()
    expect(screen.getByTestId("shot-status-select-trigger")).not.toBeDisabled()
    expect(screen.getByTestId("lifecycle-actions-stub")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "true")
    expect(screen.getByTestId("cover-refs-stub")).toHaveAttribute("data-can-edit", "true")
    expect(screen.getByTestId("looks-stub")).toHaveAttribute("data-can-edit", "true")
    expect(screen.getByTestId("notes-stub")).toHaveAttribute("data-can-edit", "true")
    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-can-comment", "true")
    expect(screen.getByTestId("reference-links-stub")).toHaveAttribute(
      "data-can-edit",
      "true",
    )
    expect(screen.getByTestId("tag-editor-stub")).toHaveAttribute("data-disabled", "false")
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
  }

  /** Zero enabled write affordances — the viewer/warehouse row of the matrix. */
  function expectZeroWriteAffordances() {
    expect(screen.queryByTestId("shot-title-edit")).not.toBeInTheDocument()
    expect(screen.getByTestId("shot-status-select-trigger")).toBeDisabled()
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument()
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "false")
    expect(screen.getByTestId("cover-refs-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("looks-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("notes-stub")).toHaveAttribute("data-can-edit", "false")
    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-can-comment", "false")
    expect(screen.getByTestId("reference-links-stub")).toHaveAttribute(
      "data-can-edit",
      "false",
    )
    expect(screen.getByTestId("tag-editor-stub")).toHaveAttribute("data-disabled", "true")
    // Export stays visible — device-gated only, deliberate (spec invariant 10).
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
  }

  it("admin mounts every write affordance enabled", () => {
    authState.role = "admin"
    mockShot()

    renderPage()

    expectAllWriteAffordances()
  })

  it("producer mounts every write affordance enabled", () => {
    authState.role = "producer"
    mockShot()

    renderPage()

    expectAllWriteAffordances()
  })

  it("warehouse mounts zero enabled write affordances and the 1-4 keys no-op", () => {
    authState.role = "warehouse"
    mockShot({ status: "todo" })

    renderPage()

    expectZeroWriteAffordances()

    // canManageShots(warehouse)=false — the status keys early-return too.
    fireEvent.keyDown(document.body, { key: "2" })
    fireEvent.keyDown(document.body, { key: "4" })
    expect(updateShotWithVersion).not.toHaveBeenCalled()
  })

  // ── Member vs non-member — only where lanes matter (scene banner) ─────────

  it("non-member degrade: scene banner absent when laneById is empty even with a laneId", () => {
    // useShotDetailBundle forces empty lane maps on a permission-denied lanes
    // read (the non-member case) — the banner must simply not render.
    mockShot({ laneId: "lane1" })

    renderPage()

    expect(screen.queryByTestId("scene-context-banner")).not.toBeInTheDocument()
  })

  it("member: scene banner renders when the shot's lane is readable", () => {
    const now = Timestamp.fromMillis(Date.now())
    const lane = {
      id: "lane1",
      name: "Terrace Scene",
      projectId: "p1",
      clientId: "c1",
      sortOrder: 0,
      color: "#7c3aed",
      sceneNumber: 3,
      createdAt: now,
      updatedAt: now,
      createdBy: "u1",
    }
    laneState.lanes = [lane]
    laneState.laneById = new Map([["lane1", lane]])
    mockShot({ laneId: "lane1" })

    renderPage()

    expect(screen.getByTestId("scene-context-banner")).toBeInTheDocument()
    expect(screen.getByText("Terrace Scene")).toBeInTheDocument()
  })
})
