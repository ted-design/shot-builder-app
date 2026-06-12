/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { CastingBoardEntry, CastingShareVisibility } from "@/shared/types"

// getDownloadURL echoes the path so we can assert which images survived the
// hidden-id curation. ref returns a small object carrying the path through.
vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(async (r: { path: string }) => `url:${r.path}`),
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
}))

const getDoc = vi.fn()
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: (...args: unknown[]) => getDoc(...args),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {}, storage: {} }))

vi.mock("@/shared/lib/paths", () => ({
  talentPath: (clientId: string) => ["clients", clientId, "talent"],
}))

import { resolveTalentForCastingShare } from "./resolveTalentForShare"

const visibleAll: CastingShareVisibility = {
  agency: true,
  measurements: true,
  portfolio: true,
  castingNotes: true,
}

function makeEntry(overrides: Partial<CastingBoardEntry>): CastingBoardEntry {
  return {
    id: overrides.id ?? "t1",
    talentId: overrides.talentId ?? "t1",
    talentName: overrides.talentName ?? "Talent One",
    talentAgency: overrides.talentAgency ?? null,
    status: overrides.status ?? "shortlist",
    notes: overrides.notes ?? null,
    roleLabel: overrides.roleLabel ?? null,
    hiddenImageIds: overrides.hiddenImageIds,
    hiddenSessionIds: overrides.hiddenSessionIds,
    sortOrder: overrides.sortOrder ?? 0,
    addedBy: overrides.addedBy ?? "u1",
    addedAt: overrides.addedAt,
    updatedAt: overrides.updatedAt,
  }
}

function mockTalentDoc(data: Record<string, unknown>) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => data })
}

describe("resolveTalentForCastingShare — hidden curation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("excludes hidden gallery images from the resolved payload", async () => {
    mockTalentDoc({
      name: "Talent One",
      galleryImages: [
        { id: "g1", path: "p/g1.jpg" },
        { id: "g2", path: "p/g2.jpg" },
        { id: "g3", path: "p/g3.jpg" },
      ],
    })

    const [resolved] = await resolveTalentForCastingShare({
      clientId: "c1",
      entries: [makeEntry({ hiddenImageIds: ["g2"] })],
      visibleFields: visibleAll,
    })

    expect(resolved!.galleryUrls).toEqual(["url:p/g1.jpg", "url:p/g3.jpg"])
  })

  it("excludes a whole hidden session and its images", async () => {
    mockTalentDoc({
      name: "Talent One",
      castingSessions: [
        {
          id: "s1",
          date: "2026-01-01",
          title: "Session One",
          images: [{ id: "s1i1", path: "p/s1i1.jpg" }],
        },
        {
          id: "s2",
          date: "2026-02-02",
          title: "Session Two",
          images: [{ id: "s2i1", path: "p/s2i1.jpg" }],
        },
      ],
    })

    const [resolved] = await resolveTalentForCastingShare({
      clientId: "c1",
      entries: [makeEntry({ hiddenSessionIds: ["s2"] })],
      visibleFields: visibleAll,
    })

    const titles = (resolved!.castingSessions ?? []).map((s) => s.title)
    expect(titles).toEqual(["Session One"])
    expect(resolved!.castingImageUrls).toEqual(["url:p/s1i1.jpg"])
  })

  it("excludes hidden images within a kept session", async () => {
    mockTalentDoc({
      name: "Talent One",
      castingSessions: [
        {
          id: "s1",
          date: "2026-01-01",
          title: "Session One",
          images: [
            { id: "s1i1", path: "p/s1i1.jpg" },
            { id: "s1i2", path: "p/s1i2.jpg" },
          ],
        },
      ],
    })

    const [resolved] = await resolveTalentForCastingShare({
      clientId: "c1",
      entries: [makeEntry({ hiddenImageIds: ["s1i2"] })],
      visibleFields: visibleAll,
    })

    expect(resolved!.castingSessions?.[0]?.imageUrls).toEqual(["url:p/s1i1.jpg"])
    expect(resolved!.castingImageUrls).toEqual(["url:p/s1i1.jpg"])
  })

  it("keeps every image when nothing is hidden (no regression)", async () => {
    mockTalentDoc({
      name: "Talent One",
      galleryImages: [
        { id: "g1", path: "p/g1.jpg" },
        { id: "g2", path: "p/g2.jpg" },
      ],
      castingSessions: [
        {
          id: "s1",
          date: "2026-01-01",
          title: "Session One",
          images: [{ id: "s1i1", path: "p/s1i1.jpg" }],
        },
      ],
    })

    const [resolved] = await resolveTalentForCastingShare({
      clientId: "c1",
      entries: [makeEntry({})],
      visibleFields: visibleAll,
    })

    expect(resolved!.galleryUrls).toEqual(["url:p/g1.jpg", "url:p/g2.jpg"])
    expect(resolved!.castingImageUrls).toEqual(["url:p/s1i1.jpg"])
  })
})
