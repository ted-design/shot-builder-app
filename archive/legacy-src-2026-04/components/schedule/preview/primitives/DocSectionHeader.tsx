import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface DocSectionHeaderProps {
  title: string;
  caps?: boolean;
  variant?: "rule" | "boxed" | "label" | "band" | "inlineLabel";
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function DocSectionHeader({
  title,
  caps = false,
  variant = "rule",
  collapsible = false,
  expanded = true,
  onToggle,
  className,
}: DocSectionHeaderProps) {
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span>{title}</span>
      {collapsible && (
        <ChevronDown
          className={cn(
            "h-3 w-3 text-gray-500 transition-transform",
            expanded ? "" : "-rotate-90"
          )}
        />
      )}
    </span>
  );

  const classes = cn(
    "doc-section-header w-full text-left",
    caps && "doc-section-header--caps",
    variant === "boxed" && "doc-section-header--boxed",
    variant === "label" && "doc-section-header--label",
    variant === "band" && "doc-section-header--band",
    variant === "inlineLabel" && "doc-section-header--inline-label",
    collapsible && "cursor-pointer select-none",
    className
  );

  if (collapsible) {
    return (
      <button type="button" className={classes} onClick={() => onToggle?.()}>
        {inner}
      </button>
    );
  }

  return <div className={classes}>{inner}</div>;
}
