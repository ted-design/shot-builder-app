// src/components/overview/ExpandableSearch.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * ExpandableSearch - Icon-triggered expandable search input component
 *
 * Provides a space-efficient search UI that starts as an icon button and
 * expands to show an input field when clicked. Automatically focuses the
 * input on expand and collapses on ESC key or when cleared.
 *
 * @param {Object} props
 * @param {string} props.value - Current search query value
 * @param {Function} props.onChange - Called when search value changes
 * @param {string} [props.placeholder="Type to search..."] - Input placeholder text
 * @param {string} [props.ariaLabel="Search"] - Accessibility label for the button
 * @param {string} [props.className] - Additional CSS classes for the container
 *
 * @example
 * <ExpandableSearch
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search shots..."
 *   ariaLabel="Search shots"
 * />
 */
export default function ExpandableSearch({
  value = "",
  onChange,
  placeholder = "Type to search...",
  ariaLabel = "Search",
  className = "",
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus input when expanded
  useEffect(() => {
    if (!isExpanded) return undefined;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isExpanded]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onChange("");
        setIsExpanded(false);
        // Return focus to the search button
        event.target.blur();
      }
    },
    [onChange]
  );

  const handleChange = useCallback(
    (event) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const handleClose = useCallback(() => {
    onChange("");
    setIsExpanded(false);
  }, [onChange]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button
        type="button"
        variant={isExpanded ? "secondary" : "ghost"}
        size="icon"
        onClick={handleExpand}
        aria-label={ariaLabel}
        aria-expanded={isExpanded}
      >
        <Search className="h-4 w-4" />
      </Button>
      <div
        className={`relative flex items-center overflow-hidden transition-all duration-200 ${
          isExpanded ? "w-48 opacity-100 sm:w-56" : "pointer-events-none w-0 opacity-0"
        }`}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-9 pr-8"
        />
        {isExpanded && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
