import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Badge } from "../ui/badge";
import AppImage from "../common/AppImage";
import { compressImageFile, formatFileSize } from "../../lib/images";
import { extractColorFromFile, isValidHexColor } from "../../lib/colorExtraction";
import { findPaletteMatch } from "../../lib/colorPalette";

const SKU_STATUS = [
  { value: "active", label: "Active" },
  { value: "phasing_out", label: "Phasing out" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "discontinued", label: "Discontinued" },
];

export default function NewColourwayModal({
  open,
  onClose,
  onSubmit,
  family,
  paletteSwatches = [],
  paletteIndex = { byKey: new Map(), byName: new Map() },
  onUpsertSwatch,
}) {
  const [colorName, setColorName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageState, setImageState] = useState({ file: null, preview: null, size: 0, name: "" });
  const [hexColor, setHexColor] = useState("");
  const [autoExtracted, setAutoExtracted] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [colorKey, setColorKey] = useState(null);
  const inputRef = useRef(null);
  const objectUrlRef = useRef(null);
  const paletteNames = useMemo(
    () => (paletteSwatches || []).map((swatch) => swatch.name).filter(Boolean),
    [paletteSwatches]
  );
  const paletteListId = "palette-colourway-names";
  const resolvedPaletteIndex = useMemo(
    () => paletteIndex || { byKey: new Map(), byName: new Map() },
    [paletteIndex]
  );

  useEffect(() => {
    if (!open) {
      setColorName("");
      setSkuCode("");
      setStatus("active");
      setError(null);
      setIsSaving(false);
      setHexColor("");
      setColorKey(null);
      setAutoExtracted(false);
      setIsExtracting(false);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setImageState({ file: null, preview: null, size: 0, name: "" });
      return;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus?.();
    });
  }, [open]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const match = findPaletteMatch({ colorName, colorKey }, resolvedPaletteIndex);
    if (match) {
      setColorKey(match.colorKey);
      if (match.hexColor && hexColor !== match.hexColor) {
        setHexColor(match.hexColor);
        setAutoExtracted(false);
      }
    } else if (colorKey) {
      setColorKey(null);
    }
  }, [colorName, colorKey, resolvedPaletteIndex, hexColor]);

  const handleImageChange = async (file) => {
    if (!file) return;
    setError(null);
    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const compressed = await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.82,
      });
      const preview = URL.createObjectURL(compressed);
      objectUrlRef.current = preview;
      setImageState({
        file: compressed,
        preview,
        size: compressed.size,
        name: file.name,
      });

      // Auto-extract color from image
      setIsExtracting(true);
      try {
        const extractedColor = await extractColorFromFile(compressed);
        if (extractedColor && !hexColor) {
          setHexColor(extractedColor);
          setAutoExtracted(true);
        }
      } catch (colorErr) {
        console.error("Color extraction failed:", colorErr);
        // Don't set error - color extraction failure shouldn't block image upload
      } finally {
        setIsExtracting(false);
      }
    } catch (err) {
      console.error("Failed to prepare colourway image", err);
      setError("Unable to load image. Try a different file.");
      setIsExtracting(false);
    }
  };

  const clearImage = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImageState({ file: null, preview: null, size: 0, name: "" });
  };

  const handleSaveSwatchToPalette = async () => {
    if (!onUpsertSwatch) return;
    const name = colorName.trim();
    if (!name) {
      setError("Add a colour name before saving to the palette.");
      return;
    }
    if (!hexColor || !isValidHexColor(hexColor)) {
      setError("Add a valid hex colour before saving to the palette.");
      return;
    }
    try {
      const result = await onUpsertSwatch({
        name,
        hexColor,
        swatchImageFile: imageState.file || null,
      });
      if (result?.colorKey) {
        setColorKey(result.colorKey);
      }
    } catch (err) {
      console.error("Failed to save palette swatch", err);
      setError(err?.message || "Unable to save swatch to the palette.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const trimmedName = colorName.trim();
    if (!trimmedName) {
      setError("Colour name is required.");
      return;
    }

    // Validate hex color if provided
    const trimmedHexColor = hexColor.trim();
    if (trimmedHexColor && !isValidHexColor(trimmedHexColor)) {
      setError("Invalid hex color format. Use #RRGGBB format (e.g., #FF0000).");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        colorName: trimmedName,
        skuCode: skuCode.trim(),
        status,
        imageFile: imageState.file,
        hexColor: trimmedHexColor || null,
      };
      if (colorKey) {
        payload.colorKey = colorKey;
      }
      await onSubmit?.(payload);
      onClose?.();
    } catch (err) {
      console.error("Failed to create colourway", err);
      setError(err?.message || "Unable to create colourway.");
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="new-colourway-title"
      contentClassName="p-0 max-h-[90vh] overflow-y-auto"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 id="new-colourway-title" className="text-lg font-semibold">
                Add colourway
              </h2>
              {family?.styleName && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{family.styleName}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New colourways inherit the family size list. Update sizes from the products page if needed.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="colourway-name">
                Colour name
              </label>
              <Input
                id="colourway-name"
                value={colorName}
                onChange={(event) => setColorName(event.target.value)}
                 list={paletteNames.length ? paletteListId : undefined}
                placeholder="e.g. Black"
                ref={inputRef}
              />
              {paletteNames.length > 0 && (
                <datalist id={paletteListId}>
                  {paletteNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
              {(() => {
                const paletteMatch = findPaletteMatch({ colorName, colorKey }, resolvedPaletteIndex);
                if (paletteMatch) {
                  return (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Linked to palette</span>
                      {paletteMatch.hexColor && (
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {paletteMatch.hexColor}
                        </span>
                      )}
                    </div>
                  );
                }
                if (colorName.trim() && onUpsertSwatch) {
                  const canSave = hexColor && isValidHexColor(hexColor);
                  return (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Not in palette</span>
                      <Button type="button" variant="outline" size="sm" disabled={!canSave} onClick={handleSaveSwatchToPalette}>
                        Save swatch
                      </Button>
                      {!canSave && <span className="text-[11px] text-slate-500">Add a valid hex first</span>}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="colourway-sku">
                SKU (optional)
              </label>
              <Input
                id="colourway-sku"
                value={skuCode}
                onChange={(event) => setSkuCode(event.target.value)}
                placeholder="e.g. UM-3021-BLK"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="colourway-status">
                Status
              </label>
              <select
                id="colourway-status"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {SKU_STATUS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Colour image</label>
              {imageState.preview && (
                <AppImage
                  src={imageState.preview}
                  alt={`${colorName || "Colour"} preview`}
                  loading="lazy"
                  fit="contain"
                  className="flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-card border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
                  imageClassName="max-h-72 w-auto object-contain"
                  placeholder={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                      Loading preview…
                    </div>
                  }
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                      Preview unavailable
                    </div>
                  }
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleImageChange(file);
                      event.target.value = "";
                    }
                  }}
                />
                {imageState.preview && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
                    Remove image
                  </Button>
                )}
              </div>
              {imageState.file && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {imageState.name} • {formatFileSize(imageState.size)}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Images are optional but help identify the colour quickly in the planner.
              </p>
            </div>

            {/* Color Picker Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Colour hex code (optional)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-extracted from image, or manually select a color
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hexColor || '#CCCCCC'}
                  onChange={(e) => {
                    setHexColor(e.target.value);
                    setAutoExtracted(false);
                  }}
                  className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                  disabled={isExtracting}
                />
                <Input
                  type="text"
                  value={hexColor}
                  onChange={(e) => {
                    setHexColor(e.target.value);
                    setAutoExtracted(false);
                  }}
                  placeholder="#000000"
                  className="flex-1"
                  disabled={isExtracting}
                />
                {isExtracting && <LoadingSpinner size="sm" />}
                {autoExtracted && !isExtracting && hexColor && (
                  <Badge variant="secondary" className="shrink-0">
                    Auto-extracted
                  </Badge>
                )}
              </div>
              {hexColor && isValidHexColor(hexColor) && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-20 rounded border border-slate-300 dark:border-slate-600"
                    style={{ backgroundColor: hexColor }}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Color preview</span>
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                {isSaving ? "Saving…" : "Add colourway"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
