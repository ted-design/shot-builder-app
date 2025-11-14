import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import BulkOperationsToolbar from '../BulkOperationsToolbar';

// Make React available globally for JSX
globalThis.React = React;

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">X</span>,
  Tag: () => <span data-testid="icon-tag">Tag</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  Minus: () => <span data-testid="icon-minus">-</span>,
  MapPin: () => <span data-testid="icon-mappin">📍</span>,
  Calendar: () => <span data-testid="icon-calendar">📅</span>,
  Film: () => <span data-testid="icon-film">🎬</span>,
  ArrowRight: () => <span data-testid="icon-arrow">→</span>,
  Copy: () => <span data-testid="icon-copy">📋</span>,
  CopyPlus: () => <span data-testid="icon-copyplus">📋+</span>,
  List: () => <span data-testid="icon-list">📃</span>,
  CheckSquare: () => <span data-testid="icon-checksquare">☑</span>,
  Check: () => <span data-testid="icon-check">✓</span>,
}));

// Mock UI components
vi.mock('../../ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, variant, size, title, className, ...props }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      title={title}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('../../ui/TagBadge', () => ({
  TagBadge: ({ tag }) => <span data-testid={`tag-badge-${tag.id}`}>{tag.label}</span>,
  TAG_COLORS: {
    blue: 'blue',
    red: 'red',
    green: 'green',
    yellow: 'yellow',
    purple: 'purple',
  },
  getTagSwatchClasses: (color) => `bg-${color}-200`,
}));

