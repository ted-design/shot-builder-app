import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("firebase/firestore", () => ({
  writeBatch: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  collection: vi.fn((...args: unknown[]) => ({ path: args.join("/") })),
  doc: vi.fn(() => ({ id: `doc-${Math.random()}` })),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  where: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn((...args: unknown[]) => args),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotsPath: (clientId: string) => ["clients", clientId, "shots"],
}))

import * as firestore from "firebase/firestore"
import { bulkCreateShotsFromProducts } from "./bulkShotWrites"
import type { BulkCreateShotsInput } from "./bulkShotWrites"

function makeInput(overrides: Partial<BulkCreateShotsInput> = {}): BulkCreateShotsInput {
  return {
    clientId: "c1",
    projectId: "p1",
    items: [
      { familyId: "fam1", familyName: "Classic Tee" },
      { familyId: "fam2", familyName: "Slim Polo" },
    ],
    createdBy: "u1",
    ...overrides,
  }
}

describe("bulkCreateShotsFromProducts", () => {
  let mockBatchSet: ReturnType<typeof vi.fn>
  let mockBatchCommit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockBatchSet = vi.fn()
    mockBatchCommit = vi.fn().mockResolvedValue(undefined)

    vi.mocked(firestore.writeBatch).mockReturnValue({
      set: mockBatchSet,
      commit: mockBatchCommit,
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof firestore.writeBatch>)

    // Default: no existing shots
    vi.mocked(firestore.getDocs).mockResolvedValue({
      docs: [],
    } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>)
  })

  it("returns { created: 0 } for empty items array", async () => {
    const result = await bulkCreateShotsFromProducts(makeInput({ items: [] }))
    expect(result).toEqual({ created: 0 })
    expect(firestore.writeBatch).not.toHaveBeenCalled()
  })

  it("creates shots with correct base shape", async () => {
    await bulkCreateShotsFromProducts(makeInput())
    expect(mockBatchSet).toHaveBeenCalledTimes(2)

    const firstCall = mockBatchSet.mock.calls[0]!
    const docData = firstCall[1] as Record<string, unknown>
    expect(docData["title"]).toBe("Classic Tee")
    expect(docData["projectId"]).toBe("p1")
    expect(docData["clientId"]).toBe("c1")
    expect(docData["status"]).toBe("todo")
    expect(docData["deleted"]).toBe(false)
    expect(docData["createdBy"]).toBe("u1")
    expect(docData["talent"]).toEqual([])
    expect(docData["products"]).toHaveLength(1)
  })

  it("builds title with family name only for SKU items", async () => {
    const items = [
      { familyId: "fam1", familyName: "Classic Tee", skuId: "sku1", skuName: "Black" },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(docData["title"]).toBe("Classic Tee")
    expect(docData["description"]).toBe("Black")
  })

  it("sets empty description when no skuName is present", async () => {
    await bulkCreateShotsFromProducts(makeInput())
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(docData["title"]).toBe("Classic Tee")
    expect(docData["description"]).toBe("")
  })

  it("adds gender tag when item has gender", async () => {
    const items = [
      { familyId: "fam1", familyName: "Classic Tee", gender: "men" },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const tags = docData["tags"] as Array<Record<string, unknown>>
    expect(tags).toHaveLength(1)
    expect(tags[0]!["label"]).toBe("Men")
    expect(tags[0]!["category"]).toBe("gender")
    expect(typeof tags[0]!["id"]).toBe("string")
  })

  it("adds no gender tag when item has no gender", async () => {
    const items = [
      { familyId: "fam1", familyName: "Classic Tee" },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const tags = docData["tags"] as Array<Record<string, unknown>>
    expect(tags).toHaveLength(0)
  })

  it("normalizes gender labels correctly", async () => {
    const items = [
      { familyId: "fam1", familyName: "Tee A", gender: "women" },
      { familyId: "fam2", familyName: "Tee B", gender: "unisex" },
      { familyId: "fam3", familyName: "Tee C", gender: "female" },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const tags0 = (mockBatchSet.mock.calls[0]![1] as Record<string, unknown>)["tags"] as Array<Record<string, unknown>>
    const tags1 = (mockBatchSet.mock.calls[1]![1] as Record<string, unknown>)["tags"] as Array<Record<string, unknown>>
    const tags2 = (mockBatchSet.mock.calls[2]![1] as Record<string, unknown>)["tags"] as Array<Record<string, unknown>>
    expect(tags0[0]!["label"]).toBe("Women")
    expect(tags1[0]!["label"]).toBe("Unisex")
    expect(tags2[0]!["label"]).toBe("Women")
  })

  it("includes sku fields in product assignment when skuId present", async () => {
    const items = [
      {
        familyId: "fam1",
        familyName: "Tee",
        skuId: "sku1",
        skuName: "Black",
        colourId: "col1",
        colourName: "Black",
        thumbUrl: "https://example.com/img.jpg",
      },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const products = docData["products"] as Record<string, unknown>[]
    expect(products[0]).toMatchObject({
      familyId: "fam1",
      familyName: "Tee",
      skuId: "sku1",
      skuName: "Black",
      colourId: "col1",
      colourName: "Black",
      thumbUrl: "https://example.com/img.jpg",
    })
  })

  it("assigns sequential shot numbers from max + 1", async () => {
    vi.mocked(firestore.getDocs).mockResolvedValue({
      docs: [{ data: () => ({ shotNumber: "SH-005" }) }],
    } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>)

    await bulkCreateShotsFromProducts(makeInput())
    const first = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const second = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    expect(first["shotNumber"]).toBe("06")
    expect(second["shotNumber"]).toBe("07")
  })

  it("starts from 01 when no existing shots", async () => {
    await bulkCreateShotsFromProducts(makeInput())
    const first = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(first["shotNumber"]).toBe("01")
  })

  it("chunks items into batches of 250", async () => {
    const items = Array.from({ length: 300 }, (_, i) => ({
      familyId: `fam${i}`,
      familyName: `Family ${i}`,
    }))
    await bulkCreateShotsFromProducts(makeInput({ items }))
    // Should create 2 batches (250 + 50)
    expect(firestore.writeBatch).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(2)
    expect(mockBatchSet).toHaveBeenCalledTimes(300)
  })

  it("commits each chunk sequentially", async () => {
    const commitOrder: number[] = []
    let batchCount = 0

    vi.mocked(firestore.writeBatch).mockImplementation(() => {
      const idx = ++batchCount
      return {
        set: vi.fn(),
        commit: vi.fn(async () => {
          commitOrder.push(idx)
        }),
        delete: vi.fn(),
        update: vi.fn(),
      } as unknown as ReturnType<typeof firestore.writeBatch>
    })

    const items = Array.from({ length: 260 }, (_, i) => ({
      familyId: `fam${i}`,
      familyName: `Family ${i}`,
    }))
    await bulkCreateShotsFromProducts(makeInput({ items }))
    expect(commitOrder).toEqual([1, 2])
  })

  it("returns total created count", async () => {
    const result = await bulkCreateShotsFromProducts(makeInput())
    expect(result).toEqual({ created: 2 })
  })

  it("returns correct count for large batches", async () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      familyId: `fam${i}`,
      familyName: `Family ${i}`,
    }))

    vi.mocked(firestore.writeBatch).mockImplementation(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof firestore.writeBatch>))

    const result = await bulkCreateShotsFromProducts(makeInput({ items }))
    expect(result).toEqual({ created: 500 })
  })

  it("created shot includes a default look with the product", async () => {
    const items = [
      {
        familyId: "fam1",
        familyName: "Classic Tee",
        skuId: "sku1",
        skuName: "Black",
      },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const looks = docData["looks"] as Array<Record<string, unknown>>
    expect(looks).toHaveLength(1)

    const look = looks[0]!
    expect(typeof look["id"]).toBe("string")
    expect((look["id"] as string).length).toBeGreaterThan(0)
    expect(look["label"]).toBe("Look 1")
    expect(look["order"]).toBe(0)

    const lookProducts = look["products"] as Array<Record<string, unknown>>
    expect(lookProducts).toHaveLength(1)
    expect(lookProducts[0]!["familyId"]).toBe("fam1")

    // Root products should match look products
    const rootProducts = docData["products"] as Array<Record<string, unknown>>
    expect(rootProducts).toHaveLength(1)
    expect(rootProducts[0]!["familyId"]).toBe("fam1")
  })
})
