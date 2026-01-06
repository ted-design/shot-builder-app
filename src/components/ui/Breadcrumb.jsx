import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * Breadcrumb navigation component
 *
 * @param {Object} props
 * @param {Array<{label: string, href?: string, icon?: React.Component, menuItems?: Array}>} props.items - Breadcrumb items
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

  const crumbLinkClass =
    "flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light rounded px-1 -mx-1";

  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;
          const hasMenu = Array.isArray(item.menuItems) && item.menuItems.length > 0;

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
              ) : hasMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={crumbLinkClass} aria-label={`${item.label} menu`}>
                      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                      <span>{item.label}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px]">
                    {item.menuItems.map((menuItem, menuIndex) => {
                      if (!menuItem) return null;
                      if (menuItem.type === "separator") {
                        return <DropdownMenuSeparator key={`sep-${menuIndex}`} />;
                      }
                      const MenuIcon = menuItem.icon;
                      if (menuItem.href) {
                        return (
                          <DropdownMenuItem key={`${menuItem.href}-${menuIndex}`} asChild>
                            <Link to={menuItem.href} className="flex items-center gap-2">
                              {MenuIcon ? <MenuIcon className="h-4 w-4" aria-hidden="true" /> : null}
                              <span className="truncate">{menuItem.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      }
                      if (typeof menuItem.onSelect === "function") {
                        return (
                          <DropdownMenuItem
                            key={`${menuItem.label}-${menuIndex}`}
                            onSelect={(event) => {
                              event.preventDefault();
                              menuItem.onSelect();
                            }}
                            className="flex items-center gap-2"
                          >
                            {MenuIcon ? <MenuIcon className="h-4 w-4" aria-hidden="true" /> : null}
                            <span className="truncate">{menuItem.label}</span>
                          </DropdownMenuItem>
                        );
                      }
                      return (
                        <DropdownMenuItem
                          key={`${menuItem.label}-${menuIndex}`}
                          disabled={true}
                          className="opacity-60"
                        >
                          {menuItem.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : item.href ? (
                <Link to={item.href} className={crumbLinkClass}>
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
