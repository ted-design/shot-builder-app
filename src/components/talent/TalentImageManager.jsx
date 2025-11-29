import { useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Upload, Trash2, ArrowUp, ArrowDown, Crop as CropIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import Thumb from "../Thumb";
import AdvancedImageCropEditor from "../shots/AdvancedImageCropEditor";

const MAX_TALENT_IMAGES = 10;

const normaliseOrder = (items = []) =>
  items
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item, index) => ({ ...item, order: index }));

const previewPath = (attachment) => attachment?.previewUrl || attachment?.downloadURL || attachment?.path || "";

export default function TalentImageManager({ attachments = [], onChange, disabled = false }) {
  const [error, setError] = useState("");
  const [cropTarget, setCropTarget] = useState(null);
  const fileInputRef = useRef(null);

  const orderedAttachments = useMemo(() => normaliseOrder(attachments), [attachments]);

  const remainingSlots = Math.max(0, MAX_TALENT_IMAGES - orderedAttachments.length);

  const handleFilesAdded = (files) => {
    if (!files || files.length === 0) return;
    if (disabled) return;

    const available = remainingSlots;
    if (files.length > available) {
      setError(`You can add ${available === 0 ? "no" : available} more image${available === 1 ? "" : "s"}.`);
      return;
    }

    setError("");
    const next = orderedAttachments.slice();
    files.forEach((file) => {
      const id = nanoid();
      const previewUrl = URL.createObjectURL(file);
      next.push({
        id,
        file,
        previewUrl,
        description: "",
        cropData: null,
        order: next.length,
      });
    });

    if (typeof onChange === "function") {
      onChange(normaliseOrder(next));
    }
  };

  const handleRemove = (id) => {
    const removed = orderedAttachments.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    const filtered = orderedAttachments.filter((item) => item.id !== id);
    setError("");
    if (typeof onChange === "function") {
      onChange(normaliseOrder(filtered));
    }
  };

  const handleMove = (id, direction) => {
    const currentIndex = orderedAttachments.findIndex((item) => item.id === id);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= orderedAttachments.length) return;

    const next = orderedAttachments.slice();
    const temp = next[currentIndex];
    next[currentIndex] = next[targetIndex];
    next[targetIndex] = temp;

    if (typeof onChange === "function") {
      onChange(normaliseOrder(next));
    }
  };

  const handleDescriptionChange = (id, value) => {
    if (typeof onChange !== "function") return;
    const next = orderedAttachments.map((item) => (item.id === id ? { ...item, description: value } : item));
    onChange(next);
  };

  const handleSaveCrop = (cropData) => {
    if (!cropTarget || typeof onChange !== "function") return;
    const next = orderedAttachments.map((item) => (item.id === cropTarget.id ? { ...item, cropData } : item));
    onChange(next);
    setCropTarget(null);
  };

  const handleFileInputChange = (event) => {
    const files = Array.from(event.target.files || []);
    handleFilesAdded(files);
    event.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Additional images</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Attach extra looks or angles with optional descriptions.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || remainingSlots === 0}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || remainingSlots === 0}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Add images
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">{remainingSlots} left</span>
        </div>
      </div>

      {orderedAttachments.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No additional images yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedAttachments.map((attachment, index) => (
            <div
              key={attachment.id}
              className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                <Thumb
                  path={previewPath(attachment)}
                  size={512}
                  alt={`Talent image ${index + 1}`}
                  className="h-full w-full"
                  imageClassName="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                      No image
                    </div>
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <Input
                  value={attachment.description || ""}
                  onChange={(event) => handleDescriptionChange(attachment.id, event.target.value)}
                  placeholder="Short description"
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCropTarget(attachment)}
                    disabled={disabled}
                    className="flex items-center gap-2"
                  >
                    <CropIcon className="h-4 w-4" />
                    Crop
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(attachment.id)}
                    disabled={disabled}
                    className="flex items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMove(attachment.id, -1)}
                    disabled={disabled || index === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMove(attachment.id, 1)}
                    disabled={disabled || index === orderedAttachments.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {cropTarget && (
        <AdvancedImageCropEditor
          open={!!cropTarget}
          onClose={() => setCropTarget(null)}
          attachment={{ ...cropTarget, downloadURL: previewPath(cropTarget), path: previewPath(cropTarget) }}
          onSave={handleSaveCrop}
        />
      )}
    </div>
  );
}
