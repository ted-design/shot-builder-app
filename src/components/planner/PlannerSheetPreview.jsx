// src/components/planner/PlannerSheetPreview.jsx
//
// HTML preview component that matches PDF output for planner sheets
// Provides WYSIWYG preview of planner sheet configuration
// Uses the same layout calculations as the PDF renderer for accurate previews

import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import {
  SECTION_TYPES,
  SECTION_CONFIG,
  getVisibleSections,
} from '../../lib/plannerSheetSections';
import AppImage from '../common/AppImage';
import { getPrimaryAttachmentWithStyle } from '../../lib/imageHelpers';
import { getShotNotesPreview } from '../../lib/shotNotes';
import {
  calculateLayout,
  getPageDimensions,
  DENSITY_PRESETS,
  calculatePageBreaks,
} from '../../lib/pdfLayoutCalculator';

/**
 * Page break marker component
 * Shows a visual indicator of where page breaks will occur in the PDF
 */
function PageBreakMarker({ pageNumber }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-dashed border-blue-400 dark:border-blue-500" />
      </div>
      <div className="relative flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
          <FileText className="w-3 h-3" />
          Page {pageNumber} starts here
        </span>
      </div>
    </div>
  );
}

// Minimum column widths in pixels for table layout
const TABLE_COLUMN_MIN_WIDTHS = {
  [SECTION_TYPES.SHOT_NUMBER]: 80,   // Short numbers/IDs
  [SECTION_TYPES.SHOT_NAME]: 120,    // Names need more space
  [SECTION_TYPES.SHOT_TYPE]: 80,     // Type badges
  [SECTION_TYPES.DATE]: 85,          // Date format
  [SECTION_TYPES.LOCATION]: 100,     // Location names
  [SECTION_TYPES.TALENT]: 100,       // Talent names
  [SECTION_TYPES.PRODUCTS]: 120,     // Product lists
  [SECTION_TYPES.NOTES]: 100,        // Notes can wrap
};

/**
 * Build CSS grid template with minimum widths for table layout
 * Uses minmax() to ensure columns have minimum readable widths while still being flexible
 */
function buildTableGridTemplate(visibleSections, sectionStates) {
  return visibleSections
    .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
    .map(section => {
      const flex = sectionStates[section.id]?.flex ?? section.flex ?? 1;
      const minWidth = TABLE_COLUMN_MIN_WIDTHS[section.id] || 80;
      // Use minmax to set minimum width while allowing flexible growth
      return `minmax(${minWidth}px, ${flex}fr)`;
    })
    .join(' ');
}

/**
 * Preview of a single shot card in table mode
 */
