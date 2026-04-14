import { Home } from "lucide-react";

/**
 * Route-to-label mapping for breadcrumbs
 */
const ROUTE_LABELS = {
  "/projects": "Dashboard",
  "/shots": "Shots",
  "/planner": "Planner",
  "/products": "Products",
  "/pulls": "Pulls",
  "/admin": "Admin",
  "/import-products": "Import Products",
  "/dev/image-diagnostics": "Image Diagnostics",
  "/account": "Account settings",
};

/**
 * Get page label from pathname
 * @param {string} pathname - Current pathname
 * @returns {string|null} Page label or null if not found
 */
function getPageLabel(pathname) {
  if (/^\/projects\/[^/]+\/dashboard$/.test(pathname)) return "Project Dashboard";
  if (/^\/projects\/[^/]+\/shots$/.test(pathname)) return "Shots";
  if (/^\/projects\/[^/]+\/assets$/.test(pathname)) return "Assets";
  if (/^\/projects\/[^/]+\/callsheet$/.test(pathname)) return "Call Sheet";
  if (/^\/projects\/[^/]+\/schedule$/.test(pathname)) return "Call Sheet";
  if (/^\/projects\/[^/]+\/settings$/.test(pathname)) return "Project Settings";
  if (/^\/projects\/[^/]+\/departments$/.test(pathname)) return "Departments";
  if (/^\/projects\/[^/]+\/catalogue\/people\/crew$/.test(pathname)) return "Crew";
  if (/^\/projects\/[^/]+\/catalogue\/people\/talent$/.test(pathname)) return "Talent";
  if (/^\/projects\/[^/]+\/catalogue\/locations$/.test(pathname)) return "Locations";
  return ROUTE_LABELS[pathname] || null;
}

function parseShotsTab(search) {
  if (!search) return "builder";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const view = params.get("view");
  if (view === "schedule" || view === "planner") return "schedule";
  if (view === "assets") return "assets";
  return "builder";
}

/**
 * Generate breadcrumb items for the current route
 *
 * @param {string} pathname - Current pathname from useLocation()
 * @param {Object} context - Additional context for dynamic breadcrumbs
 * @param {string} [context.projectName] - Project name for project-aware pages (e.g., Planner)
 * @param {string} [context.projectId] - Project ID for linking
 * @param {Array} [context.projectMenuItems] - Optional dropdown items for project crumb
 * @param {string} [search] - Current location.search to support tabbed pages
 * @returns {Array<{label: string, href?: string, icon?: React.Component}>} Breadcrumb items
 *
 * @example
 * // Simple page
 * generateBreadcrumbs('/shots', {})
 * // => [{ label: 'Dashboard', href: '/projects', icon: Home }, { label: 'Shots' }]
 *
 * @example
 * // Planner with project
 * generateBreadcrumbs('/planner', { projectName: 'Spring 2024', projectId: 'abc123' })
 * // => [
 * //   { label: 'Dashboard', href: '/projects', icon: Home },
 * //   { label: 'Spring 2024', href: '/projects' },
 * //   { label: 'Planner' }
 * // ]
 */
