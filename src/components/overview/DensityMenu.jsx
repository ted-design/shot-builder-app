// src/components/overview/DensityMenu.jsx
import { Check, Grip } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * DensityMenu - Dropdown menu for selecting content density/spacing
 *
 * Provides a space-efficient dropdown for switching between different density
 * levels (e.g., Compact, Comfortable, Spacious). Shows a grip icon on the button
 * and displays a checkmark next to the active option in the menu.
 *
 * @param {Object} props
 * @param {Array<{value: string, label: string, description?: string}>} props.options - Available density options
 * @param {string} props.value - Current active density value
 * @param {Function} props.onChange - Called when density changes
 * @param {string} [props.ariaLabel="Select density"] - Accessibility label for the trigger button
 * @param {string} [props.className] - Additional CSS classes for the trigger button
 *
 * @example
 * const DENSITY_OPTIONS = [
 *   { value: "compact", label: "Compact", description: "Minimal spacing" },
 *   { value: "comfortable", label: "Comfortable", description: "Balanced spacing" },
 *   { value: "spacious", label: "Spacious", description: "Extra spacing" },
 * ];
 *
 * <DensityMenu
 *   options={DENSITY_OPTIONS}
 *   value={density}
 *   onChange={setDensity}
 *   ariaLabel="Select content density"
 * />
 */
export default function DensityMenu({
  options,
  value,
  onChange,
  ariaLabel = "Select density",
  className = "",
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className={className}
        >
          <Grip className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="flex items-center gap-2"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                )}
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
