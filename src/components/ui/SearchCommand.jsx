/**
 * SearchCommand - Enhanced command palette with search and actions
 * Now using cmdk library for better keyboard navigation and extensibility
 *
 * Features:
 * - Global search across all entities
 * - Quick actions (Create, Export, etc.)
 * - Navigation commands
 * - Recent searches
 * - Keyboard shortcuts (Cmd+K)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search,
  Camera,
  Package,
  User,
  MapPin,
  FolderOpen,
  Plus,
  Download,
  Home,
  Tag,
  Users,
  Settings,
} from 'lucide-react';
import { globalSearch } from '../../lib/search';
import { useQueryClient } from '@tanstack/react-query';
import { useShots, useProducts, useTalent, useLocations, useProjects, queryKeys } from '../../hooks/useFirestoreQuery';
import { useAuth } from '../../context/AuthContext';
import { useSearchCommand } from '../../context/SearchCommandContext';
import { useProjectScope } from '../../context/ProjectScopeContext';
import { toast } from '../../lib/toast';
import { readStorage, writeStorage } from '../../lib/safeStorage';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import './SearchCommand.css';

const RECENT_SEARCHES_KEY = 'searchCommand:recentSearches';
const MAX_RECENT_SEARCHES = 5;

// Entity type configurations
const ENTITY_CONFIG = {
  shot: { icon: Camera, label: 'Shots', path: '/shots' },
  product: { icon: Package, label: 'Products', path: '/products' },
  talent: { icon: User, label: 'Talent', path: '/talent' },
  location: { icon: MapPin, label: 'Locations', path: '/locations' },
  project: { icon: FolderOpen, label: 'Projects', path: '/projects' },
};

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
 * Save recent search to localStorage
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
  const { currentProjectId } = useProjectScope();
  const [search, setSearch] = useState('');
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);

  const navigate = useNavigate();
  const { clientId } = useAuth();
  const queryClient = useQueryClient();

  // Debounce search query
  const debouncedSearch = useDebouncedValue(search, 150);

  // Get cached data
  const cachedShots = useMemo(() => {
    if (!clientId || !currentProjectId) return [];
    return queryClient.getQueryData(queryKeys.shots(clientId, currentProjectId)) || [];
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

  // Load data from TanStack Query
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

  // Perform global search
  const searchResults = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return null;
    }

    return globalSearch(
      { shots, products, talent, locations, projects },
      debouncedSearch,
      { maxResults: 50, maxPerType: 10 }
    );
  }, [debouncedSearch, shots, products, talent, locations, projects]);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openSearch, closeSearch]);

  // Handle result selection
  const handleSelectResult = useCallback(
    result => {
      const config = ENTITY_CONFIG[result.type];
      const requiresProject = result.type === 'shot';

      saveRecentSearch(search);
      setRecentSearches(loadRecentSearches());
      closeSearch();

      if (requiresProject && !currentProjectId) {
        toast.info({ title: 'Please select a project' });
        navigate('/projects');
        return;
      }

      const path = currentProjectId && result.type === 'shot'
        ? `/projects/${currentProjectId}/shots`
        : config.path;

      navigate(path);
    },
    [search, closeSearch, navigate, currentProjectId]
  );

  // Handle actions
  const handleAction = useCallback((action) => {
    closeSearch();

    switch (action) {
      case 'create-shot':
        if (!currentProjectId) {
          toast.info({ title: 'Please select a project first' });
          navigate('/projects');
        } else {
          navigate(`/projects/${currentProjectId}/shots`);
          // Trigger create modal (would need to be implemented)
        }
        break;
      case 'create-product':
        navigate('/products');
        // Trigger create modal
        break;
      case 'create-talent':
        navigate('/talent');
        // Trigger create modal
        break;
      case 'create-location':
        navigate('/locations');
        // Trigger create modal
        break;
      case 'nav-dashboard':
        navigate('/projects');
        break;
      case 'nav-shots':
        if (!currentProjectId) {
          toast.info({ title: 'Please select a project first' });
          navigate('/projects');
        } else {
          navigate(`/projects/${currentProjectId}/shots`);
        }
        break;
      case 'nav-products':
        navigate('/products');
        break;
      case 'nav-talent':
        navigate('/talent');
        break;
      case 'nav-locations':
        navigate('/locations');
        break;
      case 'nav-pulls':
        navigate('/pulls');
        break;
      case 'nav-tags':
        navigate('/tags');
        break;
      case 'nav-admin':
        navigate('/admin');
        break;
      default:
        break;
    }
  }, [closeSearch, navigate, currentProjectId]);

  const handleRecentSearchClick = useCallback(searchQuery => {
    setSearch(searchQuery);
  }, []);

  if (!isOpen) return null;

  const showRecentSearches = !search.trim() && recentSearches.length > 0;
  const hasSearchResults = searchResults && Object.values(searchResults).some(arr => arr.length > 0);
  const showActions = !search.trim();

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={closeSearch}
      label="Global Command Menu"
      className="command-dialog"
    >
      <div className="command-input-wrapper">
        <Search className="command-search-icon" size={20} />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search or type a command..."
          className="command-input"
        />
        <kbd className="command-kbd">ESC</kbd>
      </div>

      <Command.List className="command-list">
        <Command.Empty className="command-empty">
          <Search size={48} />
          <p>No results found</p>
          <p className="command-empty-hint">Try adjusting your search</p>
        </Command.Empty>

        {/* Recent Searches */}
        {showRecentSearches && (
          <Command.Group heading="Recent Searches">
            {recentSearches.map((recentSearch, index) => (
              <Command.Item
                key={index}
                onSelect={() => handleRecentSearchClick(recentSearch)}
                className="command-item"
              >
                <Search size={16} />
                <span>{recentSearch}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Quick Actions */}
        {showActions && (
          <>
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() => handleAction('create-shot')}
                className="command-item"
              >
                <Camera size={16} />
                <span>Create Shot</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('create-product')}
                className="command-item"
              >
                <Package size={16} />
                <span>Create Product</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('create-talent')}
                className="command-item"
              >
                <User size={16} />
                <span>Create Talent</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('create-location')}
                className="command-item"
              >
                <MapPin size={16} />
                <span>Create Location</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator />

            <Command.Group heading="Navigation">
              <Command.Item
                onSelect={() => handleAction('nav-dashboard')}
                className="command-item"
              >
                <Home size={16} />
                <span>Go to Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-shots')}
                className="command-item"
              >
                <Camera size={16} />
                <span>Go to Shots</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-products')}
                className="command-item"
              >
                <Package size={16} />
                <span>Go to Products</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-talent')}
                className="command-item"
              >
                <User size={16} />
                <span>Go to Talent</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-locations')}
                className="command-item"
              >
                <MapPin size={16} />
                <span>Go to Locations</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-pulls')}
                className="command-item"
              >
                <Download size={16} />
                <span>Go to Pulls</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-tags')}
                className="command-item"
              >
                <Tag size={16} />
                <span>Go to Tags</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleAction('nav-admin')}
                className="command-item"
              >
                <Settings size={16} />
                <span>Go to Admin</span>
              </Command.Item>
            </Command.Group>
          </>
        )}

        {/* Search Results */}
        {hasSearchResults && (
          <>
            {['shots', 'products', 'talent', 'locations', 'projects'].map(type => {
              const results = searchResults[type] || [];
              if (results.length === 0) return null;

              const config = ENTITY_CONFIG[type];
              const Icon = config.icon;

              return (
                <Command.Group key={type} heading={`${config.label} (${results.length})`}>
                  {results.map(result => {
                    const label = getResultLabel(result);
                    const secondary = getResultSecondary(result);

                    return (
                      <Command.Item
                        key={result.item.id}
                        onSelect={() => handleSelectResult(result)}
                        className="command-item"
                      >
                        <div className="command-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="command-item-content">
                          <div className="command-item-label">{label}</div>
                          {secondary && (
                            <div className="command-item-secondary">{secondary}</div>
                          )}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </>
        )}

        {/* Instructions */}
        {!search.trim() && !showRecentSearches && (
          <div className="command-instructions">
            <Search size={48} />
            <p>Search Shot Builder</p>
            <p className="command-instructions-hint">
              Search across shots, products, talent, and more
            </p>
            <div className="command-shortcuts">
              <div>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <span>to navigate</span>
              </div>
              <div>
                <kbd>⏎</kbd>
                <span>to select</span>
              </div>
              <div>
                <kbd>ESC</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
