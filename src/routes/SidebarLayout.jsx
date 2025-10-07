import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { adaptUser } from "../auth/adapter";
import { roleLabel } from "../lib/rbac";
import { SkipLink } from "../components/ui/SkipLink";

const navItems = [
  { to: "/projects", label: "Dashboard" },
  { to: "/shots", label: "Shots" },
  { to: "/planner", label: "Planner" },
  { to: "/products", label: "Products" },
  { to: "/talent", label: "Talent" },
  { to: "/locations", label: "Locations" },
  { to: "/pulls", label: "Pulls" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

const linkBase =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80";

function SidebarLinks({ onNavigate, role }) {
  return (
    <nav className="mt-6 space-y-1">
      {navItems
        .filter((item) => {
          if (!item.roles || item.roles.length === 0) return true;
          if (!role) return false;
          return item.roles.includes(role);
        })
        .map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `${linkBase} ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`
          }
        >
          {item.label}
        </NavLink>
        ))}
    </nav>
  );
}

export default function SidebarLayout({ fallbackUser = null, fallbackRole = null }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: authUser, role: ctxRole } = useAuth();

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
    <div className="min-h-screen bg-slate-50">
      <SkipLink />
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
          <div className="text-sm font-semibold text-slate-900">Shot Builder</div>
          <SidebarLinks role={rawRole} />
          <div className="mt-auto space-y-2 text-sm text-slate-600">
            <div className="truncate" title={userLabel}>
              {userLabel}
            </div>
            {navRoleLabel && (
              <div className="text-xs uppercase tracking-wide text-slate-500">{navRoleLabel}</div>
            )}
            <button
              onClick={signOutUser}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeMobile}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-60 transform bg-white px-4 py-6 shadow-md transition md:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Shot Builder</div>
            <button
              onClick={toggleMobile}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarLinks onNavigate={closeMobile} role={rawRole} />
          <div className="mt-auto space-y-2 text-sm text-slate-600">
            <div className="truncate" title={userLabel}>
              {userLabel}
            </div>
            {navRoleLabel && (
              <div className="text-xs uppercase tracking-wide text-slate-500">{navRoleLabel}</div>
            )}
            <button
              onClick={signOutUser}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:justify-end">
            <button
              onClick={toggleMobile}
              className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 md:hidden"
              aria-label="Open navigation"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
            <div className="hidden text-sm text-slate-600 md:block">{userLabel}</div>
          </header>
          <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <Outlet key={location.pathname} />
          </main>
        </div>
      </div>
    </div>
  );
}
