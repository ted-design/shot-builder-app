import React, { useState } from 'react';
import { PanelLeft, Search, Moon, Sun, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useSidebar } from '../../context/SidebarContext';
import { useSearchCommand } from '../../context/SearchCommandContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { auth } from '../../lib/firebase';
import { BrandLockup } from '../common/BrandLockup';
import NotificationBell from '../ui/NotificationBell';
import Avatar from '../ui/Avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/**
 * SidebarHeader
 *
 * Top header with brand lockup, sidebar toggle, and utility actions.
 */
export default function SidebarHeader() {
  const { isExpanded, toggle, openMobile } = useSidebar();
  const { openSearch, isOpen: isSearchOpen } = useSearchCommand();
  const { user, role } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchFocused, setSearchFocused] = useState(false);
  const userLabel = user?.displayName || user?.email || 'User';
  const userEmail = user?.email || '';
  const isSearchExpanded = searchFocused || isSearchOpen;

  // Capitalize first letter for display
  const formatTheme = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  const handleSearchFocus = () => {
    setSearchFocused(true);
    openSearch();
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-6">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Sidebar toggle - desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="hidden md:flex h-9 w-9 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openMobile}
            className="md:hidden h-9 w-9 text-neutral-600 dark:text-neutral-400"
            aria-label="Open menu"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          {/* Brand lockup */}
          <BrandLockup size="sm" />

          {/* Search input (opens command palette) */}
          <div
            className={`sb-top-search hidden md:flex items-center gap-2 rounded-button border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 ${
              isSearchExpanded ? 'sb-top-search-expanded w-80' : 'sb-top-search-collapsed w-48'
            }`}
          >
            <Search className="h-4 w-4" />
            <input
              type="text"
              readOnly
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onClick={openSearch}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-neutral-600 placeholder:text-neutral-500 focus:outline-none dark:text-neutral-200 dark:placeholder:text-neutral-500"
              aria-label="Search"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search icon for small screens */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openSearch}
            className="md:hidden h-9 w-9 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                aria-label="Open user menu"
              >
                <Avatar
                  name={userLabel}
                  email={userEmail}
                  photoUrl={user?.photoURL}
                  size="sm"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              {/* User header with avatar */}
              <div className="flex items-center gap-3 p-4 pb-3">
                <Avatar
                  name={userLabel}
                  email={userEmail}
                  photoUrl={user?.photoURL}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {userLabel}
                  </div>
                  {userEmail && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {userEmail}
                    </div>
                  )}
                  {role && (
                    <div className="mt-1 text-2xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {role}
                    </div>
                  )}
                </div>
              </div>

              {/* Theme selector */}
              <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <Moon className="h-4 w-4" />
                    <span>Theme</span>
                  </div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    {formatTheme(theme)} · {resolvedTheme}
                  </span>
                </div>
                <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      theme === 'system'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    System
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      theme === 'light'
                        ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      theme === 'dark'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Dark
                  </button>
                </div>
              </div>

              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem onClick={() => navigate('/account')} className="px-4 py-2.5">
                <User className="mr-2 h-4 w-4" />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem onClick={handleSignOut} className="px-4 py-2.5">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
