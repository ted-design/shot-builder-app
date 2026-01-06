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

  // Check if any child is active
  const hasActiveChild = items.some((item) => location.pathname.startsWith(item.to));

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
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-neutral-400 hover:bg-sidebar-hover hover:text-white'
                }`
              }
            >
              {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
