import { useMemo } from "react";
import Select from "react-select";

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
  menuPortal: (base) => ({ ...base, zIndex: 40 }),
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
  const selectOptions = useMemo(
    () =>
      (options || []).map((option) => ({
        value: option.talentId,
        label: option.name,
      })),
    [options]
  );

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
    />
  );
}
