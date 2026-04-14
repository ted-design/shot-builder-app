import React, { useCallback, useEffect, useState, useRef } from "react";
import { X, Pipette } from "lucide-react";
import Modal from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import SingleImageDropzone from "../common/SingleImageDropzone";
import { extractColorFromFile } from "../../lib/colorExtraction";
import { toast } from "../../lib/toast";

/**
 * SwatchCreateModal - Modal for creating a new color swatch
 *
 * Features:
 * - Drag-and-drop image upload with SingleImageDropzone
 * - Auto-extract dominant color from uploaded image
 * - Manual color override support
 * - Aliases input for color name variations
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onSave - Callback when swatch is saved (receives draft object)
 * @param {boolean} props.saving - Whether save operation is in progress
 */
export default function SwatchCreateModal({ open, onClose, onSave, saving = false }) {
  const [name, setName] = useState("");
  const [hexColor, setHexColor] = useState("");
  const [aliases, setAliases] = useState("");
  const [file, setFile] = useState(null);
  const [autoExtractedColor, setAutoExtractedColor] = useState(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [samplingMode, setSamplingMode] = useState(false);
  const previewImageRef = useRef(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setHexColor("");
      setAliases("");
      setFile(null);
      setAutoExtractedColor(null);
      setManualOverride(false);
      setExtracting(false);
    }
  }, [open]);

  // Auto-extract color when image is uploaded
  const handleFileChange = useCallback(async (newFile) => {
    setFile(newFile);

    if (!newFile) {
      setAutoExtractedColor(null);
      if (!manualOverride) {
        setHexColor("");
      }
      return;
    }

    // Extract dominant color from image
    setExtracting(true);
    try {
      const extracted = await extractColorFromFile(newFile);
      if (extracted) {
        setAutoExtractedColor(extracted);
        // Only auto-fill if user hasn't manually overridden
        if (!manualOverride) {
          setHexColor(extracted);
        }
      }
    } catch (error) {
      console.error("Failed to extract color:", error);
      toast.error("Unable to extract color from image");
    } finally {
      setExtracting(false);
    }
  }, [manualOverride]);

  // Track manual color edits
  const handleColorChange = useCallback((value) => {
    setHexColor(value);
    // Mark as manual override if user changes color after auto-extraction
    if (autoExtractedColor && value !== autoExtractedColor) {
      setManualOverride(true);
    }
  }, [autoExtractedColor]);

  // Reset to auto-extracted color
  const handleResetToExtracted = useCallback(() => {
    if (autoExtractedColor) {
      setHexColor(autoExtractedColor);
      setManualOverride(false);
    }
  }, [autoExtractedColor]);

  // Sample color from image at clicked position
  const sampleColorFromImage = useCallback((imageElement, clickEvent) => {
    try {
      const rect = imageElement.getBoundingClientRect();
      const x = clickEvent.clientX - rect.left;
      const y = clickEvent.clientY - rect.top;

      // Create canvas to read pixel data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate scale factors
      const scaleX = imageElement.naturalWidth / rect.width;
      const scaleY = imageElement.naturalHeight / rect.height;

      // Get actual pixel coordinates
      const pixelX = Math.floor(x * scaleX);
      const pixelY = Math.floor(y * scaleY);

      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      ctx.drawImage(imageElement, 0, 0);

      // Read pixel color
      const imageData = ctx.getImageData(pixelX, pixelY, 1, 1);
      const [r, g, b] = imageData.data;

      // Convert to hex
      const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      const sampledColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      setHexColor(sampledColor);
      setManualOverride(true);
      setSamplingMode(false);
      toast.success(`Sampled color: ${sampledColor}`);
    } catch (error) {
      console.error("Failed to sample color:", error);
      toast.error("Unable to sample color from image");
      setSamplingMode(false);
    }
  }, []);

  // Handle image click when in sampling mode
  const handleImageClick = useCallback((e) => {
    if (!samplingMode) return;
    const imgElement = e.target;
    if (imgElement.tagName === 'IMG') {
      sampleColorFromImage(imgElement, e);
    }
  }, [samplingMode, sampleColorFromImage]);

  // Toggle eye dropper mode
  const toggleEyeDropper = useCallback(() => {
    setSamplingMode(prev => !prev);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    onSave({
      name: trimmedName,
      hexColor: hexColor.trim() || null,
      aliases: aliases.trim(),
      file,
    });
  }, [name, hexColor, aliases, file, onSave]);

  const canResetToExtracted = autoExtractedColor && manualOverride && hexColor !== autoExtractedColor;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="swatch-create-title"
      contentClassName="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2
            id="swatch-create-title"
            className="text-xl font-semibold text-slate-900 dark:text-slate-100"
          >
            Create Color Swatch
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="swatch-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="swatch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Forest Green"
              disabled={saving}
              required
            />
          </div>

          {/* Texture Image */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Texture Image (Optional)
              </label>
              {file && (
                <Button
                  type="button"
                  variant={samplingMode ? "default" : "ghost"}
                  size="sm"
                  onClick={toggleEyeDropper}
                  disabled={saving || extracting}
                  className="flex items-center gap-1"
                >
                  <Pipette className="h-4 w-4" />
                  {samplingMode ? "Click image to sample" : "Eye dropper"}
                </Button>
              )}
            </div>
            <div onClick={handleImageClick} className={samplingMode ? "cursor-crosshair" : ""}>
              <SingleImageDropzone
                value={file}
                onChange={handleFileChange}
                disabled={saving || extracting}
                showPreview={true}
              />
            </div>
            {extracting && (
              <p className="mt-2 text-sm text-slate-500">Extracting color from image...</p>
            )}
            {samplingMode && (
              <p className="mt-2 text-sm text-primary font-medium">
                Click on the image above to sample a color
              </p>
            )}
          </div>

          {/* Hex Color */}
          <div>
            <label htmlFor="swatch-hex" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Hex Color (Optional)
            </label>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full border border-slate-300 dark:border-slate-700 flex-shrink-0"
                style={{ backgroundColor: hexColor || "#CBD5E1" }}
                title={hexColor || "No color"}
              />
              <Input
                id="swatch-hex"
                type="text"
                value={hexColor}
                onChange={(e) => handleColorChange(e.target.value.toUpperCase())}
                placeholder="#RRGGBB"
                disabled={saving}
                className="font-mono text-sm"
              />
              {canResetToExtracted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToExtracted}
                  disabled={saving}
                >
                  Reset to extracted
                </Button>
              )}
            </div>
            {autoExtractedColor && (
              <p className="mt-1 text-xs text-slate-500">
                {manualOverride && hexColor !== autoExtractedColor
                  ? `Auto-extracted: ${autoExtractedColor} (manually overridden)`
                  : `Auto-extracted from image: ${autoExtractedColor}`
                }
              </p>
            )}
          </div>

          {/* Aliases */}
          <div>
            <label htmlFor="swatch-aliases" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Aliases (Optional)
            </label>
            <Input
              id="swatch-aliases"
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g., Green, Dark Green (comma-separated)"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-slate-500">
              Alternative names for this color, separated by commas
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || extracting || !name.trim()}
          >
            {saving ? "Creating..." : "Create Swatch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
