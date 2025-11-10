import { useState, useRef, useCallback } from "react";
import { Button } from "../ui/button";
import AppImage from "./AppImage";

/**
 * ImageCropPositionEditor - Visual control for adjusting image crop position
 *
 * @param {Object} props
 * @param {string} props.imageSrc - Source URL/path of the image
 * @param {Object} props.cropPosition - Current crop position {x: number, y: number} (0-100)
 * @param {Function} props.onCropChange - Callback when crop position changes
 * @param {string} props.className - Additional CSS classes
 */
export function ImageCropPositionEditor({
  imageSrc,
  cropPosition = { x: 50, y: 50 },
  onCropChange,
  className = "",
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState(cropPosition);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onCropChange?.(localPosition);
    }
  }, [isDragging, localPosition, onCropChange]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      setLocalPosition({ x, y });
    },
    [isDragging]
  );

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onCropChange?.(localPosition);
    }
  }, [isDragging, localPosition, onCropChange]);

  const handleTouchMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;

      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));

      setLocalPosition({ x, y });
    },
    [isDragging]
  );

  const handleReset = useCallback(() => {
    const defaultPosition = { x: 50, y: 50 };
    setLocalPosition(defaultPosition);
    onCropChange?.(defaultPosition);
  }, [onCropChange]);

  const objectPosition = `${localPosition.x}% ${localPosition.y}%`;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Image Crop Position
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click and drag on the preview to adjust the focal point
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative h-64 cursor-crosshair overflow-hidden rounded-card border-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <AppImage
          src={imageSrc}
          alt="Crop preview"
          className="h-full w-full"
          imageClassName="h-full w-full object-cover pointer-events-none"
          position={objectPosition}
          loading="eager"
          placeholder={
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              Loading image...
            </div>
          }
          fallback={
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
              No image available
            </div>
          }
        />

        {/* Crosshair marker at focal point */}
        <div
          className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{
            left: `${localPosition.x}%`,
            top: `${localPosition.y}%`,
          }}
        >
          <div className="absolute h-8 w-0.5 bg-white shadow-lg"></div>
          <div className="absolute h-0.5 w-8 bg-white shadow-lg"></div>
          <div className="h-3 w-3 rounded-full border-2 border-white bg-primary shadow-lg"></div>
        </div>

        {isDragging && (
          <div className="pointer-events-none absolute inset-0 bg-primary/10"></div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span>X: {Math.round(localPosition.x)}%</span>
          <span>Y: {Math.round(localPosition.y)}%</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleReset}
        >
          Reset to Center
        </Button>
      </div>
    </div>
  );
}

export default ImageCropPositionEditor;
