import { useState } from "react"
import { Outlet, useLocation, useParams } from "react-router-dom"
import { cn } from "@/shared/lib/utils"
import { useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { OfflineBanner } from "@/shared/components/OfflineBanner"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { FloatingActionBar } from "@/shared/components/FloatingActionBar"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProject } from "@/features/projects/hooks/useProject"
import { buildNavConfig, getMobileNavConfig } from "./sidebar/nav-config"
import { useSidebarState } from "./sidebar/useSidebarState"
import { DesktopSidebar } from "./sidebar/DesktopSidebar"
import { MobileTopBar } from "./sidebar/MobileTopBar"
import { MobileDrawer } from "./sidebar/MobileDrawer"

export function AppShell() {
  const { pathname, search } = useLocation()
  const { id: projectId } = useParams<{ id: string }>()
  const isDesktop = useIsDesktop()
  const { collapsed, toggle } = useSidebarState()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { role } = useAuth()
  const { data: project } = useProject(projectId ?? null)
  const projectName = project?.name

  const isCallSheetPreview =
    pathname.includes("/callsheet") &&
    new URLSearchParams(search).get("preview") === "1"

  if (isCallSheetPreview) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <main className="p-4 sm:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    )
  }

  const desktopConfig = buildNavConfig(projectId, role)
  const mobileConfig = getMobileNavConfig(projectId, role)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <OfflineBanner />

      {isDesktop ? (
        <DesktopSidebar
          config={desktopConfig}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          projectName={projectName}
        />
      ) : (
        <>
          <MobileTopBar
            onMenuOpen={() => setDrawerOpen(true)}
            projectName={projectName}
          />
          <MobileDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            config={mobileConfig}
            projectName={projectName}
          />
        </>
      )}

      <main
        className={cn(
          "transition-[margin-left] duration-200",
          isDesktop
            ? collapsed
              ? "ml-[var(--sidebar-width)] px-6 py-6"
              : "ml-[var(--sidebar-width-expanded)] px-6 py-6"
            : "mt-[var(--topbar-height)] px-4 py-6",
        )}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {!isDesktop && <FloatingActionBar />}
    </div>
  )
}
