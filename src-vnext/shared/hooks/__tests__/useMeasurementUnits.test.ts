import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useMeasurementUnits } from "@/shared/hooks/useMeasurementUnits"

const STORAGE_KEY = "sb:measurement-units"

describe("useMeasurementUnits", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it("defaults to imperial when localStorage is empty", () => {
    const { result } = renderHook(() => useMeasurementUnits())
    expect(result.current.system).toBe("imperial")
  })

  it("reads a stored metric preference", () => {
    localStorage.setItem(STORAGE_KEY, "metric")
    const { result } = renderHook(() => useMeasurementUnits())
    expect(result.current.system).toBe("metric")
  })

  it("falls back to imperial for an invalid stored value", () => {
    localStorage.setItem(STORAGE_KEY, "bogus")
    const { result } = renderHook(() => useMeasurementUnits())
    expect(result.current.system).toBe("imperial")
  })

  it("setSystem persists to localStorage and updates the value", () => {
    const { result } = renderHook(() => useMeasurementUnits())
    act(() => {
      result.current.setSystem("metric")
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe("metric")
    expect(result.current.system).toBe("metric")
  })

  it("toggle flips between imperial and metric", () => {
    const { result } = renderHook(() => useMeasurementUnits())
    act(() => {
      result.current.toggle()
    })
    expect(result.current.system).toBe("metric")
    act(() => {
      result.current.toggle()
    })
    expect(result.current.system).toBe("imperial")
  })

  it("notifies all mounted consumers via the custom event", () => {
    const a = renderHook(() => useMeasurementUnits())
    const b = renderHook(() => useMeasurementUnits())
    act(() => {
      a.result.current.setSystem("metric")
    })
    expect(a.result.current.system).toBe("metric")
    expect(b.result.current.system).toBe("metric")
  })
})
