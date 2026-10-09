import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// In-memory Firestore fake: documents keyed by full path. Supports exactly the
// calls executeProductMerge makes (collection/doc refs, getDoc(s), query+where
// array-contains, updateDoc, writeBatch set/update/delete, sentinels).
// ---------------------------------------------------------------------------
const fake = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  let autoId = 0
  const SERVER_TS = { __sentinel: "serverTimestamp" }
  const DELETE = { __sentinel: "deleteField" }
  type Ref = { readonly kind: "doc" | "col"; readonly path: string; readonly id: string }
  const isRef = (x: unknown): x is Ref => typeof x === "object" && x !== null && "kind" in x
  const applyPatch = (path: string, patch: Record<string, unknown>, merge: boolean) => {
    const next: Record<string, unknown> = merge ? { ...(store.get(path) ?? {}) } : {}
    for (const [k, v] of Object.entries(patch)) {
      if (v === DELETE) delete next[k]
      else next[k] = structuredClone(v)
    }
    store.set(path, next)
  }
  const snapOf = (path: string) => {
    const data = store.get(path)
    return {
      id: path.split("/").pop()!,
      ref: { kind: "doc", path, id: path.split("/").pop()! } as Ref,
      exists: () => data !== undefined,
      data: () => (data ? structuredClone(data) : undefined),
    }
  }
  const childrenOf = (colPath: string) =>
    [...store.keys()].filter((p) => p.startsWith(colPath + "/") && !p.slice(colPath.length + 1).includes("/"))
  // Firestore rejects undefined anywhere in a written value.
  const assertNoUndefined = (value: unknown, at: string): void => {
    if (value === undefined) throw new Error(`Function updateDoc() called with invalid data. Unsupported field value: undefined (found in field ${at})`)
    if (Array.isArray(value)) value.forEach((v, i) => assertNoUndefined(v, `${at}[${i}]`))
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => assertNoUndefined(v, at ? `${at}.${k}` : k))
  }
  const failGetDocs = { path: null as string | null }
  return { store, SERVER_TS, DELETE, isRef, applyPatch, snapOf, childrenOf, assertNoUndefined, failGetDocs, nextId: () => `auto-${++autoId}` }
})

