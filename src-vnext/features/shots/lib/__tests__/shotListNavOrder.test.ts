import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readShotListNavOrder, writeShotListNavOrder } from "../shotListNavOrder"

describe("shotListNavOrder", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("round-trips an ordered id list per client+project", () => {
    writeShotListNavOrder("c1", "p1", ["s3", "s1", "s2"])

    expect(readShotListNavOrder("c1", "p1")).toEqual(["s3", "s1", "s2"])
  })

  it("scopes the snapshot by client and project", () => {
    writeShotListNavOrder("c1", "p1", ["s1"])

    expect(readShotListNavOrder("c1", "p2")).toBeNull()
    expect(readShotListNavOrder("c2", "p1")).toBeNull()
  })

  it("returns null when no snapshot exists", () => {
    expect(readShotListNavOrder("c1", "p1")).toBeNull()
  })

  it("rejects malformed payloads", () => {
    sessionStorage.setItem("sb:shots:nav-order:c1:p1", "not json {")
    expect(readShotListNavOrder("c1", "p1")).toBeNull()

    sessionStorage.setItem("sb:shots:nav-order:c1:p1", JSON.stringify({ ids: ["s1"] }))
    expect(readShotListNavOrder("c1", "p1")).toBeNull()

    sessionStorage.setItem("sb:shots:nav-order:c1:p1", JSON.stringify([1, 2]))
    expect(readShotListNavOrder("c1", "p1")).toBeNull()

    sessionStorage.setItem("sb:shots:nav-order:c1:p1", JSON.stringify([]))
    expect(readShotListNavOrder("c1", "p1")).toBeNull()
  })

  it("swallows storage errors on write and read", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })

    expect(() => writeShotListNavOrder("c1", "p1", ["s1"])).not.toThrow()
    expect(readShotListNavOrder("c1", "p1")).toBeNull()
  })
})
