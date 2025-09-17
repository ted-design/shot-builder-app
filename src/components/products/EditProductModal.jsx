import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import ProductFamilyForm from "./ProductFamilyForm";

export default function EditProductModal({
  open,
  family,
  loading,
  onClose,
  onSubmit,
  onDelete,
  canDelete = false,
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
                <p className="text-sm text-slate-500">Style #{family.styleNumber}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={() => onDelete?.(family)}>
                  Delete
                </Button>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-xl text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading product…</div>
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
            />
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
