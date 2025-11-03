export default function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className = "",
}) {
  const containerClasses =
    "inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800";
  const buttonBaseClasses =
    size === "sm"
      ? "px-2 py-1.5 text-xs sm:px-3 sm:text-sm transition"
      : "flex items-center gap-1.5 px-2 py-1.5 text-sm transition sm:gap-2 sm:px-3";
  return (
    <div className={`${containerClasses} ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`${buttonBaseClasses} ${
              isActive
                ? "bg-slate-900 text-white dark:bg-slate-700"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
            aria-pressed={isActive}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
            <span className={option.hideLabelOnSmallScreen ? "hidden sm:inline" : undefined}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
