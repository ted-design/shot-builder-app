import { describe, it, expect } from "vitest"
import {
  mergeShareColumnConfig,
  PUBLIC_SHARE_COLUMNS,
  type ShareColumnEntry,
} from "../shotTableColumns"

describe("mergeShareColumnConfig", () => {
  it("returns PUBLIC_SHARE_COLUMNS when saved is null", () => {
    const result = mergeShareColumnConfig(null)
    expect(result).toBe(PUBLIC_SHARE_COLUMNS)
  })

  it("returns PUBLIC_SHARE_COLUMNS when saved is undefined", () => {
    const result = mergeShareColumnConfig(undefined)
    expect(result).toBe(PUBLIC_SHARE_COLUMNS)
  })

  it("returns PUBLIC_SHARE_COLUMNS when saved is empty array", () => {
    const result = mergeShareColumnConfig([])
    expect(result).toBe(PUBLIC_SHARE_COLUMNS)
  })

  it("applies saved visibility overrides", () => {
    const saved: ShareColumnEntry[] = [
      { key: "date", visible: false, order: 2 },
      { key: "tags", visible: false, order: 6 },
    ]
    const result = mergeShareColumnConfig(saved)
    const date = result.find((c) => c.key === "date")
    const tags = result.find((c) => c.key === "tags")
    expect(date?.visible).toBe(false)
    expect(tags?.visible).toBe(false)
  })

  it("applies saved order values and sorts by order", () => {
    const saved: ShareColumnEntry[] = [
      { key: "status", visible: true, order: 0 },
      { key: "tags", visible: true, order: 1 },
    ]
    const result = mergeShareColumnConfig(saved)
    // status (saved order 0) should come before tags (saved order 1)
    const statusIdx = result.findIndex((c) => c.key === "status")
    const tagsIdx = result.findIndex((c) => c.key === "tags")
    expect(statusIdx).toBeLessThan(tagsIdx)
  })

  it("includes default columns missing from saved config", () => {
    const saved: ShareColumnEntry[] = [
      { key: "shot", visible: true, order: 0 },
    ]
    const result = mergeShareColumnConfig(saved)
    expect(result.length).toBe(PUBLIC_SHARE_COLUMNS.length)
    const hasAll = PUBLIC_SHARE_COLUMNS.every((col) =>
      result.some((r) => r.key === col.key),
    )
    expect(hasAll).toBe(true)
  })

  it("silently drops unknown keys from saved config", () => {
    const saved: ShareColumnEntry[] = [
      { key: "nonexistent", visible: true, order: 0 },
      { key: "shot", visible: true, order: 1 },
    ]
    const result = mergeShareColumnConfig(saved)
    expect(result.every((c) => c.key !== "nonexistent")).toBe(true)
    expect(result.length).toBe(PUBLIC_SHARE_COLUMNS.length)
  })

  it("falls back to default order when saved has NaN", () => {
    const saved: ShareColumnEntry[] = [
      { key: "date", visible: true, order: NaN },
    ]
    const result = mergeShareColumnConfig(saved)
    const date = result.find((c) => c.key === "date")
    const defaultDate = PUBLIC_SHARE_COLUMNS.find((c) => c.key === "date")
    expect(date?.order).toBe(defaultDate?.order)
  })

  it("falls back to default visible when saved has non-boolean", () => {
    const saved = [
      { key: "date", visible: "yes" as unknown as boolean, order: 2 },
    ] as ShareColumnEntry[]
    const result = mergeShareColumnConfig(saved)
    const date = result.find((c) => c.key === "date")
    const defaultDate = PUBLIC_SHARE_COLUMNS.find((c) => c.key === "date")
    expect(date?.visible).toBe(defaultDate?.visible)
  })
})
