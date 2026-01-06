import React from 'react';
import { signOut } from 'firebase/auth';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import SidebarNav from './SidebarNav';
import SidebarProjectHeader from "./SidebarProjectHeader";
import Avatar from '../ui/Avatar';
import { LogOut } from 'lucide-react';
import '../../styles/sidebar-animations.css';

const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;

/**
 * Sidebar
 *
 * Main collapsible sidebar component with navigation and user info.
 * Features smooth animations with motion blur effect on collapse/expand.
 */
export default function Sidebar() {
  const { isCollapsed, isHovering, setIsHovering, isExpanded } = useSidebar();
  const { user } = useAuth();

  const currentWidth = isExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border sidebar-transition overflow-x-hidden"
      style={{ width: currentWidth }}
      onMouseEnter={() => isCollapsed && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <SidebarProjectHeader isExpanded={isExpanded} />

      {/* Navigation */}
      <SidebarNav isExpanded={isExpanded} />

      {/* User section */}
      <div className="mt-auto border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-3 rounded-md px-2 py-2 ${isExpanded ? '' : 'justify-center'}`}>
          <Avatar
            name={user?.displayName || user?.email || 'User'}
            email={user?.email}
            photoUrl={user?.photoURL}
            size="sm"
            className="shrink-0"
          />
          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {user?.email}
              </p>
            </div>
          )}
          {isExpanded && (
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-sidebar-hover transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * MobileSidebar
 *
 * Mobile overlay version of the sidebar.
 * Slides in from the left with a backdrop.
 */
export function MobileSidebar() {
  const { isMobileOpen, closeMobile } = useSidebar();
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      closeMobile();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 sidebar-backdrop ${
          isMobileOpen ? 'sidebar-backdrop-visible' : 'sidebar-backdrop-hidden'
        }`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border sidebar-mobile ${
          isMobileOpen ? 'sidebar-mobile-open' : 'sidebar-mobile-closed'
        } overflow-x-hidden`}
      >
        <SidebarProjectHeader isExpanded={true} />

        {/* Navigation - always expanded on mobile */}
        <SidebarNav isExpanded={true} />

        {/* User section */}
        <div className="mt-auto border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <Avatar
              name={user?.displayName || user?.email || 'User'}
              email={user?.email}
              photoUrl={user?.photoURL}
              size="sm"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-sidebar-hover transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
