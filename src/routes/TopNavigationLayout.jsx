import React, { useMemo, useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { adaptUser } from "../auth/adapter";
import { roleLabel } from "../lib/rbac";
import { SkipLink } from "../components/ui/SkipLink";
import ProjectIndicator from "../components/ui/ProjectIndicator";
import ThemeToggle from "../components/ui/ThemeToggle";
import QuickActionsMenu from "../components/ui/QuickActionsMenu";
import Avatar from "../components/ui/Avatar";
import { useSearchCommand } from "../context/SearchCommandContext";
import { Menu, X, ChevronDown, LogOut, Search } from "lucide-react";

const navItems = [
  { to: "/projects", label: "Dashboard" },
  { to: "/shots", label: "Shots" },
  { to: "/planner", label: "Planner" },
  { to: "/products", label: "Products" },
  { to: "/talent", label: "Talent" },
  { to: "/locations", label: "Locations" },
  { to: "/pulls", label: "Pulls" },
  { to: "/tags", label: "Tags" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

const linkBase =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light";

function DesktopNavLinks({ role }) {
  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!role) return false;
        return item.roles.includes(role);
      }),
    [role]
  );

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {visibleNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${linkBase} ${
              isActive
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-indigo-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileNavLinks({ onNavigate, role }) {
  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!role) return false;
        return item.roles.includes(role);
      }),
    [role]
  );

  return (
    <nav className="flex flex-col gap-1 py-2">
      {visibleNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `${linkBase} ${
              isActive
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-indigo-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({ userLabel, navRoleLabel, userEmail, userPhotoUrl, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light md:flex"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Avatar
          name={userLabel}
          email={userEmail}
          photoUrl={userPhotoUrl}
          size="sm"
        />
        <span className="max-w-[120px] truncate">{userLabel}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg animate-fade-in-down">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Avatar
                name={userLabel}
                email={userEmail}
                photoUrl={userPhotoUrl}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={userLabel}>
                  {userLabel}
                </div>
                {userEmail && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={userEmail}>
                    {userEmail}
                  </div>
                )}
                {navRoleLabel && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
                    {navRoleLabel}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopNavigationLayout({ fallbackUser = null, fallbackRole = null }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: authUser, role: ctxRole } = useAuth();
  const { openSearch } = useSearchCommand();

  const derivedUser = useMemo(() => adaptUser(authUser), [authUser]);
  const navUser = derivedUser || fallbackUser || null;
  const rawRole = ctxRole || fallbackRole || null;
  const navRoleLabel = rawRole ? roleLabel(rawRole) : null;

  const closeMobile = () => setMobileOpen(false);
  const toggleMobile = () => setMobileOpen((open) => !open);

  const signOutUser = async () => {
    await signOut(auth);
  };

  const userLabel = navUser?.name || navUser?.displayName || navUser?.email || "Signed in";
  const userEmail = navUser?.email || null;
  const userPhotoUrl = navUser?.photoURL || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SkipLink />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-slate-800/80">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Shot Builder
            </div>
            <DesktopNavLinks role={rawRole} />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <ProjectIndicator />

            {/* Quick Actions Menu */}
            <QuickActionsMenu />

            {/* Search Trigger Button */}
            <button
              onClick={openSearch}
              className="hidden items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light md:flex"
              aria-label="Open search"
              title="Search (Cmd+K)"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs text-slate-500 dark:text-slate-500">Cmd+K</span>
            </button>

            <ThemeToggle />
            <UserMenu
              userLabel={userLabel}
              userEmail={userEmail}
              userPhotoUrl={userPhotoUrl}
              navRoleLabel={navRoleLabel}
              onSignOut={signOutUser}
            />

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobile}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileOpen && (
          <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 md:hidden animate-fade-in-down">
            <div className="mx-auto max-w-[1440px] px-4 py-3">
              <MobileNavLinks onNavigate={closeMobile} role={rawRole} />

              {/* Mobile User Info & Sign Out */}
              <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={userLabel}
                    email={userEmail}
                    photoUrl={userPhotoUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={userLabel}>
                      {userLabel}
                    </div>
                    {userEmail && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={userEmail}>
                        {userEmail}
                      </div>
                    )}
                    {navRoleLabel && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
                        {navRoleLabel}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={signOutUser}
                  className="flex w-full items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8">
        <Outlet key={location.pathname} />
      </main>
    </div>
  );
}
