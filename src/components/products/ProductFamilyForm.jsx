import { useEffect, useMemo, useRef, useState } from "react";
import { storage } from "../../lib/firebase";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import DOMPurify from "dompurify";
import { Button } from "../ui/button";
import { Input, Checkbox } from "../ui/input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import AppImage from "../common/AppImage";
import SizeListInput from "./SizeListInput";
import ColorListEditor from "./ColorListEditor";
import RichTextEditor from "../shots/RichTextEditor";
import { compressImageFile, formatFileSize } from "../../lib/images";
import {
  getTypesForGender,
  getSubcategoriesForType,
  hasCategories,
} from "../../lib/productCategories";
import { findPaletteMatch } from "../../lib/colorPalette";
import { isValidHexColor } from "../../lib/colorExtraction";
import { toast } from "../../lib/toast";

const GENDER_OPTIONS = [
  { value: "men", label: "Men's" },
  { value: "women", label: "Women's" },
  { value: "unisex", label: "Unisex" },
  { value: "other", label: "Other" },
];

const FAMILY_STATUS = [
  { value: "active", label: "Active" },
  { value: "discontinued", label: "Discontinued" },
];

const SKU_STATUS = [
  { value: "active", label: "Active" },
  { value: "phasing_out", label: "Phasing out" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "discontinued", label: "Discontinued" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const createEmptyColour = () => ({
  localId: uid(),
  id: null,
  colorName: "",
  skuCode: "",
  status: "active",
  colorKey: null,
  hexColor: null,
  imagePath: null,
  imageFile: null,
  imagePreview: null,
  removeImage: false,
  previewObjectUrl: null,
});

const deriveFamilySizes = (initialValue) => {
  if (Array.isArray(initialValue?.sizes) && initialValue.sizes.length) {
    return initialValue.sizes.filter(Boolean);
  }
  if (Array.isArray(initialValue?.sizeOptions) && initialValue.sizeOptions.length) {
    return initialValue.sizeOptions.filter(Boolean);
  }
  if (Array.isArray(initialValue?.skus)) {
    const set = new Set();
    initialValue.skus.forEach((sku) => {
      (sku.sizes || []).forEach((size) => size && set.add(size));
    });
    return Array.from(set);
  }
  return [];
};

const buildInitialState = (initialValue) => {
  if (!initialValue) {
    return {
      styleName: "",
      styleNumber: "",
      previousStyleNumber: "",
      gender: "unisex",
      productType: null,
      productSubcategory: null,
      status: "active",
      archived: false,
      notes: [],
      sizes: [],
    };
  }
  return {
    styleName: initialValue.styleName || initialValue.name || "",
    styleNumber: initialValue.styleNumber || "",
    previousStyleNumber: initialValue.previousStyleNumber || "",
    gender: initialValue.gender || "unisex",
    productType: initialValue.productType || null,
    productSubcategory: initialValue.productSubcategory || null,
    status: initialValue.status === "discontinued" ? "discontinued" : "active",
    archived: !!initialValue.archived,
    notes: Array.isArray(initialValue.notes)
      ? initialValue.notes.map((note) => ({
          id: note.id || uid(),
          text: note.text || "",
          createdAt: typeof note.createdAt?.toMillis === "function"
            ? note.createdAt.toMillis()
            : note.createdAt || Date.now(),
        }))
      : [],
    sizes: deriveFamilySizes(initialValue),
  };
};

const buildInitialColours = (initialValue) => {
  if (!initialValue || !Array.isArray(initialValue.skus) || !initialValue.skus.length) {
    return [createEmptyColour()];
  }
  return initialValue.skus.map((sku) => ({
    localId: uid(),
    id: sku.id || sku.skuId || null,
    colorName: sku.colorName || sku.colour || sku.name || "",
    skuCode: sku.skuCode || sku.sku || sku.code || "",
    status: sku.status || (sku.archived ? "archived" : "active"),
    colorKey: sku.colorKey || null,
    hexColor: sku.hexColor || null,
    imagePath: sku.imagePath || null,
    imageFile: null,
    imagePreview: sku.imageUrl || null,
    removeImage: false,
    previewObjectUrl: null,
  }));
};

const resolveHeroLocalId = (initialValue, colours) => {
  if (!colours.length) return null;
  if (initialValue?.thumbnailImagePath) {
    const match = colours.find((colour) => colour.imagePath === initialValue.thumbnailImagePath);
    if (match) return match.localId;
  }
  return colours[0].localId;
};

export default function ProductFamilyForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  canDelete,
  paletteSwatches = [],
  paletteIndex = null,
  onUpsertSwatch,
  onDelete,
}) {
  const initialColours = useMemo(() => buildInitialColours(initialValue), [initialValue]);
  const [familyState, setFamilyState] = useState(() => buildInitialState(initialValue));
  const [colours, setColours] = useState(initialColours);
  const [heroLocalId, setHeroLocalId] = useState(() =>
    resolveHeroLocalId(initialValue, initialColours)
  );
  const [removedColourIds, setRemovedColourIds] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    if (!initialValue) return false;
    const notesLength = Array.isArray(initialValue.notes) ? initialValue.notes.length : 0;
    return Boolean(initialValue.previousStyleNumber || initialValue.headerImagePath || notesLength);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [headerImage, setHeaderImage] = useState({
    file: null,
    preview: null,
    path: initialValue?.headerImagePath || null,
    remove: false,
  });
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const resolvedPaletteIndex = useMemo(
    () => paletteIndex || { byKey: new Map(), byName: new Map() },
    [paletteIndex]
  );

  const headerObjectUrl = useRef(null);
  const colourObjectUrls = useRef(new Set());

  useEffect(() => {
    const nextColours = buildInitialColours(initialValue);
    setFamilyState(buildInitialState(initialValue));
    setColours(nextColours);
    setHeroLocalId(resolveHeroLocalId(initialValue, nextColours));
    setRemovedColourIds([]);
    setHeaderImage((prev) => ({
      ...prev,
      file: null,
      preview: null,
      path: initialValue?.headerImagePath || null,
      remove: false,
    }));
    setDeleteText("");
    setConfirmingDelete(false);
  }, [initialValue]);

  useEffect(() => {
    let mounted = true;
    if (!initialValue?.headerImagePath) {
      setHeaderImage((prev) => ({ ...prev, preview: null, path: null }));
      return () => {
        mounted = false;
      };
    }
    (async () => {
      try {
        const url = await getDownloadURL(
          storageRef(storage, initialValue.headerImagePath)
        );
        if (mounted) {
          setHeaderImage((prev) => ({
            ...prev,
            preview: url,
            path: initialValue.headerImagePath,
            remove: false,
          }));
        }
      } catch (err) {
        console.warn("Failed to load header image", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialValue?.headerImagePath]);

  useEffect(() => {
    const entries = colours.filter((colour) => colour.imagePath && !colour.imagePreview);
    if (!entries.length) return undefined;
    let cancelled = false;
    entries.forEach((colour) => {
      (async () => {
        try {
          const url = await getDownloadURL(storageRef(storage, colour.imagePath));
          if (!cancelled) {
            setColours((prev) =>
              prev.map((entry) =>
                entry.localId === colour.localId
                  ? { ...entry, imagePreview: url }
                  : entry
              )
            );
          }
        } catch (err) {
          console.warn("Failed to load colour image", err);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [colours]);

  useEffect(() => {
    setColours((prev) =>
      prev.map((colour) => {
        const match = findPaletteMatch(colour, resolvedPaletteIndex);
        if (match && match.hexColor && colour.hexColor !== match.hexColor) {
          return { ...colour, colorKey: match.colorKey, hexColor: match.hexColor };
        }
        return colour;
      })
    );
  }, [resolvedPaletteIndex]);

  useEffect(() => {
    if (!colours.length) {
      if (heroLocalId !== null) setHeroLocalId(null);
      return;
    }
    if (!heroLocalId || !colours.some((colour) => colour.localId === heroLocalId)) {
      setHeroLocalId(colours[0].localId);
    }
  }, [colours, heroLocalId]);

  useEffect(
    () => () => {
      if (headerObjectUrl.current) {
        URL.revokeObjectURL(headerObjectUrl.current);
        headerObjectUrl.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      colourObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      colourObjectUrls.current.clear();
    },
    []
  );

  const updateFamily = (updates) =>
    setFamilyState((prev) => ({ ...prev, ...updates }));

  const setColourAt = (localId, updates) => {
    setColours((prev) =>
      prev.map((colour) => {
        if (colour.localId !== localId) return colour;
        const next = { ...colour, ...updates };
        const nextName = ((updates.colorName ?? colour.colorName) || "").trim();
        const nextKey = updates.colorKey ?? colour.colorKey;
        const paletteMatch = findPaletteMatch(
          { colorName: nextName, colorKey: nextKey },
          resolvedPaletteIndex
        );

        if (paletteMatch) {
          next.colorKey = paletteMatch.colorKey;
          if (!next.hexColor || updates.colorName || updates.colorKey) {
            next.hexColor = paletteMatch.hexColor || next.hexColor;
          }
        } else if (updates.colorName) {
          next.colorKey = null;
        }
        return next;
      })
    );
  };

  const addColour = () => setColours((prev) => [...prev, createEmptyColour()]);

  const removeColour = (localId) => {
    setColours((prev) => {
      const target = prev.find((colour) => colour.localId === localId);
      if (target?.previewObjectUrl) {
        URL.revokeObjectURL(target.previewObjectUrl);
        colourObjectUrls.current.delete(target.previewObjectUrl);
      }
      if (target?.id) {
        setRemovedColourIds((ids) =>
          ids.includes(target.id) ? ids : [...ids, target.id]
        );
      }
      return prev.filter((colour) => colour.localId !== localId);
    });
  };

  const addNote = () => {
    const value = newNoteText.trim();
    if (!value) return;
    const entry = { id: uid(), text: value, createdAt: Date.now() };
    updateFamily({ notes: [...familyState.notes, entry] });
    setNewNoteText("");
  };

  const removeNote = (id) => {
    updateFamily({ notes: familyState.notes.filter((note) => note.id !== id) });
  };

  const handleDeleteFamily = async () => {
    if (!onDelete || !initialValue) return;
    if (deleteText.trim() !== "DELETE") return;
    try {
      setDeleting(true);
      await onDelete(initialValue, { skipPrompt: true });
      onCancel?.();
    } catch (err) {
      console.error("Failed to delete product family", err);
      setError(err?.message || "Failed to delete product.");
    } finally {
      setDeleting(false);
    }
  };

  const handleHeaderImage = async (file) => {
    if (!file) return;
    if (headerObjectUrl.current) {
      URL.revokeObjectURL(headerObjectUrl.current);
      headerObjectUrl.current = null;
    }
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.82,
      });
      const url = URL.createObjectURL(compressed);
      headerObjectUrl.current = url;
      setHeaderImage((prev) => ({
        file: compressed,
        preview: url,
        path: prev.path,
        remove: false,
      }));
    } catch (err) {
      console.error("Failed to process header image", err);
      setError("Unable to load header image. Please try a different file.");
    }
  };

  const clearHeaderImage = () => {
    if (headerObjectUrl.current) {
      URL.revokeObjectURL(headerObjectUrl.current);
      headerObjectUrl.current = null;
    }
    setHeaderImage((prev) => ({ ...prev, file: null, preview: null, remove: true }));
  };

  const handleColourImage = async (localId, file) => {
    const target = colours.find((colour) => colour.localId === localId);
    if (target?.previewObjectUrl) {
      URL.revokeObjectURL(target.previewObjectUrl);
      colourObjectUrls.current.delete(target.previewObjectUrl);
    }
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.82,
      });
      const url = URL.createObjectURL(compressed);
      colourObjectUrls.current.add(url);
      setColourAt(localId, {
        imageFile: compressed,
        imagePreview: url,
        removeImage: false,
        previewObjectUrl: url,
      });
    } catch (err) {
      console.error("Failed to process colour image", err);
      setError("Unable to load colour image. Please try a different file.");
    }
  };

  const clearColourImage = (localId) => {
    const target = colours.find((colour) => colour.localId === localId);
    if (target?.previewObjectUrl) {
      URL.revokeObjectURL(target.previewObjectUrl);
      colourObjectUrls.current.delete(target.previewObjectUrl);
    }
    setColourAt(localId, {
      imageFile: null,
      imagePreview: null,
      removeImage: true,
      previewObjectUrl: null,
    });
  };

  const handleSaveSwatchToPalette = async (localId) => {
    if (!onUpsertSwatch) return;
    const colour = colours.find((item) => item.localId === localId);
    const name = colour?.colorName?.trim();
    if (!name) {
      toast.error("Add a colour name before saving to the palette.");
      return;
    }
    if (!colour?.hexColor || !isValidHexColor(colour.hexColor)) {
      toast.error("Add a valid hex colour before saving to the palette.");
      return;
    }
    try {
      const result = await onUpsertSwatch({
        name,
        hexColor: colour.hexColor,
        swatchImageFile: colour.imageFile || null,
      });
      if (result?.colorKey) {
        setColourAt(localId, { colorKey: result.colorKey, hexColor: result.hexColor });
      }
      toast.success(`Saved ${name} to the palette`);
    } catch (err) {
      console.error("Failed to save swatch to palette", err);
      toast.error(err?.message || "Unable to save swatch");
    }
  };

  const trimmedSizes = useMemo(
    () => familyState.sizes.map((size) => size.trim()).filter(Boolean),
    [familyState.sizes]
  );

  const preparedColours = useMemo(
    () =>
      colours
        .filter((colour) => colour.colorName.trim())
        .map((colour) => ({
          ...colour,
          colorName: colour.colorName.trim(),
          skuCode: colour.skuCode.trim(),
          colorKey: colour.colorKey || null,
        })),
    [colours]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const styleName = familyState.styleName.trim();
    const styleNumber = familyState.styleNumber.trim();

    if (!styleName) {
      setError("Style name is required.");
      return;
    }
    if (!styleNumber) {
      setError("Style number is required.");
      return;
    }

    const hasSkuWithoutColour = colours.some(
      (colour) => colour.skuCode.trim() && !colour.colorName.trim()
    );
    if (hasSkuWithoutColour) {
      setError("Add a colour name for each SKU entry or clear the SKU.");
      return;
    }

    if (!preparedColours.length) {
      setError("Add at least one colour.");
      return;
    }

    const resolvedHeroId =
      heroLocalId && preparedColours.some((colour) => colour.localId === heroLocalId)
        ? heroLocalId
        : preparedColours[0]?.localId || null;

    const payload = {
      family: {
        styleName,
        styleNumber,
        previousStyleNumber: familyState.previousStyleNumber.trim() || null,
        gender: familyState.gender,
        productType: familyState.productType || null,
        productSubcategory: familyState.productSubcategory || null,
        status: familyState.status,
        archived: familyState.archived,
        notes: familyState.notes.map((note) => ({
          id: note.id || uid(),
          text: note.text.trim(),
          createdAt:
            typeof note.createdAt === "number"
              ? note.createdAt
              : typeof note.createdAt?.toMillis === "function"
                ? note.createdAt.toMillis()
                : Date.now(),
        })),
        sizes: trimmedSizes,
        heroColorLocalId: resolvedHeroId,
        currentThumbnailImagePath: initialValue?.thumbnailImagePath || null,
        headerImageFile: headerImage.file,
        removeHeaderImage: headerImage.remove,
        currentHeaderImagePath: headerImage.path || null,
      },
      skus: preparedColours.map((colour) => ({
        id: colour.id,
        localId: colour.localId,
        colorName: colour.colorName,
        skuCode: colour.skuCode,
        status: colour.status,
        archived: colour.status === "archived",
        isHero: colour.localId === resolvedHeroId,
        colorKey: colour.colorKey || null,
        hexColor: colour.hexColor || null,
        // All colour entries share the normalised family size list to avoid divergent data.
        sizes: trimmedSizes,
        imageFile: colour.removeImage ? null : colour.imageFile,
        removeImage: colour.removeImage,
        imagePath: colour.imagePath || null,
      })),
      removedSkuIds: removedColourIds,
    };

    try {
      setSubmitting(true);
      await onSubmit?.(payload);
    } catch (err) {
      console.error("Failed to save product family", err);
      setError(err?.message || "Failed to save product.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  const recommendedMessage = "Use 4:5 images (e.g. 1600x2000px JPGs under 2.5MB) for best results.";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Style name</label>
          <Input
            value={familyState.styleName}
            onChange={(event) => updateFamily({ styleName: event.target.value })}
            placeholder="e.g. Honeycomb Knit Merino Henley"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Style number</label>
          <Input
            value={familyState.styleNumber}
            onChange={(event) => updateFamily({ styleNumber: event.target.value })}
            placeholder="e.g. UM2026-3013-01"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Gender</label>
          <select
            value={familyState.gender}
            onChange={(event) => {
              const newGender = event.target.value;
              // Reset type and subcategory when gender changes
              updateFamily({
                gender: newGender,
                productType: null,
                productSubcategory: null,
              });
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Type</label>
          <select
            value={familyState.productType || ""}
            onChange={(event) => {
              const newType = event.target.value || null;
              // Reset subcategory when type changes
              updateFamily({
                productType: newType,
                productSubcategory: null,
              });
            }}
            disabled={!hasCategories(familyState.gender)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">Select type...</option>
            {getTypesForGender(familyState.gender).map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {!hasCategories(familyState.gender) && (
            <p className="text-xs text-slate-500">Categories not available for this gender</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Subcategory</label>
          <select
            value={familyState.productSubcategory || ""}
            onChange={(event) => updateFamily({ productSubcategory: event.target.value || null })}
            disabled={!familyState.productType}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">Select subcategory...</option>
            {getSubcategoriesForType(familyState.gender, familyState.productType).map((sub) => (
              <option key={sub.value} value={sub.value}>
                {sub.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Status</label>
          <select
            value={familyState.status}
            onChange={(event) => updateFamily({ status: event.target.value })}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {FAMILY_STATUS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <SizeListInput
            value={familyState.sizes}
            onChange={(next) => updateFamily({ sizes: next })}
            label="Family sizes"
            helperText="Define the sizes available to this style. Every colour inherits this list automatically."
            inputPlaceholder="e.g. XS"
          />
        </div>
      </div>

      <ColorListEditor
        colors={colours}
        onAddColor={addColour}
        onRemoveColor={removeColour}
        onFieldChange={(localId, updates) => setColourAt(localId, updates)}
        onImageSelect={handleColourImage}
        onClearImage={clearColourImage}
        paletteSwatches={paletteSwatches}
        paletteIndex={resolvedPaletteIndex}
        onSaveToPalette={handleSaveSwatchToPalette}
        statusOptions={SKU_STATUS}
        heroLocalId={heroLocalId}
        onHeroSelect={setHeroLocalId}
        sizeNote={
          trimmedSizes.length
            ? `Colours inherit ${trimmedSizes.length} size${trimmedSizes.length === 1 ? "" : "s"}.`
            : "Add sizes above so colourways inherit the correct SKU list."
        }
        recommendedMessage={recommendedMessage}
        skuHelper="SKU codes are optional today but will support future uniqueness checks."
      />

      <div>
        <button
          type="button"
          className="text-sm font-medium text-primary"
          onClick={() =>
            setAdvancedOpen((open) => {
              if (open) {
                setConfirmingDelete(false);
                setDeleteText("");
              }
              return !open;
            })
          }
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "Hide advanced" : "Show advanced"}
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-4 rounded-card border border-slate-200 p-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Previous style number</label>
              <Input
                value={familyState.previousStyleNumber}
                onChange={(event) =>
                  updateFamily({ previousStyleNumber: event.target.value })
                }
                placeholder="Optional legacy reference"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Header image</label>
              {headerImage.preview && (
                <AppImage
                  src={headerImage.preview}
                  alt="Header preview"
                  loading="lazy"
                  fit="contain"
                  className="flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-card border border-slate-200 bg-slate-50"
                  imageClassName="max-h-72 w-auto object-contain"
                  placeholder={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      Loading preview…
                    </div>
                  }
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      Preview unavailable
                    </div>
                  }
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleHeaderImage(event.target.files?.[0])}
                />
                {(headerImage.preview || headerImage.path) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearHeaderImage}>
                    Remove image
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">{recommendedMessage}</p>
              {headerImage.file && (
                <div className="text-xs text-slate-500">
                  {headerImage.file.name} • {formatFileSize(headerImage.file.size)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Notes & comments</label>
              <p className="text-xs text-slate-500">
                Notes capture context for future edits. Each entry is timestamped automatically.
              </p>
              <div className="space-y-2">
                {familyState.notes.map((note) => (
                  <div key={note.id} className="rounded border border-slate-200 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{new Date(note.createdAt || Date.now()).toLocaleString()}</span>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-600"
                        onClick={() => removeNote(note.id)}
                        aria-label="Delete note"
                      >
                        ×
                      </button>
                    </div>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(note.text || ""),
                      }}
                    />
                  </div>
                ))}
              </div>
              <RichTextEditor
                value={newNoteText}
                onChange={setNewNoteText}
                placeholder="Add a note with formatting (press Add note to save with timestamp)"
                minHeight="72px"
                maxHeight="200px"
                characterLimit={5000}
                hideToolbar={false}
                className="product-note-editor"
              />
              <div className="flex justify-end">
                <Button type="button" onClick={addNote} disabled={!newNoteText.trim()}>
                  Add note
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Checkbox
                  checked={familyState.archived}
                  onChange={(event) => updateFamily({ archived: event.target.checked })}
                />
                Archived
              </label>
              <p className="text-xs text-slate-500">
                Archived products stay hidden from selectors but remain available for history and migration.
              </p>
            </div>
            {canDelete && initialValue?.id && onDelete && (
              <div className="space-y-3 rounded-card border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-red-800">Danger zone</p>
                    <p className="text-xs text-red-700">
                      Delete this product family and all colourways. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={confirmingDelete ? "secondary" : "destructive"}
                    size="sm"
                    onClick={() => {
                      setConfirmingDelete((open) => !open);
                      setDeleteText("");
                    }}
                    disabled={deleting}
                  >
                    {confirmingDelete ? "Cancel" : "Delete family"}
                  </Button>
                </div>
                {confirmingDelete && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-700">
                      Type DELETE to confirm. This removes the family and all colourways from selectors.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={deleteText}
                        onChange={(event) => setDeleteText(event.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="w-full max-w-xs"
                        disabled={deleting}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfirmingDelete(false);
                          setDeleteText("");
                        }}
                        disabled={deleting}
                      >
                        Never mind
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteFamily}
                        disabled={deleting || deleteText.trim() !== "DELETE"}
                      >
                        {deleting ? "Deleting…" : "Permanently delete"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting || deleting}>
          {submitting && <LoadingSpinner size="sm" className="mr-2" />}
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
