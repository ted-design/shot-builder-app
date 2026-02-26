import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/shared/lib/utils"
import { useIsTablet } from "@/shared/hooks/useMediaQuery"
import type { NavConfig } from "./nav-config"
import { BrandHeader, ProjectHeader } from "./SidebarHeader"
import { SidebarNav } from "./SidebarNav"
import { SidebarUserSection } from "./SidebarUserSection"

interface MobileDrawerProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly config: NavConfig
  readonly projectName?: string
}

export function MobileDrawer({
  open,
  onOpenChange,
  config,
  projectName,
}: MobileDrawerProps) {
  const isTablet = useIsTablet()
  const close = () => onOpenChange(false)

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay
          className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <SheetPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-[var(--z-modal)] flex flex-col bg-[var(--color-sidebar)] p-0 shadow-lg",
            "data-[state=closed]:duration-300 data-[state=open]:duration-300",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
            isTablet ? "w-80" : "w-72",
          )}
        >
          {/* Accessible title for screen readers */}
          <SheetPrimitive.Title className="sr-only">Navigation</SheetPrimitive.Title>

          {config.variant === "project" && projectName ? (
            <ProjectHeader projectName={projectName} collapsed={false} />
          ) : (
            <BrandHeader collapsed={false} />
          )}

          <div className="flex-1 overflow-y-auto py-3">
            <SidebarNav
              config={config}
              collapsed={false}
              onNavigate={close}
              showBadges={isTablet}
            />
          </div>

          <SidebarUserSection collapsed={false} />

          {isTablet && (
            <div className="absolute right-[-2px] top-1/2 h-10 w-1 -translate-y-1/2 rounded bg-[var(--color-sidebar-border)]" />
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  )
}
