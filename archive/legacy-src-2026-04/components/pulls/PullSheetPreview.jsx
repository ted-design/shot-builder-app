// src/components/pulls/PullSheetPreview.jsx
//
// HTML preview component that matches PDF output
// Provides WYSIWYG preview of pull sheet configuration

import React, { useMemo } from 'react';
import {
  SECTION_TYPES,
  SECTION_CONFIG,
  sectionConfigToExportSettings,
  getVisibleSections,
  PAGE_BREAK_STRATEGIES,
} from '../../lib/pullSheetSections';
import { formatPullForPDF } from '../../lib/pullExport';
import { normalizePullItem } from '../../lib/pullItems';

/**
 * Preview of a single pull item row
 */
function PreviewItemRow({ item, visibleSections, sectionStates, includeImages }) {
  // Build flex string for CSS grid
  const gridTemplate = useMemo(() => {
    return visibleSections
      .filter(s => s.category === 'columns')
      .map(section => {
        if (section.id === SECTION_TYPES.IMAGES && !includeImages) {
          return null;
        }
        const flex = sectionStates[section.id]?.flex ?? section.flex ?? 1;
        return `${flex}fr`;
      })
      .filter(Boolean)
      .join(' ');
  }, [visibleSections, sectionStates, includeImages]);

  // Render cell content based on section type
  const renderCell = (section) => {
    switch (section.id) {
      case SECTION_TYPES.IMAGES:
        if (!includeImages) return null;
        return (
          <div className="flex items-center justify-center p-1">
            {item.image ? (
              <img
                src={item.image}
                alt={item.familyName || 'Product'}
                className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="text-xs text-slate-400">No image</span>
              </div>
            )}
          </div>
        );

      case SECTION_TYPES.PRODUCT:
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 truncate">
            {item.familyName || '-'}
          </div>
        );

      case SECTION_TYPES.STYLE_NUMBER:
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 truncate">
            {item.styleNumber || '-'}
          </div>
        );

      case SECTION_TYPES.COLOUR:
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 truncate">
            {item.colourName || '-'}
          </div>
        );

      case SECTION_TYPES.GENDER:
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 truncate capitalize">
            {item.gender || '-'}
          </div>
        );

      case SECTION_TYPES.SIZE:
        const sizesText = item.sizes
          ? item.sizes.map(s => s.size).join(', ')
          : '-';
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 truncate">
            {sizesText}
          </div>
        );

      case SECTION_TYPES.QUANTITY:
        const totalQty = item.sizes
          ? item.sizes.reduce((sum, s) => sum + s.quantity, 0)
          : 0;
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 text-center">
            {totalQty}
          </div>
        );

      case SECTION_TYPES.FULFILLED:
        const totalFulfilled = item.sizes
          ? item.sizes.reduce((sum, s) => sum + (s.fulfilled || 0), 0)
          : 0;
        return (
          <div className="px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 text-center">
            {totalFulfilled}
          </div>
        );

      case SECTION_TYPES.NOTES:
        return (
          <div className="px-2 py-1.5 text-sm text-slate-600 dark:text-slate-400 truncate">
            {item.notes || '-'}
          </div>
        );

      default:
        return <div className="px-2 py-1.5 text-sm">-</div>;
    }
  };

  return (
    <div
      className="grid border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {visibleSections
        .filter(s => s.category === 'columns')
        .map(section => (
          <div key={section.id} className="min-w-0">
            {renderCell(section)}
          </div>
        ))}
    </div>
  );
}

/**
 * Preview table header row
 */
function PreviewHeaderRow({ visibleSections, sectionStates, includeImages }) {
  const gridTemplate = useMemo(() => {
    return visibleSections
      .filter(s => s.category === 'columns')
      .map(section => {
        if (section.id === SECTION_TYPES.IMAGES && !includeImages) {
          return null;
        }
        const flex = sectionStates[section.id]?.flex ?? section.flex ?? 1;
        return `${flex}fr`;
      })
      .filter(Boolean)
      .join(' ');
  }, [visibleSections, sectionStates, includeImages]);

  return (
    <div
      className="grid bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600 sticky top-0 z-10"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {visibleSections
        .filter(s => s.category === 'columns')
        .map(section => {
          if (section.id === SECTION_TYPES.IMAGES && !includeImages) {
            return null;
          }
          return (
            <div
              key={section.id}
              className="px-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate"
            >
              {section.label}
            </div>
          );
        })}
    </div>
  );
}

