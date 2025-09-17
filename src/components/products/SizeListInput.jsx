import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function SizeListInput({
  value = [],
  onChange,
  label,
  helperText,
  inputPlaceholder = "Add size",
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const next = (draft || "").trim();
    if (!next) return;
    const exists = value.some((entry) => entry.toLowerCase() === next.toLowerCase());
    if (exists) {
      setDraft("");
      return;
    }
    onChange?.([...value, next]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      <div className="flex flex-wrap gap-2">
        {value.map((size) => (
          <span
            key={size}
            className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs"
          >
            {size}
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              aria-label={`Remove size ${size}`}
              onClick={() => onChange?.(value.filter((entry) => entry !== size))}
            >
              ×
            </button>
          </span>
        ))}
        {!value.length && <span className="text-xs text-slate-500">No sizes defined</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder={inputPlaceholder}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={commitDraft}
          disabled={!(draft || "").trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
