import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import '../../styles/sidebar-animations.css';

/**
 * SidebarNavGroup
 *
 * Expandable submenu group for nested navigation items.
 * Used for Library section (Talent, Locations, Tags).
 */
export default function SidebarNavGroup({
  icon: Icon,
  label,
  items = [],
  isExpanded,
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const location = useLocation();

  // Check if any child is active (R.2: respect `end` prop for exact matching)
  const hasActiveChild = items.some((item) => {
    if (item.end) {
      return location.pathname === item.to || location.pathname === `${item.to}/`;
    }
    return location.pathname.startsWith(item.to);
  });

  // Auto-open if a child is active
  React.useEffect(() => {
    if (hasActiveChild && !isOpen) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const baseClasses = `
    w-full flex items-center rounded-md py-2.5 text-sm font-medium
    transition-colors duration-150
    text-neutral-400 hover:bg-sidebar-hover hover:text-white
    ${isExpanded ? 'px-3 justify-between' : 'px-0 justify-center'}
  `;

  return (
    <div>
      {/* Group header */}
      <button
        onClick={handleToggle}
        title={!isExpanded ? label : undefined}
        className={`${baseClasses} ${hasActiveChild ? 'text-white' : ''}`}
      >
        <div className={`flex items-center ${isExpanded ? 'gap-3' : ''}`}>
          <span className="sidebar-icon shrink-0">
            <Icon className="h-5 w-5" />
          </span>
          {isExpanded && (
            <span className="sidebar-text truncate sidebar-text-visible">
              {label}
            </span>
          )}
        </div>

        {/* Chevron - only show when expanded */}
        {isExpanded && (
          <ChevronRight
            className={`sidebar-chevron sidebar-chevron-visible h-4 w-4 transition-transform duration-200 ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>

      {/* Submenu items */}
      {isOpen && (
        <div className={`sidebar-submenu mt-1 space-y-1 pl-4 ${isExpanded ? 'block' : 'hidden'}`}>
          {items.map((item) => {
            // Handle query params in isActive check
            const hasQueryParams = item.to.includes('?');
            const basePath = hasQueryParams ? item.to.split('?')[0] : item.to;
            const queryParams = hasQueryParams ? item.to.split('?')[1] : null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => {
                  // For items with query params, check both path and search
                  let active = isActive;
                  if (hasQueryParams && !item.end) {
                    active = location.pathname.startsWith(basePath) &&
                      location.search === `?${queryParams}`;
                  }
                  return `flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
                    item.indent ? 'pl-7 pr-3' : 'px-3'
                  } ${
                    active
                      ? 'bg-sidebar-active text-white'
                      : 'text-neutral-400 hover:bg-sidebar-hover hover:text-white'
                  }`;
                }}
              >
                {item.icon && <item.icon className={`shrink-0 ${item.indent ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
                <span className={item.indent ? 'text-xs' : ''}>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
