/**
 * SKUColorSelector - Interactive color circles for selecting SKU variants
 * Features:
 * - Lazy color extraction if hexColor missing
 * - Loading states for extraction
 * - Hover tooltips showing color name
 * - Active state ring around selected circle
 * - Keyboard accessible
 */
import React, { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { getSkuColor } from '../../lib/colorExtraction';
import AppImage from "../common/AppImage";
import { resolveSwatchForSku } from "../../lib/colorPalette";

export default function SKUColorSelector({
  skus = [],
  currentSkuId,
  onColorSelect,
  size = 24,
  gap = 8,
  paletteIndex = null,
}) {
  const [swatches, setSwatches] = useState({});
  const [loadingColors, setLoadingColors] = useState(new Set());
  const [errors, setErrors] = useState(new Set());

  // Extract colors for SKUs that don't have hexColor
  const extractColors = useCallback(async () => {
    const skusNeedingExtraction = skus.filter(
      (sku) => !swatches[sku.id] && !loadingColors.has(sku.id) && !errors.has(sku.id)
    );

    if (skusNeedingExtraction.length === 0) return;

    // Mark as loading
    setLoadingColors((prev) => {
      const next = new Set(prev);
      skusNeedingExtraction.forEach((sku) => next.add(sku.id));
      return next;
    });

    // Extract colors in parallel
    const extractions = skusNeedingExtraction.map(async (sku) => {
      try {
        const swatch = await resolveSwatchForSku(sku, paletteIndex, {
          extractFallback: getSkuColor,
        });
        return { skuId: sku.id, swatch, error: false };
      } catch (err) {
        console.error(`Failed to extract color for SKU ${sku.id}:`, err);
        return { skuId: sku.id, swatch: null, error: true };
      }
    });

    const results = await Promise.all(extractions);

    // Update state with results
    const newColors = {};
    const newErrors = new Set();

    results.forEach(({ skuId, swatch, error }) => {
      if (error) {
        newErrors.add(skuId);
      } else if (swatch?.hexColor) {
        newColors[skuId] = swatch;
      }
    });

    setSwatches((prev) => ({ ...prev, ...newColors }));
    setErrors((prev) => new Set([...prev, ...newErrors]));

    // Clear loading state
    setLoadingColors((prev) => {
      const next = new Set(prev);
      skusNeedingExtraction.forEach((sku) => next.delete(sku.id));
      return next;
    });
  }, [skus, swatches, loadingColors, errors, paletteIndex]);

  // Extract colors on mount and when skus change
  useEffect(() => {
    extractColors();
  }, [extractColors]);

  // Reset when palette index changes significantly (e.g., swatch updates)
  useEffect(() => {
    setSwatches({});
    setErrors(new Set());
    setLoadingColors(new Set());
  }, [paletteIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setSwatches({});
      setLoadingColors(new Set());
      setErrors(new Set());
    };
  }, []);

  if (!skus || skus.length === 0) {
    return null;
  }

  const handleClick = (sku) => {
    if (onColorSelect) {
      onColorSelect(sku.id);
    }
  };

  const handleKeyDown = (event, sku) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(sku);
    }
  };

  return (
    <div className="flex items-center flex-wrap" style={{ gap: `${gap}px` }}>
      {skus.map((sku) => {
        const swatch = swatches[sku.id];
        const color = swatch?.hexColor || sku.hexColor || '#CCCCCC';
        const swatchImagePath = swatch?.swatchImagePath;
        const isActive = sku.id === currentSkuId;
        const isLoading = loadingColors.has(sku.id);
        const hasError = errors.has(sku.id);

        return (
          <div
            key={sku.id}
            className="relative group"
            style={{ width: `${size}px`, height: `${size}px` }}
            title={sku.colorName}
            aria-label={`${sku.colorName} color option`}
          >
            {isLoading ? (
              <div
                className="flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                }}
              >
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleClick(sku)}
                  onKeyDown={(e) => handleKeyDown(e, sku)}
                  className={`
                    relative rounded-full border-2 transition-all duration-200
                    ${
                      isActive
                        ? 'border-slate-900 dark:border-slate-100 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-slate-500 dark:hover:border-slate-400'
                    }
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    ${hasError ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: color,
                  }}
                  disabled={hasError}
                  aria-pressed={isActive}
                />
                {swatchImagePath && (
                  <AppImage
                    src={swatchImagePath}
                    alt=""
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                    imageClassName="h-full w-full rounded-full object-cover"
                    placeholder={null}
                    fallback={null}
                  />
                )}
              </>
            )}

            {/* Tooltip on hover */}
            <div
              className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                px-2 py-1 text-xs font-medium
                bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900
                rounded shadow-lg
                opacity-0 group-hover:opacity-100
                pointer-events-none
                transition-opacity duration-200
                whitespace-nowrap
                z-10
              "
            >
              {sku.colorName}
              {hasError && ' (extraction failed)'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
