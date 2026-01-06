import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { readStorage, writeStorage } from '../lib/safeStorage';

const SIDEBAR_COLLAPSED_KEY = 'SIDEBAR_COLLAPSED';

const SidebarContext = createContext(null);

/**
 * SidebarProvider
 *
 * Manages sidebar collapse state with localStorage persistence.
 * Provides hover-to-expand functionality when collapsed.
 */
export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = readStorage(SIDEBAR_COLLAPSED_KEY, 'false');
    return stored === 'true';
  });
  const [isHovering, setIsHovering] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Toggle collapse state and persist to localStorage
  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      writeStorage(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Expand sidebar
  const expand = useCallback(() => {
    setIsCollapsed(false);
    writeStorage(SIDEBAR_COLLAPSED_KEY, 'false');
  }, []);

  // Collapse sidebar
  const collapse = useCallback(() => {
    setIsCollapsed(true);
    writeStorage(SIDEBAR_COLLAPSED_KEY, 'true');
  }, []);

  // Open mobile sidebar
  const openMobile = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  // Close mobile sidebar
  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Handle ESC key to close mobile sidebar
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMobile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, closeMobile]);

  // Sync with storage events from other tabs
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === SIDEBAR_COLLAPSED_KEY) {
        const value = event.newValue === 'true';
        setIsCollapsed(value);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      // State
      isCollapsed,
      isHovering,
      isMobileOpen,
      // Computed
      isExpanded: !isCollapsed || isHovering,
      // Actions
      toggle,
      expand,
      collapse,
      setIsHovering,
      openMobile,
      closeMobile,
    }),
    [isCollapsed, isHovering, isMobileOpen, toggle, expand, collapse, openMobile, closeMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * useSidebar hook
 *
 * Access sidebar state and actions.
 * Must be used within a SidebarProvider.
 */
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export default SidebarContext;
