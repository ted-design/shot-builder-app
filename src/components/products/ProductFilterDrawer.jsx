/**
 * ProductFilterDrawer - Slide-out filter panel for Products page
 *
 * A clean, modern drawer-based filter UI that replaces the inline CategoryFilterNav.
 * Opens from the right side with full-height on mobile.
 */
import { memo, useMemo, useCallback } from "react";
import { SlidersHorizontal, X, Check } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import {
  PRODUCT_CATEGORIES,
  getTypesForGender,
  getSubcategoriesForType,
  getAllTypes,
  getSubcategoriesForTypeUnion,
} from "../../lib/productCategories";

// ============================================================================
// FilterSection - Reusable section with title and radio-like options
// ============================================================================

function FilterSection({ title, options, value, onChange, className = "" }) {
  if (!options || options.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <div className="space-y-1">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`
                flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1
                ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium dark:bg-primary/20"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
                }
              `}
              aria-pressed={isSelected}
            >
              <span className="flex items-center gap-2">
                {option.icon && <span className="text-slate-400">{option.icon}</span>}
                {option.label}
              </span>
              {isSelected && (
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function ProductFilterDrawer({
  gender = "all",
  type = "all",
  subcategory = "all",
  onGenderChange,
  onTypeChange,
  onSubcategoryChange,
  onClearAll,
  className = "",
}) {
  // Gender options
  const genderOptions = useMemo(
    () => [
      { value: "all", label: "All Genders" },
      { value: "men", label: "Men's" },
      { value: "women", label: "Women's" },
      { value: "unisex", label: "Unisex" },
    ],
    []
  );

  // Get available types based on gender selection
  const typeOptions = useMemo(() => {
    const types = gender === "all" ? getAllTypes() : getTypesForGender(gender);
    return [{ value: "all", label: "All Categories" }, ...types];
  }, [gender]);

  // Get available subcategories based on gender and type
  const subcategoryOptions = useMemo(() => {
    if (type === "all") return [];

    const subcats =
      gender === "all"
        ? getSubcategoriesForTypeUnion(type)
        : getSubcategoriesForType(gender, type).map((sub) => ({
            ...sub,
            genders: [gender],
          }));

    if (subcats.length === 0) return [];
    return [{ value: "all", label: "All Types" }, ...subcats];
  }, [gender, type]);

  // Handle gender change - reset downstream filters
  const handleGenderChange = useCallback(
    (newGender) => {
      onGenderChange(newGender);
      onTypeChange("all");
      onSubcategoryChange("all");
    },
    [onGenderChange, onTypeChange, onSubcategoryChange]
  );

  // Handle type change - reset subcategory
  const handleTypeChange = useCallback(
    (newType) => {
      onTypeChange(newType);
      onSubcategoryChange("all");
    },
    [onTypeChange, onSubcategoryChange]
  );

  // Count active filters (for badge)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (gender !== "all") count++;
    if (type !== "all") count++;
    if (subcategory !== "all") count++;
    return count;
  }, [gender, type, subcategory]);

  // Check if any filters are active
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={`relative flex items-center gap-2 ${className}`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:w-[350px] flex flex-col"
      >
        <SheetHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
          <SheetTitle>Filter Products</SheetTitle>
        </SheetHeader>

        {/* Scrollable filter sections */}
        <div className="flex-1 overflow-y-auto py-6 space-y-8">
          {/* Gender filter */}
          <FilterSection
            title="Gender"
            options={genderOptions}
            value={gender}
            onChange={handleGenderChange}
          />

          {/* Category filter */}
          <FilterSection
            title="Category"
            options={typeOptions}
            value={type}
            onChange={handleTypeChange}
          />

          {/* Subcategory filter - only show when type is selected */}
          {subcategoryOptions.length > 0 && (
            <FilterSection
              title="Type"
              options={subcategoryOptions}
              value={subcategory}
              onChange={onSubcategoryChange}
            />
          )}
        </div>

        {/* Footer with clear button */}
        {hasActiveFilters && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="ghost"
              onClick={onClearAll}
              className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear All Filters
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default memo(ProductFilterDrawer);
