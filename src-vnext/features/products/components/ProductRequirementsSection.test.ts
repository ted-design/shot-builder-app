import { describe, it, expect, beforeEach, afterEach } from "vitest"

/**
 * Test the view mode persistence logic used by ProductRequirementsSection.
 * The component uses useSyncExternalStore with localStorage to toggle between
 * "chips" and "table" views. We replicate the standalone functions here to
 * test their behavior without rendering the full component tree.
 */

type ViewMode = "chips" | "table"
const STORAGE_KEY = "sb:requirements-view"

function getSnapshot(): ViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return stored === "table" ? "table" : "chips"
  } catch {
    return "chips"
  }
}

function getServerSnapshot(): ViewMode {
  return "chips"
}

function setViewMode(mode: ViewMode): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode)
    globalThis.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
  } catch {
    // Ignore storage errors.
  }
}

describe("ProductRequirementsSection view mode logic", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe("getSnapshot", () => {
    it("returns 'chips' by default when localStorage is empty", () => {
      expect(getSnapshot()).toBe("chips")
    })

    it("returns 'table' when localStorage has 'table'", () => {
      localStorage.setItem(STORAGE_KEY, "table")
      expect(getSnapshot()).toBe("table")
    })

    it("returns 'chips' when localStorage has 'chips'", () => {
      localStorage.setItem(STORAGE_KEY, "chips")
      expect(getSnapshot()).toBe("chips")
    })

    it("returns 'chips' for any unrecognized stored value", () => {
      localStorage.setItem(STORAGE_KEY, "grid")
      expect(getSnapshot()).toBe("chips")
    })

    it("returns 'chips' for empty string", () => {
      localStorage.setItem(STORAGE_KEY, "")
      expect(getSnapshot()).toBe("chips")
    })
  })

  describe("getServerSnapshot", () => {
    it("always returns 'chips' (SSR default)", () => {
      expect(getServerSnapshot()).toBe("chips")
    })

    it("returns 'chips' regardless of localStorage state", () => {
      localStorage.setItem(STORAGE_KEY, "table")
      expect(getServerSnapshot()).toBe("chips")
    })
  })

  describe("setViewMode", () => {
    it("persists 'table' to localStorage", () => {
      setViewMode("table")
      expect(localStorage.getItem(STORAGE_KEY)).toBe("table")
    })

    it("persists 'chips' to localStorage", () => {
      setViewMode("chips")
      expect(localStorage.getItem(STORAGE_KEY)).toBe("chips")
    })

    it("roundtrips correctly: set then get", () => {
      setViewMode("table")
      expect(getSnapshot()).toBe("table")

      setViewMode("chips")
      expect(getSnapshot()).toBe("chips")
    })

    it("dispatches a StorageEvent with the correct key", () => {
      const events: StorageEvent[] = []
      const handler = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) events.push(e)
      }
      globalThis.addEventListener("storage", handler)

      setViewMode("table")
      expect(events).toHaveLength(1)
      expect(events[0]!.key).toBe(STORAGE_KEY)

      globalThis.removeEventListener("storage", handler)
    })
  })
})