/**
 * Preview of a group of items
 */
function PreviewGroup({ group, visibleSections, sectionStates, includeImages, showGroupHeader }) {
  return (
    <div className="mb-6">
      {/* Group Title */}
      {group.title && (
        <div className="px-4 py-2 bg-slate-200 dark:bg-slate-700 border-y border-slate-300 dark:border-slate-600">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            {group.title}
          </h4>
        </div>
      )}

      {/* Group Header (optional) */}
      {showGroupHeader && (
        <PreviewHeaderRow
          visibleSections={visibleSections}
          sectionStates={sectionStates}
          includeImages={includeImages}
        />
      )}

      {/* Items */}
      <div className="border-l border-r border-slate-200 dark:border-slate-700">
        {group.items.map((item, idx) => (
          <PreviewItemRow
            key={`${item.id || idx}`}
            item={item}
            visibleSections={visibleSections}
            sectionStates={sectionStates}
            includeImages={includeImages}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Main preview component
 */
export default function PullSheetPreview({
  pull,
  sectionStates,
  orientation = 'portrait',
  pageBreakStrategy = PAGE_BREAK_STRATEGIES.AUTO,
  headerText = '',
  subheaderText = '',
}) {
  // Get export settings from section configuration
  const settings = useMemo(() => {
    return sectionConfigToExportSettings(sectionStates, orientation, pageBreakStrategy);
  }, [sectionStates, orientation, pageBreakStrategy]);

  // Format pull data using existing export logic
  const formattedPull = useMemo(() => {
    return formatPullForPDF(pull, {
      ...settings,
      headerText: headerText.trim(),
      subheaderText: subheaderText.trim(),
    });
  }, [pull, settings, headerText, subheaderText]);

  // Get visible sections
  const visibleSections = useMemo(() => {
    return getVisibleSections(sectionStates);
  }, [sectionStates]);

  // Check if header section is visible
  const showHeader = sectionStates[SECTION_TYPES.HEADER]?.visible !== false;
  const includeImages = settings.includeImages;
  const groupHeaderEachSection = settings.groupHeaderEachSection ?? true;

  // Check if there are any items
  if (!formattedPull.groupedItems || formattedPull.groupedItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            No items to preview
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">
            Add items to this pull to see the preview
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
      {showHeader && (headerText || subheaderText || pull.title) && (
        <div className="border-b-2 border-slate-300 dark:border-slate-600 p-6 bg-slate-50 dark:bg-slate-800">
          {headerText && (
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {headerText}
            </h1>
          )}
          {subheaderText && (
            <h2 className="text-lg text-slate-700 dark:text-slate-300 mb-2">
              {subheaderText}
            </h2>
          )}
          {!headerText && pull.title && (
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {pull.title}
            </h1>
          )}
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-3">
            <span>Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Main Header Row (always shown if not grouped) */}
      {!groupHeaderEachSection && (
        <PreviewHeaderRow
          visibleSections={visibleSections}
          sectionStates={sectionStates}
          includeImages={includeImages}
        />
      )}

      {/* Content */}
      <div className="p-4">
        {formattedPull.groupedItems.map((group, idx) => (
          <PreviewGroup
            key={idx}
            group={group}
            visibleSections={visibleSections}
            sectionStates={sectionStates}
            includeImages={includeImages}
            showGroupHeader={groupHeaderEachSection || idx === 0}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Total Items: {formattedPull.items?.length || 0} |
          Total Quantity: {formattedPull.items?.reduce((sum, item) => {
            return sum + (item.sizes?.reduce((s, sz) => s + sz.quantity, 0) || 0);
          }, 0) || 0}
        </p>
      </div>
    </div>
  );
}
