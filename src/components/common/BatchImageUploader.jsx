import { useCallback, useEffect, useRef, useState } from "react";
import { X, Upload, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { compressImageFile, formatFileSize } from "../../lib/images";
import { uploadImageFile } from "../../lib/firebase";

/**
 * BatchImageUploader - A component for uploading multiple images with drag & drop
 *
 * Features:
 * - Drag & drop zone for multiple files
 * - Individual file previews with compression
 * - Upload progress tracking per file
 * - Error handling per file
 * - Auto-compression before upload
 *
 * @param {Object} props
 * @param {string} props.folder - Firebase storage folder (e.g., "products", "talent")
 * @param {string} props.entityId - Entity ID for organizing uploads
 * @param {Function} props.onUploadComplete - Callback when all uploads complete
 * @param {Function} props.onFileUploaded - Callback for each successful upload
 * @param {number} props.maxFiles - Maximum number of files allowed (default: 10)
 * @param {boolean} props.disabled - Disable the uploader
 */
// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Whitelist of safe image formats
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

export default function BatchImageUploader({
  folder,
  entityId,
  onUploadComplete,
  onFileUploaded,
  maxFiles = 10,
  disabled = false,
}) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const isMountedRef = useRef(true);

  // File status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error'
  const getFileId = (file) => `${file.name}-${file.size}-${file.lastModified}`;

  const addFiles = useCallback(
    (newFiles) => {
      if (disabled) return;

      // Filter files: whitelist safe types and check file size
      const fileArray = Array.from(newFiles).filter((file) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
          console.warn(`Skipped unsupported file type: ${file.name} (${file.type})`);
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`Skipped file exceeding ${MAX_FILE_SIZE / 1024 / 1024}MB: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          return false;
        }
        return true;
      });

      if (fileArray.length === 0) return;

      const remainingSlots = maxFiles - files.length;
      const filesToAdd = fileArray.slice(0, remainingSlots);

      const fileObjects = filesToAdd.map((file) => ({
        id: getFileId(file),
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
        progress: 0,
        error: null,
        compressedSize: null,
        uploadedPath: null,
      }));

      setFiles((prev) => [...prev, ...fileObjects]);
    },
    [files.length, maxFiles, disabled]
  );

  const removeFile = useCallback((fileId) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      setIsDragging(false);
      dragCounterRef.current = 0;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles, disabled]
  );

  const handleFileInputChange = useCallback(
    (e) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        addFiles(selectedFiles);
      }
      // Reset input so the same file can be selected again
      if (e.target) {
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const uploadFile = useCallback(
    async (fileObj) => {
      try {
        // Step 1: Compress
        if (!isMountedRef.current) return { success: false, error: new Error("Component unmounted") };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "compressing", progress: 0 }
              : f
          )
        );

        const compressed = await compressImageFile(fileObj.file, {
          maxDimension: 1600,
          quality: 0.82,
        });

        // Step 2: Upload
        if (!isMountedRef.current) return { success: false, error: new Error("Component unmounted") };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "uploading", progress: 0, compressedSize: compressed.size }
              : f
          )
        );

        const { path, downloadURL } = await uploadImageFile(compressed, {
          folder,
          id: entityId,
          filename: compressed.name,
        });

        // Step 3: Success
        if (!isMountedRef.current) return { success: false, error: new Error("Component unmounted") };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "success", progress: 100, uploadedPath: path }
              : f
          )
        );

        // Notify parent
        if (onFileUploaded) {
          onFileUploaded({ path, downloadURL, filename: compressed.name });
        }

        return { success: true, path, downloadURL };
      } catch (error) {
        console.error("Failed to upload file:", fileObj.file.name, error);

        // Revoke blob URL on error to prevent memory leak
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }

        if (!isMountedRef.current) return { success: false, error };

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "error", error: error.message || "Upload failed" }
              : f
          )
        );
        return { success: false, error };
      }
    },
    [folder, entityId, onFileUploaded]
  );

  const uploadAll = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");

    if (pendingFiles.length === 0) return;

    // Upload files sequentially to avoid overwhelming the connection
    const results = [];
    for (const file of pendingFiles) {
      const result = await uploadFile(file);
      results.push(result);
    }

    // Notify parent when all uploads complete
    if (onUploadComplete) {
      const successfulUploads = results.filter((r) => r.success);
      onUploadComplete(successfulUploads);
    }
  }, [files, uploadFile, onUploadComplete]);

  // Cleanup previews on unmount and track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadingCount = files.filter((f) => f.status === "uploading" || f.status === "compressing").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50"}
          ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50 hover:bg-primary/5"}
          ${files.length >= maxFiles ? "cursor-not-allowed opacity-50" : ""}
        `}
        onClick={() => !disabled && files.length < maxFiles && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || files.length >= maxFiles}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-base font-medium text-slate-900">
              {isDragging ? "Drop images here" : "Drag & drop images or click to browse"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {files.length >= maxFiles
                ? `Maximum of ${maxFiles} files reached`
                : `Upload up to ${maxFiles - files.length} more image${maxFiles - files.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">
              Files ({files.length})
              {successCount > 0 && <span className="ml-2 text-emerald-600">✓ {successCount} uploaded</span>}
              {errorCount > 0 && <span className="ml-2 text-red-600">✗ {errorCount} failed</span>}
            </h3>
            {pendingCount > 0 && (
              <Button size="sm" onClick={uploadAll} disabled={disabled || uploadingCount > 0}>
                {uploadingCount > 0 ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${pendingCount} file${pendingCount === 1 ? "" : "s"}`
                )}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((fileObj) => (
              <FilePreviewCard
                key={fileObj.id}
                fileObj={fileObj}
                onRemove={() => removeFile(fileObj.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilePreviewCard({ fileObj, onRemove, disabled }) {
  const { file, preview, status, error, compressedSize } = fileObj;

  const statusConfig = {
    pending: { icon: ImageIcon, color: "text-slate-500", bg: "bg-slate-50" },
    compressing: { icon: LoadingSpinner, color: "text-blue-600", bg: "bg-blue-50" },
    uploading: { icon: LoadingSpinner, color: "text-blue-600", bg: "bg-blue-50" },
    success: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    error: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-lg border ${config.bg} border-slate-200`}>
      {/* Preview Image */}
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        <img src={preview} alt={file.name} className="h-full w-full object-cover" />
      </div>

      {/* File Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-slate-500">
              {formatFileSize(compressedSize || file.size)}
              {compressedSize && compressedSize < file.size && (
                <span className="ml-1 text-emerald-600">
                  (saved {formatFileSize(file.size - compressedSize)})
                </span>
              )}
            </p>
          </div>

          {/* Remove Button */}
          {status !== "uploading" && status !== "compressing" && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className={`flex items-center gap-2 text-xs font-medium ${config.color}`}>
          <StatusIcon className="h-4 w-4" />
          <span>
            {status === "pending" && "Ready to upload"}
            {status === "compressing" && "Compressing..."}
            {status === "uploading" && "Uploading..."}
            {status === "success" && "Uploaded"}
            {status === "error" && (error || "Upload failed")}
          </span>
        </div>
      </div>
    </div>
  );
}
