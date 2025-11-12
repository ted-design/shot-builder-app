// src/components/pulls/__tests__/PullItemsGrid.test.jsx
//
// Integration tests for PullItemsGrid component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PullItemsGrid from '../PullItemsGrid';

globalThis.React = React;

// Mock ShotProductAddModal to avoid Firebase dependencies
vi.mock('../../shots/ShotProductAddModal', () => ({
  default: ({ open, onClose, onSubmit }) => {
    if (!open) return null;
    return (
      <div data-testid="product-add-modal">
        <button onClick={() => {
          onSubmit({
            family: { id: 'fam1', styleName: 'New Product', styleNumber: 'NP001', gender: 'mens' },
            colour: { id: 'col1', colorName: 'Blue' },
            size: 'M',
          });
        }}>
          Add Product
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
}));

describe('PullItemsGrid', () => {
  const mockItems = [
    {
      id: 'item1',
      familyId: 'fam1',
      familyName: 'Hoodie',
      styleNumber: 'HD001',
      colourId: 'blk',
      colourName: 'Black',
      gender: 'mens',
      sizes: [
        { size: 'S', quantity: 2, fulfilled: 0, status: 'pending' },
        { size: 'M', quantity: 3, fulfilled: 1, status: 'partial' },
      ],
      notes: 'Priority item',
      shotIds: ['shot1'],
    },
    {
      id: 'item2',
      familyId: 'fam2',
      familyName: 'T-Shirt',
      styleNumber: 'TS001',
      colourId: 'wht',
      colourName: 'White',
      gender: 'womens',
      sizes: [
        { size: 'S', quantity: 5, fulfilled: 5, status: 'fulfilled' },
      ],
      notes: '',
      shotIds: ['shot2'],
    },
  ];

  const defaultProps = {
    items: mockItems,
    onItemsChange: vi.fn(),
    canManage: true,
    canFulfill: true,
    families: [],
    loadFamilyDetails: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders pull items grid with data', () => {
      render(<PullItemsGrid {...defaultProps} />);

      expect(screen.getByText('Hoodie – Black')).toBeInTheDocument();
      expect(screen.getByText('T-Shirt – White')).toBeInTheDocument();
      expect(screen.getByText('Style: HD001')).toBeInTheDocument();
    });

    it('displays total quantities and fulfilled counts', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Hoodie: 2 + 3 = 5 total, 1 fulfilled
      const rows = screen.getAllByRole('row');
      const hoodieRow = rows.find(row => row.textContent.includes('Hoodie'));
      expect(hoodieRow).toHaveTextContent('5'); // total qty
      expect(hoodieRow).toHaveTextContent('1'); // fulfilled
    });

    it('displays status badges correctly', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Check for status badges (not column headers)
      const partialBadges = screen.getAllByText('Partial');
      const fulfilledBadges = screen.getAllByText('Fulfilled');

      // Should have at least the status badges
      expect(partialBadges.length).toBeGreaterThan(0);
      expect(fulfilledBadges.length).toBeGreaterThan(0);
    });

    it('renders empty state when no items', () => {
      render(<PullItemsGrid {...defaultProps} items={[]} />);

      // Grid still renders with toolbar
      expect(screen.getByPlaceholderText(/Filter by product/i)).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters items by product name', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const filterInput = screen.getByPlaceholderText(/Filter by product/i);
      fireEvent.change(filterInput, { target: { value: 'hoodie' } });

      expect(screen.getByText('Hoodie – Black')).toBeInTheDocument();
      expect(screen.queryByText('T-Shirt – White')).not.toBeInTheDocument();
    });

    it('filters items by color name', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const filterInput = screen.getByPlaceholderText(/Filter by product/i);
      fireEvent.change(filterInput, { target: { value: 'white' } });

      expect(screen.queryByText('Hoodie – Black')).not.toBeInTheDocument();
      expect(screen.getByText('T-Shirt – White')).toBeInTheDocument();
    });

    it('filters items by style number', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const filterInput = screen.getByPlaceholderText(/Filter by product/i);
      fireEvent.change(filterInput, { target: { value: 'TS001' } });

      expect(screen.getByText('T-Shirt – White')).toBeInTheDocument();
      expect(screen.queryByText('Hoodie – Black')).not.toBeInTheDocument();
    });

    it('shows all items when filter is cleared', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const filterInput = screen.getByPlaceholderText(/Filter by product/i);
      fireEvent.change(filterInput, { target: { value: 'hoodie' } });
      fireEvent.change(filterInput, { target: { value: '' } });

      expect(screen.getByText('Hoodie – Black')).toBeInTheDocument();
      expect(screen.getByText('T-Shirt – White')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts items by name ascending', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const sortSelect = screen.getByLabelText('Sort by');
      fireEvent.change(sortSelect, { target: { value: 'name' } });

      const rows = screen.getAllByRole('row');
      const dataRows = rows.filter(row => row.querySelector('td'));

      // First data row should be Hoodie (alphabetically first)
      expect(dataRows[0]).toHaveTextContent('Hoodie');
      expect(dataRows[1]).toHaveTextContent('T-Shirt');
    });

    it('sorts items by name descending', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const sortSelect = screen.getByLabelText('Sort by');
      const sortDirButton = screen.getByLabelText('Toggle sort direction');

      fireEvent.change(sortSelect, { target: { value: 'name' } });
      fireEvent.click(sortDirButton);

      const rows = screen.getAllByRole('row');
      const dataRows = rows.filter(row => row.querySelector('td'));

      // First data row should be T-Shirt (alphabetically last when desc)
      expect(dataRows[0]).toHaveTextContent('T-Shirt');
      expect(dataRows[1]).toHaveTextContent('Hoodie');
    });

    it('sorts items by gender', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const sortSelect = screen.getByLabelText('Sort by');
      fireEvent.change(sortSelect, { target: { value: 'gender' } });

      const rows = screen.getAllByRole('row');
      const dataRows = rows.filter(row => row.querySelector('td'));

      // mens (1) comes before womens (2) in gender order
      expect(dataRows[0]).toHaveTextContent('Hoodie'); // mens
      expect(dataRows[1]).toHaveTextContent('T-Shirt'); // womens
    });
  });

  describe('Row Expansion', () => {
    it('expands row to show size details', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Initially sizes are hidden
      expect(screen.queryByText('Sizes')).not.toBeInTheDocument();

      // Click expand button
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Size details should be visible
      expect(screen.getByText('Sizes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('S')).toBeInTheDocument();
      expect(screen.getByDisplayValue('M')).toBeInTheDocument();
    });

    it('collapses expanded row', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      expect(screen.getByText('Sizes')).toBeInTheDocument();

      const collapseButton = screen.getByLabelText('Collapse');
      fireEvent.click(collapseButton);

      expect(screen.queryByText('Sizes')).not.toBeInTheDocument();
    });

    it('expands all rows', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const expandAllButton = screen.getByRole('button', { name: /expand all/i });
      fireEvent.click(expandAllButton);

      // Should see size details for both items
      const sizesHeaders = screen.getAllByText('Sizes');
      expect(sizesHeaders).toHaveLength(2);
    });

    it('collapses all rows', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // First expand all
      const expandAllButton = screen.getByRole('button', { name: /expand all/i });
      fireEvent.click(expandAllButton);

      // Then collapse all
      const collapseAllButton = screen.getByRole('button', { name: /collapse all/i });
      fireEvent.click(collapseAllButton);

      expect(screen.queryByText('Sizes')).not.toBeInTheDocument();
    });
  });

  describe('Inline Editing', () => {
    it('allows editing notes when canManage is true', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const notesInputs = screen.getAllByPlaceholderText(/Add notes/i);
      fireEvent.change(notesInputs[0], { target: { value: 'Updated notes' } });

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].notes).toBe('Updated notes');
    });

    it('disables editing when canManage is false', () => {
      render(<PullItemsGrid {...defaultProps} canManage={false} />);

      // Notes should be displayed as text, not input
      expect(screen.queryByPlaceholderText(/Add notes/i)).not.toBeInTheDocument();
      expect(screen.getByText('Priority item')).toBeInTheDocument();
    });

    it('edits size quantity when row is expanded', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Find quantity inputs
      const quantityInputs = screen.getAllByDisplayValue('2');
      const firstSizeQty = quantityInputs[0];

      // Edit and blur to commit
      fireEvent.change(firstSizeQty, { target: { value: '5' } });
      fireEvent.blur(firstSizeQty);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].sizes[0].quantity).toBe(5);
    });

    it('edits fulfilled count when canFulfill is true', () => {
      render(<PullItemsGrid {...defaultProps} canFulfill={true} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Find fulfilled inputs (M size has fulfilled: 1)
      const fulfilledInputs = screen.getAllByDisplayValue('1');
      const firstSizeFulfilled = fulfilledInputs[0];

      // Edit and blur to commit
      fireEvent.change(firstSizeFulfilled, { target: { value: '3' } });
      fireEvent.blur(firstSizeFulfilled);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].sizes[1].fulfilled).toBe(3);
    });

    it('clamps fulfilled to not exceed quantity', () => {
      render(<PullItemsGrid {...defaultProps} canFulfill={true} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // M size has quantity: 3
      const fulfilledInputs = screen.getAllByDisplayValue('1');
      const firstSizeFulfilled = fulfilledInputs[0];

      // Try to set fulfilled to 10 (should clamp to 3)
      fireEvent.change(firstSizeFulfilled, { target: { value: '10' } });
      fireEvent.blur(firstSizeFulfilled);

      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].sizes[1].fulfilled).toBe(3); // Clamped to quantity
    });
  });

  describe('Adding and Removing', () => {
    it('adds new size row', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Click Add Size
      const addSizeButton = screen.getByRole('button', { name: /add size/i });
      fireEvent.click(addSizeButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].sizes).toHaveLength(3); // Was 2, now 3
      expect(updatedItems[0].sizes[2]).toEqual({
        size: '',
        quantity: 1,
        fulfilled: 0,
        status: 'pending',
      });
    });

    it('removes size row', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Find and click remove button for first size
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      fireEvent.click(removeButtons[0]); // First remove is for the size row

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems[0].sizes).toHaveLength(1); // Was 2, now 1
    });

    it('removes entire item', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Find the first item row
      const hoodieRow = screen.getByText('Hoodie – Black').closest('tr');

      // Expand to see actions
      const expandButton = within(hoodieRow).getByLabelText('Expand');
      fireEvent.click(expandButton);

      // Find and click the Remove button in the Actions column (not in size rows)
      const removeButton = within(hoodieRow).getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems).toHaveLength(1); // Was 2, now 1
      expect(updatedItems[0].id).toBe('item2'); // Only T-Shirt remains
    });

    it('opens product add modal', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const quickAddButton = screen.getByRole('button', { name: /quick add/i });
      fireEvent.click(quickAddButton);

      expect(screen.getByTestId('product-add-modal')).toBeInTheDocument();
    });

    it('adds product via modal', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const quickAddButton = screen.getByRole('button', { name: /quick add/i });
      fireEvent.click(quickAddButton);

      const addProductButton = screen.getByRole('button', { name: /add product/i });
      fireEvent.click(addProductButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
    });
  });

  describe('Selection and Bulk Operations', () => {
    it('selects individual items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const firstItemCheckbox = checkboxes[1]; // [0] is select all

      fireEvent.click(firstItemCheckbox);

      expect(firstItemCheckbox).toBeChecked();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('selects all visible items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('deselects all items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Select all
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      // Deselect all
      fireEvent.click(selectAllCheckbox);

      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });

    it('bulk deletes selected items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Select first item
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // Click bulk delete
      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      fireEvent.click(deleteButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];
      expect(updatedItems).toHaveLength(1);
      expect(updatedItems[0].id).toBe('item2');
    });

    it('bulk marks items as fulfilled', () => {
      render(<PullItemsGrid {...defaultProps} canFulfill={true} />);

      // Select first item
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // Click bulk fulfill
      const fulfillButton = screen.getByRole('button', { name: /fulfill sizes/i });
      fireEvent.click(fulfillButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];

      // All sizes should be fulfilled with quantity values
      expect(updatedItems[0].sizes[0].fulfilled).toBe(2);
      expect(updatedItems[0].sizes[0].status).toBe('fulfilled');
      expect(updatedItems[0].sizes[1].fulfilled).toBe(3);
      expect(updatedItems[0].sizes[1].status).toBe('fulfilled');
    });

    it('bulk clears fulfilled counts', () => {
      render(<PullItemsGrid {...defaultProps} canFulfill={true} />);

      // Select first item
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // Click bulk clear
      const clearButton = screen.getByRole('button', { name: /clear sizes fulfilled/i });
      fireEvent.click(clearButton);

      expect(defaultProps.onItemsChange).toHaveBeenCalled();
      const updatedItems = defaultProps.onItemsChange.mock.calls[0][0];

      // All sizes should have fulfilled reset to 0
      expect(updatedItems[0].sizes[0].fulfilled).toBe(0);
      expect(updatedItems[0].sizes[0].status).toBe('pending');
      expect(updatedItems[0].sizes[1].fulfilled).toBe(0);
      expect(updatedItems[0].sizes[1].status).toBe('pending');
    });

    it('expands selected items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Select first item
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // Click expand selected
      const expandSelectedButton = screen.getByRole('button', { name: /expand selected/i });
      fireEvent.click(expandSelectedButton);

      // Should see sizes panel
      expect(screen.getByText('Sizes')).toBeInTheDocument();
    });

    it('collapses selected items', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Select and expand first item
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      const expandSelectedButton = screen.getByRole('button', { name: /expand selected/i });
      fireEvent.click(expandSelectedButton);

      // Collapse selected
      const collapseSelectedButton = screen.getByRole('button', { name: /collapse selected/i });
      fireEvent.click(collapseSelectedButton);

      expect(screen.queryByText('Sizes')).not.toBeInTheDocument();
    });
  });

  describe('Column Visibility', () => {
    it('toggles columns panel', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const columnsButton = screen.getByRole('button', { name: /columns/i });
      fireEvent.click(columnsButton);

      // Verify columns panel is visible by checking for column labels
      // Use getAllByText to handle multiple instances (appears in both panel and table header)
      const genderLabels = screen.getAllByText('Gender');
      expect(genderLabels.length).toBeGreaterThan(0);

      const totalQtyLabels = screen.getAllByText('Total Qty');
      expect(totalQtyLabels.length).toBeGreaterThan(0);
    });

    it('hides gender column', () => {
      render(<PullItemsGrid {...defaultProps} />);

      // Initially gender column should be visible
      let headers = screen.getAllByRole('columnheader');
      let hasGenderColumn = headers.some(h => h.textContent.toUpperCase() === 'GENDER');
      expect(hasGenderColumn).toBe(true);

      // Open columns panel
      const columnsButton = screen.getByRole('button', { name: /columns/i });
      fireEvent.click(columnsButton);

      // Find all "Gender" text elements, then find the one in a label with a checkbox
      const genderLabels = screen.getAllByText('Gender');
      const genderCheckboxLabel = genderLabels.find(label => {
        const parent = label.closest('label');
        return parent && parent.querySelector('input[type="checkbox"]');
      });

      expect(genderCheckboxLabel).toBeTruthy();
      const genderCheckbox = genderCheckboxLabel.closest('label').querySelector('input[type="checkbox"]');
      fireEvent.click(genderCheckbox);

      // Gender column should be hidden from table header
      headers = screen.getAllByRole('columnheader');
      hasGenderColumn = headers.some(h => h.textContent.toUpperCase() === 'GENDER');
      expect(hasGenderColumn).toBe(false);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('opens quick add modal on N key', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const container = screen.getByRole('table').parentElement;
      fireEvent.keyDown(container, { key: 'N' });

      expect(screen.getByTestId('product-add-modal')).toBeInTheDocument();
    });

    it('does not trigger shortcuts when typing in input', () => {
      render(<PullItemsGrid {...defaultProps} />);

      const filterInput = screen.getByPlaceholderText(/Filter by product/i);
      filterInput.focus();
      fireEvent.keyDown(filterInput, { key: 'N' });

      // Modal should not open
      expect(screen.queryByTestId('product-add-modal')).not.toBeInTheDocument();
    });
  });

  describe('Permission Controls', () => {
    it('disables editing when canManage is false', () => {
      render(<PullItemsGrid {...defaultProps} canManage={false} />);

      expect(screen.queryByPlaceholderText(/Add notes/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /quick add/i })).toBeDisabled();
    });

    it('disables fulfillment editing when canFulfill is false', () => {
      render(<PullItemsGrid {...defaultProps} canFulfill={false} />);

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expand');
      fireEvent.click(expandButtons[0]);

      // Fulfilled column should be read-only text
      expect(screen.queryByDisplayValue('0')).not.toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Static text instead of input
    });
  });
});
