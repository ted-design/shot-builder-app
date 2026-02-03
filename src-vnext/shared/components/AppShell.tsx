import { useState } from "react"
import { Link, Outlet, useLocation, useParams } from "react-router-dom"
import {
  FolderKanban,
  Camera,
  ClipboardList,
  CalendarDays,
  Package,
  Menu,
  LogOut,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Separator } from "@/ui/separator"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { OfflineBanner } from "@/shared/components/OfflineBanner"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"

interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: React.ReactNode
  readonly desktopOnly?: boolean
}

interface NavSection {
  readonly label: string
  readonly items: readonly NavItem[]
}

function getNavSections(projectId?: string): readonly NavSection[] {
  const sections: NavSection[] = [
    {
      label: "Projects",
      items: [
        { label: "Dashboard", to: "/projects", icon: <FolderKanban className="h-5 w-5" /> },
      ],
    },
  ]

  if (projectId) {
    sections.push({
      label: "Project",
      items: [
        {
          label: "Shots",
          to: `/projects/${projectId}/shots`,
          icon: <Camera className="h-5 w-5" />,
        },
        {
          label: "Pulls",
          to: `/projects/${projectId}/pulls`,
          icon: <ClipboardList className="h-5 w-5" />,
        },
        {
          label: "Call Sheet",
          to: `/projects/${projectId}/callsheet`,
          icon: <CalendarDays className="h-5 w-5" />,
        },
      ],
    })
  }

  sections.push({
    label: "Org",
    items: [
      {
        label: "Products",
        to: "/products",
        icon: <Package className="h-5 w-5" />,
      },
    ],
  })

  return sections
}

function NavLinks({
  sections,
  pathname,
  collapsed,
  onNavigate,
  filterDesktopOnly,
}: {
  readonly sections: readonly NavSection[]
  readonly pathname: string
  readonly collapsed: boolean
  readonly onNavigate?: () => void
  readonly filterDesktopOnly?: boolean
}) {
  return (
    <nav className="flex flex-col gap-4 px-2">
      {sections.map((section) => {
        const items = filterDesktopOnly
          ? section.items.filter((item) => !item.desktopOnly)
          : section.items
        if (items.length === 0) return null
        return (
          <div key={section.label} className="flex flex-col gap-1">
            {!collapsed && (
              <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-sidebar-text)] opacity-50">
                {section.label}
              </span>
            )}
            {items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/")
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text-active)]"
                      : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]",
                    collapsed && "justify-center px-2",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function DesktopSidebar({
  sections,
  pathname,
  collapsed,
  onToggleCollapse,
}: {
  readonly sections: readonly NavSection[]
  readonly pathname: string
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
}) {
  const { user, signOut } = useAuth()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--z-fixed)] flex flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] transition-[width] duration-200",
        collapsed ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-expanded)]",
      )}
    >
      <div className={cn("flex h-[var(--topbar-height)] items-center px-4", collapsed && "justify-center px-2")}>
        {!collapsed && (
          <span className="text-base font-semibold text-white">Shot Builder</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-[var(--color-sidebar-text)] hover:text-white", !collapsed && "ml-auto")}
          onClick={onToggleCollapse}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <Separator className="bg-[var(--color-sidebar-hover)]" />

      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks sections={sections} pathname={pathname} collapsed={collapsed} />
      </div>

      <Separator className="bg-[var(--color-sidebar-hover)]" />

      <div className={cn("flex items-center gap-3 px-4 py-3", collapsed && "justify-center px-2")}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.photoURL ?? undefined} />
          <AvatarFallback className="bg-[var(--color-primary)] text-xs text-white">
            {user?.displayName?.charAt(0) ?? "?"}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-white">
              {user?.displayName ?? user?.email ?? "User"}
            </p>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="text-[var(--color-sidebar-text)] hover:text-white"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}

function MobileHeader({
  sections,
  pathname,
}: {
  readonly sections: readonly NavSection[]
  readonly pathname: string
}) {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-fixed)] flex h-[var(--topbar-height)] items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-[var(--color-sidebar)] p-0 text-white">
          <div className="flex h-[var(--topbar-height)] items-center px-4">
            <span className="text-base font-semibold">Shot Builder</span>
          </div>
          <Separator className="bg-[var(--color-sidebar-hover)]" />
          <div className="py-4">
            <NavLinks
              sections={sections}
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
              filterDesktopOnly
            />
          </div>
          <Separator className="bg-[var(--color-sidebar-hover)]" />
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="bg-[var(--color-primary)] text-xs text-white">
                {user?.displayName?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-white">
                {user?.displayName ?? user?.email ?? "User"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-[var(--color-sidebar-text)] hover:text-white"
              onClick={signOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <span className="ml-3 text-base font-semibold text-[var(--color-text)]">
        Shot Builder
      </span>
    </header>
  )
}

export function AppShell() {
  const { pathname, search } = useLocation()
  const { id: projectId } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)

  const navSections = getNavSections(projectId)
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <OfflineBanner />

      {isMobile ? (
        <MobileHeader sections={navSections} pathname={pathname} />
      ) : (
        <DesktopSidebar
          sections={navSections}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      )}

      <main
        className={cn(
          "transition-[margin-left] duration-200",
          isMobile
            ? "mt-[var(--topbar-height)] px-4 py-6"
            : collapsed
              ? "ml-[var(--sidebar-width)] px-6 py-6"
              : "ml-[var(--sidebar-width-expanded)] px-6 py-6",
        )}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
