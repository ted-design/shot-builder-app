import hotkeys from 'hotkeys-js'
import { KEYBOARD_SHORTCUTS } from './constants'

export function setupKeyboardShortcuts() {
  // New shot shortcut
  hotkeys(KEYBOARD_SHORTCUTS.NEW_SHOT, (event) => {
    event.preventDefault()
    // Trigger new shot creation - we'll emit a custom event
    window.dispatchEvent(new CustomEvent('keyboard-shortcut', { 
      detail: { action: 'new-shot' }
    }))
  })
  
  // Search shortcut
  hotkeys(KEYBOARD_SHORTCUTS.SEARCH, (event) => {
    event.preventDefault()
    // Focus search input if it exists
    const searchInput = document.querySelector('[data-search-input]')
    if (searchInput) {
      searchInput.focus()
    }
  })
  
  // Save shortcut
  hotkeys(KEYBOARD_SHORTCUTS.SAVE, (event) => {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('keyboard-shortcut', { 
      detail: { action: 'save' }
    }))
  })
  
  // Cleanup function
  return () => {
    hotkeys.unbind(KEYBOARD_SHORTCUTS.NEW_SHOT)
    hotkeys.unbind(KEYBOARD_SHORTCUTS.SEARCH)
    hotkeys.unbind(KEYBOARD_SHORTCUTS.SAVE)
  }
}