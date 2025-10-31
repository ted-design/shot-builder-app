/**
 * SearchCommand - Global command palette with Cmd+K shortcut
 * Provides fuzzy search across all entities (shots, products, talent, locations, projects)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Search, Camera, Package, User, MapPin, FolderOpen, X } from 'lucide-react';
import { globalSearch } from '../../lib/search';
import { useQueryClient } from '@tanstack/react-query';
import { useShots, useProducts, useTalent, useLocations, useProjects, queryKeys } from '../../hooks/useFirestoreQuery';
import { useAuth } from '../../context/AuthContext';
import { useProjectScope } from '../../context/ProjectScopeContext';
import { useSearchCommand } from '../../context/SearchCommandContext';
import { readStorage, writeStorage } from '../../lib/safeStorage';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const RECENT_SEARCHES_KEY = 'searchCommand:recentSearches';
const MAX_RECENT_SEARCHES = 5;

/**
 * Get icon component for entity type
 */
function getEntityIcon(type) {
  switch (type) {
    case 'shot':
      return Camera;
    case 'product':
      return Package;
    case 'talent':
      return User;
    case 'location':
      return MapPin;
    case 'project':
      return FolderOpen;
    default:
      return Search;
  }
}

/**
 * Get display name for entity type
 */
function getEntityTypeName(type) {
  const names = {
    shot: 'Shots',
    product: 'Products',
    talent: 'Talent',
    location: 'Locations',
    project: 'Projects',
  };
  return names[type] || type;
}

/**
 * Get display label for a search result item
 */
function getResultLabel(result) {
  const { item, type } = result;

  switch (type) {
    case 'shot':
      return item.name || 'Untitled shot';
    case 'product':
      return item.styleName || 'Untitled product';
    case 'talent':
      return item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed talent';
    case 'location':
      return item.name || 'Unnamed location';
    case 'project':
      return item.name || 'Untitled project';
    default:
      return 'Unknown';
  }
}

/**
 * Get secondary info for a search result item
 */
function getResultSecondary(result) {
  const { item, type } = result;

  switch (type) {
    case 'shot':
      return item.type || null;
    case 'product':
      return item.styleNumber ? `Style #${item.styleNumber}` : null;
    case 'talent':
      return item.agency || null;
    case 'location':
      return item.description || null;
    case 'project':
      return item.status || null;
    default:
      return null;
  }
}

/**
 * Get navigation path for a search result
 */
function getResultPath(result) {
  const { type } = result;

  switch (type) {
    case 'shot':
      return '/shots';
    case 'product':
      return '/products';
    case 'talent':
      return '/talent';
    case 'location':
      return '/locations';
    case 'project':
      return '/projects';
    default:
      return '/';
  }
}

/**
 * Load recent searches from localStorage
 */
