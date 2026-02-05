// src/components/callsheet/export/CallSheetExportModal.jsx
// Modal for exporting call sheet to PDF
//
// EXPORT ARCHITECTURE:
// --------------------
// Print-to-PDF is orchestrated by the print portal component:
//   src/components/callsheet/print/CallSheetPrintPortal.tsx
//
// This modal only collects the user intent (click “Print to PDF”) and then
// requests a print job from the parent.

import React, { useCallback } from "react";
import { X, Clock, Users, Printer } from "lucide-react";
import { Button } from "../../ui/button";

function CallSheetExportModal({
  isOpen,
  onClose,
  onRequestPrint,
  schedule,
  entries = [],
  tracks = [],
}) {
  const handlePrint = useCallback(() => {
    onRequestPrint?.();
    onClose?.();
  }, [onClose, onRequestPrint]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="export-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Export Call Sheet
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Summary */}
          <div className="mb-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
              {schedule?.name || "Call Sheet"}
            </h3>
            <div className="space-y-1 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {entries.length} entries
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                {tracks.length} tracks
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-slate-500">
              Printing uses the on-screen renderer for WYSIWYG parity.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handlePrint}
              className="w-full gap-2"
            >
              <Printer className="h-4 w-4" />
              Print to PDF
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              For full color fidelity, enable “Background graphics” in the print options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallSheetExportModal;

