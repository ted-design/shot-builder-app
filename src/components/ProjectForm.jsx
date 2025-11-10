import React, { useEffect, useMemo, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { LoadingSpinner } from "./ui/LoadingSpinner";

const emptyForm = {
  name: "",
  briefUrl: "",
  notes: "",
  shootDates: [""],
};

function normaliseInitial(initial) {
  if (!initial) return emptyForm;
  const dates = Array.isArray(initial.shootDates) && initial.shootDates.length
    ? initial.shootDates.map((d) => String(d))
    : [""];
  return {
    name: initial.name || "",
    briefUrl: initial.briefUrl || "",
    notes: initial.notes || "",
    shootDates: dates,
  };
}

export default function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Save Project",
  busy = false,
}) {
  const [form, setForm] = useState(() => normaliseInitial(initialValues));
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(normaliseInitial(initialValues));
  }, [initialValues]);

  const canRemoveDate = useMemo(() => form.shootDates.length > 1, [form.shootDates.length]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDate = (index, value) => {
    setForm((prev) => {
      const next = [...prev.shootDates];
      next[index] = value;
      return { ...prev, shootDates: next };
    });
  };

  const addDate = () => {
    setForm((prev) => ({ ...prev, shootDates: [...prev.shootDates, ""] }));
  };

  const removeDate = (index) => {
    setForm((prev) => {
      const next = [...prev.shootDates];
      next.splice(index, 1);
      return { ...prev, shootDates: next.length ? next : [""] };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Project name is required");
      return;
    }
    setError("");
    const payload = {
      name: trimmedName,
      briefUrl: form.briefUrl.trim(),
      notes: form.notes.trim(),
      shootDates: form.shootDates.map((d) => d.trim()).filter(Boolean),
    };
    onSubmit?.(payload);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="project-name">
          Name
        </label>
        <Input
          id="project-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Campaign title"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="project-brief">
          Brief URL
        </label>
        <Input
          id="project-brief"
          value={form.briefUrl}
          onChange={(event) => updateField("briefUrl", event.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700">Shoot Dates</label>
        <div className="space-y-2">
          {form.shootDates.map((dateValue, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="date"
                value={dateValue}
                onChange={(event) => updateDate(index, event.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm flex-1"
              />
              {canRemoveDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDate(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addDate}>
          Add date
        </Button>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="project-notes">
          Notes
        </label>
        <textarea
          id="project-notes"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[120px]"
          placeholder="Key objectives, deliverables, or reminders"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <LoadingSpinner size="sm" className="mr-2" />}
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
