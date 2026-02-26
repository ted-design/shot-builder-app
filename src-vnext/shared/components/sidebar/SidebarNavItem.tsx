import { Link, useLocation } from "react-router-dom"
import { cn } from "@/shared/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/ui/tooltip"
import { NavIcon } from "./nav-icons"
import type { NavItem } from "./nav-config"

interface SidebarNavItemProps {
  readonly item: NavItem
  readonly collapsed: boolean
  readonly onNavigate?: () => void
  readonly variant?: "default" | "back"
  readonly showBadge?: boolean
}

export function SidebarNavItem({
  item,
  collapsed,
  onNavigate,
  variant = "default",
  showBadge = false,
}: SidebarNavItemProps) {
  const { pathname } = useLocation()
  const active = pathname === item.to || pathname.startsWith(item.to + "/")

  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text-active)]"
          : variant === "back"
            ? "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]"
            : "text-[var(--color-sidebar-text-active)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]",
        collapsed && "justify-center px-2",
      )}
    >
      {active && (
        <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r-sm bg-[var(--color-sidebar-indicator)]" />
      )}
      <NavIcon name={item.iconName} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && showBadge && item.surfaceBadge && (
        <span className="ml-auto rounded bg-[var(--color-sidebar-active)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-sidebar-text)]">
          {item.surfaceBadge}
        </span>
      )}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}
