import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import ProductFamilyForm from '../ProductFamilyForm';

// Make React available globally for JSX
globalThis.React = React;

// Mock Firebase storage
vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
}));

vi.mock('../../../lib/firebase', () => ({
  storage: {},
}));

// Mock image compression
vi.mock('../../../lib/images', () => ({
  compressImageFile: vi.fn(),
  formatFileSize: vi.fn(),
}));

// Mock UI components
vi.mock('../../ui/button', () => ({
  Button: ({ children, onClick, type = 'button', variant, size, ...props }) => (
    <button type={type} onClick={onClick} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../ui/input', () => ({
  Input: ({ value, onChange, placeholder, required, ...props }) => (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      {...props}
    />
  ),
  Checkbox: ({ checked, onChange, children, ...props }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        {...props}
      />
      {children}
    </label>
  ),
}));

vi.mock('../../ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock('../../common/AppImage', () => ({
  default: ({ src, alt }) => <img src={src} alt={alt} data-testid="app-image" />,
}));

// Mock SizeListInput
vi.mock('../SizeListInput', () => ({
  default: ({ value, onChange, label, helperText, inputPlaceholder }) => (
    <div data-testid="size-list-input">
      <label>{label}</label>
      <p>{helperText}</p>
      <button
        onClick={() => onChange([...value, ''])}
        data-testid="add-size-button"
      >
        Add Size
      </button>
      {value.map((size, index) => (
        <div key={index}>
          <input
            type="text"
            value={size}
            onChange={(e) => {
              const newSizes = [...value];
              newSizes[index] = e.target.value;
              onChange(newSizes);
            }}
            placeholder={inputPlaceholder}
            data-testid={`size-input-${index}`}
          />
          <button
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            data-testid={`remove-size-${index}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  ),
}));

// Mock ColorListEditor
vi.mock('../ColorListEditor', () => ({
  default: ({ colors, onAddColor, onRemoveColor, onFieldChange, onImageSelect, onClearImage }) => (
    <div data-testid="color-list-editor">
      <button onClick={onAddColor} data-testid="add-color-button">
        Add Color
      </button>
      {colors.map((color) => (
        <div key={color.localId} data-testid={`color-entry-${color.localId}`}>
          <input
            type="text"
            value={color.colorName}
            onChange={(e) => onFieldChange(color.localId, { colorName: e.target.value })}
            placeholder="Color name"
            data-testid={`color-name-${color.localId}`}
          />
          <input
            type="text"
            value={color.skuCode}
            onChange={(e) => onFieldChange(color.localId, { skuCode: e.target.value })}
            placeholder="SKU code"
            data-testid={`sku-code-${color.localId}`}
          />
          <input
            type="file"
            onChange={(e) => onImageSelect(color.localId, e.target.files[0])}
            data-testid={`color-image-${color.localId}`}
          />
          {color.imagePreview && (
            <button
              onClick={() => onClearImage(color.localId)}
              data-testid={`clear-color-image-${color.localId}`}
            >
              Clear Image
            </button>
          )}
          <button
            onClick={() => onRemoveColor(color.localId)}
            data-testid={`remove-color-${color.localId}`}
          >
            Remove Color
          </button>
        </div>
      ))}
    </div>
  ),
}));

describe('ProductFamilyForm', () => {
  let onSubmit;
  let onCancel;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock URL methods for jsdom
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Import and setup mocked functions
    const { getDownloadURL, ref } = await import('firebase/storage');
    const { compressImageFile, formatFileSize } = await import('../../../lib/images');

    // Setup default mock implementations
    vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/image.jpg');
    vi.mocked(ref).mockReturnValue({});
    vi.mocked(compressImageFile).mockImplementation(async (file) => file);
    vi.mocked(formatFileSize).mockReturnValue('1.2 MB');

    // Create fresh callback mocks
    onSubmit = vi.fn();
    onCancel = vi.fn();
  });

  describe('Rendering and Initial State', () => {
    it('renders the form with default values', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      expect(screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. UM2026-3013-01')).toBeInTheDocument();
      expect(screen.getByTestId('size-list-input')).toBeInTheDocument();
      expect(screen.getByTestId('color-list-editor')).toBeInTheDocument();
    });

    it('populates form with initial values', () => {
      const initialValue = {
        styleName: 'Test Product',
        styleNumber: 'TP-001',
        previousStyleNumber: 'TP-OLD',
        gender: 'mens',
        status: 'active',
        archived: false,
        notes: [],
        sizes: ['S', 'M', 'L'],
        thumbnailImagePath: null,
        headerImagePath: null,
      };

      render(
        <ProductFamilyForm
          initialValue={initialValue}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      expect(screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley')).toHaveValue('Test Product');
      expect(screen.getByPlaceholderText('e.g. UM2026-3013-01')).toHaveValue('TP-001');
    });

    it('shows loading spinner when submitting', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={true}
        />
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Form Field Updates', () => {
    it('updates style name field', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const styleNameInput = screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley');
      fireEvent.change(styleNameInput, { target: { value: 'New Product' } });

      expect(styleNameInput).toHaveValue('New Product');
    });

    it('updates style number field', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const styleNumberInput = screen.getByPlaceholderText('e.g. UM2026-3013-01');
      fireEvent.change(styleNumberInput, { target: { value: 'NP-999' } });

      expect(styleNumberInput).toHaveValue('NP-999');
    });

    it('updates gender selection', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const genderSelect = screen.getByDisplayValue('Unisex');
      fireEvent.change(genderSelect, { target: { value: 'mens' } });

      expect(genderSelect).toHaveValue('mens');
    });

    it('updates status selection', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const statusSelect = screen.getByDisplayValue('Active');
      fireEvent.change(statusSelect, { target: { value: 'discontinued' } });

      expect(statusSelect).toHaveValue('discontinued');
    });
  });

  describe('Validation', () => {
    it('validates that style name is required', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add a colour first (required)
      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);

      // Find the color name input and set it
      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      fireEvent.change(colorNameInputs[0], { target: { value: 'Black' } });

      // Set style number but leave style name empty
      const styleNumberInput = screen.getByPlaceholderText('e.g. UM2026-3013-01');
      fireEvent.change(styleNumberInput, { target: { value: 'TP-001' } });

      // Submit form
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Style name is required.')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('validates that style number is required', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add a colour first (required)
      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);

      // Find the color name input and set it
      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      fireEvent.change(colorNameInputs[0], { target: { value: 'Black' } });

      // Set style name but leave style number empty
      const styleNameInput = screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley');
      fireEvent.change(styleNameInput, { target: { value: 'Test Product' } });

      // Submit form
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Style number is required.')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('validates that at least one colour is required', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Fill in required fields
      const styleNameInput = screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley');
      fireEvent.change(styleNameInput, { target: { value: 'Test Product' } });

      const styleNumberInput = screen.getByPlaceholderText('e.g. UM2026-3013-01');
      fireEvent.change(styleNumberInput, { target: { value: 'TP-001' } });

      // Submit form without adding any colours
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Add at least one colour.')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('validates that colour name is required when SKU code is provided', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Fill in required fields
      const styleNameInput = screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley');
      fireEvent.change(styleNameInput, { target: { value: 'Test Product' } });

      const styleNumberInput = screen.getByPlaceholderText('e.g. UM2026-3013-01');
      fireEvent.change(styleNumberInput, { target: { value: 'TP-001' } });

      // Add a colour
      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);

      // Set SKU code but not color name
      const skuInputs = screen.getAllByPlaceholderText('SKU code');
      fireEvent.change(skuInputs[0], { target: { value: 'SKU-001' } });

      // Submit form
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Add a colour name for each SKU entry or clear the SKU.')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Fill in required fields
      const styleNameInput = screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley');
      fireEvent.change(styleNameInput, { target: { value: 'Test Product' } });

      const styleNumberInput = screen.getByPlaceholderText('e.g. UM2026-3013-01');
      fireEvent.change(styleNumberInput, { target: { value: 'TP-001' } });

      // Add a colour
      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);

      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      fireEvent.change(colorNameInputs[0], { target: { value: 'Black' } });

      // Submit form
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.family.styleName).toBe('Test Product');
      expect(submittedData.family.styleNumber).toBe('TP-001');
      expect(submittedData.skus).toHaveLength(1);
      expect(submittedData.skus[0].colorName).toBe('Black');
    });

    it('includes sizes in submitted data', async () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText('e.g. Honeycomb Knit Merino Henley'), {
        target: { value: 'Test Product' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g. UM2026-3013-01'), {
        target: { value: 'TP-001' },
      });

      // Add sizes
      fireEvent.click(screen.getByTestId('add-size-button'));
      fireEvent.change(screen.getByTestId('size-input-0'), {
        target: { value: 'S' },
      });

      fireEvent.click(screen.getByTestId('add-size-button'));
      fireEvent.change(screen.getByTestId('size-input-1'), {
        target: { value: 'M' },
      });

      // Add a colour
      fireEvent.click(screen.getByTestId('add-color-button'));
      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      fireEvent.change(colorNameInputs[0], { target: { value: 'Black' } });

      // Submit
      const form = screen.getByRole('form') || document.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.family.sizes).toEqual(['S', 'M']);
    });
  });

  describe('Size Management', () => {
    it('adds a new size', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const addSizeButton = screen.getByTestId('add-size-button');
      fireEvent.click(addSizeButton);

      expect(screen.getByTestId('size-input-0')).toBeInTheDocument();
    });

    it('removes a size', () => {
      render(
        <ProductFamilyForm
          initialValue={{ sizes: ['S', 'M', 'L'] }}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const removeSizeButton = screen.getByTestId('remove-size-1');
      fireEvent.click(removeSizeButton);

      // After removal, only 2 size inputs should remain
      expect(screen.getByTestId('size-input-0')).toBeInTheDocument();
      expect(screen.getByTestId('size-input-1')).toBeInTheDocument();
      expect(screen.queryByTestId('size-input-2')).not.toBeInTheDocument();
    });

    it('updates a size value', () => {
      render(
        <ProductFamilyForm
          initialValue={{ sizes: ['S'] }}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const sizeInput = screen.getByTestId('size-input-0');
      fireEvent.change(sizeInput, { target: { value: 'XS' } });

      expect(sizeInput).toHaveValue('XS');
    });
  });

  describe('Colour/SKU Management', () => {
    it('adds a new colour', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);

      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      expect(colorNameInputs.length).toBe(1);
    });

    it('removes a colour', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add two colours
      const addColorButton = screen.getByTestId('add-color-button');
      fireEvent.click(addColorButton);
      fireEvent.click(addColorButton);

      const colorEntries = screen.getAllByTestId(/^color-entry-/);
      expect(colorEntries.length).toBe(2);

      // Remove the first colour
      const removeButton = screen.getAllByText('Remove Color')[0];
      fireEvent.click(removeButton);

      // Should have one colour left
      const remainingColorEntries = screen.getAllByTestId(/^color-entry-/);
      expect(remainingColorEntries.length).toBe(1);
    });

    it('updates colour name', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add a colour
      fireEvent.click(screen.getByTestId('add-color-button'));

      const colorNameInputs = screen.getAllByPlaceholderText('Color name');
      fireEvent.change(colorNameInputs[0], { target: { value: 'Navy Blue' } });

      expect(colorNameInputs[0]).toHaveValue('Navy Blue');
    });

    it('updates SKU code', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add a colour
      fireEvent.click(screen.getByTestId('add-color-button'));

      const skuInputs = screen.getAllByPlaceholderText('SKU code');
      fireEvent.change(skuInputs[0], { target: { value: 'SKU-123' } });

      expect(skuInputs[0]).toHaveValue('SKU-123');
    });
  });

  describe('Image Upload', () => {
    it('handles thumbnail image upload', async () => {
      const mockFile = new File(['dummy'], 'thumbnail.jpg', { type: 'image/jpeg' });

      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const fileInputs = screen.getAllByRole('button', { hidden: true }).filter(
        (el) => el.tagName === 'INPUT' && el.type === 'file'
      );
      const thumbnailInput = fileInputs[0];

      Object.defineProperty(thumbnailInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(thumbnailInput);

      await waitFor(() => {
        expect(mockCompressImageFile).toHaveBeenCalledWith(mockFile, {
          maxDimension: 1600,
          quality: 0.82,
        });
      });
    });

    it('displays error when image compression fails', async () => {
      const mockFile = new File(['dummy'], 'thumbnail.jpg', { type: 'image/jpeg' });
      mockCompressImageFile.mockRejectedValueOnce(new Error('Compression failed'));

      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const fileInputs = screen.getAllByRole('button', { hidden: true }).filter(
        (el) => el.tagName === 'INPUT' && el.type === 'file'
      );
      const thumbnailInput = fileInputs[0];

      Object.defineProperty(thumbnailInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(thumbnailInput);

      await waitFor(() => {
        expect(screen.getByText('Unable to load thumbnail image. Please try a different file.')).toBeInTheDocument();
      });
    });

    it('handles colour image upload', async () => {
      const mockFile = new File(['dummy'], 'color.jpg', { type: 'image/jpeg' });

      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Add a colour
      fireEvent.click(screen.getByTestId('add-color-button'));

      // Get the color entry to find its localId
      const colorEntries = screen.getAllByTestId(/^color-entry-/);
      const colorEntry = colorEntries[0];
      const localId = colorEntry.dataset.testid.replace('color-entry-', '');

      const colorImageInput = screen.getByTestId(`color-image-${localId}`);
      Object.defineProperty(colorImageInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(colorImageInput);

      await waitFor(() => {
        expect(mockCompressImageFile).toHaveBeenCalledWith(mockFile, {
          maxDimension: 1600,
          quality: 0.82,
        });
      });
    });
  });

  describe('Advanced Features', () => {
    it('toggles advanced section', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const advancedButton = screen.getByText('Show advanced');
      fireEvent.click(advancedButton);

      expect(screen.getByText('Hide advanced')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Optional legacy reference')).toBeInTheDocument();
    });

    it('updates previous style number in advanced section', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      // Open advanced section
      fireEvent.click(screen.getByText('Show advanced'));

      const previousStyleInput = screen.getByPlaceholderText('Optional legacy reference');
      fireEvent.change(previousStyleInput, { target: { value: 'OLD-123' } });

      expect(previousStyleInput).toHaveValue('OLD-123');
    });
  });

  describe('Cancel Button', () => {
    it('calls onCancel when cancel button is clicked', () => {
      render(
        <ProductFamilyForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
