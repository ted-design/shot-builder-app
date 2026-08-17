import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useColumnResize } from "@/shared/hooks/useColumnResize"

// requestAnimationFrame/cancelAnimationFrame are stubbed with a manually-driven
// queue so the test controls exactly when a "frame" flushes, rather than
// depending on jsdom's real rAF timing.
let rafCallbacks: Array<() => void>
let nextRafId: number

function flushRaf(): void {
  const callbacks = rafCallbacks
  rafCallbacks = []
  for (const cb of callbacks) cb()
}

function fireMouseMove(clientX: number): void {
  document.dispatchEvent(new MouseEvent("mousemove", { clientX }))
}

function fireMouseUp(): void {
  document.dispatchEvent(new MouseEvent("mouseup"))
}

describe("useColumnResize", () => {
  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 1
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafCallbacks.push(cb)
      return nextRafId++
    })
    vi.stubGlobal("cancelAnimationFrame", (_id: number) => {
      // Test queue is flushed manually via flushRaf(); nothing keyed by id.
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("coalesces rapid mousemoves into ≤1 onWidthChange call per animation frame, delivering the FINAL width", () => {
    const onWidthChange = vi.fn()
    const { result } = renderHook(() => useColumnResize({ onWidthChange }))

    act(() => {
      result.current.startResize("name", 100, 200)
    })

    // 10 mousemoves before the frame is flushed — simulates 10 pixel-level
    // moves happening faster than the browser paints.
    act(() => {
      for (let i = 1; i <= 10; i++) {
        fireMouseMove(100 + i * 5)
      }
    })

    expect(onWidthChange).not.toHaveBeenCalled()
    expect(rafCallbacks).toHaveLength(1) // only ONE frame scheduled for the whole burst

    act(() => {
      flushRaf()
    })

    expect(onWidthChange).toHaveBeenCalledTimes(1)
    expect(onWidthChange).toHaveBeenCalledWith("name", 250) // startWidth 200 + delta 50
  })

  it("clamps to minWidth/maxWidth while coalescing", () => {
    const onWidthChange = vi.fn()
    const { result } = renderHook(() =>
      useColumnResize({ onWidthChange, minWidth: 60, maxWidth: 600 }),
    )

    act(() => {
      result.current.startResize("name", 100, 200)
    })
    act(() => {
      fireMouseMove(-10000)
      flushRaf()
    })

    expect(onWidthChange).toHaveBeenCalledWith("name", 60)
  })

  it("flushes the pending frame and fires onResizeEnd exactly once on mouseup, even if the rAF never painted", () => {
    const onWidthChange = vi.fn()
    const onResizeEnd = vi.fn()
    const { result } = renderHook(() => useColumnResize({ onWidthChange, onResizeEnd }))

    act(() => {
      result.current.startResize("name", 100, 200)
    })
    act(() => {
      fireMouseMove(140) // pending width 240, not yet flushed by a frame
    })
    expect(onWidthChange).not.toHaveBeenCalled()

    act(() => {
      fireMouseUp()
    })

    expect(onWidthChange).toHaveBeenCalledTimes(1)
    expect(onWidthChange).toHaveBeenCalledWith("name", 240)
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith("name", 240)
  })

  it("reports the DRAGGED width on mouseup even when the last frame already flushed", () => {
    const onWidthChange = vi.fn()
    const onResizeEnd = vi.fn()
    const { result } = renderHook(() => useColumnResize({ onWidthChange, onResizeEnd }))

    act(() => {
      result.current.startResize("name", 100, 200)
    })
    act(() => {
      fireMouseMove(150) // width 250
      flushRaf() // the frame paints; the pending entry is consumed
    })
    expect(onWidthChange).toHaveBeenCalledWith("name", 250)

    act(() => {
      fireMouseUp() // user releases ≥1 frame after the last move — the common real drag
    })

    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith("name", 250)
  })

  it("reports onResizeEnd with the starting width when mouseup fires with no movement", () => {
    const onWidthChange = vi.fn()
    const onResizeEnd = vi.fn()
    const { result } = renderHook(() => useColumnResize({ onWidthChange, onResizeEnd }))

    act(() => {
      result.current.startResize("name", 100, 200)
    })
    act(() => {
      fireMouseUp()
    })

    expect(onWidthChange).not.toHaveBeenCalled()
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith("name", 200)
  })

  it("does not throw when onResizeEnd is omitted (backward-compatible for the 4 other table consumers)", () => {
    const onWidthChange = vi.fn()
    const { result } = renderHook(() => useColumnResize({ onWidthChange }))

    act(() => {
      result.current.startResize("name", 100, 200)
    })
    act(() => {
      fireMouseMove(120)
      flushRaf()
    })
    expect(() => {
      act(() => {
        fireMouseUp()
      })
    }).not.toThrow()

    expect(onWidthChange).toHaveBeenCalledTimes(1)
  })
})
