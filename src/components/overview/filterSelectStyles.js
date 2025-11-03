const filterSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 6,
    borderColor: state.isFocused ? "#2563eb" : "#cbd5f5",
    boxShadow: state.isFocused ? "0 0 0 1px rgba(37, 99, 235, 0.35)" : "none",
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

export default filterSelectStyles;
