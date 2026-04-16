import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function CrewEditModal({
  open,
  crewMember,
  busy = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: crewMember?.firstName || "",
      lastName: crewMember?.lastName || "",
      email: crewMember?.email || "",
      phone: crewMember?.phone || "",
      company: crewMember?.company || "",
      notes: crewMember?.notes || "",
    });
    setError("");
    setSaving(false);
  }, [crewMember, open]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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
          firstName: first,
          lastName: last,
          email: (form.email || "").trim() || null,
          phone: (form.phone || "").trim() || null,
          company: (form.company || "").trim() || null,
          notes: (form.notes || "").trim() || null,
        },
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to update crew member.");
    } finally {
      setSaving(false);
    }
  };

  const displayName = `${form.firstName || ""} ${form.lastName || ""}`.trim() || "Edit crew member";

  return (
    <Modal open={open} onClose={onClose}>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update crew member contact details.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-first-name">
                  First name
                </label>
                <Input
                  id="crew-first-name"
                  value={form.firstName}
                  onChange={handleFieldChange("firstName")}
                  placeholder="First name"
                  disabled={saving || busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-last-name">
                  Last name
                </label>
                <Input
                  id="crew-last-name"
                  value={form.lastName}
                  onChange={handleFieldChange("lastName")}
                  placeholder="Last name"
                  disabled={saving || busy}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-email">
                  Email
                </label>
                <Input
                  id="crew-email"
                  type="email"
                  value={form.email}
                  onChange={handleFieldChange("email")}
                  placeholder="Email"
                  disabled={saving || busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-phone">
                  Phone
                </label>
                <Input
                  id="crew-phone"
                  value={form.phone}
                  onChange={handleFieldChange("phone")}
                  placeholder="Phone"
                  disabled={saving || busy}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-company">
                Company
              </label>
              <Input
                id="crew-company"
                value={form.company}
                onChange={handleFieldChange("company")}
                placeholder="Company"
                disabled={saving || busy}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="crew-notes">
                Notes
              </label>
              <textarea
                id="crew-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Notes"
                disabled={saving || busy}
                className="min-h-24 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving || busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || busy}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}

