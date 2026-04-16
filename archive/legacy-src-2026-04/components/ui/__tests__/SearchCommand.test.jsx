/**
 * Basic smoke tests for SearchCommand component
 */

import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchCommand from '../SearchCommand';

// Mock global search function
const mockGlobalSearch = vi.fn(() => ({
  shots: [],
  products: [],
  talent: [],
  locations: [],
  projects: [],
  totalCount: 0,
}));

vi.mock('../../../lib/search', () => ({
  globalSearch: (...args) => mockGlobalSearch(...args),
}));

// Mock hooks
vi.mock('../../../hooks/useFirestoreQuery', () => ({
  useShots: () => ({ data: [] }),
  useProducts: () => ({ data: [] }),
  useTalent: () => ({ data: [] }),
  useLocations: () => ({ data: [] }),
  useProjects: () => ({ data: [] }),
  queryKeys: {
    shots: (clientId, projectId) => ['shots', clientId, projectId],
    products: (clientId) => ['products', clientId],
    talent: (clientId) => ['talent', clientId],
    locations: (clientId) => ['locations', clientId],
    projects: (clientId) => ['projects', clientId],
  },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ clientId: 'test-client' }),
}));

vi.mock('../../../context/ProjectScopeContext', () => ({
  useProjectScope: () => ({ currentProjectId: 'test-project' }),
}));

vi.mock('../../../lib/safeStorage', () => ({
  readStorage: vi.fn(() => null),
  writeStorage: vi.fn(),
}));

// Mock SearchCommandContext with controllable state
const mockState = { isOpen: false };
const mockOpenSearch = vi.fn(() => { mockState.isOpen = true; });
const mockCloseSearch = vi.fn(() => { mockState.isOpen = false; });

vi.mock('../../../context/SearchCommandContext', () => ({
  useSearchCommand: () => ({
    get isOpen() { return mockState.isOpen; },
    openSearch: mockOpenSearch,
    closeSearch: mockCloseSearch,
  }),
}));

describe('SearchCommand', () => {
  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SearchCommand />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    mockGlobalSearch.mockClear();
    mockOpenSearch.mockClear();
    mockCloseSearch.mockClear();
    mockState.isOpen = false;
  });

  test('renders without crashing', () => {
    expect(() => renderComponent()).not.toThrow();
  });

  test('does not render modal when closed', () => {
    renderComponent();
    // Modal should not be visible by default
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('component mounts successfully', () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
  });

  test('handles empty data gracefully', () => {
    expect(() => renderComponent()).not.toThrow();
  });

  test('debounces search input to reduce search operations', async () => {
    // Set modal to open state
    mockState.isOpen = true;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { rerender } = renderComponent();

    // Force re-render with open state
    rerender(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SearchCommand />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search or type a command/i);

    // Simulate rapid typing (3 keystrokes in quick succession)
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    // Search should not execute immediately (debounced)
    expect(mockGlobalSearch).not.toHaveBeenCalled();

    // Wait for debounce delay (150ms + buffer)
    await waitFor(() => {
      expect(mockGlobalSearch).toHaveBeenCalledTimes(1);
    }, { timeout: 300 });

    // Verify it was called with the final value
    expect(mockGlobalSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        shots: [],
        products: [],
        talent: [],
        locations: [],
        projects: [],
      }),
      'abc',
      expect.objectContaining({
        maxResults: 50,
        maxPerType: 10,
      })
    );
  });

  // Note: Full integration tests for keyboard shortcuts and search functionality
  // would require more complex setup and are better suited for E2E tests
});
