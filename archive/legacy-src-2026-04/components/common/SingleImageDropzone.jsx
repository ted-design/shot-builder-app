import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "../ui/button";

/**
 * SingleImageDropzone - A component for single image upload with drag & drop
 *
 * Features:
 * - Drag & drop zone with visual feedback
 * - Click-to-browse fallback
 * - File type and size validation
 * - Optional image preview
 * - Accessible keyboard navigation
 *
 * @param {Object} props
 * @param {Function} props.onChange - Callback when file is selected (receives File or null)
 * @param {File|null} props.value - Current file value
 * @param {string} props.accept - Accepted file types (default: "image/*")
 * @param {number} props.maxSize - Max file size in bytes (default: 50MB)
 * @param {boolean} props.disabled - Disable the dropzone
 * @param {boolean} props.showPreview - Show image preview (default: true)
 * @param {string} props.className - Additional CSS classes for container
 * @param {string} props.previewClassName - Additional CSS classes for preview
 * @param {string|null} props.existingImageUrl - URL of existing image to display
 * @param {Function} props.onRemoveExisting - Callback when existing image is removed
 */

// Maximum file size: 50MB
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

// Whitelist of safe image formats
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Error messages (centralized for easier maintenance and future i18n)
const ERROR_MESSAGES = {
  INVALID_TYPE: 'Invalid file type. Please select an image file (JPEG, PNG, WebP, or GIF).',
  FILE_TOO_LARGE: (fileSizeMB, maxSizeMB) =>
    `File is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
};

export default function SingleImageDropzone({
  onChange,
  value = null,
  accept = "image/*",
  maxSize = DEFAULT_MAX_SIZE,
  disabled = false,
  showPreview = true,
  className = "",
  previewClassName = "",
  existingImageUrl = null,
  onRemoveExisting,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Generate preview URL when file changes
  // Note: Memory management is handled by cleanup function which captures the URL in its closure
  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      // Cleanup: Revoke the object URL to free memory
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      // No cleanup needed when value is null
      return undefined;
    }
  }, [value]);

  const validateFile = useCallback((file) => {
    // Check file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return ERROR_MESSAGES.INVALID_TYPE;
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      return ERROR_MESSAGES.FILE_TOO_LARGE(fileSizeMB, maxSizeMB);
    }

    return null;
  }, [maxSize]);

  const handleFileSelection = useCallback((file) => {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    onChange?.(file);
  }, [onChange, validateFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelection(droppedFiles[0]);
    }
  }, [disabled, handleFileSelection]);

  const handleFileInputChange = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
    // Reset input so the same file can be selected again
    if (e.target) {
      e.target.value = "";
    }
  }, [handleFileSelection]);

  const handleRemove = useCallback(() => {
    setError("");
    onChange?.(null);
  }, [onChange]);

  const handleRemoveExistingImage = useCallback(() => {
    onRemoveExisting?.();
  }, [onRemoveExisting]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const displayPreview = showPreview && (previewUrl || existingImageUrl);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative rounded-card border-2 border-dashed p-6 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50"}
          ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10"}
        `}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload image"
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-primary/10 p-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {isDragging ? "Drop image here" : "Drag & drop or click to browse"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              JPEG, PNG, WebP, or GIF • Max {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {displayPreview && (
        <div className={`relative inline-block ${previewClassName}`}>
          <img
            src={previewUrl || existingImageUrl}
            alt="Preview"
            className="rounded-card border border-slate-200 dark:border-slate-700 object-cover max-h-40"
          />
          {value && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="mt-2"
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
          {!value && existingImageUrl && onRemoveExisting && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRemoveExistingImage}
              disabled={disabled}
              className="mt-2"
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      )}

      {/* File Info */}
      {value && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">{value.name}</span>
          <span className="ml-2">({(value.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
