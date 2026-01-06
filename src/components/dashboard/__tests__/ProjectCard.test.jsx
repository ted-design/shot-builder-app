import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProjectCard, CreateProjectCard } from '../ProjectCard';

describe('ProjectCard', () => {
  const mockProject = {
    id: 'test-project-1',
    name: 'Test Project',
    status: 'active',
    shotCount: 10,
    stats: {
      shots: 10,
      talent: 5,
      locations: 3,
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
  };

  const defaultProps = {
    project: mockProject,
    isActive: false,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    canManage: false,
  };

  it('renders project name', () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders shot count with camera icon', () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText('10 shots')).toBeInTheDocument();
  });

  describe('Active state rendering', () => {
    it('applies active ring styling when isActive is true', () => {
      const { container } = render(<ProjectCard {...defaultProps} isActive={true} />);
      const card = container.querySelector('.ring-2');
      expect(card).toBeInTheDocument();
    });

    it('applies inactive card styling when isActive is false', () => {
      const { container } = render(<ProjectCard {...defaultProps} isActive={false} />);
      const card = container.querySelector('.border-slate-200');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edit button', () => {
    it('shows edit button when canManage is true', () => {
      render(<ProjectCard {...defaultProps} canManage={true} />);
      expect(screen.getByRole('button', { name: 'Edit project' })).toBeInTheDocument();
    });

    it('hides edit button when canManage is false', () => {
      render(<ProjectCard {...defaultProps} canManage={false} />);
      expect(screen.queryByRole('button', { name: 'Edit project' })).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn();
      render(<ProjectCard {...defaultProps} canManage={true} onEdit={onEdit} />);
      screen.getByRole('button', { name: 'Edit project' }).click();
      expect(onEdit).toHaveBeenCalledWith(mockProject);
    });
  });

  describe('Selection behavior', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(<ProjectCard {...defaultProps} onSelect={onSelect} />);
      screen.getByText('Test Project').click();
      expect(onSelect).toHaveBeenCalledWith(mockProject);
    });
  });

  describe('Progress bar', () => {
    it('shows progress bar for planning status projects', () => {
      const planningProject = {
        ...mockProject,
        status: 'planning',
        shotCount: 10,
        stats: { ...mockProject.stats, shotsPlanned: 5 },
      };
      render(<ProjectCard {...defaultProps} project={planningProject} />);
      expect(screen.getByText('Planning progress')).toBeInTheDocument();
    });

    it('hides progress bar for non-planning status projects', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.queryByText('Planning progress')).not.toBeInTheDocument();
    });
  });

  describe('Date formatting and timezone handling', () => {
    it('formats single YYYY-MM-DD date correctly without timezone shift', () => {
      const projectWithDate = {
        ...mockProject,
        shootDates: ['2025-10-17'],
      };
      render(<ProjectCard {...defaultProps} project={projectWithDate} />);
      // Should display as Oct 17, not Oct 16 (no timezone shift)
      expect(screen.getByText(/Oct 17, 2025/i)).toBeInTheDocument();
    });

    it('formats multiple dates as a range', () => {
      const projectWithDates = {
        ...mockProject,
        shootDates: ['2025-10-17', '2025-10-18'],
      };
      render(<ProjectCard {...defaultProps} project={projectWithDates} />);
      // Should display as range
      expect(screen.getByText(/Oct 17, 2025 - Oct 18, 2025/i)).toBeInTheDocument();
    });

    it('formats three or more dates as comma-separated list', () => {
      const projectWithDates = {
        ...mockProject,
        shootDates: ['2025-10-17', '2025-10-18', '2025-10-19'],
      };
      render(<ProjectCard {...defaultProps} project={projectWithDates} />);
      expect(screen.getByText(/Oct 17, 2025, Oct 18, 2025, Oct 19, 2025/i)).toBeInTheDocument();
    });

    it('handles invalid dates gracefully by displaying original string', () => {
      const projectWithInvalidDate = {
        ...mockProject,
        shootDates: ['2025-02-30'], // Invalid date (Feb only has 28/29 days)
      };
      render(<ProjectCard {...defaultProps} project={projectWithInvalidDate} />);
      // Should display the original string when date is invalid
      expect(screen.getByText('2025-02-30')).toBeInTheDocument();
    });

    it('filters out empty date strings', () => {
      const projectWithEmptyDates = {
        ...mockProject,
        shootDates: ['2025-10-17', '', '2025-10-18'],
      };
      render(<ProjectCard {...defaultProps} project={projectWithEmptyDates} />);
      // Should only show valid dates as a range
      expect(screen.getByText(/Oct 17, 2025 - Oct 18, 2025/i)).toBeInTheDocument();
    });

    it('handles no shoot dates by not displaying date section', () => {
      const projectWithNoDates = {
        ...mockProject,
        shootDates: [],
      };
      render(<ProjectCard {...defaultProps} project={projectWithNoDates} />);
      // Calendar icon and date text should not be present
      expect(screen.queryByText(/Oct/i)).not.toBeInTheDocument();
    });

    it('validates year bounds and displays original for out-of-bounds', () => {
      const projectWithOldDate = {
        ...mockProject,
        shootDates: ['1899-10-17'], // Before 1900 minimum
      };
      render(<ProjectCard {...defaultProps} project={projectWithOldDate} />);
      // Should display original string for out-of-bounds year
      expect(screen.getByText('1899-10-17')).toBeInTheDocument();
    });

    it('detects rolled forward dates and displays original', () => {
      const projectWithRolledDate = {
        ...mockProject,
        shootDates: ['2025-02-29'], // Not a leap year - JS would roll to Mar 1
      };
      render(<ProjectCard {...defaultProps} project={projectWithRolledDate} />);
      // Should display original string for rolled dates
      expect(screen.getByText('2025-02-29')).toBeInTheDocument();
    });

    it('handles valid leap year date correctly', () => {
      const projectWithLeapDate = {
        ...mockProject,
        shootDates: ['2024-02-29'], // 2024 is a leap year
      };
      render(<ProjectCard {...defaultProps} project={projectWithLeapDate} />);
      // Should format correctly
      expect(screen.getByText(/Feb 29, 2024/i)).toBeInTheDocument();
    });

    it('handles dates at month boundaries correctly', () => {
      const projectWithBoundaryDate = {
        ...mockProject,
        shootDates: ['2025-01-31'], // Last day of January
      };
      render(<ProjectCard {...defaultProps} project={projectWithBoundaryDate} />);
      expect(screen.getByText(/Jan 31, 2025/i)).toBeInTheDocument();
    });
  });

  describe('Dark mode support', () => {
    it('has dark mode classes for timestamp', () => {
      const { container } = render(<ProjectCard {...defaultProps} />);
      const timestamp = container.querySelector('.dark\\:text-slate-400');
      expect(timestamp).toBeInTheDocument();
    });

    it('has dark mode classes for active state', () => {
      const { container } = render(<ProjectCard {...defaultProps} isActive={true} />);
      const card = container.querySelector('.ring-2');
      expect(card).toBeInTheDocument();
      expect(card.className).toContain('dark:ring-indigo-500/25');
    });
  });
});

describe('CreateProjectCard', () => {
  it('renders create project button', () => {
    const onClick = vi.fn();
    render(<CreateProjectCard onClick={onClick} />);
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();
  });

  it('renders create project heading', () => {
    const onClick = vi.fn();
    render(<CreateProjectCard onClick={onClick} />);
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  it('renders description text', () => {
    const onClick = vi.fn();
    render(<CreateProjectCard onClick={onClick} />);
    expect(screen.getByText(/Spin up a new campaign/i)).toBeInTheDocument();
  });

  it('calls onClick when button is clicked', () => {
    const onClick = vi.fn();
    render(<CreateProjectCard onClick={onClick} />);
    screen.getByRole('button', { name: 'New Project' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has dashed border styling', () => {
    const { container } = render(<CreateProjectCard onClick={vi.fn()} />);
    const card = container.querySelector('.border-dashed');
    expect(card).toBeInTheDocument();
  });

  it('has dark mode support', () => {
    const { container } = render(<CreateProjectCard onClick={vi.fn()} />);
    const darkBorder = container.querySelector('.dark\\:border-slate-600');
    expect(darkBorder).toBeInTheDocument();
  });
});
