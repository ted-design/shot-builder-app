import { describe, it, expect } from "vitest"
import { mapShot } from "../mapShot"

// Sets initiative — Phase 1. `mediaType` is a first-class, defensive enum:
// only "photo"/"video" survive the read; anything else (legacy garbage, wrong
// type, absent) maps to undefined so no read site ever sees an invalid value.

const BASE = { title: "A", projectId: "p1", clientId: "c1" }

describe("mapShot — mediaType (Sets)", () => {
  it("maps 'photo'", () => {
    expect(mapShot("s1", { ...BASE, mediaType: "photo" }).mediaType).toBe("photo")
  })

  it("maps 'video'", () => {
    expect(mapShot("s1", { ...BASE, mediaType: "video" }).mediaType).toBe("video")
  })

  it("rejects unknown string values -> undefined", () => {
    expect(mapShot("s1", { ...BASE, mediaType: "audio" }).mediaType).toBeUndefined()
    expect(mapShot("s1", { ...BASE, mediaType: "PHOTO" }).mediaType).toBeUndefined()
  })

  it("rejects non-string values -> undefined", () => {
    expect(mapShot("s1", { ...BASE, mediaType: 3 }).mediaType).toBeUndefined()
    expect(mapShot("s1", { ...BASE, mediaType: null }).mediaType).toBeUndefined()
    expect(mapShot("s1", { ...BASE, mediaType: true }).mediaType).toBeUndefined()
  })

  it("absent -> undefined (legacy shots)", () => {
    expect(mapShot("s1", { ...BASE }).mediaType).toBeUndefined()
  })
})
