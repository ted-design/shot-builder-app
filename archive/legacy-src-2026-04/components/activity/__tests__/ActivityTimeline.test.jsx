import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import ActivityTimeline from '../ActivityTimeline';

// Make React available globally for JSX
globalThis.React = React;

// Mock hooks
let mockUseActivities;
let mockUseAuth;

vi.mock('../../../hooks/useActivities', () => ({
  useActivities: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Loader2: ({ className }) => <div data-testid="loader" className={className}>Loading...</div>,
}));

// Mock child components
vi.mock('../ActivityFilters', () => ({
  default: ({ filters, onChange, onClear }) => (
    <div data-testid="activity-filters">
      <button onClick={() => onChange({ types: ['shot.created'] })}>
        Filter by type
      </button>
      <button onClick={onClear}>Clear filters</button>
    </div>
  ),
}));

vi.mock('../ActivityList', () => ({
  default: ({ activities, currentUserId }) => (
    <div data-testid="activity-list">
      {activities.map((activity) => (
        <div key={activity.id} data-testid={`activity-${activity.id}`}>
          {activity.actionType}
        </div>
      ))}
      <span data-testid="current-user-id">{currentUserId}</span>
    </div>
  ),
}));

vi.mock('../EmptyState', () => ({
  default: ({ hasFilters }) => (
    <div data-testid="empty-state">
      {hasFilters ? 'No activities match filters' : 'No activities yet'}
    </div>
  ),
}));

describe('ActivityTimeline', () => {
  let defaultProps;

  beforeEach(async () => {
    // Import mocked modules
    const { useActivities } = await import('../../../hooks/useActivities');
    const { useAuth } = await import('../../../context/AuthContext');

    mockUseActivities = vi.mocked(useActivities);
    mockUseAuth = vi.mocked(useAuth);

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-123', email: 'test@example.com' },
    });

    mockUseActivities.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    defaultProps = {
      clientId: 'client-1',
      projectId: 'project-1',
      limit: 100,
      showFilters: true,
    };
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      mockUseActivities.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('has proper accessibility attributes for loading state', () => {
      mockUseActivities.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      const loadingContainer = screen.getByRole('status');
      expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
      expect(loadingContainer).toHaveAttribute('aria-label', 'Loading activities');
    });
  });

  describe('Error State', () => {
    it('shows error message when error occurs', () => {
      mockUseActivities.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByText(/Failed to load activity timeline/)).toBeInTheDocument();
    });

    it('has proper accessibility attributes for error state', () => {
      mockUseActivities.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      render(<ActivityTimeline {...defaultProps} />);

      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no activities and no filters', () => {
      mockUseActivities.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No activities yet')).toBeInTheDocument();
    });

    it('shows filtered empty state when no activities with active filters', () => {
      mockUseActivities.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      // Apply a filter
      fireEvent.click(screen.getByText('Filter by type'));

      // Should show filtered empty state
      expect(screen.getByText('No activities match filters')).toBeInTheDocument();
    });

    it('shows filters in empty state when showFilters is true', () => {
      mockUseActivities.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} showFilters={true} />);

      expect(screen.getByTestId('activity-filters')).toBeInTheDocument();
    });

    it('does not show filters in empty state when showFilters is false', () => {
      mockUseActivities.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} showFilters={false} />);

      expect(screen.queryByTestId('activity-filters')).not.toBeInTheDocument();
    });
  });

  describe('Activities Display', () => {
    it('renders activity list when activities are present', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
        { id: 'act-2', actionType: 'shot.updated', actorId: 'user-2', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByTestId('activity-list')).toBeInTheDocument();
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
      expect(screen.getByText('shot.created')).toBeInTheDocument();
      expect(screen.getByText('shot.updated')).toBeInTheDocument();
    });

    it('shows activity count with singular form', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByText('Showing 1 activity')).toBeInTheDocument();
    });

    it('shows activity count with plural form', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
        { id: 'act-2', actionType: 'shot.updated', actorId: 'user-2', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByText('Showing 2 activities')).toBeInTheDocument();
    });

    it('indicates filtered state in activity count', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      // Apply a filter
      fireEvent.click(screen.getByText('Filter by type'));

      expect(screen.getByText('Showing 1 activity (filtered)')).toBeInTheDocument();
    });

    it('passes current user ID to ActivityList', () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'current-user-id' },
      });

      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      expect(screen.getByTestId('current-user-id')).toHaveTextContent('current-user-id');
    });
  });

  describe('Filters', () => {
    it('renders filters when showFilters is true', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} showFilters={true} />);

      expect(screen.getByTestId('activity-filters')).toBeInTheDocument();
    });

    it('does not render filters when showFilters is false', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} showFilters={false} />);

      expect(screen.queryByTestId('activity-filters')).not.toBeInTheDocument();
    });

    it('clears filters when clear button is clicked', () => {
      const activities = [
        { id: 'act-1', actionType: 'shot.created', actorId: 'user-1', timestamp: Date.now() },
      ];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} />);

      // Apply a filter
      fireEvent.click(screen.getByText('Filter by type'));
      expect(screen.getByText('Showing 1 activity (filtered)')).toBeInTheDocument();

      // Clear filters
      fireEvent.click(screen.getByText('Clear filters'));
      expect(screen.queryByText('(filtered)')).not.toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('uses custom limit prop', () => {
      const activities = [];

      mockUseActivities.mockReturnValue({
        data: activities,
        isLoading: false,
        error: null,
      });

      render(<ActivityTimeline {...defaultProps} limit={50} />);

      expect(mockUseActivities).toHaveBeenCalledWith(
        'client-1',
        'project-1',
        expect.objectContaining({ limit: 50 })
      );
    });

    it('updates filters when limit prop changes', () => {
      const { rerender } = render(<ActivityTimeline {...defaultProps} limit={100} />);

      rerender(<ActivityTimeline {...defaultProps} limit={200} />);

      expect(mockUseActivities).toHaveBeenLastCalledWith(
        'client-1',
        'project-1',
        expect.objectContaining({ limit: 200 })
      );
    });

    it('passes clientId and projectId to useActivities hook', () => {
      render(<ActivityTimeline {...defaultProps} clientId="client-abc" projectId="project-xyz" />);

      expect(mockUseActivities).toHaveBeenCalledWith(
        'client-abc',
        'project-xyz',
        expect.any(Object)
      );
    });
  });
});
