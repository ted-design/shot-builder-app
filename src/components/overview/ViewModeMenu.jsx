// src/components/overview/ViewModeMenu.jsx
import { Check } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * ViewModeMenu - Dropdown menu for selecting view modes
 *
 * Provides a space-efficient dropdown for switching between different view modes
 * (e.g., Gallery, List, Table). Shows the current mode's icon on the button and
 * displays a checkmark next to the active option in the menu.
 *
 * @param {Object} props
 * @param {Array<{value: string, label: string, icon: Component}>} props.options - Available view mode options
 * @param {string} props.value - Current active view mode value
 * @param {Function} props.onChange - Called when view mode changes
 * @param {string} [props.ariaLabel="Select view"] - Accessibility label for the trigger button
 * @param {string} [props.className] - Additional CSS classes for the trigger button
 *
 * @example
 * const VIEW_OPTIONS = [
 *   { value: "gallery", label: "Gallery", icon: LayoutGrid },
 *   { value: "list", label: "List", icon: List },
 *   { value: "table", label: "Table", icon: Table },
 * ];
 *
 * <ViewModeMenu
 *   options={VIEW_OPTIONS}
 *   value={viewMode}
 *   onChange={setViewMode}
 *   ariaLabel="Select view mode"
 * />
 */
export default function ViewModeMenu({
  options,
  value,
  onChange,
  ariaLabel = "Select view",
  className = "",
}) {
  // Find the current option to display its icon
  const currentOption = options.find((opt) => opt.value === value) || options[0];
  const Icon = currentOption?.icon;

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
          {Icon && <Icon className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => {
          const isActive = option.value === value;
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="flex items-center gap-2"
            >
              {OptionIcon && <OptionIcon className="h-4 w-4" aria-hidden="true" />}
              <span className="flex-1">{option.label}</span>
              {isActive && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
