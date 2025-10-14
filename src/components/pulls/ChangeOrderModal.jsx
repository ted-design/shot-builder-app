// src/components/pulls/ChangeOrderModal.jsx
//
// Modal for warehouse staff to request a product substitution when
// the original item cannot be fulfilled.

import React, { useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ShotProductAddModal from "../shots/ShotProductAddModal";
import { getPullItemDisplayName } from "../../lib/pullItems";
import { toast } from "../../lib/toast";

export default function ChangeOrderModal({
  originalItem,
  families,
  loadFamilyDetails,
  onSubmit,
  onClose,
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [sizes, setSizes] = useState([]);
  const [reason, setReason] = useState("");

  const handleProductSelect = (selection) => {
    const { family, colour, size } = selection;

    setSelectedProduct({
      familyId: family.id,
      familyName: family.styleName,
      styleNumber: family.styleNumber || null,
      colourId: colour.id || null,
      colourName: colour.colorName || null,
      colourImagePath: colour.imagePath || null,
      gender: family.gender || null,
      category: family.category || null,
    });

    // If a size was selected, add it to sizes array
    if (size && size !== "__ALL_SIZES__") {
      const existingIndex = sizes.findIndex((s) => s.size === size);
      if (existingIndex === -1) {
        setSizes([...sizes, { size, quantity: 1 }]);
      }
    }

    setProductModalOpen(false);
  };

  const handleAddSize = () => {
    setSizes([...sizes, { size: "", quantity: 1 }]);
  };

  const handleUpdateSize = (index, field, value) => {
    setSizes(sizes.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleRemoveSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedProduct) {
      toast.error({ title: "Please select a substitute product" });
      return;
    }

    if (sizes.length === 0) {
      toast.error({ title: "Please add at least one size" });
      return;
    }

    if (!reason.trim()) {
      toast.error({ title: "Please provide a reason for the substitution" });
      return;
    }

    // Validate sizes
    for (const size of sizes) {
      if (!size.size.trim()) {
        toast.error({ title: "All sizes must have a value" });
        return;
      }
      if (size.quantity < 1) {
        toast.error({ title: "Quantity must be at least 1" });
        return;
      }
    }

    const substitution = {
      ...selectedProduct,
      sizes: sizes.map((s) => ({
        size: s.size,
        quantity: parseInt(s.quantity, 10),
      })),
    };

    onSubmit({ substitution, reason: reason.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="change-order-title"
      contentClassName="max-w-3xl"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="change-order-title" className="text-lg font-semibold">
            Request Product Substitution
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The originally requested item cannot be fulfilled. Propose a substitute product for
            approval.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Original Item */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Original Request</h3>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {getPullItemDisplayName(originalItem)}
            </div>
            {originalItem.styleNumber && (
              <div className="text-xs text-slate-500 dark:text-slate-400">Style: {originalItem.styleNumber}</div>
            )}
            {originalItem.sizes && originalItem.sizes.length > 0 && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Sizes:{" "}
                {originalItem.sizes
                  .map((s) => `${s.size} (${s.quantity})`)
                  .join(", ")}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Reason for Substitution <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              id="reason"
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 text-sm"
              rows={3}
              placeholder="e.g., Size L out of stock, suggesting size M instead..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Substitute Product */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Substitute Product <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {selectedProduct.familyName}
                    {selectedProduct.colourName && ` – ${selectedProduct.colourName}`}
                  </div>
                  {selectedProduct.styleNumber && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Style: {selectedProduct.styleNumber}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProductModalOpen(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setProductModalOpen(true)}>
                Select Substitute Product
              </Button>
            )}
          </div>

          {/* Substitute Sizes */}
          {selectedProduct && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Substitute Sizes & Quantities <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <Button variant="ghost" size="sm" onClick={handleAddSize}>
                  Add Size
                </Button>
              </div>

              {sizes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No sizes added. Click "Add Size" to specify substitute sizes and quantities.
                </div>
              ) : (
                <div className="space-y-2">
                  {sizes.map((size, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                    >
                      <Input
                        placeholder="Size (e.g., M, L, 32)"
                        value={size.size}
                        onChange={(e) => handleUpdateSize(index, "size", e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={size.quantity}
                          onChange={(e) =>
                            handleUpdateSize(index, "quantity", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSize(index)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Change Request</Button>
          </div>
        </CardContent>
      </Card>

      {/* Product Selection Modal */}
      {productModalOpen && (
        <ShotProductAddModal
          open={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          initialProduct={null}
          canCreateProduct={false}
          onSubmit={handleProductSelect}
        />
      )}
    </Modal>
  );
}
