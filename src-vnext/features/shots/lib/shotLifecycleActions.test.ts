import { Timestamp } from "firebase/firestore"
import { describe, expect, it } from "vitest"
import type { Shot } from "@/shared/types"
import {
  buildDuplicateShotTitle,
  buildShotClonePayload,
} from "@/features/shots/lib/shotLifecycleActions"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Hero Shot",
    description: overrides.description,
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? ["talent-1"],
    talentIds: overrides.talentIds ?? ["talent-1"],
    products: overrides.products ?? [{ familyId: "fam-1", familyName: "Jacket" }],
    locationId: overrides.locationId ?? "loc-1",
    locationName: overrides.locationName ?? "Studio A",
    laneId: overrides.laneId ?? "lane-1",
    sortOrder: overrides.sortOrder ?? 1,
    shotNumber: overrides.shotNumber ?? "12A",
    notes: overrides.notes ?? "<p>Legacy notes</p>",
    notesAddendum: overrides.notesAddendum ?? "On-set note",
    date: overrides.date ?? now,
    heroImage: overrides.heroImage,
    looks: overrides.looks ?? [],
    activeLookId: overrides.activeLookId ?? null,
    tags: overrides.tags ?? [],
    referenceLinks: overrides.referenceLinks ?? [
      { id: "lk-1", title: "Lookbook", url: "https://example.com/lookbook.pdf", type: "document" },
    ],
    deleted: overrides.deleted ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

describe("shotLifecycleActions", () => {
  it("builds a non-colliding duplicate title", () => {
    const title = buildDuplicateShotTitle(
      "Hero Shot",
      new Set(["hero shot", "hero shot (copy)", "hero shot (copy 2)"]),
    )
    expect(title).toBe("Hero Shot (Copy 3)")
  })

  it("builds duplicate payload that resets shot number and keeps lane", () => {
    const payload = buildShotClonePayload({
      shot: makeShot(),
      clientId: "c1",
      targetProjectId: "p1",
      title: "Hero Shot (Copy)",
      createdByUid: "u2",
      preserveLane: true,
    })

    expect(payload["title"]).toBe("Hero Shot (Copy)")
    expect(payload["shotNumber"]).toBeNull()
    expect(payload["laneId"]).toBe("lane-1")
    expect(payload["projectId"]).toBe("p1")
    expect(payload["createdBy"]).toBe("u2")
  })

  it("builds copy payload that clears lane and keeps reference links", () => {
    const payload = buildShotClonePayload({
      shot: makeShot(),
      clientId: "c1",
      targetProjectId: "p2",
      title: "Hero Shot",
      createdByUid: "u2",
      preserveLane: false,
    })

    expect(payload["projectId"]).toBe("p2")
    expect(payload["laneId"]).toBeNull()
    expect(payload["referenceLinks"]).toEqual([
      { id: "lk-1", title: "Lookbook", url: "https://example.com/lookbook.pdf", type: "document" },
    ])
  })
})

