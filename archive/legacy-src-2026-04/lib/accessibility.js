/**
 * Accessibility utilities for Shot Builder
 *
 * This module provides helper functions and constants for improving
 * accessibility throughout the application.
 */

/**
 * Keyboard navigation constants
 */
export const Keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
};

/**
 * Generates a unique ID for ARIA relationships
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export function generateAriaId(prefix = 'aria') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announces a message to screen readers using live regions
 * @param {string} message - Message to announce
 * @param {('polite'|'assertive')} priority - Announcement priority
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Handles keyboard navigation for dropdown menus
 * @param {KeyboardEvent} event - Keyboard event
 * @param {HTMLElement[]} items - Array of menu items
 * @param {number} currentIndex - Currently focused item index
 * @param {Function} onSelect - Callback when item is selected
 * @param {Function} onClose - Callback to close menu
 * @returns {number} New focused index or -1 if menu should close
 */
export function handleMenuKeyNavigation(event, items, currentIndex, onSelect, onClose) {
  const { key } = event;

  switch (key) {
    case Keys.ESCAPE:
      event.preventDefault();
      onClose?.();
      return -1;

    case Keys.ARROW_DOWN:
      event.preventDefault();
      return currentIndex < items.length - 1 ? currentIndex + 1 : 0;

    case Keys.ARROW_UP:
      event.preventDefault();
      return currentIndex > 0 ? currentIndex - 1 : items.length - 1;

    case Keys.HOME:
      event.preventDefault();
      return 0;

    case Keys.END:
      event.preventDefault();
      return items.length - 1;

    case Keys.ENTER:
    case Keys.SPACE:
      event.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        onSelect?.(items[currentIndex], currentIndex);
      }
      return currentIndex;

    default:
      return currentIndex;
  }
}

/**
 * Creates a focus trap for modal/dropdown components
 * @param {HTMLElement} container - Container element
 * @returns {Function} Cleanup function
 */
export function createFocusTrap(container) {
  const focusableElements = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function handleTabKey(event) {
    if (event.key !== Keys.TAB) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }

  container.addEventListener('keydown', handleTabKey);

  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Gets descriptive label for action
 * @param {string} action - Action type
 * @param {string} itemName - Item name
 * @returns {string} Accessible label
 */
export function getActionLabel(action, itemName) {
  const labels = {
    edit: `Edit ${itemName}`,
    delete: `Delete ${itemName}`,
    archive: `Archive ${itemName}`,
    restore: `Restore ${itemName}`,
    view: `View ${itemName}`,
    open: `Open ${itemName}`,
    close: `Close ${itemName}`,
    menu: `Open menu for ${itemName}`,
  };

  return labels[action] || `${action} ${itemName}`;
}
