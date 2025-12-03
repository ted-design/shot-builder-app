import React, { useState, useRef, useEffect } from "react";
import { Search, X, Download, Maximize, Minimize } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * Simplified toolbar for the Planner view.
 * Only includes: Search, Density toggle, Export button
 */
function PlannerToolbar({
  searchQuery = "",
  onSearchChange,
  density = "comfortable",
  onDensityChange,
  onExport,
  isExporting = false,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Focus search input when opening
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isSearchOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target) &&
        !searchQuery
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen, searchQuery]);

  const handleSearchClear = () => {
    onSearchChange?.("");
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      if (searchQuery) {
        onSearchChange?.("");
      } else {
        setIsSearchOpen(false);
      }
    }
  };

  const isCompact = density === "compact";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
      {/* Left: Search */}
      <div
        ref={searchContainerRef}
        className={`flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 transition dark:border-slate-700/80 dark:bg-slate-900 ${
          isSearchOpen ? "ring-2 ring-primary/40 dark:ring-primary/50" : ""
        }`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsSearchOpen(true)}
          aria-label="Search shots"
          className="h-7 w-7 shrink-0 rounded-full"
        >
          <Search className="h-4 w-4" />
        </Button>
        <div
          className={`flex items-center transition-all duration-200 ${
            isSearchOpen ? "w-40 sm:w-52 opacity-100" : "w-0 opacity-0 pointer-events-none"
          }`}
        >
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search shots..."
            aria-label="Search shots"
            className="h-7 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={handleSearchClear}
              className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Density Toggle */}
        <Button
          type="button"
          variant={isCompact ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onDensityChange?.(isCompact ? "comfortable" : "compact")}
          aria-pressed={isCompact}
          className="flex items-center gap-1.5"
        >
          {isCompact ? (
            <Maximize className="h-4 w-4" />
          ) : (
            <Minimize className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{isCompact ? "Comfy" : "Compact"}</span>
        </Button>

        {/* Export Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-1.5"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
        </Button>
      </div>
    </div>
  );
}

export default PlannerToolbar;
