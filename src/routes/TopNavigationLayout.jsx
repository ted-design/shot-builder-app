import React, { useMemo, useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { adaptUser } from "../auth/adapter";
import { roleLabel } from "../lib/rbac";
import { projectPath } from "../lib/paths";
import { SkipLink } from "../components/ui/SkipLink";
import ProjectIndicator from "../components/ui/ProjectIndicator";
import QuickActionsMenu from "../components/ui/QuickActionsMenu";
import Avatar from "../components/ui/Avatar";
import Breadcrumb from "../components/ui/Breadcrumb";
import NotificationBell from "../components/ui/NotificationBell";
import { useSearchCommand } from "../context/SearchCommandContext";
import { useTheme } from "../context/ThemeContext";
import { generateBreadcrumbs, shouldShowBreadcrumbs } from "../lib/breadcrumbs";
import { Menu, ChevronDown, LogOut, Search, Sun, Moon, Monitor, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { BrandLockup } from "../components/common/BrandLockup";

const navItems = [
  { to: "/projects", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/library/talent", label: "Library" },
  { to: "/admin", label: "Settings", roles: ["admin"] },
];

const themeOptions = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const linkBase =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light";

function DesktopNavLinks({ role, currentProjectId }) {
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
      {visibleNavItems.map((item) => {
        const disabled = item.requiresProject && !currentProjectId;
        if (disabled) {
          return (
            <span
              key={item.to}
              aria-disabled="true"
              title="Select a project to use Shot Builder"
              className={`${linkBase} cursor-not-allowed text-slate-400 dark:text-slate-500`}
            >
              {item.label}
            </span>
          );
        }
        const to = item.requiresProject ? `/projects/${currentProjectId}/shots` : item.to;
        return (
          <NavLink
            key={item.to}
            to={to}
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
        );
      })}
    </nav>
  );
}

function MobileNavLinks({ onNavigate, role, currentProjectId }) {
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
      {visibleNavItems.map((item) => {
        const disabled = item.requiresProject && !currentProjectId;
        if (disabled) {
          return (
            <span
              key={item.to}
              aria-disabled="true"
              title="Select a project to access Shots"
              className={`${linkBase} cursor-not-allowed text-slate-400 dark:text-slate-500`}
            >
              {item.label}
            </span>
          );
        }
        const to = item.requiresProject ? `/projects/${currentProjectId}/shots` : item.to;
        return (
          <NavLink
            key={item.to}
            to={to}
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
        );
      })}
    </nav>
  );
}

function ThemeSelector({ onSelect }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4" />
          <span>Theme</span>
        </div>
        <span className="capitalize text-[11px] text-slate-500 dark:text-slate-400">
          {resolvedTheme} mode
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {themeOptions.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTheme(value);
                if (onSelect) onSelect(value);
              }}
              className={`flex items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition ${
                isActive
                  ? "border-primary bg-primary/10 text-primary dark:border-indigo-400/60 dark:bg-indigo-400/10 dark:text-indigo-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
              }`}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserMenu({ userLabel, navRoleLabel, userEmail, userPhotoUrl, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { theme, resolvedTheme, setTheme } = useTheme();

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

  const themeOptionLabel = themeOptions.find((option) => option.value === theme)?.label || "Theme";

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
        <div className="absolute right-0 top-full mt-2 w-64 rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg animate-fade-in-down z-50">
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
          <div className="p-3 space-y-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  <span>Theme</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {themeOptionLabel} · {resolvedTheme}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map(({ value, label, icon: Icon }) => {
                  const isActive = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary dark:border-indigo-400/60 dark:bg-indigo-400/10 dark:text-indigo-200"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                      }`}
                      aria-pressed={isActive}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/account");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
            >
              <User className="h-4 w-4" />
              Account settings
            </button>

            <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
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
        </div>
      )}
    </div>
  );
}

export default function TopNavigationLayout({ fallbackUser = null, fallbackRole = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const { user: authUser, role: ctxRole, clientId } = useAuth();
  const { currentProjectId } = useProjectScope();
  const { openSearch } = useSearchCommand();

  const derivedUser = useMemo(() => adaptUser(authUser), [authUser]);
  const navUser = derivedUser || fallbackUser || null;
  const rawRole = ctxRole || fallbackRole || null;
  const navRoleLabel = rawRole ? roleLabel(rawRole) : null;

  const closeMobile = () => setMobileOpen(false);

  const signOutUser = async () => {
    await signOut(auth);
  };

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
        console.error("Error fetching project for breadcrumbs:", error);
        setCurrentProject(null);
      }
    };

    fetchProject();
  }, [currentProjectId, clientId]);

  // Generate breadcrumbs for current page
  const breadcrumbItems = useMemo(() => {
    const context = {
      projectName: currentProject?.name || null,
      projectId: currentProjectId || null,
    };
    return generateBreadcrumbs(location.pathname, context);
  }, [location.pathname, currentProject, currentProjectId]);

  const showBreadcrumbs = shouldShowBreadcrumbs(location.pathname);

  const userLabel = navUser?.name || navUser?.displayName || navUser?.email || "Signed in";
  const userEmail = navUser?.email || null;
  const userPhotoUrl = navUser?.photoURL || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SkipLink />

      {/* Top Navigation Bar - Two Row Layout */}
      <header
        className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-slate-800/80"
        data-app-top-nav
      >
        {/* Row 1: Centered Brand Lockup */}
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-center border-b border-slate-200/50 dark:border-slate-700/50 px-4 md:px-6">
          <BrandLockup size="sm" />
        </div>

        {/* Row 2: Navigation + Actions */}
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-6">
          {/* Left: Desktop Nav */}
          <DesktopNavLinks role={rawRole} currentProjectId={currentProjectId} />

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <ProjectIndicator />

            {/* Quick Actions Menu */}
            <QuickActionsMenu />

            {/* Notifications */}
            <NotificationBell />

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

            <UserMenu
              userLabel={userLabel}
              userEmail={userEmail}
              userPhotoUrl={userPhotoUrl}
              navRoleLabel={navRoleLabel}
              onSignOut={signOutUser}
            />

            {/* Mobile Menu Button - Sheet Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>

              {/* Mobile Navigation Sheet */}
              <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                <div className="flex flex-col gap-4 mt-8">
                  <MobileNavLinks onNavigate={closeMobile} role={rawRole} currentProjectId={currentProjectId} />

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

                    <ThemeSelector onSelect={closeMobile} />

                    <button
                      onClick={() => {
                        closeMobile();
                        navigate("/account");
                      }}
                      className="flex w-full items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
                    >
                      <User className="h-4 w-4" />
                      Account settings
                    </button>

                    <button
                      onClick={signOutUser}
                      className="flex w-full items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Breadcrumb Navigation */}
      {showBreadcrumbs && breadcrumbItems.length > 0 && (
        <div
          className="border-b border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50"
          data-app-breadcrumb
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8">
        <Outlet key={location.pathname} />
      </main>
    </div>
  );
}
