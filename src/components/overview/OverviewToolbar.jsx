import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Card, CardContent } from "../ui/card";

export default function OverviewToolbar({
  anchorId = "shots-toolbar-anchor",
  children,
  filterPills = [],
  onRemoveFilter,
}) {
  const content = (
    <Card className="border-b-2">
      <CardContent className="py-4">
        <div className="flex flex-col gap-4">
          {children}
          {filterPills.length > 0 && (
            <div className="flex w-full flex-wrap gap-2">
              {filterPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => onRemoveFilter?.(pill.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                >
                  <span>
                    {pill.label}
                    {pill.value ? `: ${pill.value}` : ""}
                  </span>
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (typeof document === "undefined") {
    return content;
  }

  const anchor = document.getElementById(anchorId);
  return anchor ? createPortal(content, anchor) : content;
}
