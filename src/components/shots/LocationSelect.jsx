import React, { useMemo } from "react";
import Select, { components } from "react-select";
import Thumb from "../Thumb";
import Avatar from "../ui/Avatar";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 6,
    borderColor: state.isFocused ? "#2563eb" : "#cbd5f5",
    boxShadow: state.isFocused ? "0 0 0 1px rgba(37, 99, 235, 0.25)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#2563eb" : "#94a3b8",
    },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 1200 }),
};

export default function LocationSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select location",
  isDisabled = false,
}) {
  const selectOptions = useMemo(() =>
    (options || []).map((loc) => ({
      value: loc.id,
      label: loc.name || "Untitled location",
      imagePath: loc.photoPath || null,
    })),
  [options]);

  const selectedValue = useMemo(() => {
    if (!value) return null;
    const match = selectOptions.find((opt) => opt.value === value);
    return match || null;
  }, [value, selectOptions]);

  const Option = (props) => {
    const { data } = props;
    const img = data.imagePath;
    return (
      <components.Option {...props}>
        <div className="flex items-center gap-2">
          {img ? (
            <div className="h-6 w-6 overflow-hidden rounded-md bg-slate-100">
              <Thumb path={img} size={96} alt={data.label} className="h-6 w-6" imageClassName="h-full w-full object-cover" />
            </div>
          ) : (
            <Avatar name={data.label} size="xs" />
          )}
          <span>{data.label}</span>
        </div>
      </components.Option>
    );
  };

  const SingleValue = (props) => {
    const { data } = props;
    const img = data.imagePath;
    return (
      <components.SingleValue {...props}>
        <div className="flex items-center gap-2">
          {img ? (
            <div className="h-5 w-5 overflow-hidden rounded-md">
              <Thumb path={img} size={80} alt={data.label} className="h-5 w-5" imageClassName="h-full w-full object-cover" />
            </div>
          ) : (
            <Avatar name={data.label} size="xs" />
          )}
          <span className="truncate">{data.label}</span>
        </div>
      </components.SingleValue>
    );
  };

  const portalTarget = typeof window === "undefined" ? undefined : document.body;

  const handleChange = (next) => {
    if (!onChange) return;
    onChange(next?.value || "");
  };

  return (
    <Select
      isClearable
      classNamePrefix="location-select"
      styles={selectStyles}
      options={selectOptions}
      value={selectedValue}
      onChange={handleChange}
      isDisabled={isDisabled}
      placeholder={placeholder}
      menuPortalTarget={portalTarget}
      menuShouldBlockScroll
      components={{ Option, SingleValue }}
    />
  );
}

