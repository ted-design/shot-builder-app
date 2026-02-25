import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/ui/tooltip"
import { NavIcon } from "./nav-icons"
import type { NavGroup } from "./nav-config"

interface SidebarNavGroupProps {
  readonly group: NavGroup
  readonly collapsed: boolean
  readonly onNavigate?: () => void
  readonly defaultOpen?: boolean
}

export function SidebarNavGroup({
  group,
  collapsed,
  onNavigate,
  defaultOpen = true,
}: SidebarNavGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const { pathname } = useLocation()
  const anyChildActive = group.children.some(
    (child) => pathname === child.to || pathname.startsWith(child.to + "/"),
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/library"
            onClick={onNavigate}
            className={cn(
              "relative flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
              anyChildActive
                ? "bg-[var(--color-sidebar-active)] text-white"
                : "text-neutral-300 hover:bg-[var(--color-sidebar-hover)] hover:text-white",
            )}
          >
            {anyChildActive && (
              <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r-sm bg-[var(--color-sidebar-indicator)]" />
            )}
            <NavIcon name={group.iconName} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {group.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-white"
      >
        <NavIcon name={group.iconName} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--color-sidebar-border)]/50 pl-3">
          {group.children.map((child) => {
            const active = pathname === child.to || pathname.startsWith(child.to + "/")
            return (
              <Link
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "text-white"
                    : "text-neutral-400 hover:bg-[var(--color-sidebar-hover)] hover:text-white",
                )}
              >
                <NavIcon name={child.iconName} className="h-4 w-4 shrink-0" />
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
