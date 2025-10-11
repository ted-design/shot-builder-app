/**
 * Basic smoke tests for FilterPresetManager component
 */

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPresetManager from '../FilterPresetManager';

// Mock filter preset utilities
vi.mock('../../../lib/filterPresets', () => ({
  listPresets: vi.fn(() => []),
  savePreset: vi.fn((page, name, filters) => ({
    id: 'test-id',
    name,
    filters,
    createdAt: Date.now(),
    isDefault: false,
  })),
  deletePreset: vi.fn(() => true),
  renamePreset: vi.fn(() => true),
  setDefaultPreset: vi.fn(() => true),
  getDefaultPreset: vi.fn(() => null),
  presetNameExists: vi.fn(() => false),
}));

vi.mock('../../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FilterPresetManager', () => {
  const defaultProps = {
    page: 'shots',
    currentFilters: { status: 'active' },
    onLoadPreset: vi.fn(),
    onClearFilters: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(<FilterPresetManager {...defaultProps} {...props} />);
  };

  test('renders without crashing', () => {
    expect(() => renderComponent()).not.toThrow();
  });

  test('renders save preset button', () => {
    renderComponent();
    expect(screen.getByText(/save preset/i)).toBeInTheDocument();
  });

  test('opens save modal when save button clicked', () => {
    renderComponent();
    const saveButton = screen.getByText(/save preset/i);
    fireEvent.click(saveButton);
    expect(screen.getByText(/save filter preset/i)).toBeInTheDocument();
  });

  test('handles empty presets gracefully', () => {
    renderComponent();
    // Should not show load preset button when no presets exist
    expect(screen.queryByText('Load preset')).not.toBeInTheDocument();
  });

  test('accepts all required props', () => {
    const props = {
      page: 'products',
      currentFilters: { gender: 'women', status: 'active' },
      onLoadPreset: vi.fn(),
      onClearFilters: vi.fn(),
    };
    expect(() => renderComponent(props)).not.toThrow();
  });

  test('component structure is valid', () => {
    const { container } = renderComponent();
    expect(container.firstChild).toBeTruthy();
  });

  test('does not crash with complex filters', () => {
    const complexFilters = {
      status: 'active',
      gender: 'women',
      showArchived: false,
      talentIds: ['id1', 'id2'],
      productFamilyIds: ['prod1', 'prod2'],
    };
    expect(() =>
      renderComponent({ currentFilters: complexFilters })
    ).not.toThrow();
  });

  // Note: Full integration tests for preset CRUD operations
  // would require more complex setup with mocked storage and are
  // better suited for integration or E2E tests
});
