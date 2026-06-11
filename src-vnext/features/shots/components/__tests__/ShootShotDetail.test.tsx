/// <reference types="@testing-library/jest-dom" />
// 5e-II — unit matrix for the Shoot shell (the compact on-set surface) and
// its mount fork in ShotDetailPageUnified.
//
// Renders through the ShotDetailPage default export so the real fork is
// exercised: isFeatureEnabled('featureShootSurface') && resolved
// surface === 'shoot'. resolveSurface/useResolvedSurface are REAL — only
// their inputs (flags / effective role / media queries) are mocked, so the
// surface keying is the actual resolver, not a stub.
//
// Pins:
//   - flag OFF: the shell never mounts — crew renders the unified editor
//     (the existing ShotDetailPageUnified suite is the byte-identical
//     contract; this file only pins the absence of the shell)
//   - crew + flag ON: shell blocks in document order (identity, hero,
//     comments, direction, products, bottom tap-row) at ANY device width
//     (surface-keyed, not device-keyed — Decision F)
//   - planning editors NOT MOUNTED (queryBy null — the leak-test discipline)
//   - legacy projectId=='' (Decision D): tap-row disabled + quiet note,
//     comments stay enabled
//   - Back/Escape navigate to the explicit list path, never -1
//   - prev/next + counter over the per-tab nav order; disabled on deep links;
//     [ / ] hardware keys keep working
//   - producer + flag ON: NO shell (surface is plan-build)
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const authState = vi.hoisted(() => ({ role: "crew" }))

// Navigate spy — Back/Escape targets and the never-(-1) pin are the subject.
const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigateSpy }
})

const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

const laneState = vi.hoisted(() => ({
  lanes: [] as unknown[],
  laneById: new Map<string, unknown>(),
}))

// featureShootSurface defaults ON in this file (the shell is the subject);
// the flag-off pin flips it per-test. Other flags stay real.
const flagState = vi.hoisted(() => ({ shootSurface: true }))
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureShootSurface" ? flagState.shootSurface : actual.isFeatureEnabled(flag),
  }
})

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

// Phone by default — the shell is phone-first; the Decision-F pin flips it.
const deviceState = vi.hoisted(() => ({
  device: "mobile" as "mobile" | "tablet" | "desktop",
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
  useIsMobile: () => deviceState.device === "mobile",
  useIsTablet: () => deviceState.device === "tablet",
  useIsDesktop: () => deviceState.device === "desktop",
}))

// Decision C signals (5e-II offline commit) — both honest signals mocked at
// their seams: navigator.onLine via useOnlineStatus, queued-write metadata
// via useShotPendingWrites (its own suite drives the real listener shape).
const connectivityState = vi.hoisted(() => ({ online: true, pending: false }))

vi.mock("@/shared/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => connectivityState.online,
}))

vi.mock("@/features/shots/hooks/useShotPendingWrites", () => ({
  useShotPendingWrites: () => connectivityState.pending,
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
  HeroImageSection: ({ canUpload }: { readonly canUpload: boolean }) => (
    <div data-testid="hero-stub" data-can-upload={String(canUpload)}>
      Hero
    </div>
  ),
}))

vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: ({
    canComment,
    offline,
  }: {
    readonly canComment: boolean
    readonly offline?: boolean
  }) => (
    <div
      data-testid="comments-stub"
      data-can-comment={String(canComment)}
      data-offline={String(offline)}
    >
      Comments
    </div>
  ),
}))

// Editor-body stubs so the flag-off / non-shoot forks render without live
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

vi.mock("@/features/shots/components/ShotDetailQuickAdd", () => ({
  ShotDetailQuickAdd: () => <div data-testid="quick-add-stub">QuickAdd</div>,
}))

import { useShot } from "@/features/shots/hooks/useShot"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { writeShotListNavOrder } from "@/features/shots/lib/shotListNavOrder"
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

