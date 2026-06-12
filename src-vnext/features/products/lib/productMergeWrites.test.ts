import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("firebase/firestore", () => ({
  writeBatch: vi.fn(),
  collection: vi.fn((...args: unknown[]) => ({ path: args.join("/") })),
  doc: vi.fn(() => ({ id: `new-sku-${Math.random().toString(36).slice(2)}` })),
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  productFamilySkusPath: (familyId: string, clientId: string) => [
    "clients",
    clientId,
    "productFamilies",
    familyId,
    "skus",
  ],
}))

import * as firestore from "firebase/firestore"
import { productMergeWritesForTests } from "./productMergeWrites"
import type { ProductSku } from "@/shared/types"

const { transferNewSkus } = productMergeWritesForTests

function makeSku(overrides: Partial<ProductSku> & { id: string }): ProductSku {
  return {
    name: "Denim Blue",
    ...overrides,
  } as ProductSku
}

/** Collect every undefined-valued field path in an object (Firestore rejects these). */
function topLevelUndefinedFields(obj: Record<string, unknown>): string[] {
  return Object.entries(obj)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k)
}

describe("transferNewSkus (product merge — Step 1)", () => {
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
  })

  function run(skus: ReadonlyArray<ProductSku>) {
    return transferNewSkus({
      newSkus: skus,
      winnerId: "winner1",
      clientId: "unbound-merino",
      mergedBy: "u1",
      skuIdMap: new Map<string, string>(),
    })
  }

  it("no-ops on empty input", async () => {
    const count = await run([])
    expect(count).toBe(0)
    expect(firestore.writeBatch).not.toHaveBeenCalled()
  })

  // The exact production crash: a loser "new" SKU with NO name field made
  // Step 1 write `name: undefined`, which Firestore rejects with
  // "Unsupported field value: undefined (found in field name ...)".
  it("a SKU missing `name` writes a defined name (no undefined field)", async () => {
    await run([makeSku({ id: "lose1", name: undefined as unknown as string, colorName: "Sea Salt" })])

    expect(mockBatchSet).toHaveBeenCalledTimes(1)
    const payload = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(topLevelUndefinedFields(payload)).toEqual([])
    expect(payload.name).toBe("Sea Salt") // falls back to colorName
    expect(payload.colorName).toBe("Sea Salt")
  })

  it("falls back name → skuCode → 'Untitled' when name and colorName are absent", async () => {
    await run([
      makeSku({ id: "a", name: undefined as unknown as string, colorName: undefined, skuCode: "M-BT-PN-1097" }),
      makeSku({ id: "b", name: undefined as unknown as string, colorName: undefined, skuCode: undefined }),
    ])

    const first = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const second = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    expect(first.name).toBe("M-BT-PN-1097")
    expect(second.name).toBe("Untitled")
    expect(topLevelUndefinedFields(first)).toEqual([])
    expect(topLevelUndefinedFields(second)).toEqual([])
  })

  it("strips nested undefined (e.g. assetRequirements) from the payload", async () => {
    await run([
      makeSku({
        id: "c",
        name: "Charcoal",
        assetRequirements: { flatlay: undefined, onModel: true } as unknown as ProductSku["assetRequirements"],
      }),
    ])
    const payload = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    const reqs = payload.assetRequirements as Record<string, unknown>
    expect(reqs).not.toHaveProperty("flatlay") // undefined key omitted
    expect(reqs.onModel).toBe(true)
  })

  it("preserves a present name and maps loser→new SKU ids", async () => {
    const skuIdMap = new Map<string, string>()
    await transferNewSkus({
      newSkus: [makeSku({ id: "lose-xyz", name: "Forest Green" })],
      winnerId: "winner1",
      clientId: "unbound-merino",
      mergedBy: "u1",
      skuIdMap,
    })
    const payload = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(payload.name).toBe("Forest Green")
    expect(skuIdMap.has("lose-xyz")).toBe(true)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })
})
