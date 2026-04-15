import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { useUndoStack } from "../useUndoStack"

type SimpleSnapshot = { value: string }
type CrewRemoved = {
  kind: "crew"
  payload: { id: string; name: string }
}

const noopUndo = async () => {}

describe("useUndoStack", () => {
  it("push() adds an action and returns the constructed UndoableAction with id + createdAt", () => {
    const before = Date.now()
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    let pushed: ReturnType<typeof result.current.push> | undefined
    act(() => {
      pushed = result.current.push({
        label: "Removed item",
        snapshot: { value: "alpha" },
        undo: noopUndo,
      })
    })

    expect(pushed).toBeDefined()
    expect(typeof pushed!.id).toBe("string")
    expect(pushed!.id.length).toBeGreaterThan(0)
    expect(pushed!.label).toBe("Removed item")
    expect(pushed!.snapshot).toEqual({ value: "alpha" })
    expect(pushed!.createdAt).toBeLessThanOrEqual(Date.now())
    expect(pushed!.createdAt).toBeGreaterThanOrEqual(before)

    expect(result.current.actions).toHaveLength(1)
    expect(result.current.actions[0]?.id).toBe(pushed!.id)
  })

  it("default capacity is 10 — after 12 pushes the oldest two are evicted, insertion order preserved", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.push({
          label: `action-${i}`,
          snapshot: { value: `v${i}` },
          undo: noopUndo,
        })
      }
    })

    expect(result.current.actions).toHaveLength(10)
    expect(result.current.actions[0]?.label).toBe("action-2")
    expect(result.current.actions[9]?.label).toBe("action-11")
    expect(result.current.actions[result.current.actions.length - 1]?.label).toBe(
      "action-11",
    )
  })

  it("custom capacity evicts after the (capacity+1)th push, preserving insertion order", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>({ capacity: 3 }))

    act(() => {
      result.current.push({ label: "a", snapshot: { value: "a" }, undo: noopUndo })
      result.current.push({ label: "b", snapshot: { value: "b" }, undo: noopUndo })
      result.current.push({ label: "c", snapshot: { value: "c" }, undo: noopUndo })
      result.current.push({ label: "d", snapshot: { value: "d" }, undo: noopUndo })
    })

    expect(result.current.actions).toHaveLength(3)
    expect(result.current.actions.map((entry) => entry.label)).toEqual(["b", "c", "d"])
  })

  it("pop() returns the most recently pushed action and removes it; empty stack returns null", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    act(() => {
      result.current.push({ label: "first", snapshot: { value: "1" }, undo: noopUndo })
      result.current.push({ label: "second", snapshot: { value: "2" }, undo: noopUndo })
      result.current.push({ label: "third", snapshot: { value: "3" }, undo: noopUndo })
    })

    let firstPop: ReturnType<typeof result.current.pop> | undefined
    act(() => {
      firstPop = result.current.pop()
    })
    expect(firstPop?.label).toBe("third")
    expect(result.current.actions).toHaveLength(2)

    let secondPop: ReturnType<typeof result.current.pop> | undefined
    act(() => {
      secondPop = result.current.pop()
    })
    expect(secondPop?.label).toBe("second")
    expect(result.current.actions).toHaveLength(1)

    let thirdPop: ReturnType<typeof result.current.pop> | undefined
    act(() => {
      thirdPop = result.current.pop()
    })
    expect(thirdPop?.label).toBe("first")
    expect(result.current.actions).toHaveLength(0)

    let emptyPop: ReturnType<typeof result.current.pop> | undefined
    act(() => {
      emptyPop = result.current.pop()
    })
    expect(emptyPop).toBeNull()
    expect(result.current.actions).toHaveLength(0)
  })

  it("remove(id) deletes the matching action, preserving order; missing id is a no-op", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    const ids: string[] = []
    act(() => {
      ids.push(
        result.current.push({ label: "a", snapshot: { value: "a" }, undo: noopUndo }).id,
      )
      ids.push(
        result.current.push({ label: "b", snapshot: { value: "b" }, undo: noopUndo }).id,
      )
      ids.push(
        result.current.push({ label: "c", snapshot: { value: "c" }, undo: noopUndo }).id,
      )
    })

    act(() => {
      result.current.remove(ids[1]!)
    })

    expect(result.current.actions.map((entry) => entry.label)).toEqual(["a", "c"])

    expect(() => {
      act(() => {
        result.current.remove("does-not-exist")
      })
    }).not.toThrow()

    expect(result.current.actions.map((entry) => entry.label)).toEqual(["a", "c"])
  })

  it("clear() empties the actions array", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    act(() => {
      result.current.push({ label: "a", snapshot: { value: "a" }, undo: noopUndo })
      result.current.push({ label: "b", snapshot: { value: "b" }, undo: noopUndo })
    })
    expect(result.current.actions).toHaveLength(2)

    act(() => {
      result.current.clear()
    })
    expect(result.current.actions).toHaveLength(0)
  })

  it("multiple synchronous pushes inside one act() are all preserved in insertion order", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    act(() => {
      result.current.push({ label: "a", snapshot: { value: "a" }, undo: noopUndo })
      result.current.push({ label: "b", snapshot: { value: "b" }, undo: noopUndo })
      result.current.push({ label: "c", snapshot: { value: "c" }, undo: noopUndo })
    })

    expect(result.current.actions).toHaveLength(3)
    expect(result.current.actions.map((entry) => entry.label)).toEqual(["a", "b", "c"])
  })

  it("snapshots remain strongly typed through push/pop (generic T)", () => {
    const { result } = renderHook(() => useUndoStack<CrewRemoved>())

    const undoSpy = vi.fn(async (_snapshot: CrewRemoved) => {})

    act(() => {
      result.current.push({
        label: "Removed Jessica",
        snapshot: {
          kind: "crew",
          payload: { id: "crew-1", name: "Jessica" },
        },
        undo: undoSpy,
      })
    })

    let popped: ReturnType<typeof result.current.pop> | undefined
    act(() => {
      popped = result.current.pop()
    })

    expect(popped).not.toBeNull()
    expect(popped?.snapshot.kind).toBe("crew")
    // TypeScript-level check — this line would not compile if T leaked to unknown.
    expect(popped?.snapshot.payload.name).toBe("Jessica")
  })

  it("push() returns the constructed action so callers can reference its id", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    let returned: ReturnType<typeof result.current.push> | undefined
    act(() => {
      returned = result.current.push({
        label: "X",
        snapshot: { value: "x" },
        undo: noopUndo,
      })
    })

    expect(returned!.label).toBe("X")
    expect(typeof returned!.id).toBe("string")
    expect(returned!.id.length).toBeGreaterThan(0)
    expect(result.current.actions[0]?.id).toBe(returned!.id)
  })

  it("five pushes produce five distinct ids", () => {
    const { result } = renderHook(() => useUndoStack<SimpleSnapshot>())

    const ids = new Set<string>()
    act(() => {
      for (let i = 0; i < 5; i += 1) {
        const action = result.current.push({
          label: `action-${i}`,
          snapshot: { value: `v${i}` },
          undo: noopUndo,
        })
        ids.add(action.id)
      }
    })

    expect(ids.size).toBe(5)
    expect(result.current.actions).toHaveLength(5)
  })
})
