/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks (declared before imports that depend on them)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "admin", clientId: "c1" }),
}))

// Project scope — hoisted ref so tests can swap between null and a value
const mockProjectScope: { current: { projectId: string; projectName: string } | null } = {
  current: { projectId: "p1", projectName: "Alpha Project" },
}

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useOptionalProjectScope: () => mockProjectScope.current,
}))

// Firestore — mock all the query builders + getDocs + Timestamp.fromMillis
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...args: unknown[]) => ({ __collection: args })),
  query: vi.fn((...args: unknown[]) => ({ __query: args })),
  where: vi.fn((...args: unknown[]) => ({ __where: args })),
  orderBy: vi.fn((...args: unknown[]) => ({ __orderBy: args })),
  limit: vi.fn((n: number) => ({ __limit: n })),
  getDocs: vi.fn(),
  Timestamp: {
    fromMillis: (ms: number) => ({ __ts: ms, toMillis: () => ms }),
  },
}))

vi.mock("@/shared/lib/firebase", () => ({
  db: { __fakeDb: true },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Alpha Project", clientId: "c1", status: "active", shootDates: [] },
    ],
  }),
}))

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductFamilies: () => ({
    data: [
      { id: "f1", styleName: "Beta Jacket", styleNumbers: ["BJ-001"] },
    ],
  }),
}))

vi.mock("@/features/library/hooks/useTalentLibrary", () => ({
  useTalentLibrary: () => ({
    data: [
      { id: "t1", name: "Jane Doe", agency: "Top Agency" },
    ],
  }),
}))

vi.mock("@/features/library/hooks/useCrewLibrary", () => ({
  useCrewLibrary: () => ({
    data: [
      { id: "cr1", name: "Bob Smith", position: "Director of Photography" },
    ],
  }),
}))

vi.mock("@/shared/lib/rbac", () => ({
  ROLE: { ADMIN: "admin", PRODUCER: "producer", CREW: "crew", WAREHOUSE: "warehouse", VIEWER: "viewer" },
}))

// ---------------------------------------------------------------------------
// Now import subject under test
// ---------------------------------------------------------------------------

import * as firestore from "firebase/firestore"
import { SearchCommandProvider, useSearchCommand } from "@/app/providers/SearchCommandProvider"
import { CommandPalette } from "@/shared/components/CommandPalette"

// ---------------------------------------------------------------------------
// Test fixtures for lazy-indexed entities
// ---------------------------------------------------------------------------

function makeShotDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      title: "Sunset Beach Shot",
      shotNumber: "A001",
      description: "Wide establishing shot",
      deleted: false,
      ...overrides,
    }),
  }
}

function makePullDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      title: "Wardrobe Pull",
      status: "draft",
      ...overrides,
    }),
  }
}

function makeLaneDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      name: "Evening Looks",
      sceneNumber: 3,
      sortOrder: 0,
      direction: "Handheld, moody lighting",
      ...overrides,
    }),
  }
}

/**
 * Primes firestore.getDocs mock to return shots, pulls, lanes in the order the
 * CommandPalette fetches them (Promise.all preserves call order). Caller
 * supplies the arrays; a new mock implementation is installed each call so the
 * lazy effect can be driven deterministically.
 */
