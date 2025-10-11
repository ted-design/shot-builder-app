/**
 * Basic smoke tests for SearchCommand component
 */

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchCommand from '../SearchCommand';

// Mock hooks
vi.mock('../../../hooks/useFirestoreQuery', () => ({
  useShots: () => ({ data: [] }),
  useProducts: () => ({ data: [] }),
  useTalent: () => ({ data: [] }),
  useLocations: () => ({ data: [] }),
  useProjects: () => ({ data: [] }),
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

describe('SearchCommand', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <SearchCommand />
      </BrowserRouter>
    );
  };

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

  // Note: Full integration tests for keyboard shortcuts and search functionality
  // would require more complex setup and are better suited for E2E tests
});
