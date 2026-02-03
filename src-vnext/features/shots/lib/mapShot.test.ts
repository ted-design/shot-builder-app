import { describe, expect, it } from "vitest"
import { mapShot } from "@/features/shots/lib/mapShot"

describe("mapShot", () => {
  it("falls back to legacy name when title is missing", () => {
    const shot = mapShot("s1", {
      name: "Legacy Shot Name",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
    })
    expect(shot.title).toBe("Legacy Shot Name")
  })

  it("derives heroImage from legacy attachments when heroImage is absent", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      attachments: [
        { path: "shots/s1/a.jpg", downloadURL: "https://example.com/a.jpg", isPrimary: true },
      ],
    })
    expect(shot.heroImage).toEqual({
      path: "shots/s1/a.jpg",
      downloadURL: "https://example.com/a.jpg",
    })
  })

  it("prefers a designated look reference when present", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      looks: [
        {
          displayImageId: "ref-2",
          references: [
            { id: "ref-1", downloadURL: "https://example.com/1.jpg", path: "shots/s1/1.jpg" },
            { id: "ref-2", downloadURL: "https://example.com/2.jpg", path: "shots/s1/2.jpg" },
          ],
        },
      ],
    })
    expect(shot.heroImage?.downloadURL).toBe("https://example.com/2.jpg")
    expect(shot.heroImage?.path).toBe("shots/s1/2.jpg")
  })
})

