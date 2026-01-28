/**
 * LightweightExportPreview - Paged HTML preview for export configuration
 *
 * This component provides a performant, document-like preview of export settings
 * without generating actual PDFs. Key features:
 *
 * 1. **Paged Layout**: Shows page boundaries with page numbers, mimicking real PDF
 * 2. **Deterministic Pagination**: Uses layout heuristics to estimate page breaks
 * 3. **Scannable Cards**: Line-clamped text ensures consistent card heights
 * 4. **Editorial Design**: Apple-ish aesthetic with subtle shadows and off-white pages
 * 5. **Instant Updates**: Responds immediately to config changes
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Image as ImageIcon, ImageOff, LayoutGrid, Table2, Loader2 } from 'lucide-react';
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

// Maximum number of sample shots to display (performance cap)
const MAX_SAMPLE_SHOTS = 6;

// Maximum notes length for preview
const MAX_NOTES_LENGTH = 60;

// Maximum description length
const MAX_DESCRIPTION_LENGTH = 50;

// Maximum products to show inline
const MAX_PRODUCTS_INLINE = 2;

// Page dimensions (ratio-based for CSS)
const PAGE_RATIOS = {
  portrait: 8.5 / 11,   // Width / Height
  landscape: 11 / 8.5,
};

// Page height estimates in "units" (relative to content)
// Used for deterministic pagination heuristics
const PAGE_CAPACITY_UNITS = {
  portrait: 100,
  landscape: 75,
};

// ─────────────────────────────────────────────────────────────────────────────
// Image Stage Sizing
// Bounded max-heights per density to ensure cards remain scannable
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_MAX_HEIGHT = {
  compact: 60,
  standard: 80,
  detailed: 100,
};

// Card height estimates (in units) for pagination
const CARD_HEIGHT_UNITS = {
  compact: { withImage: 18, withoutImage: 10 },
  standard: { withImage: 24, withoutImage: 12 },
  detailed: { withImage: 32, withoutImage: 16 },
};

// Row height estimates for table mode
const ROW_HEIGHT_UNITS = {
  compact: { withImage: 8, withoutImage: 4 },
  standard: { withImage: 10, withoutImage: 5 },
  detailed: { withImage: 14, withoutImage: 7 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination Estimator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimates pagination for the preview based on layout configuration.
 * This provides deterministic page breaks without rendering actual PDF.
 *
 * @param {Object} options - Layout options
 * @param {Array} shots - Array of shot objects
 * @returns {Object} Pagination info with page assignments
 */
function estimatePagination(options, shots) {
  if (!shots || shots.length === 0) {
    return { pages: [], totalPages: 0, shotsPerPage: 0 };
  }

  const {
    layout = 'gallery',
    density = 'standard',
    orientation = 'portrait',
    includeImages = true,
    galleryColumns = 3,
  } = options;

  const pageCapacity = PAGE_CAPACITY_UNITS[orientation] || PAGE_CAPACITY_UNITS.portrait;
  const hasImages = includeImages || options.fields?.image;

  let itemHeight;
  let itemsPerRow;

  if (layout === 'table' || layout === 'shotblock') {
    // Table/ShotBlock: items flow vertically in a single column
    const heights = ROW_HEIGHT_UNITS[density] || ROW_HEIGHT_UNITS.standard;
    itemHeight = hasImages ? heights.withImage : heights.withoutImage;
    itemsPerRow = 1;
  } else {
    // Gallery: items flow in grid
    const heights = CARD_HEIGHT_UNITS[density] || CARD_HEIGHT_UNITS.standard;
    itemHeight = hasImages ? heights.withImage : heights.withoutImage;
    itemsPerRow = Math.min(Number(galleryColumns) || 3, 4);
  }

  // Calculate items per page
  const rowHeight = itemHeight;
  const rowsPerPage = Math.max(1, Math.floor(pageCapacity / rowHeight));
  const itemsPerPage = rowsPerPage * itemsPerRow;

  // Distribute shots across pages
  const pages = [];
  for (let i = 0; i < shots.length; i += itemsPerPage) {
    pages.push(shots.slice(i, i + itemsPerPage));
  }

  return {
    pages,
    totalPages: pages.length,
    shotsPerPage: itemsPerPage,
    rowsPerPage,
    itemsPerRow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Resolution Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to resolve an image source to a browser-loadable URL
 * Returns { url, loading, error } state
 */
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

    // If already a valid browser URL, use directly
    if (isValidBrowserImageUrl(normalizedSource)) {
      setState({ url: normalizedSource, loading: false, error: null });
      return;
    }

    // Need to resolve via adapter
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

    return () => {
      cancelled = true;
    };
  }, [normalizedSource]);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shot Image Thumbnail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Image thumbnail component with URL resolution, contain-fit, and bounded stage sizing.
 */
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

/**
 * Sample shot card for lightweight preview - Gallery mode
 * All text is line-clamped for consistent card heights
 */
