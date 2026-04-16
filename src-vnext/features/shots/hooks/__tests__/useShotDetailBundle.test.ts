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
})
