import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb navigation component
 *
 * @param {Object} props
 * @param {Array<{label: string, href?: string, icon?: React.Component}>} props.items - Breadcrumb items
 * @returns {React.ReactElement|null}
 *
 * @example
 * <Breadcrumb items={[
 *   { label: 'Dashboard', href: '/projects', icon: Home },
 *   { label: 'Project Name', href: '/planner' },
 *   { label: 'Planner' }
 * ]} />
 */
export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) {
    return null;
  }

  // Don't show breadcrumbs if only one item (current page only)
  if (items.length === 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-2">
              {/* Separator (skip for first item) */}
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-slate-400 dark:text-slate-600"
                  aria-hidden="true"
                />
              )}

              {/* Current page (non-clickable) */}
              {isLast ? (
                <span
                  className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-medium"
                  aria-current="page"
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              ) : (
                /* Clickable breadcrumb link */
                <Link
                  to={item.href}
                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light rounded px-1 -mx-1"
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
