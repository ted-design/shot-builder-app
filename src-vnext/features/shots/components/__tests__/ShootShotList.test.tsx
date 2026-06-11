/// <reference types="@testing-library/jest-dom" />
// 5e-II — the Shoot LIST shell (compact tappable rows) and its mount fork in
// ShotListPage.
//
// Renders through the ShotListPage default export so the real fork is
// exercised: isFeatureEnabled('featureShootSurface') && resolved
// surface === 'shoot'. resolveSurface/useResolvedSurface are REAL — only
// their inputs (flags / effective role / media queries) are mocked, so the
// surface keying is the actual resolver, not a stub (the
// ShootShotDetail.test.tsx convention).
//
// Pins:
//   - flag OFF: the shell never mounts — crew renders the existing card grid
//     (the existing ShotListPage suite is the byte-identical contract; this
//     file only pins the absence of the shell)
//   - crew + flag ON: compact rows in DISPLAY order (Decision G — full
//     project list), with status badge + talent line; the full toolbar
//     (search/sort/filter + view switcher) does NOT mount (chrome.toolbar
//     'minimal'); card/table forks absent
//   - legacy projectId=='' shots FILTERED with the quiet count note
//     (Decision D) and EXCLUDED from the tap's nav-order snapshot
//   - tapping a row writes the per-tab nav order (filtered) and navigates to
//     the detail route (the handleShotClick contract)
//   - shell keeps the showCreate-gated quick-add (chrome.quickAdd)
//   - surface-keyed, not device-keyed: desktop crew get the same rows
//     (Decision F); producer + flag ON never gets the shell (plan-build)
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
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
  useTalent: () => ({
    data: [
      { id: "t1", name: "Malik R." },
      { id: "t2", name: "Dana K." },
    ],
    loading: false,
    error: null,
  }),
  useLocations: () => ({ data: [], loading: false, error: null }),
  useProductFamilies: () => ({ data: [], loading: false, error: null }),
}))

// Global claim crew — the shoot-surface population. The producer pin flips it.
const authState = vi.hoisted(() => ({ role: "crew" }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: authState.role,
    clientId: "c1",
    user: { uid: "u1" },
    loading: false,
  }),
}))

const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role ?? authState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

