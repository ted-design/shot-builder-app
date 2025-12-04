/**
 * PdfPagePreview - Live PDF preview using async generation
 *
 * Uses @react-pdf/renderer's usePDF hook for non-blocking PDF generation.
 * The PDF is generated asynchronously and displayed in a native iframe,
 * preventing the "Page Unresponsive" errors caused by synchronous PDFViewer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Loader2, AlertCircle, FileWarning } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Error state display
 */
function PreviewError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Preview Error
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-md">
        {message || 'Failed to load PDF preview'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Loading state display
 */
function LoadingState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Generating Preview
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {message || 'Building your PDF document...'}
      </p>
    </div>
  );
}

/**
 * Empty state when no PDF is available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <FileWarning className="w-12 h-12 text-slate-400 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        No Preview Available
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Configure your export options to see a preview
      </p>
    </div>
  );
}

/**
 * Main PDF page preview component
 *
 * Uses usePDF hook from @react-pdf/renderer which:
 * - Generates PDF asynchronously (non-blocking)
 * - Returns a blob URL for native iframe display
 * - Prevents "Page Unresponsive" errors from synchronous rendering
 *
 * @param {Object} props
 * @param {React.ReactElement} props.document - The PDF document element to render
 * @param {string} props.error - Error message if there's an error
 * @param {Function} props.onRetry - Callback to retry on error
 * @param {string} props.className - Additional CSS classes
 */
export default function PdfPagePreview({
  document,
  error = null,
  onRetry,
  className,
}) {
  // Track previous URL for cleanup
  const previousUrlRef = useRef(null);
  // Track updating state for smooth transitions
  const [isUpdating, setIsUpdating] = useState(false);

  // Use the async usePDF hook - generates PDF without blocking main thread
  const [instance, updateInstance] = usePDF({ document });

  // Update the PDF when document changes
  useEffect(() => {
    if (document) {
      updateInstance(document);
    }
  }, [document, updateInstance]);

  // Handle smooth transition when PDF URL changes
  useEffect(() => {
    if (instance.url && instance.url !== previousUrlRef.current) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [instance.url]);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    if (previousUrlRef.current && previousUrlRef.current !== instance.url) {
      URL.revokeObjectURL(previousUrlRef.current);
    }
    previousUrlRef.current = instance.url;

    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, [instance.url]);

  // Handle external error prop
  if (error) {
    return <PreviewError message={error} onRetry={onRetry} />;
  }

  // Handle no document
  if (!document) {
    return <EmptyState />;
  }

  // Handle usePDF error
  if (instance.error) {
    return (
      <PreviewError
        message={instance.error?.message || 'Failed to generate PDF'}
        onRetry={onRetry}
      />
    );
  }

  // Handle loading state
  if (instance.loading || !instance.url) {
    return <LoadingState message="Building your PDF document..." />;
  }

  // Determine if we should show the loading overlay
  const showLoading = instance.loading || isUpdating;

  // Render PDF in native iframe for zero-overhead display
  return (
    <div className={cn('relative flex flex-col h-full', className)}>
      {/* Loading overlay with smooth fade */}
      <div
        className={cn(
          'absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-10 transition-opacity duration-200',
          showLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Updating preview...
          </span>
        </div>
      </div>

      <iframe
        src={instance.url}
        width="100%"
        height="100%"
        title="PDF Preview"
        className={cn(
          'flex-1 border-0 rounded-lg transition-opacity duration-200',
          isUpdating ? 'opacity-60' : 'opacity-100'
        )}
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
