import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildShotsPdfRows, normalizePdfTextForRender } from "./buildShotsPdfRows"
import type { Shot } from "@/shared/types"
import { resolvePdfImageSrc } from "@/features/shots/lib/resolvePdfImageSrc"

vi.mock("@/features/shots/lib/resolvePdfImageSrc", () => ({
  resolvePdfImageSrc: vi.fn(),
}))

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test Shot",
    projectId: "project-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    createdAt: {} as Shot["createdAt"],
    updatedAt: {} as Shot["updatedAt"],
    createdBy: "user-1",
    ...overrides,
  }
}

describe("buildShotsPdfRows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resolves hero image using downloadURL first (same as shot cards)", async () => {
    const resolveMock = vi.mocked(resolvePdfImageSrc)
    resolveMock.mockResolvedValue("data:image/jpeg;base64,abc")

    const rows = await buildShotsPdfRows({
      shots: [
        makeShot({
          heroImage: {
            downloadURL: "https://cdn.example.com/hero.jpg",
            path: "clients/c1/shots/s1/hero.webp",
          },
        }),
      ],
      includeHero: true,
    })

    expect(resolveMock).toHaveBeenCalledWith("https://cdn.example.com/hero.jpg")
    expect(rows[0]?.heroImageRequested).toBe(true)
    expect(rows[0]?.heroImageMissing).toBe(false)
    expect(rows[0]?.heroImageUrl).toBe("data:image/jpeg;base64,abc")
  })

  it("marks hero image as missing when embedding fails", async () => {
    const resolveMock = vi.mocked(resolvePdfImageSrc)
    resolveMock.mockResolvedValue(null)

    const rows = await buildShotsPdfRows({
      shots: [
        makeShot({
          heroImage: {
            downloadURL: "https://cdn.example.com/missing.jpg",
            path: "clients/c1/shots/s1/hero.webp",
          },
        }),
      ],
      includeHero: true,
    })

    expect(rows[0]?.heroImageRequested).toBe(true)
    expect(rows[0]?.heroImageMissing).toBe(true)
    expect(rows[0]?.heroImageUrl).toBeNull()
  })

  it("skips hero resolution when hero export is disabled", async () => {
    const resolveMock = vi.mocked(resolvePdfImageSrc)
    resolveMock.mockResolvedValue("data:image/jpeg;base64,abc")

    const rows = await buildShotsPdfRows({
      shots: [
        makeShot({
          heroImage: {
            downloadURL: "https://cdn.example.com/hero.jpg",
            path: "clients/c1/shots/s1/hero.webp",
          },
        }),
      ],
      includeHero: false,
    })

    expect(resolveMock).not.toHaveBeenCalled()
    expect(rows[0]?.heroImageRequested).toBe(false)
    expect(rows[0]?.heroImageMissing).toBe(false)
    expect(rows[0]?.heroImageUrl).toBeNull()
  })

  it("normalizes addendum punctuation/control glyphs for PDF-safe rendering", async () => {
    const resolveMock = vi.mocked(resolvePdfImageSrc)
    resolveMock.mockResolvedValue(null)

    const rows = await buildShotsPdfRows({
      shots: [
        makeShot({
          notesAddendum: "Close-up\u00a0of water\u2013repellent shell fabric\u2022Stretch twill\u200B",
        }),
      ],
      includeHero: false,
    })

    expect(rows[0]?.notesAddendum).toBe("Close-up of water-repellent shell fabric - Stretch twill")
  })
})

describe("normalizePdfTextForRender", () => {
  it("returns null for empty/whitespace values", () => {
    expect(normalizePdfTextForRender(" \u00a0 ")).toBeNull()
  })

  it("normalizes Unicode punctuation and removes control chars", () => {
    expect(normalizePdfTextForRender("“Quoted”\nLine\u2014two\u0007")).toBe("\"Quoted\" Line-two")
  })

  it("transliterates accents/ligatures and removes unsupported glyphs", () => {
    expect(normalizePdfTextForRender("José Straße — naïve 🧥")).toBe("Jose Strasse - naive")
    expect(normalizePdfTextForRender("Æther × 2 … ready™")).toBe("AEther x 2 ... readyTM")
  })
})
