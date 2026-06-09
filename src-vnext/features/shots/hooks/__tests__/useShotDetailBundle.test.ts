import { describe, it, expect, vi, beforeEach } from "vitest"

const mockUseShot = vi.fn()
const mockUseLanes = vi.fn()

vi.mock("@/features/shots/hooks/useShot", () => ({
  useShot: (...args: unknown[]) => mockUseShot(...args),
}))
vi.mock("@/features/shots/hooks/useLanes", () => ({
  useLanes: (...args: unknown[]) => mockUseLanes(...args),
}))

import { useShotDetailBundle } from "../useShotDetailBundle"

describe("useShotDetailBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseShot.mockReturnValue({ data: null, loading: false, error: null })
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: null,
    })
  })

  it("passes shotId straight through to useShot", () => {
    useShotDetailBundle("shot-abc")
    expect(mockUseShot).toHaveBeenCalledWith("shot-abc")
  })

  it("returns shot data, laneById map, loading, and error", () => {
    const shot = { id: "shot-abc", title: "Hero" }
    const laneById = new Map([["lane-1", { id: "lane-1" }]])
    mockUseShot.mockReturnValue({ data: shot, loading: false, error: null })
    mockUseLanes.mockReturnValue({
      data: [{ id: "lane-1" }],
      laneById,
      laneNameById: new Map([["lane-1", "Scene 1"]]),
      loading: false,
      error: null,
    })

    const result = useShotDetailBundle("shot-abc")
    expect(result.shot).toBe(shot)
    expect(result.laneById).toBe(laneById)
    expect(result.loading).toBe(false)
    expect(result.error).toBe(null)
  })

  it("loading is true when either inner hook is loading", () => {
    mockUseShot.mockReturnValue({ data: null, loading: true, error: null })
    const result = useShotDetailBundle("shot-abc")
    expect(result.loading).toBe(true)
  })

  it("surfaces useShot error as the bundle error", () => {
    mockUseShot.mockReturnValue({
      data: null,
      loading: false,
      error: "shot not found",
    })
    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe("shot not found")
  })

  it("normalises a FirestoreCollectionError-shaped lanes error", () => {
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: { message: "missing lanes index", isMissingIndex: true },
    })
    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe("missing lanes index")
  })

  // ── lanes crash carve-out (Phase 2) ─────────────────────────────────────
  // A non-member global crew/warehouse/viewer reads the shot (wide /shots
  // rule) but is denied the project-scoped lanes read. The bundle must NOT
  // turn that permission-denied into a fatal error (which blanked the whole
  // shot page); the shot still renders, scene context degrades to empty.

  it("does NOT make a lanes permission-denied fatal — page can still render", () => {
    const shot = { id: "shot-abc", title: "Hero", laneId: null }
    mockUseShot.mockReturnValue({ data: shot, loading: false, error: null })
    // Production-shaped FirestoreCollectionError: useFirestoreCollection now
    // carries err.code through. Firebase sets code 'permission-denied' on a
    // rules-denied read; its message is "Missing or insufficient permissions".
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: {
        message: "Missing or insufficient permissions.",
        isMissingIndex: false,
        code: "permission-denied",
      },
    })

    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe(null) // swallowed — not fatal
    expect(result.shot).toBe(shot) // shot still rendered
    expect(result.lanesUnavailable).toBe(true) // soft degrade signal
    expect(result.laneById.size).toBe(0) // empty → banner returns null
  })

  it("keeps a shot.error fatal even when lanes are permission-denied", () => {
    mockUseShot.mockReturnValue({
      data: null,
      loading: false,
      error: "shot not found",
    })
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: {
        message: "Missing or insufficient permissions.",
        isMissingIndex: false,
        code: "permission-denied",
      },
    })

    const result = useShotDetailBundle("shot-abc")
    // shot.error wins; the swallowed lanes permission-denied never masks it.
    expect(result.error).toBe("shot not found")
  })

  it("for a project member, lane data still flows into the maps", () => {
    const shot = { id: "shot-abc", title: "Hero", laneId: "lane-1" }
    const laneById = new Map([["lane-1", { id: "lane-1", name: "Scene 1" }]])
    const laneNameById = new Map([["lane-1", "Scene 1"]])
    mockUseShot.mockReturnValue({ data: shot, loading: false, error: null })
    mockUseLanes.mockReturnValue({
      data: [{ id: "lane-1", name: "Scene 1" }],
      laneById,
      laneNameById,
      loading: false,
      error: null,
    })

    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe(null)
    expect(result.lanesUnavailable).toBe(false)
    expect(result.laneById).toBe(laneById)
    expect(result.laneNameById).toBe(laneNameById)
  })

  it("keeps a NON-permission lanes error fatal (e.g. missing index)", () => {
    // Discriminate strictly on code === 'permission-denied'. A missing-index
    // (failed-precondition) must STAY fatal/visible so a real regression on
    // the lanes orderBy('sortOrder') query isn't hidden as a silent banner
    // disappearance (testing-discipline).
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: {
        message: "This view requires a database index that hasn't been created yet.",
        isMissingIndex: true,
        code: "failed-precondition",
      },
    })

    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe(
      "This view requires a database index that hasn't been created yet.",
    )
    expect(result.lanesUnavailable).toBe(false)
  })

  it("keeps a lanes network/unavailable error fatal", () => {
    mockUseLanes.mockReturnValue({
      data: [],
      laneById: new Map(),
      laneNameById: new Map(),
      loading: false,
      error: {
        message: "The service is currently unavailable.",
        isMissingIndex: false,
        code: "unavailable",
      },
    })

    const result = useShotDetailBundle("shot-abc")
    expect(result.error).toBe("The service is currently unavailable.")
    expect(result.lanesUnavailable).toBe(false)
  })
})
