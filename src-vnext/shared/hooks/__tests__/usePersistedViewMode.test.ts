import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePersistedViewMode } from "@/shared/hooks/usePersistedViewMode"

describe("usePersistedViewMode", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("returns default mode when localStorage is empty", () => {
    const { result } = renderHook(() =>
      usePersistedViewMode("sb:test-view", "grid", ["grid", "table"] as const),
    )
    expect(result.current[0]).toBe("grid")
  })

  it("returns stored mode when valid", () => {
    localStorage.setItem("sb:test-view", "table")
    const { result } = renderHook(() =>
      usePersistedViewMode("sb:test-view", "grid", ["grid", "table"] as const),
    )
    expect(result.current[0]).toBe("table")
  })

  it("falls back to default when stored value is invalid", () => {
    localStorage.setItem("sb:test-view", "invalid-mode")
    const { result } = renderHook(() =>
      usePersistedViewMode("sb:test-view", "grid", ["grid", "table"] as const),
    )
    expect(result.current[0]).toBe("grid")
  })

  it("persists mode to localStorage when setMode is called", () => {
    const { result } = renderHook(() =>
      usePersistedViewMode("sb:test-view", "grid", ["grid", "table"] as const),
    )
    act(() => {
      result.current[1]("table")
    })
    expect(localStorage.getItem("sb:test-view")).toBe("table")
  })

  it("updates current value after setMode", () => {
    const { result } = renderHook(() =>
      usePersistedViewMode("sb:test-view", "grid", ["grid", "table"] as const),
    )
    act(() => {
      result.current[1]("table")
    })
    expect(result.current[0]).toBe("table")
  })
})
