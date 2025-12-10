import { useMemo, useState } from "react";
import { Calendar, Folder, Search } from "lucide-react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * ProjectPickerModal - Modal for selecting a project for copy/move operations
 *
 * Displays a searchable list of projects (excluding the current one) with
 * shoot dates for context. Supports single selection with confirm action.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Called when modal closes
 * @param {Array} props.projects - Array of available projects
 * @param {string} props.currentProjectId - Current project ID (excluded from list)
 * @param {Function} props.onSelect - Called with selected project ID when confirmed
 * @param {string} [props.title="Select Project"] - Modal title
 * @param {string} [props.description] - Modal description text
 * @param {string} [props.actionLabel="Select"] - Confirm button label
 * @param {boolean} [props.isLoading=false] - Show loading state on confirm button
 */
export default function ProjectPickerModal({
  open,
  onClose,
  projects = [],
  currentProjectId,
  onSelect,
  title = "Select Project",
  description = "Choose a project to continue.",
  actionLabel = "Select",
  isLoading = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter out current project and apply search
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => p.id !== currentProjectId)
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return p.name?.toLowerCase().includes(query);
      });
  }, [projects, currentProjectId, searchQuery]);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect?.(selectedId);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setSelectedId(null);
    setSearchQuery("");
    onClose?.();
  };

  const formatDates = (dates) => {
    if (!Array.isArray(dates) || dates.length === 0) return null;
    if (dates.length === 1) {
      return new Date(dates[0]).toLocaleDateString();
    }
    // Show range or count for multiple dates
    const sorted = [...dates].sort();
    const first = new Date(sorted[0]).toLocaleDateString();
    const last = new Date(sorted[sorted.length - 1]).toLocaleDateString();
    return `${first} - ${last}`;
  };

  const modalTitleId = "project-picker-title";
  const modalDescId = "project-picker-desc";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      labelledBy={modalTitleId}
      describedBy={description ? modalDescId : undefined}
      contentClassName="p-0 max-w-md"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2
                id={modalTitleId}
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {title}
              </h2>
              {description && (
                <p
                  id={modalDescId}
                  className="text-sm text-slate-500 dark:text-slate-400"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Project list */}
          <div className="max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
            {filteredProjects.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {searchQuery
                  ? "No matching projects found"
                  : "No other projects available"}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredProjects.map((project) => {
                  const isSelected = project.id === selectedId;
                  const dates = formatDates(project.shootDates);
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(project.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3 w-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l7-7a.75.75 0 00-1.06-1.06z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            <span
                              className={`truncate font-medium ${
                                isSelected
                                  ? "text-primary"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {project.name || "Untitled Project"}
                            </span>
                          </div>
                          {dates && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              <span>{dates}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer buttons */}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId || isLoading}
            >
              {isLoading ? "Processing..." : actionLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
