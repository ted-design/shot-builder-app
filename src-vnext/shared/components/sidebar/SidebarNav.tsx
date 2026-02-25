import type { NavConfig, NavEntry } from "./nav-config"
import { SidebarNavItem } from "./SidebarNavItem"
import { SidebarNavGroup } from "./SidebarNavGroup"

interface SidebarNavProps {
  readonly config: NavConfig
  readonly collapsed: boolean
  readonly onNavigate?: () => void
  readonly showBadges?: boolean
}

export function SidebarNav({
  config,
  collapsed,
  onNavigate,
  showBadges = false,
}: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {config.entries.map((entry, i) => (
        <NavEntryRenderer
          key={entryKey(entry, i)}
          entry={entry}
          collapsed={collapsed}
          onNavigate={onNavigate}
          showBadges={showBadges}
        />
      ))}
    </nav>
  )
}

function NavEntryRenderer({
  entry,
  collapsed,
  onNavigate,
  showBadges,
}: {
  readonly entry: NavEntry
  readonly collapsed: boolean
  readonly onNavigate?: () => void
  readonly showBadges: boolean
}) {
  switch (entry.type) {
    case "item":
      return (
        <SidebarNavItem
          item={entry.item}
          collapsed={collapsed}
          onNavigate={onNavigate}
          showBadge={showBadges}
        />
      )
    case "group":
      return (
        <SidebarNavGroup
          group={entry.group}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      )
    case "back-link":
      return (
        <SidebarNavItem
          item={entry.item}
          collapsed={collapsed}
          onNavigate={onNavigate}
          variant="back"
        />
      )
    case "divider":
      return (
        <div className="pb-1 pt-3">
          <div className="mx-2 border-t border-[var(--color-sidebar-border)]/60" aria-hidden="true" />
        </div>
      )
    case "section-label":
      if (collapsed) return null
      return (
        <div className="pb-1.5 pt-3">
          <span className="px-3 text-2xs font-semibold uppercase tracking-wider text-neutral-500">
            {entry.label}
          </span>
        </div>
      )
    default:
      return null
  }
}

function entryKey(entry: NavEntry, index: number): string {
  switch (entry.type) {
    case "item":
    case "back-link":
      return entry.item.to
    case "group":
      return `group-${entry.group.label}`
    case "section-label":
      return `label-${entry.label}`
    case "divider":
      return `divider-${index}`
    default:
      return `entry-${index}`
  }
}
