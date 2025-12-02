import { Card, CardContent, CardHeader } from "../ui/card";
import { Modal } from "../ui/modal";
import ProductFamilyForm from "./ProductFamilyForm";

export default function NewProductModal({
  open,
  onClose,
  onSubmit,
  paletteSwatches = [],
  paletteIndex,
  onUpsertSwatch,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="new-product-title"
      contentClassName="p-0 max-h-[90vh] overflow-y-auto"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 id="new-product-title" className="text-lg font-semibold">
                New product family
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Capture shared style details, then add colourway SKUs.
              </p>
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
          <ProductFamilyForm
            onSubmit={async (payload) => {
              try {
                const result = await onSubmit?.(payload);
                onClose?.(); // Only close on success
                return result;
              } catch (error) {
                // Re-throw error so form can display it
                throw error;
              }
            }}
            onCancel={onClose}
            submitLabel="Create product"
            paletteSwatches={paletteSwatches}
            paletteIndex={paletteIndex}
            onUpsertSwatch={onUpsertSwatch}
          />
        </CardContent>
      </Card>
    </Modal>
  );
}
