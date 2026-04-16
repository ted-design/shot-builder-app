import { useState, useCallback, useEffect, useRef } from "react";
import Cropper from "react-easy-crop";
import { X, RotateCcw, ZoomIn, Crop } from "lucide-react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";

/**
 * AdvancedImageCropEditor - Modal for cropping, zooming, and rotating images
 *
 * @param {Object} props
 * @param {boolean} props.open - Dialog open state
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.attachment - Attachment object with path and cropData
 * @param {Function} props.onSave - Save handler receiving updated cropData
 */

const ASPECT_RATIOS = {
  free: { value: null, label: "Free" },
  "1:1": { value: 1, label: "1:1 Square" },
  "16:9": { value: 16 / 9, label: "16:9 Landscape" },
  "4:3": { value: 4 / 3, label: "4:3 Standard" },
};

/**
 * Convert numeric aspect value to the matching key in ASPECT_RATIOS.
 * S.4: imageCropDataSchema stores aspect as NUMBER, UI uses string keys.
 */
function aspectValueToKey(value) {
  if (value === null || value === undefined) return "free";
  // Find matching key by comparing numeric values with small tolerance
  for (const [key, config] of Object.entries(ASPECT_RATIOS)) {
    if (config.value !== null && Math.abs(config.value - value) < 0.01) {
      return key;
    }
  }
  return "free"; // Default to free if no match
}

/**
 * Convert aspect key to numeric value for storage.
 * S.4: imageCropDataSchema expects aspect as NUMBER or null.
 */
function aspectKeyToValue(key) {
  return ASPECT_RATIOS[key]?.value ?? null;
}

export default function AdvancedImageCropEditor({ open, onClose, attachment, onSave }) {
  // Track which attachment we've initialized for to detect changes
  const initializedForRef = useRef(null);

  // Initialize crop state from existing cropData or defaults
  const getInitialCropData = useCallback(() => {
    return attachment?.cropData || {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zoom: 1,
      rotation: 0,
      aspect: null,
    };
  }, [attachment?.cropData]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState("free");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState(null);

  // S.4: Reinitialize state when modal opens with new/different attachment
  // This fixes the "rotation only shows after reopen" bug
  useEffect(() => {
    if (!open) return;

    const attachmentId = attachment?.id;
    const cropDataKey = JSON.stringify(attachment?.cropData);
    const currentKey = `${attachmentId}:${cropDataKey}`;

    // Only reinitialize if this is a new attachment or cropData changed
    if (initializedForRef.current !== currentKey) {
      const initialCropData = getInitialCropData();
      const initialAspectKey = aspectValueToKey(initialCropData.aspect);

      setCrop({ x: 0, y: 0 }); // Reset pan to center
      setZoom(initialCropData.zoom || 1);
      setRotation(initialCropData.rotation || 0);
      setAspect(initialAspectKey);
      setCroppedAreaPixels(null);
      setCroppedAreaPercent(null);

      initializedForRef.current = currentKey;
    }
  }, [open, attachment?.id, attachment?.cropData, getInitialCropData]);

  // Handle crop complete
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
    setCroppedAreaPercent(croppedArea);
  }, []);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect("free");
    setCroppedAreaPixels(null);
    setCroppedAreaPercent(null);
  }, []);

  // Save crop data
  // S.4: Converts aspect key to numeric value per imageCropDataSchema semantics
  const handleSave = useCallback(() => {
    if (!croppedAreaPercent) {
      onClose();
      return;
    }

    const cropData = {
      x: croppedAreaPercent.x,
      y: croppedAreaPercent.y,
      width: croppedAreaPercent.width,
      height: croppedAreaPercent.height,
      zoom,
      rotation,
      aspect: aspectKeyToValue(aspect), // Convert to numeric value or null
    };

    onSave(cropData);
    onClose();
  }, [croppedAreaPercent, zoom, rotation, aspect, onSave, onClose]);

  // Cancel and close
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!attachment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="crop-editor-title"
      describedBy="crop-editor-description"
      contentClassName="!max-w-5xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div>
          <h2 id="crop-editor-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Crop & Adjust Image
          </h2>
          <p id="crop-editor-description" className="text-sm text-slate-500 dark:text-slate-400">
            Adjust zoom, rotation, and crop area for your attachment.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Cropper Container */}
        <div className="relative h-[400px] w-full overflow-hidden rounded-lg bg-slate-900">
          <Cropper
            image={attachment.downloadURL || attachment.path}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ASPECT_RATIOS[aspect].value}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            objectFit="contain"
            classes={{
              containerClassName: "rounded-lg",
              cropAreaClassName: "border-2 border-primary",
            }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Crop className="h-4 w-4" />
              Aspect Ratio
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(ASPECT_RATIOS).map(([key, { label }]) => (
                <Button
                  key={key}
                  type="button"
                  variant={aspect === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAspect(key)}
                  className="w-full"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Zoom */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <ZoomIn className="h-4 w-4" />
              Zoom: {zoom.toFixed(1)}x
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((zoom - 1) / 2) * 100}%, #e2e8f0 ${((zoom - 1) / 2) * 100}%, #e2e8f0 100%)`,
              }}
            />
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <RotateCcw className="h-4 w-4" />
              Rotation: {rotation}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
              style={{
                background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${((rotation + 180) / 360) * 100}%, #3b82f6 ${((rotation + 180) / 360) * 100}%, #3b82f6 100%)`,
              }}
            />
          </div>

          {/* Reset Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
