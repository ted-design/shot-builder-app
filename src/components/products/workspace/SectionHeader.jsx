/**
 * SectionHeader - Consistent header pattern for workspace sections
 *
 * Design system:
 * - Title left with optional count badge
 * - Optional context slot (scope indicator, breadcrumb, etc.)
 * - Actions slot right-aligned
 * - Standardized padding and border
 *
 * Usage:
 * <SectionHeader
 *   title="Samples"
 *   count={12}
 *   context={<ScopeContextBar ... />}
 *   actions={<Button>Add sample</Button>}
 * />
 */

export default function SectionHeader({
  title,
  count,
  context,
  actions,
  className = "",
}) {
  return (
    <div
      className={`
        flex items-center justify-between gap-4
        px-6 py-4 border-b border-slate-100 dark:border-slate-700
        ${className}
      `}
    >
      {/* Left side: Title + context */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              ({count})
            </span>
          )}
        </h2>

        {/* Context slot - scope indicator, breadcrumb, etc */}
        {context && (
          <div className="flex items-center gap-2 text-sm">
            {context}
          </div>
        )}
      </div>

      {/* Right side: Actions */}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
