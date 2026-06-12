/// <reference types="@testing-library/jest-dom" />
// 5f-II / 5f-III — unit matrix for the Review shells (the read-only approval
// surfaces) and their mount fork in ShotDetailPageUnified. The first describe
// pins the 5f-II review-CLIENT shell; the trailing 5f-III block pins the
// product-forward review-WAREHOUSE variant (products FIRST, read-only status,
// open composer, no version-history, no hero-led layout).
//
// Renders through the ShotDetailPage default export so the real fork is
// exercised: isFeatureEnabled('featureReviewSurface') && resolved
// surface === 'review-client'. resolveSurface/useResolvedSurface are REAL —
// only their inputs (flags / effective role) are mocked, so the surface
// keying is the actual resolver, not a stub. A `viewer` role resolves to
// 'review-client' (resolveSurface.ts SURFACE_BY_ROLE), which is how the
// client shell mounts.
//
// Pins:
//   - flag OFF: the shell never mounts — a viewer renders the unified editor
//     body (the existing ShotDetailPageUnified suite is the byte-identical
//     contract; this file only pins the absence of the shell)
//   - viewer + flag ON: blocks in document order — hero FIRST (read-only),
//     shot #/title + read-only status badge, comment composer OPEN, read-only
//     talent/location meta, products read-only LAST
//   - status is shown READ-ONLY — no tap-row, no status select
//   - NO version-history section (the explicit scoping boundary)
//   - products render through ProductColorwayStrip readOnly=true
//   - producer + flag ON: NO review shell (surface is plan-build)
//   - the 'review-warehouse' variant (5f-III) renders the product-forward pull
//     detail (products FIRST, read-only status, open composer), never the
//     client composition and never the old 5f-II placeholder
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "viewer" }))

const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

// featureReviewSurface defaults ON in this file (the shell is the subject);
// the flag-off pin flips it per-test. Other flags stay real.
const flagState = vi.hoisted(() => ({ reviewSurface: true }))
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureReviewSurface" ? flagState.reviewSurface : actual.isFeatureEnabled(flag),
  }
})

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
  useAuth: () => ({
    role: authState.role,
    clientId: "c1",
    user: { uid: "u1" },
    loading: false,
  }),
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

// Desktop by default — the review shell is surface-keyed, not device-keyed.
const deviceState = vi.hoisted(() => ({
  device: "desktop" as "mobile" | "tablet" | "desktop",
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => deviceState.device === "mobile",
  useIsTablet: () => deviceState.device === "tablet",
  useIsDesktop: () => deviceState.device === "desktop",
}))

// Talent fixture feeds the shell's read-only talent line.
vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({
    data: [
      { id: "t1", name: "Malik R." },
      { id: "t2", name: "Dana K." },
    ],
    loading: false,
    error: null,
  }),
  useLocations: () => ({ data: [], loading: false, error: null }),
}))

// Capability-emitting stubs (existing suite convention) — the shell's
// composition + props are the subject, not the sections' internals.
vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: ({
    canUpload,
    frame,
  }: {
    readonly canUpload: boolean
    readonly frame?: string
  }) => (
    <div data-testid="hero-stub" data-can-upload={String(canUpload)} data-frame={String(frame)}>
      Hero
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: ({
    canComment,
    writeAuthoritative,
  }: {
    readonly canComment: boolean
    readonly writeAuthoritative?: boolean
  }) => (
    <div
      data-testid="comments-stub"
      data-can-comment={String(canComment)}
      data-write-authoritative={String(writeAuthoritative)}
    >
      Comments
    </div>
  ),
}))

// Editor-body stubs so the flag-off / non-review forks render without live
// subscriptions (same set the ShotDetailPageUnified suite stubs).
vi.mock("@/features/shots/components/ActiveLookCoverReferencesPanel", () => ({
  ActiveLookCoverReferencesPanel: () => (
    <div data-testid="cover-refs-stub">CoverRefs</div>
  ),
}))

vi.mock("@/features/shots/components/ShotLooksSection", () => ({
  ShotLooksSection: () => <div data-testid="looks-stub">Looks</div>,
}))

vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: () => <div data-testid="notes-stub">Notes</div>,
}))

vi.mock("@/features/shots/components/ShotReferenceLinksSection", () => ({
  ShotReferenceLinksSection: () => (
    <div data-testid="reference-links-stub">Links</div>
  ),
}))

vi.mock("@/features/shots/components/TagEditor", () => ({
  TagEditor: () => <div data-testid="tag-editor-stub">Tags</div>,
}))

// History stub keeps a testid so the NO-version-history pin can query it and
// prove the review shell does NOT render it (a real leak would surface here).
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
import { ReviewShotDetail } from "@/features/shots/components/ReviewShotDetail"
import ShotDetailPage from "@/features/shots/components/ShotDetailPage"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Linen overshirt — window light",
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
    shotNumber: overrides.shotNumber ?? "11",
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

