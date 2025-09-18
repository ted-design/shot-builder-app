import { useEffect, useMemo, useRef, useState } from "react";
import { storage } from "../../lib/firebase";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { Button } from "../ui/button";
import { Input, Checkbox } from "../ui/input";
import SizeListInput from "./SizeListInput";
import ColorListEditor from "./ColorListEditor";
import { compressImageFile, formatFileSize } from "../../lib/images";

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
  { value: "discontinued", label: "Discontinued" },
  { value: "archived", label: "Archived" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const createEmptyColour = () => ({
  localId: uid(),
  id: null,
  colorName: "",
  skuCode: "",
  status: "active",
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
    imagePath: sku.imagePath || null,
    imageFile: null,
    imagePreview: sku.imageUrl || null,
    removeImage: false,
    previewObjectUrl: null,
  }));
};

export default function ProductFamilyForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  canDelete,
}) {
  const [familyState, setFamilyState] = useState(() => buildInitialState(initialValue));
  const [colours, setColours] = useState(() => buildInitialColours(initialValue));
  const [removedColourIds, setRemovedColourIds] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    if (!initialValue) return false;
    const notesLength = Array.isArray(initialValue.notes) ? initialValue.notes.length : 0;
    return Boolean(
      initialValue.previousStyleNumber ||
        initialValue.headerImagePath ||
        notesLength ||
        initialValue.thumbnailImagePath
    );
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");

  const [thumbnailImage, setThumbnailImage] = useState({
    file: null,
    preview: null,
    path: initialValue?.thumbnailImagePath || null,
    remove: false,
  });
  const [headerImage, setHeaderImage] = useState({
    file: null,
    preview: null,
    path: initialValue?.headerImagePath || null,
    remove: false,
  });

  const thumbnailObjectUrl = useRef(null);
  const headerObjectUrl = useRef(null);
  const colourObjectUrls = useRef(new Set());

  useEffect(() => {
    setFamilyState(buildInitialState(initialValue));
    setColours(buildInitialColours(initialValue));
    setRemovedColourIds([]);
    setThumbnailImage((prev) => ({
      ...prev,
      file: null,
      preview: null,
      path: initialValue?.thumbnailImagePath || null,
      remove: false,
    }));
    setHeaderImage((prev) => ({
      ...prev,
      file: null,
      preview: null,
      path: initialValue?.headerImagePath || null,
      remove: false,
    }));
  }, [initialValue]);

  useEffect(() => {
    let cancelled = false;
    if (!initialValue?.thumbnailImagePath) {
      setThumbnailImage((prev) => ({ ...prev, preview: null, path: null }));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const url = await getDownloadURL(
          storageRef(storage, initialValue.thumbnailImagePath)
        );
        if (!cancelled) {
          setThumbnailImage((prev) => ({
            ...prev,
            preview: url,
            path: initialValue.thumbnailImagePath,
            remove: false,
          }));
        }
      } catch (err) {
        console.warn("Failed to load thumbnail image", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialValue?.thumbnailImagePath]);

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

  useEffect(
    () => () => {
      if (thumbnailObjectUrl.current) {
        URL.revokeObjectURL(thumbnailObjectUrl.current);
        thumbnailObjectUrl.current = null;
      }
    },
    []
  );

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
      prev.map((colour) =>
        colour.localId === localId ? { ...colour, ...updates } : colour
      )
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

  const handleThumbnailImage = async (file) => {
    if (!file) return;
    if (thumbnailObjectUrl.current) {
      URL.revokeObjectURL(thumbnailObjectUrl.current);
      thumbnailObjectUrl.current = null;
    }
    const compressed = await compressImageFile(file, {
      maxDimension: 1600,
      quality: 0.82,
    });
    const url = URL.createObjectURL(compressed);
    thumbnailObjectUrl.current = url;
    setThumbnailImage((prev) => ({
      file: compressed,
      preview: url,
      path: prev.path,
      remove: false,
    }));
  };

  const clearThumbnailImage = () => {
    if (thumbnailObjectUrl.current) {
      URL.revokeObjectURL(thumbnailObjectUrl.current);
      thumbnailObjectUrl.current = null;
    }
    setThumbnailImage((prev) => ({ ...prev, file: null, preview: null, remove: true }));
  };

  const handleHeaderImage = async (file) => {
    if (!file) return;
    if (headerObjectUrl.current) {
      URL.revokeObjectURL(headerObjectUrl.current);
      headerObjectUrl.current = null;
    }
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

    const payload = {
      family: {
        styleName,
        styleNumber,
        previousStyleNumber: familyState.previousStyleNumber.trim() || null,
        gender: familyState.gender,
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
        thumbnailImageFile: thumbnailImage.file,
        removeThumbnailImage: thumbnailImage.remove,
        currentThumbnailImagePath: thumbnailImage.path || null,
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

  const recommendedMessage = "Use 1600x2000px JPGs under 2.5MB for best results.";

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
            onChange={(event) => updateFamily({ gender: event.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Status</label>
          <select
            value={familyState.status}
            onChange={(event) => updateFamily({ status: event.target.value })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-medium text-slate-700">Family thumbnail</label>
          {thumbnailImage.preview && (
            <img
              src={thumbnailImage.preview}
              alt="Thumbnail preview"
              className="h-48 w-full rounded-lg object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleThumbnailImage(event.target.files?.[0])}
            />
            {(thumbnailImage.preview || thumbnailImage.path) && (
              <Button type="button" variant="ghost" size="sm" onClick={clearThumbnailImage}>
                Remove image
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">{recommendedMessage}</p>
          {thumbnailImage.file && (
            <div className="text-xs text-slate-500">
              {thumbnailImage.file.name} • {formatFileSize(thumbnailImage.file.size)}
            </div>
          )}
        </div>
      </div>

      <ColorListEditor
        colors={colours}
        onAddColor={addColour}
        onRemoveColor={removeColour}
        onFieldChange={(localId, updates) => setColourAt(localId, updates)}
        onImageSelect={handleColourImage}
        onClearImage={clearColourImage}
        statusOptions={SKU_STATUS}
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
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "Hide advanced" : "Show advanced"}
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4">
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
                <img
                  src={headerImage.preview}
                  alt="Header preview"
                  className="h-48 w-full rounded-lg object-cover"
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
                        className="text-slate-400 hover:text-slate-600"
                        onClick={() => removeNote(note.id)}
                        aria-label="Delete note"
                      >
                        ×
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700">{note.text}</div>
                  </div>
                ))}
              </div>
              <textarea
                value={newNoteText}
                onChange={(event) => setNewNoteText(event.target.value)}
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Add a note (press Add note to save with timestamp)"
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
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {canDelete && (
          <span className="text-xs text-slate-500">Contact an admin to delete a product permanently.</span>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
