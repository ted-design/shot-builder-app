import React, { useMemo } from "react";
import Select, { components } from "react-select";
import Avatar from "../ui/Avatar";
import Thumb from "../Thumb";

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
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#e2e8f0",
    borderRadius: 9999,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0f172a",
    fontWeight: 500,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#475569",
    ":hover": {
      backgroundColor: "#cbd5f5",
      color: "#1d4ed8",
    },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 1200 }),
};

const defaultNoOptionsMessage = () => "No options";

export default function TalentMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select talent",
  noOptionsMessage = defaultNoOptionsMessage,
  isDisabled = false,
}) {
  const selectOptions = useMemo(() =>
    (options || []).map((option) => ({
      value: option.talentId,
      label: option.name,
      imagePath: option.headshotPath || option.photoPath || null,
    })),
  [options]);

  const selectValue = useMemo(
    () =>
      (value || []).map((entry) => ({
        value: entry.talentId,
        label: entry.name,
      })),
    [value]
  );

  const handleChange = (selected) => {
    if (!onChange) return;
    onChange(
      (selected || []).map((option) => ({
        talentId: option.value,
        name: option.label,
      }))
    );
  };

  const portalTarget = typeof window === "undefined" ? undefined : document.body;
  const noOptions = typeof noOptionsMessage === "function" ? noOptionsMessage : () => noOptionsMessage;

  const Option = (props) => {
    const { data } = props;
    const img = data.imagePath;
    return (
      <components.Option {...props}>
        <div className="flex items-center gap-2">
          {img ? (
            <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-100">
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

  const MultiValueLabel = (props) => {
    const { data } = props;
    const img = data.imagePath;
    return (
      <components.MultiValueLabel {...props}>
        <div className="flex items-center gap-1">
          {img ? (
            <div className="h-4 w-4 overflow-hidden rounded-full">
              <Thumb path={img} size={64} alt={data.label} className="h-4 w-4" imageClassName="h-full w-full object-cover" />
            </div>
          ) : (
            <Avatar name={data.label} size="xs" />
          )}
          <span>{data.label}</span>
        </div>
      </components.MultiValueLabel>
    );
  };

  return (
    <Select
      isMulti
      classNamePrefix="talent-select"
      styles={selectStyles}
      options={selectOptions}
      value={selectValue}
      onChange={handleChange}
      isDisabled={isDisabled}
      placeholder={placeholder}
      noOptionsMessage={noOptions}
      menuPortalTarget={portalTarget}
      menuShouldBlockScroll
      components={{ Option, MultiValueLabel }}
    />
  );
}
