import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../ui/button";
import ShotProductCard from "./ShotProductCard";
import ShotProductAddModal from "./ShotProductAddModal";

export default function ShotProductsEditor({
  value,
  onChange,
  families,
  loadFamilyDetails,
  createProduct,
  canCreateProduct = false,
  onCreateProduct,
  onCreateColourway,
  emptyHint,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // Cache for family details (colours, sizes)
  const [familyDetailsCache, setFamilyDetailsCache] = useState({});
  const [loadingFamilies, setLoadingFamilies] = useState(new Set());
  const mountedRef = useRef(true);

  // Load family details for all products on mount and when products change
  useEffect(() => {
    mountedRef.current = true;

    const loadDetailsForProducts = async () => {
      // Get unique family IDs that aren't already cached or loading
      const familyIds = [
        ...new Set(value.map((p) => p.productId || p.familyId).filter(Boolean)),
      ];
      const idsToLoad = familyIds.filter(
        (id) => !familyDetailsCache[id] && !loadingFamilies.has(id)
      );

      if (idsToLoad.length === 0) return;

      // Mark as loading
      setLoadingFamilies((prev) => {
        const next = new Set(prev);
        idsToLoad.forEach((id) => next.add(id));
        return next;
      });

      // Load in parallel
      const results = await Promise.all(
        idsToLoad.map(async (familyId) => {
          try {
            const details = await loadFamilyDetails(familyId);
            return { familyId, details };
          } catch (error) {
            console.error(`Failed to load details for family ${familyId}:`, error);
            return { familyId, details: null };
          }
        })
      );

      if (!mountedRef.current) return;

      // Update cache with results
      setFamilyDetailsCache((prev) => {
        const next = { ...prev };
        results.forEach(({ familyId, details }) => {
          if (details) {
            next[familyId] = details;
          }
        });
        return next;
      });

      // Clear loading state
      setLoadingFamilies((prev) => {
        const next = new Set(prev);
        idsToLoad.forEach((id) => next.delete(id));
        return next;
      });
    };

    loadDetailsForProducts();

    return () => {
      mountedRef.current = false;
    };
  }, [value, loadFamilyDetails, familyDetailsCache, loadingFamilies]);

  const handleAdd = () => {
    setEditingIndex(null);
    setModalOpen(true);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setModalOpen(true);
  };

  const handleRemove = (index) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  // Handle inline changes from product cards (color/size changes)
  const handleInlineChange = useCallback(
    (index, updatedProduct) => {
      const nextList = value.map((item, idx) =>
        idx === index ? updatedProduct : item
      );
      onChange(nextList);
    },
    [value, onChange]
  );

  const handleSubmit = (selection) => {
    const previous = editingIndex != null ? value[editingIndex] : null;
    const nextProduct = createProduct(selection, previous);
    const nextList =
      editingIndex != null
        ? value.map((item, idx) => (idx === editingIndex ? nextProduct : item))
        : [...value, nextProduct];
    onChange(nextList);
  };

  return (
    <div className="space-y-4">
      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {value.map((product, index) => {
          const familyId = product.productId || product.familyId;
          const details = familyDetailsCache[familyId] || null;
          const isLoading = loadingFamilies.has(familyId);

          return (
            <ShotProductCard
              key={product.id || `${familyId}-${product.colourId || index}`}
              product={product}
              familyDetails={details}
              isLoading={isLoading}
              onChange={(updated) => handleInlineChange(index, updated)}
              onEdit={() => handleEdit(index)}
              onRemove={() => handleRemove(index)}
            />
          );
        })}
      </div>

      {/* Empty State */}
      {!value.length && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyHint || "No products added yet. Click below to add products to this shot."}
        </div>
      )}

      {/* Add Product Button */}
      <Button variant="secondary" type="button" onClick={handleAdd}>
        Add product
      </Button>

      {/* Product Add/Edit Modal */}
      {modalOpen && (
        <ShotProductAddModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingIndex(null);
          }}
          families={families}
          loadFamilyDetails={loadFamilyDetails}
          initialProduct={editingIndex != null ? value[editingIndex] : null}
          canCreateProduct={canCreateProduct}
          onCreateProduct={onCreateProduct}
          onCreateColourway={onCreateColourway}
          onSubmit={(selection) => {
            handleSubmit(selection);
            setModalOpen(false);
            setEditingIndex(null);
          }}
        />
      )}
    </div>
  );
}
