import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  RELOAD_GUARD_KEY as GUARD_KEY,
  handlePreloadError,
  installChunkReloadHandler,
} from "./chunkReload"

function makeEvent(): Event {
  const event = new Event("vite:preloadError", { cancelable: true })
  vi.spyOn(event, "preventDefault")
  return event
}

describe("handlePreloadError", () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
    reload.mockReset()
  })

  it("reloads once on the first preload error and swallows the event", () => {
    const event = makeEvent()
    handlePreloadError(event)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(GUARD_KEY)).toBe("1700000000000")
  })

  it("does not reload again within the loop window — error propagates to the boundary", () => {
    handlePreloadError(makeEvent())
    reload.mockClear()

    vi.setSystemTime(1_700_000_000_000 + 30_000)
    const second = makeEvent()
    handlePreloadError(second)

    expect(reload).not.toHaveBeenCalled()
    expect(second.preventDefault).not.toHaveBeenCalled()
  })

  it("reloads again once the loop window has elapsed", () => {
    handlePreloadError(makeEvent())
    reload.mockClear()

    vi.setSystemTime(1_700_000_000_000 + 61_000)
    handlePreloadError(makeEvent())

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("still reloads when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })

    const event = makeEvent()
    handlePreloadError(event)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})

describe("installChunkReloadHandler", () => {
  it("registers the handler for vite:preloadError", () => {
    const addEventListener = vi.spyOn(window, "addEventListener")
    installChunkReloadHandler()

    expect(addEventListener).toHaveBeenCalledWith("vite:preloadError", handlePreloadError)
    addEventListener.mockRestore()
    window.removeEventListener("vite:preloadError", handlePreloadError)
  })
})
