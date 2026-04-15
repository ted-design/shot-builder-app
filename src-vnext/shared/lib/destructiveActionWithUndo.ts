import { toast } from "sonner"

import type {
  UndoableAction,
  UseUndoStackResult,
} from "@/shared/hooks/useUndoStack"

const DEFAULT_UNDO_TOAST_DURATION_MS = 5000

export interface DestructiveActionWithUndoArgs<T> {
  readonly label: string
  readonly snapshot: T
  readonly perform: () => Promise<void>
  readonly undo: (snapshot: T) => Promise<void>
  readonly stack: UseUndoStackResult<T>
  readonly durationMs?: number
}

/**
 * Runs a destructive UI action, pushes an undoable entry onto the stack,
 * and surfaces a sonner toast with an Undo action button.
 *
 * Error semantics:
 * - If `perform` rejects (or throws synchronously), the error is re-thrown
 *   so the caller can handle it with its own feedback. No toast is shown —
 *   each call site already owns its error UI (existing toast.error pattern).
 * - If the `undo` callback rejects after the user clicks Undo, the error
 *   is logged and surfaced as toast.error("Couldn't undo — try again.").
 *   The stack entry is still removed because the window has closed.
 *
 * Returns the UndoableAction that was pushed, so callers can reference
 * its id if they need to coordinate with the stack (e.g. dismiss on
 * external state changes).
 */
export async function destructiveActionWithUndo<T>(
  args: DestructiveActionWithUndoArgs<T>,
): Promise<UndoableAction<T>> {
  await args.perform()

  const action = args.stack.push({
    label: args.label,
    snapshot: args.snapshot,
    undo: args.undo,
  })

  toast(args.label, {
    duration: args.durationMs ?? DEFAULT_UNDO_TOAST_DURATION_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void args.undo(action.snapshot).catch((err) => {
          console.error("Undo failed", err)
          toast.error("Couldn't undo — try again.")
        })
        args.stack.remove(action.id)
      },
    },
  })

  return action
}
