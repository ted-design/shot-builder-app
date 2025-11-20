// src/components/planner/PlannerSheetPreview.jsx
//
// HTML preview component that matches PDF output for planner sheets
// Provides WYSIWYG preview of planner sheet configuration

import React, { useMemo } from 'react';
import {
  SECTION_TYPES,
  SECTION_CONFIG,
  getVisibleSections,
} from '../../lib/plannerSheetSections';
import AppImage from '../common/AppImage';
import { getPrimaryAttachmentWithStyle } from '../../lib/imageHelpers';

/**
 * Preview of a single shot card in table mode
 */
function PreviewShotCardList({ shot, visibleSections, sectionStates }) {
  const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);
  const showShotNumber = visibleSections.some(s => s.id === SECTION_TYPES.SHOT_NUMBER);

  // Get primary image with crop styling
  const { path: imagePath, style: imageStyle } = getPrimaryAttachmentWithStyle(shot);

  // Build flex string for CSS grid (only for columns that are visible)
  const gridTemplate = useMemo(() => {
    return visibleSections
      .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
      .map(section => {
        const flex = sectionStates[section.id]?.flex ?? section.flex ?? 1;
        return `${flex}fr`;
      })
      .join(' ');
  }, [visibleSections, sectionStates]);

  // Render cell content based on section type
  const renderCell = (section) => {
    switch (section.id) {
      case SECTION_TYPES.SHOT_NUMBER:
        return (
          <div className="px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {shot.shotNumber || '-'}
          </div>
        );

      case SECTION_TYPES.SHOT_NAME:
        return (
          <div className="px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {shot.name || 'Untitled Shot'}
          </div>
        );

      case SECTION_TYPES.SHOT_TYPE:
        return (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
            {shot.type || '-'}
          </div>
        );

      case SECTION_TYPES.DATE:
        return (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
            {shot.date || '-'}
          </div>
        );

      case SECTION_TYPES.LOCATION:
        return (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
            {shot.location || '-'}
          </div>
        );

      case SECTION_TYPES.TALENT:
        const talentList = Array.isArray(shot.talent) ? shot.talent : [];
        return (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
            {talentList.length > 0 ? talentList.join(', ') : '-'}
          </div>
        );

      case SECTION_TYPES.PRODUCTS:
        const productList = Array.isArray(shot.products) ? shot.products : [];
        return (
          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
            {productList.length > 0 ? productList.join(', ') : '-'}
          </div>
        );

      case SECTION_TYPES.NOTES:
        // Simple text rendering for preview (PDF has more complex rendering)
        const notesText = shot.notes
          ? shot.notes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';
        return (
          <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
            {notesText || '-'}
          </div>
        );

      default:
        return <div className="px-3 py-2 text-sm">-</div>;
    }
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex gap-4 p-3">
        {/* Image column */}
        {showImage && (
          <div className="flex-shrink-0">
            {imagePath ? (
              <AppImage
                src={imagePath}
                alt={shot.name || 'Shot'}
                className="w-20 h-16 object-cover rounded border border-slate-200 dark:border-slate-700"
                style={imageStyle}
              />
            ) : (
              <div className="w-20 h-16 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="text-xs text-slate-400">No image</span>
              </div>
            )}
          </div>
        )}

        {/* Data columns */}
        <div
          className="flex-1 grid gap-2 items-center min-w-0"
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

  // Get primary image with crop styling
  const { path: imagePath, style: imageStyle } = getPrimaryAttachmentWithStyle(shot);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 hover:shadow-md transition-shadow flex flex-col">
      {/* Image Section */}
      {showImage && (
        <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex-shrink-0">
          {imagePath ? (
            <AppImage
              src={imagePath}
              alt={shot.name || 'Shot'}
              className="w-full h-full object-cover"
              style={imageStyle}
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
                const notesText = shot.notes
                  ? shot.notes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                  : '';
                value = notesText || '-';
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
function PreviewHeaderRow({ visibleSections, sectionStates }) {
  const showImage = visibleSections.some(s => s.id === SECTION_TYPES.IMAGE);

  const gridTemplate = useMemo(() => {
    return visibleSections
      .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
      .map(section => {
        const flex = sectionStates[section.id]?.flex ?? section.flex ?? 1;
        return `${flex}fr`;
      })
      .join(' ');
  }, [visibleSections, sectionStates]);

  return (
    <div className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600 sticky top-0 z-10">
      <div className="flex gap-4 p-3">
        {/* Image column header */}
        {showImage && (
          <div className="flex-shrink-0 w-20">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Image
            </span>
          </div>
        )}

        {/* Data column headers */}
        <div
          className="flex-1 grid gap-2"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {visibleSections
            .filter(s => s.category === 'columns' && s.id !== SECTION_TYPES.IMAGE)
            .map(section => (
              <div key={section.id} className="px-3 py-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">
                  {section.label}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Preview of a lane group
 */
function PreviewLaneGroup({ lane, visibleSections, sectionStates, layoutMode }) {
  const laneShots = Array.isArray(lane.shots) ? lane.shots : [];

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
        <div className="grid grid-cols-3 gap-4 p-4">
          {laneShots.map((shot, idx) => (
            <PreviewShotCardGallery
              key={shot.id || idx}
              shot={shot}
              visibleSections={visibleSections}
              sectionStates={sectionStates}
            />
          ))}
        </div>
      ) : (
        <div className="border-l border-r border-slate-200 dark:border-slate-700">
          {laneShots.map((shot, idx) => (
            <PreviewShotCardList
              key={shot.id || idx}
              shot={shot}
              visibleSections={visibleSections}
              sectionStates={sectionStates}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main preview component
 */
export default function PlannerSheetPreview({
  lanes,
  sectionStates,
  layoutMode = 'table',
  orientation = 'portrait',
  title = '',
  subtitle = '',
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
      className={`
        bg-white dark:bg-slate-900 shadow-lg
        ${orientation === 'landscape' ? 'max-w-[11in]' : 'max-w-[8.5in]'}
        mx-auto min-h-[11in]
      `}
    >
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
        />
      )}

      {/* Content - Lane Groups */}
      <div className="p-4">
        {exportLanes.map((lane, idx) => (
          <PreviewLaneGroup
            key={lane.id || idx}
            lane={lane}
            visibleSections={visibleSections}
            sectionStates={sectionStates}
            layoutMode={layoutMode}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Total Shots: {exportLanes.reduce((sum, lane) => {
            return sum + (Array.isArray(lane.shots) ? lane.shots.length : 0);
          }, 0)}
        </p>
      </div>
    </div>
  );
}
