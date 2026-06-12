import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("firebase/firestore", () => ({
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotPath: (shotId: string, clientId: string) => [
    "clients",
    clientId,
    "shots",
    shotId,
  ],
}))

// Mock the writer so executeShotMerge tests assert orchestration only.
vi.mock("./updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

import { buildShotMergePlan, executeShotMerge } from "./shotMergeWrites"
import { updateShotWithVersion } from "./updateShotWithVersion"
import type {
  AuthUser,
  ProductAssignment,
  Shot,
  ShotLook,
  ShotReferenceImage,
} from "@/shared/types"

const TS = { _methodName: "serverTimestamp" } as unknown

function makeShot(overrides: Partial<Shot> & { id: string; title: string }): Shot {
  return {
    projectId: "p1",
    clientId: "unbound-merino",
    status: "todo",
    talent: [],
    talentIds: [],
    products: [],
    sortOrder: 0,
    createdAt: TS as Shot["createdAt"],
    updatedAt: TS as Shot["updatedAt"],
    createdBy: "u1",
    ...overrides,
  } as Shot
}

function product(overrides: Partial<ProductAssignment> & { familyId: string }): ProductAssignment {
  return { ...overrides }
}

function look(overrides: Partial<ShotLook> & { id: string }): ShotLook {
  return { products: [], ...overrides }
}

function ref(id: string, extra?: Partial<ShotReferenceImage>): ShotReferenceImage {
  return { id, path: `refs/${id}.jpg`, ...extra }
}

/** DEEP recursive scan for any `undefined` value (objects + arrays). */
function deepUndefinedPaths(value: unknown, path = ""): string[] {
  if (value === undefined) return [path || "<root>"]
  if (value === null || typeof value !== "object") return []
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => deepUndefinedPaths(v, `${path}[${i}]`))
  }
  // serverTimestamp sentinel / Date / Timestamp pass-through
  if ("_methodName" in (value as Record<string, unknown>)) return []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    deepUndefinedPaths(v, path ? `${path}.${k}` : k),
  )
}

describe("buildShotMergePlan — combine mode", () => {
  it("unions products into ONE look, deduped by family/sku/colour", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "look-a",
      looks: [
        look({
          id: "look-a",
          products: [
            product({ familyId: "f1", skuId: "s1", colourId: "navy" }),
            product({ familyId: "f1", skuId: "s1", colourId: "red" }),
          ],
        }),
      ],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      activeLookId: "look-b",
      looks: [
        look({
          id: "look-b",
          products: [
            product({ familyId: "f1", skuId: "s1", colourId: "navy" }), // dup
            product({ familyId: "f2", skuId: "s2", colourId: "navy" }), // new
          ],
        }),
      ],
    })

    const { patch, result } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    const looks = patch.looks as ShotLook[]
    expect(looks).toHaveLength(1)
    expect(looks[0]!.products).toHaveLength(3)
    expect(patch.activeLookId).toBe("look-a")
    // root products mirror the active look
    expect(patch.products).toEqual(looks[0]!.products)
    expect(result.productsCombined).toBe(3)
    expect(result.looksKept).toBe(1)
  })

  it("unions references by id across both shots' looks", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "la",
      looks: [look({ id: "la", references: [ref("r1"), ref("r2")] })],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      looks: [look({ id: "lb", references: [ref("r2"), ref("r3")] })],
    })
    const { patch, result } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    const looks = patch.looks as ShotLook[]
    expect(looks[0]!.references!.map((r) => r.id)).toEqual(["r1", "r2", "r3"])
    expect(result.referencesKept).toBe(3)
  })

  it("drops heroProductId/displayImageId when no longer valid", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "la",
      looks: [
        look({
          id: "la",
          products: [product({ familyId: "f1" })],
          heroProductId: "f1",
          displayImageId: "r1",
          references: [ref("r1")],
        }),
      ],
    })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    const looks = patch.looks as ShotLook[]
    expect(looks[0]!.heroProductId).toBe("f1")
    expect(looks[0]!.displayImageId).toBe("r1")
  })
})

