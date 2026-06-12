import { describe, it, expect, vi, beforeEach } from "vitest"

const updateDoc = vi.fn()
const addDoc = vi.fn()
const uploadBytes = vi.fn()
const getDownloadURL = vi.fn()
const deleteObject = vi.fn()
const invalidateStoragePath = vi.fn()

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDoc(...args),
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
  serverTimestamp: vi.fn(() => "ts"),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
}))

vi.mock("firebase/storage", () => ({
  deleteObject: (...args: unknown[]) => deleteObject(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {}, storage: {} }))
vi.mock("@/shared/lib/paths", () => ({
  talentPath: (clientId: string) => ["clients", clientId, "talent"],
}))
vi.mock("@/shared/lib/uploadImage", () => ({
  compressImageToWebp: vi.fn(async () => new Blob(["webp"])),
  validateImageFileForUpload: vi.fn(),
}))
vi.mock("@/shared/lib/resolveStoragePath", () => ({
  invalidateStoragePath: (...args: unknown[]) => invalidateStoragePath(...args),
}))

import { createTalent, setTalentHeadshot, removeTalentHeadshot } from "./talentWrites"

const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })

describe("talent headshot writes (replaced-image fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadBytes.mockResolvedValue(undefined)
    getDownloadURL.mockResolvedValue("https://storage/new-url")
    updateDoc.mockResolvedValue(undefined)
    deleteObject.mockResolvedValue(undefined)
    addDoc.mockResolvedValue({ id: "new-talent-id" })
  })

  it("createTalent with a headshot uploads to a UNIQUE path (not the fixed headshot.webp)", async () => {
    await createTalent({
      clientId: "unbound-merino",
      userId: "u1",
      name: "New Model",
      headshotFile: file,
    })
    // First updateDoc call is the headshot patch on the freshly-created doc.
    const written = updateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(written.headshotPath).toMatch(/^images\/talent\/new-talent-id\/headshot-[0-9a-f-]+\.webp$/)
    expect(written.headshotPath).not.toBe("images/talent/new-talent-id/headshot.webp")
    expect(written.imageUrl).toBe(written.headshotPath)
    expect(written.headshotUrl).toBe("https://storage/new-url")
  })

  it("setTalentHeadshot uploads to a UNIQUE path (never the fixed headshot.webp)", async () => {
    const res = await setTalentHeadshot({
      clientId: "unbound-merino",
      userId: "u1",
      talentId: "t1",
      file,
      previousPath: "images/talent/t1/headshot.webp",
    })
    // Unique per upload — this is what stops the stale-cache "old image comes back" bug.
    expect(res.path).toMatch(/^images\/talent\/t1\/headshot-[0-9a-f-]+\.webp$/)
    expect(res.path).not.toBe("images/talent/t1/headshot.webp")

    const written = updateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(written.headshotPath).toBe(res.path)
    expect(written.imageUrl).toBe(res.path)
    expect(written.headshotUrl).toBe("https://storage/new-url")
  })

  it("two replacements produce different paths", async () => {
    const a = await setTalentHeadshot({ clientId: "c", userId: "u", talentId: "t1", file })
    const b = await setTalentHeadshot({ clientId: "c", userId: "u", talentId: "t1", file })
    expect(a.path).not.toBe(b.path)
  })

  it("invalidates the cache but does NOT delete the previous object on replace (casting shares snapshot it)", async () => {
    const prev = "images/talent/t1/headshot.webp"
    await setTalentHeadshot({ clientId: "c", userId: "u", talentId: "t1", file, previousPath: prev })
    expect(invalidateStoragePath).toHaveBeenCalledWith(prev)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it("removeTalentHeadshot clears all three image fields + invalidates cache (no object delete — symmetric with replace)", async () => {
    const prev = "images/talent/t1/headshot-xyz.webp"
    await removeTalentHeadshot({ clientId: "c", userId: "u", talentId: "t1", previousPath: prev })

    const written = updateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(written.headshotPath).toBeNull()
    expect(written.headshotUrl).toBeNull()
    expect(written.imageUrl).toBeNull()
    expect(invalidateStoragePath).toHaveBeenCalledWith(prev)
    expect(deleteObject).not.toHaveBeenCalled()
  })
})