describe('BulkOperationsToolbar', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      selectedCount: 0,
      onClearSelection: vi.fn(),
      onExitSelection: vi.fn(),
      onSelectAll: vi.fn(),
      totalCount: 10,
      onApplyTags: vi.fn(),
      onRemoveTags: vi.fn(),
      availableTags: [],
      onDuplicateShots: vi.fn(),
      onSetLocation: vi.fn(),
      onSetDate: vi.fn(),
      onSetType: vi.fn(),
      availableLocations: [],
      availableTypes: [],
      onSetLane: vi.fn(),
      availableLanes: [],
      onMoveToProject: vi.fn(),
      onCopyToProject: vi.fn(),
      availableProjects: [],
      currentProjectId: 'project-1',
      isProcessing: false,
    };
  });

  describe('Selection Display', () => {
    it('shows "No shots selected" when selectedCount is 0', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={0} />);
      expect(screen.getByText('No shots selected')).toBeInTheDocument();
    });

    it('shows "1 shot selected" when selectedCount is 1', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={1} />);
      expect(screen.getByText('1 shot selected')).toBeInTheDocument();
    });

    it('shows "3 shots selected" when selectedCount is 3', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={3} />);
      expect(screen.getByText('3 shots selected')).toBeInTheDocument();
    });
  });

  describe('Selection Controls', () => {
    it('renders "Select all" button when not all selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={5} totalCount={10} />);
      expect(screen.getByText('Select all')).toBeInTheDocument();
    });

    it('renders "Deselect all" button when all selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={10} totalCount={10} />);
      expect(screen.getByText('Deselect all')).toBeInTheDocument();
    });

    it('calls onSelectAll when "Select all" is clicked', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={5} totalCount={10} />);
      fireEvent.click(screen.getByText('Select all'));
      expect(defaultProps.onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('calls onClearSelection when "Clear" is clicked', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={5} />);
      fireEvent.click(screen.getByText('Clear'));
      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('disables Clear button when no shots selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={0} />);
      const clearButton = screen.getByText('Clear').closest('button');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Tag Operations', () => {
    it('renders tag operation buttons', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('disables tag operations when no shots selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={0} />);
      const applyTagsButton = screen.getByText('Tags').closest('button');
      expect(applyTagsButton).toBeDisabled();
    });

    it('enables tag operations when shots are selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      const applyTagsButton = screen.getByText('Tags').closest('button');
      expect(applyTagsButton).not.toBeDisabled();
    });

    it('opens apply tags dropdown when Tags button is clicked', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} availableTags={[]} />);
      const tagsButton = screen.getByText('Tags');
      fireEvent.click(tagsButton);
      expect(screen.getByText(/Apply tag to 2 shots/)).toBeInTheDocument();
    });

    it('shows create new tag button in apply tags dropdown', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      fireEvent.click(screen.getByText('Tags'));
      expect(screen.getByText('Create new tag')).toBeInTheDocument();
    });

    it('shows existing tags in apply tags dropdown', () => {
      const tags = [
        { id: 'tag-1', label: 'Outdoor', color: 'blue' },
        { id: 'tag-2', label: 'Studio', color: 'red' },
      ];
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} availableTags={tags} />);
      fireEvent.click(screen.getByText('Tags'));

      expect(screen.getByTestId('tag-badge-tag-1')).toBeInTheDocument();
      expect(screen.getByTestId('tag-badge-tag-2')).toBeInTheDocument();
    });

    it('disables remove tags button when no tags available', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} availableTags={[]} />);
      const removeButton = screen.getAllByRole('button').find(btn => {
        const icon = btn.querySelector('[data-testid="icon-minus"]');
        return icon !== null;
      });
      expect(removeButton).toBeDisabled();
    });
  });

  describe('Property Operations', () => {
    it('renders location button', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByTestId('icon-mappin')).toBeInTheDocument();
    });

    it('renders date button', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByTestId('icon-calendar')).toBeInTheDocument();
    });

    it('renders type button', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByTestId('icon-film')).toBeInTheDocument();
    });

    it('renders lane button', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByTestId('icon-list')).toBeInTheDocument();
    });

    it('disables property buttons when no shots selected', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={0} />);

      const locationButton = screen.getByTestId('icon-mappin').closest('button');
      const dateButton = screen.getByTestId('icon-calendar').closest('button');
      const typeButton = screen.getByTestId('icon-film').closest('button');

      expect(locationButton).toBeDisabled();
      expect(dateButton).toBeDisabled();
      expect(typeButton).toBeDisabled();
    });
  });

  describe('Project Operations', () => {
    it('renders duplicate button when onDuplicateShots is provided', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
    });

    it('does not render duplicate button when onDuplicateShots is not provided', () => {
      const props = { ...defaultProps, onDuplicateShots: undefined };
      render(<BulkOperationsToolbar {...props} selectedCount={2} />);
      expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
    });

    it('calls onDuplicateShots when duplicate button is clicked', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      fireEvent.click(screen.getByText('Duplicate'));
      expect(defaultProps.onDuplicateShots).toHaveBeenCalledTimes(1);
    });

    it('renders move and copy buttons', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByTestId('icon-arrow')).toBeInTheDocument();
      expect(screen.getByTestId('icon-copy')).toBeInTheDocument();
    });

    it('disables move and copy when no other projects available', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} availableProjects={[]} />);

      const moveButton = screen.getByTestId('icon-arrow').closest('button');
      const copyButton = screen.getByTestId('icon-copy').closest('button');

      expect(moveButton).toBeDisabled();
      expect(copyButton).toBeDisabled();
    });

    it('enables move and copy when other projects available', () => {
      const projects = [
        { id: 'project-1', name: 'Current Project' },
        { id: 'project-2', name: 'Other Project' },
      ];
      render(<BulkOperationsToolbar
        {...defaultProps}
        selectedCount={2}
        availableProjects={projects}
        currentProjectId="project-1"
      />);

      const moveButton = screen.getByTestId('icon-arrow').closest('button');
      const copyButton = screen.getByTestId('icon-copy').closest('button');

      expect(moveButton).not.toBeDisabled();
      expect(copyButton).not.toBeDisabled();
    });
  });

  describe('Processing State', () => {
    it('shows processing message when isProcessing is true', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} isProcessing={true} />);
      expect(screen.getByText('Processing bulk operation...')).toBeInTheDocument();
    });

    it('disables all operation buttons when isProcessing is true', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} isProcessing={true} />);

      const clearButton = screen.getByText('Clear').closest('button');
      const tagsButton = screen.getByText('Tags').closest('button');
      const duplicateButton = screen.getByText('Duplicate').closest('button');

      expect(clearButton).toBeDisabled();
      expect(tagsButton).toBeDisabled();
      expect(duplicateButton).toBeDisabled();
    });
  });

  describe('Done Button', () => {
    it('renders Done button when onExitSelection is provided', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('calls onExitSelection when Done button is clicked', () => {
      render(<BulkOperationsToolbar {...defaultProps} selectedCount={2} />);
      fireEvent.click(screen.getByText('Done'));
      expect(defaultProps.onExitSelection).toHaveBeenCalledTimes(1);
    });

    it('does not render Done button when onExitSelection is not provided', () => {
      const props = { ...defaultProps, onExitSelection: undefined };
      render(<BulkOperationsToolbar {...props} selectedCount={2} />);
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });

  describe('Sticky Positioning', () => {
    it('applies sticky classes when isSticky is true', () => {
      const { container } = render(<BulkOperationsToolbar {...defaultProps} isSticky={true} />);
      const wrapper = container.firstChild;
      expect(wrapper.className).toContain('sticky');
    });

    it('does not apply sticky classes when isSticky is false', () => {
      const { container } = render(<BulkOperationsToolbar {...defaultProps} isSticky={false} />);
      const wrapper = container.firstChild;
      expect(wrapper.className).not.toContain('sticky');
    });

    it('uses custom topOffset when provided', () => {
      const { container } = render(<BulkOperationsToolbar {...defaultProps} isSticky={true} topOffset={200} />);
      const wrapper = container.firstChild;
      expect(wrapper.style.top).toBe('200px');
    });
  });
});
