/**
 * PDF Preview Component
 *
 * Provides a WYSIWYG preview of the PDF export layout.
 * Renders identical layout to the PDF output using HTML/CSS.
 */

import React, { useMemo } from 'react';
import {
  calculateLayout,
  distributeCardsAcrossPages,
  getCardPosition,
  PAGE_DIMENSIONS,
  PAGE_MARGINS,
} from '../../lib/pdfLayoutCalculator';

/**
 * Shot Card Preview Component
 * Renders a single shot card matching PDF layout
 */
function ShotCardPreview({ shot, preset, cardIndex, layout }) {
  const position = getCardPosition(cardIndex, layout);
  const { fontSize, imageHeight, cardPadding, showAllFields } = preset;

  // Calculate object-position for image crop
  const objectPosition = shot.referenceImageCrop
    ? `${shot.referenceImageCrop.x}% ${shot.referenceImageCrop.y}%`
    : '50% 50%';

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

      {/* Shot Title */}
      <div
        style={{
          fontSize: `${fontSize.title}px`,
          fontWeight: 600,
          color: '#111827',
          marginBottom: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {shot.shotNumber ? `Shot ${shot.shotNumber}` : shot.name || 'Untitled Shot'}
      </div>

      {/* Details */}
      <div style={{ fontSize: `${fontSize.label}px`, color: '#64748b' }}>
        {/* Location */}
        {shot.location && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span style={{ marginRight: '6px', fontSize: '10px' }}>📍</span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shot.location}
            </span>
          </div>
        )}

        {/* Talent */}
        {shot.talent && shot.talent.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span style={{ marginRight: '6px', fontSize: '10px' }}>👤</span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shot.talent.join(', ')}
            </span>
          </div>
        )}

        {/* Date (only in detailed view) */}
        {showAllFields && shot.scheduledDate && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span style={{ marginRight: '6px', fontSize: '10px' }}>📅</span>
            <span>{shot.scheduledDate}</span>
          </div>
        )}

        {/* Shot Type (only in detailed view) */}
        {showAllFields && shot.shotType && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span style={{ marginRight: '6px', fontSize: '10px' }}>🎬</span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shot.shotType}
            </span>
          </div>
        )}
      </div>
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
