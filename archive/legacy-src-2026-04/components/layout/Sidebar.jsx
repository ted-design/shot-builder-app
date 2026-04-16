import React, { useRef, useCallback, useEffect } from 'react';
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

// Hover timing configuration (ms)
const HOVER_OPEN_DELAY = 160;   // Delay before expanding on hover
const HOVER_CLOSE_DELAY = 140;  // Delay before collapsing on leave
const MIN_OPEN_DURATION = 300;  // Minimum time sidebar stays open

/**
 * Sidebar
 *
 * Main collapsible sidebar component with navigation and user info.
 * Features smooth animations with motion blur effect on collapse/expand.
 * Hover expansion uses intentional delays to prevent janky flyover behavior.
 */
export default function Sidebar() {
  const { isCollapsed, isHovering, setIsHovering, isExpanded } = useSidebar();
  const { user } = useAuth();

  // Refs for timer management
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openedAtRef = useRef(null);

  const currentWidth = isExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  // Clear all pending timers
  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleMouseEnter = useCallback(() => {
    if (!isCollapsed) return;

    // Cancel any pending close
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    // Already hovering, no-op
    if (isHovering) return;

    // Schedule open after delay
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      openedAtRef.current = Date.now();
      setIsHovering(true);
    }, HOVER_OPEN_DELAY);
  }, [isCollapsed, isHovering, setIsHovering]);

  const handleMouseLeave = useCallback(() => {
    // Cancel any pending open
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    // Not hovering, no-op
    if (!isHovering) return;

    // Calculate remaining min-open time
    const elapsed = openedAtRef.current ? Date.now() - openedAtRef.current : MIN_OPEN_DURATION;
    const remainingMinOpen = Math.max(0, MIN_OPEN_DURATION - elapsed);
    const closeDelay = Math.max(HOVER_CLOSE_DELAY, remainingMinOpen);

    // Schedule close after delay
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      openedAtRef.current = null;
      setIsHovering(false);
    }, closeDelay);
  }, [isHovering, setIsHovering]);

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