function SampleShotCard({
  shot,
  showImage,
  density = 'standard',
  gridStageRatio,
  imageKey,
  onImageDimensionsLoaded,
}) {
  const isCompact = density === 'compact';
  const maxStageHeight = STAGE_MAX_HEIGHT[density] || STAGE_MAX_HEIGHT.standard;

  const productList = Array.isArray(shot.products) ? shot.products : [];
  const talentList = Array.isArray(shot.talent) ? shot.talent : [];
  const imageSource = shot.image;

  return (
    <div
      className={cn(
        'bg-white border border-stone-200 rounded-md overflow-hidden',
        'transition-shadow hover:shadow-sm',
        isCompact ? 'p-2' : 'p-2.5'
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

      {/* Title - 1 line clamp */}
      <div className={cn(
        'font-medium text-stone-900 line-clamp-1',
        isCompact ? 'text-[10px]' : 'text-xs'
      )}>
        {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
      </div>

      {/* Description - 1 line clamp */}
      {shot.description && (
        <div className={cn(
          'text-stone-500 line-clamp-1 mt-0.5',
          isCompact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {truncateText(shot.description, MAX_DESCRIPTION_LENGTH)}
        </div>
      )}

      {/* Meta strip - max 2 lines */}
      <div className={cn(
        'flex items-center gap-1 text-stone-500 mt-1 flex-wrap line-clamp-2',
        isCompact ? 'text-[8px]' : 'text-[9px]'
      )}>
        {shot.location && <span>{shot.location}</span>}
        {talentList.length > 0 && (
          <>
            {shot.location && <span className="text-stone-300">·</span>}
            <span>{talentList.slice(0, 2).join(', ')}{talentList.length > 2 ? '…' : ''}</span>
          </>
        )}
      </div>

      {/* Products - max 2 items + "+N more" */}
      {productList.length > 0 && (
        <div className={cn(
          'mt-1.5 text-stone-600 line-clamp-1',
          isCompact ? 'text-[8px]' : 'text-[9px]'
        )}>
          <span className="text-stone-400">•</span> {productList.slice(0, MAX_PRODUCTS_INLINE).join(', ')}
          {productList.length > MAX_PRODUCTS_INLINE && (
            <span className="text-stone-400 ml-1">+{productList.length - MAX_PRODUCTS_INLINE}</span>
          )}
        </div>
      )}

      {/* Notes snippet - max 2 lines */}
      {shot.notes && (
        <div className={cn(
          'mt-1.5 px-1.5 py-1 bg-stone-50 rounded text-stone-500 line-clamp-2',
          isCompact ? 'text-[7px]' : 'text-[8px]'
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

/**
 * Sample shot row for lightweight preview - Table/ShotBlock mode
 */
function SampleShotRow({
  shot,
  showImage,
  density = 'standard',
  gridStageRatio,
  imageKey,
  onImageDimensionsLoaded,
}) {
  const isCompact = density === 'compact';
  const maxStageHeight = STAGE_MAX_HEIGHT[density] || STAGE_MAX_HEIGHT.standard;

  const productList = Array.isArray(shot.products) ? shot.products : [];
  const talentList = Array.isArray(shot.talent) ? shot.talent : [];
  const imageSource = shot.image;

  return (
    <div className={cn(
      'flex items-start gap-2.5 py-2 border-b border-stone-100 last:border-b-0',
      isCompact ? 'py-1.5' : 'py-2'
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
        {/* Title - 1 line */}
        <div className={cn(
          'font-medium text-stone-900 line-clamp-1',
          isCompact ? 'text-[10px]' : 'text-xs'
        )}>
          {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
          {shot.description && (
            <span className="font-normal text-stone-500 ml-1.5">
              — {truncateText(shot.description, MAX_DESCRIPTION_LENGTH)}
            </span>
          )}
        </div>

        {/* Meta row - 1 line */}
        <div className={cn(
          'flex items-center gap-1.5 text-stone-500 mt-0.5 flex-wrap',
          isCompact ? 'text-[8px]' : 'text-[9px]'
        )}>
          {shot.location && <span>{shot.location}</span>}
          {talentList.length > 0 && (
            <>
              {shot.location && <span className="text-stone-300">·</span>}
              <span>{talentList.slice(0, 2).join(', ')}{talentList.length > 2 ? '…' : ''}</span>
            </>
          )}
          {productList.length > 0 && (
            <>
              <span className="text-stone-300">·</span>
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
// Page Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Page container with document-like styling
 * Shows page boundaries with subtle shadow and page number
 */
function PageContainer({
  pageNumber,
  totalPages,
  orientation = 'portrait',
  children,
  className,
}) {
  const isLandscape = orientation === 'landscape';

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Page */}
      <div
        className={cn(
          'relative bg-white rounded shadow-md border border-stone-200/80',
          'overflow-hidden'
        )}
        style={{
          aspectRatio: isLandscape ? '11 / 8.5' : '8.5 / 11',
          maxWidth: isLandscape ? '540px' : '400px',
          width: '100%',
        }}
      >
        {/* Page content area */}
        <div className="absolute inset-0 p-4 overflow-hidden">
          {children}
        </div>

        {/* Page number label */}
        <div className="absolute bottom-2 right-3 text-[9px] text-stone-400 font-medium">
          {pageNumber} of ~{totalPages}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Header (inside first page)
// ─────────────────────────────────────────────────────────────────────────────

function DocumentHeader({ options, shotCount }) {
  const isTableLayout = options.layout === 'table' || options.layout === 'shotblock';
  const showImages = options.includeImages || options.fields?.image;

  return (
    <div className="mb-3 pb-2 border-b border-stone-200">
      {/* Title */}
      <h2 className="text-sm font-semibold text-stone-900 line-clamp-1">
        {options.title || 'Export Preview'}
      </h2>
      {options.subtitle && (
        <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">
          {options.subtitle}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2 text-[9px] text-stone-500">
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
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LightweightExportPreview({
  lanes = [],
  options = {},
  className,
}) {
  // Flatten shots from lanes
  const allShots = useMemo(() => {
    return lanes.flatMap((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      return laneShots;
    });
  }, [lanes]);

  // Sample shots for preview (capped for performance)
  const sampleShots = useMemo(() => {
    return allShots.slice(0, MAX_SAMPLE_SHOTS);
  }, [allShots]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Unified Grid Stage Ratio
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────────────────────────────────────
  const pagination = useMemo(() => {
    return estimatePagination(options, sampleShots);
  }, [options, sampleShots]);

  // Estimate total pages for the FULL dataset (not just sample)
  const fullPagination = useMemo(() => {
    return estimatePagination(options, allShots);
  }, [options, allShots]);

  const showImages = options.includeImages || options.fields?.image;
  const density = options.density || 'standard';
  const orientation = options.orientation || 'portrait';
  const layout = options.layout || 'gallery';
  const columns = layout === 'gallery' ? Math.min(Number(options.galleryColumns) || 3, 3) : 1;
  const isTableLayout = layout === 'table' || layout === 'shotblock';

  // No shots
  if (allShots.length === 0) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn('h-full overflow-auto p-4', className)} style={{ backgroundColor: '#f5f5f4' }}>
      {/* Preview info bar */}
      <div className="max-w-lg mx-auto mb-3">
        <div className="flex items-center justify-between text-[10px] text-stone-500">
          <span>
            Sample preview ({Math.min(sampleShots.length, allShots.length)} of {allShots.length} shots)
          </span>
          <span>
            ~{fullPagination.totalPages} page{fullPagination.totalPages !== 1 ? 's' : ''} estimated
          </span>
        </div>
      </div>

      {/* Paged content */}
      <div className="flex flex-col items-center gap-4">
        {pagination.pages.map((pageShots, pageIndex) => (
          <PageContainer
            key={pageIndex}
            pageNumber={pageIndex + 1}
            totalPages={fullPagination.totalPages}
            orientation={orientation}
          >
            {/* Document header on first page */}
            {pageIndex === 0 && (
              <DocumentHeader options={options} shotCount={allShots.length} />
            )}

            {/* Page content */}
            {isTableLayout ? (
              // Table/ShotBlock layout
              <div className="space-y-0">
                {pageShots.map((shot, shotIndex) => {
                  const globalIndex = pageIndex * pagination.shotsPerPage + shotIndex;
                  const imageKey = shot.id || `shot-${globalIndex}`;
                  return (
                    <SampleShotRow
                      key={imageKey}
                      shot={shot}
                      showImage={showImages}
                      density={density}
                      gridStageRatio={gridStageRatio}
                      imageKey={imageKey}
                      onImageDimensionsLoaded={handleImageDimensionsLoaded}
                    />
                  );
                })}
              </div>
            ) : (
              // Gallery layout
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                }}
              >
                {pageShots.map((shot, shotIndex) => {
                  const globalIndex = pageIndex * pagination.shotsPerPage + shotIndex;
                  const imageKey = shot.id || `shot-${globalIndex}`;
                  return (
                    <SampleShotCard
                      key={imageKey}
                      shot={shot}
                      showImage={showImages}
                      density={density}
                      gridStageRatio={gridStageRatio}
                      imageKey={imageKey}
                      onImageDimensionsLoaded={handleImageDimensionsLoaded}
                    />
                  );
                })}
              </div>
            )}
          </PageContainer>
        ))}

        {/* More pages indicator */}
        {fullPagination.totalPages > pagination.pages.length && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-stone-200 text-[10px] text-stone-500">
              <span>
                +{fullPagination.totalPages - pagination.pages.length} more page{fullPagination.totalPages - pagination.pages.length !== 1 ? 's' : ''} in full export
              </span>
            </div>
          </div>
        )}

        {/* Full preview prompt */}
        {allShots.length > MAX_SAMPLE_SHOTS && (
          <div className="text-center text-[10px] text-stone-400 pb-2">
            Use "Open PDF preview" for full document fidelity
          </div>
        )}
      </div>
    </div>
  );
}
