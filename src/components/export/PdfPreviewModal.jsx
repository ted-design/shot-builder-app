/**
 * PdfPreviewModal - Live PDF preview with react-pdf's PDFViewer
 *
 * Shows the exact PDF output with:
 * - Real page navigation
 * - Zoom controls
 * - Full pagination accuracy
 */

import React, { useState, useCallback } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Button } from '../ui/button';

/**
 * @typedef {Object} PdfPreviewModalProps
 * @property {boolean} isOpen - Whether the modal is open
 * @property {() => void} onClose - Callback to close the modal
 * @property {React.ReactElement} pdfDocument - The PDF document element to preview
 * @property {string} filename - Filename for download
 * @property {boolean} [isGenerating] - Whether PDF is being generated
 */

export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfDocument,
  filename = 'export.pdf',
  isGenerating = false,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 50));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-[95vw] h-[90vh] max-w-6xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              PDF Preview
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="w-12 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>

            {/* Download button */}
            {pdfDocument && (
              <PDFDownloadLink
                document={pdfDocument}
                fileName={filename}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {({ loading }) => (
                  <>
                    <Download className="w-4 h-4" />
                    {loading ? 'Preparing...' : 'Download'}
                  </>
                )}
              </PDFDownloadLink>
            )}

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 ml-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Generating PDF preview...
                </p>
              </div>
            </div>
          ) : pdfDocument ? (
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={false}
              style={{
                border: 'none',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center top',
              }}
            >
              {pdfDocument}
            </PDFViewer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 dark:text-slate-400">
                No PDF document to preview
              </p>
            </div>
          )}
        </div>

        {/* Footer with tips */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            This preview shows the exact PDF output. Use the PDF viewer&apos;s built-in navigation for page controls.
          </p>
        </div>
      </div>
    </div>
  );
}
