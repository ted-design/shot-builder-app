import { useCallback, useState } from "react"

// Small primitive for tracking "when did the last successful save
// complete?". Returns a nullable timestamp + two setters. Consumers
// call markSaved() inside the .then / after-await continuation of
// a Firestore write to update the "Saved Xs ago" pill in a section
// header. reset() is useful when a consumer needs to clear the pill
// (e.g. on schedule switch) without relying on component unmount.
//
// Orthogonal to useAutoSave — useAutoSave is a debounced lifecycle
// hook for save state machines (idle/saving/saved/error), while
// useLastSaved is a single timestamp primitive.

export interface UseLastSavedResult {
  readonly savedAt: number | null
  readonly markSaved: () => void
  readonly reset: () => void
}

export function useLastSaved(): UseLastSavedResult {
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const markSaved = useCallback(() => {
    setSavedAt(Date.now())
  }, [])

  const reset = useCallback(() => {
    setSavedAt(null)
  }, [])

  return { savedAt, markSaved, reset }
}