describe("ReviewShotDetail (the 5f-II Review-client shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "viewer"
    effectiveState.role = null
    effectiveState.resolving = false
    deviceState.device = "desktop"
    flagState.reviewSurface = true
  })

  // ── Mount fork ─────────────────────────────────────────────────────────────

  it("flag OFF: the shell never mounts — a viewer renders the unified editor body", () => {
    flagState.reviewSurface = false
    mockShot()

    renderPage()

    expect(screen.queryByTestId("review-shot-detail")).not.toBeInTheDocument()
    // The editor body is what renders (its suite pins the byte-identical
    // detail): the unified editor's notes section mounts, review testids do not.
    expect(screen.getByTestId("notes-stub")).toBeInTheDocument()
    expect(screen.queryByTestId("review-client-composer")).not.toBeInTheDocument()
  })

  it("producer + flag ON: no review shell — the surface is plan-build, not the flag alone", () => {
    authState.role = "producer"
    mockShot()

    renderPage()

    expect(screen.queryByTestId("review-shot-detail")).not.toBeInTheDocument()
    // The plan-build editor body renders instead.
    expect(screen.getByTestId("notes-stub")).toBeInTheDocument()
  })

  it("viewer + flag ON: the review-client shell mounts (surface-keyed off the viewer role)", () => {
    mockShot()

    renderPage()

    expect(screen.getByTestId("review-shot-detail")).toBeInTheDocument()
    // The plan-build editor body is NOT mounted under the shell.
    expect(screen.queryByTestId("notes-stub")).not.toBeInTheDocument()
  })

  // ── Shell composition ──────────────────────────────────────────────────────

  it("viewer + flag ON: blocks render in order — hero, identity, comments, meta, products", () => {
    mockShot({
      talentIds: ["t1", "t2"],
      locationName: "Studio C",
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

    // Hero FIRST — the client decides off the image (read-only). Then identity
    // (shot #/title/status), open composer, read-only meta, products LAST.
    expectDocumentOrder([
      screen.getByTestId("hero-stub"),
      screen.getByTestId("review-shot-identity"),
      screen.getByTestId("review-client-composer"),
      screen.getByTestId("review-shot-meta"),
      screen.getByTestId("product-colorway-strip"),
    ])

    // Identity: shot number eyebrow + serif title.
    expect(screen.getByText(/Shot #11/)).toBeInTheDocument()
    expect(screen.getByText("Linen overshirt — window light")).toBeInTheDocument()

    // Read-only meta: resolved talent + location.
    const meta = screen.getByTestId("review-shot-meta")
    expect(meta).toHaveTextContent("Malik R. · Dana K.")
    expect(meta).toHaveTextContent("Studio C")

    // Products render through the read-only extracted strip.
    expect(screen.getByText("Merino T-Shirt")).toBeInTheDocument()
  })

  it("hero is display-only (canUpload=false) and uses the natural frame", () => {
    mockShot()

    renderPage()

    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "false")
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-frame", "natural")
  })

  it("status is shown READ-ONLY — a status badge, never a tap-row or status select", () => {
    mockShot({ status: "in_progress" })

    renderPage()

    // The read-only status badge wrapper renders inside the identity header.
    expect(screen.getByTestId("review-status-badge")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    // No status WRITE controls (clients can't write shots).
    expect(screen.queryByTestId("status-tap-row")).not.toBeInTheDocument()
    expect(screen.queryByTestId("status-tap-todo")).not.toBeInTheDocument()
    expect(screen.queryByTestId("shot-status-select-trigger")).not.toBeInTheDocument()
  })

  it("comment composer is OPEN for the client — writeAuthoritative + canComment passed through", () => {
    mockShot()

    renderPage()

    const comments = screen.getByTestId("comments-stub")
    expect(comments).toHaveAttribute("data-can-comment", "true")
    expect(comments).toHaveAttribute("data-write-authoritative", "true")
  })

  // ── Scoping boundaries (the leak-test discipline) ─────────────────────────

  it("NO version-history section on the review shell", () => {
    mockShot()

    renderPage()

    expect(screen.queryByTestId("history-stub")).not.toBeInTheDocument()
  })

  it("no plan-build chrome leaks onto the review shell (editors, lifecycle, status select)", () => {
    mockShot()

    renderPage()

    // No inline field editors / planning rails.
    expect(screen.queryByTestId("shot-title-edit")).not.toBeInTheDocument()
    expect(screen.queryByTestId("notes-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("looks-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tag-editor-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("reference-links-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("cover-refs-stub")).not.toBeInTheDocument()
    // No lifecycle menu, share, export.
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument()
  })

  // ── Products read-only LAST ────────────────────────────────────────────────

  it("renders the product strip in read-only mode (ProductColorwayStrip readOnly)", () => {
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

    const strip = screen.getByTestId("product-colorway-strip")
    expect(strip).toBeInTheDocument()
    // Read-only: no "Add a look"/assignment affordance copy on the strip.
    expect(strip).not.toHaveTextContent("Add a look in the rail")
  })

  // ── Empty/degraded talent + location ───────────────────────────────────────

  it("talent/location fall back to an em dash when unset", () => {
    mockShot({ talentIds: [], locationName: undefined })

    renderPage()

    const meta = screen.getByTestId("review-shot-meta")
    // Two em-dash fallbacks (talent + location).
    expect(meta.querySelectorAll("p")).not.toHaveLength(0)
    expect(meta.textContent).toContain("—")
  })

  // ── 5f-III: the 'review-warehouse' variant (PRODUCT-FORWARD pull view) ──────

  function renderWarehouse(overrides: Partial<Shot> = {}) {
    mockShot(overrides)
    return render(
      <MemoryRouter initialEntries={["/projects/p1/shots/s1"]}>
        <Routes>
          <Route
            path="/projects/:id/shots/:sid"
            element={<ReviewShotDetail variant="review-warehouse" />}
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  it("review-warehouse: renders the product-forward pull detail, not the placeholder or client composition", () => {
    renderWarehouse()

    expect(screen.getByTestId("review-warehouse-detail")).toBeInTheDocument()
    // The 5f-II placeholder is GONE (replaced by the real composition).
    expect(screen.queryByTestId("review-warehouse-placeholder")).not.toBeInTheDocument()
    // No client-variant blocks leak into the warehouse surface.
    expect(screen.queryByTestId("review-shot-detail")).not.toBeInTheDocument()
    expect(screen.queryByTestId("review-client-composer")).not.toBeInTheDocument()
  })

  it("review-warehouse: blocks render PRODUCT-FORWARD — products FIRST, then identity, meta, composer", () => {
    renderWarehouse({
      talentIds: ["t1", "t2"],
      locationName: "Studio C",
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

    // Products FIRST (the warehouse pulls every garment), then identity/status,
    // read-only meta, comment composer LAST.
    expectDocumentOrder([
      screen.getByTestId("review-warehouse-products"),
      screen.getByTestId("review-warehouse-identity"),
      screen.getByTestId("review-warehouse-meta"),
      screen.getByTestId("review-warehouse-composer"),
    ])

    // The product strip is the FIRST block (nested inside the products wrapper).
    const products = screen.getByTestId("review-warehouse-products")
    expect(products).toContainElement(screen.getByTestId("product-colorway-strip"))
    expect(screen.getByText("Merino T-Shirt")).toBeInTheDocument()

    // Identity: shot number eyebrow + serif title.
    expect(screen.getByText(/Shot #11/)).toBeInTheDocument()
    expect(screen.getByText("Linen overshirt — window light")).toBeInTheDocument()

    // Read-only meta: resolved talent + location.
    const meta = screen.getByTestId("review-warehouse-meta")
    expect(meta).toHaveTextContent("Malik R. · Dana K.")
    expect(meta).toHaveTextContent("Studio C")
  })

  it("review-warehouse: the product strip renders read-only (ProductColorwayStrip readOnly)", () => {
    renderWarehouse({
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

    const strip = screen.getByTestId("product-colorway-strip")
    expect(strip).toBeInTheDocument()
    // Read-only: no assignment-affordance copy on the strip.
    expect(strip).not.toHaveTextContent("Add a look in the rail")
  })

  it("review-warehouse: status is shown READ-ONLY — a badge, never a tap-row or status select", () => {
    renderWarehouse({ status: "in_progress" })

    expect(screen.getByTestId("review-warehouse-status-badge")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    // No status WRITE controls (warehouse review surface doesn't write shots).
    expect(screen.queryByTestId("status-tap-row")).not.toBeInTheDocument()
    expect(screen.queryByTestId("status-tap-todo")).not.toBeInTheDocument()
    expect(screen.queryByTestId("shot-status-select-trigger")).not.toBeInTheDocument()
  })

  it("review-warehouse: the comment composer is OPEN — writeAuthoritative + canComment passed through", () => {
    renderWarehouse()

    const comments = screen.getByTestId("comments-stub")
    expect(comments).toHaveAttribute("data-can-comment", "true")
    expect(comments).toHaveAttribute("data-write-authoritative", "true")
  })

  it("review-warehouse: NO version-history section, and no hero-led layout (product-forward, not image-forward)", () => {
    renderWarehouse()

    // Scoping boundary: the version-history audit tool never mounts on review.
    expect(screen.queryByTestId("history-stub")).not.toBeInTheDocument()
    // The warehouse variant is product-forward — no hero image section leads it.
    expect(screen.queryByTestId("hero-stub")).not.toBeInTheDocument()
    // No plan-build chrome leaks.
    expect(screen.queryByTestId("notes-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
  })
})
