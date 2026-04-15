import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLastSaved } from "@/shared/hooks/useLastSaved"

describe("useLastSaved", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts with savedAt === null", () => {
    const { result } = renderHook(() => useLastSaved())
    expect(result.current.savedAt).toBeNull()
  })

  it("sets savedAt to Date.now() after markSaved()", () => {
    const { result } = renderHook(() => useLastSaved())
    const expected = Date.now()

    act(() => {
      result.current.markSaved()
    })

    expect(result.current.savedAt).toBe(expected)
  })

  it("advances savedAt when markSaved is called again at a later time", () => {
    const { result } = renderHook(() => useLastSaved())

    act(() => {
      result.current.markSaved()
    })
    const first = result.current.savedAt ?? 0

    // Advance the system clock and mark again.
    vi.setSystemTime(new Date("2026-04-15T12:00:10Z"))
    act(() => {
      result.current.markSaved()
    })
    const second = result.current.savedAt ?? 0

    expect(second).toBeGreaterThan(first)
    expect(second - first).toBe(10_000)
  })

  it("reset() returns savedAt to null", () => {
    const { result } = renderHook(() => useLastSaved())

    act(() => {
      result.current.markSaved()
    })
    expect(result.current.savedAt).not.toBeNull()

    act(() => {
      result.current.reset()
    })
    expect(result.current.savedAt).toBeNull()
  })
})
