// src/components/pulls/PullItemEditor.jsx
//
// Modal for editing pull items with product selection, size/quantity matrix,
// gender/category overrides, and notes.

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ShotProductAddModal from "../shots/ShotProductAddModal";
import { generatePullItemId, validatePullItem, getPullItemDisplayName } from "../../lib/pullItems";
import { toast } from "../../lib/toast";

// Gender is locked to the product's family; no overrides.

export default function PullItemEditor({
  item = null,
  families,
  loadFamilyDetails,
  onSave,
  onClose,
  canEdit = true,
}) {
  const isEditMode = item != null;

  // Product selection state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Sizes state
  const [sizes, setSizes] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);

  // Metadata state
  // Gender locked; no override.
  const [notes, setNotes] = useState("");

  // Initialize form with item data
  useEffect(() => {
    const initializeForm = async () => {
      if (item) {
        setSelectedProduct({
          familyId: item.familyId,
          familyName: item.familyName,
          colourId: item.colourId,
          colourName: item.colourName,
          colourImagePath: item.colourImagePath,
          styleNumber: item.styleNumber,
          gender: item.gender,
        });
        setSizes(item.sizes?.map((s) => ({ ...s })) || []);
        // no gender override
        setNotes(item.notes || "");

        // Load available sizes for the product family
        if (item.familyId) {
          try {
            const details = await loadFamilyDetails(item.familyId);
            setAvailableSizes(details.sizes || []);
          } catch (error) {
            console.error("[PullItemEditor] Failed to load sizes", error);
            setAvailableSizes([]);
          }
        }
      } else {
        setSelectedProduct(null);
        setSizes([]);
        setAvailableSizes([]);
        // no gender override
        setNotes("");
      }
    };

    initializeForm();
  }, [item, loadFamilyDetails]);

  const handleProductSelect = async (selection) => {
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

    // Load available sizes from family details
    try {
      const details = await loadFamilyDetails(family.id);
      setAvailableSizes(details.sizes || []);
    } catch (error) {
      console.error("[PullItemEditor] Failed to load sizes", error);
      setAvailableSizes([]);
    }

    // If a size was selected, add it to sizes array (if not "all sizes")
    if (size && size !== "__ALL_SIZES__") {
      const existingIndex = sizes.findIndex((s) => s.size === size);
      if (existingIndex === -1) {
        setSizes([
          ...sizes,
          { size, quantity: 1, fulfilled: 0, status: "pending" },
        ]);
      }
    }

    setProductModalOpen(false);
  };

  const handleAddSize = () => {
    setSizes([
      ...sizes,
      { size: "", quantity: 1, fulfilled: 0, status: "pending" },
    ]);
  };

  const handleUpdateSize = (index, field, value) => {
    setSizes(
      sizes.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    );
  };

  const handleRemoveSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!canEdit) return;

    if (!selectedProduct) {
      toast.error({ title: "Please select a product" });
      return;
    }

    // Build the pull item
    const pullItem = {
      id: item?.id || generatePullItemId(),
      familyId: selectedProduct.familyId,
      familyName: selectedProduct.familyName,
      styleNumber: selectedProduct.styleNumber || null,
      colourId: selectedProduct.colourId || null,
      colourName: selectedProduct.colourName || null,
      colourImagePath: selectedProduct.colourImagePath || null,
      sizes: sizes.map((s) => ({
        size: s.size,
        quantity: parseInt(s.quantity, 10) || 1,
        fulfilled: parseInt(s.fulfilled, 10) || 0,
        status: s.status || "pending",
      })),
      notes: notes.trim(),
      gender: selectedProduct.gender || null,
      genderOverride: null,
      fulfillmentStatus: item?.fulfillmentStatus || "pending",
      shotIds: item?.shotIds || [],
      changeOrders: item?.changeOrders || [],
    };

    // Validate
    const validation = validatePullItem(pullItem);
    if (!validation.valid) {
      toast.error({
        title: "Invalid item",
        description: validation.errors.join(", "),
      });
      return;
    }

    onSave(pullItem);
  };

  const displayGender = selectedProduct?.gender || "Not specified";

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="pull-item-editor-title"
      contentClassName="md:!max-w-5xl !max-w-[95vw]"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="pull-item-editor-title" className="text-lg font-semibold">
            {isEditMode ? "Edit Pull Item" : "Add Pull Item"}
          </h2>
          <p className="text-sm text-slate-600">
            {isEditMode
              ? "Update product, sizes, and quantities for this pull item."
              : "Select a product and specify sizes and quantities."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Product</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {getPullItemDisplayName(selectedProduct)}
                  </div>
                  {selectedProduct.styleNumber && (
                    <div className="text-xs text-slate-500">
                      Style: {selectedProduct.styleNumber}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProductModalOpen(true)}
                  disabled={!canEdit}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setProductModalOpen(true)}
                disabled={!canEdit}
              >
                Select Product
              </Button>
            )}
          </div>

          {/* Size/Quantity Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Sizes & Quantities</label>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={handleAddSize}>
                  Add Size
                </Button>
              )}
            </div>

            {sizes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                No sizes added. Click "Add Size" to specify sizes and quantities.
              </div>
            ) : (
              <div className="space-y-2">
                {sizes.map((size, index) => (
                  <div
                    key={index}
                    className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <select
                      className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      value={size.size}
                      onChange={(e) => handleUpdateSize(index, "size", e.target.value)}
                      disabled={!canEdit}
                    >
                      <option value="">Select size...</option>
                      {availableSizes.map((availableSize) => (
                        <option key={availableSize} value={availableSize}>
                          {availableSize}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={size.quantity}
                      onChange={(e) => handleUpdateSize(index, "quantity", e.target.value)}
                      disabled={!canEdit}
                      className="w-24"
                    />
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSize(index)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gender (read-only from product) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Gender</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm text-slate-900">{displayGender}</div>
              <p className="text-xs text-slate-500 mt-1">Auto-populated from product family</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="item-notes" className="text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              id="item-notes"
              className="w-full rounded-md border border-slate-200 p-3 text-sm"
              rows={3}
              placeholder="Add notes or special instructions for this item..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {canEdit && (
              <Button onClick={handleSave}>
                {isEditMode ? "Save Changes" : "Add Item"}
              </Button>
            )}
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
          initialProduct={
            selectedProduct
              ? {
                  familyId: selectedProduct.familyId,
                  colourId: selectedProduct.colourId,
                }
              : null
          }
          canCreateProduct={false}
          onSubmit={handleProductSelect}
        />
      )}
    </Modal>
  );
}
