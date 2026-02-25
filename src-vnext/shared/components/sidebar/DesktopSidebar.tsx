import { TooltipProvider } from "@/ui/tooltip"
import { cn } from "@/shared/lib/utils"
import type { NavConfig } from "./nav-config"
import { BrandHeader, ProjectHeader } from "./SidebarHeader"
import { SidebarNav } from "./SidebarNav"
import { SidebarUserSection } from "./SidebarUserSection"

interface DesktopSidebarProps {
  readonly config: NavConfig
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly projectName?: string
}

export function DesktopSidebar({
  config,
  collapsed,
  onToggleCollapse,
  projectName,
}: DesktopSidebarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[var(--z-fixed)] flex flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] transition-[width] duration-200",
          collapsed
            ? "w-[var(--sidebar-width)]"
            : "w-[var(--sidebar-width-expanded)]",
        )}
      >
        {config.variant === "project" && projectName ? (
          <ProjectHeader projectName={projectName} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
        ) : (
          <BrandHeader collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
        )}

        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav config={config} collapsed={collapsed} />
        </div>

        <SidebarUserSection collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  )
}
