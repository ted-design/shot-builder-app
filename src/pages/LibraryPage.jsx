/**
 * LibraryPage — Layout Shell for Library Domain Routes
 *
 * R.18 Update: Profiles deprecated. /library now redirects to /library/talent.
 * This shell provides header tabs for non-full-workspace Library pages.
 * Full-workspace pages (Talent, Locations, Tags, Palette) handle their own headers.
 *
 * LIBRARY SYSTEM MODEL (R.18):
 * - The Library is a Managed Collection System, not a set of pages
 * - The ONE dominant interaction model is: List + Inspector (or Gallery + Cockpit)
 * - Talent is the canonical "people" browsing surface
 * - Profiles surface is deprecated (redirects to Talent)
 * - Editing NEVER navigates to a new page
 * - There is NO Library Hub
 */

import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";

const tabLinkBase =
  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition";

export default function LibraryPage() {
  const location = useLocation();
  const isActive = (to) => location.pathname.startsWith(to);

  // R.17: Talent page handles its own header (Gallery + Cockpit workspace)
  const isOnTalent = location.pathname.startsWith("/library/talent");
  // R.9: Locations page handles its own header (full-page workspace)
  const isOnLocations = location.pathname.startsWith("/library/locations");
  // R.10: Tags page handles its own header (List + Inspector workspace)
  const isOnTags = location.pathname.startsWith("/library/tags");
  // R.11: Palette page handles its own header (List + Inspector workspace)
  const isOnPalette = location.pathname.startsWith("/library/palette");
  // R.22.2: Crew page handles its own header (List + Inspector workspace)
  const isOnCrew = location.pathname.startsWith("/library/crew");

  // These pages render their own header/shell (full-page workspace pattern)
  if (isOnTalent || isOnLocations || isOnTags || isOnPalette || isOnCrew) {
    return <Outlet />;
  }

  // On other Library domain pages, show the shell with tabs
  return (
    <div className="space-y-6">
      <PageHeader sticky={true} className="top-14 z-40">
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Library</PageHeader.Title>
            <PageHeader.Description>
              Organization-wide assets independent of any single project.
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div
              className="flex items-center space-x-1 rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800"
              role="tablist"
              aria-label="Library tabs"
              aria-orientation="horizontal"
            >
              {/* R.18: Profiles removed, Talent is canonical */}
              {[
                { to: "/library/talent", label: "Talent" },
                { to: "/library/crew", label: "Crew" },
                { to: "/library/locations", label: "Locations" },
                { to: "/library/departments", label: "Departments" },
                { to: "/library/tags", label: "Tags" },
                { to: "/library/palette", label: "Palette" },
              ].map((tab) => {
                const active = isActive(tab.to);
                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={`${tabLinkBase} ${
                      active
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    }`}
                    role="tab"
                    aria-selected={active}
                  >
                    <span>{tab.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      <Outlet />
    </div>
  );
}
