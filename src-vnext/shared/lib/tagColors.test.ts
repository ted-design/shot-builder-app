import { describe, expect, it } from "vitest"
import {
  TAG_COLOR_KEYS,
  getTagColorClasses,
  resolveTagColorKey,
} from "@/shared/lib/tagColors"

describe("resolveTagColorKey", () => {
  it("keeps known palette keys", () => {
    expect(resolveTagColorKey("blue", "tag-1")).toBe("blue")
    expect(resolveTagColorKey(" BLUE ", "tag-1")).toBe("blue")
  })

  it("maps unknown colors to a deterministic palette key", () => {
    const first = resolveTagColorKey("#111111", "tag-legacy-1")
    const second = resolveTagColorKey("#ff00ff", "tag-legacy-1")
    expect(first).toBe(second)
    expect(TAG_COLOR_KEYS).toContain(first)
    expect(first).not.toBe("gray")
  })

  it("falls back to gray when no seed is provided", () => {
    expect(resolveTagColorKey("#111111")).toBe("gray")
  })
})

describe("getTagColorClasses", () => {
  it("returns palette classes for known and unknown colors", () => {
    expect(getTagColorClasses("emerald")).toContain("bg-emerald-100")
    expect(getTagColorClasses("#111111")).toContain("bg-slate-100")
  })
})
