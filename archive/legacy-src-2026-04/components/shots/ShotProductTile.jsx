import { Button } from "../ui/button";
import AppImage from "../common/AppImage";

export default function ShotProductTile({ product, onEdit, onRemove }) {
  const imagePath = product.images?.[0] || product.colourImagePath || product.thumbnailImagePath || null;
  const sizeLabel =
    product.status === "pending-size"
      ? "Pending"
      : product.sizeScope === "all"
      ? "All sizes"
      : product.size || "All sizes";
  const primaryActionLabel = product.status === "pending-size" ? "Choose size" : "Edit";
  const primaryActionVariant = product.status === "pending-size" ? "default" : "secondary";

  return (
    <div className="flex w-20 flex-col gap-1 overflow-hidden rounded-card border border-slate-200 bg-white">
      <div className="aspect-square w-full bg-slate-100">
        <AppImage
          src={imagePath}
          alt={`${product.familyName} ${product.colourName}`}
          preferredSize={240}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          fallback={
            <div className="flex h-full items-center justify-center text-2xs text-slate-500">No image</div>
          }
          placeholder={
            <div className="flex h-full items-center justify-center text-2xs text-slate-500">
              Loading…
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-1.5 pb-1.5">
        <div className="min-w-0">
          <div className="truncate text-2xs font-semibold text-slate-800 leading-tight" title={product.familyName}>
            {product.familyName}
          </div>
          {product.styleNumber && (
            <div className="truncate text-3xs text-slate-500 leading-tight" title={`#${product.styleNumber}`}>
              #{product.styleNumber}
            </div>
          )}
        </div>
        <div className="text-3xs text-slate-600 truncate" title={`Colour: ${product.colourName || "Any"}`}>
          {product.colourName || "Any"}
        </div>
        <div className="text-3xs text-slate-600 truncate" title={`Size: ${sizeLabel}`}>
          {sizeLabel}
        </div>
        {product.status === "pending-size" && (
          <div className="inline-flex w-fit items-center rounded-full bg-amber-100 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-700">
            Pending
          </div>
        )}
        <div className="mt-auto flex flex-col gap-0.5 pt-1">
          <Button
            type="button"
            variant={primaryActionVariant}
            size="sm"
            className="h-5 px-1 py-0 text-3xs"
            onClick={onEdit}
          >
            {product.status === "pending-size" ? "Size" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1 py-0 text-3xs"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
