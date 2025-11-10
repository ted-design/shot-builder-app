import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { adaptUser } from "../auth/adapter";
import { roleLabel } from "../lib/rbac";
import { SkipLink } from "../components/ui/SkipLink";
import ProjectIndicator from "../components/ui/ProjectIndicator";
import ThemeToggle from "../components/ui/ThemeToggle";
import { BrandLockup } from "../components/common/BrandLockup";

const navItems = [
  { to: "/projects", label: "Dashboard" },
  { to: "/shots", label: "Shots", requiresProject: true },
  { to: "/products", label: "Products" },
  { to: "/talent", label: "Talent" },
  { to: "/locations", label: "Locations" },
  { to: "/pulls", label: "Pulls" },
  { to: "/tags", label: "Tags" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

const linkBase =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light";

function SidebarLinks({ onNavigate, role, currentProjectId }) {
  return (
    <nav className="mt-6 space-y-1">
      {navItems
        .filter((item) => {
          if (!item.roles || item.roles.length === 0) return true;
          if (!role) return false;
          return item.roles.includes(role);
        })
        .map((item) => {
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
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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

export default function SidebarLayout({ fallbackUser = null, fallbackRole = null }) {
  // Updated with BrandLockup component
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: authUser, role: ctxRole } = useAuth();
  const { currentProjectId } = useProjectScope();

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SkipLink />
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-6 md:flex">
          <BrandLockup size="md" />
          <SidebarLinks role={rawRole} currentProjectId={currentProjectId} />
          <div className="mt-auto space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="truncate" title={userLabel}>
              {userLabel}
            </div>
            {navRoleLabel && (
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{navRoleLabel}</div>
            )}
            <button
              onClick={signOutUser}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/60 transition-opacity md:hidden ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeMobile}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-60 transform bg-white dark:bg-slate-800 px-4 py-6 shadow-md transition md:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <BrandLockup size="sm" />
            <button
              onClick={toggleMobile}
              className="rounded-md p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarLinks onNavigate={closeMobile} role={rawRole} currentProjectId={currentProjectId} />
          <div className="mt-auto space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="truncate" title={userLabel}>
              {userLabel}
            </div>
            {navRoleLabel && (
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{navRoleLabel}</div>
            )}
            <button
              onClick={signOutUser}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMobile}
                className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden"
                aria-label="Open navigation"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Menu
              </button>
              <BrandLockup size="sm" />
            </div>
            <div className="flex items-center gap-4">
              <ProjectIndicator />
              <ThemeToggle />
              <div className="hidden text-sm text-slate-600 dark:text-slate-400 md:block">{userLabel}</div>
            </div>
          </header>
          <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <Outlet key={location.pathname} />
          </main>
        </div>
      </div>
    </div>
  );
}
