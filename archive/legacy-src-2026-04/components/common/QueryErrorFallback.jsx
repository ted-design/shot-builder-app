/**
 * QueryErrorFallback
 *
 * Fallback UI shown when a TanStack Query reports an error state.
 * Provides a calm error message with a "Retry" action button.
 * In DEV mode, shows debug information to help diagnose issues.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

const IS_DEV = import.meta.env.DEV;

/**
 * @param {object} props
 * @param {string} props.title - Title message (default: "Unable to load data")
 * @param {string} props.subtitle - Subtitle message
 * @param {function} props.onRetry - Callback for retry action (typically refetch())
 * @param {boolean} props.retrying - Whether retry is in progress
 * @param {object} props.debugInfo - Debug information for DEV mode
 * @param {string} props.variant - 'card' (for main content) or 'inline' (for sidebar)
 */
export function QueryErrorFallback({
  title = 'Unable to load data',
  subtitle = 'Something went wrong. Please try again.',
  onRetry,
  retrying = false,
  debugInfo = {},
  variant = 'card',
}) {
  const isInline = variant === 'inline';

  if (isInline) {
    return (
      <div className="px-3 py-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white hover:bg-sidebar-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        )}

        {IS_DEV && <DevDebugBlock debugInfo={debugInfo} variant="inline" />}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </p>

          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="mt-3"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : 'Try Again'}
            </Button>
          )}
        </div>
      </div>

      {IS_DEV && <DevDebugBlock debugInfo={debugInfo} variant="card" />}
    </div>
  );
}

/**
 * DevDebugBlock - DEV-only debug information
 * Hidden in production builds via IS_DEV check
 */
function DevDebugBlock({ debugInfo, variant }) {
  const {
    clientId,
    resolvedClientId,
    queryKey,
    enabled,
    isLoading,
    isFetching,
    isError,
    errorMessage,
    elapsedMs,
  } = debugInfo;

  const isInline = variant === 'inline';

  const formatMs = (ms) => {
    if (!ms) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isInline) {
    return (
      <details className="mt-3 text-left">
        <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-400 flex items-center gap-1">
          <ChevronDown className="h-3 w-3" />
          DEV Debug
        </summary>
        <div className="mt-2 p-2 bg-neutral-900 rounded text-xs font-mono text-neutral-400 space-y-1">
          <div>clientId: {clientId || 'null'}</div>
          <div>resolved: {resolvedClientId || 'null'}</div>
          <div>enabled: {String(enabled)}</div>
          <div>isLoading: {String(isLoading)}</div>
          <div>isFetching: {String(isFetching)}</div>
          <div className="text-red-400">isError: {String(isError)}</div>
          {errorMessage && <div className="text-red-400">error: {errorMessage}</div>}
          <div>elapsed: {formatMs(elapsedMs)}</div>
        </div>
      </details>
    );
  }

  return (
    <details className="mt-4 border-t border-amber-200 dark:border-amber-800/50 pt-4">
      <summary className="cursor-pointer text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        DEV Debug Info
      </summary>
      <div className="mt-3 p-3 bg-white dark:bg-neutral-900 rounded-md text-xs font-mono space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-neutral-500">clientId:</span>
          <span className="text-neutral-700 dark:text-neutral-300">{clientId || 'null'}</span>

          <span className="text-neutral-500">resolvedClientId:</span>
          <span className="text-neutral-700 dark:text-neutral-300">{resolvedClientId || 'null'}</span>

          <span className="text-neutral-500">queryKey:</span>
          <span className="text-neutral-700 dark:text-neutral-300 break-all">
            {queryKey ? JSON.stringify(queryKey) : 'null'}
          </span>

          <span className="text-neutral-500">enabled:</span>
          <span className={enabled ? 'text-green-600' : 'text-red-500'}>
            {String(enabled)}
          </span>

          <span className="text-neutral-500">isLoading:</span>
          <span className={isLoading ? 'text-amber-600' : 'text-neutral-700 dark:text-neutral-300'}>
            {String(isLoading)}
          </span>

          <span className="text-neutral-500">isFetching:</span>
          <span className={isFetching ? 'text-amber-600' : 'text-neutral-700 dark:text-neutral-300'}>
            {String(isFetching)}
          </span>

          <span className="text-neutral-500">isError:</span>
          <span className="text-red-500">{String(isError)}</span>

          <span className="text-neutral-500">elapsed:</span>
          <span className="text-neutral-700 dark:text-neutral-300">{formatMs(elapsedMs)}</span>
        </div>

        {errorMessage && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
            Error: {errorMessage}
          </div>
        )}
      </div>
    </details>
  );
}

export default QueryErrorFallback;