function seedDirectionLane() {
  const now = Timestamp.fromMillis(Date.now())
  const lane = {
    id: "lane1",
    name: "Kitchen Scene",
    projectId: "p1",
    clientId: "c1",
    sortOrder: 0,
    direction:
      "Soft single-source window light, talent three-quarter to camera.\n\nKeep the steam kettle practical in the back third.",
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  }
  laneState.lanes = [lane]
  laneState.laneById = new Map([["lane1", lane]])
}

/** Asserts each element precedes the next one in document order. */
function expectDocumentOrder(elements: ReadonlyArray<HTMLElement>) {
  for (let i = 0; i < elements.length - 1; i++) {
    const a = elements[i]!
    const b = elements[i + 1]!
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}

describe("ShootShotDetail (the 5e-II Shoot shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    authState.role = "crew"
    effectiveState.role = null
    effectiveState.resolving = false
    laneState.lanes = []
    laneState.laneById = new Map()
    deviceState.device = "mobile"
    flagState.shootSurface = true
    connectivityState.online = true
    connectivityState.pending = false
  })

  // ── Mount fork ─────────────────────────────────────────────────────────────

  it("flag OFF: the shell never mounts — crew renders the unified editor body", () => {
    flagState.shootSurface = false
    mockShot()

    renderPage()

    expect(screen.queryByTestId("shoot-shell")).not.toBeInTheDocument()
    // The editor body is what renders (its suite pins the byte-identical
    // detail): breadcrumb chrome + notes section mount, shell testids do not.
    expect(screen.getByRole("button", { name: /Back to Shots/ })).toBeInTheDocument()
    expect(screen.getByTestId("notes-stub")).toBeInTheDocument()
    expect(screen.queryByTestId("shoot-back")).not.toBeInTheDocument()
    expect(screen.queryByTestId("shoot-status-bar")).not.toBeInTheDocument()
  })

  it("producer + flag ON: no shell — the surface is plan-build, not the flag alone", () => {
    authState.role = "producer"
    deviceState.device = "desktop"
    mockShot()

    renderPage()

    expect(screen.queryByTestId("shoot-shell")).not.toBeInTheDocument()
    expect(screen.getByTestId("shot-title-edit")).toBeInTheDocument()
  })

  it("crew + flag ON on desktop: the shell mounts too (surface-keyed, not device-keyed — Decision F)", () => {
    deviceState.device = "desktop"
    mockShot()

    renderPage()

    expect(screen.getByTestId("shoot-shell")).toBeInTheDocument()
    expect(screen.queryByTestId("shot-title-edit")).not.toBeInTheDocument()
  })

  // ── Shell composition ──────────────────────────────────────────────────────

  it("crew + flag ON: shell blocks render in order — identity, hero, comments, direction, products, bottom tap-row", () => {
    seedDirectionLane()
    mockShot({
      laneId: "lane1",
      talentIds: ["t1", "t2"],
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

    expectDocumentOrder([
      screen.getByTestId("shoot-shot-identity"),
      screen.getByTestId("hero-stub"),
      screen.getByTestId("comments-stub"),
      screen.getByTestId("shoot-scene-direction"),
      screen.getByTestId("product-colorway-strip"),
      screen.getByTestId("shoot-status-bar"),
    ])

    // Identity: shot number eyebrow + serif title + read-only talent line.
    expect(screen.getByText("Shot #11")).toBeInTheDocument()
    expect(screen.getByText("Linen overshirt — window light")).toBeInTheDocument()
    expect(screen.getByTestId("shoot-talent-line")).toHaveTextContent(
      "Malik R. · Dana K.",
    )

    // Hero is display-only (Decision B).
    expect(screen.getByTestId("hero-stub")).toHaveAttribute("data-can-upload", "false")

    // Comments keep today's gating — enabled for crew, the section's own
    // global-claim double gate carries over inside the real component.
    expect(screen.getByTestId("comments-stub")).toHaveAttribute(
      "data-can-comment",
      "true",
    )

    // Scene direction renders the FULL lane text (no 100-char truncation).
    expect(screen.getByTestId("shoot-scene-direction")).toHaveTextContent(
      "Keep the steam kettle practical in the back third.",
    )

    // Products are the read-only extracted strip.
    expect(screen.getByText("Merino T-Shirt")).toBeInTheDocument()

    // The status tap-row is live inside the bottom bar.
    const bottomBar = screen.getByTestId("shoot-status-bar")
    expect(bottomBar.contains(screen.getByTestId("status-tap-row"))).toBe(true)
    expect(screen.getByTestId("status-tap-todo")).not.toBeDisabled()
  })

  it("scene direction is quietly absent when there is no readable lane (non-member degrade / no lane)", () => {
    // laneById empty (the lanesUnavailable shape) but the shot has a laneId.
    mockShot({ laneId: "lane1" })

    renderPage()

    expect(screen.queryByTestId("shoot-scene-direction")).not.toBeInTheDocument()
  })

  it("status taps write through ShotStatusTapRow (as-is)", async () => {
    mockShot({ status: "todo" })

    renderPage()

    fireEvent.click(screen.getByTestId("status-tap-in_progress"))
    // Flush the row's optimistic-state microtask (setOptimistic(null) after
    // the mocked write resolves) so the update lands inside act.
    await act(async () => {})

    expect(updateShotWithVersion).toHaveBeenCalledTimes(1)
    expect(updateShotWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { status: "in_progress" },
        source: "ShotStatusTapRow",
      }),
    )
  })

  // ── Planning editors absent (the leak-test discipline) ────────────────────

  it("planning fields and plan-build chrome are NOT MOUNTED on the shell", () => {
    mockShot()

    renderPage()

    // No inline field editors.
    expect(screen.queryByTestId("shot-title-edit")).not.toBeInTheDocument()
    expect(screen.queryByTestId("meta-date")).not.toBeInTheDocument()
    expect(screen.queryByTestId("meta-location")).not.toBeInTheDocument()
    expect(screen.queryByTestId("meta-talent")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tags-section")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tag-editor-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("notes-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("reference-links-stub")).not.toBeInTheDocument()
    // No looks editing rail / quick add.
    expect(screen.queryByTestId("shot-detail-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("looks-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("quick-add-stub")).not.toBeInTheDocument()
    // No lifecycle menu, share, export, upload, version history.
    expect(screen.queryByTestId("lifecycle-actions-stub")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("cover-refs-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("history-stub")).not.toBeInTheDocument()
    // No desktop status select — the tap row is the only status control.
    expect(screen.queryByTestId("shot-status-select-trigger")).not.toBeInTheDocument()
  })

  // ── Decision D: legacy shots ───────────────────────────────────────────────

  it("legacy shot (projectId==''): tap-row disabled with the quiet note; comments stay enabled", () => {
    mockShot({ projectId: "" })

    renderPage()

    expect(screen.getByTestId("shoot-legacy-note")).toHaveTextContent(
      "Legacy shot — ask a producer to file it under a project",
    )
    expect(screen.getByTestId("status-tap-todo")).toBeDisabled()
    expect(screen.getByTestId("status-tap-in_progress")).toBeDisabled()
    fireEvent.click(screen.getByTestId("status-tap-in_progress"))
    expect(updateShotWithVersion).not.toHaveBeenCalled()

    // Comments are rules-open to crew on legacy shots — stay enabled.
    expect(screen.getByTestId("comments-stub")).toHaveAttribute(
      "data-can-comment",
      "true",
    )
  })

  it("non-legacy shot shows no legacy note and an enabled tap-row", () => {
    mockShot()

    renderPage()

    expect(screen.queryByTestId("shoot-legacy-note")).not.toBeInTheDocument()
    expect(screen.getByTestId("status-tap-todo")).not.toBeDisabled()
  })

  // ── Back / Escape — explicit list target, never -1 ────────────────────────

  it("Back navigates to the explicit shots-list path", () => {
    mockShot()

    renderPage()

    fireEvent.click(screen.getByTestId("shoot-back"))

    expect(navigateSpy).toHaveBeenCalledWith("/projects/p1/shots")
    expect(navigateSpy).not.toHaveBeenCalledWith(-1)
  })

  it("Escape navigates to the explicit shots-list path, never -1", () => {
    mockShot()

    renderPage()

    fireEvent.keyDown(document.body, { key: "Escape" })

    expect(navigateSpy).toHaveBeenCalledWith("/projects/p1/shots")
    expect(navigateSpy).not.toHaveBeenCalledWith(-1)
  })

  // ── Prev/next over the nav order ───────────────────────────────────────────

  it("prev/next tap targets navigate over the per-tab nav order and the counter shows N of M", () => {
    writeShotListNavOrder("c1", "p1", ["s0", "s1", "s2"])
    mockShot()

    renderPage()

    expect(screen.getByTestId("shoot-shot-counter")).toHaveTextContent("2 of 3")

    fireEvent.click(screen.getByTestId("shoot-prev"))
    expect(navigateSpy).toHaveBeenLastCalledWith("/projects/p1/shots/s0")

    fireEvent.click(screen.getByTestId("shoot-next"))
    expect(navigateSpy).toHaveBeenLastCalledWith("/projects/p1/shots/s2")
  })

  it("prev/next disable at the order ends", () => {
    writeShotListNavOrder("c1", "p1", ["s1", "s2"])
    mockShot()

    renderPage()

    expect(screen.getByTestId("shoot-prev")).toBeDisabled()
    expect(screen.getByTestId("shoot-next")).not.toBeDisabled()
  })

  it("deep link (no order snapshot): prev/next render disabled, no counter, [ / ] no-op", () => {
    sessionStorage.clear()
    mockShot()

    renderPage()

    expect(screen.getByTestId("shoot-prev")).toBeDisabled()
    expect(screen.getByTestId("shoot-next")).toBeDisabled()
    expect(screen.queryByTestId("shoot-shot-counter")).not.toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: "[" })
    fireEvent.keyDown(document.body, { key: "]" })
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it("[ and ] hardware keys keep working on the shell over the same order source", () => {
    writeShotListNavOrder("c1", "p1", ["s0", "s1", "s2"])
    mockShot()

    renderPage()

    fireEvent.keyDown(document.body, { key: "[" })
    expect(navigateSpy).toHaveBeenLastCalledWith("/projects/p1/shots/s0")

    fireEvent.keyDown(document.body, { key: "]" })
    expect(navigateSpy).toHaveBeenLastCalledWith("/projects/p1/shots/s2")
  })

  // ── Decision C — pending/offline indicators (own commit in 5e-II) ─────────

  it("no pending write: the pending indicator is absent", () => {
    mockShot()

    renderPage()

    expect(screen.queryByTestId("shoot-pending-indicator")).not.toBeInTheDocument()
  })

  it("pending write while ONLINE: indicator says it is syncing", () => {
    connectivityState.pending = true
    mockShot()

    renderPage()

    const indicator = screen.getByTestId("shoot-pending-indicator")
    expect(indicator).toHaveTextContent("Syncing…")
    // The pill row itself stays ENABLED — queued writes are the design, not
    // an error state (the tap that queued it already rendered optimistically).
    expect(screen.getByTestId("status-tap-todo")).not.toBeDisabled()
  })

  it("pending write while OFFLINE: indicator says the write is saved on-device and syncs on reconnect", () => {
    connectivityState.online = false
    connectivityState.pending = true
    mockShot()

    renderPage()

    expect(screen.getByTestId("shoot-pending-indicator")).toHaveTextContent(
      "Saved on this device — syncs when you’re back online",
    )
    expect(screen.getByTestId("status-tap-todo")).not.toBeDisabled()
  })

  it("passes the offline signal to the comment composer (queued-post affordance)", () => {
    connectivityState.online = false
    mockShot()

    renderPage()

    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-offline", "true")
  })

  it("online: the composer gets offline=false (the default await path)", () => {
    mockShot()

    renderPage()

    expect(screen.getByTestId("comments-stub")).toHaveAttribute("data-offline", "false")
  })
})
