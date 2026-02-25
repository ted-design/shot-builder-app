/**
 * DepartmentsPage — Canonical Full-Page Workspace Shell
 *
 * DESIGN PHILOSOPHY (L.5 Delta)
 * =============================
 * This page transforms the Library → Departments view into a workspace-style experience
 * following the Products V3 / Shot Editor V3 / Library L.1-L.4 spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - LEFT: Scannable department rail with search results
 * - RIGHT: Selected department detail canvas showing positions
 *
 * KEY CHANGES FROM LEGACY:
 * 1. Master-detail pattern replaces inline card/form UX
 * 2. Department selection is local state (no URL routing per spec)
 * 3. Designed empty states for both rail and canvas
 * 4. Full-page workspace instead of admin card presentation
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/departments (via useDepartments hook)
 * - Real-time subscription via onSnapshot (handled by hook)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDepartments } from "../hooks/useDepartments";
import { canManageProjects } from "../lib/rbac";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import {
  Briefcase,
  Users,
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Check,
} from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function filterDepartments(departments, searchQuery) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return departments;
  return departments.filter((d) => {
    const name = (d.name || "").toLowerCase();
    const positionNames = (d.positions || [])
      .map((p) => (p.title || "").toLowerCase())
      .join(" ");
    return name.includes(q) || positionNames.includes(q);
  });
}

// ============================================================================
// DEPARTMENT RAIL ITEM
// ============================================================================

function DepartmentRailItem({ department, isSelected, onClick }) {
  const name = (department.name || "Untitled").trim();
  const positionCount = (department.positions || []).length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
        ${isSelected
          ? "bg-slate-100 dark:bg-slate-700 shadow-sm"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon placeholder */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${
            isSelected
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-700 dark:text-slate-300"
          }`}>
            {name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {positionCount} {positionCount === 1 ? "position" : "positions"}
          </p>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// DEPARTMENT RAIL (LEFT PANEL)
// ============================================================================

function DepartmentRail({
  departments,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
      {/* Search header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Department list */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {searchQuery ? "No matches found" : "No departments yet"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchQuery
                ? "Try a different search term"
                : "Create a department to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {departments.map((department) => (
              <DepartmentRailItem
                key={department.id}
                department={department}
                isSelected={selectedId === department.id}
                onClick={() => onSelect(department.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && departments.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xxs text-slate-500 dark:text-slate-400">
            {departments.length} {departments.length === 1 ? "department" : "departments"}
          </p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// DEPARTMENT DETAIL CANVAS (RIGHT PANEL)
// ============================================================================

function DepartmentDetailCanvas({
  department,
  canManage,
  onAddPosition,
  onDeletePosition,
  onDeleteDepartment,
  onUpdateDepartment,
  addPositionPending,
  deletePositionPending,
  deleteDepartmentPending,
  updateDepartmentPending,
}) {
  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // Reset state when department changes
  useEffect(() => {
    setNewPositionTitle("");
    setEditingName(false);
    setEditedName("");
  }, [department?.id]);

  if (!department) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a department
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a department from the list to view its positions, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  const name = (department.name || "Untitled").trim();
  const positions = department.positions || [];

  const handleStartEdit = () => {
    setEditedName(name);
    setEditingName(true);
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setEditedName("");
  };

  const handleSaveEdit = () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      handleCancelEdit();
      return;
    }
    onUpdateDepartment({ departmentId: department.id, updates: { name: trimmed } });
    setEditingName(false);
  };

  const handleAddPosition = (e) => {
    e.preventDefault();
    const title = newPositionTitle.trim();
    if (!title) return;
    onAddPosition({ departmentId: department.id, title });
    setNewPositionTitle("");
  };

  return (
    <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
      <div className="max-w-2xl mx-auto px-8 py-8">
        {/* Hero icon */}
        <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-6 flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>

        {/* Name - editable */}
        <div className="mb-6">
          {editingName ? (
            <div className="flex items-center justify-center gap-2">
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-center text-xl font-semibold max-w-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateDepartmentPending}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 text-center">
                {name}
              </h1>
              {canManage && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Edit department name"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Positions section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Positions ({positions.length})
            </p>
          </div>

          {/* Add position form */}
          {canManage && (
            <form onSubmit={handleAddPosition} className="flex gap-2">
              <Input
                type="text"
                value={newPositionTitle}
                onChange={(e) => setNewPositionTitle(e.target.value)}
                placeholder="New position title..."
                className="flex-1"
                disabled={addPositionPending}
              />
              <Button type="submit" disabled={addPositionPending || !newPositionTitle.trim()}>
                {addPositionPending ? "Adding..." : "Add"}
              </Button>
            </form>
          )}

          {/* Positions list */}
          {positions.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              {positions.map((position) => (
                <li key={position.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-900 dark:text-slate-100">
                    {position.title || "Untitled"}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Delete position "${position.title}"?`)) return;
                        onDeletePosition({ departmentId: department.id, positionId: position.id });
                      }}
                      disabled={deletePositionPending}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label={`Delete ${position.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No positions in this department yet.
              </p>
              {canManage && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Add positions using the form above.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Delete department action */}
        {canManage && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm(`Delete department "${name}" and all its positions?`)) return;
                onDeleteDepartment(department.id);
              }}
              disabled={deleteDepartmentPending}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete department
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================================
// HEADER BAND
// ============================================================================

function DepartmentsHeaderBand({ canManage, onCreateClick, onSeedClick, departmentCount, seedPending }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Title + description */}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Departments
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Organization-wide departments and positions for crew assignments
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {departmentCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {departmentCount} {departmentCount === 1 ? "department" : "departments"}
              </span>
            )}
            {canManage && (
              <>
                <Button variant="outline" onClick={onSeedClick} disabled={seedPending}>
                  {seedPending ? "Seeding..." : "Seed defaults"}
                </Button>
                <Button onClick={onCreateClick} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  New department
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// FULL-PAGE EMPTY STATE
// ============================================================================

function DepartmentsEmptyState({ canManage, onCreateClick, onSeedClick, seedPending }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No departments yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Departments help organize your production crew by role type.
          Create departments like Camera, Lighting, Art Direction, and add
          positions within each.
        </p>
        {canManage ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="outline" onClick={onSeedClick} disabled={seedPending}>
              {seedPending ? "Seeding..." : "Seed defaults"}
            </Button>
            <Button onClick={onCreateClick} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add your first department
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Producers can create and manage departments.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE MODAL
// ============================================================================

function DepartmentCreateModal({ open, busy, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setSaving(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a department name.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onCreate({ name: trimmed });
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to create department.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                New department
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create a new department for organizing crew positions.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="create-dept-name"
              >
                Department name
              </label>
              <Input
                id="create-dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Camera, Lighting, Art Direction"
                disabled={saving || busy}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={saving || busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || busy}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DepartmentsPage() {
  // Auth & permissions
  const { clientId, role: globalRole } = useAuth();
  const canManage = canManageProjects(globalRole);

  // Data hook
  const {
    departments,
    loading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    createPosition,
    deletePosition,
    seedDefaultDepartments,
  } = useDepartments(clientId);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERED DEPARTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  const filteredDepartments = useMemo(() => {
    return filterDepartments(departments, searchQuery);
  }, [departments, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTED DEPARTMENT
  // ══════════════════════════════════════════════════════════════════════════

  const selectedDepartment = useMemo(() => {
    if (!selectedId) return null;
    return departments.find((d) => d.id === selectedId) || null;
  }, [departments, selectedId]);

  // Auto-select first department when data loads and nothing is selected
  useEffect(() => {
    if (!loading && departments.length > 0 && !selectedId) {
      setSelectedId(departments[0].id);
    }
  }, [loading, departments, selectedId]);

  // Clear selection if selected department was deleted
  useEffect(() => {
    if (selectedId && !departments.find((d) => d.id === selectedId)) {
      setSelectedId(departments.length > 0 ? departments[0].id : null);
    }
  }, [departments, selectedId]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleCreateClick = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleCreate = useCallback(async (data) => {
    const result = await createDepartment.mutateAsync(data);
    // Auto-select the newly created department
    if (result?.id) {
      setSelectedId(result.id);
    }
  }, [createDepartment]);

  const handleSeed = useCallback(() => {
    seedDefaultDepartments.mutate();
  }, [seedDefaultDepartments]);

  const handleAddPosition = useCallback(async ({ departmentId, title }) => {
    await createPosition.mutateAsync({ departmentId, title });
  }, [createPosition]);

  const handleDeletePosition = useCallback(async ({ departmentId, positionId }) => {
    await deletePosition.mutateAsync({ departmentId, positionId });
  }, [deletePosition]);

  const handleDeleteDepartment = useCallback(async (departmentId) => {
    await deleteDepartment.mutateAsync(departmentId);
  }, [deleteDepartment]);

  const handleUpdateDepartment = useCallback(async ({ departmentId, updates }) => {
    await updateDepartment.mutateAsync({ departmentId, updates });
  }, [updateDepartment]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && departments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading departments...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Unable to load departments
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {error?.message || "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no departments at all)
  if (!loading && departments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <DepartmentsHeaderBand
          canManage={canManage}
          onCreateClick={handleCreateClick}
          onSeedClick={handleSeed}
          departmentCount={0}
          seedPending={seedDefaultDepartments.isPending}
        />
        <DepartmentsEmptyState
          canManage={canManage}
          onCreateClick={handleCreateClick}
          onSeedClick={handleSeed}
          seedPending={seedDefaultDepartments.isPending}
        />
        {canManage && (
          <DepartmentCreateModal
            open={createModalOpen}
            busy={createDepartment.isPending}
            onClose={() => setCreateModalOpen(false)}
            onCreate={handleCreate}
          />
        )}
      </div>
    );
  }

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <DepartmentsHeaderBand
        canManage={canManage}
        onCreateClick={handleCreateClick}
        onSeedClick={handleSeed}
        departmentCount={departments.length}
        seedPending={seedDefaultDepartments.isPending}
      />

      {/* Workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <DepartmentRail
          departments={filteredDepartments}
          selectedId={selectedId}
          onSelect={setSelectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={false}
        />

        {/* Right canvas */}
        <DepartmentDetailCanvas
          department={selectedDepartment}
          canManage={canManage}
          onAddPosition={handleAddPosition}
          onDeletePosition={handleDeletePosition}
          onDeleteDepartment={handleDeleteDepartment}
          onUpdateDepartment={handleUpdateDepartment}
          addPositionPending={createPosition.isPending}
          deletePositionPending={deletePosition.isPending}
          deleteDepartmentPending={deleteDepartment.isPending}
          updateDepartmentPending={updateDepartment.isPending}
        />
      </div>

      {/* Create modal */}
      {canManage && (
        <DepartmentCreateModal
          open={createModalOpen}
          busy={createDepartment.isPending}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
