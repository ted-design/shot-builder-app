import { Card, CardContent, CardHeader } from "../ui/card";
import { Modal } from "../ui/modal";
import { LoadingOverlay } from "../ui/LoadingSpinner";
import ProductFamilyForm from "./ProductFamilyForm";

export default function EditProductModal({
  open,
  family,
  loading,
  onClose,
  onSubmit,
  onDelete,
  canDelete = false,
  paletteSwatches = [],
  paletteIndex,
  onUpsertSwatch,
}) {
  const titleId = "edit-product-title";
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      contentClassName="p-0 max-h-[90vh] overflow-y-auto"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {family?.styleName || "Edit product"}
              </h2>
              {family?.styleNumber && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Style #{family.styleNumber}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {loading ? (
            <LoadingOverlay message="Loading product details..." />
          ) : (
            <ProductFamilyForm
              initialValue={family}
              onSubmit={async (payload) => {
                await onSubmit?.(payload);
                onClose?.();
              }}
              onCancel={onClose}
              submitLabel="Save changes"
              canDelete={canDelete}
              onDelete={onDelete}
              paletteSwatches={paletteSwatches}
              paletteIndex={paletteIndex}
              onUpsertSwatch={onUpsertSwatch}
            />
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
