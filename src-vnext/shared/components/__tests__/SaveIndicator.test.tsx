import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { SaveIndicator } from "@/shared/components/SaveIndicator"

describe("SaveIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when savedAt is null", () => {
    const { container } = render(<SaveIndicator savedAt={null} />)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it("renders 'Saved' immediately after a save lands (within the 3s recent threshold)", () => {
    const savedAt = Date.now() // 2026-04-15T12:00:00Z

    render(<SaveIndicator savedAt={savedAt} />)
    const pill = screen.getByRole("status")
    expect(pill).toHaveTextContent("Saved")
    expect(pill.textContent).not.toMatch(/ago/)
  })

  it("renders 'Saved 5s ago' after the first 5s interval tick", () => {
    const savedAt = Date.now()
    render(<SaveIndicator savedAt={savedAt} />)

    // advanceTimersByTime advances BOTH the fake clock and fake timers
    // by the same amount, so Date.now() inside the interval callback
    // returns savedAt + 5000 after a single tick.
    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByRole("status")).toHaveTextContent("Saved 5s ago")
  })

  it("renders 'Saved 1m ago' after advancing 65 seconds (13 interval ticks)", () => {
    const savedAt = Date.now()
    render(<SaveIndicator savedAt={savedAt} />)

    act(() => {
      vi.advanceTimersByTime(65_000)
    })

    expect(screen.getByRole("status")).toHaveTextContent("Saved 1m ago")
  })

  it("cleans up its interval on unmount (no stray timers)", () => {
    const savedAt = Date.now()
    const { unmount } = render(<SaveIndicator savedAt={savedAt} />)

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("resets its relative counter when savedAt changes to a new timestamp", () => {
    const firstSavedAt = Date.now()
    const { rerender } = render(<SaveIndicator savedAt={firstSavedAt} />)

    // Advance past the recent threshold so the pill shows relative
    // time based on firstSavedAt.
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByRole("status")).toHaveTextContent("Saved 10s ago")

    // A new save lands at the advanced clock, and the parent re-renders
    // with the new savedAt.
    const secondSavedAt = Date.now()
    rerender(<SaveIndicator savedAt={secondSavedAt} />)

    // Immediately after the rerender, the pill should be back to
    // "Saved" (fresh save, within the 3s threshold).
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    expect(screen.getByRole("status").textContent).not.toMatch(/ago/)
  })
})
