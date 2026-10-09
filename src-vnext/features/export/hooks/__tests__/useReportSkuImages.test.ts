import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Shot } from "@/shared/types"

const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  getDocs: firestoreMocks.getDocs,
}))

import { familyIdsInUse, loadSkuImagePaths } from "../useReportSkuImages"

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

  it("maps each SKU to its photo or null, and drops a family whose read fails", async () => {
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
  })
})
