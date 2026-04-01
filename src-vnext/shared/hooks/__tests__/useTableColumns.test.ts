import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTableColumns } from "@/shared/hooks/useTableColumns"
import type { TableColumnConfig } from "@/shared/types/table"

const DEFAULTS: readonly TableColumnConfig[] = [
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 0, pinned: true },
  { key: "email", label: "Email", defaultLabel: "Email", visible: true, width: 180, order: 1 },
  { key: "phone", label: "Phone", defaultLabel: "Phone", visible: true, width: 120, order: 2 },
]

describe("useTableColumns", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("returns default columns when localStorage is empty", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    expect(result.current.columns).toHaveLength(3)
    expect(result.current.columns.map((c) => c.key)).toEqual(["name", "email", "phone"])
  })

  it("persists column changes to localStorage", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.setColumnWidth("name", 300)
    })
    const stored = localStorage.getItem("sb:test-table")
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as TableColumnConfig[]
    const nameCol = parsed.find((c) => c.key === "name")
    expect(nameCol?.width).toBe(300)
  })

  it("toggleVisibility flips the visible flag", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.toggleVisibility("email")
    })
    const emailCol = result.current.columns.find((c) => c.key === "email")
    expect(emailCol?.visible).toBe(false)
    expect(result.current.visibleColumns.find((c) => c.key === "email")).toBeUndefined()
  })

  it("toggleVisibility does not toggle pinned columns", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.toggleVisibility("name") // pinned
    })
    const nameCol = result.current.columns.find((c) => c.key === "name")
    expect(nameCol?.visible).toBe(true)
  })

  it("reorderColumns updates order values", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.reorderColumns(["phone", "name", "email"])
    })
    const keys = result.current.columns
      .toSorted((a, b) => a.order - b.order)
      .map((c) => c.key)
    expect(keys).toEqual(["phone", "name", "email"])
  })

  it("resetToDefaults clears saved config", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    // Make a change first
    act(() => {
      result.current.setColumnWidth("name", 300)
    })
    expect(localStorage.getItem("sb:test-table")).toBeTruthy()

    // Reset
    act(() => {
      result.current.resetToDefaults()
    })
    expect(localStorage.getItem("sb:test-table")).toBeNull()
    expect(result.current.columns.find((c) => c.key === "name")?.width).toBe(200)
  })

  it("visibleColumns returns only visible columns sorted by order", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.toggleVisibility("email")
    })
    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(["name", "phone"])
  })

  it("setColumnWidth clamps to min 60 and max 600", () => {
    const { result } = renderHook(() =>
      useTableColumns("test-table", DEFAULTS),
    )
    act(() => {
      result.current.setColumnWidth("name", 10)
    })
    expect(result.current.columns.find((c) => c.key === "name")?.width).toBe(60)

    act(() => {
      result.current.setColumnWidth("name", 1000)
    })
    expect(result.current.columns.find((c) => c.key === "name")?.width).toBe(600)
  })
})
