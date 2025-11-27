/**
 * Badge component - A simple badge for displaying labels and tags
 *
 * @param {Object} props
 * @param {string} [props.variant="default"] - Badge style variant
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Badge content
 */
export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variantClasses = {
    default: "bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900",
    secondary: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
    outline: "border border-slate-200 text-slate-900 dark:border-slate-800 dark:text-slate-50",
    destructive: "bg-red-500 text-slate-50 dark:bg-red-900 dark:text-slate-50",
  };

  const classes = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
