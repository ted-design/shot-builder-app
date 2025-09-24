import { useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import NotesEditor from "./NotesEditor";
import ShotProductsEditor from "./ShotProductsEditor";
import TalentMultiSelect from "./TalentMultiSelect";

export default function ShotEditModal({
  open,
  titleId = "shot-edit-modal-title",
  shotName,
  description = "Update shot details, linked products, and talent assignments.",
  draft,
  onChange,
  onClose,
  onSubmit,
  isSaving = false,
  submitLabel = "Save changes",
  savingLabel = "Saving…",
  onDelete,
  families = [],
  loadFamilyDetails,
  createProduct,
  allowProductCreation = false,
  onCreateProduct,
  onCreateColourway,
  locations = [],
  talentOptions = [],
  talentPlaceholder = "Select talent",
  talentNoOptionsMessage = "No talent available",
  talentLoadError = null,
}) {
  // Hooks must be called unconditionally at the top level
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!open || !draft) {
    return null;
  }

  const handleFieldChange = (patch) => {
    if (!onChange) return;
    onChange(patch);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  const talentMessage = typeof talentNoOptionsMessage === "function"
    ? talentNoOptionsMessage
    : () => talentNoOptionsMessage;

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} contentClassName="p-0 max-h-[90vh] overflow-y-auto">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Edit {shotName}
              </h2>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete((v) => !v);
                    setDeleteText("");
                  }}
                  disabled={isSaving || deleting}
                >
                  Delete
                </Button>
              )}
            <button
              type="button"
              aria-label="Close"
              className="text-xl text-slate-400 transition hover:text-slate-600"
              onClick={onClose}
            >
              ×
            </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {confirmingDelete && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm text-red-700">
                This will permanently remove this shot and cannot be undone. To confirm, type "DELETE"
                below and press Permanently delete.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isSaving || deleting}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  disabled={isSaving || deleting}
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
                      await onDelete();
                      onClose?.();
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleteText.trim() !== "DELETE" || isSaving || deleting}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input
                  value={draft.name}
                  onChange={(event) => handleFieldChange({ name: event.target.value })}
                  required
                  disabled={isSaving || deleting}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Input
                  value={draft.type}
                  onChange={(event) => handleFieldChange({ type: event.target.value })}
                  disabled={isSaving || deleting}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={draft.date || ""}
                  onChange={(event) => handleFieldChange({ date: event.target.value })}
                  disabled={isSaving || deleting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Notes</label>
              <NotesEditor
                value={draft.description}
                onChange={(next) => handleFieldChange({ description: next })}
                disabled={isSaving || deleting}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Location</label>
              <select
                className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                value={draft.locationId}
                disabled={isSaving || deleting}
                onChange={(event) => handleFieldChange({ locationId: event.target.value || "" })}
              >
                <option value="">(none)</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Products</label>
              <ShotProductsEditor
                value={draft.products}
                onChange={(next) => handleFieldChange({ products: next })}
                families={families}
                loadFamilyDetails={loadFamilyDetails}
                createProduct={createProduct}
                canCreateProduct={allowProductCreation}
                onCreateProduct={allowProductCreation ? onCreateProduct : undefined}
                onCreateColourway={allowProductCreation ? onCreateColourway : undefined}
                emptyHint="No products linked"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Talent</label>
              <TalentMultiSelect
                options={talentOptions}
                value={draft.talent}
                onChange={(next) => handleFieldChange({ talent: next })}
                isDisabled={isSaving || deleting}
                placeholder={talentLoadError ? "Talent unavailable" : talentPlaceholder}
                noOptionsMessage={talentMessage}
              />
              {talentLoadError && (
                <p className="text-xs text-red-600">{talentLoadError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving || deleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || deleting}>
                {isSaving ? savingLabel : deleting ? "Deleting…" : submitLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
