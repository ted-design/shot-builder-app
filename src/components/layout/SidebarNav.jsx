import React, { useMemo } from "react";
import { useMatch } from "react-router-dom";
import {
  Package,
  Library,
  Settings,
  Users,
  User,
  MapPin,
  Tag,
  Palette,
  Camera,
  Calendar,
  Briefcase,
  ArrowLeft,
  LayoutGrid,
  LayoutDashboard,
  Wrench,
  Star,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE } from '../../lib/rbac';
import SidebarNavItem from './SidebarNavItem';
import SidebarNavGroup from './SidebarNavGroup';

/**
 * SidebarNav
 *
 * Main navigation container for the sidebar.
 * Handles org-level and project-level navigation with role-based visibility.
 */
export default function SidebarNav({ isExpanded }) {
  const { role } = useAuth();
  const projectMatch = useMatch("/projects/:projectId/*");
  const currentProjectId = projectMatch?.params?.projectId || null;

  const userRole = role || ROLE.VIEWER;
  const canManageProjectRoles = userRole === ROLE.ADMIN || userRole === ROLE.PRODUCER;

  const isInProjectContext = Boolean(projectMatch && currentProjectId);

  // Library submenu items
  const libraryItems = useMemo(
    () => [
      { to: "/library/talent", label: "Talent", icon: Users },
      { to: "/library/crew", label: "Crew", icon: User },
      { to: "/library/locations", label: "Locations", icon: MapPin },
      { to: "/library/departments", label: "Departments", icon: Briefcase },
      { to: "/library/tags", label: "Tags", icon: Tag },
      { to: "/library/palette", label: "Swatches", icon: Palette },
    ],
    []
  );

  const allPeopleItems = useMemo(() => {
    if (!isInProjectContext || !currentProjectId) return [];
    return [
      { to: `/projects/${currentProjectId}/catalogue/people/crew`, label: "Crew", icon: Wrench },
      { to: `/projects/${currentProjectId}/catalogue/people/talent`, label: "Talent", icon: Star },
    ];
  }, [currentProjectId, isInProjectContext]);

  return (
    <nav className="flex-1 py-4 px-3 overflow-y-auto">
      <div
        key={isInProjectContext ? `project-${currentProjectId}` : "org"}
        className="space-y-1 animate-fade-in"
      >
        {!isInProjectContext ? (
          <>
            <SidebarNavItem
              to="/projects"
              end={true}
              icon={LayoutGrid}
              label="All Projects"
              isExpanded={isExpanded}
            />

            <SidebarNavItem
              to="/products"
              icon={Package}
              label="Products"
              isExpanded={isExpanded}
            />

            <SidebarNavGroup
              icon={Library}
              label="Library"
              items={libraryItems}
              isExpanded={isExpanded}
            />

            <SidebarNavItem
              to="/account"
              icon={Settings}
              label="Settings"
              isExpanded={isExpanded}
            />

            {userRole === ROLE.ADMIN && (
              <SidebarNavItem
                to="/admin"
                icon={Shield}
                label="Admin"
                isExpanded={isExpanded}
              />
            )}
          </>
        ) : (
          <>
            <SidebarNavItem
              to="/projects"
              end={true}
              icon={ArrowLeft}
              label="All Projects"
              isExpanded={isExpanded}
              variant="back"
            />

            <SidebarNavItem
              to={`/projects/${currentProjectId}/dashboard`}
              icon={LayoutDashboard}
              label="Dashboard"
              isExpanded={isExpanded}
            />

            <SidebarNavItem
              to={`/projects/${currentProjectId}/shots`}
              icon={Camera}
              label="Shots"
              isExpanded={isExpanded}
            />

            <SidebarNavItem
              to={`/projects/${currentProjectId}/schedule`}
              icon={Calendar}
              label="Schedule"
              isExpanded={isExpanded}
            />

            <SidebarNavGroup
              icon={Users}
              label="All People"
              items={allPeopleItems}
              isExpanded={isExpanded}
            />

            <SidebarNavItem
              to={`/projects/${currentProjectId}/catalogue/locations`}
              icon={MapPin}
              label="Locations"
              isExpanded={isExpanded}
            />

            {canManageProjectRoles ? (
              <SidebarNavItem
                to={`/projects/${currentProjectId}/departments`}
                icon={Briefcase}
                label="Departments"
                isExpanded={isExpanded}
              />
            ) : null}

            <SidebarNavItem
              to={`/projects/${currentProjectId}/settings`}
              icon={Settings}
              label="Settings"
              isExpanded={isExpanded}
            />
          </>
        )}
      </div>
    </nav>
  );
}