vi.mock("@/shared/lib/firebase", () => ({ db: { __db: true } }))
vi.mock("@/features/products/lib/productVersioning", () => ({ createProductVersionSnapshot: vi.fn() }))
// Download URLs as the assignment picker writes them.
vi.mock("@/shared/lib/resolveStoragePath", () => ({
  resolveStoragePath: async (path: string) => {
    if (path.startsWith("missing/")) throw new Error("storage/object-not-found")
    return `https://dl.test/${path}`
  },
}))
vi.mock("firebase/firestore", () => {
  type Ref = { kind: "doc" | "col"; path: string; id: string }
  const join = (base: unknown, segs: string[]) => {
    const prefix = fake.isRef(base) ? (base as Ref).path : ""
    return [prefix, ...segs].filter(Boolean).join("/")
  }
  return {
    serverTimestamp: () => fake.SERVER_TS,
    deleteField: () => fake.DELETE,
    collection: (base: unknown, ...segs: string[]) => {
      const path = join(base, segs)
      return { kind: "col", path, id: path.split("/").pop()! }
    },
    doc: (base: unknown, ...segs: string[]) => {
      const path = segs.length === 0 ? `${(base as Ref).path}/${fake.nextId()}` : join(base, segs)
      return { kind: "doc", path, id: path.split("/").pop()! }
    },
    getDoc: async (ref: Ref) => fake.snapOf(ref.path),
    getDocs: async (target: { kind: string; path?: string; col?: Ref; wheres?: { field: string; op: string; value: unknown }[] }) => {
      const colPath = target.kind === "query" ? target.col!.path : target.path!
      if (colPath === fake.failGetDocs.path) throw new Error("unavailable")
      const docs = fake.childrenOf(colPath).map(fake.snapOf).filter((s) =>
        (target.wheres ?? []).every((w) => {
          const v = (s.data() as Record<string, unknown>)[w.field]
          return w.op === "array-contains" ? Array.isArray(v) && v.includes(w.value) : v === w.value
        }),
      )
      return { empty: docs.length === 0, docs, size: docs.length }
    },
    query: (col: Ref, ...wheres: unknown[]) => ({ kind: "query", col, wheres }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    updateDoc: async (ref: Ref, patch: Record<string, unknown>) => {
      fake.assertNoUndefined(patch, "")
      fake.applyPatch(ref.path, patch, true)
    },
    writeBatch: () => {
      const ops: Array<() => void> = []
      return {
        set: (ref: Ref, data: Record<string, unknown>) => {
          fake.assertNoUndefined(data, "")
          ops.push(() => fake.applyPatch(ref.path, data, false))
        },
        update: (ref: Ref, data: Record<string, unknown>) => {
          fake.assertNoUndefined(data, "")
          ops.push(() => fake.applyPatch(ref.path, data, true))
        },
        delete: (ref: Ref) => ops.push(() => fake.store.delete(ref.path)),
        commit: async () => ops.forEach((op) => op()),
      }
    },
  }
})

import { executeProductMerge } from "./productMergeWrites"
import type { MergePlan } from "./productDedup"
import type { ProductFamily, ProductSku } from "@/shared/types"

// ---------------------------------------------------------------------------
// Production-shaped fixture. SKU ids are NOT globally unique: "dup-id" exists
// under BOTH families (loser: Olive, winner: Black). Stored photo fields are
// download URLs (what the picker writes); SKU docs hold storage paths.
// ---------------------------------------------------------------------------
const C = "unbound-merino"
const FAM = `clients/${C}/productFamilies`
const W = "fam-W"
const L = "fam-L"

function seed() {
  fake.store.clear()
  fake.store.set(`${FAM}/${W}`, { styleName: "Merino Tee", thumbnailImagePath: "img/fam-W.webp", shotIds: [] })
  fake.store.set(`${FAM}/${W}/skus/w-navy`, { name: "Navy", colorName: "Navy", imagePath: "img/w-navy.webp", status: "active" })
  fake.store.set(`${FAM}/${W}/skus/dup-id`, { name: "Black", colorName: "Black", imagePath: "img/w-black.webp", status: "active" })
  fake.store.set(`${FAM}/${W}/skus/w-only`, { name: "Charcoal", colorName: "Charcoal", imagePath: "img/w-charcoal.webp", status: "active" })
  fake.store.set(`${FAM}/${L}`, { styleName: "Merino Tee (old)", thumbnailImagePath: "img/fam-L.webp", shotIds: ["s1"] })
  fake.store.set(`${FAM}/${L}/skus/l-navy`, { name: "Navy", colorName: "Navy", imagePath: "img/l-navy.webp", status: "active" })
  fake.store.set(`${FAM}/${L}/skus/dup-id`, { name: "Olive", colorName: "Olive", imagePath: "img/l-olive.webp", status: "active" })

  const loserNavy = {
    familyId: L, familyName: "Merino Tee (old)", skuId: "l-navy", colourId: "l-navy", skuName: "Navy", colourName: "Navy",
    sizeScope: "single", size: "M", quantity: 1,
    skuImageUrl: "img/l-navy.webp", thumbUrl: "img/l-navy.webp", familyImageUrl: "img/fam-L.webp",
  }
  fake.store.set(`clients/${C}/shots/s1`, {
    projectId: "p1",
    products: [loserNavy],
    looks: [{
      id: "look-1",
      heroProductId: "l-navy", // SKU-id hero pointing at a loser assignment
      products: [
        loserNavy,
        // legacy colourId-only loser row (frozen family fallback as thumbUrl)
        { familyId: L, colourId: "dup-id", colourName: "Olive", sizeScope: "all", thumbUrl: "img/fam-L.webp", familyImageUrl: "img/fam-L.webp" },
        // the WINNER's own "dup-id" (Black) must not be touched
        { familyId: W, skuId: "dup-id", colourId: "dup-id", colourName: "Black", skuImageUrl: "img/w-black.webp", sizeScope: "all" },
        // loser colourway whose SKU no longer exists (not in the plan) -> unmatched
        { familyId: L, skuId: "l-gone", colourId: "l-gone", colourName: "Sand", skuImageUrl: "img/l-sand.webp", thumbUrl: "img/l-sand.webp", familyImageUrl: "img/fam-L.webp", sizeScope: "all" },
        // existing winner Navy, ALL sizes: a different assignment from the loser's single/M
        { familyId: W, skuId: "w-navy", colourId: "w-navy", colourName: "Navy", skuImageUrl: "img/w-navy.webp", sizeScope: "all" },
      ],
    }, {
      id: "look-2",
      heroProductId: L, // family-id hero: resolves to the first loser row (the starred Navy M)
      products: [
        // an unrelated family with two sizes of one colourway: both must survive
        { familyId: "fam-X", skuId: "x-navy", colourId: "x-navy", colourName: "X Navy", sizeScope: "single", size: "M" },
        { familyId: "fam-X", skuId: "x-navy", colourId: "x-navy", colourName: "X Navy", sizeScope: "single", size: "XL" },
        // the winner's Navy M: the starred loser Navy M below is the same assignment once remapped
        { familyId: W, skuId: "w-navy", colourId: "w-navy", colourName: "Navy", sizeScope: "single", size: "M", quantity: 1 },
        { ...loserNavy, isHero: true },
        // a stale loser colourway id that happens to name a WINNER SKU (Charcoal)
        { familyId: L, skuId: "w-only", colourId: "w-only", colourName: "Teal", skuImageUrl: "img/l-teal.webp", sizeScope: "all" },
        // a winner family-level row: once Teal's id is dropped it must not be read as this row's duplicate
        { familyId: W, sizeScope: "all", quantity: 2 },
      ],
    }],
  })
  fake.store.set(`clients/${C}/projects/p1/pulls/pull-1`, {
    items: [
      { id: "i1", familyId: L, familyName: "Merino Tee (old)", styleNumber: "OLD-1", colourId: "l-navy", colourName: "Navy", colourImagePath: "img/l-navy.webp", sizes: [{ size: "M", quantity: 1 }] },
      { id: "i2", familyId: L, familyName: "Merino Tee (old)", colourId: "dup-id", colourName: "Olive", colourImagePath: null, sizes: [] },
      { id: "i3", familyId: W, familyName: "Merino Tee", colourId: "dup-id", colourName: "Black", sizes: [] },
    ],
  })
}

function plan(overrides: Partial<ProductFamily> = {}): MergePlan {
  const winner = { id: W, styleName: "Merino Tee", styleNumber: "MT-100", thumbnailImagePath: "img/fam-W.webp", ...overrides } as ProductFamily
  const loser = { id: L, styleName: "Merino Tee (old)", thumbnailImagePath: "img/fam-L.webp" } as ProductFamily
  return {
    winner,
    loser,
    newSkus: [{ id: "dup-id", name: "Olive", colorName: "Olive", imagePath: "img/l-olive.webp", status: "active" } as ProductSku],
    matchedSkus: [{ loserId: "l-navy", winnerId: "w-navy", colorName: "Navy" }],
    samplesToTransfer: 0,
    commentsToTransfer: 0,
    documentsToTransfer: 0,
    affectedShotIds: ["s1"],
    affectedPullCount: 0,
  } as unknown as MergePlan
}

async function runMerge(mergePlan: MergePlan = plan()) {
  await executeProductMerge({ winnerId: W, loserId: L, clientId: C, mergedBy: "u1", plan: mergePlan })
  const shot = fake.store.get(`clients/${C}/shots/s1`)!
  const looks = shot.looks as Record<string, unknown>[]
  const look = looks[0]!
  const look2 = looks[1]!
  const products = look.products as Record<string, unknown>[]
  const products2 = look2.products as Record<string, unknown>[]
  // The SKU id transferNewSkus minted for the loser's Olive under the winner.
  const newOliveId = [...fake.store.keys()]
    .filter((p) => p.startsWith(`${FAM}/${W}/skus/`))
    .map((p) => p.split("/").pop()!)
    .find((id) => fake.store.get(`${FAM}/${W}/skus/${id}`)!.colorName === "Olive")!
  return { shot, look, products, look2, products2, newOliveId }
}

/** The cover rule (coverProductImage.findExplicitCoverAssignment): first product matching the hero id. */
const heroRow = (look: Record<string, unknown>) =>
  (look.products as Record<string, unknown>[]).find((p) =>
    p.skuId === look.heroProductId || p.colourId === look.heroProductId || p.familyId === look.heroProductId)

const byColour = (rows: Record<string, unknown>[], colour: string) => rows.filter((p) => p.colourName === colour)

describe("executeProductMerge — loser colourways are remapped on shots and pulls", () => {
  beforeEach(seed)

  it("a matched loser colourway becomes the winner colourway with the winner's photo: no loser id or URL survives", async () => {
    const { products } = await runMerge()
    const navy = byColour(products, "Navy")
    expect(navy[0]).toMatchObject({
      familyId: W, familyName: "Merino Tee", skuId: "w-navy", colourId: "w-navy", sizeScope: "single", size: "M",
      skuImageUrl: "https://dl.test/img/w-navy.webp", thumbUrl: "https://dl.test/img/w-navy.webp",
      familyImageUrl: "https://dl.test/img/fam-W.webp",
    })
    const json = JSON.stringify(products)
    expect(json).not.toContain("l-navy")
    expect(json).not.toContain("img/fam-L.webp")
    expect(json).not.toContain(`"familyId":"${L}"`)
  })

  it("a legacy colourId-only loser row is remapped to the SKU transferred into the winner", async () => {
    const { products, newOliveId } = await runMerge()
    const olive = byColour(products, "Olive")
    expect(olive).toHaveLength(1)
    expect(olive[0]).toMatchObject({ familyId: W, skuId: newOliveId, colourId: newOliveId, skuImageUrl: "https://dl.test/img/l-olive.webp" })
    expect(olive[0]!.familyImageUrl).toBe("https://dl.test/img/fam-W.webp")
  })

  it("is family-scoped: the winner's own row with the same SKU id as a loser SKU is untouched", async () => {
    const { products } = await runMerge()
    expect(byColour(products, "Black")).toEqual([
      { familyId: W, skuId: "dup-id", colourId: "dup-id", colourName: "Black", skuImageUrl: "img/w-black.webp", sizeScope: "all" },
    ])
  })

  it("an unmatched loser colourway is carried (id, name, its own photo) under the winner, not silently dropped", async () => {
    const { products } = await runMerge()
    const sand = byColour(products, "Sand")
    expect(sand).toHaveLength(1)
    expect(sand[0]).toMatchObject({ familyId: W, skuId: "l-gone", colourId: "l-gone", skuImageUrl: "img/l-sand.webp", familyImageUrl: "https://dl.test/img/fam-W.webp" })
  })

  it("a SKU-id heroProductId on a loser assignment follows it to the winner SKU", async () => {
    const { look } = await runMerge()
    expect(look.heroProductId).toBe("w-navy")
  })

  it("the root products mirror is remapped too", async () => {
    const { shot } = await runMerge()
    expect(shot.products).toEqual([
      expect.objectContaining({ familyId: W, skuId: "w-navy", colourId: "w-navy", skuImageUrl: "https://dl.test/img/w-navy.webp" }),
    ])
    expect(JSON.stringify(shot.products)).not.toContain("l-navy")
  })

  it("pull items: loser colour ids are remapped through the SKU map; winner items are untouched", async () => {
    const { newOliveId } = await runMerge()
    const items = fake.store.get(`clients/${C}/projects/p1/pulls/pull-1`)!.items as Record<string, unknown>[]
    // pull items keep storage paths, and an existing style number follows the winner
    expect(items[0]).toMatchObject({ id: "i1", familyId: W, familyName: "Merino Tee", styleNumber: "MT-100", colourId: "w-navy", colourName: "Navy", colourImagePath: "img/w-navy.webp" })
    expect(items[1]).toMatchObject({ id: "i2", familyId: W, colourId: newOliveId, colourName: "Olive" })
    expect(items[2]).toEqual({ id: "i3", familyId: W, familyName: "Merino Tee", colourId: "dup-id", colourName: "Black", sizes: [] })
    expect(JSON.stringify(items)).not.toContain("l-navy")
  })

  it("dedupe is by family + colourway + size: the winner's own all-sizes Navy row survives next to the remapped Navy M", async () => {
    const { products } = await runMerge()
    expect(byColour(products, "Navy").map((p) => [p.familyId, p.skuId, p.sizeScope, p.size ?? null])).toEqual([
      [W, "w-navy", "single", "M"],
      [W, "w-navy", "all", null],
    ])
  })

  it("an exact duplicate loser row is dropped, its hero star moves to the winner row, and other families' rows all survive", async () => {
    const { products2 } = await runMerge()
    expect(products2.filter((p) => p.familyId === "fam-X").map((p) => p.size)).toEqual(["M", "XL"])
    const navy = byColour(products2, "Navy")
    expect(navy).toEqual([
      { familyId: W, skuId: "w-navy", colourId: "w-navy", colourName: "Navy", sizeScope: "single", size: "M", quantity: 1, isHero: true },
    ])
  })

  it("a family-id hero still resolves to the same assignment after the merge", async () => {
    const { look2 } = await runMerge()
    expect(heroRow(look2)).toMatchObject({ familyId: W, skuId: "w-navy", size: "M", isHero: true })
  })

  it("a stale loser colourway id that names a winner SKU is not carried (it would show as the winner's Charcoal)", async () => {
    const { products2 } = await runMerge()
    const teal = byColour(products2, "Teal")
    expect(teal).toEqual([
      { familyId: W, familyName: "Merino Tee", familyImageUrl: "https://dl.test/img/fam-W.webp", colourName: "Teal",
        skuImageUrl: "img/l-teal.webp", thumbUrl: "img/l-teal.webp", sizeScope: "all" },
    ])
    // ...and dropping its id doesn't make it a duplicate of the winner's family-level row
    expect(products2.filter((p) => p.familyId === W && !p.skuId && !p.colourName)).toEqual([{ familyId: W, sizeScope: "all", quantity: 2 }])
  })

  it("a winner with no styleName writes no undefined values (Firestore would reject the batch)", async () => {
    const { products } = await runMerge(plan({ styleName: undefined }))
    expect(byColour(products, "Navy")[0]).toMatchObject({ familyId: W, familyName: "Merino Tee (old)", skuId: "w-navy" })
  })

  it("the family image is the winner's header, then thumbnail (the picker's order)", async () => {
    const { products } = await runMerge(plan({ headerImagePath: "img/fam-W-header.webp" }))
    expect(byColour(products, "Navy")[0]!.familyImageUrl).toBe("https://dl.test/img/fam-W-header.webp")
  })

  it("a winner photo that can't be resolved is written as no photo, never as a raw path or the loser's photo", async () => {
    fake.store.set(`${FAM}/${W}/skus/w-navy`, { name: "Navy", colorName: "Navy", imagePath: "missing/w-navy.webp", status: "active" })
    const { products } = await runMerge()
    const navyM = byColour(products, "Navy")[0]!
    expect(navyM).toMatchObject({ skuId: "w-navy", size: "M" })
    expect(navyM).not.toHaveProperty("skuImageUrl")
    expect(navyM).not.toHaveProperty("thumbUrl")
  })

  it("transferred SKUs: the remapped row's names match the SKU doc transferNewSkus writes (legacy SKUs without a name)", async () => {
    for (const variant of [{ colorName: "Olive" }, { skuCode: "OL-01" }, {}]) {
      seed()
      const { products } = await runMerge({ ...plan(), newSkus: [{ id: "dup-id", ...variant } as ProductSku] })
      const newId = [...fake.store.keys()]
        .filter((k) => k.startsWith(`${FAM}/${W}/skus/`))
        .map((k) => k.split("/").pop()!)
        .find((id) => !["w-navy", "dup-id", "w-only"].includes(id))!
      const written = fake.store.get(`${FAM}/${W}/skus/${newId}`)!
      expect(products.find((p) => p.skuId === newId)).toMatchObject({ skuName: written.name, colourName: written.colorName })
    }
  })

  it("if the winner SKUs can't be read, the merge stops before ANY merge write and clears mergeInProgress", async () => {
    const before = new Map([...fake.store].map(([k, v]) => [k, structuredClone(v)]))
    fake.failGetDocs.path = `${FAM}/${W}/skus`
    try {
      await expect(executeProductMerge({ winnerId: W, loserId: L, clientId: C, mergedBy: "u1", plan: plan() }))
        .rejects.toThrow(/Remap prep/)
    } finally {
      fake.failGetDocs.path = null
    }
    // nothing but the loser's in-progress flag (set, then cleared) was written: no SKU transferred, no shot touched
    expect([...fake.store.keys()].sort()).toEqual([...before.keys()].sort())
    for (const [key, value] of before) {
      if (key !== `${FAM}/${L}`) expect(fake.store.get(key)).toEqual(value)
    }
    expect(fake.store.get(`${FAM}/${L}`)).not.toHaveProperty("mergeInProgress")
  })
})
