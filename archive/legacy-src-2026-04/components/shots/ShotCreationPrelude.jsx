/**
 * ShotCreationPrelude
 *
 * A lightweight modal for gathering intent before creating a shot.
 * Per design-spec.md: "Creation may add a lightweight guided prelude,
 * but must drop into the same editor with pre-filled state."
 *
 * This component captures:
 * - Shot type (E-comm, Lifestyle, Campaign, Custom)
 * - Optional quantity for bulk creation
 *
 * After submission, creates shot(s) and navigates to Shot Editor V3.
 * Products are added in the editor, not in the prelude (keeping it lightweight).
 */

import React, { useState, useMemo, useCallback, useId } from "react";
import { Camera, Package, Sparkles, Wand2, Plus, Minus, X } from "lucide-react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

// Shot type definitions
const SHOT_TYPES = [
  {
    id: "ecomm",
    label: "E-comm",
    description: "Product-focused, clean background",
    icon: Package,
    namePrefix: "E-comm",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    description: "Product in context, environmental",
    icon: Camera,
    namePrefix: "Lifestyle",
  },
  {
    id: "campaign",
    label: "Campaign",
    description: "Brand storytelling, marketing",
    icon: Sparkles,
    namePrefix: "Campaign",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Define your own shot type",
    icon: Wand2,
    namePrefix: "Shot",
  },
];

/**
 * Generate shot name based on type
 * @param {string} typeId - Shot type ID
 * @param {number} index - For bulk creation (0-based)
 * @param {number} total - Total shots being created
 * @returns {string} Generated shot name
 */
function generateShotName(typeId, index = 0, total = 1) {
  const type = SHOT_TYPES.find((t) => t.id === typeId) || SHOT_TYPES[3];
  const prefix = type.namePrefix;

  // Standard naming with optional index for bulk
  return total > 1 ? `${prefix} Shot ${index + 1}` : `${prefix} Shot`;
}

export default function ShotCreationPrelude({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) {
  const titleId = useId();

  // Internal state
  const [selectedType, setSelectedType] = useState("ecomm");
  const [quantity, setQuantity] = useState(1);

  // Get selected type config
  const selectedTypeConfig = useMemo(
    () => SHOT_TYPES.find((t) => t.id === selectedType) || SHOT_TYPES[0],
    [selectedType]
  );

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSelectedType("ecomm");
    setQuantity(1);
    onClose();
  }, [onClose]);

  // Handle type selection
  const handleTypeSelect = useCallback((typeId) => {
    setSelectedType(typeId);
  }, []);

  // Handle quantity change
  const handleQuantityChange = useCallback((delta) => {
    setQuantity((prev) => Math.max(1, Math.min(10, prev + delta)));
  }, []);

  // Generate preview names for display
  const previewNames = useMemo(() => {
    const names = [];
    for (let i = 0; i < Math.min(quantity, 3); i++) {
      names.push(generateShotName(selectedType, i, quantity));
    }
    if (quantity > 3) {
      names.push(`...and ${quantity - 3} more`);
    }
    return names;
  }, [selectedType, quantity]);

  // Handle submission
  const handleSubmit = useCallback(() => {
    const shots = [];
    for (let i = 0; i < quantity; i++) {
      const name = generateShotName(selectedType, i, quantity);
      shots.push({
        name,
        type: selectedTypeConfig.label,
        shotType: selectedType,
      });
    }
    onSubmit(shots);
  }, [selectedType, selectedTypeConfig, quantity, onSubmit]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      labelledBy={titleId}
      contentClassName="sm:max-w-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
            New Shot
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            What kind of shot are you planning?
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Shot Type Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Shot Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SHOT_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeSelect(type.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isSelected
                          ? "text-primary"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isSelected
                          ? "text-primary"
                          : "text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {type.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            How many shots?{" "}
            <span className="font-normal text-slate-400">(1-10)</span>
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center text-lg font-medium tabular-nums text-slate-900 dark:text-white">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= 10}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {quantity > 1 && (
              <span className="text-sm text-slate-500">
                shots will be created
              </span>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Preview
          </p>
          <div className="space-y-1">
            {previewNames.map((name, idx) => (
              <p
                key={idx}
                className={cn(
                  "text-sm",
                  name.startsWith("...")
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-700 dark:text-slate-300"
                )}
              >
                {name}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
        <Button type="button" variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isLoading}>
          {isLoading
            ? "Creating..."
            : quantity > 1
              ? `Create ${quantity} Shots`
              : "Create Shot"}
        </Button>
      </div>
    </Modal>
  );
}

// Export for use in parent components
export { SHOT_TYPES, generateShotName };
