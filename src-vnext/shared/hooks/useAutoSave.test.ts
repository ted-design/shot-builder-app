import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAutoSave } from "./useAutoSave"

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts in idle state", () => {
    const { result } = renderHook(() => useAutoSave())
    expect(result.current.saveState).toBe("idle")
  })

  it("transitions to saving after debounce delay", async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ delay: 100 }))

    act(() => {
      result.current.scheduleSave(saveFn)
    })

    // Still idle during debounce
    expect(result.current.saveState).toBe("idle")

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(saveFn).toHaveBeenCalledOnce()
  })

  it("transitions idle → saving → saved → idle", async () => {
    let resolveSave: () => void = () => {}
    const saveFn = vi.fn(
      () => new Promise<void>((resolve) => { resolveSave = resolve }),
    )
    const { result } = renderHook(() =>
      useAutoSave({ delay: 100, savedDuration: 200 }),
    )

    act(() => {
      result.current.scheduleSave(saveFn)
    })
    expect(result.current.saveState).toBe("idle")

    // Trigger the debounced save
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.saveState).toBe("saving")

    // Resolve the save
    await act(async () => {
      resolveSave()
    })
    expect(result.current.saveState).toBe("saved")

    // Wait for savedDuration
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.saveState).toBe("idle")
  })

  it("transitions to error on save failure", async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error("fail"))
    const { result } = renderHook(() => useAutoSave({ delay: 50 }))

    act(() => {
      result.current.scheduleSave(saveFn)
    })

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current.saveState).toBe("error")
  })

  it("debounces multiple rapid calls", async () => {
    const saveFn1 = vi.fn().mockResolvedValue(undefined)
    const saveFn2 = vi.fn().mockResolvedValue(undefined)
    const saveFn3 = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ delay: 100 }))

    act(() => {
      result.current.scheduleSave(saveFn1)
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    act(() => {
      result.current.scheduleSave(saveFn2)
    })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    act(() => {
      result.current.scheduleSave(saveFn3)
    })

    // Advance past debounce from last call
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Only the last saveFn should be called
    expect(saveFn1).not.toHaveBeenCalled()
    expect(saveFn2).not.toHaveBeenCalled()
    expect(saveFn3).toHaveBeenCalledOnce()
  })

  it("flush() executes pending save immediately", async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ delay: 1000 }))

    act(() => {
      result.current.scheduleSave(saveFn)
    })

    // Flush before debounce would fire
    await act(async () => {
      result.current.flush()
    })

    expect(saveFn).toHaveBeenCalledOnce()
  })

  it("flush() is a no-op when nothing is pending", async () => {
    const { result } = renderHook(() => useAutoSave())

    await act(async () => {
      result.current.flush()
    })

    expect(result.current.saveState).toBe("idle")
  })

  it("cancel() clears pending save and returns to idle", async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave({ delay: 100 }))

    act(() => {
      result.current.scheduleSave(saveFn)
    })

    // Cancel before debounce fires
    act(() => {
      result.current.cancel()
    })

    // Advance past debounce — should not fire
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.saveState).toBe("idle")
  })

  it("uses default delay of 1500ms", async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave())

    act(() => {
      result.current.scheduleSave(saveFn)
    })

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(saveFn).toHaveBeenCalledOnce()
  })
})
