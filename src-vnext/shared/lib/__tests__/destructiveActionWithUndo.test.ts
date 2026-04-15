import { describe, it, expect, vi, beforeEach } from "vitest"

import type {
  UndoableAction,
  UseUndoStackResult,
} from "@/shared/hooks/useUndoStack"

import { destructiveActionWithUndo } from "../destructiveActionWithUndo"

const { toastMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(toastMock, {
    error: toastErrorMock,
    success: toastSuccessMock,
  }),
}))

type Snapshot = { id: string; value: string }

function buildFakeStack(
  overrides: Partial<UseUndoStackResult<Snapshot>> = {},
): UseUndoStackResult<Snapshot> {
  const pushMock = vi.fn(
    ({
      label,
      snapshot,
      undo,
    }: {
      label: string
      snapshot: Snapshot
      undo: (snapshot: Snapshot) => Promise<void>
    }): UndoableAction<Snapshot> => ({
      id: "fake-id",
      label,
      snapshot,
      undo,
      createdAt: 123,
    }),
  )
  return {
    actions: [],
    push: pushMock,
    pop: vi.fn(() => null),
    remove: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  }
}

function getToastActionOnClick(): () => void {
  const lastCall = toastMock.mock.calls[toastMock.mock.calls.length - 1]
  expect(lastCall).toBeDefined()
  const options = lastCall![1] as {
    action: { label: string; onClick: () => void }
  }
  return options.action.onClick
}

describe("destructiveActionWithUndo", () => {
  beforeEach(() => {
    toastMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
  })

  it("happy path: runs perform, pushes onto the stack, and shows a toast with Undo action", async () => {
    const stack = buildFakeStack()
    const perform = vi.fn(async () => {})
    const undo = vi.fn(async () => {})
    const snapshot: Snapshot = { id: "s1", value: "alpha" }

    await destructiveActionWithUndo({
      label: "Removed 1 crew member",
      snapshot,
      perform,
      undo,
      stack,
    })

    expect(perform).toHaveBeenCalledOnce()
    expect(stack.push).toHaveBeenCalledWith({
      label: "Removed 1 crew member",
      snapshot,
      undo,
    })
    expect(toastMock).toHaveBeenCalledWith(
      "Removed 1 crew member",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("forwards a custom durationMs to the toast options", async () => {
    const stack = buildFakeStack()
    await destructiveActionWithUndo({
      label: "Removed",
      snapshot: { id: "s1", value: "alpha" },
      perform: async () => {},
      undo: async () => {},
      stack,
      durationMs: 3000,
    })

    expect(toastMock).toHaveBeenCalledWith(
      "Removed",
      expect.objectContaining({ duration: 3000 }),
    )
  })

  it("defaults the toast duration to 5000ms when durationMs is omitted", async () => {
    const stack = buildFakeStack()
    await destructiveActionWithUndo({
      label: "Removed",
      snapshot: { id: "s1", value: "alpha" },
      perform: async () => {},
      undo: async () => {},
      stack,
    })

    expect(toastMock).toHaveBeenCalledWith(
      "Removed",
      expect.objectContaining({ duration: 5000 }),
    )
  })

  it("re-throws when perform rejects and skips toast/push entirely", async () => {
    const stack = buildFakeStack()
    const perform = vi.fn(async () => {
      throw new Error("boom")
    })

    await expect(
      destructiveActionWithUndo({
        label: "Removed",
        snapshot: { id: "s1", value: "alpha" },
        perform,
        undo: async () => {},
        stack,
      }),
    ).rejects.toThrow("boom")

    expect(stack.push).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("invokes undo and removes the stack entry when the user clicks Undo", async () => {
    const stack = buildFakeStack()
    const undo = vi.fn(async () => {})
    const snapshot: Snapshot = { id: "s1", value: "alpha" }

    await destructiveActionWithUndo({
      label: "Removed",
      snapshot,
      perform: async () => {},
      undo,
      stack,
    })

    const onClick = getToastActionOnClick()
    onClick()
    // onClick fires `void args.undo(...)` — give the microtask queue a tick.
    await Promise.resolve()

    expect(undo).toHaveBeenCalledWith(snapshot)
    expect(stack.remove).toHaveBeenCalledWith("fake-id")
  })

  it("logs + toasts when the undo callback rejects, and still removes the stale entry", async () => {
    const stack = buildFakeStack()
    const undo = vi.fn(async () => {
      throw new Error("undo-failed")
    })
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    await destructiveActionWithUndo({
      label: "Removed",
      snapshot: { id: "s1", value: "alpha" },
      perform: async () => {},
      undo,
      stack,
    })

    const onClick = getToastActionOnClick()
    onClick()
    // allow the .catch() handler to run
    await Promise.resolve()
    await Promise.resolve()

    expect(toastErrorMock).toHaveBeenCalledWith("Couldn't undo — try again.")
    expect(stack.remove).toHaveBeenCalledWith("fake-id")
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it("returns the pushed UndoableAction so callers can reference its id", async () => {
    const stack = buildFakeStack()
    const result = await destructiveActionWithUndo({
      label: "Removed",
      snapshot: { id: "s1", value: "alpha" },
      perform: async () => {},
      undo: async () => {},
      stack,
    })

    expect(result.id).toBe("fake-id")
    expect(result.label).toBe("Removed")
  })

  it("re-throws a synchronous throw from perform via the await bridge", async () => {
    const stack = buildFakeStack()
    const perform = vi.fn((): Promise<void> => {
      throw new Error("sync")
    })

    await expect(
      destructiveActionWithUndo({
        label: "Removed",
        snapshot: { id: "s1", value: "alpha" },
        perform,
        undo: async () => {},
        stack,
      }),
    ).rejects.toThrow("sync")

    expect(stack.push).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it("labels the toast action button exactly 'Undo'", async () => {
    const stack = buildFakeStack()
    await destructiveActionWithUndo({
      label: "Removed",
      snapshot: { id: "s1", value: "alpha" },
      perform: async () => {},
      undo: async () => {},
      stack,
    })

    const lastCall = toastMock.mock.calls[toastMock.mock.calls.length - 1]
    const options = lastCall![1] as {
      action: { label: string }
    }
    expect(options.action.label).toBe("Undo")
  })
})