export function generateBreadcrumbs(pathname, context = {}, search = "") {
  const { projectName, projectId, projectMenuItems } = context;

  // Skip breadcrumbs for dashboard/root level
  if (!pathname || pathname === "/projects" || pathname === "/") return [];

  // Start with Dashboard as home
  const breadcrumbs = [
    {
      label: "Dashboard",
      href: "/projects",
      icon: Home,
    },
  ];

  // Library hierarchy: /library/:section
  if (pathname.startsWith("/library")) {
    const parts = pathname.split("/").filter(Boolean); // ["library", "talent"]
    breadcrumbs.push({ label: "Library", href: "/library/talent" });
    const section = parts[1];
    if (section) {
      const label =
        section === "talent"
          ? "Talent"
          : section === "crew"
            ? "Crew"
            : section === "locations"
              ? "Locations"
              : section === "departments"
                ? "Departments"
                : section === "tags"
                  ? "Tags"
                  : section === "palette"
                    ? "Swatches"
                    : section;
      breadcrumbs.push({ label });
    }
    return breadcrumbs;
  }

  // Project scoped hierarchy: /projects/:projectId/*
  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
  if (projectMatch) {
    const matchedProjectId = projectMatch[1];
    const rest = projectMatch[2] || "";
    const resolvedProjectId = projectId || matchedProjectId;
    const resolvedProjectName = projectName || "Project";

    breadcrumbs.push({ label: "Projects", href: "/projects" });
    breadcrumbs.push({
      label: resolvedProjectName,
      href: resolvedProjectId ? `/projects/${resolvedProjectId}/dashboard` : "/projects",
      menuItems: Array.isArray(projectMenuItems) ? projectMenuItems : undefined,
    });

    // Shots are the main hub for builder/schedule/assets tabs
    if (rest.startsWith("shots")) {
      breadcrumbs.push({ label: "Shots", href: `/projects/${resolvedProjectId}/shots` });
      const tab = parseShotsTab(search);
      breadcrumbs.push({ label: tab === "schedule" ? "Call Sheet" : tab === "assets" ? "Assets" : "Builder" });
      return breadcrumbs;
    }

    if (rest.startsWith("callsheet") || rest.startsWith("schedule")) {
      breadcrumbs.push({ label: "Shots", href: `/projects/${resolvedProjectId}/shots` });
      breadcrumbs.push({ label: "Call Sheet" });
      return breadcrumbs;
    }

    if (rest.startsWith("assets")) {
      breadcrumbs.push({ label: "Shots", href: `/projects/${resolvedProjectId}/shots` });
      breadcrumbs.push({ label: "Assets" });
      return breadcrumbs;
    }

    if (rest.startsWith("dashboard")) {
      breadcrumbs.push({ label: "Project Dashboard" });
      return breadcrumbs;
    }

    if (rest.startsWith("catalogue/people/crew")) {
      breadcrumbs.push({ label: "Catalogue" });
      breadcrumbs.push({ label: "People" });
      breadcrumbs.push({ label: "Crew" });
      return breadcrumbs;
    }

    if (rest.startsWith("catalogue/people/talent")) {
      breadcrumbs.push({ label: "Catalogue" });
      breadcrumbs.push({ label: "People" });
      breadcrumbs.push({ label: "Talent" });
      return breadcrumbs;
    }

    if (rest.startsWith("catalogue/locations")) {
      breadcrumbs.push({ label: "Catalogue" });
      breadcrumbs.push({ label: "Locations" });
      return breadcrumbs;
    }

    if (rest.startsWith("departments")) {
      breadcrumbs.push({ label: "Departments" });
      return breadcrumbs;
    }

    if (rest.startsWith("settings")) {
      breadcrumbs.push({ label: "Project Settings" });
      return breadcrumbs;
    }

    // Fallback: show the mapped label if present
    const pageLabel = getPageLabel(pathname);
    if (pageLabel) {
      breadcrumbs.push({ label: pageLabel });
      return breadcrumbs;
    }

    return breadcrumbs;
  }

  // Everything else: use basic mapping.
  const pageLabel = getPageLabel(pathname);
  if (!pageLabel) return [];
  breadcrumbs.push({ label: pageLabel });
  return breadcrumbs;
}

/**
 * Check if breadcrumbs should be shown for the current pathname
 * @param {string} pathname - Current pathname
 * @returns {boolean} True if breadcrumbs should be shown
 */
export function shouldShowBreadcrumbs(pathname) {
  // Don't show breadcrumbs for:
  // - Login page
  // - Public pull view
  // - Dashboard/Projects (root level)
  const skipPaths = ["/login", "/projects", "/"];

  // Skip if pathname starts with /pulls/shared/ (public pull view)
  if (pathname.startsWith("/pulls/shared/")) {
    return false;
  }

  return !skipPaths.includes(pathname);
}
