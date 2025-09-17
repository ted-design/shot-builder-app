import { Card, CardContent, CardHeader } from "../ui/card";
import { Modal } from "../ui/modal";
import ProductFamilyForm from "./ProductFamilyForm";

export default function NewProductModal({ open, onClose, onSubmit }) {
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
              <p className="text-sm text-slate-500">
                Capture shared style details, then add colourway SKUs.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <ProductFamilyForm
            onSubmit={async (payload) => {
              await onSubmit?.(payload);
              onClose?.();
            }}
            onCancel={onClose}
            submitLabel="Create product"
          />
        </CardContent>
      </Card>
    </Modal>
  );
}