function primeLazyFetch(params: {
  readonly shots?: ReadonlyArray<ReturnType<typeof makeShotDoc>>
  readonly pulls?: ReadonlyArray<ReturnType<typeof makePullDoc>>
  readonly lanes?: ReadonlyArray<ReturnType<typeof makeLaneDoc>>
}) {
  const responses = [
    { docs: params.shots ?? [] },
    { docs: params.pulls ?? [] },
    { docs: params.lanes ?? [] },
  ]
  let call = 0
  vi.mocked(firestore.getDocs).mockImplementation(async () => {
    const next = responses[call] ?? { docs: [] }
    call += 1
    return next as unknown as Awaited<ReturnType<typeof firestore.getDocs>>
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PaletteHarness({ initialOpen = false }: { readonly initialOpen?: boolean }) {
  return (
    <SearchCommandProvider>
      <OpenController initialOpen={initialOpen} />
      <CommandPalette />
    </SearchCommandProvider>
  )
}

function OpenController({ initialOpen }: { readonly initialOpen: boolean }) {
  const { setOpen } = useSearchCommand()
  return (
    <button type="button" onClick={() => setOpen(initialOpen)}>
      {initialOpen ? "open-palette" : "close-palette"}
    </button>
  )
}

function renderOpen() {
  const result = render(<PaletteHarness initialOpen />)
  fireEvent.click(screen.getByText("open-palette"))
  return result
}

// ---------------------------------------------------------------------------
// SearchCommandProvider tests
// ---------------------------------------------------------------------------

describe("SearchCommandProvider", () => {
  it("starts with open=false", () => {
    let capturedOpen: boolean | undefined
    function Inspector() {
      const { open } = useSearchCommand()
      capturedOpen = open
      return null
    }
    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )
    expect(capturedOpen).toBe(false)
  })

  it("setOpen(true) transitions open to true", () => {
    let capturedOpen: boolean | undefined
    let capturedSetOpen: ((v: boolean) => void) | undefined

    function Inspector() {
      const { open, setOpen } = useSearchCommand()
      capturedOpen = open
      capturedSetOpen = setOpen
      return null
    }

    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )

    act(() => capturedSetOpen!(true))
    expect(capturedOpen).toBe(true)
  })

  it("setOpen(false) transitions open back to false", () => {
    let capturedOpen: boolean | undefined
    let capturedSetOpen: ((v: boolean) => void) | undefined

    function Inspector() {
      const { open, setOpen } = useSearchCommand()
      capturedOpen = open
      capturedSetOpen = setOpen
      return null
    }

    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )

    act(() => capturedSetOpen!(true))
    expect(capturedOpen).toBe(true)
    act(() => capturedSetOpen!(false))
    expect(capturedOpen).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CommandPalette rendering tests
// ---------------------------------------------------------------------------

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: scoped to project p1, lazy fetch returns nothing
    mockProjectScope.current = { projectId: "p1", projectName: "Alpha Project" }
    primeLazyFetch({})
  })

  it("renders the palette when open", () => {
    renderOpen()
    expect(
      screen.getByPlaceholderText("Search projects, products, talent, crew..."),
    ).toBeInTheDocument()
  })

  it("does not render palette content when closed", () => {
    render(<PaletteHarness initialOpen={false} />)
    // dialog should not be open
    expect(
      screen.queryByPlaceholderText("Search projects, products, talent, crew..."),
    ).not.toBeInTheDocument()
  })

  it("shows Quick Actions when query is empty", () => {
    renderOpen()
    expect(screen.getByText("Create new project")).toBeInTheDocument()
    expect(screen.getByText("Create new shot request")).toBeInTheDocument()
    expect(screen.getByText("Go to Products")).toBeInTheDocument()
  })

  it("shows 'Go to Admin' for admin role", () => {
    renderOpen()
    expect(screen.getByText("Go to Admin")).toBeInTheDocument()
  })

  it("shows search results matching a project query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    expect(await screen.findByText("Alpha Project")).toBeInTheDocument()
  })

  it("shows search results matching a product query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Beta" } })
    expect(await screen.findByText("Beta Jacket")).toBeInTheDocument()
  })

  it("shows search results matching a talent query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Jane" } })
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument()
  })

  it("shows search results matching a crew query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Bob" } })
    expect(await screen.findByText("Bob Smith")).toBeInTheDocument()
  })

  it("navigates to project path on project item selection", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    const item = await screen.findByText("Alpha Project")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/shots")
  })

  it("navigates to product path on product item selection", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Beta" } })
    const item = await screen.findByText("Beta Jacket")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/products/f1")
  })

  it("navigates to /projects when 'Create new project' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Create new project"))
    expect(mockNavigate).toHaveBeenCalledWith("/projects")
  })

  it("navigates to /requests when 'Create new shot request' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Create new shot request"))
    expect(mockNavigate).toHaveBeenCalledWith("/requests")
  })

  it("navigates to /admin when 'Go to Admin' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Go to Admin"))
    expect(mockNavigate).toHaveBeenCalledWith("/admin")
  })

  it("stores navigated item in localStorage recent items", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    const item = await screen.findByText("Alpha Project")
    fireEvent.click(item)
    const stored = JSON.parse(localStorage.getItem("sb:cmd-recent") ?? "[]")
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe("p1")
    expect(stored[0].type).toBe("project")
    expect(stored[0].name).toBe("Alpha Project")
  })

  it("retrieves recent items from localStorage on open", () => {
    const recentData = [
      { id: "p99", type: "project", name: "Old Project", navigateTo: "/projects/p99/shots" },
    ]
    localStorage.setItem("sb:cmd-recent", JSON.stringify(recentData))
    renderOpen()
    expect(screen.getByText("Old Project")).toBeInTheDocument()
  })

  it("Cmd+K keyboard shortcut triggers open via document event", () => {
    let capturedOpen: boolean | undefined
    function Inspector() {
      const { open } = useSearchCommand()
      capturedOpen = open
      return null
    }
    render(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )
    expect(capturedOpen).toBe(false)
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
      )
    })
    expect(capturedOpen).toBe(true)
  })

  it("renders FolderOpen icon for project results", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    await screen.findByText("Alpha Project")
    // lucide-react renders svg with data-testid or class; check icon presence via svg in the list item
    const projectItem = screen.getByText("Alpha Project").closest("[cmdk-item]")
    expect(projectItem?.querySelector("svg")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Lazy project-scoped indexing (shots / pulls / scenes)
// ---------------------------------------------------------------------------

describe("CommandPalette — lazy project-scoped indexing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockProjectScope.current = { projectId: "p1", projectName: "Alpha Project" }
    primeLazyFetch({})
  })

  it("fetches shots, pulls, and lanes exactly once when palette opens inside a project", async () => {
    primeLazyFetch({
      shots: [makeShotDoc("s1")],
      pulls: [makePullDoc("pl1")],
      lanes: [makeLaneDoc("l1")],
    })
    renderOpen()

    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalledTimes(3)
    })

    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    // Typing should NOT trigger additional fetches — Fuse is in-memory
    fireEvent.change(input, { target: { value: "Sunset" } })
    fireEvent.change(input, { target: { value: "Wardrobe" } })
    expect(firestore.getDocs).toHaveBeenCalledTimes(3)
  })

  it("does NOT fetch shots/pulls/lanes when opened outside a project route", async () => {
    mockProjectScope.current = null
    renderOpen()

    // Give the effect a tick to run; still no fetches
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(firestore.getDocs).not.toHaveBeenCalled()

    // Existing non-project entries still render
    expect(screen.getByText("Create new project")).toBeInTheDocument()
  })

  it("renders a shot result and navigates to the shot detail route", async () => {
    primeLazyFetch({
      shots: [
        makeShotDoc("s1", {
          title: "Sunset Beach Shot",
          shotNumber: "A001",
          description: "Wide establishing shot",
        }),
      ],
    })
    renderOpen()
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalled())

    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Sunset" } })

    const item = await screen.findByText("Sunset Beach Shot")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/shots/s1")
  })

  it("renders a pull result and navigates to the pull detail route", async () => {
    primeLazyFetch({
      pulls: [
        makePullDoc("pl1", {
          title: "Hero Wardrobe Pull",
          status: "approved",
        }),
      ],
    })
    renderOpen()
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalled())

    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Hero" } })

    const item = await screen.findByText("Hero Wardrobe Pull")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/pulls/pl1")
  })

  it("renders a scene result with '#N name' format and navigates to the lane-filtered shots view", async () => {
    primeLazyFetch({
      lanes: [
        makeLaneDoc("l42", { name: "Evening Looks", sceneNumber: 3, direction: "Handheld" }),
      ],
    })
    renderOpen()
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalled())

    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Evening" } })

    const item = await screen.findByText("#3 Evening Looks")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/shots?scene=l42&group=scene")
  })

  it("does not re-fetch on a second open when the projectId is unchanged", async () => {
    primeLazyFetch({ shots: [makeShotDoc("s1")] })

    let outerSetOpen: ((v: boolean) => void) | undefined
    function Inspector() {
      const { setOpen } = useSearchCommand()
      outerSetOpen = setOpen
      return null
    }
    render(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )

    // Open #1
    act(() => outerSetOpen!(true))
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalledTimes(3))

    // Close
    act(() => outerSetOpen!(false))
    // Open #2 — same project
    act(() => outerSetOpen!(true))

    // Give any scheduled effect a chance to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(firestore.getDocs).toHaveBeenCalledTimes(3)
  })

  it("re-fetches when projectId changes between palette opens", async () => {
    // First open: p1 — prime once
    primeLazyFetch({ shots: [makeShotDoc("s1")] })

    let outerSetOpen: ((v: boolean) => void) | undefined
    function Inspector() {
      const { setOpen } = useSearchCommand()
      outerSetOpen = setOpen
      return null
    }
    const { rerender } = render(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )

    act(() => outerSetOpen!(true))
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalledTimes(3))
    act(() => outerSetOpen!(false))

    // Swap project & re-prime getDocs (reshuffles response order, not call count)
    mockProjectScope.current = { projectId: "p2", projectName: "Beta Project" }
    primeLazyFetch({ shots: [makeShotDoc("s99", { projectId: "p2" })] })

    rerender(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )

    act(() => outerSetOpen!(true))
    // p1 already fetched (3 calls) + p2 now triggers another 3 calls = 6 total
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalledTimes(6))
  })

  it("issues the expected Firestore constraints for each collection", async () => {
    // Freeze Date.now to a known value without swapping the scheduler —
    // fake timers break @testing-library's waitFor because it uses real setTimeout.
    const frozenNow = new Date("2026-04-14T12:00:00Z").getTime()
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(frozenNow)
    try {
      primeLazyFetch({
        shots: [makeShotDoc("s1")],
        pulls: [makePullDoc("pl1")],
        lanes: [makeLaneDoc("l1")],
      })
      renderOpen()

      await waitFor(() => {
        expect(firestore.getDocs).toHaveBeenCalledTimes(3)
      })

      const whereCalls = vi.mocked(firestore.where).mock.calls
      const orderByCalls = vi.mocked(firestore.orderBy).mock.calls
      const limitCalls = vi.mocked(firestore.limit).mock.calls

      // Shots-specific constraints
      expect(whereCalls).toContainEqual(["projectId", "==", "p1"])
      expect(whereCalls).toContainEqual(["deleted", "==", false])

      // Shots range filter on updatedAt; pulls intentionally drop the range filter
      // so legacy docs missing the field still appear.
      const updatedAtRangeCalls = whereCalls.filter(
        (c) => c[0] === "updatedAt" && c[1] === ">=",
      )
      expect(updatedAtRangeCalls).toHaveLength(1)
      // Verify the Timestamp matches the 30-day cutoff computed from the mocked clock
      const expectedCutoffMs = frozenNow - 30 * 24 * 60 * 60 * 1000
      expect(updatedAtRangeCalls[0]![2]).toMatchObject({ __ts: expectedCutoffMs })

      // orderBy: updatedAt desc twice (shots + pulls), sortOrder asc once (lanes)
      const updatedAtDescOrder = orderByCalls.filter(
        (c) => c[0] === "updatedAt" && c[1] === "desc",
      )
      const sortOrderAscOrder = orderByCalls.filter(
        (c) => c[0] === "sortOrder" && c[1] === "asc",
      )
      expect(updatedAtDescOrder).toHaveLength(2)
      expect(sortOrderAscOrder).toHaveLength(1)

      // limit(200) called once per collection
      expect(limitCalls).toHaveLength(3)
      for (const call of limitCalls) {
        expect(call[0]).toBe(200)
      }
    } finally {
      dateNowSpy.mockRestore()
    }
  })

  it("populates the cache on the very first open under StrictMode (no double-fetch race)", async () => {
    const { StrictMode } = await import("react")
    primeLazyFetch({ shots: [makeShotDoc("s1", { title: "Moonrise Shot" })] })

    render(
      <StrictMode>
        <PaletteHarness initialOpen />
      </StrictMode>,
    )
    fireEvent.click(screen.getByText("open-palette"))

    // First open should hit Firestore exactly 3 times (one per collection).
    // StrictMode double-invokes effects, but the promise-memoization guard
    // ensures mount #2 awaits mount #1's in-flight promise rather than
    // firing a second fetch.
    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalledTimes(3)
    })

    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Moonrise" } })
    expect(await screen.findByText("Moonrise Shot")).toBeInTheDocument()
  })

  it("purges stale entries synchronously when switching projects without closing", async () => {
    // First project: p1 with one distinctive shot
    primeLazyFetch({ shots: [makeShotDoc("s1", { title: "Alpha Only Shot" })] })

    let outerSetOpen: ((v: boolean) => void) | undefined
    function Inspector() {
      const { setOpen } = useSearchCommand()
      outerSetOpen = setOpen
      return null
    }
    const { rerender } = render(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )

    act(() => outerSetOpen!(true))
    await waitFor(() => expect(firestore.getDocs).toHaveBeenCalledTimes(3))

    // Verify the p1 shot is indexed and searchable
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha Only" } })
    expect(await screen.findByText("Alpha Only Shot")).toBeInTheDocument()

    // Swap projects mid-flight with a deferred promise for the p2 fetch
    let resolveP2: ((value: unknown) => void) | undefined
    const p2Promise = new Promise((resolve) => {
      resolveP2 = resolve
    })
    vi.mocked(firestore.getDocs).mockImplementation(
      () => p2Promise as unknown as ReturnType<typeof firestore.getDocs>,
    )
    mockProjectScope.current = { projectId: "p2", projectName: "Beta Project" }

    // Re-render to propagate the new projectScope. The palette stays open.
    rerender(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )

    // Give the single merged effect a tick to purge stale p1 state.
    await act(async () => {
      await Promise.resolve()
    })

    // Stale p1 shot should no longer match any query while p2 fetch is pending.
    fireEvent.change(input, { target: { value: "Alpha Only" } })
    await waitFor(() => {
      expect(screen.queryByText("Alpha Only Shot")).not.toBeInTheDocument()
    })

    // Resolve the stalled p2 fetch so the test doesn't leak a promise.
    resolveP2?.({ docs: [] })
  })
})
