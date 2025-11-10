import React from 'react';

/**
 * PageHeader - A flexible compound component for consistent page headers
 *
 * Features:
 * - Sticky positioning with backdrop blur
 * - Supports breadcrumbs, title, description, and actions
 * - Fully responsive
 * - Uses design tokens from Phase 1
 *
 * @example
 * <PageHeader>
 *   <Breadcrumb items={[...]} />
 *   <PageHeader.Content>
 *     <PageHeader.Title>Page Title</PageHeader.Title>
 *     <PageHeader.Actions>
 *       <Button>Action</Button>
 *     </PageHeader.Actions>
 *   </PageHeader.Content>
 *   <PageHeader.Description>Optional description</PageHeader.Description>
 * </PageHeader>
 */
const PageHeader = React.forwardRef(({ className, children, sticky = true, ...props }, ref) => {
  const baseClasses = 'border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm content-padding';
  const stickyClasses = sticky ? 'sticky top-0 z-10' : '';
  const combinedClasses = `${baseClasses} ${stickyClasses} ${className || ''}`.trim();

  return (
    <header
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      <div className="space-y-4">
        {children}
      </div>
    </header>
  );
});
PageHeader.displayName = 'PageHeader';

/**
 * PageHeader.Content - Container for title and actions with responsive layout
 */
const PageHeaderContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const combinedClasses = `flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className || ''}`.trim();

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
PageHeaderContent.displayName = 'PageHeader.Content';

/**
 * PageHeader.Title - Semantic h1 heading with design token styling
 */
const PageHeaderTitle = React.forwardRef(({ className, children, as: Component = 'h1', ...props }, ref) => {
  const combinedClasses = `heading-page ${className || ''}`.trim();

  return (
    <Component
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </Component>
  );
});
PageHeaderTitle.displayName = 'PageHeader.Title';

/**
 * PageHeader.Description - Optional subtitle/description text
 */
const PageHeaderDescription = React.forwardRef(({ className, children, ...props }, ref) => {
  const combinedClasses = `body-text-muted max-w-3xl ${className || ''}`.trim();

  return (
    <p
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </p>
  );
});
PageHeaderDescription.displayName = 'PageHeader.Description';

/**
 * PageHeader.Actions - Container for header action buttons
 */
const PageHeaderActions = React.forwardRef(({ className, children, ...props }, ref) => {
  const combinedClasses = `flex flex-wrap items-center gap-2 sm:flex-shrink-0 ${className || ''}`.trim();

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
PageHeaderActions.displayName = 'PageHeader.Actions';

// Compound component pattern: Attach sub-components to main component
PageHeader.Content = PageHeaderContent;
PageHeader.Title = PageHeaderTitle;
PageHeader.Description = PageHeaderDescription;
PageHeader.Actions = PageHeaderActions;

export default PageHeader;
export {
  PageHeader,
  PageHeaderContent,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
};
