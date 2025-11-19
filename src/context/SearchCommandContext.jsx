/**
 * SearchCommandContext - Provides control for opening the global search command palette
 */

import { createContext, useContext, useState, useCallback } from 'react';

const SearchCommandContext = createContext({
  isOpen: false,
  showShortcuts: false,
  openSearch: () => {},
  openSearchForShortcuts: () => {},
  closeSearch: () => {},
});

export function SearchCommandProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
    setShowShortcuts(false);
  }, []);

  const openSearchForShortcuts = useCallback(() => {
    setIsOpen(true);
    setShowShortcuts(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setShowShortcuts(false);
  }, []);

  return (
    <SearchCommandContext.Provider value={{ isOpen, showShortcuts, openSearch, openSearchForShortcuts, closeSearch }}>
      {children}
    </SearchCommandContext.Provider>
  );
}

export function useSearchCommand() {
  const context = useContext(SearchCommandContext);
  if (!context) {
    throw new Error('useSearchCommand must be used within SearchCommandProvider');
  }
  return context;
}
