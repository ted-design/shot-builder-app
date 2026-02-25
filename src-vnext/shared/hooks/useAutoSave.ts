import { useCallback, useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveState = "idle" | "saving" | "saved" | "error"

export type AutoSaveOptions = {
  /** Debounce delay in milliseconds. Defaults to 1500. */
  readonly delay?: number
  /** How long the "saved" state persists before returning to "idle" (ms). Defaults to 2000. */
  readonly savedDuration?: number
}

export type AutoSaveReturn = {
  /** Current save lifecycle state. */
  readonly saveState: SaveState
  /** Schedule a save. The provided async function will be debounced. */
  readonly scheduleSave: (saveFn: () => Promise<void>) => void
  /** Force-flush any pending save immediately (e.g. on blur or unmount). */
  readonly flush: () => void
  /** Cancel any pending (not yet executing) save. */
  readonly cancel: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Debounced auto-save hook.
 *
 * - Batches rapid changes into a single save after `delay` ms of inactivity.
 * - Transitions through idle → saving → saved → idle automatically.
 * - Exposes `flush()` for immediate save on blur/unmount.
 * - Safe to call from effects — stable references via useRef.
 */
export function useAutoSave(options: AutoSaveOptions = {}): AutoSaveReturn {
  const { delay = 1500, savedDuration = 2000 } = options

  const [saveState, setSaveState] = useState<SaveState>("idle")

  // Mutable refs to avoid stale closures
  const pendingFnRef = useRef<(() => Promise<void>) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const executeSave = useCallback(async () => {
    const fn = pendingFnRef.current
    if (!fn) return

    pendingFnRef.current = null
    if (mountedRef.current) setSaveState("saving")

    try {
      await fn()
      if (!mountedRef.current) return
      setSaveState("saved")
      savedTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveState("idle")
      }, savedDuration)
    } catch {
      if (mountedRef.current) setSaveState("error")
    }
  }, [savedDuration])

  const scheduleSave = useCallback(
    (saveFn: () => Promise<void>) => {
      pendingFnRef.current = saveFn
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void executeSave()
      }, delay)
    },
    [delay, executeSave],
  )

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (pendingFnRef.current) {
      void executeSave()
    }
  }, [executeSave])

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingFnRef.current = null
    if (mountedRef.current && saveState !== "saving") {
      setSaveState("idle")
    }
  }, [saveState])

  return { saveState, scheduleSave, flush, cancel }
}
