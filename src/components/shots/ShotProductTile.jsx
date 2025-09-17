import { Button } from "../ui/button";
import { useStorageImage } from "../../hooks/useStorageImage";

export default function ShotProductTile({ product, onEdit, onRemove }) {
  const imagePath = product.colourImagePath || product.thumbnailImagePath || null;
  const imageUrl = useStorageImage(imagePath);
  const sizeLabel = product.size ? product.size : "All sizes";

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="aspect-square w-full bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={`${product.familyName} ${product.colourName}`} className="h-full w-full object-cover" />
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
        <div className="text-xs text-slate-600">Colour: {product.colourName}</div>
        <div className="text-xs text-slate-600">Size: {sizeLabel}</div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button variant="secondary" size="sm" className="px-2 py-1 text-xs" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="px-2 py-1 text-xs" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
