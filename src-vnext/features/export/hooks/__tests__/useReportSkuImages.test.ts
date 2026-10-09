import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { Shot } from "@/shared/types"

const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  getDocs: firestoreMocks.getDocs,
}))

import { familyIdsInUse, loadSkuImagePaths, useReportSkuImages } from "../useReportSkuImages"

function snap(docs: Array<{ id: string; imagePath?: unknown }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => ({ imagePath: d.imagePath }) })) }
}

describe("familyIdsInUse", () => {
  it("collects families from shot- and look-level products, skipping deleted shots", () => {
    const shots = [
      { id: "s1", products: [{ familyId: "f2" }], looks: [{ id: "l", products: [{ familyId: "f1" }] }] },
      { id: "s2", deleted: true, products: [{ familyId: "f9" }], looks: [] },
      { id: "s3", products: [{ familyId: "f1" }] },
    ] as unknown as Shot[]
    expect(familyIdsInUse(shots)).toEqual(["f1", "f2"])
  })
})

describe("loadSkuImagePaths", () => {
  beforeEach(() => {
    firestoreMocks.getDocs.mockReset()
  })

  it("maps each SKU to its photo or null, and drops (and logs) a family whose read fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    firestoreMocks.getDocs.mockImplementation(async (ref: { path: string }) => {
      if (ref.path.includes("f-broken")) throw new Error("permission-denied")
      return snap([
        { id: "olive", imagePath: "skus/olive.webp" },
        { id: "black", imagePath: "" },
        { id: "navy" },
      ])
    })

    const paths = await loadSkuImagePaths(["f1", "f-broken"], "c1")

    expect([...paths.entries()]).toEqual([
      ["f1/olive", "skus/olive.webp"],
      ["f1/black", null],
      ["f1/navy", null],
    ])
    expect(consoleError).toHaveBeenCalledWith(
      "[useReportSkuImages] SKU read failed",
      "f-broken",
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})

describe("useReportSkuImages", () => {
  const shots = [{ id: "s1", products: [], looks: [{ id: "l", products: [{ familyId: "f1" }] }] }] as unknown as Shot[]

  beforeEach(() => {
    firestoreMocks.getDocs.mockReset()
  })

  it("is not ready (and fetches nothing) until the shots have loaded", () => {
    const { result } = renderHook(() => useReportSkuImages(shots, "c1", false, "c1/p1"))
    expect(result.current.ready).toBe(false)
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled()
  })

  it("is not ready while live photos load, then exposes them", async () => {
    let resolve!: (v: unknown) => void
    firestoreMocks.getDocs.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useReportSkuImages(shots, "c1", true, "c1/p1"))
    expect(result.current.ready).toBe(false)

    await act(async () => {
      resolve(snap([{ id: "olive", imagePath: "skus/olive.webp" }]))
    })
    expect(result.current.ready).toBe(true)
    expect(result.current.skuImagePaths?.get("f1/olive")).toBe("skus/olive.webp")
  })

  it("switching projects is not ready until the new project's photos load (never the old map)", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(snap([{ id: "olive", imagePath: "skus/olive.webp" }]))
    const { result, rerender } = renderHook(
      ({ list, scope }: { list: Shot[]; scope: string }) => useReportSkuImages(list, "c1", true, scope),
      { initialProps: { list: shots, scope: "c1/p1" } },
    )
    await act(async () => {})
    expect(result.current.ready).toBe(true)

    let resolve!: (v: unknown) => void
    firestoreMocks.getDocs.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const otherShots = [{ id: "s9", products: [{ familyId: "f2" }], looks: [] }] as unknown as Shot[]
    rerender({ list: otherShots, scope: "c1/p2" })
    expect(result.current.ready).toBe(false)
    expect(result.current.skuImagePaths).toBeNull()

    await act(async () => {
      resolve(snap([{ id: "navy", imagePath: null }]))
    })
    expect(result.current.ready).toBe(true)
    expect([...(result.current.skuImagePaths?.entries() ?? [])]).toEqual([["f2/navy", null]])
  })

  it("within one project, a refetch keeps the previous paths (no flash back to loading)", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(snap([{ id: "olive", imagePath: "skus/olive.webp" }]))
    const { result, rerender } = renderHook(
      ({ list }: { list: Shot[] }) => useReportSkuImages(list, "c1", true, "c1/p1"),
      { initialProps: { list: shots } },
    )
    await act(async () => {})

    firestoreMocks.getDocs.mockReturnValue(new Promise(() => {}))
    const moreShots = [...shots, { id: "s2", products: [{ familyId: "f3" }], looks: [] }] as unknown as Shot[]
    rerender({ list: moreShots })
    expect(result.current.ready).toBe(true)
    expect(result.current.skuImagePaths?.get("f1/olive")).toBe("skus/olive.webp")
  })
})
