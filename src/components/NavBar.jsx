// src/components/NavBar.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

/**
 * Navigation bar component. Provides responsive layout: a hamburger menu on
 * small screens and a full navigation bar on larger screens. Highlights the
 * current route by applying the primary colour to the active link.
 */
export default function NavBar({ user }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Determine classes for active vs inactive links. Active links receive
  // primary colour text, while others use a neutral grey. All links get
  // padding and rounded corners for better touch targets.
  const linkClass = (p) =>
    `px-3 py-2 rounded-md text-sm font-medium hover:text-primary hover:bg-primary/10 ${
      pathname.startsWith(p) ? "text-primary" : "text-gray-700"
    }`;

  // Define the primary navigation links. Additional links can be added here.
  const NavLinks = () => (
    <>
      <Link to="/shots" className={linkClass("/shots")}>Shots</Link>
      <Link to="/planner" className={linkClass("/planner")}>Planner</Link>
      <Link to="/projects" className={linkClass("/projects")}>Projects</Link>
      <Link to="/products" className={linkClass("/products")}>Products</Link>
      <Link to="/talent" className={linkClass("/talent")}>Talent</Link>
      <Link to="/locations" className={linkClass("/locations")}>Locations</Link>
      <Link to="/pulls" className={linkClass("/pulls")}>Pulls</Link>
      <Link to="/import-products" className={linkClass("/import-products")}>Import</Link>
    </>
  );

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Left section: brand and mobile toggle */}
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:bg-gray-100 sm:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {/* Hamburger icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Brand / Logo */}
            <Link to="/projects" className="hidden sm:inline-flex items-center text-sm font-semibold text-gray-900">
              Shot Builder
            </Link>
          </div>

          {/* Desktop navigation links */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLinks />
          </div>

          {/* User info & sign-out */}
          <div className="flex items-center gap-2">
            {user && <span className="hidden sm:inline text-sm text-gray-600">{user.displayName || user.email}</span>}
            {user && (
              <button
                onClick={() => signOut(auth)}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
              >
                Sign out
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation menu */}
        {open && (
          <div className="sm:hidden pb-2 flex flex-col gap-1">
            <NavLinks />
          </div>
        )}
      </div>
    </nav>
  );
}
