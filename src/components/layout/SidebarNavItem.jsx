import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/sidebar-animations.css';

/**
 * SidebarNavItem
 *
 * Individual navigation item with icon and label.
 * Shows tooltip on hover when sidebar is collapsed.
 * Supports active state indicator.
 */
export default function SidebarNavItem({
  to,
  icon: Icon,
  label,
  isExpanded,
  disabled = false,
  onClick,
  external = false,
  end = false,
  variant = "default",
  className = "",
  activeClassName = "",
  inactiveClassName = "",
}) {
  const baseClasses = `
    w-full flex items-center rounded-md py-2.5 text-sm font-medium
    transition-colors duration-150
    ${isExpanded ? 'px-3 gap-3' : 'px-0 justify-center'}
  `;

  const activeClasses = `bg-sidebar-active text-white ${activeClassName}`.trim();
  const computedInactiveClasses =
    variant === "back"
      ? "text-neutral-200 bg-sidebar-hover/25 border border-sidebar-border hover:bg-sidebar-hover/40 hover:text-white"
      : "text-neutral-400 hover:bg-sidebar-hover hover:text-white";
  const inactiveClasses = `${computedInactiveClasses} ${inactiveClassName}`.trim();
  const disabledClasses = 'pointer-events-none opacity-50';

  const content = (
    <>
      <span className="sidebar-icon shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      {isExpanded && (
        <span className="sidebar-text truncate sidebar-text-visible">
          {label}
        </span>
      )}
    </>
  );

  // For click-only items (like opening a submenu)
  if (onClick && !to) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={!isExpanded ? label : undefined}
        className={`${baseClasses} ${inactiveClasses} ${disabled ? disabledClasses : ''} ${className}`}
      >
        {content}
      </button>
    );
  }

  // External link
  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        title={!isExpanded ? label : undefined}
        className={`${baseClasses} ${inactiveClasses} ${disabled ? disabledClasses : ''} ${className}`}
      >
        {content}
      </a>
    );
  }

  // Internal NavLink
  return (
    <NavLink
      to={to}
      end={end}
      title={!isExpanded ? label : undefined}
      className={({ isActive }) =>
        `${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${disabled ? disabledClasses : ''} ${className}`
      }
    >
      {content}
    </NavLink>
  );
}
