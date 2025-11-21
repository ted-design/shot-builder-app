import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";

const tabLinkBase =
  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition";

export default function LibraryPage() {
  const location = useLocation();
  const isActive = (to) => location.pathname.startsWith(to);

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
              {[
                { to: "/library/talent", label: "Talent" },
                { to: "/library/locations", label: "Locations" },
                { to: "/library/tags", label: "Tags" },
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

