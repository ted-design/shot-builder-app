import { useState, useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import AppImage from "../common/AppImage";
import { formatFileSize } from "../../lib/images";
import { extractColorFromFile, isValidHexColor } from "../../lib/colorExtraction";
import { findPaletteMatch } from "../../lib/colorPalette";
import { Star, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

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
  paletteSwatches = [],
  paletteIndex = { byKey: new Map(), byName: new Map() },
  onSaveToPalette,
  heroLocalId,
  onHeroSelect,
}) {
  const [extracting, setExtracting] = useState({});
  const paletteNames = useMemo(
    () => (paletteSwatches || []).map((swatch) => swatch.name).filter(Boolean),
    [paletteSwatches]
  );
  const paletteListId = "palette-swatch-names";
  const statusOptionsWithLegacy = useMemo(() => {
    const hasArchived = colors.some((color) => color.status === "archived");
    if (hasArchived && !statusOptions.some((option) => option.value === "archived")) {
      return [...statusOptions, { value: "archived", label: "Archived (legacy)" }];
    }
    return statusOptions;
  }, [colors, statusOptions]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Colours</h3>
          {sizeNote && <p className="text-sm text-slate-500">{sizeNote}</p>}
          {skuHelper && <p className="text-xs text-slate-500">{skuHelper}</p>}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onAddColor}>
          Add colourway
        </Button>
      </div>
      {paletteNames.length > 0 && (
        <ColorListEditor.PaletteDatalist id={paletteListId} names={paletteNames} />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {colors.map((color) => {
          const paletteMatch = findPaletteMatch(color, paletteIndex);
          const isHero = heroLocalId === color.localId;
          return (
            <fieldset
              key={color.localId}
              className="space-y-3 rounded-card border border-slate-200/80 bg-white p-3 shadow-sm"
            >
              {/* Header row with colour name and actions */}
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Colour name</label>
                  <div className="flex gap-2">
                    <Input
                      value={color.colorName}
                      onChange={(event) => onFieldChange(color.localId, { colorName: event.target.value })}
                      list={paletteNames.length ? paletteListId : undefined}
                      placeholder="e.g. Black"
                      className="h-8 flex-1 text-sm"
                    />
                    {onHeroSelect && (
                      <button
                        type="button"
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-slate-500 transition-colors ${
                          isHero
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-slate-200 hover:border-slate-300 hover:text-slate-700"
                        }`}
                        onClick={() => onHeroSelect(color.localId)}
                        aria-pressed={isHero}
                        aria-label={isHero ? "Default thumbnail" : "Set as default thumbnail"}
                      >
                        <Star
                          className="h-3.5 w-3.5"
                          fill={isHero ? "#f59e0b" : "none"}
                          strokeWidth={1.75}
                        />
                      </button>
                    )}
                  </div>
                  {paletteMatch ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xxs text-slate-500">
                      <span>Palette swatch</span>
                      {paletteMatch.hexColor && (
                        <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-2xs text-slate-700">
                          {paletteMatch.hexColor}
                        </span>
                      )}
                      {paletteMatch.swatchImagePath && (
                        <AppImage
                          src={paletteMatch.swatchImagePath}
                          alt=""
                          className="h-5 w-5 overflow-hidden rounded-full border border-slate-200"
                          imageClassName="h-full w-full object-cover"
                          placeholder={null}
                          fallback={null}
                        />
                      )}
                    </div>
                  ) : color.colorName?.trim() && onSaveToPalette ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xxs text-slate-500">
                      <span>Not linked</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-5 px-1.5 text-2xs"
                        disabled={!color.hexColor || !isValidHexColor(color.hexColor)}
                        onClick={() => onSaveToPalette(color.localId)}
                      >
                        Save to palette
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isHero && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-amber-800">
                      Hero
                    </span>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove colourway"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove colourway?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{color.colorName || "this colourway"}" and its image. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onRemoveColor(color.localId)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Compact horizontal layout: image left, fields right */}
              <div className="flex gap-3">
                {/* Image thumbnail */}
                <div className="w-24 shrink-0 space-y-1.5">
                  <div className="aspect-[4/5] overflow-hidden rounded border border-slate-200 bg-slate-50">
                    {color.imagePreview ? (
                      <AppImage
                        src={color.imagePreview}
                        alt={`${color.colorName || "Colour"} preview`}
                        loading="lazy"
                        fit="contain"
                        className="h-full w-full"
                        imageClassName="h-full w-full object-contain"
                        placeholder={
                          <div className="flex h-full w-full items-center justify-center text-2xs text-slate-400">
                            Loading…
                          </div>
                        }
                        fallback={
                          <div className="flex h-full w-full items-center justify-center text-2xs text-slate-400">
                            No preview
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <label className="flex-1 cursor-pointer rounded bg-slate-100 px-1.5 py-1 text-center text-2xs font-medium text-slate-600 hover:bg-slate-200">
                      Choose
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          onImageSelect?.(color.localId, file);
                          event.target.value = "";
                        }}
                        className="sr-only"
                      />
                    </label>
                    {(color.imagePreview || color.imagePath) && (
                      <button
                        type="button"
                        className="rounded bg-slate-100 px-1.5 py-1 text-2xs font-medium text-slate-600 hover:bg-red-100 hover:text-red-600"
                        onClick={() => onClearImage?.(color.localId)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-2">
                  {/* SKU and Status row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-2xs font-medium text-slate-500">SKU</label>
                      <Input
                        value={color.skuCode}
                        onChange={(event) => onFieldChange(color.localId, { skuCode: event.target.value })}
                        placeholder="e.g. UM-BLK"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-2xs font-medium text-slate-500">Status</label>
                      <select
                        value={color.status}
                        onChange={(event) => onFieldChange(color.localId, { status: event.target.value })}
                        className="h-7 w-full rounded border border-slate-300 px-1.5 text-xs"
                      >
                        {statusOptionsWithLegacy.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Swatch colour - only show when NOT linked to palette */}
                  {!paletteMatch && (
                    <div className="space-y-0.5">
                      <label className="text-2xs font-medium text-slate-500">Swatch colour</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={color.hexColor || "#CCCCCC"}
                          onChange={(event) =>
                            onFieldChange(color.localId, { hexColor: event.target.value.toUpperCase() })
                          }
                          className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0.5"
                          title="Pick a colour"
                        />
                        <div className="flex items-center gap-0.5">
                          <span className="text-2xs text-slate-400">#</span>
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
                            className="h-7 w-14 font-mono text-2xs"
                            maxLength={6}
                          />
                        </div>
                        {color.imageFile && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-2xs"
                            onClick={() => handleAutoExtract(color.localId, color.imageFile)}
                            disabled={extracting[color.localId]}
                          >
                            {extracting[color.localId] ? "…" : "Extract"}
                          </Button>
                        )}
                        {color.hexColor && (
                          <button
                            type="button"
                            className="text-2xs text-slate-400 hover:text-slate-600"
                            onClick={() => onFieldChange(color.localId, { hexColor: null })}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/95 px-2 py-3 backdrop-blur">
        <Button type="button" variant="secondary" onClick={onAddColor}>
          Add colourway
        </Button>
      </div>
    </div>
  );
}

// Datalist helper for palette suggestions
ColorListEditor.PaletteDatalist = function PaletteDatalist({ id, names = [] }) {
  if (!names.length) return null;
  return (
    <datalist id={id}>
      {names.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
};
