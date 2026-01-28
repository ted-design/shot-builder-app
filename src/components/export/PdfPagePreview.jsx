/**
 * PdfPagePreview - Live PDF preview with circuit-breaker protection
 *
 * Uses @react-pdf/renderer's usePDF hook for non-blocking PDF generation.
 * Includes stability features to prevent Chrome freezing:
 *
 * 1. SETTLED CHANGES - Only regenerates after settings stabilize (500ms)
 * 2. HARD THROTTLE - Minimum 1500ms between regenerations
 * 3. CIRCUIT BREAKER - Auto-pauses if:
 *    - Regen duration > 1200ms, OR
 *    - More than 3 regens in 10 seconds
 * 4. MANUAL CONTROL - User can pause/resume preview updates
 * 5. IFRAME STABILITY - Keeps previous preview visible during updates
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Loader2, AlertCircle, FileWarning, Pause, Play, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Time to wait after changes stop before regenerating (ms) */
  SETTLE_DELAY: 500,
  /** Minimum interval between regenerations (ms) */
  THROTTLE_INTERVAL: 1500,
  /** If regen takes longer than this, trigger circuit breaker (ms) */
  SLOW_REGEN_THRESHOLD: 1200,
  /** Max regenerations allowed in tracking window */
  MAX_REGENS_IN_WINDOW: 3,
  /** Window for tracking regeneration frequency (ms) */
  REGEN_TRACKING_WINDOW: 10000,
};

// ============================================================================
// DEV-ONLY Instrumentation
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';

/**
 * DEV-ONLY: Track active blob URLs for leak detection
 */
const devUrlTracker = isDev ? {
  activeUrls: new Set(),
  track(url) {
    if (!url) return;
    this.activeUrls.add(url);
    if (this.activeUrls.size > 2) {
      console.warn(
        `[PdfPagePreview] URL leak detected: ${this.activeUrls.size} active URLs (expected ≤2)`,
        Array.from(this.activeUrls)
      );
    }
  },
  revoke(url) {
    if (!url) return;
    if (this.activeUrls.has(url)) {
      this.activeUrls.delete(url);
      URL.revokeObjectURL(url);
    }
  },
  revokeAll() {
    this.activeUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeUrls.clear();
  },
  getCount() {
    return this.activeUrls.size;
  },
} : null;

/**
 * DEV-ONLY: Regen telemetry for debugging
 */
const devTelemetry = isDev ? {
  regenHistory: [], // { timestamp, duration }

  logRegenStart() {
    console.debug('[PdfPagePreview] Regen started');
    return Date.now();
  },

  logRegenComplete(startTime, wasSlow, triggeredCircuitBreaker) {
    const duration = Date.now() - startTime;
    const now = Date.now();

    // Add to history
    this.regenHistory.push({ timestamp: now, duration });

    // Keep only last 60s of history
    const cutoff = now - 60000;
    this.regenHistory = this.regenHistory.filter(r => r.timestamp > cutoff);

    // Calculate stats
    const last10s = this.regenHistory.filter(r => r.timestamp > now - 10000);
    const last60s = this.regenHistory;

    const stats = {
      duration: `${duration}ms`,
      wasSlow,
      triggeredCircuitBreaker,
      regensLast10s: last10s.length,
      regensLast60s: last60s.length,
      avgDurationLast60s: last60s.length > 0
        ? `${Math.round(last60s.reduce((sum, r) => sum + r.duration, 0) / last60s.length)}ms`
        : 'N/A',
    };

    if (wasSlow || triggeredCircuitBreaker) {
      console.warn('[PdfPagePreview] Regen complete (slow or tripped)', stats);
    } else {
      console.debug('[PdfPagePreview] Regen complete', stats);
    }
  },

  logThrottleDelay(delayMs) {
    console.debug(`[PdfPagePreview] Throttle: delaying regen by ${delayMs}ms`);
  },

  logQueueReplacement() {
    console.debug('[PdfPagePreview] Queue: replacing previously queued document (latest-wins)');
  },

  logCircuitBreakerTrip(reason) {
    console.warn(`[PdfPagePreview] Circuit breaker tripped: ${reason}`);
  },

  logPauseResume(action, regenTimestampCount) {
    console.debug(`[PdfPagePreview] ${action}, cleared ${regenTimestampCount} regen timestamps`);
  },
} : null;

/**
 * DEV-ONLY: Assertions for invariants
 */
