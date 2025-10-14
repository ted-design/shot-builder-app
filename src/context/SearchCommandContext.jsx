/**
 * SearchCommandContext - Provides control for opening the global search command palette
 */

import { createContext, useContext, useState, useCallback } from 'react';

const SearchCommandContext = createContext({
  isOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
});

export function SearchCommandProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SearchCommandContext.Provider value={{ isOpen, openSearch, closeSearch }}>
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
