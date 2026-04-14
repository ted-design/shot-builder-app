/**
 * ExportProgressModal - Shows progress during PDF export with images
 *
 * Displays a modal with:
 * - Progress bar with percentage
 * - Current stage indicator (resolving URLs, processing images, rendering PDF)
 * - Cancel button
 * - Smooth animations
 */

import React from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

const STAGE_INFO = {
  idle: {
    icon: ImageIcon,
    label: 'Preparing...',
    color: 'text-slate-500',
  },
  resolving: {
    icon: Loader2,
    label: 'Resolving image URLs',
    color: 'text-blue-500',
    animate: true,
  },
  processing: {
    icon: Loader2,
    label: 'Processing images',
    color: 'text-blue-500',
    animate: true,
  },
  rendering: {
    icon: Loader2,
    label: 'Rendering PDF',
    color: 'text-blue-500',
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    color: 'text-green-500',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    color: 'text-red-500',
  },
};

export default function ExportProgressModal({
  open,
  onCancel,
  progress,
  className,
}) {
  if (!open) return null;

  const {
    current = 0,
    total = 0,
    percentage = 0,
    stage = 'idle',
    message = '',
  } = progress || {};

  const stageInfo = STAGE_INFO[stage] || STAGE_INFO.idle;
  const StageIcon = stageInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={stage === 'error' ? onCancel : undefined}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl',
          'w-full max-w-md mx-4 p-6',
          'transform transition-all duration-200',
          className
        )}
      >
        {/* Close button - only show for error state */}
        {stage === 'error' && onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={cn('p-2 rounded-lg bg-slate-100 dark:bg-slate-800', stageInfo.color)}>
            <StageIcon
              className={cn('w-6 h-6', stageInfo.animate && 'animate-spin')}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Exporting PDF
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stageInfo.label}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600 dark:text-slate-400">
              {message || `${current} of ${total}`}
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {percentage}%
            </span>
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 ease-out',
                stage === 'error'
                  ? 'bg-red-500'
                  : stage === 'complete'
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              )}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>

        {/* Stage breakdown */}
        <div className="space-y-2 mb-6">
          <StageIndicator
            label="Resolve image URLs"
            isActive={stage === 'resolving'}
            isComplete={['processing', 'rendering', 'complete'].includes(stage)}
            isError={stage === 'error' && percentage < 30}
          />
          <StageIndicator
            label="Process images"
            isActive={stage === 'processing'}
            isComplete={['rendering', 'complete'].includes(stage)}
            isError={stage === 'error' && percentage >= 30 && percentage < 95}
          />
          <StageIndicator
            label="Generate PDF"
            isActive={stage === 'rendering'}
            isComplete={stage === 'complete'}
            isError={stage === 'error' && percentage >= 95}
          />
        </div>

        {/* Cancel button */}
        {stage !== 'complete' && stage !== 'error' && onCancel && (
          <button
            onClick={onCancel}
            className={cn(
              'w-full py-2.5 px-4 rounded-lg font-medium',
              'border border-slate-300 dark:border-slate-600',
              'text-slate-700 dark:text-slate-300',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors'
            )}
          >
            Cancel
          </button>
        )}

        {/* Close button for complete state */}
        {stage === 'complete' && onCancel && (
          <button
            onClick={onCancel}
            className={cn(
              'w-full py-2.5 px-4 rounded-lg font-medium',
              'bg-green-500 text-white',
              'hover:bg-green-600',
              'transition-colors'
            )}
          >
            Done
          </button>
        )}

        {/* Retry/Close for error state */}
        {stage === 'error' && onCancel && (
          <button
            onClick={onCancel}
            className={cn(
              'w-full py-2.5 px-4 rounded-lg font-medium',
              'bg-slate-100 dark:bg-slate-800',
              'text-slate-700 dark:text-slate-300',
              'hover:bg-slate-200 dark:hover:bg-slate-700',
              'transition-colors'
            )}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

function StageIndicator({ label, isActive, isComplete, isError }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center',
          'transition-colors duration-200',
          isError
            ? 'bg-red-100 dark:bg-red-900/30'
            : isComplete
            ? 'bg-green-100 dark:bg-green-900/30'
            : isActive
            ? 'bg-blue-100 dark:bg-blue-900/30'
            : 'bg-slate-100 dark:bg-slate-800'
        )}
      >
        {isError ? (
          <AlertCircle className="w-3 h-3 text-red-500" />
        ) : isComplete ? (
          <CheckCircle className="w-3 h-3 text-green-500" />
        ) : isActive ? (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
      </div>
      <span
        className={cn(
          'transition-colors duration-200',
          isError
            ? 'text-red-600 dark:text-red-400'
            : isComplete
            ? 'text-green-600 dark:text-green-400'
            : isActive
            ? 'text-blue-600 dark:text-blue-400 font-medium'
            : 'text-slate-400 dark:text-slate-500'
        )}
      >
        {label}
      </span>
    </div>
  );
}
