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

  it("builds title with em-dash for SKU items", async () => {
    const items = [
      { familyId: "fam1", familyName: "Classic Tee", skuId: "sku1", skuName: "Black" },
    ]
    await bulkCreateShotsFromProducts(makeInput({ items }))
    const docData = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(docData["title"]).toBe("Classic Tee \u2014 Black")
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
    expect(first["shotNumber"]).toBe("SH-006")
    expect(second["shotNumber"]).toBe("SH-007")
  })

  it("starts from SH-001 when no existing shots", async () => {
    await bulkCreateShotsFromProducts(makeInput())
    const first = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(first["shotNumber"]).toBe("SH-001")
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
})
