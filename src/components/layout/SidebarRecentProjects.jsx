import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { useProjects } from '../../hooks/useFirestoreQuery';
import { useAuth } from '../../context/AuthContext';
import { CLIENT_ID } from '../../lib/paths';
import '../../styles/sidebar-animations.css';

/**
 * SidebarRecentProjects
 *
 * Dropdown showing 3 most recent projects for quick navigation.
 * Positioned below the Projects nav item.
 */
export default function SidebarRecentProjects({ isExpanded }) {
  const { clientId } = useAuth();
  const resolvedClientId = clientId || CLIENT_ID;

  const { data: projects = [], isLoading } = useProjects(resolvedClientId);

  // Get 3 most recent non-archived projects, sorted by updatedAt or createdAt
  const recentProjects = useMemo(() => {
    if (!projects.length) return [];

    return [...projects]
      .filter((p) => p.status !== 'archived' && !p.deletedAt)
      .sort((a, b) => {
        const aDate = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return bDate - aDate;
      })
      .slice(0, 3);
  }, [projects]);

  if (!isExpanded) return null;
  if (isLoading) {
    return (
      <div className="sidebar-dropdown px-3 py-2">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-sidebar-hover/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!recentProjects.length) {
    return (
      <div className="sidebar-dropdown px-3 py-2 text-sm text-neutral-500">
        No recent projects
      </div>
    );
  }

  return (
    <div className="sidebar-dropdown space-y-1 pl-4 mt-1">
      {recentProjects.map((project) => (
        <Link
          key={project.id}
          to={`/projects/${project.id}/dashboard`}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-sidebar-hover hover:text-white transition-colors duration-150 text-left"
        >
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate">{project.name || 'Untitled Project'}</span>
        </Link>
      ))}
    </div>
  );
}
