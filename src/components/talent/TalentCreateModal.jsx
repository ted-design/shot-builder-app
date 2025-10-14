import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import Thumb from "../Thumb";
import { useFilePreview } from "../../hooks/useFilePreview";

const emptyForm = {
  firstName: "",
  lastName: "",
  agency: "",
  phone: "",
  email: "",
  sizing: "",
  url: "",
  gender: "",
};

export default function TalentCreateModal({ open, busy = false, onClose, onCreate }) {
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
      await onCreate({ ...form, headshotFile: file });
      onClose?.();
    } catch (err) {
      const message = err?.message || "Unable to create talent. Please try again.";
      setError(message);
    }
  };

  const modalTitleId = "talent-create-title";

  return (
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
            Create talent
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Provide at least a first or last name. Headshots can be added now or later.
          </p>
        </CardHeader>
        <CardContent className="pb-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-first">
                  First name
                </label>
                <Input
                  id="talent-create-first"
                  ref={firstFieldRef}
                  value={form.firstName}
                  onChange={updateField("firstName")}
                  placeholder="First name"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-last">
                  Last name
                </label>
                <Input
                  id="talent-create-last"
                  value={form.lastName}
                  onChange={updateField("lastName")}
                  placeholder="Last name"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-agency">
                  Agency
                </label>
                <Input
                  id="talent-create-agency"
                  value={form.agency}
                  onChange={updateField("agency")}
                  placeholder="Agency (optional)"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-gender">
                  Gender
                </label>
                <Input
                  id="talent-create-gender"
                  value={form.gender}
                  onChange={updateField("gender")}
                  placeholder="Gender (optional)"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-phone">
                  Phone
                </label>
                <Input
                  id="talent-create-phone"
                  value={form.phone}
                  onChange={updateField("phone")}
                  placeholder="Phone (optional)"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-email">
                  Email
                </label>
                <Input
                  id="talent-create-email"
                  type="email"
                  value={form.email}
                  onChange={updateField("email")}
                  placeholder="Email (optional)"
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-sizing">
                Sizing notes
              </label>
              <Input
                id="talent-create-sizing"
                value={form.sizing}
                onChange={updateField("sizing")}
                placeholder="Sizing info (optional)"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-url">
                Reference URL
              </label>
              <Input
                id="talent-create-url"
                type="url"
                value={form.url}
                onChange={updateField("url")}
                placeholder="URL (optional)"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="talent-create-headshot">
                Headshot
              </label>
              <Thumb
                path={preview || null}
                size={512}
                alt="Selected headshot preview"
                className="h-40 w-32 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                imageClassName="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    Optional 4:5 image
                  </div>
                }
              />
              <Input
                id="talent-create-headshot"
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
                {busy && <LoadingSpinner size="sm" className="mr-2" />}
                {busy ? "Creating…" : "Create talent"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
