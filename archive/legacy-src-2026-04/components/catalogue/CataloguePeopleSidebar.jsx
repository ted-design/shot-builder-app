import React from "react";
import { Users, Wrench, Star, Tag } from "lucide-react";

/**
 * CataloguePeopleSidebar
 *
 * Secondary navigation sidebar for the Catalogue People section.
 * Displays filter groups (All People, Crew, Talent) with counts and tags.
 */
export default function CataloguePeopleSidebar({
  selectedGroup = "all",
  onSelectGroup,
  counts = { all: 0, crew: 0, talent: 0 },
}) {
  const groups = [
    { id: "all", label: "All People", icon: Users, count: counts.all },
    { id: "crew", label: "Crew", icon: Wrench, count: counts.crew },
    { id: "talent", label: "Talent", icon: Star, count: counts.talent },
  ];

  return (
    <aside className="w-60 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 flex flex-col h-full">
      <div className="p-4">
        {/* Groups Section */}
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-4">
          GROUPS
        </h3>
        <div className="space-y-1">
          {groups.map((group) => {
            const Icon = group.icon;
            const isSelected = selectedGroup === group.id;

            return (
              <button
                key={group.id}
                onClick={() => onSelectGroup?.(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      isSelected
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                  <span className="font-medium">{group.label}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {group.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tags Section */}
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider mt-8 mb-4">
          TAGS
        </h3>
        <div className="text-sm text-slate-400 dark:text-slate-500 italic px-3">
          Tags added to contacts will appear here
        </div>
      </div>

      {/* Footer / Upgrade CTA (optional) */}
      <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            Pro tip: Use tags to organize your contacts
          </p>
        </div>
      </div>
    </aside>
  );
}
