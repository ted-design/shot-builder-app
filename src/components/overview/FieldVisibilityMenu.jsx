import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "../ui/button";

export default function FieldVisibilityMenu({ options = [], onToggle }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Toggle visible shot properties"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible properties</p>
          <div className="mt-2 space-y-2">
            {options.map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={Boolean(option.checked)}
                  onChange={() => onToggle?.(option.key)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
