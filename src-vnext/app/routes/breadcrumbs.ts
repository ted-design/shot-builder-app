// Phase 0.3 — declarative breadcrumbs.
//
// Every authenticated route has an entry here. The `useBreadcrumbs` hook
// (see ./useBreadcrumbs.ts) looks up the current pathname + params and
// invokes the matching resolver to produce the crumb trail the PageHeader
// component auto-renders.
//
// Rules:
// - The resolver receives (params, projectName, trailingLabel) — no new
//   Firestore subscriptions. projectName comes from useProjectScope when
//   available; trailingLabel is a per-page override for dynamic entity
//   names (e.g. Shot #47, Product styleName).
// - Return an empty array to suppress breadcrumbs on a route (e.g. the
//   Projects dashboard, which is the root and has no ancestor trail).
// - The final crumb never has a `to`: the current page shouldn't link to
//   itself.

export interface BreadcrumbEntry {
  readonly label: string
  readonly to?: string
}

export interface BreadcrumbContext {
  readonly params: Readonly<Record<string, string | undefined>>
  readonly projectName?: string
  readonly trailingLabel?: string
}

export type BreadcrumbResolver = (
  ctx: BreadcrumbContext,
) => readonly BreadcrumbEntry[]

function projectCrumbs(ctx: BreadcrumbContext): BreadcrumbEntry[] {
  const projectId = ctx.params["id"]
  return [
    { label: "Projects", to: "/projects" },
    {
      label: ctx.projectName ?? "Project",
      to: projectId ? `/projects/${projectId}/shots` : undefined,
    },
  ]
}

function libraryRoot(): BreadcrumbEntry {
  return { label: "Library" }
}

export const breadcrumbsConfig: Record<string, BreadcrumbResolver> = {
  "/projects": () => [],

  "/projects/:id/shots": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/shots/:sid": (ctx) => [
    ...projectCrumbs(ctx),
    { label: "Shots", to: `/projects/${ctx.params["id"]}/shots` },
    { label: ctx.trailingLabel ?? "Shot" },
  ],

  "/projects/:id/pulls": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/pulls/:pid": (ctx) => [
    ...projectCrumbs(ctx),
    { label: "Pulls", to: `/projects/${ctx.params["id"]}/pulls` },
    { label: ctx.trailingLabel ?? "Pull" },
  ],

  "/projects/:id/assets": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/casting": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/tags": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/links": (ctx) => [
    { label: "Projects", to: "/projects" },
    { label: ctx.projectName ?? "Project" },
  ],
  "/projects/:id/callsheet": (ctx) => [
    ...projectCrumbs(ctx),
    { label: "Call Sheet" },
  ],
  "/projects/:id/export": (ctx) => [
    ...projectCrumbs(ctx),
    { label: "Export" },
  ],
  "/projects/:id/schedules/:scheduleId/onset": () => [],

  "/requests": () => [{ label: "Shot Requests" }],

  "/products": () => [{ label: "Products" }],
  "/products/new": () => [
    { label: "Products", to: "/products" },
    { label: "New" },
  ],
  "/products/:fid": (ctx) => [
    { label: "Products", to: "/products" },
    { label: ctx.trailingLabel ?? "Product" },
  ],
  "/products/:fid/edit": (ctx) => [
    { label: "Products", to: "/products" },
    { label: ctx.trailingLabel ?? "Product", to: `/products/${ctx.params["fid"]}` },
    { label: "Edit" },
  ],

  "/library/talent": () => [libraryRoot(), { label: "Talent" }],
  "/library/locations": () => [libraryRoot(), { label: "Locations" }],
  "/library/locations/:locationId": (ctx) => [
    libraryRoot(),
    { label: "Locations", to: "/library/locations" },
    { label: ctx.trailingLabel ?? "Location" },
  ],
  "/library/crew": () => [libraryRoot(), { label: "Crew" }],
  "/library/crew/:crewId": (ctx) => [
    libraryRoot(),
    { label: "Crew", to: "/library/crew" },
    { label: ctx.trailingLabel ?? "Crew Member" },
  ],
  "/library/palette": () => [libraryRoot(), { label: "Palette" }],

  "/admin": () => [{ label: "Admin" }],
}

// Canonical list of every authenticated route pattern that should resolve
// a breadcrumb trail. Kept in sync with routes/index.tsx by a unit test
// that greps the routes source file for <Route path="…"> occurrences.
export const KNOWN_ROUTE_PATTERNS: readonly string[] = Object.keys(
  breadcrumbsConfig,
)
