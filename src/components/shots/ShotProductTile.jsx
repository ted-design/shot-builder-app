import { Button } from "../ui/button";
import { useStorageImage } from "../../hooks/useStorageImage";

export default function ShotProductTile({ product, onEdit, onRemove }) {
  const imagePath = product.images?.[0] || product.colourImagePath || product.thumbnailImagePath || null;
  const imageUrl = useStorageImage(imagePath);
  const sizeLabel =
    product.status === "pending-size"
      ? "Pending"
      : product.sizeScope === "all"
      ? "All sizes"
      : product.size || "All sizes";
  const primaryActionLabel = product.status === "pending-size" ? "Choose size" : "Edit";
  const primaryActionVariant = product.status === "pending-size" ? "default" : "secondary";

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="aspect-square w-full bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${product.familyName} ${product.colourName}`}
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800" title={product.familyName}>
            {product.familyName}
          </div>
          {product.styleNumber && (
            <div className="truncate text-xs text-slate-500" title={`Style #${product.styleNumber}`}>
              Style #{product.styleNumber}
            </div>
          )}
        </div>
        <div className="text-xs text-slate-600">Colour: {product.colourName || "Any"}</div>
        <div className="text-xs text-slate-600">Size: {sizeLabel}</div>
        {product.status === "pending-size" && (
          <div className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Pending size
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant={primaryActionVariant}
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={onEdit}
          >
            {primaryActionLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 py-1 text-xs"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
