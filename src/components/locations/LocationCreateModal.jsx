import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import Thumb from "../Thumb";
import { useFilePreview } from "../../hooks/useFilePreview";
import { SelectPortalTargetProvider } from "../../context/SelectPortalTargetContext";

const emptyForm = {
  name: "",
  street: "",
  unit: "",
  city: "",
  province: "",
  postal: "",
  phone: "",
  notes: "",
};

export default function LocationCreateModal({
  open,
  busy = false,
  onClose,
  onCreate,
  selectPortalTarget,
}) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const firstFieldRef = useRef(null);

  const preview = useFilePreview(file);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setFile(null);
    setError("");
  }, [open]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onCreate) return;
    try {
      setError("");
      await onCreate({ ...form, photoFile: file });
      onClose?.();
    } catch (err) {
      const message = err?.message || "Unable to create location. Please try again.";
      setError(message);
    }
  };

  const modalTitleId = "location-create-title";

  return (
    <SelectPortalTargetProvider target={selectPortalTarget}>
      <Modal
        open={open}
        onClose={busy ? undefined : onClose}
        labelledBy={modalTitleId}
        initialFocusRef={firstFieldRef}
        contentClassName="p-0 max-h-[90vh] overflow-y-auto"
      >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id={modalTitleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Create location
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Provide a venue name and any helpful contact or access notes. Photos can be added now or later.
          </p>
        </CardHeader>
        <CardContent className="pb-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-name">
                Name
              </label>
              <Input
                id="location-create-name"
                ref={firstFieldRef}
                value={form.name}
                onChange={updateField("name")}
                placeholder="Studio or venue name"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-street">
                Street address
              </label>
              <Input
                id="location-create-street"
                value={form.street}
                onChange={updateField("street")}
                placeholder="123 Example Ave"
                disabled={busy}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-unit">
                  Unit / Suite
                </label>
                <Input
                  id="location-create-unit"
                  value={form.unit}
                  onChange={updateField("unit")}
                  placeholder="Unit (optional)"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-city">
                  City
                </label>
                <Input
                  id="location-create-city"
                  value={form.city}
                  onChange={updateField("city")}
                  placeholder="City"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-province">
                  Province / State
                </label>
                <Input
                  id="location-create-province"
                  value={form.province}
                  onChange={updateField("province")}
                  placeholder="Province / State"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-postal">
                  Postal / ZIP
                </label>
                <Input
                  id="location-create-postal"
                  value={form.postal}
                  onChange={updateField("postal")}
                  placeholder="Postal / ZIP"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-phone">
                Phone
              </label>
              <Input
                id="location-create-phone"
                value={form.phone}
                onChange={updateField("phone")}
                placeholder="Phone (optional)"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-notes">
                Notes
              </label>
              <textarea
                id="location-create-notes"
                value={form.notes}
                onChange={updateField("notes")}
                rows={4}
                disabled={busy}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Access instructions, load-in timing, parking details…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="location-create-photo">
                Photo
              </label>
              <Thumb
                path={preview || null}
                size={640}
                alt="Selected location preview"
                className="h-40 w-56 overflow-hidden rounded-card bg-slate-100 dark:bg-slate-800"
                imageClassName="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    Optional reference photo
                  </div>
                }
              />
              <Input
                id="location-create-photo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={busy}
              />
            </div>
            {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create location"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
    </SelectPortalTargetProvider>
  );
}
