import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import BatchImageUploader from "./BatchImageUploader";

/**
 * BatchImageUploadModal - Modal wrapper for batch image uploads
 *
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close modal callback
 * @param {string} props.folder - Firebase storage folder (e.g., "products", "talent")
 * @param {string} props.entityId - Entity ID for organizing uploads
 * @param {string} props.entityName - Entity name for display (e.g., "Product Colorways", "Talent Headshots")
 * @param {Function} props.onUploadComplete - Callback when all uploads complete
 * @param {Function} props.onFileUploaded - Callback for each successful upload (optional)
 * @param {number} props.maxFiles - Maximum number of files allowed (default: 10)
 */
export default function BatchImageUploadModal({
  open,
  onClose,
  folder,
  entityId,
  entityName = "Images",
  onUploadComplete,
  onFileUploaded,
  maxFiles = 10,
}) {
  const [uploadsCompleted, setUploadsCompleted] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setUploadsCompleted(false);
    }
  }, [open]);

  const handleUploadComplete = (successfulUploads) => {
    setUploadsCompleted(true);
    if (onUploadComplete) {
      onUploadComplete(successfulUploads);
    }
  };

  const handleClose = () => {
    if (uploadsCompleted) {
      // If uploads completed, close immediately
      onClose?.();
    } else {
      // Otherwise, just close (user can cancel during upload)
      onClose?.();
    }
  };

  const modalTitleId = "batch-upload-title";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      labelledBy={modalTitleId}
      contentClassName="p-0 max-h-[90vh] overflow-y-auto max-w-4xl"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 id={modalTitleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upload {entityName}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Drag and drop multiple images or click to browse. Images will be automatically compressed before upload.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <BatchImageUploader
            folder={folder}
            entityId={entityId}
            onUploadComplete={handleUploadComplete}
            onFileUploaded={onFileUploaded}
            maxFiles={maxFiles}
          />

          {uploadsCompleted && (
            <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 p-4 text-center">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                ✓ Upload complete! You can close this dialog or upload more files.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {uploadsCompleted ? "Done" : "Cancel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
