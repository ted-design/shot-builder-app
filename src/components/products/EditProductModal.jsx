import React from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
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
}) {
  const titleId = "edit-product-title";
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleteText, setDeleteText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete((v) => !v);
                    setDeleteText("");
                  }}
                  disabled={loading || deleting}
                >
                  Delete
                </Button>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-xl text-slate-500 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {confirmingDelete && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm text-red-700">
                This will permanently remove this product family and all SKUs. To confirm, type
                "DELETE" below and press Permanently delete.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={loading || deleting}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!onDelete) return;
                    if (deleteText.trim() !== "DELETE") return;
                    try {
                      setDeleting(true);
                      await onDelete(family, { skipPrompt: true });
                      onClose?.();
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleteText.trim() !== "DELETE" || loading || deleting}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
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
              submitLabel={deleting ? "Deleting…" : "Save changes"}
              canDelete={canDelete}
            />
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
