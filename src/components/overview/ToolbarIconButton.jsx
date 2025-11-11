// src/components/overview/ToolbarIconButton.jsx
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import { Button } from "../ui/button";

/**
 * ToolbarIconButton - Icon-only button with tooltip
 *
 * Wraps a Button component with Tippy tooltip for accessibility.
 * Ideal for icon-only buttons in toolbars where tooltips provide
 * context about the button's function and keyboard shortcuts.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Icon or content to display in button
 * @param {string} props.tooltip - Tooltip text to display on hover
 * @param {Function} props.onClick - Click handler
 * @param {string} [props.variant="ghost"] - Button variant (ghost, secondary, etc.)
 * @param {boolean} [props.active=false] - Whether button is in active state
 * @param {string} [props.ariaLabel] - Accessibility label (defaults to tooltip)
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.tippyProps] - Additional Tippy.js props
 * @param {...any} props.rest - Other props passed to Button
 *
 * @example
 * <ToolbarIconButton
 *   tooltip="Keyboard shortcuts (Shift+/)"
 *   onClick={openShortcuts}
 *   ariaLabel="Open keyboard shortcuts"
 * >
 *   <Keyboard className="h-4 w-4" />
 * </ToolbarIconButton>
 *
 * @example
 * <ToolbarIconButton
 *   tooltip="Toggle properties panel"
 *   onClick={toggleProperties}
 *   active={isPropertiesOpen}
 *   variant={isPropertiesOpen ? "secondary" : "ghost"}
 * >
 *   <SidebarRight className="h-4 w-4" />
 * </ToolbarIconButton>
 */
export default function ToolbarIconButton({
  children,
  tooltip,
  onClick,
  variant = "ghost",
  active = false,
  ariaLabel,
  disabled = false,
  className = "",
  tippyProps = {},
  ...rest
}) {
  const button = (
    <Button
      type="button"
      variant={active ? "secondary" : variant}
      size="icon"
      onClick={onClick}
      aria-label={ariaLabel || tooltip}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );

  if (!tooltip || disabled) {
    return button;
  }

  return (
    <Tippy
      content={tooltip}
      placement="bottom"
      delay={[300, 0]}
      {...tippyProps}
    >
      {button}
    </Tippy>
  );
}
