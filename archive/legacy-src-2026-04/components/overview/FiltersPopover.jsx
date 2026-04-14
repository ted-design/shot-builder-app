import { useEffect, useRef, useState } from "react";
import Select from "react-select";
import { Filter } from "lucide-react";
import { Button } from "../ui/button";
import filterSelectStyles from "./filterSelectStyles";

const defaultPlaceholders = {
  location: "Select location...",
  talent: "Select talent...",
  product: "Select products...",
  tag: "Select tags...",
};

export default function FiltersPopover({
  locationOptions = [],
  locationValue = null,
  onLocationChange,
  locationPlaceholder,
  locationNoOptionsMessage,
  talentOptions = [],
  talentValue = [],
  onTalentChange,
  talentPlaceholder,
  talentNoOptionsMessage,
  productOptions = [],
  productValue = [],
  onProductChange,
  productPlaceholder,
  productNoOptionsMessage,
  tagOptions = [],
  tagValue = [],
  onTagChange,
  tagPlaceholder,
  tagNoOptionsMessage,
  selectPortalTarget,
  disabled = false,
}) {
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

  const content = (
    <div className="absolute left-0 z-50 mt-2 w-[640px] max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Location</label>
          <Select
            classNamePrefix="filter-select"
            styles={filterSelectStyles}
            options={locationOptions}
            value={locationValue}
            onChange={(option) => onLocationChange?.(option?.value || "")}
            placeholder={
              locationPlaceholder ||
              (locationOptions.length ? defaultPlaceholders.location : "No locations available")
            }
            isDisabled={disabled || !locationOptions.length}
            noOptionsMessage={() =>
              locationNoOptionsMessage ||
              (locationOptions.length ? "No matching locations" : "No locations available")
            }
            menuPortalTarget={selectPortalTarget}
            menuShouldBlockScroll
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Talent</label>
          <Select
            isMulti
            classNamePrefix="filter-select"
            styles={filterSelectStyles}
            options={talentOptions}
            value={talentValue}
            onChange={(selected) => onTalentChange?.(selected || [])}
            placeholder={
              talentPlaceholder ||
              (talentOptions.length ? defaultPlaceholders.talent : "No talent available")
            }
            isDisabled={disabled || !talentOptions.length}
            noOptionsMessage={() =>
              typeof talentNoOptionsMessage === "string"
                ? talentNoOptionsMessage
                : talentOptions.length
                ? "No matching talent"
                : "No talent available"
            }
            menuPortalTarget={selectPortalTarget}
            menuShouldBlockScroll
            closeMenuOnSelect={false}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Products</label>
          <Select
            isMulti
            classNamePrefix="filter-select"
            styles={filterSelectStyles}
            options={productOptions}
            value={productValue}
            onChange={(selected) => onProductChange?.(selected || [])}
            placeholder={
              productPlaceholder ||
              (productOptions.length ? defaultPlaceholders.product : "No products available")
            }
            isDisabled={disabled || !productOptions.length}
            noOptionsMessage={() =>
              productNoOptionsMessage ||
              (productOptions.length ? "No matching products" : "No products available")
            }
            menuPortalTarget={selectPortalTarget}
            menuShouldBlockScroll
            closeMenuOnSelect={false}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tags</label>
          <Select
            isMulti
            classNamePrefix="filter-select"
            styles={filterSelectStyles}
            options={tagOptions}
            value={tagValue}
            onChange={(selected) => onTagChange?.(selected || [])}
            placeholder={
              tagPlaceholder ||
              (tagOptions.length ? defaultPlaceholders.tag : "No tags available")
            }
            isDisabled={disabled || !tagOptions.length}
            noOptionsMessage={() =>
              tagNoOptionsMessage ||
              (tagOptions.length ? "No matching tags" : "No tags available")
            }
            menuPortalTarget={selectPortalTarget}
            menuShouldBlockScroll
            closeMenuOnSelect={false}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Filter shots"
        disabled={disabled}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open ? content : null}
    </div>
  );
}
