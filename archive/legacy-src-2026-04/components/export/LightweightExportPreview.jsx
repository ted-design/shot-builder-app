/**
 * LightweightExportPreview - Document-like HTML preview for export configuration
 *
 * This component provides a calm, scannable preview of export settings without
 * generating actual PDFs. It is a reading aid, not a contract.
 *
 * Key principles:
 * - At most TWO page containers (visual shells, not real pagination)
 * - No deterministic pagination logic, no unit math, no capacity formulas
 * - Density affects only line clamps, spacing, and image max-height
 * - Content flows naturally; overflow is clipped at page boundaries
 * - Fit-to-viewport mode scales pages to comfortably fill available width
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Image as ImageIcon, ImageOff, LayoutGrid, Table2, Loader2, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  resolveExportImageUrl,
  normalizeImageSource,
  isValidBrowserImageUrl,
} from '../../lib/exportImageResolver';
import {
  DEFAULT_PREVIEW_STAGE_RATIO,
  MIN_IMAGES_FOR_DOMINANT_BUCKET,
  computeDominantBucket,
} from '../../lib/previewImageStage';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Maximum sample shots rendered across both pages
const MAX_SAMPLE_SHOTS = 12;

// Text truncation limits
const MAX_NOTES_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 50;
const MAX_PRODUCTS_INLINE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Density Tokens
// Density controls ONLY: image max-height, spacing, and line clamps.
// It must NOT influence pagination or page splitting.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_MAX_HEIGHT = {
  compact: 80,
  standard: 120,
  detailed: 160,
};

const DENSITY_SPACING = {
  compact: { cardPadding: 'p-1.5', gap: 'gap-1.5', rowPy: 'py-1.5' },
  standard: { cardPadding: 'p-2.5', gap: 'gap-2', rowPy: 'py-2' },
  detailed: { cardPadding: 'p-3', gap: 'gap-2.5', rowPy: 'py-2.5' },
};

const DENSITY_TEXT = {
  compact: { title: 'text-2xs', body: 'text-3xs', meta: 'text-[8px]', notes: 'text-[7px]' },
  standard: { title: 'text-xs', body: 'text-2xs', meta: 'text-3xs', notes: 'text-[8px]' },
  detailed: { title: 'text-xs', body: 'text-xxs', meta: 'text-2xs', notes: 'text-3xs' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Zoom / Fit Constants
// ─────────────────────────────────────────────────────────────────────────────

// Base widths used for scale computation (matches PageShell maxWidth)
const PAGE_BASE_WIDTH = { portrait: 400, landscape: 540 };

// Discrete zoom steps for manual control (excluding "fit")
const ZOOM_STEPS = [0.7, 0.85, 1.0];
const MIN_FIT_SCALE = 0.55;
const MAX_FIT_SCALE = 1.0;

// Horizontal padding inside the scroll container
const VIEWPORT_PADDING_PX = 32; // p-4 = 16px each side

// Hysteresis threshold: ignore scale changes smaller than this to prevent
// oscillation from scrollbar toggling (scrollbar is ~15-17px, which can cause
// a scale difference of ~0.03-0.04 on a 400px base).
const FIT_SCALE_HYSTERESIS = 0.04;

// ─────────────────────────────────────────────────────────────────────────────
// Text Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '\u2026';
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Resolution Hook
// ─────────────────────────────────────────────────────────────────────────────

function useResolvedImageUrl(imageSource, enabled = true) {
  const [state, setState] = useState({ url: null, loading: false, error: null });

  const normalizedSource = useMemo(() => {
    if (!enabled) return null;
    return normalizeImageSource(imageSource);
  }, [imageSource, enabled]);

  useEffect(() => {
    if (!normalizedSource) {
      setState({ url: null, loading: false, error: null });
      return;
    }

    if (isValidBrowserImageUrl(normalizedSource)) {
      setState({ url: normalizedSource, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    resolveExportImageUrl(normalizedSource)
      .then(resolvedUrl => {
        if (cancelled) return;
        if (resolvedUrl) {
          setState({ url: resolvedUrl, loading: false, error: null });
        } else {
          setState({ url: null, loading: false, error: 'Failed to resolve' });
        }
      })
      .catch(err => {
        if (cancelled) return;
        setState({ url: null, loading: false, error: err?.message || 'Resolution failed' });
      });

    return () => { cancelled = true; };
  }, [normalizedSource]);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shot Image Thumbnail
// ─────────────────────────────────────────────────────────────────────────────

function ShotImageThumbnail({
  imageSource,
  altText,
  density = 'standard',
  gridStageRatio,
  imageKey,
  onDimensionsLoaded,
}) {
  const maxHeight = STAGE_MAX_HEIGHT[density] || STAGE_MAX_HEIGHT.standard;
  const { url, loading, error } = useResolvedImageUrl(imageSource, true);
  const [imgError, setImgError] = useState(false);
  const hasReportedRef = useRef(false);

  useEffect(() => {
    setImgError(false);
    hasReportedRef.current = false;
  }, [url]);

  const handleImageError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (!hasReportedRef.current && onDimensionsLoaded) {
      hasReportedRef.current = true;
      onDimensionsLoaded(imageKey, { naturalWidth, naturalHeight });
    }
  }, [imageKey, onDimensionsLoaded]);

  const stageClassName = cn(
    'rounded flex items-center justify-center overflow-hidden',
    'bg-stone-100 border border-stone-200'
  );

  const stageStyle = {
    aspectRatio: gridStageRatio,
    maxHeight: `${maxHeight}px`,
  };

  if (loading) {
    return (
      <div className={stageClassName} style={stageStyle}>
        <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
      </div>
    );
  }

  if (!url || error || imgError) {
    const errorMessage = error || (imgError ? 'Image failed to load' : 'No image available');
    return (
      <div className={stageClassName} style={stageStyle} title={errorMessage}>
        <ImageOff className="w-4 h-4 text-stone-400" />
      </div>
    );
  }

  return (
    <div className={stageClassName} style={stageStyle}>
      <img
        src={url}
        alt={altText || 'Shot'}
        className="max-w-full max-h-full object-contain"
        loading="lazy"
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample Shot Card (Gallery Mode)
// ─────────────────────────────────────────────────────────────────────────────

function SampleShotCard({
  shot,
  showImage,
  density = 'standard',
  gridStageRatio,
  imageKey,
  onImageDimensionsLoaded,
}) {
  const maxStageHeight = STAGE_MAX_HEIGHT[density] || STAGE_MAX_HEIGHT.standard;
  const spacing = DENSITY_SPACING[density] || DENSITY_SPACING.standard;
  const text = DENSITY_TEXT[density] || DENSITY_TEXT.standard;

  const productList = Array.isArray(shot.products) ? shot.products : [];
  const talentList = Array.isArray(shot.talent) ? shot.talent : [];
  const imageSource = shot.image;

  return (
    <div
      className={cn(
        'bg-white border border-stone-200 rounded-md overflow-hidden',
        'transition-shadow hover:shadow-sm',
        spacing.cardPadding
      )}
    >
      {/* Image thumbnail */}
      {showImage && imageSource && (
        <div className="mb-2">
          <ShotImageThumbnail
            imageSource={imageSource}
            altText={shot.name || 'Shot'}
            density={density}
            gridStageRatio={gridStageRatio}
            imageKey={imageKey}
            onDimensionsLoaded={onImageDimensionsLoaded}
          />
        </div>
      )}

      {/* Image placeholder when images enabled but no source */}
      {showImage && !imageSource && (
        <div
          className="rounded mb-2 flex items-center justify-center overflow-hidden bg-stone-100 border border-stone-200"
          style={{ aspectRatio: gridStageRatio, maxHeight: `${maxStageHeight}px` }}
        >
          <ImageOff className="w-4 h-4 text-stone-400" />
        </div>
      )}

      {/* Title */}
      <div className={cn('font-medium text-stone-900 line-clamp-1', text.title)}>
        {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
      </div>

      {/* Description */}
      {shot.description && (
        <div className={cn('text-stone-500 line-clamp-1 mt-0.5', text.body)}>
          {truncateText(shot.description, MAX_DESCRIPTION_LENGTH)}
        </div>
      )}

      {/* Meta strip */}
      <div className={cn(
        'flex items-center gap-1 text-stone-500 mt-1 flex-wrap line-clamp-2',
        text.meta
      )}>
        {shot.location && <span>{shot.location}</span>}
        {talentList.length > 0 && (
          <>
            {shot.location && <span className="text-stone-300">&middot;</span>}
            <span>{talentList.slice(0, 2).join(', ')}{talentList.length > 2 ? '\u2026' : ''}</span>
          </>
        )}
      </div>

      {/* Products */}
      {productList.length > 0 && (
        <div className={cn('mt-1.5 text-stone-600 line-clamp-1', text.meta)}>
          <span className="text-stone-400">&bull;</span>{' '}
          {productList.slice(0, MAX_PRODUCTS_INLINE).join(', ')}
          {productList.length > MAX_PRODUCTS_INLINE && (
            <span className="text-stone-400 ml-1">+{productList.length - MAX_PRODUCTS_INLINE}</span>
          )}
        </div>
      )}

      {/* Notes */}
      {shot.notes && density !== 'compact' && (
        <div className={cn(
          'mt-1.5 px-1.5 py-1 bg-stone-50 rounded text-stone-500 line-clamp-2',
          text.notes
        )}>
          {truncateText(shot.notes, MAX_NOTES_LENGTH)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample Shot Row (Table Mode)
// ─────────────────────────────────────────────────────────────────────────────

function SampleShotRow({
  shot,
  showImage,
  density = 'standard',
  gridStageRatio,
  imageKey,
  onImageDimensionsLoaded,
}) {
  const maxStageHeight = STAGE_MAX_HEIGHT[density] || STAGE_MAX_HEIGHT.standard;
  const spacing = DENSITY_SPACING[density] || DENSITY_SPACING.standard;
  const text = DENSITY_TEXT[density] || DENSITY_TEXT.standard;

  const productList = Array.isArray(shot.products) ? shot.products : [];
  const talentList = Array.isArray(shot.talent) ? shot.talent : [];
  const imageSource = shot.image;

  return (
    <div className={cn(
      'flex items-start gap-2.5 border-b border-stone-100 last:border-b-0',
      spacing.rowPy
    )}>
      {/* Image thumbnail */}
      {showImage && (
        <div className="flex-shrink-0" style={{ width: `${maxStageHeight}px` }}>
          {imageSource ? (
            <ShotImageThumbnail
              imageSource={imageSource}
              altText={shot.name || 'Shot'}
              density={density}
              gridStageRatio="1/1"
              imageKey={imageKey}
              onDimensionsLoaded={onImageDimensionsLoaded}
            />
          ) : (
            <div
              className="rounded flex items-center justify-center overflow-hidden bg-stone-100 border border-stone-200"
              style={{ aspectRatio: '1/1', width: `${maxStageHeight}px` }}
            >
              <ImageOff className="w-3 h-3 text-stone-400" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn('font-medium text-stone-900 line-clamp-1', text.title)}>
          {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
          {shot.description && (
            <span className="font-normal text-stone-500 ml-1.5">
              &mdash; {truncateText(shot.description, MAX_DESCRIPTION_LENGTH)}
            </span>
          )}
        </div>

        <div className={cn(
          'flex items-center gap-1.5 text-stone-500 mt-0.5 flex-wrap',
          text.meta
        )}>
          {shot.location && <span>{shot.location}</span>}
          {talentList.length > 0 && (
            <>
              {shot.location && <span className="text-stone-300">&middot;</span>}
              <span>{talentList.slice(0, 2).join(', ')}{talentList.length > 2 ? '\u2026' : ''}</span>
            </>
          )}
          {productList.length > 0 && (
            <>
              <span className="text-stone-300">&middot;</span>
              <span>{productList.slice(0, MAX_PRODUCTS_INLINE).join(', ')}</span>
              {productList.length > MAX_PRODUCTS_INLINE && (
                <span className="text-stone-400">+{productList.length - MAX_PRODUCTS_INLINE}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoom Control
// Quiet two-state toggle with optional +/- for discrete steps.
// ─────────────────────────────────────────────────────────────────────────────

function ZoomControl({ mode, manualStep, onModeChange, onStepChange }) {
  const stepIndex = ZOOM_STEPS.indexOf(manualStep);
  const canZoomOut = mode === 'manual' && stepIndex > 0;
  const canZoomIn = mode === 'manual' && stepIndex < ZOOM_STEPS.length - 1;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-stone-200 bg-white/80 backdrop-blur-sm shadow-sm">
      {/* Minus */}
      <button
        type="button"
        disabled={!canZoomOut}
        onClick={() => canZoomOut && onStepChange(ZOOM_STEPS[stepIndex - 1])}
        className={cn(
          'w-6 h-6 flex items-center justify-center rounded-l-[5px] transition-colors',
          canZoomOut
            ? 'text-stone-600 hover:bg-stone-100'
            : 'text-stone-300 cursor-default'
        )}
        aria-label="Zoom out"
      >
        <Minus className="w-3 h-3" />
      </button>

      {/* Fit / 100% toggle */}
      <button
        type="button"
        onClick={() => onModeChange(mode === 'fit' ? 'manual' : 'fit')}
        className={cn(
          'px-2 h-6 text-2xs font-medium transition-colors border-x border-stone-200',
          mode === 'fit'
            ? 'text-stone-900 bg-stone-100'
            : 'text-stone-600 hover:bg-stone-50'
        )}
      >
        {mode === 'fit' ? 'Fit' : `${Math.round(manualStep * 100)}%`}
      </button>

      {/* Plus */}
      <button
        type="button"
        disabled={!canZoomIn}
        onClick={() => canZoomIn && onStepChange(ZOOM_STEPS[stepIndex + 1])}
        className={cn(
          'w-6 h-6 flex items-center justify-center rounded-r-[5px] transition-colors',
          canZoomIn
            ? 'text-stone-600 hover:bg-stone-100'
            : 'text-stone-300 cursor-default'
        )}
        aria-label="Zoom in"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Shell
// Visual document page — fixed aspect ratio, clips overflow.
// NOT guaranteed to match real PDF page breaks.
// ─────────────────────────────────────────────────────────────────────────────

function PageShell({ pageLabel, orientation = 'portrait', children, className, _devScale, _devPageHeightPx }) {
  const isLandscape = orientation === 'landscape';

  return (
    <div className={cn('flex flex-col w-full', className)}>
      <div
        className={cn(
          'relative bg-white rounded shadow-md border border-stone-200/80',
          'overflow-hidden mx-auto'
        )}
        style={{
          aspectRatio: isLandscape ? '11 / 8.5' : '8.5 / 11',
          maxWidth: isLandscape ? '540px' : '400px',
          width: '100%',
        }}
      >
        <div className="absolute inset-0 p-4 overflow-hidden">
          {children}
        </div>

        {/* DEV-only: page boundary diagnostic line */}
        {import.meta.env.DEV && _devPageHeightPx != null && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ zIndex: 50 }}>
            <div
              className="border-t-2 border-dashed"
              style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}
            >
              <span
                className="absolute right-1 font-mono rounded px-1"
                style={{
                  top: '-14px',
                  fontSize: '7px',
                  lineHeight: '12px',
                  color: '#ef4444',
                  backgroundColor: 'rgba(255,255,255,0.85)',
                }}
              >
                {pageLabel} | {_devPageHeightPx}px | scale={_devScale}
              </span>
            </div>
          </div>
        )}

        {/* Page label */}
        <div className="absolute bottom-2 right-3 text-3xs text-stone-400 font-medium select-none">
          {pageLabel}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Header (rendered inside the first page)
// ─────────────────────────────────────────────────────────────────────────────

function DocumentHeader({ options, shotCount }) {
  const isTableLayout = options.layout === 'table' || options.layout === 'shotblock';
  const showImages = Boolean(options?.fields?.image);

  return (
    <div className="mb-3 pb-2 border-b border-stone-200">
      <h2 className="text-sm font-semibold text-stone-900 line-clamp-1">
        {options.title || 'Export Preview'}
      </h2>
      {options.subtitle && (
        <p className="text-2xs text-stone-500 mt-0.5 line-clamp-1">
          {options.subtitle}
        </p>
      )}

      <div className="flex items-center gap-3 mt-2 text-3xs text-stone-500">
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>{shotCount} shot{shotCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          {isTableLayout ? (
            <Table2 className="w-3 h-3" />
          ) : (
            <LayoutGrid className="w-3 h-3" />
          )}
          <span className="capitalize">{options.layout || 'gallery'}</span>
        </div>
        <div className="flex items-center gap-1">
          {showImages ? (
            <ImageIcon className="w-3 h-3 text-emerald-500" />
          ) : (
            <ImageOff className="w-3 h-3" />
          )}
          <span>{showImages ? 'Images' : 'No images'}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
      <FileText className="w-10 h-10 text-stone-300 mb-3" />
      <h3 className="text-base font-medium text-stone-600 mb-1">
        No shots to preview
      </h3>
      <p className="text-xs text-stone-400">
        Adjust your filters or add shots to see a preview
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shot Content Renderer
// Renders a list of shots in the current layout mode.
// ─────────────────────────────────────────────────────────────────────────────

function ShotContent({
  shots,
  layout,
  columns,
  showImages,
  density,
  gridStageRatio,
  onImageDimensionsLoaded,
  indexOffset = 0,
}) {
  const isTableLayout = layout === 'table' || layout === 'shotblock';
  const spacing = DENSITY_SPACING[density] || DENSITY_SPACING.standard;

  if (isTableLayout) {
    return (
      <div className="space-y-0">
        {shots.map((shot, i) => {
          const imageKey = shot.id || `shot-${indexOffset + i}`;
          return (
            <SampleShotRow
              key={imageKey}
              shot={shot}
              showImage={showImages}
              density={density}
              gridStageRatio={gridStageRatio}
              imageKey={imageKey}
              onImageDimensionsLoaded={onImageDimensionsLoaded}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn('grid', spacing.gap)}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {shots.map((shot, i) => {
        const imageKey = shot.id || `shot-${indexOffset + i}`;
        return (
          <SampleShotCard
            key={imageKey}
            shot={shot}
            showImage={showImages}
            density={density}
            gridStageRatio={gridStageRatio}
            imageKey={imageKey}
            onImageDimensionsLoaded={onImageDimensionsLoaded}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LightweightExportPreview({
  lanes = [],
  options = {},
  className,
}) {
  // Flatten all shots from lanes
  const allShots = useMemo(() => {
    return lanes.flatMap((lane) => (Array.isArray(lane.shots) ? lane.shots : []));
  }, [lanes]);

  // Sample shots capped for performance
  const sampleShots = useMemo(() => {
    return allShots.slice(0, MAX_SAMPLE_SHOTS);
  }, [allShots]);

  // ─── Unified Grid Stage Ratio ──────────────────────────────────────────────
  const imageDimensionsRef = useRef(new Map());
  const [gridStageRatio, setGridStageRatio] = useState(DEFAULT_PREVIEW_STAGE_RATIO);

  useEffect(() => {
    imageDimensionsRef.current = new Map();
    setGridStageRatio(DEFAULT_PREVIEW_STAGE_RATIO);
  }, [sampleShots]);

  const handleImageDimensionsLoaded = useCallback((imageKey, dimensions) => {
    const dimsMap = imageDimensionsRef.current;
    dimsMap.set(imageKey, dimensions);
    const dimensionsArray = Array.from(dimsMap.values());
    const { ratio, totalLoaded } = computeDominantBucket(dimensionsArray);
    if (totalLoaded >= MIN_IMAGES_FOR_DOMINANT_BUCKET) {
      setGridStageRatio((prev) => (prev !== ratio ? ratio : prev));
    }
  }, []);

  // ─── Derived config ────────────────────────────────────────────────────────
  // Canonical flag: options.fields.image is the ONLY source of truth.
  const showImages = Boolean(options?.fields?.image);

  // DEV-only: warn if images are enabled but no sample shots have image data.
  // This catches storage/CORS regressions early without affecting production.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!showImages || sampleShots.length === 0) return;
    const shotsWithImages = sampleShots.filter(
      (s) => s?.image && s.image !== '__PREVIEW_PLACEHOLDER__'
    );
    if (shotsWithImages.length === 0) {
      console.warn(
        '[LightweightExportPreview] Images are enabled but no sample shots have image data. ' +
        'This may indicate a storage/CORS regression or missing image URLs in shot data.'
      );
    }
  }, [showImages, sampleShots]);
  const density = options.density || 'standard';
  const orientation = options.orientation || 'portrait';
  const layout = options.layout || 'gallery';
  const columns = layout === 'gallery' ? Math.min(Number(options.galleryColumns) || 3, 3) : 1;

  // ─── Zoom / Fit State ─────────────────────────────────────────────────────
  const viewportRef = useRef(null);
  const [zoomMode, setZoomMode] = useState('fit'); // 'fit' | 'manual'
  const [manualStep, setManualStep] = useState(1.0);
  const [fitScale, setFitScale] = useState(1.0);

  const pageBaseWidth = PAGE_BASE_WIDTH[orientation] || PAGE_BASE_WIDTH.portrait;

  // ─── DEV-only: font readiness signal ────────────────────────────────────
  const [fontsReady, setFontsReady] = useState(
    typeof document !== 'undefined' && document.fonts?.status === 'loaded'
  );
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    document.fonts?.ready?.then(() => setFontsReady(true));
  }, []);

  // Computed page height (theoretical, unscaled) for diagnostics
  const pageHeightPx = useMemo(() => {
    const isLandscape = orientation === 'landscape';
    return Math.round(
      isLandscape ? 540 * (8.5 / 11) : 400 * (11 / 8.5)
    );
  }, [orientation]);

  // ResizeObserver: measure viewport and compute fit scale.
  // IMPORTANT: The observed element (viewportRef) has overflow:auto, so showing/
  // hiding a scrollbar changes clientWidth, which re-triggers the observer.
  // We break this feedback loop with:
  //   1. requestAnimationFrame coalescing (one update per frame max)
  //   2. Hysteresis threshold (ignore changes < FIT_SCALE_HYSTERESIS)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let rafId = null;

    const computeFit = () => {
      rafId = null;
      const availableWidth = el.clientWidth - VIEWPORT_PADDING_PX;
      if (availableWidth <= 0) return;
      const raw = availableWidth / pageBaseWidth;
      const clamped = Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, Math.round(raw * 100) / 100));
      setFitScale((prev) => {
        // Hysteresis: only update if the change exceeds threshold
        if (Math.abs(prev - clamped) < FIT_SCALE_HYSTERESIS) return prev;
        return clamped;
      });
    };

    // Initial computation (synchronous, no RAF needed)
    computeFit();

    const ro = new ResizeObserver(() => {
      if (rafId != null) return; // already scheduled
      rafId = requestAnimationFrame(computeFit);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [pageBaseWidth]);

  // Active scale depends on mode
  const activeScale = zoomMode === 'fit' ? fitScale : manualStep;

  // ─── Visual page split ────────────────────────────────────────────────────
  // Split sample shots across two visual shells.
  // This is a presentation choice, not a pagination calculation.
  const page1Shots = useMemo(() => {
    return sampleShots.slice(0, Math.ceil(sampleShots.length / 2));
  }, [sampleShots]);

  const page2Shots = useMemo(() => {
    return sampleShots.slice(Math.ceil(sampleShots.length / 2));
  }, [sampleShots]);

  const showPage2 = page2Shots.length > 0;
  const remainingPages = allShots.length > sampleShots.length
    ? Math.max(1, Math.ceil((allShots.length - sampleShots.length) / Math.max(page1Shots.length, 1)))
    : 0;
  const displayedPageCount = (showPage2 ? 2 : 1) + remainingPages;

  // ─── DEV-only render storm guard ──────────────────────────────────────────
  // Counts renders and ResizeObserver callbacks. If either exceeds 30 in 2s,
  // logs a warning. This is a tripwire to catch future regressions early.
  const renderCountRef = useRef({ count: 0, windowStart: 0 });
  if (import.meta.env.DEV) {
    const now = performance.now();
    const rc = renderCountRef.current;
    if (now - rc.windowStart > 2000) {
      rc.count = 0;
      rc.windowStart = now;
    }
    rc.count++;
    if (rc.count === 30) {
      console.warn(
        '[LightweightExportPreview] Render storm detected: 30+ renders in 2 seconds. ' +
        'Check ResizeObserver / scale / layout interactions.'
      );
    }
  }

  // ─── DEV-only pagination diagnostics log ─────────────────────────────────
  if (import.meta.env.DEV) {
    const el = viewportRef.current;
    const cw = el ? el.clientWidth : 0;
    const ch = el ? el.clientHeight : 0;
    const imagesTotal = sampleShots.filter(s => s?.image).length;
    const imagesLoaded = imageDimensionsRef.current.size;
    console.debug(
      `[LW-PAGINATION] container=${cw}x${ch} scale=${activeScale} ` +
      `pageHeightPx=${pageHeightPx} pages=${displayedPageCount} ` +
      `imagesReady=${imagesLoaded}/${imagesTotal} fontsReady=${fontsReady}`
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (allShots.length === 0) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className={cn('h-full overflow-auto', className)}
      style={{ backgroundColor: '#f5f5f4' }}
    >
      {/* Info bar + zoom control */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2" style={{ backgroundColor: '#f5f5f4' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-2xs text-stone-500">
            Preview ({Math.min(sampleShots.length, allShots.length)} of {allShots.length} shots)
            {allShots.length > sampleShots.length && (
              <span className="ml-2">
                &middot; ~{displayedPageCount}+ pages
              </span>
            )}
          </span>
          <ZoomControl
            mode={zoomMode}
            manualStep={manualStep}
            onModeChange={setZoomMode}
            onStepChange={(step) => {
              setManualStep(step);
              setZoomMode('manual');
            }}
          />
        </div>
      </div>

      {/* Scaled pages wrapper */}
      <div className="px-4 pb-4">
        <div
          className="flex flex-col items-center gap-6"
          style={{
            transform: `scale(${activeScale})`,
            transformOrigin: 'top center',
            // Use negative margin to collapse dead space below scaled content,
            // without changing the element's height (which would toggle scrollbars
            // and create a ResizeObserver feedback loop).
            // The wrapper still occupies its natural unscaled height in DOM flow;
            // the negative margin visually pulls up the bottom boundary.
            ...(activeScale < 1 ? { marginBottom: `-${Math.round((1 - activeScale) * 100)}%` } : {}),
          }}
        >
          {/* Page 1 */}
          <PageShell pageLabel="Page 1" orientation={orientation} _devScale={activeScale} _devPageHeightPx={pageHeightPx}>
            <DocumentHeader options={options} shotCount={allShots.length} />
            <ShotContent
              shots={page1Shots}
              layout={layout}
              columns={columns}
              showImages={showImages}
              density={density}
              gridStageRatio={gridStageRatio}
              onImageDimensionsLoaded={handleImageDimensionsLoaded}
              indexOffset={0}
            />
          </PageShell>

          {/* Page 2 */}
          {showPage2 && (
            <PageShell pageLabel="Page 2" orientation={orientation} _devScale={activeScale} _devPageHeightPx={pageHeightPx}>
              <ShotContent
                shots={page2Shots}
                layout={layout}
                columns={columns}
                showImages={showImages}
                density={density}
                gridStageRatio={gridStageRatio}
                onImageDimensionsLoaded={handleImageDimensionsLoaded}
                indexOffset={page1Shots.length}
              />
            </PageShell>
          )}

          {/* More pages indicator */}
          {remainingPages > 0 && (
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-stone-200 text-2xs text-stone-500">
                +{remainingPages} more page{remainingPages !== 1 ? 's' : ''} in full export
              </div>
            </div>
          )}

          {/* PDF fidelity hint */}
          {allShots.length > MAX_SAMPLE_SHOTS && (
            <div className="text-center text-2xs text-stone-400 pb-2">
              Open PDF preview for full document fidelity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