function PreviewShotCardList({ shot, visibleSections, sectionStates }) {
  const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);

  // Get primary image with crop positioning (S.4.1: includes zoom/rotation transform)
  const { path: primaryImagePath, style: cropStyle, objectPosition: primaryImagePosition } = getPrimaryAttachmentWithStyle(shot);
  const imagePath = primaryImagePath || shot.image || null;
  // Check if cropStyle contains a transform (zoom/rotation)
  const hasCropTransform = cropStyle && cropStyle.transform;
  const imagePosition = !hasCropTransform ? primaryImagePosition : undefined;
  const imageStyle = hasCropTransform ? cropStyle : undefined;

  // Build grid template with minimum widths for readable columns
  const gridTemplate = useMemo(() => {
    return buildTableGridTemplate(visibleSections, sectionStates);
  }, [visibleSections, sectionStates]);

  // Render cell content based on section type
  // All cells use truncation or line-clamp to prevent excessive wrapping
  const renderCell = (section) => {
    switch (section.id) {
      case SECTION_TYPES.SHOT_NUMBER:
        return (
          <div className="px-2 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={shot.shotNumber || '-'}>
            {shot.shotNumber || '-'}
          </div>
        );

      case SECTION_TYPES.SHOT_NAME:
        return (
          <div className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={shot.name || 'Untitled Shot'}>
            {shot.name || 'Untitled Shot'}
          </div>
        );

      case SECTION_TYPES.SHOT_TYPE:
        return (
          <div className="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 truncate" title={shot.type || '-'}>
            {shot.type || '-'}
          </div>
        );

      case SECTION_TYPES.DATE:
        return (
          <div className="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 truncate" title={shot.date || '-'}>
            {shot.date || '-'}
          </div>
        );

      case SECTION_TYPES.LOCATION:
        return (
          <div className="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 truncate" title={shot.location || '-'}>
            {shot.location || '-'}
          </div>
        );

      case SECTION_TYPES.TALENT: {
        const talentList = Array.isArray(shot.talent) ? shot.talent : [];
        const talentText = talentList.length > 0 ? talentList.join(', ') : '-';
        return (
          <div className="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 truncate" title={talentText}>
            {talentText}
          </div>
        );
      }

      case SECTION_TYPES.PRODUCTS: {
        const productList = Array.isArray(shot.products) ? shot.products : [];
        const productText = productList.length > 0 ? productList.join(', ') : '-';
        return (
          <div className="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 line-clamp-2" title={productText}>
            {productText}
          </div>
        );
      }

      case SECTION_TYPES.NOTES: {
        // Simple text rendering for preview (PDF has more complex rendering)
        const notesText = getShotNotesPreview(shot);
        return (
          <div className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2" title={notesText || '-'}>
            {notesText || '-'}
          </div>
        );
      }

      default:
        return <div className="px-2 py-2 text-xs">-</div>;
    }
  };

  return (
    <div
      className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      data-shot-id={shot.id || undefined}
    >
      <div className="flex gap-3 p-2">
        {/* Image column - smaller for table mode */}
        {showImage && (
          <div className="flex-shrink-0">
            {imagePath ? (
              <AppImage
                src={imagePath}
                alt={shot.name || 'Shot'}
                className="w-16 h-16 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden"
                imageClassName="w-full h-full"
                imageStyle={imageStyle}
                fit="cover"
                position={imagePosition}
              />
            ) : (
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="text-[10px] text-slate-400">No image</span>
              </div>
            )}
          </div>
        )}

        {/* Data columns - aligned with header grid */}
        <div
          className="flex-1 grid gap-1 items-center min-w-0"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {visibleSections
            .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
            .map(section => (
              <div key={section.id} className="min-w-0 overflow-hidden">
                {renderCell(section)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Preview of a single shot card in gallery mode
 */
function PreviewShotCardGallery({ shot, visibleSections, sectionStates }) {
  const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);
  const showShotNumber = visibleSections.some(s => s.id === SECTION_TYPES.SHOT_NUMBER);

  // Get primary image with crop positioning (S.4.1: includes zoom/rotation transform)
  const { path: primaryImagePath, style: cropStyle, objectPosition: primaryImagePosition } = getPrimaryAttachmentWithStyle(shot);
  const imagePath = primaryImagePath || shot.image || null;
  // Check if cropStyle contains a transform (zoom/rotation)
  const hasCropTransform = cropStyle && cropStyle.transform;
  const imagePosition = !hasCropTransform ? primaryImagePosition : undefined;
  const imageStyle = hasCropTransform ? cropStyle : undefined;

  return (
    <div
      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 hover:shadow-md transition-shadow flex flex-col"
      data-shot-id={shot.id || undefined}
    >
      {/* Image Section */}
      {showImage && (
        <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden">
          {imagePath ? (
            <AppImage
              src={imagePath}
              alt={shot.name || 'Shot'}
              className="w-full h-full"
              imageClassName="w-full h-full"
              imageStyle={imageStyle}
              fit={hasCropTransform ? "cover" : "contain"}
              position={imagePosition}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-slate-400">No image</span>
            </div>
          )}
          {/* Shot Number Badge - Positioned over image */}
          {showShotNumber && shot.shotNumber && (
            <div className="absolute top-2 right-2">
              <span className="text-xs font-semibold px-2 py-1 bg-slate-900/75 text-white rounded backdrop-blur-sm">
                {shot.shotNumber}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Details Section */}
      <div className="p-3 space-y-1.5 flex-1">
        {visibleSections
          .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE && s.id !== SECTION_TYPES.SHOT_NUMBER)
          .map(section => {
            let value = '';
            let label = section.label;

            switch (section.id) {
              case SECTION_TYPES.SHOT_NAME:
                value = shot.name || 'Untitled Shot';
                break;
              case SECTION_TYPES.SHOT_TYPE:
                value = shot.type || '-';
                break;
              case SECTION_TYPES.DATE:
                value = shot.date || '-';
                break;
              case SECTION_TYPES.LOCATION:
                value = shot.location || '-';
                break;
              case SECTION_TYPES.TALENT:
                const talentList = Array.isArray(shot.talent) ? shot.talent : [];
                value = talentList.length > 0 ? talentList.join(', ') : '-';
                break;
              case SECTION_TYPES.PRODUCTS:
                const productList = Array.isArray(shot.products) ? shot.products : [];
                value = productList.length > 0 ? productList.join(', ') : '-';
                break;
              case SECTION_TYPES.NOTES:
                value = getShotNotesPreview(shot) || '-';
                break;
              default:
                value = '-';
            }

            // Special rendering for shot name (make it prominent)
            if (section.id === SECTION_TYPES.SHOT_NAME) {
              return (
                <div key={section.id} className="pb-1 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {value}
                  </h4>
                </div>
              );
            }

            return (
              <div key={section.id} className="text-xs leading-relaxed">
                <span className="font-medium text-slate-600 dark:text-slate-400">{label}:</span>
                {' '}
                <span className="text-slate-900 dark:text-slate-100">{value}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/**
 * Preview table header row (for table mode)
 */
function PreviewHeaderRow({ visibleSections, sectionStates, customLabels = {} }) {
  const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);

  // Use the same grid template function as rows for consistency
  const gridTemplate = useMemo(() => {
    return buildTableGridTemplate(visibleSections, sectionStates);
  }, [visibleSections, sectionStates]);

  return (
    <div className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600 sticky top-0 z-10">
      <div className="flex gap-3 p-2">
        {/* Image column header */}
        {showImage && (
          <div className="flex-shrink-0 w-16">
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              {customLabels[SECTION_TYPES.IMAGE] || 'Image'}
            </span>
          </div>
        )}

        {/* Data column headers */}
        <div
          className="flex-1 grid gap-1 min-w-0"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {visibleSections
            .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
            .map(section => {
              const label = customLabels[section.id] || section.label;
              return (
                <div key={section.id} className="px-2 py-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate block">
                    {label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/**
 * Preview of a lane group
 *
 * @param {Object} props
 * @param {Object} props.lane - Lane data with shots
 * @param {Array} props.visibleSections - Visible sections
 * @param {Object} props.sectionStates - Section states
 * @param {string} props.layoutMode - 'table' or 'gallery'
 * @param {string} props.density - Layout density
 * @param {string} props.orientation - Page orientation
 * @param {number} props.galleryColumns - Column count for gallery
 * @param {number} props.startIndex - Global starting index for shots in this lane
 * @param {Set} props.breakIndexSet - Set of global indices where page breaks occur
 * @param {boolean} props.showPageBreaks - Whether to show page break markers
 */
function PreviewLaneGroup({
  lane,
  visibleSections,
  sectionStates,
  layoutMode,
  density = 'standard',
  orientation = 'portrait',
  galleryColumns,
  startIndex = 0,
  breakIndexSet = new Set(),
  showPageBreaks = false,
}) {
  const laneShots = Array.isArray(lane.shots) ? lane.shots : [];

  // Calculate layout using the same function as PDF renderer
  const layoutConfig = useMemo(() => {
    if (layoutMode !== 'gallery') return null;
    return calculateLayout(density, laneShots.length, orientation);
  }, [density, laneShots.length, orientation, layoutMode]);

  // Use explicit galleryColumns if provided, otherwise use calculated columns from layout
  const columns = galleryColumns || layoutConfig?.columns || 3;

  // Helper to calculate page number for a break
  const getPageNumber = (globalIndex) => {
    let page = 2; // First break leads to page 2
    const sortedBreaks = Array.from(breakIndexSet).sort((a, b) => a - b);
    for (const breakIdx of sortedBreaks) {
      if (breakIdx < globalIndex) page++;
      else break;
    }
    return page;
  };

  // Render shots with page break markers interspersed
  const renderShotsWithBreaks = (ShotComponent, containerProps = {}) => {
    const elements = [];

    laneShots.forEach((shot, localIdx) => {
      const globalIndex = startIndex + localIdx;

      // Check if there's a page break BEFORE this shot
      if (showPageBreaks && breakIndexSet.has(globalIndex)) {
        elements.push(
          <PageBreakMarker key={`break-${globalIndex}`} pageNumber={getPageNumber(globalIndex)} />
        );
      }

      elements.push(
        <ShotComponent
          key={shot.id || localIdx}
          shot={shot}
          visibleSections={visibleSections}
          sectionStates={sectionStates}
        />
      );
    });

    return elements;
  };

  return (
    <div className="mb-8">
      {/* Lane Title */}
      <div className="px-4 py-3 bg-slate-200 dark:bg-slate-700 border-y border-slate-300 dark:border-slate-600">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {lane.name} ({laneShots.length} {laneShots.length === 1 ? 'shot' : 'shots'})
        </h3>
      </div>

      {/* Shots */}
      {laneShots.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No shots in this lane
        </div>
      ) : layoutMode === 'gallery' ? (
        <div className="p-4">
          {/* Gallery mode with page breaks */}
          {showPageBreaks && breakIndexSet.size > 0 ? (
            // Render with page breaks interspersed
            (() => {
              const elements = [];
              let currentGridShots = [];

              const flushGrid = () => {
                if (currentGridShots.length > 0) {
                  elements.push(
                    <div
                      key={`grid-${elements.length}`}
                      className="grid gap-4 mb-4"
                      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                    >
                      {currentGridShots}
                    </div>
                  );
                  currentGridShots = [];
                }
              };

              laneShots.forEach((shot, localIdx) => {
                const globalIndex = startIndex + localIdx;

                // Check if there's a page break BEFORE this shot
                if (breakIndexSet.has(globalIndex)) {
                  flushGrid();
                  elements.push(
                    <PageBreakMarker key={`break-${globalIndex}`} pageNumber={getPageNumber(globalIndex)} />
                  );
                }

                currentGridShots.push(
                  <PreviewShotCardGallery
                    key={shot.id || localIdx}
                    shot={shot}
                    visibleSections={visibleSections}
                    sectionStates={sectionStates}
                  />
                );
              });

              flushGrid();
              return elements;
            })()
          ) : (
            // Simple grid without page breaks
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {laneShots.map((shot, idx) => (
                <PreviewShotCardGallery
                  key={shot.id || idx}
                  shot={shot}
                  visibleSections={visibleSections}
                  sectionStates={sectionStates}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Table mode: overflow-x-auto for horizontal scroll if columns don't fit */
        <div className="border-l border-r border-slate-200 dark:border-slate-700 overflow-x-auto">
          <div className="min-w-fit">
            {renderShotsWithBreaks(PreviewShotCardList)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main preview component
 *
 * @param {Object} props - Component props
 * @param {Array} props.lanes - Array of lane objects with shots
 * @param {Object} props.sectionStates - Section visibility states
 * @param {string} props.layoutMode - 'table' or 'gallery'
 * @param {string} props.orientation - 'portrait' or 'landscape'
 * @param {string} props.density - 'compact', 'standard', or 'detailed'
 * @param {number} props.galleryColumns - Optional explicit column count for gallery mode
 * @param {string} props.title - Document title
 * @param {string} props.subtitle - Document subtitle
 * @param {Object} props.customLabels - Custom header labels mapping
 * @param {boolean} props.showPageBreaks - Whether to show page break markers
 * @param {boolean} props.includeImages - Whether images are included (affects page break calculation)
 */
export default function PlannerSheetPreview({
  lanes,
  sectionStates,
  layoutMode = 'table',
  orientation = 'portrait',
  density = 'standard',
  galleryColumns,
  title = '',
  subtitle = '',
  customLabels = {},
  showPageBreaks = true,
  includeImages = true,
}) {
  // Get visible sections
  const visibleSections = useMemo(() => {
    return getVisibleSections(sectionStates);
  }, [sectionStates]);

  // Check if header section is visible
  const showHeader = sectionStates[SECTION_TYPES.HEADER]?.visible !== false;

  // Check if there are any lanes/shots
  const exportLanes = Array.isArray(lanes) ? lanes : [];
  const hasShots = exportLanes.some(lane =>
    Array.isArray(lane.shots) && lane.shots.length > 0
  );

  // Calculate page dimensions based on orientation for accurate aspect ratio
  const pageDimensions = getPageDimensions(orientation);
  const isLandscape = orientation === 'landscape';

  // Flatten all shots for page break calculation
  const allShots = useMemo(() => {
    return exportLanes.flatMap(lane => lane.shots || []);
  }, [exportLanes]);

  // Calculate page breaks
  const pageBreakInfo = useMemo(() => {
    if (!showPageBreaks || allShots.length === 0) {
      return { breakIndices: [], totalPages: 1, shotsPerPage: 0 };
    }
    return calculatePageBreaks(allShots, {
      layoutMode,
      density,
      orientation,
      includeImages,
    });
  }, [allShots, showPageBreaks, layoutMode, density, orientation, includeImages]);

  // Create a set for quick lookup of break indices
  const breakIndexSet = useMemo(() => {
    return new Set(pageBreakInfo.breakIndices);
  }, [pageBreakInfo.breakIndices]);

  if (!hasShots) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            No shots to preview
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">
            Adjust your filters or add shots to see the preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-slate-900 shadow-lg mx-auto"
      style={{
        // Correct dimensions: portrait = 8.5"x11", landscape = 11"x8.5"
        maxWidth: isLandscape ? '11in' : '8.5in',
        minHeight: isLandscape ? '8.5in' : '11in',
        // Maintain correct aspect ratio for the preview
        aspectRatio: `${pageDimensions.width} / ${pageDimensions.height}`,
      }}
    >
      {/* Page Info Banner */}
      {showPageBreaks && pageBreakInfo.totalPages > 1 && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <FileText className="w-4 h-4" />
            <span>
              This export will span <strong>{pageBreakInfo.totalPages} pages</strong>
              {pageBreakInfo.shotsPerPage > 0 && (
                <span className="text-blue-600 dark:text-blue-400 ml-1">
                  (~{pageBreakInfo.shotsPerPage} shots per page)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Document Header */}
      {showHeader && (title || subtitle) && (
        <div className="border-b-2 border-slate-300 dark:border-slate-600 p-6 bg-slate-50 dark:bg-slate-800">
          {title && (
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <h2 className="text-lg text-slate-700 dark:text-slate-300 mb-2">
              {subtitle}
            </h2>
          )}
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-3">
            <span>Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Main Header Row (table mode only) */}
      {layoutMode === 'table' && (
        <PreviewHeaderRow
          visibleSections={visibleSections}
          sectionStates={sectionStates}
          customLabels={customLabels}
        />
      )}

      {/* Content - Lane Groups with page breaks */}
      <div className="p-4">
        {(() => {
          let runningIndex = 0;
          return exportLanes.map((lane, idx) => {
            const laneStartIndex = runningIndex;
            const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
            runningIndex += laneShots.length;

            return (
              <PreviewLaneGroup
                key={lane.id || idx}
                lane={lane}
                visibleSections={visibleSections}
                sectionStates={sectionStates}
                layoutMode={layoutMode}
                density={density}
                orientation={orientation}
                galleryColumns={galleryColumns}
                startIndex={laneStartIndex}
                breakIndexSet={breakIndexSet}
                showPageBreaks={showPageBreaks}
              />
            );
          });
        })()}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p className="flex items-center justify-center gap-3">
          <span>
            Total Shots: {allShots.length}
          </span>
          {showPageBreaks && pageBreakInfo.totalPages > 1 && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>
                Estimated Pages: {pageBreakInfo.totalPages}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
