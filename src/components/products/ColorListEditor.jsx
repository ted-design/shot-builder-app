import { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import AppImage from "../common/AppImage";
import { formatFileSize } from "../../lib/images";
import { extractColorFromFile, isValidHexColor } from "../../lib/colorExtraction";

export default function ColorListEditor({
  colors = [],
  onAddColor,
  onRemoveColor,
  onFieldChange,
  onImageSelect,
  onClearImage,
  statusOptions = [],
  sizeNote,
  recommendedMessage,
  skuHelper,
}) {
  const [extracting, setExtracting] = useState({});

  // Auto-extract color from the uploaded image file
  const handleAutoExtract = useCallback(async (localId, imageFile) => {
    if (!imageFile) return;

    setExtracting((prev) => ({ ...prev, [localId]: true }));
    try {
      const color = await extractColorFromFile(imageFile);
      if (color && isValidHexColor(color)) {
        onFieldChange(localId, { hexColor: color });
      }
    } catch (error) {
      console.error("Failed to extract color:", error);
    } finally {
      setExtracting((prev) => ({ ...prev, [localId]: false }));
    }
  }, [onFieldChange]);
  return (
    <div className="relative space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Colours</h3>
      {sizeNote && <p className="text-sm text-slate-500">{sizeNote}</p>}
      {skuHelper && <p className="text-xs text-slate-500">{skuHelper}</p>}
      <div className="space-y-4">
        {colors.map((color) => (
          <fieldset key={color.localId} className="space-y-4 rounded-card border border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Colour name</label>
                <Input
                  value={color.colorName}
                  onChange={(event) => onFieldChange(color.localId, { colorName: event.target.value })}
                  placeholder="e.g. Black"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">SKU (optional)</label>
                <Input
                  value={color.skuCode}
                  onChange={(event) => onFieldChange(color.localId, { skuCode: event.target.value })}
                  placeholder="e.g. UM-3021-BLK"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  value={color.status}
                  onChange={(event) => onFieldChange(color.localId, { status: event.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm md:max-w-[180px]"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Hex Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Swatch colour</label>
              <p className="text-xs text-slate-500">
                Set the colour swatch displayed in product listings. Use the picker or enter a hex code.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {/* Native color picker */}
                <input
                  type="color"
                  value={color.hexColor || "#CCCCCC"}
                  onChange={(event) => onFieldChange(color.localId, { hexColor: event.target.value.toUpperCase() })}
                  className="h-10 w-10 cursor-pointer rounded border border-slate-300 p-0.5"
                  title="Pick a colour"
                />
                {/* Hex input */}
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-500">#</span>
                  <Input
                    value={(color.hexColor || "").replace(/^#/, "")}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6);
                      if (value.length === 6) {
                        onFieldChange(color.localId, { hexColor: `#${value}` });
                      } else {
                        onFieldChange(color.localId, { hexColor: value ? `#${value}` : null });
                      }
                    }}
                    placeholder="CCCCCC"
                    className="w-24 font-mono text-sm"
                    maxLength={6}
                  />
                </div>
                {/* Preview swatch */}
                {color.hexColor && isValidHexColor(color.hexColor) && (
                  <div
                    className="h-8 w-8 rounded-full border-2 border-slate-300"
                    style={{ backgroundColor: color.hexColor }}
                    title={color.hexColor}
                  />
                )}
                {/* Auto-extract button */}
                {color.imageFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAutoExtract(color.localId, color.imageFile)}
                    disabled={extracting[color.localId]}
                  >
                    {extracting[color.localId] ? "Extracting…" : "Auto-extract from image"}
                  </Button>
                )}
                {/* Clear button */}
                {color.hexColor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onFieldChange(color.localId, { hexColor: null })}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Colour image</label>
              {color.imagePreview && (
                <AppImage
                  src={color.imagePreview}
                  alt={`${color.colorName || "Colour"} preview`}
                  loading="lazy"
                  className="h-40 w-full overflow-hidden rounded-card"
                  imageClassName="h-full w-full object-cover"
                  placeholder={null}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      No preview
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
                    if (!file) return;
                    onImageSelect?.(color.localId, file);
                    event.target.value = "";
                  }}
                />
                {(color.imagePreview || color.imagePath) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onClearImage?.(color.localId)}
                  >
                    Remove image
                  </Button>
                )}
              </div>
              {recommendedMessage && <p className="text-xs text-slate-500">{recommendedMessage}</p>}
              {color.imageFile && (
                <div className="text-xs text-slate-500">
                  {color.imageFile.name} • {formatFileSize(color.imageFile.size)}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => onRemoveColor(color.localId)}>
                Remove colour
              </Button>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/95 px-2 py-3 backdrop-blur">
        <Button type="button" variant="secondary" onClick={onAddColor}>
          Add colour
        </Button>
      </div>
    </div>
  );
}
