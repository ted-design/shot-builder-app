import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useFilePreview } from "../../hooks/useFilePreview";
import { SelectPortalTargetProvider } from "../../context/SelectPortalTargetContext";
import Thumb from "../Thumb";

export default function LocationEditModal({
  open,
  location,
  busy = false,
  onClose,
  onSave,
  onDelete,
  selectPortalTarget,
}) {
  const [form, setForm] = useState({
    name: "",
    street: "",
    unit: "",
    city: "",
    province: "",
    postal: "",
    phone: "",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const previewUrl = useFilePreview(file);
  const displayName = (form.name || location?.name || "Edit location").trim();

  useEffect(() => {
    if (!open) return;
    setForm({
      name: location?.name || "",
      street: location?.street || "",
      unit: location?.unit || "",
      city: location?.city || "",
      province: location?.province || "",
      postal: location?.postal || "",
      phone: location?.phone || "",
      notes: location?.notes || "",
    });
    setFile(null);
    setRemoveImage(false);
    setError("");
    setSaving(false);
  }, [open, location]);

  const currentImagePath = useMemo(() => {
    if (previewUrl) return previewUrl;
    if (removeImage) return null;
    return location?.photoPath || null;
  }, [previewUrl, removeImage, location?.photoPath]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setRemoveImage(false);
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleRemoveImage = () => {
    setFile(null);
    setRemoveImage(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = (form.name || "").trim();
    if (!name) {
      setError("Location name is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave?.({
        updates: {
          ...form,
          name,
        },
        newImageFile: file,
        removeImage: removeImage && !file,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to update the location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const titleId = "location-edit-title";

  return (
    <SelectPortalTargetProvider target={selectPortalTarget}>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy={titleId}
        contentClassName="p-0 max-h-[90vh] overflow-y-auto"
      >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {displayName || "Edit location"}
              </h2>
              {location?.street && (
                <p className="text-sm text-slate-500">
                  {[location.street, location.city, location.province].filter(Boolean).join(", ")}
                </p>
              )}
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
                  disabled={saving || busy || deleting}
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
                This will permanently remove this location and cannot be undone. To confirm, type
                "DELETE" below and press Permanently delete.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={saving || busy || deleting}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  disabled={saving || deleting}
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
                      await onDelete(location, { skipPrompt: true });
                      onClose?.();
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleteText.trim() !== "DELETE" || saving || busy || deleting}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <Thumb
                  path={currentImagePath}
                  size={640}
                  alt={displayName}
                  className="h-40 w-56 overflow-hidden rounded-lg bg-slate-100 text-slate-500"
                  imageClassName="h-full w-full object-cover"
                  fallback={<div className="flex h-full items-center justify-center text-sm">No photo</div>}
                />
                <div className="flex flex-col items-center gap-2 text-sm">
                  <Input type="file" accept="image/*" onChange={handleFileChange} />
                  {(location?.photoPath || file) && (
                    <Button type="button" variant="secondary" size="sm" onClick={handleRemoveImage}>
                      Remove photo
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-name">
                    Name
                  </label>
                  <Input
                    id="location-name"
                    value={form.name}
                    onChange={handleFieldChange("name")}
                    placeholder="Location name"
                    disabled={saving || busy || deleting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-street">
                    Street address
                  </label>
                  <Input
                    id="location-street"
                    value={form.street}
                    onChange={handleFieldChange("street")}
                    placeholder="Street address"
                    disabled={saving || busy || deleting}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700" htmlFor="location-unit">
                      Unit / Suite
                    </label>
                    <Input
                      id="location-unit"
                      value={form.unit}
                      onChange={handleFieldChange("unit")}
                      placeholder="Unit (optional)"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700" htmlFor="location-city">
                      City
                    </label>
                    <Input
                      id="location-city"
                      value={form.city}
                      onChange={handleFieldChange("city")}
                      placeholder="City"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700" htmlFor="location-province">
                      Province / State
                    </label>
                    <Input
                      id="location-province"
                      value={form.province}
                      onChange={handleFieldChange("province")}
                      placeholder="Province / State"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700" htmlFor="location-postal">
                      Postal / ZIP
                    </label>
                    <Input
                      id="location-postal"
                      value={form.postal}
                      onChange={handleFieldChange("postal")}
                      placeholder="Postal / ZIP"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-phone">
                    Phone
                  </label>
                  <Input
                    id="location-phone"
                    value={form.phone}
                    onChange={handleFieldChange("phone")}
                    placeholder="Phone (optional)"
                    disabled={saving || busy || deleting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-notes">
                    Notes
                  </label>
                  <textarea
                    id="location-notes"
                    value={form.notes}
                    onChange={handleFieldChange("notes")}
                    rows={4}
                    disabled={saving || busy || deleting}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Access instructions, loading details, parking notes…"
                  />
                </div>
              </div>
            </div>
            {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || busy || deleting}>
                {saving ? "Saving…" : deleting ? "Deleting…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
    </SelectPortalTargetProvider>
  );
}
