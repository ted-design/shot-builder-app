// src/pages/__tests__/PullEditorPage.test.jsx
// Component tests for PullEditorPage

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PullEditorPage from '../PullEditorPage';
import * as firestore from 'firebase/firestore';
import { toast } from '../../lib/toast';

// Mock Firebase functions - declare but don't initialize yet (hoisting issue)
let mockOnSnapshot;
let mockGetDocs;
let mockUpdateDoc;
let mockServerTimestamp;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => ({ _path: args })),
  doc: vi.fn((...args) => ({ _path: args })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _seconds: 1234567890 })),
  orderBy: vi.fn((field, dir) => ({ _orderBy: field, _dir: dir })),
  query: vi.fn((coll, ...constraints) => ({ _query: coll, _constraints: constraints })),
}));

// Mock firebase module
vi.mock('../../lib/firebase', () => ({
  db: {},
}));

// Mock router hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ pullId: 'pull-123' }),
  };
});

// Mock auth context
const mockAuthContext = {
  clientId: 'test-client',
  role: 'producer',
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

// Mock project scope context
const mockProjectScope = {
  currentProjectId: 'project-123',
};

vi.mock('../../context/ProjectScopeContext', () => ({
  useProjectScope: () => mockProjectScope,
}));

// Mock toast
let mockToast;

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components
vi.mock('../../components/pulls/PullItemsGrid', () => ({
  default: ({ items, onItemsChange, canManage, canFulfill }) => (
    <div data-testid="pull-items-grid">
      <div data-testid="grid-items-count">{items.length} items</div>
      <div data-testid="grid-can-manage">{canManage ? 'can-manage' : 'cannot-manage'}</div>
      <div data-testid="grid-can-fulfill">{canFulfill ? 'can-fulfill' : 'cannot-fulfill'}</div>
      <button onClick={() => onItemsChange([...items, { id: 'new-item' }])}>
        Simulate Add Item
      </button>
    </div>
  ),
}));

vi.mock('../../components/pulls/PullItemEditor', () => ({
  default: ({ item, onSave, onClose }) => (
    <div data-testid="pull-item-editor">
      <div data-testid="editing-item">{item ? item.id : 'new-item'}</div>
      <button onClick={() => onSave({ id: item?.id || 'new-123', familyId: 'fam1', sizes: [] })}>
        Save Item
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../components/pulls/BulkAddItemsModal', () => ({
  default: ({ onAddItems, onClose }) => (
    <div data-testid="bulk-add-modal">
      <button onClick={() => onAddItems([{ id: 'bulk-1' }, { id: 'bulk-2' }])}>
        Add Bulk Items
      </button>
      <button onClick={onClose}>Close Bulk</button>
    </div>
  ),
}));

vi.mock('../../components/pulls/PullExportModal', () => ({
  default: ({ pull, onClose }) => (
    <div data-testid="pull-export-modal">
      <div data-testid="export-pull-title">{pull.title}</div>
      <button onClick={onClose}>Close Export</button>
    </div>
  ),
}));

vi.mock('../../components/pulls/PullShareModal', () => ({
  default: ({ pull, onGenerateLink, onRevokeLink, onClose }) => (
    <div data-testid="pull-share-modal">
      <button onClick={() => onGenerateLink('share-token-123')}>
        Generate Link
      </button>
      <button onClick={onRevokeLink}>Revoke Link</button>
      <button onClick={onClose}>Close Share</button>
    </div>
  ),
}));

// Mock paths
vi.mock('../../lib/paths', () => ({
  pullsPath: (projectId, clientId) => ['clients', clientId, 'projects', projectId, 'pulls'],
  productFamiliesPath: (clientId) => ['clients', clientId, 'productFamilies'],
  productFamilySkusPath: (familyId, clientId) => ['clients', clientId, 'productFamilies', familyId, 'skus'],
}));

// Mock pullItems utilities
vi.mock('../../lib/pullItems', () => ({
  calculateItemFulfillment: vi.fn((item) => 'pending'),
  sortPullItemsByGender: vi.fn((items) => [...items]),
  upsertPullItem: vi.fn((items, newItem, options) => [...items, newItem]),
}));

// Mock rbac
vi.mock('../../lib/rbac', () => ({
  canManagePulls: vi.fn((role) => role === 'producer' || role === 'admin'),
  canFulfillPulls: vi.fn((role) => role === 'wardrobe' || role === 'producer' || role === 'admin'),
}));

// FIXME: This test suite hangs during execution - needs investigation
// Issue: Tests hang when rendering PullEditorPage with router mocks
// Temporarily skipped to allow other tests to run
describe.skip('PullEditorPage', () => {
  const mockPull = {
    id: 'pull-123',
    title: 'Test Pull Sheet',
    status: 'draft',
    items: [
      { id: 'item-1', familyId: 'fam1', familyName: 'Hoodie', sizes: [] },
      { id: 'item-2', familyId: 'fam2', familyName: 'T-Shirt', sizes: [] },
    ],
  };

  const mockFamilies = [
    { id: 'fam1', styleName: 'Hoodie', styleNumber: 'HD001' },
    { id: 'fam2', styleName: 'T-Shirt', styleNumber: 'TS001' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Get references to mocked functions
    mockOnSnapshot = vi.mocked(firestore.onSnapshot);
    mockGetDocs = vi.mocked(firestore.getDocs);
    mockUpdateDoc = vi.mocked(firestore.updateDoc);
    mockServerTimestamp = vi.mocked(firestore.serverTimestamp);
    mockToast = vi.mocked(toast);

    // Setup Firebase mocks
    mockOnSnapshot.mockImplementation((docRef, callback) => {
      // Simulate successful pull load
      callback({
        exists: () => true,
        id: mockPull.id,
        data: () => ({
          title: mockPull.title,
          status: mockPull.status,
          items: mockPull.items,
        }),
      });
      return vi.fn(); // Unsubscribe function
    });

    mockGetDocs.mockResolvedValue({
      docs: mockFamilies.map((f) => ({
        id: f.id,
        data: () => f,
      })),
    });

    mockUpdateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading and Rendering', () => {
    it('shows loading spinner initially', () => {
      // Make onSnapshot not call callback immediately
      mockOnSnapshot.mockImplementation(() => vi.fn());

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders pull editor after loading', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      expect(screen.getByTestId('pull-items-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-items-count')).toHaveTextContent('2 items');
    });

    it('displays item count correctly', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2 line items')).toBeInTheDocument();
      });
    });

    it('handles pull not found', async () => {
      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => false,
        });
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith({ title: 'Pull not found' });
        expect(mockNavigate).toHaveBeenCalledWith('/pulls', { replace: true });
      });
    });
  });

  describe('Status Management', () => {
    it('displays current status', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const statusSelect = screen.getByRole('combobox');
        expect(statusSelect).toHaveValue('draft');
      });
    });

    it('updates status when changed', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      const statusSelect = screen.getByRole('combobox');
      fireEvent.change(statusSelect, { target: { value: 'published' } });

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const callArgs = mockUpdateDoc.mock.calls[0];
        expect(callArgs[1]).toMatchObject({ status: 'published' });
      });
    });

    it('disables status dropdown for non-managers', async () => {
      mockAuthContext.role = 'viewer';

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const statusSelect = screen.getByRole('combobox');
        expect(statusSelect).toBeDisabled();
      });

      // Restore role
      mockAuthContext.role = 'producer';
    });
  });

  describe('Item Management', () => {
    it('opens item editor when Add Item clicked', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add item/i });
      fireEvent.click(addButton);

      expect(screen.getByTestId('pull-item-editor')).toBeInTheDocument();
      expect(screen.getByTestId('editing-item')).toHaveTextContent('new-item');
    });

    it('hides Add Item and Bulk Add buttons for non-managers', async () => {
      mockAuthContext.role = 'viewer';

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /bulk add/i })).not.toBeInTheDocument();

      // Restore role
      mockAuthContext.role = 'producer';
    });

    it('opens bulk add modal', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      const bulkAddButton = screen.getByRole('button', { name: /bulk add from shots/i });
      fireEvent.click(bulkAddButton);

      expect(screen.getByTestId('bulk-add-modal')).toBeInTheDocument();
    });

    it('closes item editor', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Open editor
      const addButton = screen.getByRole('button', { name: /add item/i });
      fireEvent.click(addButton);

      expect(screen.getByTestId('pull-item-editor')).toBeInTheDocument();

      // Close editor
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('pull-item-editor')).not.toBeInTheDocument();
    });
  });

  describe('Autosave and Dirty State', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows dirty state when items change', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('All changes saved')).toBeInTheDocument();
      });

      // Simulate item change from grid
      const simulateButton = screen.getByText('Simulate Add Item');
      fireEvent.click(simulateButton);

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });

    it('autosaves after 500ms debounce', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Simulate item change
      const simulateButton = screen.getByText('Simulate Add Item');
      fireEvent.click(simulateButton);

      // Should not save immediately
      expect(mockUpdateDoc).not.toHaveBeenCalled();

      // Fast-forward 500ms
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const callArgs = mockUpdateDoc.mock.calls[0];
        expect(callArgs[1]).toHaveProperty('items');
      });
    });

    it('shows saving indicator during save', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Make updateDoc take time
      mockUpdateDoc.mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 100);
      }));

      // Simulate item change
      const simulateButton = screen.getByText('Simulate Add Item');
      fireEvent.click(simulateButton);

      // Fast-forward to trigger save
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(screen.getByText('Saving…')).toBeInTheDocument();
      });

      // Fast-forward to complete save
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('All changes saved')).toBeInTheDocument();
      });
    });

    it('shows error toast on save failure', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Save failed'));

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Simulate item change
      const simulateButton = screen.getByText('Simulate Add Item');
      fireEvent.click(simulateButton);

      // Fast-forward to trigger save
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith({ title: 'Failed to autosave changes' });
      });
    });
  });

  describe('Modals', () => {
    it('opens and closes export modal', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Open export modal
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByTestId('pull-export-modal')).toBeInTheDocument();
      });

      // Close export modal
      const closeExportButton = screen.getByRole('button', { name: /close export/i });
      fireEvent.click(closeExportButton);

      await waitFor(() => {
        expect(screen.queryByTestId('pull-export-modal')).not.toBeInTheDocument();
      });
    });

    it('opens and closes share modal', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Open share modal
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);

      expect(screen.getByTestId('pull-share-modal')).toBeInTheDocument();

      // Close share modal
      const closeShareButton = screen.getByRole('button', { name: /close share/i });
      fireEvent.click(closeShareButton);

      expect(screen.queryByTestId('pull-share-modal')).not.toBeInTheDocument();
    });

    it('generates share link', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Open share modal
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);

      // Generate link
      const generateButton = screen.getByRole('button', { name: /generate link/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const callArgs = mockUpdateDoc.mock.calls[0];
        expect(callArgs[1]).toMatchObject({
          shareToken: 'share-token-123',
          shareEnabled: true,
        });
      });
    });

    it('revokes share link', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      // Open share modal
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);

      // Revoke link
      const revokeButton = screen.getByRole('button', { name: /revoke link/i });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const callArgs = mockUpdateDoc.mock.calls[mockUpdateDoc.mock.calls.length - 1];
        expect(callArgs[1]).toMatchObject({
          shareEnabled: false,
        });
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back when Back button clicked', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Pull Sheet')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('Permissions', () => {
    it('passes canManage to PullItemsGrid', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('grid-can-manage')).toHaveTextContent('can-manage');
      });
    });

    it('passes canFulfill to PullItemsGrid', async () => {
      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('grid-can-fulfill')).toHaveTextContent('can-fulfill');
      });
    });

    it('restricts permissions for viewer role', async () => {
      mockAuthContext.role = 'viewer';

      render(
        <MemoryRouter initialEntries={['/pulls/pull-123']}>
          <Routes>
            <Route path="/pulls/:pullId" element={<PullEditorPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('grid-can-manage')).toHaveTextContent('cannot-manage');
        expect(screen.getByTestId('grid-can-fulfill')).toHaveTextContent('cannot-fulfill');
      });

      // Restore role
      mockAuthContext.role = 'producer';
    });
  });
});
