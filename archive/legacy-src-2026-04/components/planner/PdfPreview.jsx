/**
 * PDF Preview Component
 *
 * Provides a WYSIWYG preview of the PDF export layout.
 * Renders identical layout to the PDF output using HTML/CSS.
 *
 * V2: Editorial layout with hierarchy:
 * Title → Description → Meta Strip → Products → Notes
 */

import React, { useMemo } from 'react';
import {
  calculateLayout,
  distributeCardsAcrossPages,
  getCardPosition,
  PAGE_DIMENSIONS,
  PAGE_MARGINS,
} from '../../lib/pdfLayoutCalculator';
import { getExportDescriptionText } from '../../lib/shotDescription';
import { getShotNotesPreview } from '../../lib/shotNotes';

/**
 * Shot Card Preview Component (V2 Editorial Layout)
 * Renders a single shot card matching PDF layout
 * Hierarchy: Title → Description → Meta Strip → Products → Notes
 */
function ShotCardPreview({ shot, preset, cardIndex, layout }) {
  const position = getCardPosition(cardIndex, layout);
  const { fontSize, imageHeight, cardPadding } = preset;
  const isCompact = layout.columns >= 3;

  // Calculate object-position for image crop
  const objectPosition = shot.referenceImageCrop
    ? `${shot.referenceImageCrop.x}% ${shot.referenceImageCrop.y}%`
    : '50% 50%';

  // Prepare data
  const productList = Array.isArray(shot.products) ? shot.products : [];
  const talentList = Array.isArray(shot.talent) ? shot.talent : [];

  // Get description using centralized resolver
  const descriptionText = getExportDescriptionText(shot, { products: productList });

  // Build meta strip items
  const metaItems = [];
  if (shot.location) metaItems.push(shot.location);
  if (talentList.length > 0) metaItems.push(talentList.join(', '));
  if (shot.scheduledDate || shot.date) metaItems.push(shot.scheduledDate || shot.date);

  // Products: cap at 2 items with "+N more"
  const MAX_PRODUCTS = 2;
  const productsToShow = productList.slice(0, MAX_PRODUCTS);
  const remainingProducts = productList.length - MAX_PRODUCTS;

  // Notes: deterministic truncation at 120 chars (matches PDF export)
  const GALLERY_NOTES_MAX_CHARS = 120;
  const rawNotes = getShotNotesPreview(shot) || '';
  const truncatedNotes = rawNotes.length > GALLERY_NOTES_MAX_CHARS
    ? rawNotes.slice(0, GALLERY_NOTES_MAX_CHARS).trim() + '…'
    : rawNotes;

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: `${cardPadding}px`,
        marginRight: `${position.marginRight}px`,
        marginBottom: `${position.marginBottom}px`,
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Image */}
      {shot.image && (
        <div
          style={{
            width: '100%',
            height: `${imageHeight}px`,
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px',
            backgroundColor: '#f3f4f6',
          }}
        >
          <img
            src={shot.image.path || shot.image}
            alt={shot.name || 'Shot'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition,
            }}
            loading="lazy"
          />
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontSize: `${isCompact ? fontSize.title - 1 : fontSize.title}px`,
          fontWeight: 600,
          color: '#111827',
          marginBottom: '3px',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
      </div>

      {/* Description */}
      {descriptionText && (
        <div
          style={{
            fontSize: `${isCompact ? 8 : 8.5}px`,
            color: '#64748b',
            marginBottom: '4px',
            lineHeight: 1.35,
          }}
        >
          {descriptionText}
        </div>
      )}

      {/* Meta Strip: Location · Talent · Date (inline with separators) */}
      {metaItems.length > 0 && (
        <div
          style={{
            fontSize: `${isCompact ? 7.5 : 8}px`,
            color: '#64748b',
            marginBottom: '4px',
            lineHeight: 1.4,
          }}
        >
          {metaItems.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: '#cbd5e1', margin: '0 4px' }}>·</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Products (capped at 2 + "+N more") */}
      {productsToShow.length > 0 && (
        <div style={{ marginBottom: '3px' }}>
          {productsToShow.map((product, idx) => (
            <div
              key={idx}
              style={{
                fontSize: `${isCompact ? 7.5 : 8}px`,
                color: '#1f2937',
                lineHeight: 1.3,
                marginBottom: '1px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>• </span>
              {product}
            </div>
          ))}
          {remainingProducts > 0 && (
            <div
              style={{
                fontSize: '7.5px',
                color: '#94a3b8',
                fontStyle: 'italic',
                marginTop: '1px',
              }}
            >
              +{remainingProducts} more
            </div>
          )}
        </div>
      )}

      {/* Notes (truncated callout) */}
      {truncatedNotes && (
        <div
          style={{
            marginTop: '3px',
            padding: `${isCompact ? '2px 3px' : '3px 4px'}`,
            backgroundColor: '#f8fafc',
            borderRadius: '3px',
          }}
        >
          <div
            style={{
              fontSize: `${isCompact ? 7 : 7.5}px`,
              color: '#64748b',
              lineHeight: 1.3,
            }}
          >
            {truncatedNotes}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PDF Page Preview Component
 * Renders a single page with its shots
 */
function PagePreview({ shots, layout, pageNumber, pageDimensions }) {
  const { preset } = layout;

  return (
    <div
      className="pdf-preview-page"
      style={{
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
        backgroundColor: 'white',
        padding: `${PAGE_MARGINS.top}px ${PAGE_MARGINS.right}px ${PAGE_MARGINS.bottom}px ${PAGE_MARGINS.left}px`,
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Page Number */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          fontSize: '10px',
          color: '#9ca3af',
          fontWeight: 500,
        }}
      >
        Page {pageNumber}
      </div>

      {/* Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          gap: `${layout.gap.vertical}px ${layout.gap.horizontal}px`,
          height: '100%',
          alignContent: 'start',
        }}
      >
        {shots.map((shot, index) => (
          <ShotCardPreview
            key={shot.id || index}
            shot={shot}
            preset={preset}
            cardIndex={index}
            layout={layout}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * PDF Preview Container Component
 */
export default function PdfPreview({ shots, densityId, zoom = 1.0, orientation = 'portrait' }) {
  // Calculate page dimensions based on orientation
  const pageDimensions = useMemo(() => {
    if (orientation === 'landscape') {
      return {
        width: PAGE_DIMENSIONS.height,  // 792
        height: PAGE_DIMENSIONS.width,  // 612
      };
    }
    return PAGE_DIMENSIONS;  // Portrait: 612x792
  }, [orientation]);

  // Calculate layout with orientation-specific dimensions
  const layout = useMemo(
    () => calculateLayout(densityId, shots.length),
    [densityId, shots.length]
  );

  // Distribute shots across pages
  const pages = useMemo(
    () => distributeCardsAcrossPages(shots, layout),
    [shots, layout]
  );

  if (!shots || shots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No shots to preview</p>
          <p className="text-sm">Select shots to see the PDF preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-preview-container bg-gray-100 p-6 rounded-lg overflow-auto max-h-[80vh]">
      {/* Summary Info */}
      <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Density:</span>{' '}
            <span className="text-gray-900">{layout.preset.label}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Grid:</span>{' '}
            <span className="text-gray-900">
              {layout.columns} × {layout.rows}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Cards per page:</span>{' '}
            <span className="text-gray-900">{layout.cardsPerPage}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Total pages:</span>{' '}
            <span className="text-gray-900">{layout.totalPages}</span>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div
        className="flex flex-col items-center"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'transform 0.2s ease-in-out',
        }}
      >
        {pages.map((pageShots, pageIndex) => (
          <PagePreview
            key={pageIndex}
            shots={pageShots}
            layout={layout}
            pageNumber={pageIndex + 1}
            pageDimensions={pageDimensions}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Zoom Control Component
 */
export function PdfPreviewZoomControls({ zoom, onZoomChange }) {
  const zoomLevels = [0.5, 0.75, 1.0, 1.25];

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
      <span className="text-sm font-medium text-gray-700">Zoom:</span>
      {zoomLevels.map((level) => (
        <button
          key={level}
          onClick={() => onZoomChange(level)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            zoom === level
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {Math.round(level * 100)}%
        </button>
      ))}
    </div>
  );
}
