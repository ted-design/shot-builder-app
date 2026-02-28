/**
 * Nav configuration — pure data, no React.
 * Provides typed nav items and buildNavConfig() for sidebar/drawer rendering.
 */

import { ROLE } from "@/shared/lib/rbac"

export type NavItemIcon =
  | "layout-grid"
  | "inbox"
  | "camera"
  | "clipboard-list"
  | "image"
  | "calendar-days"
  | "package"
  | "landmark"
  | "users"
  | "hard-hat"
  | "map-pin"
  | "palette"
  | "arrow-left"
  | "settings"
  | "shield-check"
  | "tag"

export type SurfaceBadge = "Limited" | "Reader" | "Editor"

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly iconName: NavItemIcon
  readonly desktopOnly?: boolean
  readonly surfaceBadge?: SurfaceBadge
}

export interface NavGroup {
  readonly label: string
  readonly iconName: NavItemIcon
  readonly children: readonly NavItem[]
}

export type NavEntry =
  | { readonly type: "item"; readonly item: NavItem }
  | { readonly type: "group"; readonly group: NavGroup }
  | { readonly type: "divider" }
  | { readonly type: "section-label"; readonly label: string }
  | { readonly type: "back-link"; readonly item: NavItem }

export interface NavConfig {
  readonly variant: "org" | "project"
  readonly entries: readonly NavEntry[]
}

const LIBRARY_CHILDREN: readonly NavItem[] = [
  { label: "Talent", to: "/library/talent", iconName: "users" },
  { label: "Crew", to: "/library/crew", iconName: "hard-hat" },
  { label: "Locations", to: "/library/locations", iconName: "map-pin" },
  { label: "Palette", to: "/library/palette", iconName: "palette" },
]

export function buildNavConfig(projectId?: string, role?: string): NavConfig {
  if (!projectId) {
    const entries: NavEntry[] = [
      { type: "item", item: { label: "Dashboard", to: "/projects", iconName: "layout-grid" } },
    ]

    if (role === ROLE.ADMIN || role === ROLE.PRODUCER) {
      entries.push({
        type: "item",
        item: { label: "Inbox", to: "/inbox", iconName: "inbox" },
      })
    }

    entries.push(
      { type: "item", item: { label: "Products", to: "/products", iconName: "package" } },
      {
        type: "group",
        group: {
          label: "Library",
          iconName: "landmark",
          children: LIBRARY_CHILDREN,
        },
      },
    )

    if (role === ROLE.ADMIN) {
      entries.push(
        { type: "divider" },
        {
          type: "item",
          item: { label: "Admin", to: "/admin", iconName: "shield-check", desktopOnly: true },
        },
      )
    }

    return { variant: "org", entries }
  }

  const prefix = `/projects/${projectId}`

  return {
    variant: "project",
    entries: [
      { type: "back-link", item: { label: "All Projects", to: "/projects", iconName: "arrow-left" } },
      { type: "section-label", label: "Project" },
      { type: "item", item: { label: "Shots", to: `${prefix}/shots`, iconName: "camera", surfaceBadge: "Limited" } },
      { type: "item", item: { label: "Pulls", to: `${prefix}/pulls`, iconName: "clipboard-list", surfaceBadge: "Limited" } },
      { type: "item", item: { label: "Assets", to: `${prefix}/assets`, iconName: "image", surfaceBadge: "Reader" } },
      {
        type: "item",
        item: { label: "Call Sheet", to: `${prefix}/callsheet`, iconName: "calendar-days", desktopOnly: true },
      },
      {
        type: "item",
        item: { label: "Tags", to: `${prefix}/tags`, iconName: "tag", desktopOnly: true },
      },
      { type: "divider" },
      { type: "item", item: { label: "Products", to: "/products", iconName: "package", surfaceBadge: "Reader" } },
      {
        type: "group",
        group: {
          label: "Library",
          iconName: "landmark",
          children: LIBRARY_CHILDREN,
        },
      },
    ],
  }
}

/** Flat list of library child routes for mobile (single "Library" link instead of group). */
export function getMobileNavConfig(projectId?: string, role?: string): NavConfig {
  const config = buildNavConfig(projectId, role)
  const entries = config.entries.map((entry): NavEntry => {
    if (entry.type === "group") {
      return {
        type: "item",
        item: {
          label: entry.group.label,
          to: "/library",
          iconName: entry.group.iconName,
          surfaceBadge: "Reader",
        },
      }
    }
    // Filter desktop-only items on mobile
    if (entry.type === "item" && entry.item.desktopOnly) {
      return { type: "divider" } // placeholder, will be filtered
    }
    return entry
  })

  // Remove consecutive dividers created by filtering
  const cleaned = entries.filter((entry, i, arr) => {
    if (entry.type !== "divider") return true
    if (i === 0 || i === arr.length - 1) return false
    return arr[i - 1]?.type !== "divider"
  })

  return { ...config, entries: cleaned }
}
