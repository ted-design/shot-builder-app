import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import type { Shot } from "@/shared/types"

function makeShot(overrides: Partial<Shot> & Pick<Shot, "id">): Shot {
  return {
    id: overrides.id,
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    looks: overrides.looks,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? new Timestamp(1, 0),
    updatedAt: overrides.updatedAt ?? new Timestamp(1, 0),
    createdBy: overrides.createdBy ?? "u1",
  }
}

describe("extractShotAssignedProducts", () => {
  it("merges shot-level and look-level products", () => {
    const shot = makeShot({
      id: "s1",
      products: [{ familyId: "f1", familyName: "Hat", colourId: "c1", sizeScope: "pending" }],
      looks: [
        { id: "look-1", products: [{ familyId: "f2", familyName: "Jacket", colourId: "c2", sizeScope: "pending" }] },
      ],
    })

    const merged = extractShotAssignedProducts(shot)
    expect(merged.map((p) => p.familyId).sort()).toEqual(["f1", "f2"])
  })

  it("dedups when the same assignment appears in both places", () => {
    const base = { familyId: "f1", colourId: "c1", sizeScope: "single" as const, size: "M" }
    const shot = makeShot({
      id: "s1",
      products: [base],
      looks: [{ id: "look-1", products: [base] }],
    })

    expect(extractShotAssignedProducts(shot)).toHaveLength(1)
  })
})

