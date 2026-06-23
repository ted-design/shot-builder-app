/**
 * Nav configuration — pure data, no React.
 * Provides typed nav items and buildNavConfig() for sidebar/drawer rendering.
 */

import { ROLE } from "@/shared/lib/rbac"

export type NavItemIcon =
  | "layout-grid"
  | "clipboard-check"
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
  | "file-output"
  | "user-check"
  | "link-2"

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

    // PINNED to the GLOBAL claim (5b): this branch only renders on org-scope
    // routes (no projectId, no ProjectScopeProvider), so `role` here is the
    // global claim by construction. Backing rule: /shotRequests read requires a
    // global admin/producer claim (firestore.rules:410-412).
    if (role === ROLE.ADMIN || role === ROLE.PRODUCER) {
      entries.push({
        type: "item",
        item: { label: "Request Centre", to: "/requests", iconName: "clipboard-check" },
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

    // PINNED to the GLOBAL claim (5b): Admin nav is org-scope chrome — the
    // /admin surface reads /users (firestore.rules:539-543) and
    // /pendingInvitations (firestore.rules:547-549), both gated on the global
    // admin claim; a project-level role can never grant or revoke it.
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
        item: { label: "Casting", to: `${prefix}/casting`, iconName: "user-check", surfaceBadge: "Reader" },
      },
      {
        type: "item",
        item: { label: "Call Sheet", to: `${prefix}/callsheet`, iconName: "calendar-days", desktopOnly: true },
      },
      {
        type: "item",
        item: { label: "Export", to: `${prefix}/export`, iconName: "file-output", desktopOnly: true },
      },
      {
        type: "item",
        item: { label: "Tags", to: `${prefix}/tags`, iconName: "tag", desktopOnly: true },
      },
      {
        type: "item",
        item: { label: "Shared Links", to: `${prefix}/links`, iconName: "link-2" },
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
          to: "/library/talent",
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

/**
 * Insert a project-scoped "Shot Reports" item right after "Export". Pure — the
 * featureShotReport check stays at the AppShell call site so buildNavConfig
 * stays flag-free and its unit tests are unaffected.
 */
export function withShotReportsNav(config: NavConfig, projectId: string): NavConfig {
  const item: NavEntry = {
    type: "item",
    item: {
      label: "Shot Reports",
      to: `/projects/${projectId}/export/reports`,
      iconName: "file-output",
      desktopOnly: true,
    },
  }
  const exportTo = `/projects/${projectId}/export`
  const idx = config.entries.findIndex((e) => e.type === "item" && e.item.to === exportTo)
  const entries =
    idx === -1
      ? [...config.entries, item]
      : [...config.entries.slice(0, idx + 1), item, ...config.entries.slice(idx + 1)]
  return { ...config, entries }
}

/**
 * Insert a project-scoped "Product Info" item after Shot Reports (or Export, or
 * appended). Pure — the featureProductInfoReport check stays at the AppShell call
 * site so buildNavConfig stays flag-free and its unit tests are unaffected.
 */
export function withProductInfoReportsNav(config: NavConfig, projectId: string): NavConfig {
  const item: NavEntry = {
    type: "item",
    item: {
      label: "Product Info",
      to: `/projects/${projectId}/export/product-reports`,
      iconName: "package",
      desktopOnly: true,
    },
  }
  const shotReportsTo = `/projects/${projectId}/export/reports`
  const exportTo = `/projects/${projectId}/export`
  const anchor =
    config.entries.findIndex((e) => e.type === "item" && e.item.to === shotReportsTo) !== -1
      ? shotReportsTo
      : exportTo
  const idx = config.entries.findIndex((e) => e.type === "item" && e.item.to === anchor)
  const entries =
    idx === -1
      ? [...config.entries, item]
      : [...config.entries.slice(0, idx + 1), item, ...config.entries.slice(idx + 1)]
  return { ...config, entries }
}
