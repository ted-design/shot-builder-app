/**
 * QuickActionsMenu - Quick access dropdown for common actions and shortcuts
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Zap,
  Camera,
  FolderOpen,
  Package,
  User,
  MapPin,
  LayoutGrid,
  Tags,
  FileText,
  Settings,
  ChevronDown
} from 'lucide-react';

const quickActions = [
  {
    id: 'shots',
    label: 'Shots',
    description: 'View and manage shots',
    icon: Camera,
    path: '/shots',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'planner',
    label: 'Planner',
    description: 'Organize shot sequences',
    icon: LayoutGrid,
    path: '/planner',
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'Manage projects',
    icon: FolderOpen,
    path: '/projects',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'products',
    label: 'Products',
    description: 'Product catalog',
    icon: Package,
    path: '/products',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'talent',
    label: 'Talent',
    description: 'Manage talent roster',
    icon: User,
    path: '/talent',
    color: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 'locations',
    label: 'Locations',
    description: 'Shoot locations',
    icon: MapPin,
    path: '/locations',
    color: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'pulls',
    label: 'Pulls',
    description: 'Product pulls',
    icon: FileText,
    path: '/pulls',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'tags',
    label: 'Tags',
    description: 'Tag management',
    icon: Tags,
    path: '/tags',
    color: 'text-pink-600 dark:text-pink-400',
  },
];

export default function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleActionClick = (action) => {
    setIsOpen(false);
    navigate(action.path);
  };

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light md:flex"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Quick actions menu"
        title="Quick actions"
      >
        <Zap className="h-4 w-4" />
        <span>Quick Actions</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl animate-fade-in-down z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Zap className="h-4 w-4 text-primary" />
              Quick Actions
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Jump to any section quickly
            </p>
          </div>

          <div className="p-2 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const isCurrent = isCurrentPath(action.path);

                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className={`flex flex-col items-start gap-2 rounded-md p-3 text-left transition ${
                      isCurrent
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    role="menuitem"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                      isCurrent ? 'bg-primary/20 dark:bg-primary/30' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      <Icon className={`h-4 w-4 ${isCurrent ? 'text-primary dark:text-indigo-400' : action.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${
                        isCurrent ? 'text-primary dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {action.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {action.description}
                      </div>
                    </div>
                  </button>
                );
              })}
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
