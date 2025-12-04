/**
 * ExportImageStatus - Shows image loading progress and failure status
 *
 * This component displays:
 * - Loading progress bar during image pre-loading
 * - List of failed images with retry/skip options
 * - Overall status summary
 *
 * The export button should be disabled until this component reports readiness.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';

/**
 * @typedef {Object} ImageEntry
 * @property {string} shotId
 * @property {string} shotName
 * @property {string} source
 * @property {'pending' | 'loading' | 'ready' | 'failed' | 'skipped'} status
 * @property {string | null} dataUrl
 * @property {string | null} error
 * @property {number} retryCount
 */

/**
 * @typedef {Object} ExportImageStatusProps
 * @property {boolean} isLoading - Whether images are currently loading
 * @property {{ loaded: number; total: number; failed: number }} progress - Loading progress
 * @property {ImageEntry[]} failedImages - Array of failed image entries
 * @property {boolean} isReadyForExport - Whether export can proceed
 * @property {(shotId: string) => Promise<void>} onRetry - Retry a single image
 * @property {(shotId: string) => void} onSkip - Skip a single image
 * @property {() => void} onSkipAll - Skip all failed images
 * @property {() => Promise<void>} onRetryAll - Retry all failed images
 * @property {boolean} [includeImages] - Whether images are included in export
 */

/**
 * Progress bar component
 */
function ProgressBar({ progress, isLoading }) {
  const { loaded, total, failed } = progress;
  const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const successCount = loaded - (total > 0 ? failed : 0);

  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-400">
          {isLoading ? 'Loading images...' : 'Images loaded'}
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {loaded}/{total}
          {failed > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
              ({failed} failed)
            </span>
          )}
        </span>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            failed > 0
              ? 'bg-amber-500'
              : isLoading
                ? 'bg-blue-500'
                : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Single failed image row
 */
function FailedImageRow({ image, onRetry, onSkip, isRetrying }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center">
          <ImageOff className="w-4 h-4 text-slate-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            {image.shotName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {image.error || 'Failed to load'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRetry(image.shotId)}
          disabled={isRetrying || image.retryCount >= 2}
          className="h-8 px-2"
        >
          {isRetrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-1 text-xs">Retry</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSkip(image.shotId)}
          className="h-8 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
          <span className="ml-1 text-xs">Skip</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Main ExportImageStatus component
 */
export default function ExportImageStatus({
  isLoading,
  progress,
  failedImages,
  isReadyForExport,
  onRetry,
  onSkip,
  onSkipAll,
  onRetryAll,
  includeImages = true,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  // Don't show anything if images aren't included
  if (!includeImages) return null;

  // Don't show if no images to load
  if (progress.total === 0) return null;

  const hasFailures = failedImages.length > 0;
  const isComplete = !isLoading && progress.loaded === progress.total;

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    try {
      await onRetryAll();
    } finally {
      setIsRetryingAll(false);
    }
  };

  // Compact success state
  if (isComplete && !hasFailures) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          All {progress.total} images loaded successfully
        </span>
      </div>
    );
  }

  // Loading or failure state
  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        hasFailures
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : hasFailures ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isLoading
                ? 'Loading images for export...'
                : hasFailures
                  ? `${failedImages.length} image${failedImages.length === 1 ? '' : 's'} failed to load`
                  : 'Images ready'}
            </span>
          </div>

          {hasFailures && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(isLoading || !isComplete) && (
          <div className="mt-3">
            <ProgressBar progress={progress} isLoading={isLoading} />
          </div>
        )}
      </div>

      {/* Failed images list */}
      {hasFailures && isExpanded && (
        <div className="border-t border-amber-200 dark:border-amber-800">
          {/* Actions bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-amber-100/50 dark:bg-amber-900/30">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Export is blocked until all images are loaded or skipped
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryAll}
                disabled={isRetryingAll}
                className="h-7 text-xs"
              >
                {isRetryingAll ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Retry All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkipAll}
                className="h-7 text-xs text-slate-600 dark:text-slate-400"
              >
                Skip All
              </Button>
            </div>
          </div>

          {/* Image list */}
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {failedImages.map((image) => (
              <FailedImageRow
                key={image.shotId}
                image={image}
                onRetry={onRetry}
                onSkip={onSkip}
                isRetrying={image.status === 'loading'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Export blocked warning */}
      {!isReadyForExport && !isLoading && hasFailures && (
        <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/40 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
            PDF export is disabled until all images are resolved. Retry failed images or skip them to proceed.
          </p>
        </div>
      )}
    </div>
  );
}
