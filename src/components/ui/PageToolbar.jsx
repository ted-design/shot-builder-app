import React from 'react';

/**
 * PageToolbar - A compound component for consistent page toolbars
 *
 * Features:
 * - Standardized spacing (gap-3 = 12px between items)
 * - Supports search, filters, sort, view toggles, and actions
 * - Filter pills row for active filters
 * - Responsive wrapping
 * - Uses design tokens
 *
 * Universal toolbar element order:
 * 1. Search
 * 2. Filters (drawer/dropdowns)
 * 3. Show Archived toggle
 * 4. Sort
 * 5. Group By (if applicable)
 * 6. View Mode
 * 7. Density
 * 8. Fields Settings
 * 9. [Spacer - pushes remaining items right]
 * 10. Filter Pills (optional, own row)
 * 11. Selection Mode
 * 12. Export
 * 13. Primary Action (e.g., "New Product")
 *
 * @example
 * <PageToolbar>
 *   <PageToolbar.Row>
 *     <PageToolbar.Search value={query} onChange={setQuery} />
 *     <PageToolbar.Group>
 *       <SortMenu ... />
 *       <ViewModeMenu ... />
 *     </PageToolbar.Group>
 *     <PageToolbar.Spacer />
 *     <PageToolbar.Group>
 *       <ExportButton ... />
 *       <Button>New Item</Button>
 *     </PageToolbar.Group>
 *   </PageToolbar.Row>
 *   <PageToolbar.Pills>
 *     {activeFilters.map(filter => ...)}
 *   </PageToolbar.Pills>
 * </PageToolbar>
 */

const PageToolbar = React.forwardRef(({ className, children, ...props }, ref) => {
  const baseClasses = 'border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900';
  const combinedClasses = `${baseClasses} ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      role="toolbar"
      aria-label="Page toolbar"
      {...props}
    >
      <div className="px-6 py-3 space-y-3">
        {children}
      </div>
    </div>
  );
});
PageToolbar.displayName = 'PageToolbar';

/**
 * PageToolbar.Row - A single row of toolbar items with consistent gap
 */
const PageToolbarRow = React.forwardRef(({ className, children, ...props }, ref) => {
  // gap-3 = 12px - standardized toolbar spacing
  const combinedClasses = `flex flex-wrap items-center gap-3 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  );
});
PageToolbarRow.displayName = 'PageToolbar.Row';

/**
 * PageToolbar.Group - Groups related toolbar items with tighter spacing
 */
const PageToolbarGroup = React.forwardRef(({ className, children, ...props }, ref) => {
  // gap-2 = 8px - tighter spacing within groups
  const combinedClasses = `flex items-center gap-2 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  );
});
PageToolbarGroup.displayName = 'PageToolbar.Group';

/**
 * PageToolbar.Spacer - Flexible spacer to push items apart
 */
const PageToolbarSpacer = React.forwardRef(({ className, ...props }, ref) => {
  const combinedClasses = `flex-1 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      aria-hidden="true"
      {...props}
    />
  );
});
PageToolbarSpacer.displayName = 'PageToolbar.Spacer';

/**
 * PageToolbar.Divider - Vertical divider between toolbar sections
 */
const PageToolbarDivider = React.forwardRef(({ className, ...props }, ref) => {
  const combinedClasses = `h-5 w-px bg-neutral-200 dark:bg-neutral-700 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      aria-hidden="true"
      {...props}
    />
  );
});
PageToolbarDivider.displayName = 'PageToolbar.Divider';

/**
 * PageToolbar.Pills - Container for filter pills with consistent styling
 */
const PageToolbarPills = React.forwardRef(({ className, children, ...props }, ref) => {
  // Only render if there are children
  if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) {
    return null;
  }

  const combinedClasses = `flex flex-wrap gap-2 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      role="group"
      aria-label="Active filters"
      {...props}
    >
      {children}
    </div>
  );
});
PageToolbarPills.displayName = 'PageToolbar.Pills';

/**
 * PageToolbar.Pill - Individual filter pill with remove button
 */
const PageToolbarPill = React.forwardRef(({
  className,
  children,
  label,
  value,
  onRemove,
  ...props
}, ref) => {
  const combinedClasses = `
    inline-flex items-center gap-1.5
    rounded-full border border-primary/20 bg-primary/10
    px-2.5 py-0.5
    text-xs font-medium text-primary
    transition hover:bg-primary/20
    dark:border-primary/30 dark:bg-primary/15
    ${className || ''}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      ref={ref}
      type="button"
      onClick={onRemove}
      className={combinedClasses}
      {...props}
    >
      <span>
        {label}
        {value ? `: ${value}` : ''}
      </span>
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
      <span className="sr-only">Remove {label} filter</span>
    </button>
  );
});
PageToolbarPill.displayName = 'PageToolbar.Pill';

/**
 * PageToolbar.Search - Standardized search input wrapper
 * (Use with ExpandableSearch component or custom search)
 */
const PageToolbarSearch = React.forwardRef(({ className, children, ...props }, ref) => {
  const combinedClasses = `flex-shrink-0 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  );
});
PageToolbarSearch.displayName = 'PageToolbar.Search';

/**
 * PageToolbar.Actions - Container for primary action buttons (right-aligned)
 */
const PageToolbarActions = React.forwardRef(({ className, children, ...props }, ref) => {
  const combinedClasses = `flex items-center gap-2 flex-shrink-0 ${className || ''}`.trim();

  return (
    <div
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  );
});
PageToolbarActions.displayName = 'PageToolbar.Actions';

// Compound component pattern: Attach sub-components to main component
PageToolbar.Row = PageToolbarRow;
PageToolbar.Group = PageToolbarGroup;
PageToolbar.Spacer = PageToolbarSpacer;
PageToolbar.Divider = PageToolbarDivider;
PageToolbar.Pills = PageToolbarPills;
PageToolbar.Pill = PageToolbarPill;
PageToolbar.Search = PageToolbarSearch;
PageToolbar.Actions = PageToolbarActions;

export default PageToolbar;
export {
  PageToolbar,
  PageToolbarRow,
  PageToolbarGroup,
  PageToolbarSpacer,
  PageToolbarDivider,
  PageToolbarPills,
  PageToolbarPill,
  PageToolbarSearch,
  PageToolbarActions,
};