// Phone by default — the shell is phone-first; the Decision-F pin flips it.
const deviceState = vi.hoisted(() => ({
  device: "mobile" as "mobile" | "tablet" | "desktop",
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => deviceState.device === "mobile",
  useIsTablet: () => deviceState.device === "tablet",
  useIsDesktop: () => deviceState.device === "desktop",
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

vi.mock("@/features/shots/components/CreateShotDialog", () => ({
  CreateShotDialog: () => null,
}))

vi.mock("@/features/pulls/components/CreatePullFromShotsDialog", () => ({
  CreatePullFromShotsDialog: () => null,
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

function mockShots(shots: ReadonlyArray<Shot>) {
  ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: shots,
    loading: false,
    error: null,
  })
}

// Display order = sortOrder (the 'custom' default sort).
const FIXTURE: ReadonlyArray<Shot> = [
  makeShot({
    id: "a",
    title: "Alpha",
    shotNumber: "1",
    sortOrder: 0,
    status: "in_progress",
    talentIds: ["t1", "t2"],
  }),
  makeShot({ id: "b", title: "Bravo", shotNumber: "2", sortOrder: 1, status: "todo" }),
  makeShot({ id: "c", title: "Charlie", shotNumber: "3", sortOrder: 2, status: "complete" }),
]

function renderPage(initialEntry = "/projects/p1/shots") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:id/shots" element={<ShotListPage />} />
        <Route path="/projects/:id/shots/:sid" element={<div>Shot detail route</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShootShotList (the 5e-II Shoot list shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    authState.role = "crew"
    effectiveState.role = null
    effectiveState.resolving = false
    deviceState.device = "mobile"
    flagState.shootSurface = true
  })

  it("flag OFF: the shell never mounts — crew renders the existing card grid", () => {
    flagState.shootSurface = false
    mockShots(FIXTURE)

    renderPage()

    expect(screen.queryByTestId("shoot-shot-list")).not.toBeInTheDocument()
    // The legacy mobile card grid is the render (existing suite's contract).
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("crew + flag ON: compact rows in display order with status badge + talent line; toolbar chrome absent", () => {
    mockShots(FIXTURE)

    renderPage()

    expect(screen.getByTestId("shoot-shot-list")).toBeInTheDocument()

    // Rows in display (sortOrder) order — Decision G: the full project list.
    const rows = screen.getAllByTestId("shoot-shot-row")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Alpha")
    expect(rows[1]).toHaveTextContent("Bravo")
    expect(rows[2]).toHaveTextContent("Charlie")

    // Row anatomy: shot number, status badge label, talent line.
    expect(within(rows[0]!).getByText("#1")).toBeInTheDocument()
    expect(within(rows[0]!).getByTestId("shoot-row-status")).toHaveTextContent("In Progress")
    expect(within(rows[0]!).getByTestId("shoot-row-talent")).toHaveTextContent(
      "Malik R. · Dana K.",
    )

    // chrome.toolbar 'minimal': no search/sort/filter toolbar, no view
    // switcher, no table.
    expect(screen.queryByPlaceholderText("Search shots…")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Card view")).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("filters legacy projectId=='' shots with the quiet count note (Decision D)", () => {
    mockShots([
      ...FIXTURE,
      makeShot({ id: "legacy", title: "Orphan", projectId: "", sortOrder: 3 }),
    ])

    renderPage()

    const rows = screen.getAllByTestId("shoot-shot-row")
    expect(rows).toHaveLength(3)
    expect(screen.queryByText("Orphan")).not.toBeInTheDocument()
    expect(screen.getByTestId("shoot-legacy-hidden-note")).toHaveTextContent(
      "1 legacy shot hidden — ask a producer",
    )
  })

  it("tapping a row writes the FILTERED per-tab nav order and navigates to the detail route", () => {
    mockShots([
      ...FIXTURE,
      makeShot({ id: "legacy", title: "Orphan", projectId: "", sortOrder: 3 }),
    ])

    renderPage()

    fireEvent.click(screen.getByText("Bravo"))

    expect(screen.getByText("Shot detail route")).toBeInTheDocument()
    // Nav order excludes the hidden legacy shot — the detail shell's
    // prev/next must never land on it.
    const raw = window.sessionStorage.getItem("sb:shots:nav-order:c1:p1")
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(["a", "b", "c"])
  })

  it("keeps the showCreate-gated quick-add on the shell (chrome.quickAdd)", () => {
    mockShots(FIXTURE)

    renderPage()

    // Crew pass canManageShots — the one minimal create affordance stays.
    expect(
      screen.getByPlaceholderText("New shot title... (press Enter to create)"),
    ).toBeInTheDocument()
  })

  it("renders only the quiet note when every display shot is legacy", () => {
    mockShots([
      makeShot({ id: "l1", title: "Orphan 1", projectId: "", sortOrder: 0 }),
      makeShot({ id: "l2", title: "Orphan 2", projectId: "", sortOrder: 1 }),
    ])

    renderPage()

    expect(screen.queryAllByTestId("shoot-shot-row")).toHaveLength(0)
    expect(screen.getByTestId("shoot-legacy-hidden-note")).toHaveTextContent(
      "2 legacy shots hidden — ask a producer",
    )
  })

  it("desktop crew get the same shell (surface-keyed, not device-keyed — Decision F)", () => {
    deviceState.device = "desktop"
    mockShots(FIXTURE)

    renderPage()

    expect(screen.getByTestId("shoot-shot-list")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("ignores lingering deep-link filters: a ?status subset never hides shell rows (Codex #442 P2; Decision G full list)", () => {
    mockShots(FIXTURE)

    // Under the producer surface this filter would subset to the one todo
    // shot; the shell renders no filter controls, so it must show all three.
    renderPage("/projects/p1/shots?filters=" + encodeURIComponent("status.in:todo"))

    const rows = screen.getAllByTestId("shoot-shot-row")
    expect(rows).toHaveLength(3)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Bravo")).toBeInTheDocument()
    expect(screen.getByText("Charlie")).toBeInTheDocument()
  })

  it("producer + flag ON: no shell — plan-build keeps the card/table surface", () => {
    authState.role = "producer"
    deviceState.device = "desktop"
    mockShots(FIXTURE)

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.queryByTestId("shoot-shot-list")).not.toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("project-promoted crew (global producer, member crew) get the shell — effective role drives the surface", () => {
    authState.role = "producer"
    effectiveState.role = "crew"
    mockShots(FIXTURE)

    renderPage()

    expect(screen.getByTestId("shoot-shot-list")).toBeInTheDocument()
  })
})
