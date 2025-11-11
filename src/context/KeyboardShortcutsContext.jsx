// src/context/KeyboardShortcutsContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const KeyboardShortcutsContext = createContext(null);

/**
 * KeyboardShortcutsProvider - Provides keyboard shortcuts state and controls
 *
 * Manages the keyboard shortcuts help modal state and exposes a toggleHelp
 * function that can be called from any component (e.g., toolbar buttons).
 */
export function KeyboardShortcutsProvider({ children }) {
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  const value = {
    showHelp,
    toggleHelp,
    closeHelp,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

/**
 * useKeyboardShortcuts - Hook to access keyboard shortcuts functionality
 *
 * @returns {Object} Keyboard shortcuts state and functions
 * @returns {boolean} return.showHelp - Whether help modal is open
 * @returns {Function} return.toggleHelp - Toggle help modal
 * @returns {Function} return.closeHelp - Close help modal
 *
 * @example
 * const { toggleHelp } = useKeyboardShortcuts();
 *
 * <ToolbarIconButton
 *   tooltip="Keyboard shortcuts (Shift+/)"
 *   onClick={toggleHelp}
 * >
 *   <Keyboard className="h-4 w-4" />
 * </ToolbarIconButton>
 */
export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}
