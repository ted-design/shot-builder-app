import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate, useMatch } from "react-router-dom";
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { useProjectScope } from '../../context/ProjectScopeContext';
import { useProjects } from "../../hooks/useFirestoreQuery";
import { CLIENT_ID } from "../../lib/paths";
import { generateBreadcrumbs, shouldShowBreadcrumbs } from "../../lib/breadcrumbs";
import Sidebar, { MobileSidebar } from './Sidebar';
import SidebarHeader from './SidebarHeader';
import Breadcrumb from '../ui/Breadcrumb';
import { SkipLink } from '../ui/SkipLink';

const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;

/**
 * SidebarLayoutContent
 *
 * Inner layout that consumes sidebar context.
 * Handles breadcrumbs and main content area.
 */
function SidebarLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const { clientId } = useAuth();
  const { currentProjectId, setCurrentProjectId } = useProjectScope();

  // Extract projectId from route to make breadcrumbs route-authoritative
  const projectMatch = useMatch("/projects/:projectId/*");
  const routeProjectId = projectMatch?.params?.projectId;
  const effectiveProjectId = routeProjectId ?? currentProjectId;

  const sidebarWidth = isExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const resolvedClientId = clientId || CLIENT_ID;
  const { data: projects = [] } = useProjects(resolvedClientId, {
    enabled: Boolean(resolvedClientId),
  });

  const currentProject = useMemo(() => {
    if (!effectiveProjectId) return null;
    return projects.find((project) => project.id === effectiveProjectId) || null;
  }, [projects, effectiveProjectId]);

  const projectMenuItems = useMemo(() => {
    if (!currentProjectId || !projects.length) return undefined;
    const recent = [...projects]
      .filter((p) => p && p.id && !p.deletedAt && p.status !== "archived")
      .slice(0, 10);

    return [
      { label: "All Projects", href: "/projects" },
      { type: "separator" },
      ...recent.map((project) => ({
        label: project.name || "Untitled Project",
        onSelect: () => {
          setCurrentProjectId(project.id);
          navigate(`/projects/${project.id}/dashboard`);
        },
      })),
    ];
  }, [currentProjectId, projects, navigate, setCurrentProjectId]);

  // Generate breadcrumbs (route-authoritative when projectId is in URL)
  const breadcrumbItems = useMemo(() => {
    const context = effectiveProjectId
      ? {
          projectName: currentProject?.name || "Project",
          projectId: effectiveProjectId,
          projectMenuItems,
        }
      : {};
    return generateBreadcrumbs(location.pathname, context, location.search);
  }, [location.pathname, location.search, effectiveProjectId, currentProject, projectMenuItems]);

  const showBreadcrumbs = shouldShowBreadcrumbs(location.pathname);

  // Full-bleed routes don't get max-width constraint (e.g., catalogue pages with secondary sidebars, schedule builder)
  const isProjectScheduleBuilder =
    location.pathname.startsWith('/projects/') && location.pathname.endsWith('/schedule');
  const isFullBleedRoute = location.pathname.includes('/catalogue') || isProjectScheduleBuilder;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-900">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <MobileSidebar />
      </div>

      {/* Main content area */}
      <div
        className="flex flex-1 flex-col transition-all duration-sidebar ease-sidebar md:ml-[var(--sidebar-width)]"
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <SkipLink />
        <SidebarHeader />

        {/* Breadcrumbs */}
        {showBreadcrumbs && breadcrumbItems.length > 0 && (
          <div
            className="sticky top-16 z-20 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-6 py-3"
          >
            <Breadcrumb items={breadcrumbItems} />
          </div>
        )}

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
        >
          <div className={isFullBleedRoute ? 'h-full' : 'max-w-[1440px] mx-auto px-4 py-6 md:px-8'}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * SidebarLayout
 *
 * Main layout wrapper that replaces TopNavigationLayout.
 * Wraps content with SidebarProvider.
 */
export default function SidebarLayout({ fallbackUser = null, fallbackRole = null }) {
  return (
    <SidebarProvider>
      <SidebarLayoutContent />
    </SidebarProvider>
  );
}