const devAssert = isDev ? {
  singleRegenInFlight(isCurrentlyRegenerating, aboutToStartNew) {
    if (isCurrentlyRegenerating && aboutToStartNew) {
      console.warn(
        '[PdfPagePreview] INVARIANT VIOLATION: Attempting to start regen while one is in flight'
      );
    }
  },

  queueIsLatestWins(queuedDoc, newDoc) {
    // This is informational - latest-wins is expected behavior
    if (queuedDoc && queuedDoc !== newDoc) {
      devTelemetry?.logQueueReplacement();
    }
  },
} : null;

// ============================================================================
// Sub-components
// ============================================================================

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
 * Pause notice shown when circuit breaker or manual pause is active
 */
function PausedNotice({ reason, onResume }) {
  const isCircuitBreaker = reason === 'circuit-breaker';

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20">
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Pause className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {isCircuitBreaker
              ? 'Preview paused to keep things responsive.'
              : 'Preview updates paused.'}
          </span>
        </div>
        <button
          onClick={onResume}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-md transition-colors flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          Resume
        </button>
      </div>
    </div>
  );
}

/**
 * Preview header with pause/resume control
 */
function PreviewHeader({ isPaused, hasPendingChanges, onTogglePause }) {
  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
      {hasPendingChanges && !isPaused && (
        <span className="text-xs text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded">
          <RefreshCw className="w-3 h-3 inline-block mr-1 animate-spin" />
          Updating...
        </span>
      )}
      <button
        onClick={onTogglePause}
        className={cn(
          'p-1.5 rounded-md transition-colors text-xs flex items-center gap-1',
          isPaused
            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900'
            : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
        )}
        title={isPaused ? 'Resume preview updates' : 'Pause preview updates'}
      >
        {isPaused ? (
          <>
            <Play className="w-3.5 h-3.5" />
            <span>Resume</span>
          </>
        ) : (
          <>
            <Pause className="w-3.5 h-3.5" />
            <span>Pause</span>
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PDF preview with circuit-breaker protection
 *
 * @param {Object} props
 * @param {React.ReactElement} props.document - The PDF document element to render
 * @param {string} props.error - Error message if there's an error
 * @param {Function} props.onRetry - Callback to retry on error
 * @param {string} props.className - Additional CSS classes
 */
function PdfPagePreviewInner({
  document,
  error = null,
  onRetry,
  className,
}) {
  // ============================================================================
  // Refs for tracking
  // ============================================================================

  /** Last successfully rendered PDF URL (kept for display during updates) */
  const lastSuccessfulUrlRef = useRef(null);
  /** Previous document reference for change detection */
  const previousDocumentRef = useRef(null);
  /** Settle timer ref */
  const settleTimerRef = useRef(null);
  /** Last regeneration timestamp for throttling */
  const lastRegenTimeRef = useRef(0);
  /** Timestamps of recent regenerations for circuit breaker */
  const regenTimestampsRef = useRef([]);
  /** Start time of current regeneration (for duration tracking) */
  const regenStartTimeRef = useRef(null);
  /** Queued document waiting for throttle to expire */
  const queuedDocumentRef = useRef(null);
  /** Throttle timer ref */
  const throttleTimerRef = useRef(null);

  // ============================================================================
  // State
  // ============================================================================

  /** Document waiting to be processed after settle delay */
  const [pendingDocument, setPendingDocument] = useState(null);
  /** Whether preview updates are paused */
  const [isPaused, setIsPaused] = useState(false);
  /** Reason for pause: 'manual' | 'circuit-breaker' | null */
  const [pauseReason, setPauseReason] = useState(null);
  /** Whether we have changes waiting to be applied */
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  /** Whether PDF is currently regenerating */
  const [isRegenerating, setIsRegenerating] = useState(false);
  /** Stable URL for iframe (only updated on successful completion) */
  const [stableUrl, setStableUrl] = useState(null);

  // ============================================================================
  // PDF Hook
  // ============================================================================

  // Use the async usePDF hook
  // We pass null initially and manually call updateInstance to control timing
  const [instance, updateInstance] = usePDF({ document: null });

  // ============================================================================
  // Circuit Breaker Logic
  // ============================================================================

  /**
   * Check if circuit breaker should trip
   */
  const shouldTripCircuitBreaker = useCallback(() => {
    const now = Date.now();

    // Clean old timestamps
    const windowStart = now - CONFIG.REGEN_TRACKING_WINDOW;
    regenTimestampsRef.current = regenTimestampsRef.current.filter(t => t > windowStart);

    // Check frequency
    if (regenTimestampsRef.current.length >= CONFIG.MAX_REGENS_IN_WINDOW) {
      return true;
    }

    return false;
  }, []);

  /**
   * Record a regeneration and check for slow duration
   */
  const recordRegenComplete = useCallback((wasSlow) => {
    const now = Date.now();
    regenTimestampsRef.current.push(now);

    // Trip circuit breaker if this regen was slow
    if (wasSlow) {
      return true;
    }

    // Or if we've had too many regens recently
    return shouldTripCircuitBreaker();
  }, [shouldTripCircuitBreaker]);

  /**
   * Trigger circuit breaker pause
   */
  const triggerCircuitBreaker = useCallback(() => {
    setIsPaused(true);
    setPauseReason('circuit-breaker');
    setIsRegenerating(false);
    // Clear any queued work
    queuedDocumentRef.current = null;
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  // ============================================================================
  // Regeneration Logic
  // ============================================================================

  /**
   * Actually perform the PDF regeneration
   */
  const doRegenerate = useCallback((doc) => {
    if (!doc || isPaused) return;

    const now = Date.now();

    // Check throttle
    const timeSinceLastRegen = now - lastRegenTimeRef.current;
    if (timeSinceLastRegen < CONFIG.THROTTLE_INTERVAL) {
      // DEV: Assert latest-wins queue behavior
      devAssert?.queueIsLatestWins(queuedDocumentRef.current, doc);

      // Queue for later
      queuedDocumentRef.current = doc;
      setHasPendingChanges(true);

      // Set timer to process queue after throttle expires
      if (!throttleTimerRef.current) {
        const delay = CONFIG.THROTTLE_INTERVAL - timeSinceLastRegen;
        devTelemetry?.logThrottleDelay(delay);
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          if (queuedDocumentRef.current && !isPaused) {
            doRegenerate(queuedDocumentRef.current);
            queuedDocumentRef.current = null;
          }
        }, delay);
      }
      return;
    }

    // Check circuit breaker before starting
    if (shouldTripCircuitBreaker()) {
      devTelemetry?.logCircuitBreakerTrip('too many regens in window');
      triggerCircuitBreaker();
      return;
    }

    // DEV: Assert no concurrent regens
    devAssert?.singleRegenInFlight(isRegenerating, true);

    // Start regeneration
    lastRegenTimeRef.current = now;
    regenStartTimeRef.current = now;
    devTelemetry?.logRegenStart();
    setIsRegenerating(true);
    setHasPendingChanges(false);

    // Trigger the PDF update
    previousDocumentRef.current = doc;
    updateInstance(doc);
  }, [isPaused, isRegenerating, shouldTripCircuitBreaker, triggerCircuitBreaker, updateInstance]);

  /**
   * Handle document prop changes with settle delay
   */
  useEffect(() => {
    // Don't process if paused or no document
    if (!document) {
      setPendingDocument(null);
      setHasPendingChanges(false);
      return;
    }

    // Skip if document reference is the same
    if (document === previousDocumentRef.current) {
      return;
    }

    // Mark as having pending changes
    setHasPendingChanges(true);

    // If paused, just track that we have pending work
    if (isPaused) {
      setPendingDocument(document);
      return;
    }

    // Clear existing settle timer
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
    }

    // Set new settle timer
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      doRegenerate(document);
    }, CONFIG.SETTLE_DELAY);

    // Cleanup
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [document, isPaused, doRegenerate]);

  // ============================================================================
  // Handle PDF Generation Completion
  // ============================================================================

  useEffect(() => {
    // Only process completion events
    if (!regenStartTimeRef.current) return;

    // Check if generation just finished (URL changed or error occurred)
    if (instance.url && !instance.loading) {
      const regenStartTime = regenStartTimeRef.current;
      const regenDuration = Date.now() - regenStartTime;
      const wasSlow = regenDuration > CONFIG.SLOW_REGEN_THRESHOLD;

      // Record completion and check circuit breaker
      const shouldPause = recordRegenComplete(wasSlow);

      regenStartTimeRef.current = null;
      setIsRegenerating(false);

      if (shouldPause) {
        devTelemetry?.logRegenComplete(regenStartTime, wasSlow, true);
        devTelemetry?.logCircuitBreakerTrip('slow regen');
        triggerCircuitBreaker();
      } else {
        devTelemetry?.logRegenComplete(regenStartTime, wasSlow, false);

        // LEAK GUARD: Revoke old URL before setting new one
        const oldUrl = stableUrl;
        if (oldUrl && oldUrl !== instance.url) {
          if (devUrlTracker) {
            devUrlTracker.revoke(oldUrl);
          } else {
            // Production: direct revocation
            URL.revokeObjectURL(oldUrl);
          }
        }

        // Track new URL (DEV only)
        devUrlTracker?.track(instance.url);

        // Update stable URL only on successful completion
        setStableUrl(instance.url);
        lastSuccessfulUrlRef.current = instance.url;
      }
    } else if (instance.error) {
      // Generation failed - reset state but keep last stable preview visible
      // (stableUrl is intentionally NOT cleared so previous preview remains)
      const regenStartTime = regenStartTimeRef.current;
      if (regenStartTime) {
        devTelemetry?.logRegenComplete(regenStartTime, false, false);
        console.warn('[PdfPagePreview] Regen failed, keeping last stable preview', instance.error);
      }
      regenStartTimeRef.current = null;
      setIsRegenerating(false);
    }
  }, [instance.url, instance.loading, instance.error, stableUrl, recordRegenComplete, triggerCircuitBreaker]);

  // ============================================================================
  // Stable URL (for iframe - never goes back to loading)
  // ============================================================================

  // Keep stable URL for iframe even during updates
  // Only update after successful generation
  const displayUrl = useMemo(() => {
    // Use the stable URL if we have one, otherwise fall back to instance URL
    return stableUrl || instance.url;
  }, [stableUrl, instance.url]);

  // ============================================================================
  // Manual Pause/Resume
  // ============================================================================

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      // Resume
      const clearedCount = regenTimestampsRef.current.length;
      setIsPaused(false);
      setPauseReason(null);

      // Reset circuit breaker tracking
      regenTimestampsRef.current = [];
      devTelemetry?.logPauseResume('Resumed', clearedCount);

      // Process pending document if we have one
      if (pendingDocument && pendingDocument !== previousDocumentRef.current) {
        // Use a short delay to let state settle
        setTimeout(() => {
          doRegenerate(pendingDocument);
          setPendingDocument(null);
        }, 50);
      } else if (document && document !== previousDocumentRef.current) {
        setTimeout(() => {
          doRegenerate(document);
        }, 50);
      }
    } else {
      // Pause
      setIsPaused(true);
      setPauseReason('manual');
      devTelemetry?.logPauseResume('Paused (manual)', 0);

      // Clear any pending work
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      queuedDocumentRef.current = null;
    }
  }, [isPaused, pendingDocument, document, doRegenerate]);

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);

      // LEAK GUARD: Clean up all tracked blob URLs
      if (devUrlTracker) {
        const count = devUrlTracker.getCount();
        if (count > 0) {
          console.debug(`[PdfPagePreview] Unmount cleanup: revoking ${count} tracked URL(s)`);
        }
        devUrlTracker.revokeAll();
      } else {
        // Production: revoke the last successful URL
        if (lastSuccessfulUrlRef.current) {
          // Don't revoke immediately as component might remount
          const url = lastSuccessfulUrlRef.current;
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
    };
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

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

  // Show loading only if we have never successfully generated
  // Once we have a stable URL, show the preview (with optional updating indicator)
  if (!displayUrl && (instance.loading || isRegenerating)) {
    return <LoadingState message="Building your PDF document..." />;
  }

  // No URL yet and not loading - waiting for first generation
  if (!displayUrl) {
    return <LoadingState message="Preparing preview..." />;
  }

  // Render PDF in native iframe with stability features
  return (
    <div className={cn('relative h-full min-h-0', className)}>
      {/* Preview header with manual pause control */}
      <PreviewHeader
        isPaused={isPaused}
        hasPendingChanges={hasPendingChanges || isRegenerating}
        onTogglePause={handleTogglePause}
      />

      {/* Loading overlay - subtle, non-blocking */}
      {(isRegenerating || hasPendingChanges) && !isPaused && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 dark:bg-blue-900 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* PDF iframe - uses stable URL to prevent flashing */}
      <iframe
        src={displayUrl}
        title="PDF Preview"
        className={cn(
          'w-full h-full border-0 rounded-lg bg-white transition-opacity duration-200',
          (isRegenerating && !isPaused) ? 'opacity-90' : 'opacity-100'
        )}
      />

      {/* Pause notice (shown at bottom) */}
      {isPaused && (
        <PausedNotice
          reason={pauseReason}
          onResume={handleTogglePause}
        />
      )}
    </div>
  );
}

/**
 * Memoized PDF page preview component with circuit breaker protection
 */
const PdfPagePreview = React.memo(PdfPagePreviewInner);

PdfPagePreview.displayName = 'PdfPagePreview';

export default PdfPagePreview;
