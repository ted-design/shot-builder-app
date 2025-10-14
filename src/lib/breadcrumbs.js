import { Home } from 'lucide-react';

/**
 * Route-to-label mapping for breadcrumbs
 */
const ROUTE_LABELS = {
  '/projects': 'Dashboard',
  '/shots': 'Shots',
  '/planner': 'Planner',
  '/products': 'Products',
  '/talent': 'Talent',
  '/locations': 'Locations',
  '/pulls': 'Pulls',
  '/tags': 'Tags',
  '/admin': 'Admin',
  '/import-products': 'Import Products',
  '/dev/image-diagnostics': 'Image Diagnostics',
};

/**
 * Get page label from pathname
 * @param {string} pathname - Current pathname
 * @returns {string|null} Page label or null if not found
 */
function getPageLabel(pathname) {
  return ROUTE_LABELS[pathname] || null;
}

/**
 * Generate breadcrumb items for the current route
 *
 * @param {string} pathname - Current pathname from useLocation()
 * @param {Object} context - Additional context for dynamic breadcrumbs
 * @param {string} [context.projectName] - Project name for project-aware pages (e.g., Planner)
 * @param {string} [context.projectId] - Project ID for linking
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
export function generateBreadcrumbs(pathname, context = {}) {
  const { projectName, projectId } = context;
  const pageLabel = getPageLabel(pathname);

  // Skip breadcrumbs for unknown routes or dashboard (root level)
  if (!pageLabel || pathname === '/projects') {
    return [];
  }

  // Start with Dashboard as home
  const breadcrumbs = [
    {
      label: 'Dashboard',
      href: '/projects',
      icon: Home,
    },
  ];

  // Special handling for Planner page with project context
  if (pathname === '/planner' && projectName) {
    breadcrumbs.push({
      label: projectName,
      href: '/projects', // Link back to projects list
    });
  }

  // Add current page (non-clickable)
  breadcrumbs.push({
    label: pageLabel,
  });

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
  const skipPaths = ['/login', '/projects', '/'];

  // Skip if pathname starts with /pulls/shared/ (public pull view)
  if (pathname.startsWith('/pulls/shared/')) {
    return false;
  }

  return !skipPaths.includes(pathname);
}
