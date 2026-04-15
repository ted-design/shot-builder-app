import * as React from "react"

export const DEFAULT_UNDO_CAPACITY = 10

export interface UndoableAction<T> {
  readonly id: string
  readonly label: string
  readonly snapshot: T
  readonly undo: (snapshot: T) => Promise<void>
  readonly createdAt: number
}

export interface UndoActionInput<T> {
  readonly label: string
  readonly snapshot: T
  readonly undo: (snapshot: T) => Promise<void>
}

export interface UseUndoStackResult<T> {
  readonly actions: ReadonlyArray<UndoableAction<T>>
  push(input: UndoActionInput<T>): UndoableAction<T>
  pop(): UndoableAction<T> | null
  remove(id: string): void
  clear(): void
}

export interface UseUndoStackOptions {
  readonly capacity?: number
}

/**
 * In-memory stack of undoable UI actions.
 *
 * Pure client-side state: no Firestore mirroring, no localStorage, no context.
 * Evicts on unmount. Follows a single linear LRU stack — no undo/redo trees,
 * no branching, no reapply (CLAUDE.md §5 + §6).
 *
 * Implementation notes:
 * - A `useRef` mirrors the state array so that `push`/`pop`/`remove`/`clear`
 *   can read the current value synchronously without relying on closed-over
 *   `state` values. This is required because callers need `pop()` to return
 *   the popped action in the same tick, and because multiple `push` calls
 *   inside one React event (or `act()` block) must all survive — a pure
 *   `setState(prev => ...)` API would work for write-only ordering but not
 *   for the synchronous `pop()` return value.
 * - `setActions` is still called on every mutation to trigger re-renders;
 *   the ref and the state stay in lockstep.
 * - The returned object and every method (`push`/`pop`/`remove`/`clear`)
 *   are memoized so the stack reference stays stable across renders
 *   except when `actions` changes. Consumers can safely pass the whole
 *   stack object (or individual methods) to `useCallback` / `useMemo` /
 *   `useEffect` dep arrays without triggering re-memoization every tick.
 */
export function useUndoStack<T>(
  opts: UseUndoStackOptions = {},
): UseUndoStackResult<T> {
  const capacity = opts.capacity ?? DEFAULT_UNDO_CAPACITY

  const [actions, setActions] = React.useState<ReadonlyArray<UndoableAction<T>>>(
    () => [],
  )
  const actionsRef = React.useRef<ReadonlyArray<UndoableAction<T>>>(actions)
  const capacityRef = React.useRef(capacity)
  capacityRef.current = capacity

  const commit = React.useCallback(
    (next: ReadonlyArray<UndoableAction<T>>) => {
      actionsRef.current = next
      setActions(next)
    },
    [],
  )

  const push = React.useCallback(
    (input: UndoActionInput<T>): UndoableAction<T> => {
      const action: UndoableAction<T> = {
        id: crypto.randomUUID(),
        label: input.label,
        snapshot: input.snapshot,
        undo: input.undo,
        createdAt: Date.now(),
      }

      const current = actionsRef.current
      const appended = [...current, action]
      const effectiveCapacity = capacityRef.current
      const next =
        appended.length > effectiveCapacity
          ? appended.slice(appended.length - effectiveCapacity)
          : appended

      commit(next)
      return action
    },
    [commit],
  )

  const pop = React.useCallback((): UndoableAction<T> | null => {
    const current = actionsRef.current
    const last = current[current.length - 1]
    if (!last) {
      return null
    }
    commit(current.slice(0, -1))
    return last
  }, [commit])

  const remove = React.useCallback(
    (id: string): void => {
      const current = actionsRef.current
      const next = current.filter((entry) => entry.id !== id)
      if (next.length === current.length) {
        return
      }
      commit(next)
    },
    [commit],
  )

  const clear = React.useCallback((): void => {
    if (actionsRef.current.length === 0) {
      return
    }
    commit([])
  }, [commit])

  return React.useMemo(
    () => ({
      actions,
      push,
      pop,
      remove,
      clear,
    }),
    [actions, push, pop, remove, clear],
  )
}
