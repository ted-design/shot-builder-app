import { useState } from "react";
import { Button } from "../ui/button";
import ShotProductTile from "./ShotProductTile";
import ShotProductAddModal from "./ShotProductAddModal";

export default function ShotProductsEditor({
  value,
  onChange,
  families,
  loadFamilyDetails,
  createProduct,
  canCreateProduct = false,
  onCreateProduct,
  emptyHint,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((product, index) => (
          <ShotProductTile
            key={product.id || `${product.familyId}-${product.colourId || index}`}
            product={product}
            onEdit={() => handleEdit(index)}
            onRemove={() => handleRemove(index)}
          />
        ))}
        {!value.length && (
          <div className="rounded border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            {emptyHint || "No products added yet."}
          </div>
        )}
      </div>
      <Button variant="secondary" type="button" onClick={handleAdd}>
        Add product
      </Button>
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
