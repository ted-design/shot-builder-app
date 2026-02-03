import { describe, expect, it } from "vitest"
import { parseReturnToParam, safeInternalPath } from "@/shared/lib/returnTo"

describe("safeInternalPath", () => {
  it("accepts encoded internal paths", () => {
    expect(safeInternalPath(encodeURIComponent("/products?q=henley"))).toBe(
      "/products?q=henley",
    )
  })

  it("rejects external urls", () => {
    expect(safeInternalPath("https://example.com")).toBeNull()
    expect(safeInternalPath("//example.com")).toBeNull()
  })

  it("rejects invalid encoding", () => {
    expect(safeInternalPath("%E0%A4%A")).toBeNull()
  })
})

describe("parseReturnToParam", () => {
  it("returns label + path", () => {
    const ctx = parseReturnToParam(encodeURIComponent("/projects/abc/shots?view=planner"))
    expect(ctx?.path).toBe("/projects/abc/shots?view=planner")
    expect(ctx?.label).toBe("Return to Shots")
  })
})