function loadRecentSearches() {
  try {
    const stored = readStorage(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const searches = JSON.parse(stored);
    return Array.isArray(searches) ? searches : [];
  } catch (error) {
    console.warn('[SearchCommand] Failed to load recent searches:', error);
    return [];
  }
}

/**
 * Save recent searches to localStorage
 */
function saveRecentSearch(query) {
  try {
    if (!query || !query.trim()) return;

    const recent = loadRecentSearches();
    const trimmed = query.trim();

    // Remove if already exists
    const filtered = recent.filter(s => s !== trimmed);

    // Add to beginning
    filtered.unshift(trimmed);

    // Limit to max
    const limited = filtered.slice(0, MAX_RECENT_SEARCHES);

    writeStorage(RECENT_SEARCHES_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn('[SearchCommand] Failed to save recent search:', error);
  }
}

/**
 * SearchCommand component
 */
export default function SearchCommand() {
  const { isOpen, openSearch, closeSearch } = useSearchCommand();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  const navigate = useNavigate();
  const { clientId } = useAuth();
  const { currentProjectId } = useProjectScope();
  const queryClient = useQueryClient();

  // Debounce search query to reduce expensive fuzzy search operations
  // 150ms provides responsive feel while reducing search calls by ~80-90%
  const debouncedQuery = useDebouncedValue(query, 150);

  const cachedShots = useMemo(() => {
    if (!clientId || !currentProjectId) return [];
    return (
      queryClient.getQueryData(queryKeys.shots(clientId, currentProjectId)) || []
    );
  }, [queryClient, clientId, currentProjectId]);

  const cachedProducts = useMemo(() => {
    if (!clientId) return [];
    return queryClient.getQueryData(queryKeys.products(clientId)) || [];
  }, [queryClient, clientId]);

  const cachedTalent = useMemo(() => {
    if (!clientId) return [];
    return queryClient.getQueryData(queryKeys.talent(clientId)) || [];
  }, [queryClient, clientId]);

  const cachedLocations = useMemo(() => {
    if (!clientId) return [];
    return queryClient.getQueryData(queryKeys.locations(clientId)) || [];
  }, [queryClient, clientId]);

  const cachedProjects = useMemo(() => {
    if (!clientId) return [];
    return queryClient.getQueryData(queryKeys.projects(clientId)) || [];
  }, [queryClient, clientId]);

  // Load data from TanStack Query hooks only when palette open, seeding with cache
  const { data: shots = cachedShots } = useShots(clientId, currentProjectId, {
    enabled: isOpen && !!clientId && !!currentProjectId,
    placeholderData: cachedShots,
  });
  const { data: products = cachedProducts } = useProducts(clientId, {
    enabled: isOpen && !!clientId,
    placeholderData: cachedProducts,
  });
  const { data: talent = cachedTalent } = useTalent(clientId, {
    enabled: isOpen && !!clientId,
    placeholderData: cachedTalent,
  });
  const { data: locations = cachedLocations } = useLocations(clientId, {
    enabled: isOpen && !!clientId,
    placeholderData: cachedLocations,
  });
  const { data: projects = cachedProjects } = useProjects(clientId, {
    enabled: isOpen && !!clientId,
    placeholderData: cachedProjects,
  });

  // Perform global search with debounced query
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return null;
    }

    return globalSearch(
      { shots, products, talent, locations, projects },
      debouncedQuery,
      { maxResults: 50, maxPerType: 10 }
    );
  }, [debouncedQuery, shots, products, talent, locations, projects]);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!searchResults) return [];

    const flat = [];
    ['shots', 'products', 'talent', 'locations', 'projects'].forEach(type => {
      if (searchResults[type]?.length > 0) {
        searchResults[type].forEach(result => {
          flat.push(result);
        });
      }
    });

    return flat;
  }, [searchResults]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Close handler with state cleanup
  const close = useCallback(() => {
    closeSearch();
    setQuery('');
    setSelectedIndex(0);
  }, [closeSearch]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          openSearch();
        }
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openSearch, close]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle result selection
  const handleSelectResult = useCallback(
    result => {
      const path = getResultPath(result);
      saveRecentSearch(query);
      setRecentSearches(loadRecentSearches());
      close();
      navigate(path);
    },
    [query, close, navigate]
  );

  // Handle keyboard navigation in results
  const handleResultsKeyDown = useCallback(
    e => {
      if (!flatResults.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flatResults.length);
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
      }

      if (e.key === 'Enter' && flatResults[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(flatResults[selectedIndex]);
      }
    },
    [flatResults, selectedIndex, handleSelectResult]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback(search => {
    setQuery(search);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0 && selectedIndex < flatResults.length) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, flatResults.length]);

  if (!isOpen) return null;

  const showRecentSearches = !query.trim() && recentSearches.length > 0;
  const hasResults = searchResults && flatResults.length > 0;
  const showEmpty = query.trim() && !hasResults;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in pt-[10vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl animate-slide-in-from-top"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleResultsKeyDown}
            placeholder="Search shots, products, talent, locations..."
            className="flex-1 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="search-results"
          />
          <button
            onClick={close}
            className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
            <span>ESC</span>
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto" id="search-results" ref={resultsRef}>
          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Recent Searches
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <span>{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results by Type */}
          {hasResults && (
            <div className="p-2">
              {['shots', 'products', 'talent', 'locations', 'projects'].map(type => {
                const results = searchResults[type] || [];
                if (results.length === 0) return null;

                return (
                  <div key={type} className="mb-4 last:mb-0">
                    <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {getEntityTypeName(type)} ({results.length})
                    </div>
                    {results.map((result, index) => {
                      const globalIndex = flatResults.indexOf(result);
                      const isSelected = globalIndex === selectedIndex;
                      const Icon = getEntityIcon(type);
                      const label = getResultLabel(result);
                      const secondary = getResultSecondary(result);

                      return (
                        <button
                          key={result.item.id}
                          onClick={() => handleSelectResult(result)}
                          className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                            isSelected ? 'bg-primary/10 dark:bg-indigo-900/30 ring-2 ring-primary/20 dark:ring-indigo-500/30' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            isSelected ? 'bg-primary/20 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-700'
                          }`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-primary dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`} aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {label}
                            </div>
                            {secondary && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {secondary}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {showEmpty && (
            <div className="p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">No results found</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try adjusting your search query
              </p>
            </div>
          )}

          {/* Instructions */}
          {!query.trim() && !showRecentSearches && (
            <div className="p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">Search Shot Builder</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Search across shots, products, talent, and more
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <kbd className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1">
                  <span>↑</span>
                  <span>↓</span>
                </kbd>
                <span>to navigate</span>
                <kbd className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1">
                  <span>⏎</span>
                </kbd>
                <span>to select</span>
                <kbd className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1">
                  <span>ESC</span>
                </kbd>
                <span>to close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
