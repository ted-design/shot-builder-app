import { describe, it, expect } from "vitest"
import { normalizeColumns, type TableColumnConfig } from "@/shared/types/table"

const DEFAULTS: readonly TableColumnConfig[] = [
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 0, pinned: true },
  { key: "email", label: "Email", defaultLabel: "Email", visible: true, width: 180, order: 1, sortable: true },
  { key: "phone", label: "Phone", defaultLabel: "Phone", visible: true, width: 120, order: 2 },
]

describe("normalizeColumns", () => {
  it("adds new defaults when saved is empty", () => {
    const result = normalizeColumns([], DEFAULTS)
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.key)).toEqual(["name", "email", "phone"])
  })

  it("preserves saved config (visibility, width, order)", () => {
    const saved: readonly TableColumnConfig[] = [
      { key: "name", label: "Full Name", defaultLabel: "Name", visible: true, width: 250, order: 1 },
      { key: "email", label: "Email", defaultLabel: "Email", visible: false, width: 160, order: 0 },
    ]
    const result = normalizeColumns(saved, DEFAULTS)

    const nameCol = result.find((c) => c.key === "name")!
    expect(nameCol.label).toBe("Full Name")
    expect(nameCol.width).toBe(250)
    expect(nameCol.order).toBe(1)
    expect(nameCol.pinned).toBe(true) // preserved from defaults

    const emailCol = result.find((c) => c.key === "email")!
    expect(emailCol.visible).toBe(false)
    expect(emailCol.width).toBe(160)
    expect(emailCol.order).toBe(0)
  })

  it("removes saved columns that no longer exist in defaults", () => {
    const saved: readonly TableColumnConfig[] = [
      { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 0 },
      { key: "deleted_col", label: "Deleted", defaultLabel: "Deleted", visible: true, width: 100, order: 1 },
    ]
    const result = normalizeColumns(saved, DEFAULTS)
    expect(result.find((c) => c.key === "deleted_col")).toBeUndefined()
  })

  it("adds new default columns that don't exist in saved", () => {
    const saved: readonly TableColumnConfig[] = [
      { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 0 },
    ]
    const result = normalizeColumns(saved, DEFAULTS)
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.key)).toContain("email")
    expect(result.map((c) => c.key)).toContain("phone")
  })

  it("returns sorted by order", () => {
    const saved: readonly TableColumnConfig[] = [
      { key: "phone", label: "Phone", defaultLabel: "Phone", visible: true, width: 120, order: 0 },
      { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 2 },
      { key: "email", label: "Email", defaultLabel: "Email", visible: true, width: 180, order: 1 },
    ]
    const result = normalizeColumns(saved, DEFAULTS)
    expect(result[0]!.key).toBe("phone")
    expect(result[1]!.key).toBe("email")
    expect(result[2]!.key).toBe("name")
  })
})
