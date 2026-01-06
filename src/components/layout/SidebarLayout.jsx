import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { useProjectScope } from '../../context/ProjectScopeContext';
import { db } from '../../lib/firebase';
import { projectPath } from '../../lib/paths';
import { generateBreadcrumbs, shouldShowBreadcrumbs } from '../../lib/breadcrumbs';
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
  const { isExpanded } = useSidebar();
  const { clientId } = useAuth();
  const { currentProjectId } = useProjectScope();
  const [currentProject, setCurrentProject] = useState(null);

  const sidebarWidth = isExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  // Fetch current project details for breadcrumbs
  useEffect(() => {
    if (!currentProjectId || !clientId) {
      setCurrentProject(null);
      return;
    }

    const fetchProject = async () => {
      try {
        const projectRef = doc(db, ...projectPath(currentProjectId, clientId));
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          setCurrentProject({ id: projectSnap.id, ...projectSnap.data() });
        } else {
          setCurrentProject(null);
        }
      } catch (error) {
        console.error('Failed to fetch project for breadcrumbs:', error);
        setCurrentProject(null);
      }
    };

    fetchProject();
  }, [currentProjectId, clientId]);

  // Generate breadcrumbs
  const breadcrumbItems = useMemo(() => {
    const context = currentProject
      ? { projectName: currentProject.name, projectId: currentProject.id }
      : {};
    return generateBreadcrumbs(location.pathname, context);
  }, [location.pathname, currentProject]);

  const showBreadcrumbs = shouldShowBreadcrumbs(location.pathname);

  // Full-bleed routes don't get max-width constraint (e.g., catalogue pages with secondary sidebars)
  const isFullBleedRoute = location.pathname.includes('/catalogue');

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-900">
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
        className="flex flex-1 flex-col transition-all duration-sidebar ease-sidebar"
        style={{ marginLeft: window.innerWidth >= 768 ? sidebarWidth : 0 }}
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
