import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "../ui/button";

export default function GroupByMenu({ options = [], value, onChange, title = "Group" }) {
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

  const activeOption = options.find((opt) => opt.value === value);
  const hasGrouping = value !== "none";

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant={hasGrouping ? "secondary" : open ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        className={hasGrouping ? "text-primary" : ""}
      >
        <Layers className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-56 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <div className="mt-2 space-y-1">
            {options.map((option) => {
              const isActive = option.value === value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition ${
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="flex-1 text-left">{option.label}</span>
                  {isActive ? <span className="text-[10px] uppercase">Active</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
