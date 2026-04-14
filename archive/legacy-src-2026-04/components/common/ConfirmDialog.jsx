import React from "react";
import { AlertTriangle, X } from "lucide-react";
import Modal from "../ui/modal";
import { Button } from "../ui/button";

/**
 * ConfirmDialog - A reusable confirmation dialog
 *
 * Features:
 * - Customizable title, message, and button labels
 * - Optional warning variant with icon
 * - Keyboard accessible (Escape to cancel, Enter to confirm)
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Callback to close the dialog
 * @param {Function} props.onConfirm - Callback when user confirms
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message/description
 * @param {string} props.confirmLabel - Confirm button label (default: "Confirm")
 * @param {string} props.cancelLabel - Cancel button label (default: "Cancel")
 * @param {string} props.variant - Visual variant: "default" or "destructive" (default: "default")
 * @param {boolean} props.loading - Whether the confirm action is loading
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}) {
  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const isDestructive = variant === "destructive";

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="confirm-dialog-title"
      describedBy="confirm-dialog-message"
      contentClassName="max-w-md"
    >
      <div className="flex flex-col" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="mt-0.5 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            )}
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p
            id="confirm-dialog-message"
            className="text-sm text-slate-600 dark:text-slate-400"
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
