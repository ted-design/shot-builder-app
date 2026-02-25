import { Layers } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * GroupByMenu - Dropdown menu for selecting grouping options
 *
 * Uses Radix UI DropdownMenu for automatic menu coordination
 * (closes when another dropdown opens).
 */
export default function GroupByMenu({
  options = [],
  value,
  onChange,
  title = "Group",
  variant = "outline",
}) {
  const hasGrouping = value !== "none";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={hasGrouping ? "secondary" : variant}
          size="icon"
          aria-label={title}
          className={hasGrouping ? "text-primary" : ""}
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
        {options.map((option) => {
          const isActive = option.value === value;
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange?.(option.value)}
              className={`flex items-center gap-2 ${
                isActive ? "bg-primary/10 font-medium text-primary" : ""
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="flex-1">{option.label}</span>
              {isActive && (
                <span className="text-2xs uppercase">Active</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
