import { Camera, ChevronDown, ChevronLeft, Folder } from "lucide-react"
import { Button } from "@/ui/button"
import { cn } from "@/shared/lib/utils"

interface BrandHeaderProps {
  readonly collapsed: boolean
  readonly onToggleCollapse?: () => void
}

export function BrandHeader({ collapsed, onToggleCollapse }: BrandHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[56px] items-center border-b border-[var(--color-sidebar-border)] px-4",
        collapsed && "justify-center px-2",
      )}
    >
      {collapsed ? (
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] transition-opacity hover:opacity-80"
          onClick={onToggleCollapse}
          title="Expand sidebar"
        >
          <Camera className="h-4 w-4 text-white" />
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <span className="truncate text-sm font-semibold text-white">Shot Builder</span>
          </div>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 shrink-0 text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}

interface ProjectHeaderProps {
  readonly projectName: string
  readonly collapsed: boolean
  readonly onToggleCollapse?: () => void
}

export function ProjectHeader({ projectName, collapsed, onToggleCollapse }: ProjectHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[56px] items-center border-b border-[var(--color-sidebar-border)]",
        collapsed ? "justify-center px-2" : "px-3",
      )}
    >
      {collapsed ? (
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-700 transition-opacity hover:opacity-80"
          onClick={onToggleCollapse}
          title="Expand sidebar"
        >
          <Folder className="h-4 w-4 text-neutral-300" />
        </button>
      ) : (
        <>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-sidebar-hover)]/40"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-700">
              <Folder className="h-4 w-4 text-neutral-300" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="mb-0.5 text-2xs font-semibold uppercase leading-none tracking-wider text-neutral-500">
                Project
              </div>
              <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                {projectName}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              </div>
            </div>
          </button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}
