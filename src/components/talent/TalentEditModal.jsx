import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useFilePreview } from "../../hooks/useFilePreview";
import Thumb from "../Thumb";
import SingleImageDropzone from "../common/SingleImageDropzone";

function buildDisplayName(firstName, lastName) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  return `${first} ${last}`.trim();
}

export default function TalentEditModal({
  open,
  talent,
  busy = false,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    agency: "",
    phone: "",
    email: "",
    sizing: "",
    url: "",
    gender: "",
  });
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const previewUrl = useFilePreview(file);
  const displayName = buildDisplayName(form.firstName, form.lastName) || talent?.name || "Edit talent";

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: talent?.firstName || "",
      lastName: talent?.lastName || "",
      agency: talent?.agency || "",
      phone: talent?.phone || "",
      email: talent?.email || "",
      sizing: talent?.sizing || "",
      url: talent?.url || "",
      gender: talent?.gender || "",
    });
    setFile(null);
    setRemoveImage(false);
    setError("");
    setSaving(false);
  }, [open, talent]);

  const currentImage = useMemo(() => {
    if (previewUrl) return previewUrl;
    if (removeImage) return null;
    return talent?.headshotPath || null;
  }, [previewUrl, removeImage, talent?.headshotPath]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleFileChange = (nextFile) => {
    setFile(nextFile);
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setFile(null);
    setRemoveImage(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const first = (form.firstName || "").trim();
    const last = (form.lastName || "").trim();
    if (!first && !last) {
      setError("Enter at least a first or last name before saving.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave?.({
        updates: {
          ...form,
          firstName: first,
          lastName: last,
          name: buildDisplayName(first, last),
        },
        newImageFile: file,
        removeImage: removeImage && !file,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to update talent. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const titleId = "talent-edit-title";

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} contentClassName="p-0 max-h-[90vh] overflow-y-auto">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </h2>
              {talent?.agency && <p className="text-sm text-slate-500 dark:text-slate-400">{talent.agency}</p>}
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
                className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
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
                This will permanently remove this talent and cannot be undone. To confirm, type
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
                      await onDelete(talent, { skipPrompt: true });
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
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <SingleImageDropzone
                  value={file}
                  onChange={handleFileChange}
                  disabled={saving || busy || deleting}
                  existingImageUrl={!removeImage && talent?.headshotPath ? talent.headshotPath : null}
                  onRemoveExisting={handleRemoveImage}
                  showPreview={false}
                  className="w-full"
                />
                {currentImage && (
                  <Thumb
                    path={currentImage}
                    size={512}
                    alt={displayName}
                    className="h-40 w-32 overflow-hidden rounded-card bg-slate-100 dark:bg-slate-800"
                    imageClassName="h-full w-full object-cover"
                    fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No image</div>}
                  />
                )}
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-first-name">
                      First name
                    </label>
                    <Input
                      id="talent-first-name"
                      value={form.firstName}
                      onChange={handleFieldChange("firstName")}
                      placeholder="First name"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-last-name">
                      Last name
                    </label>
                    <Input
                      id="talent-last-name"
                      value={form.lastName}
                      onChange={handleFieldChange("lastName")}
                      placeholder="Last name"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-agency">
                      Agency
                    </label>
                    <Input
                      id="talent-agency"
                      value={form.agency}
                      onChange={handleFieldChange("agency")}
                      placeholder="Agency"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-gender">
                      Gender
                    </label>
                    <Input
                      id="talent-gender"
                      value={form.gender}
                      onChange={handleFieldChange("gender")}
                      placeholder="Gender"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-phone">
                      Phone
                    </label>
                    <Input
                      id="talent-phone"
                      value={form.phone}
                      onChange={handleFieldChange("phone")}
                      placeholder="Phone"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-email">
                      Email
                    </label>
                    <Input
                      id="talent-email"
                      type="email"
                      value={form.email}
                      onChange={handleFieldChange("email")}
                      placeholder="Email"
                      disabled={saving || busy || deleting}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-sizing">
                    Sizing notes
                  </label>
                  <Input
                    id="talent-sizing"
                    value={form.sizing}
                    onChange={handleFieldChange("sizing")}
                    placeholder="Sizing details"
                    disabled={saving || busy || deleting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-url">
                    Reference URL
                  </label>
                  <Input
                    id="talent-url"
                    type="url"
                    value={form.url}
                    onChange={handleFieldChange("url")}
                    placeholder="https://"
                    disabled={saving || busy || deleting}
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
  );
}
