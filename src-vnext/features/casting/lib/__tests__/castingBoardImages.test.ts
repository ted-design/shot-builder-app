/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import {
  buildBoardImageModel,
  resolveVisibleBoardImages,
} from "../castingBoardImages"
import type { CastingBoardEntry, TalentRecord } from "@/shared/types"

function makeTalent(overrides: Partial<TalentRecord> = {}): TalentRecord {
  return {
    id: "t1",
    name: "Jane Doe",
    galleryImages: [
      { id: "g1", path: "gallery/g1.jpg", downloadURL: "https://x/g1", description: "front" },
      { id: "g2", path: "gallery/g2.jpg" },
    ],
    castingSessions: [
      {
        id: "s1",
        date: "2026-01-15",
        title: "Spring Casting",
        images: [
          { id: "s1i1", path: "sess/s1i1.jpg", downloadURL: "https://x/s1i1" },
          { id: "s1i2", path: "sess/s1i2.jpg" },
        ],
      },
      {
        id: "s2",
        date: "2026-02-20",
        images: [{ id: "s2i1", path: "sess/s2i1.jpg" }],
      },
    ],
    ...overrides,
  } as TalentRecord
}

function makeEntry(overrides: Partial<CastingBoardEntry> = {}): CastingBoardEntry {
  return {
    id: "t1",
    talentId: "t1",
    talentName: "Jane Doe",
    talentAgency: null,
    status: "shortlist",
    notes: null,
    roleLabel: null,
    hiddenImageIds: [],
    hiddenSessionIds: [],
    sortOrder: 0,
    addedBy: "u1",
    addedAt: null,
    updatedAt: null,
    ...overrides,
  }
}

describe("resolveVisibleBoardImages", () => {
  it("returns all gallery + session images when nothing hidden", () => {
    const res = resolveVisibleBoardImages(makeTalent(), makeEntry())
    expect(res.gallery.map((i) => i.id)).toEqual(["g1", "g2"])
    expect(res.folders.map((f) => f.id)).toEqual(["s1", "s2"])
    expect(res.allVisible.map((i) => i.id)).toEqual([
      "g1",
      "g2",
      "s1i1",
      "s1i2",
      "s2i1",
    ])
    expect(res.hasHiddenCandidates).toBe(true)
  })

  it("normalizes image fields (downloadURL/description default to null)", () => {
    const res = resolveVisibleBoardImages(makeTalent(), makeEntry())
    const g2 = res.gallery.find((i) => i.id === "g2")!
    expect(g2.downloadURL).toBeNull()
    expect(g2.description).toBeNull()
    const g1 = res.gallery.find((i) => i.id === "g1")!
    expect(g1.downloadURL).toBe("https://x/g1")
    expect(g1.description).toBe("front")
  })

  it("filters a hidden gallery image out of gallery and allVisible", () => {
    const res = resolveVisibleBoardImages(
      makeTalent(),
      makeEntry({ hiddenImageIds: ["g1"] }),
    )
    expect(res.gallery.map((i) => i.id)).toEqual(["g2"])
    expect(res.allVisible.map((i) => i.id)).not.toContain("g1")
  })

  it("filters a hidden session image out of its folder and allVisible", () => {
    const res = resolveVisibleBoardImages(
      makeTalent(),
      makeEntry({ hiddenImageIds: ["s1i1"] }),
    )
    const s1 = res.folders.find((f) => f.id === "s1")!
    expect(s1.images.map((i) => i.id)).toEqual(["s1i2"])
    expect(res.allVisible.map((i) => i.id)).not.toContain("s1i1")
  })

  it("removes a hidden whole session (folder + all its images)", () => {
    const res = resolveVisibleBoardImages(
      makeTalent(),
      makeEntry({ hiddenSessionIds: ["s1"] }),
    )
    expect(res.folders.map((f) => f.id)).toEqual(["s2"])
    expect(res.allVisible.map((i) => i.id)).toEqual(["g1", "g2", "s2i1"])
  })

  it("treats a null entry as nothing hidden", () => {
    const res = resolveVisibleBoardImages(makeTalent(), null)
    expect(res.allVisible).toHaveLength(5)
  })

  it("returns empty for a null talent", () => {
    const res = resolveVisibleBoardImages(null, makeEntry())
    expect(res.gallery).toEqual([])
    expect(res.folders).toEqual([])
    expect(res.allVisible).toEqual([])
    expect(res.hasHiddenCandidates).toBe(false)
  })

  it("returns empty (no hidden candidates) for a talent with no images", () => {
    const res = resolveVisibleBoardImages(
      makeTalent({ galleryImages: [], castingSessions: [] }),
      makeEntry(),
    )
    expect(res.allVisible).toEqual([])
    expect(res.hasHiddenCandidates).toBe(false)
  })

  it("uses folder title fallback: trimmed title, else Casting+date, else Casting", () => {
    const res = resolveVisibleBoardImages(
      makeTalent({
        castingSessions: [
          { id: "a", date: "2026-01-15", title: "  Spring  ", images: [] },
          { id: "b", date: "2026-02-20", title: "   ", images: [] },
          { id: "c", date: "", title: null, images: [] },
        ],
      }),
      makeEntry(),
    )
    expect(res.folders.map((f) => f.title)).toEqual([
      "Spring",
      "Casting 2026-02-20",
      "Casting",
    ])
  })
})

describe("buildBoardImageModel", () => {
  it("annotates every image and folder with a hidden flag (nothing hidden)", () => {
    const model = buildBoardImageModel(makeTalent(), makeEntry())
    expect(model.gallery.map((g) => g.hidden)).toEqual([false, false])
    expect(model.folders).toHaveLength(2)
    expect(
      model.folders.every(
        (f) => !f.hidden && f.images.every((i) => !i.hidden),
      ),
    ).toBe(true)
  })

  it("flags a hidden individual image without dropping it", () => {
    const model = buildBoardImageModel(
      makeTalent(),
      makeEntry({ hiddenImageIds: ["g1", "s1i2"] }),
    )
    expect(model.gallery.find((g) => g.img.id === "g1")!.hidden).toBe(true)
    expect(model.gallery.find((g) => g.img.id === "g2")!.hidden).toBe(false)
    const s1 = model.folders.find((f) => f.id === "s1")!
    expect(s1.images.find((i) => i.img.id === "s1i2")!.hidden).toBe(true)
    expect(s1.images.find((i) => i.img.id === "s1i1")!.hidden).toBe(false)
  })

  it("flags a hidden whole session AND all its images as hidden", () => {
    const model = buildBoardImageModel(
      makeTalent(),
      makeEntry({ hiddenSessionIds: ["s1"] }),
    )
    const s1 = model.folders.find((f) => f.id === "s1")!
    expect(s1.hidden).toBe(true)
    expect(s1.images.every((i) => i.hidden)).toBe(true)
  })

  it("null entry → nothing hidden; null talent → empty", () => {
    expect(
      buildBoardImageModel(makeTalent(), null).gallery.every((g) => !g.hidden),
    ).toBe(true)
    expect(buildBoardImageModel(null, makeEntry())).toEqual({
      gallery: [],
      folders: [],
    })
  })
})