describe("buildShotMergePlan — separate mode", () => {
  it("keeps both shots' looks and remaps colliding ids + reassigns order", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "shared",
      looks: [look({ id: "shared", products: [product({ familyId: "f1" })] })],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      looks: [look({ id: "shared", products: [product({ familyId: "f2" })] })],
    })
    const { patch, result } = buildShotMergePlan({ primary, secondary, mode: "separate" })
    const looks = patch.looks as ShotLook[]
    expect(looks).toHaveLength(2)
    expect(looks[0]!.id).toBe("shared")
    expect(looks[1]!.id).toBe("shared-b")
    expect(looks.map((l) => l.order)).toEqual([0, 1])
    expect(patch.activeLookId).toBe("shared")
    // separate counts all products across all looks
    expect(result.productsCombined).toBe(2)
    expect(result.looksKept).toBe(2)
  })

  it("active look mirror points at active look products", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "la",
      looks: [look({ id: "la", products: [product({ familyId: "f1" })] })],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      looks: [look({ id: "lb", products: [product({ familyId: "f2" })] })],
    })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "separate" })
    expect((patch.products as ProductAssignment[]).map((p) => p.familyId)).toEqual(["f1"])
  })
})

describe("buildShotMergePlan — legacy root products (no looks)", () => {
  it("normalizes root products into a synthesized look in combine mode", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      products: [product({ familyId: "f1" })],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      products: [product({ familyId: "f2" })],
    })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    const looks = patch.looks as ShotLook[]
    expect(looks).toHaveLength(1)
    expect(looks[0]!.id).toBe("A-root")
    expect((looks[0]!.products).map((p) => p.familyId)).toEqual(["f1", "f2"])
  })

  it("normalizes root products into synthesized looks in separate mode", () => {
    const primary = makeShot({ id: "A", title: "Shot A", products: [product({ familyId: "f1" })] })
    const secondary = makeShot({ id: "B", title: "Shot B", products: [product({ familyId: "f2" })] })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "separate" })
    const looks = patch.looks as ShotLook[]
    expect(looks.map((l) => l.id)).toEqual(["A-root", "B-root"])
  })
})

describe("buildShotMergePlan — talent / links / tags / meta", () => {
  it("unions talent and talentIds in lockstep and counts talentAdded", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      talent: ["Alice"],
      talentIds: ["t1"],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      talent: ["Alice", "Bob"],
      talentIds: ["t1", "t2"],
    })
    const { patch, result } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.talent).toEqual(["Alice", "Bob"])
    expect(patch.talentIds).toEqual(["t1", "t2"])
    expect(result.talentAdded).toBe(1)
  })

  it("unions referenceLinks by url and tags by id", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      referenceLinks: [{ id: "l1", title: "P", url: "http://x", type: "web" }],
      tags: [{ id: "tag1", label: "Hero", color: "#f00" }],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      referenceLinks: [
        { id: "l2", title: "Q", url: "http://x", type: "web" }, // dup url
        { id: "l3", title: "R", url: "http://y", type: "web" },
      ],
      tags: [{ id: "tag1", label: "Hero", color: "#f00" }, { id: "tag2", label: "B", color: "#0f0" }],
    })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect((patch.referenceLinks as Array<{ url: string }>).map((l) => l.url)).toEqual([
      "http://x",
      "http://y",
    ])
    expect((patch.tags as Array<{ id: string }>).map((t) => t.id)).toEqual(["tag1", "tag2"])
  })

  it("omits union fields entirely when both shots lack them (no [] written to absent fields)", () => {
    // Neither shot has talent / talentIds / referenceLinks / tags.
    const primary = makeShot({ id: "A", title: "Shot A" })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    for (const k of ["talent", "talentIds", "referenceLinks", "tags"]) {
      expect(patch).not.toHaveProperty(k)
    }
  })

  it("includes a union field when at least one shot has it", () => {
    const primary = makeShot({ id: "A", title: "Shot A", talent: ["Alice"], talentIds: ["t1"] })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.talent).toEqual(["Alice"])
    expect(patch.talentIds).toEqual(["t1"])
    // The fields the merge doesn't touch stay absent.
    expect(patch).not.toHaveProperty("tags")
    expect(patch).not.toHaveProperty("referenceLinks")
  })

  it("leaves primary meta out of the patch (title/date/location/status/shotNumber/laneId/sortOrder)", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      status: "complete",
      locationId: "loc1",
      shotNumber: "001",
      laneId: "lane1",
      sortOrder: 5,
    })
    const secondary = makeShot({ id: "B", title: "Shot B", status: "todo" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    for (const k of ["title", "date", "locationId", "locationName", "status", "shotNumber", "laneId", "sortOrder", "description"]) {
      expect(patch).not.toHaveProperty(k)
    }
  })
})

