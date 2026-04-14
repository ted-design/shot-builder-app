/**
 * InlinePdfPreview - High-fidelity PDF preview rendered inline via iframe
 *
 * Generates the SAME PDF blob as "Open PDF preview" / "Export PDF" and displays
 * it inside an <iframe> within the preview panel.
 *
 * Resource safeguards:
 * - Debounced regeneration (REGEN_DEBOUNCE_MS) after inputs change
 * - runId pattern: stale generations are discarded
 * - Blob URLs are revoked on replacement and unmount
 * - Hard cap: if totalShots > MAX_AUTO_SHOTS or estimated pages > MAX_AUTO_PAGES,
 *   auto-generation is suppressed; a manual "Render" button is shown instead.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, FileText } from 'lucide-react';

// ─── Thresholds ─────────────────────────────────────────────────────────────
export const REGEN_DEBOUNCE_MS = 600;
export const MAX_AUTO_SHOTS = 40;
export const MAX_AUTO_PAGES = 10;

/**
 * Rough page estimate: for gallery layouts each page holds ~6-9 cards;
 * for table/shotblock layouts ~12-18 rows. We use conservative numbers.
 */
function estimatePages(totalShots, layout) {
  if (totalShots === 0) return 0;
  const perPage = layout === 'gallery' ? 6 : 12;
  return Math.ceil(totalShots / perPage);
}

export default function InlinePdfPreview({
  getPdfInputs,
  processImagesForExport,
  PlannerPdfDocument,
  pdfRenderer, // the `pdf` function from @react-pdf/renderer
  enabled = false,
  totalShots = 0,
  layout = 'gallery',
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [manualTrigger, setManualTrigger] = useState(0); // bump to force regen when capped

  const runIdRef = useRef(0);
  const blobUrlRef = useRef(null);
  const debounceRef = useRef(null);

  const exceedsCap = totalShots > MAX_AUTO_SHOTS || estimatePages(totalShots, layout) > MAX_AUTO_PAGES;

  // Revoke a blob URL safely
  const revoke = useCallback((url) => {
    if (url) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
  }, []);

  // Core generation logic
  const generate = useCallback(async (currentRunId) => {
    setGenerating(true);
    setError(null);

    try {
      const { options, lanes, laneSummary, talentSummary, meta } = getPdfInputs();

      // Resolve images if enabled
      let preparedLanes = lanes;
      if (meta.imagesEnabled) {
        const { imageDataMap } = await processImagesForExport(
          lanes,
          options.density || 'standard',
          Boolean(options.fallbackToProductImages)
        );

        preparedLanes = lanes.map((lane) => {
          const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
          const shots = laneShots.map((shot) => {
            const shotId = shot?.id ? String(shot.id) : null;
            const base64 = shotId ? imageDataMap.get(shotId) : null;
            return { ...shot, image: base64 || null };
          });
          return { ...lane, shots };
        });
      }

      // Check if this run is still current
      if (runIdRef.current !== currentRunId) return;

      // Generate PDF blob
      const blob = await pdfRenderer(
        <PlannerPdfDocument
          lanes={preparedLanes}
          laneSummary={laneSummary}
          talentSummary={talentSummary}
          options={options}
        />
      ).toBlob();

      // Check again after async work
      if (runIdRef.current !== currentRunId) return;

      const url = URL.createObjectURL(blob);

      // Revoke previous URL
      const prevUrl = blobUrlRef.current;
      blobUrlRef.current = url;
      setBlobUrl(url);
      revoke(prevUrl);
    } catch (err) {
      if (runIdRef.current !== currentRunId) return;
      console.error('[InlinePdfPreview] Generation failed:', err);
      setError(err?.message || 'PDF generation failed');
    } finally {
      if (runIdRef.current === currentRunId) {
        setGenerating(false);
      }
    }
  }, [getPdfInputs, processImagesForExport, PlannerPdfDocument, pdfRenderer, revoke]);

  // Debounced trigger effect
  useEffect(() => {
    if (!enabled) return;

    // If caps exceeded and no manual trigger, skip auto-gen
    if (exceedsCap && manualTrigger === 0) return;

    // Bump runId to invalidate any in-flight generation
    const id = ++runIdRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      generate(id);
    }, REGEN_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, getPdfInputs, exceedsCap, manualTrigger, generate]);

  // Cleanup on unmount or when disabled
  useEffect(() => {
    if (!enabled) {
      // Clean up when toggled off
      runIdRef.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const prev = blobUrlRef.current;
      blobUrlRef.current = null;
      setBlobUrl(null);
      setGenerating(false);
      setError(null);
      setManualTrigger(0);
      revoke(prev);
    }
  }, [enabled, revoke]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      runIdRef.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      revoke(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, [revoke]);

  if (!enabled) return null;

  // Cap exceeded: show manual trigger
  if (exceedsCap && !blobUrl && !generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <FileText className="w-8 h-8 text-stone-400" />
        <div className="text-sm text-stone-600">
          {totalShots} shots detected ({estimatePages(totalShots, layout)}+ pages).
          <br />
          Auto-preview is disabled for large exports.
        </div>
        <button
          type="button"
          onClick={() => setManualTrigger((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-md transition-colors"
        >
          Render PDF preview now
        </button>
      </div>
    );
  }

  // Generating state
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        <span className="text-xs text-slate-500">Generating high-fidelity preview...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <span className="text-sm text-stone-600">Preview generation failed</span>
        <span className="text-xs text-stone-400">{error}</span>
        <button
          type="button"
          onClick={() => setManualTrigger((n) => n + 1)}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // PDF iframe
  if (blobUrl) {
    return (
      <iframe
        src={blobUrl}
        title="High-fidelity PDF preview"
        className="w-full h-full border-0"
        style={{ backgroundColor: '#f5f5f4' }}
      />
    );
  }

  // Fallback: waiting for first generation (shouldn't normally be visible)
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
    </div>
  );
}
