import { describe, it, expect, vi, beforeEach } from "vitest"

const setDoc = vi.fn()

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn(),
  doc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/"), id: seg[seg.length - 1] })),
  serverTimestamp: vi.fn(() => "ts"),
  setDoc: (...args: unknown[]) => setDoc(...args),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

import { saveColorSwatch } from "./colorSwatchWrites"

function lastPayload(): Record<string, unknown> {
  const call = setDoc.mock.calls[setDoc.mock.calls.length - 1]!
  return call[1] as Record<string, unknown>
}

describe("saveColorSwatch", () => {
  beforeEach(() => {
    setDoc.mockReset()
    setDoc.mockResolvedValue(undefined)
  })

  it("keeps stored aliases and swatch image when an update does not pass them", async () => {
    await saveColorSwatch({
      clientId: "c1",
      swatchId: "oxblood",
      name: "Oxblood",
      hexColor: "#4a0000",
      isNew: false,
    })

    const payload = lastPayload()
    expect(payload).not.toHaveProperty("aliases")
    expect(payload).not.toHaveProperty("swatchImagePath")
    expect(payload).toMatchObject({ name: "Oxblood", colorKey: "oxblood", hexColor: "#4A0000" })
    expect(setDoc.mock.calls[0]![2]).toEqual({ merge: true })
  })

  it("writes aliases and swatch image when passed explicitly", async () => {
    await saveColorSwatch({
      clientId: "c1",
      swatchId: "oxblood",
      name: "Oxblood",
      aliases: ["Ox Blood", ""],
      swatchImagePath: "images/colorSwatches/oxblood/oxblood.webp",
      isNew: false,
    })

    expect(lastPayload()).toMatchObject({
      aliases: ["Ox Blood"],
      swatchImagePath: "images/colorSwatches/oxblood/oxblood.webp",
    })
  })

  it("initialises hex, aliases and swatch image on create", async () => {
    await saveColorSwatch({ clientId: "c1", swatchId: "olive", name: "Olive", isNew: true })

    expect(lastPayload()).toMatchObject({
      hexColor: null,
      aliases: [],
      swatchImagePath: null,
      createdAt: "ts",
    })
  })

  it("keeps the stored hex when an update does not pass one", async () => {
    await saveColorSwatch({ clientId: "c1", swatchId: "olive", name: "Olive", isNew: false })

    expect(lastPayload()).not.toHaveProperty("hexColor")
  })

  it("clears the hex when an update passes null", async () => {
    await saveColorSwatch({
      clientId: "c1",
      swatchId: "olive",
      name: "Olive",
      hexColor: null,
      isNew: false,
    })

    expect(lastPayload()).toHaveProperty("hexColor", null)
  })
})
