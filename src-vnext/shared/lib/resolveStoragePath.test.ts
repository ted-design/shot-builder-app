import { describe, it, expect, vi, beforeEach } from "vitest"

const getDownloadURL = vi.fn()

vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
}))

vi.mock("@/shared/lib/firebase", () => ({ storage: {} }))

import {
  resolveStoragePath,
  getCachedUrl,
  invalidateStoragePath,
} from "./resolveStoragePath"

const TEST_PATH = "images/talent/t1/headshot-abc.webp"

describe("resolveStoragePath cache + invalidation", () => {
  beforeEach(() => {
    getDownloadURL.mockReset()
    // Module-level cache persists across tests — clear the path we use for isolation.
    invalidateStoragePath(TEST_PATH)
  })

  it("caches a resolved URL; invalidateStoragePath forces a fresh fetch", async () => {
    getDownloadURL
      .mockResolvedValueOnce("https://x/url1")
      .mockResolvedValueOnce("https://x/url2")

    const path = TEST_PATH
    expect(await resolveStoragePath(path)).toBe("https://x/url1")
    // Second resolve is served from cache — no extra fetch.
    expect(await resolveStoragePath(path)).toBe("https://x/url1")
    expect(getDownloadURL).toHaveBeenCalledTimes(1)
    expect(getCachedUrl(path)).toBe("https://x/url1")

    // After invalidation the next resolve fetches a fresh URL (the replaced-image fix).
    invalidateStoragePath(path)
    expect(getCachedUrl(path)).toBeUndefined()
    expect(await resolveStoragePath(path)).toBe("https://x/url2")
    expect(getDownloadURL).toHaveBeenCalledTimes(2)
  })

  it("treats already-resolved URLs as pass-through and ignores invalidate for them", () => {
    expect(getCachedUrl("https://cdn/x.jpg")).toBe("https://cdn/x.jpg")
    // Must not throw for URLs or nullish input.
    invalidateStoragePath("https://cdn/x.jpg")
    invalidateStoragePath(null)
    invalidateStoragePath(undefined)
  })
})
