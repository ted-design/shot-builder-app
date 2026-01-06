// src/components/callsheet/entries/EntryFormModal.jsx
// Modal/Sheet wrapper for adding/editing schedule entries

import React, { useState, useCallback } from "react";
import { X, Camera, Wrench } from "lucide-react";
import { Button } from "../../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../ui/sheet";
import ShotEntryPicker from "./ShotEntryPicker";
import CustomEntryForm from "./CustomEntryForm";

/**
 * EntryFormModal - Modal/Sheet for adding/editing schedule entries
 * Uses Sheet for shot picker (wider panel) and Modal for custom items
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} props.mode - 'shot' | 'custom' | 'select' (choose type first)
 * @param {string} props.initialCategory - Pre-selected category for custom entries
 * @param {string|null} props.defaultStartTime - Optional HH:MM time to add entries at
 * @param {Array} props.shots - Available shots
 * @param {boolean} props.shotsLoading - Whether shots are loading
 * @param {Array} props.tracks - Available tracks
 * @param {Array} props.existingEntries - Existing entries in schedule
 * @param {Map} props.talentMap - Talent lookup map
 * @param {Map} props.productsMap - Products lookup map
 * @param {Function} props.onAddShot - Callback when shot is added
 * @param {Function} props.onCreateShot - Callback to create a new shot
 * @param {Function} props.onAddCustomItem - Callback when custom item is added
 * @param {object} props.editingEntry - Entry being edited (for edit mode)
 */
function EntryFormModal({
  isOpen,
  onClose,
  mode = "select",
  initialCategory = null,
  defaultStartTime = null,
  shots = [],
  shotsLoading = false,
  tracks = [],
  existingEntries = [],
  talentMap = new Map(),
  productsMap = new Map(),
  onAddShot,
  onCreateShot,
  onAddCustomItem,
  onUpdateCustomItem,
  editingEntry = null,
}) {
  const [activeMode, setActiveMode] = useState(mode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset mode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (editingEntry?.type === "custom") {
        setActiveMode("custom");
      } else {
        setActiveMode(mode);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, mode, editingEntry]);

  // Handle shot selection
  const handleSelectShot = useCallback(
    async (shotId, trackId, startTime = null) => {
      try {
        setIsSubmitting(true);
        await onAddShot(shotId, trackId, startTime);
        // Don't close - allow adding multiple shots
      } catch (error) {
        console.error("Failed to add shot:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAddShot]
  );

  // Handle custom item submission
  const handleCustomSubmit = useCallback(
    async ({ customData, trackId, duration, appliesToTrackIds }) => {
      try {
        setIsSubmitting(true);
        if (editingEntry?.type === "custom") {
          await onUpdateCustomItem?.(editingEntry.id, { customData, trackId, duration, appliesToTrackIds });
        } else {
          await onAddCustomItem(customData, trackId, duration, appliesToTrackIds, defaultStartTime);
          onClose();
        }
      } catch (error) {
        console.error("Failed to add custom item:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingEntry, onUpdateCustomItem, onAddCustomItem, onClose]
  );

  // Modal title based on mode
  const getTitle = () => {
    if (editingEntry?.type === "custom") return "Edit Banner";
    const atTime = defaultStartTime ? ` at ${defaultStartTime}` : "";
    switch (activeMode) {
      case "shot":
        return `Add Shots to Schedule${atTime}`;
      case "custom":
        return initialCategory
          ? `Add ${initialCategory.charAt(0).toUpperCase() + initialCategory.slice(1)}${atTime}`
          : `Add Custom Item${atTime}`;
      default:
        return "Add to Schedule";
    }
  };

  // Use Sheet for shot picker mode (wider panel)
  if (activeMode === "shot" && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-xl md:max-w-2xl"
        >
          <SheetHeader className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <SheetTitle>{getTitle()}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ShotEntryPicker
              shots={shots}
              loading={shotsLoading}
              existingEntries={existingEntries}
              tracks={tracks}
              talentMap={talentMap}
              productsMap={productsMap}
              onSelectShot={handleSelectShot}
              defaultStartTime={defaultStartTime}
              onCreateShot={onCreateShot}
              onClose={onClose}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Use standard modal for type selection and custom items
  if (!isOpen) return null;

  const customInitialData =
    editingEntry?.type === "custom"
      ? {
          title: editingEntry.customData?.title || "",
          category: editingEntry.customData?.category || initialCategory || "other",
          duration: typeof editingEntry.duration === "number" ? editingEntry.duration : 30,
          notes: editingEntry.notes || editingEntry.customData?.notes || "",
          trackId: editingEntry.trackId || null,
          appliesToTrackIds: editingEntry.appliesToTrackIds || null,
        }
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-form-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="entry-form-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {getTitle()}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(85vh-60px)] overflow-y-auto">
          {/* Type selector (when in select mode) */}
          {activeMode === "select" && !editingEntry && (
            <div className="p-4">
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                What would you like to add?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveMode("shot")}
                  className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-6 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Camera className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Shot
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Add existing shot from project
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveMode("custom")}
                  className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-6 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <Wrench className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Custom Item
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Setup, break, lunch, etc.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Custom entry form */}
          {activeMode === "custom" && (
            <CustomEntryForm
              initialData={customInitialData}
              initialCategory={initialCategory}
              tracks={tracks}
              defaultStartTime={defaultStartTime}
              onSubmit={handleCustomSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default EntryFormModal;
