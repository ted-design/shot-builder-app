import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useKeyboardShortcuts, type KeyBinding } from "./useKeyboardShortcuts"

function fireKey(
  key: string,
  options: Partial<KeyboardEventInit> = {},
  target?: HTMLElement,
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  })
  ;(target ?? document).dispatchEvent(event)
  return event
}

describe("useKeyboardShortcuts", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("calls handler when matching key is pressed", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("n")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("matches keys case-insensitively for single letters", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("N")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not call handler for non-matching key", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("m")
    expect(handler).not.toHaveBeenCalled()
  })

  it("ignores keystrokes in input elements", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const input = document.createElement("input")
    document.body.appendChild(input)
    try {
      fireKey("n", {}, input)
      expect(handler).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(input)
    }
  })

  it("ignores keystrokes in textarea elements", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    try {
      fireKey("n", {}, textarea)
      expect(handler).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(textarea)
    }
  })

  it("ignores keystrokes in select elements", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const select = document.createElement("select")
    document.body.appendChild(select)
    try {
      fireKey("n", {}, select)
      expect(handler).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(select)
    }
  })

  it("ignores keystrokes in contentEditable elements", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const div = document.createElement("div")
    div.contentEditable = "true"
    document.body.appendChild(div)
    try {
      fireKey("n", {}, div)
      expect(handler).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(div)
    }
  })

  it("matches meta modifier (metaKey)", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "s", meta: true, handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    // Without meta — should not fire
    fireKey("s")
    expect(handler).not.toHaveBeenCalled()

    // With meta — should fire
    fireKey("s", { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("matches meta modifier (ctrlKey)", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "s", meta: true, handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("s", { ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("matches shift modifier", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", shift: true, handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    // Without shift — should not fire
    fireKey("n")
    expect(handler).not.toHaveBeenCalled()

    // With shift — should fire
    fireKey("n", { shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not fire when meta is pressed but not required", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("n", { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it("handles Escape key", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "Escape", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("Escape")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("handles bracket keys", () => {
    const prevHandler = vi.fn()
    const nextHandler = vi.fn()
    const bindings: KeyBinding[] = [
      { key: "[", handler: prevHandler },
      { key: "]", handler: nextHandler },
    ]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("[")
    fireKey("]")
    expect(prevHandler).toHaveBeenCalledOnce()
    expect(nextHandler).toHaveBeenCalledOnce()
  })

  it("handles number keys for status shortcuts", () => {
    const handlers = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]
    const bindings: KeyBinding[] = [
      { key: "1", handler: handlers[0]! },
      { key: "2", handler: handlers[1]! },
      { key: "3", handler: handlers[2]! },
      { key: "4", handler: handlers[3]! },
    ]

    renderHook(() => useKeyboardShortcuts(bindings))

    fireKey("1")
    fireKey("2")
    fireKey("3")
    fireKey("4")
    for (const h of handlers) {
      expect(h).toHaveBeenCalledOnce()
    }
  })

  it("is disabled when enabled option is false", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings, { enabled: false }))

    fireKey("n")
    expect(handler).not.toHaveBeenCalled()
  })

  it("cleans up event listener on unmount", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    const { unmount } = renderHook(() => useKeyboardShortcuts(bindings))
    unmount()

    fireKey("n")
    expect(handler).not.toHaveBeenCalled()
  })

  it("prevents default on matched key", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const event = fireKey("n")
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not prevent default on non-matched key", () => {
    const handler = vi.fn()
    const bindings: KeyBinding[] = [{ key: "n", handler }]

    renderHook(() => useKeyboardShortcuts(bindings))

    const event = fireKey("m")
    expect(event.defaultPrevented).toBe(false)
  })
})
