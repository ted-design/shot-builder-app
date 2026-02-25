import { Button } from "../ui/button";
import AppImage from "../common/AppImage";
import { Skeleton } from "../ui/Skeleton";
import { AllocationStatusBadge } from "./SourceAllocationSelector";

const ALL_SIZES_VALUE = "__ALL_SIZES__";

/**
 * Enhanced product card for the Shot Edit modal with inline color and size dropdowns.
 * Replaces ShotProductTile with a larger, more interactive card.
 */
export default function ShotProductCard({
  product,
  familyDetails,
  isLoading,
  onChange,
  onEdit,
  onRemove,
}) {
  const imagePath =
    product.images?.[0] ||
    product.colourImagePath ||
    product.thumbnailImagePath ||
    null;

  const colours = familyDetails?.colours || [];
  const sizes = familyDetails?.sizes || [];

  // Get sizes for the currently selected colorway (may override family sizes)
  const selectedColour = colours.find((c) => c.id === product.colourId);
  const availableSizes =
    selectedColour?.sizes?.length > 0 ? selectedColour.sizes : sizes;

  // Derive size display value
  const getSizeDisplayValue = () => {
    if (product.status === "pending-size" || product.sizeScope === "pending") {
      return "";
    }
    if (product.sizeScope === "all") {
      return ALL_SIZES_VALUE;
    }
    return product.size || "";
  };

  // Handle colorway change
  const handleColourChange = (event) => {
    const newColourId = event.target.value;
    const newColour = colours.find((c) => c.id === newColourId);

    if (!newColour) return;

    // Check if current size is valid for new colorway
    const newColourSizes =
      newColour.sizes?.length > 0 ? newColour.sizes : sizes;
    const currentSizeValid =
      product.size && newColourSizes.includes(product.size);

    // Build updated product
    const updatedProduct = {
      ...product,
      colourId: newColour.id,
      colourName: newColour.colorName,
      colourImagePath: newColour.imagePath || null,
    };

    // Reset size if not valid in new colorway
    if (!currentSizeValid && product.sizeScope === "single") {
      updatedProduct.size = null;
      updatedProduct.sizeScope = "pending";
      updatedProduct.status = "pending-size";
    }

    onChange(updatedProduct);
  };

  // Handle size change
  const handleSizeChange = (event) => {
    const value = event.target.value;

    let updatedProduct;
    if (value === "") {
      // "Decide later"
      updatedProduct = {
        ...product,
        size: null,
        sizeScope: "pending",
        status: "pending-size",
      };
    } else if (value === ALL_SIZES_VALUE) {
      // "All sizes"
      updatedProduct = {
        ...product,
        size: null,
        sizeScope: "all",
        status: "complete",
      };
    } else {
      // Specific size
      updatedProduct = {
        ...product,
        size: value,
        sizeScope: "single",
        status: "complete",
      };
    }

    onChange(updatedProduct);
  };

  return (
    <div className="flex w-[180px] flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
      {/* Product Image */}
      <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800">
        <AppImage
          src={imagePath}
          alt={`${product.familyName} ${product.colourName}`}
          preferredSize={360}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          fallback={
            <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No image
            </div>
          }
          placeholder={
            <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Loading...
            </div>
          }
        />
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Name and Style Number */}
        <div className="min-w-0">
          <div
            className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight"
            title={product.familyName}
          >
            {product.familyName}
          </div>
          {product.styleNumber && (
            <div
              className="truncate text-xs text-slate-500 dark:text-slate-400 leading-tight"
              title={`#${product.styleNumber}`}
            >
              #{product.styleNumber}
            </div>
          )}
        </div>

        {/* Color Dropdown */}
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Color
          </label>
          {isLoading ? (
            <Skeleton className="h-8 w-full rounded" />
          ) : colours.length > 0 ? (
            <select
              className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-indigo-500"
              value={product.colourId || ""}
              onChange={handleColourChange}
            >
              {colours.map((colour) => (
                <option key={colour.id} value={colour.id}>
                  {colour.colorName}
                  {colour.skuCode ? ` (${colour.skuCode})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              No colorways
            </div>
          )}
        </div>

        {/* Size Dropdown */}
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Size
          </label>
          {isLoading ? (
            <Skeleton className="h-8 w-full rounded" />
          ) : availableSizes.length > 0 ? (
            <select
              className={`w-full rounded border px-2 py-1.5 text-xs transition-colors ${
                getSizeDisplayValue() === ""
                  ? "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20"
                  : "border-slate-200 dark:border-slate-600"
              } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-indigo-500`}
              value={getSizeDisplayValue()}
              onChange={handleSizeChange}
            >
              <option value="">Decide later</option>
              <option value={ALL_SIZES_VALUE}>All sizes</option>
              {availableSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              No sizes defined
            </div>
          )}
        </div>

        {/* Pending Status Badge */}
        {product.status === "pending-size" && (
          <div className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Size pending
          </div>
        )}

        {/* Allocation Status Badge */}
        {product.allocation && (
          <div className="flex items-center gap-1.5">
            <AllocationStatusBadge allocation={product.allocation} />
            {product.allocation.sourceLabel && product.allocation.status === "allocated" && (
              <span className="text-3xs text-slate-500 dark:text-slate-400 truncate" title={product.allocation.sourceLabel}>
                {product.allocation.sourceLabel}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 h-7 px-2 py-0 text-xs"
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 h-7 px-2 py-0 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
