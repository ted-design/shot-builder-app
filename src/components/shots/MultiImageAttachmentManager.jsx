import { useState, useCallback, useRef } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { nanoid } from "nanoid";
import AttachmentThumbnail from "./AttachmentThumbnail";
import { uploadImageFile } from "../../lib/firebase";
import { compressImageFile } from "../../lib/images";

/**
 * MultiImageAttachmentManager - Manage multiple image attachments with drag-drop reordering
 *
 * @param {Object} props
 * @param {Array} props.attachments - Array of attachment objects
 * @param {Function} props.onChange - Callback when attachments change
 * @param {boolean} props.disabled - Disable all controls
 * @param {string} props.userId - Current user ID for uploadedBy
 * @param {string} props.clientId - Client ID for storage path
 * @param {string} props.shotId - Shot ID for storage path
 * @param {Function} props.onEditAttachment - Callback to open crop editor
 */

// Maximum attachments per shot
const MAX_ATTACHMENTS = 10;

// Maximum file size: 50MB
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

// Allowed image types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Error messages
const ERROR_MESSAGES = {
  INVALID_TYPE: "Invalid file type. Please select an image file (JPEG, PNG, WebP, or GIF).",
  FILE_TOO_LARGE: (fileSizeMB, maxSizeMB) =>
    `File is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
  MAX_ATTACHMENTS: `Maximum ${MAX_ATTACHMENTS} attachments allowed.`,
  UPLOAD_FAILED: "Failed to upload image. Please try again.",
  COMPRESSION_FAILED: "Failed to process image. Please try a different file.",
};

export default function MultiImageAttachmentManager({
  attachments = [],
  onChange,
  disabled = false,
  userId,
  clientId,
  shotId,
  onEditAttachment,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Drag sensors for @dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Validate file
  const validateFile = useCallback((file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return ERROR_MESSAGES.INVALID_TYPE;
    }

    if (file.size > DEFAULT_MAX_SIZE) {
      const maxSizeMB = (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(0);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      return ERROR_MESSAGES.FILE_TOO_LARGE(fileSizeMB, maxSizeMB);
    }

    return null;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file) => {
      if (!file || disabled || isUploading) return;

      // Check max attachments
      if (attachments.length >= MAX_ATTACHMENTS) {
        setError(ERROR_MESSAGES.MAX_ATTACHMENTS);
        return;
      }

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      setIsUploading(true);

      try {
        // Compress image
        const compressedFile = await compressImageFile(file, {
          maxDimension: 1600,
          quality: 0.82,
        });

        // Upload to Firebase Storage
        const { downloadURL, path } = await uploadImageFile(compressedFile, {
          folder: "shots",
          id: shotId || "temp",
          filename: `${Date.now()}-${file.name}`,
        });

        // Create attachment object
        const newAttachment = {
          id: nanoid(),
          path,
          downloadURL,
          isPrimary: attachments.length === 0, // First attachment is primary
          cropData: null,
          uploadedAt: Date.now(),
          uploadedBy: userId,
          order: attachments.length,
        };

        // Add to attachments array
        onChange([...attachments, newAttachment]);
      } catch (err) {
        console.error("Upload error:", err);
        const errorMsg =
          err.message?.includes("compress") || err.message?.includes("process")
            ? ERROR_MESSAGES.COMPRESSION_FAILED
            : ERROR_MESSAGES.UPLOAD_FAILED;
        setError(errorMsg);
      } finally {
        setIsUploading(false);
      }
    },
    [attachments, disabled, isUploading, onChange, userId, shotId, validateFile]
  );

  // Handle file selection
  const handleFileSelection = useCallback(
    (file) => {
      if (!file) return;
      handleFileUpload(file);
    },
    [handleFileUpload]
  );

  // Handle drag enter
  const handleDragEnter = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (disabled || isUploading || attachments.length >= MAX_ATTACHMENTS) return;

      dragCounterRef.current += 1;
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading, attachments.length]
  );

  // Handle drag leave
  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled || isUploading || attachments.length >= MAX_ATTACHMENTS) return;

      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
    },
    [disabled, isUploading, attachments.length, handleFileSelection]
  );

  // Handle click to browse
  const handleClickBrowse = useCallback(() => {
    if (disabled || isUploading || attachments.length >= MAX_ATTACHMENTS) return;
    fileInputRef.current?.click();
  }, [disabled, isUploading, attachments.length]);

  // Handle input change
  const handleInputChange = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
      // Reset input
      event.target.value = "";
    },
    [handleFileSelection]
  );

  // Handle drag end (reordering)
  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
        const oldIndex = attachments.findIndex((a) => a.id === active.id);
        const newIndex = attachments.findIndex((a) => a.id === over.id);

        const reordered = arrayMove(attachments, oldIndex, newIndex);
        // Update order property
        const updated = reordered.map((attachment, index) => ({
          ...attachment,
          order: index,
        }));
        onChange(updated);
      }
    },
    [attachments, onChange]
  );

  // Handle delete
  const handleDelete = useCallback(
    (attachmentId) => {
      const updated = attachments
        .filter((a) => a.id !== attachmentId)
        .map((attachment, index) => ({
          ...attachment,
          order: index,
          // If deleted attachment was primary, make first one primary
          isPrimary:
            index === 0 ? true : attachment.isPrimary && attachment.id !== attachmentId ? true : attachment.isPrimary,
        }));
      onChange(updated);
    },
    [attachments, onChange]
  );

  // Handle set primary
  const handleSetPrimary = useCallback(
    (attachmentId) => {
      const updated = attachments.map((attachment) => ({
        ...attachment,
        isPrimary: attachment.id === attachmentId,
      }));
      onChange(updated);
    },
    [attachments, onChange]
  );

  // Handle edit
  const handleEdit = useCallback(
    (attachment) => {
      if (onEditAttachment) {
        onEditAttachment(attachment);
      }
    },
    [onEditAttachment]
  );

  const canUpload = !disabled && !isUploading && attachments.length < MAX_ATTACHMENTS;

  return (
    <div className="space-y-4">
      {/* Attachments Grid */}
      {attachments.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={attachments.map((a) => a.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {attachments.map((attachment, index) => (
                <AttachmentThumbnail
                  key={attachment.id}
                  attachment={attachment}
                  index={index + 1}
                  onDelete={() => handleDelete(attachment.id)}
                  onSetPrimary={() => handleSetPrimary(attachment.id)}
                  onEdit={() => handleEdit(attachment)}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Upload Dropzone */}
      {canUpload && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickBrowse}
          className={`
            flex min-h-[120px] cursor-pointer flex-col items-center justify-center
            rounded-lg border-2 border-dashed p-6 transition-colors
            ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-primary"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={!canUpload}
          />

          <Upload className={`mb-2 h-8 w-8 ${isDragging ? "text-primary" : "text-slate-400"}`} />

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {isUploading ? (
              <span className="font-medium">Uploading image...</span>
            ) : (
              <>
                <span className="font-medium text-primary">Click to upload</span>
                {" or drag and drop"}
                <br />
                <span className="text-xs text-slate-500">
                  PNG, JPG, WebP, or GIF (max 50MB)
                  <br />
                  {MAX_ATTACHMENTS - attachments.length} of {MAX_ATTACHMENTS} remaining
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Max Attachments Message */}
      {attachments.length >= MAX_ATTACHMENTS && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Maximum of {MAX_ATTACHMENTS} attachments reached. Delete an attachment to add more.
        </div>
      )}
    </div>
  );
}