describe("buildShotMergePlan — notesAddendum (notes BLOCKED)", () => {
  it("concatenates with the divider and NEVER includes notes", () => {
    const primary = makeShot({ id: "A", title: "Shot A", notes: "<b>html</b>", notesAddendum: "alpha" })
    const secondary = makeShot({ id: "B", title: "Shot B", notes: "ignored", notesAddendum: "beta" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.notesAddendum).toBe('alpha\n\n— merged from "Shot B" —\n\nbeta')
    expect(patch).not.toHaveProperty("notes")
  })

  it("omits notesAddendum when neither shot has addendum prose (nothing to add)", () => {
    const primary = makeShot({ id: "A", title: "Shot A", notes: "<b>html</b>" })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch).not.toHaveProperty("notesAddendum")
  })

  it("appends a divider when only the primary has addendum prose", () => {
    const primary = makeShot({ id: "A", title: "Shot A", notesAddendum: "alpha" })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.notesAddendum).toBe('alpha\n\n— merged from "Shot B" —')
  })
})

describe("buildShotMergePlan — heroImage", () => {
  it("primary wins", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      heroImage: { path: "a.jpg", downloadURL: "http://a" },
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      heroImage: { path: "b.jpg", downloadURL: "http://b" },
    })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.heroImage).toEqual({ path: "a.jpg", downloadURL: "http://a" })
  })

  it("falls back to secondary", () => {
    const primary = makeShot({ id: "A", title: "Shot A" })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      heroImage: { path: "b.jpg", downloadURL: "http://b" },
    })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch.heroImage).toEqual({ path: "b.jpg", downloadURL: "http://b" })
  })

  it("omits heroImage when both absent (never null over existing)", () => {
    const primary = makeShot({ id: "A", title: "Shot A" })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(patch).not.toHaveProperty("heroImage")
  })
})

describe("buildShotMergePlan — sanitize (no undefined anywhere, deep)", () => {
  it("strips nested undefined from looks[].products", () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "la",
      looks: [
        look({
          id: "la",
          products: [
            product({
              familyId: "f1",
              skuId: undefined,
              colourId: undefined,
              quantity: undefined,
            }),
          ],
          references: [ref("r1", { downloadURL: undefined, uploadedBy: undefined })],
        }),
      ],
    })
    const secondary = makeShot({ id: "B", title: "Shot B" })
    const { patch } = buildShotMergePlan({ primary, secondary, mode: "combine" })
    expect(deepUndefinedPaths(patch)).toEqual([])
  })
})

describe("executeShotMerge — orchestration", () => {
  const user: AuthUser = { uid: "u1", email: "ted@x.com" } as AuthUser

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes primary FIRST then soft-deletes secondary; returns counts", async () => {
    const primary = makeShot({
      id: "A",
      title: "Shot A",
      activeLookId: "la",
      looks: [look({ id: "la", products: [product({ familyId: "f1" })] })],
      talentIds: ["t1"],
    })
    const secondary = makeShot({
      id: "B",
      title: "Shot B",
      looks: [look({ id: "lb", products: [product({ familyId: "f2" })] })],
      talentIds: ["t1", "t2"],
    })

    const out = await executeShotMerge({
      clientId: "unbound-merino",
      primary,
      secondary,
      mode: "combine",
      user,
    })

    expect(out.mergedShotId).toBe("A")
    expect(out.talentAdded).toBe(1)

    const calls = vi.mocked(updateShotWithVersion).mock.calls
    expect(calls).toHaveLength(2)
    // primary first
    expect(calls[0]![0].shotId).toBe("A")
    expect(calls[0]![0].source).toBe("shot-merge")
    // secondary soft-deleted (deleted:true), NOT hard-deleted
    expect(calls[1]![0].shotId).toBe("B")
    expect(calls[1]![0].source).toBe("shot-merge-loser")
    expect(calls[1]![0].patch).toMatchObject({ deleted: true })
    expect(calls[1]![0].patch).toHaveProperty("deletedAt")
  })

  it("does not delete secondary if primary write throws (no orphan)", async () => {
    vi.mocked(updateShotWithVersion).mockRejectedValueOnce(new Error("primary failed"))
    const primary = makeShot({ id: "A", title: "Shot A" })
    const secondary = makeShot({ id: "B", title: "Shot B" })

    await expect(
      executeShotMerge({ clientId: "c1", primary, secondary, mode: "combine", user }),
    ).rejects.toThrow("primary failed")

    expect(vi.mocked(updateShotWithVersion).mock.calls).toHaveLength(1)
  })
})
