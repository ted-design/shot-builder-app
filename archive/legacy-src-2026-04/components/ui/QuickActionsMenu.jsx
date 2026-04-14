/**
 * QuickActionsMenu - Quick access dropdown for common actions and shortcuts
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useProjectScope } from "../../context/ProjectScopeContext";
import { toast } from "../../lib/toast";
import {
  Zap,
  Camera,
  FolderOpen,
  Package,
  User,
  MapPin,
  Tags,
  FileText,
  Calendar,
  Image,
  Palette,
  Settings,
} from "lucide-react";

const quickActionGroups = [
  {
    id: "project",
    label: "Current Project",
    items: [
      {
        id: "shots",
        label: "Shots",
        description: "Shot builder",
        icon: Camera,
        projectScoped: true,
        path: "/shots",
        color: "text-blue-600 dark:text-blue-400",
      },
      {
        id: "assets",
        label: "Assets",
        description: "Project uploads",
        icon: Image,
        projectScoped: true,
        path: "/assets",
        color: "text-indigo-600 dark:text-indigo-400",
      },
      {
        id: "callsheet",
        label: "Call Sheet",
        description: "Call sheet & schedule",
        icon: Calendar,
        projectScoped: true,
        path: "/callsheet",
        color: "text-purple-600 dark:text-purple-400",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "projects",
        label: "Dashboard",
        description: "Projects overview",
        icon: FolderOpen,
        path: "/projects",
        color: "text-emerald-600 dark:text-emerald-400",
      },
      {
        id: "products",
        label: "Products",
        description: "Product catalog",
        icon: Package,
        path: "/products",
        color: "text-amber-600 dark:text-amber-400",
      },
      {
        id: "pulls",
        label: "Pulls",
        description: "Pull sheets",
        icon: FileText,
        path: "/pulls",
        color: "text-sky-600 dark:text-sky-400",
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      {
        id: "talent",
        label: "Talent",
        description: "Roster & sizing",
        icon: User,
        path: "/library/talent",
        color: "text-rose-600 dark:text-rose-400",
      },
      {
        id: "locations",
        label: "Locations",
        description: "Shoot locations",
        icon: MapPin,
        path: "/library/locations",
        color: "text-teal-600 dark:text-teal-400",
      },
      {
        id: "tags",
        label: "Tags",
        description: "Tag management",
        icon: Tags,
        path: "/library/tags",
        color: "text-pink-600 dark:text-pink-400",
      },
      {
        id: "palette",
        label: "Palette",
        description: "Color palette",
        icon: Palette,
        path: "/library/palette",
        color: "text-orange-600 dark:text-orange-400",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "admin",
        label: "Settings",
        description: "Admin settings",
        icon: Settings,
        path: "/admin",
        color: "text-slate-600 dark:text-slate-300",
        roles: ["admin"],
      },
    ],
  },
];

export default function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProjectId } = useProjectScope();
  const projectMatch = useMatch("/projects/:projectId/*");
  const routeProjectId = projectMatch?.params?.projectId || null;
  const effectiveProjectId = routeProjectId || currentProjectId;
  const { role } = useAuth();

  // Close menu when clicking outside
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
      // Use pointerdown instead of mousedown for reliable dismissal on touch devices
      document.addEventListener("pointerdown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("pointerdown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const visibleGroups = useMemo(() => {
    const allowRole = (item) => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!role) return false;
      return item.roles.includes(role);
    };

    return quickActionGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(allowRole),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  const resolvePath = (action) => {
    if (action.projectScoped) {
      return effectiveProjectId ? `/projects/${effectiveProjectId}${action.path}` : "/projects";
    }
    return action.path;
  };

  const handleActionClick = (action) => {
    const requiresProject = action.projectScoped;
    const target = resolvePath(action);
    if (requiresProject && !effectiveProjectId) {
      setIsOpen(false);
      toast.info({ title: "Please select a project" });
      navigate(target);
      return;
    }
    setIsOpen(false);
    navigate(target);
  };

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:-translate-y-0.5 hover:shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light md:inline-flex"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Open quick actions"
        title="Quick actions"
      >
        <Zap className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl animate-fade-in-down z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Zap className="h-4 w-4 text-primary" />
              Quick actions
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Jump to a section quickly
            </p>
          </div>

          <div className="p-2 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {visibleGroups.map((group) => (
                <div key={group.id}>
                  <div className="px-2 pb-1 text-xxs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((action) => {
                      const Icon = action.icon;
                      const targetPath = resolvePath(action);
                      const isCurrent = isCurrentPath(targetPath);
                      const disabled = !!action.projectScoped && !currentProjectId;

                      return (
                        <button
                          key={action.id}
                          onClick={() => handleActionClick(action)}
                          disabled={disabled}
                          title={disabled ? "Select a project to access this section" : undefined}
                          className={`flex flex-col items-start gap-2 rounded-md p-3 text-left transition ${
                            disabled
                              ? "opacity-60 cursor-not-allowed"
                              : isCurrent
                              ? "bg-primary/10 dark:bg-primary/20"
                              : "hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                          role="menuitem"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md ${
                              disabled
                                ? "bg-slate-100 dark:bg-slate-700"
                                : isCurrent
                                ? "bg-primary/20 dark:bg-primary/30"
                                : "bg-slate-100 dark:bg-slate-700"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 ${
                                disabled
                                  ? "text-slate-400 dark:text-slate-500"
                                  : isCurrent
                                  ? "text-primary dark:text-indigo-400"
                                  : action.color
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-sm font-medium ${
                                disabled
                                  ? "text-slate-500 dark:text-slate-400"
                                  : isCurrent
                                  ? "text-primary dark:text-indigo-400"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {action.label}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {disabled ? "Select a project first" : action.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-center text-slate-500 dark:text-slate-400">
              Or use <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">Cmd+K</kbd> to search
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
