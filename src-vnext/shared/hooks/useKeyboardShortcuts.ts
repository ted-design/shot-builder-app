import { useEffect, useRef } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeyBinding = {
  /** The key to listen for (e.g. "n", "Escape", "1", "[", "]"). Case-insensitive for letters. */
  readonly key: string
  /** Require Ctrl (Windows/Linux) or Cmd (Mac). Defaults to false. */
  readonly meta?: boolean
  /** Require Shift. Defaults to false. */
  readonly shift?: boolean
  /** Handler called when the key combo fires. */
  readonly handler: () => void
}

export type KeyboardShortcutsOptions = {
  /** When false, the hook is completely disabled. Defaults to true. */
  readonly enabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (INTERACTIVE_TAGS.has(target.tagName)) return true
  // Check both the standard property and the raw property for JSDOM compat
  if (target.isContentEditable) return true
  const ce = target.contentEditable
  return ce === "true" || ce === "plaintext-only"
}

function matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  // Compare key case-insensitively for single letters
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key

  if (eventKey !== bindingKey) return false

  const wantsMeta = binding.meta === true
  const wantsShift = binding.shift === true

  // Cmd on Mac, Ctrl on others
  const hasMeta = event.metaKey || event.ctrlKey
  if (wantsMeta !== hasMeta) return false
  if (wantsShift !== event.shiftKey) return false

  return true
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Per-page keyboard shortcut hook.
 *
 * - Ignores keystrokes when focus is in input, textarea, select, or contentEditable.
 * - Supports modifier keys (meta/ctrl + shift).
 * - Bindings are stable via ref — no effect re-runs on handler changes.
 * - Disabled when `enabled` is false (e.g. when a modal is open).
 */
export function useKeyboardShortcuts(
  bindings: ReadonlyArray<KeyBinding>,
  options: KeyboardShortcutsOptions = {},
): void {
  const { enabled = true } = options

  // Use ref so handler changes don't cause effect re-runs
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!enabledRef.current) return
      if (isInteractiveTarget(event.target)) return

      for (const binding of bindingsRef.current) {
        if (matchesBinding(event, binding)) {
          event.preventDefault()
          binding.handler()
          return
        }
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
}
