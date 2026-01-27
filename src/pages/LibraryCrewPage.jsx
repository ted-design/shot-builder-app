/**
 * LibraryCrewPage — Canonical Full-Page Workspace Shell
 *
 * DESIGN PHILOSOPHY (L.3 Delta)
 * =============================
 * This page transforms the Library → Crew view into a workspace-style experience
 * following the Products V3 / Shot Editor V3 / Library Locations (L.1) / Library Talent (L.2) spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - LEFT: Scannable crew rail with search results
 * - RIGHT: Selected crew member detail canvas
 *
 * KEY CHANGES FROM LEGACY:
 * 1. Master-detail pattern replaces card/table-first UX with inline form
 * 2. Crew selection is local state (no URL routing per spec)
 * 3. Designed empty states for both rail and canvas
 * 4. Full-page workspace instead of admin table presentation
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/crew (via crewPath)
 * - Real-time subscription via useOrganizationCrew hook
 * - Department/Position lookups via useDepartments hook
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDepartments } from "../hooks/useDepartments";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { canManageProjects } from "../lib/rbac";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import CrewEditModal from "../components/crew/CrewEditModal";
import {
  User,
  Phone,
  Mail,
  FileText,
  Plus,
  Search,
  Building2,
  Briefcase,
} from "lucide-react";
import InlineEditField from "../components/profiles/InlineEditField";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildDisplayName(crewMember) {
  const first = (crewMember.firstName || "").trim();
  const last = (crewMember.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed crew member";
}

function filterCrew(crew, searchQuery) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return crew;
  return crew.filter((m) => {
    const haystack = `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.phone || ""} ${m.company || ""}`
      .trim()
      .toLowerCase();
    return haystack.includes(q);
  });
}

// ============================================================================
// CREW RAIL ITEM
// ============================================================================

function CrewRailItem({ crewMember, isSelected, onClick, deptName, positionName }) {
  const name = buildDisplayName(crewMember);

  // Build secondary line: company, then contact (email preferred over phone for de-dupe)
  // This prioritizes info useful for identifying "is this the same person?"
  const contactInfo = crewMember.email || crewMember.phone || null;
  const secondaryParts = [crewMember.company, contactInfo].filter(Boolean);
  const secondaryLine = secondaryParts.length > 0 ? secondaryParts.join(" • ") : null;

  // Tertiary line: position/dept (lower emphasis)
  const tertiaryLine = [positionName, deptName].filter(Boolean).join(" • ") || null;

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
        {/* Thumbnail placeholder */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <User className="w-5 h-5 text-slate-300 dark:text-slate-500" />
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
          {secondaryLine && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {secondaryLine}
            </p>
          )}
          {tertiaryLine && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {tertiaryLine}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// CREW RAIL (LEFT PANEL)
// ============================================================================

function CrewRail({
  crew,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
  deptNameById,
  positionNameById,
}) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
      {/* Search header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search crew..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Crew list */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : crew.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {searchQuery ? "No matches found" : "No crew yet"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchQuery
                ? "Try a different search term"
                : "Add crew members to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {crew.map((member) => (
              <CrewRailItem
                key={member.id}
                crewMember={member}
                isSelected={selectedId === member.id}
                onClick={() => onSelect(member.id)}
                deptName={member.departmentId ? deptNameById.get(member.departmentId) : null}
                positionName={member.positionId ? positionNameById.get(member.positionId) : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && crew.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {crew.length} {crew.length === 1 ? "crew member" : "crew members"}
          </p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// CREW DETAIL CANVAS (RIGHT PANEL)
// ============================================================================

function CrewDetailCanvas({ crewMember, canManage, onEdit, onUpdateField, deptName, positionName }) {
  if (!crewMember) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a crew member
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a crew member from the list to view their details, or add a new one.
          </p>
        </div>
      </div>
    );
  }

  const name = buildDisplayName(crewMember);
  // Always show fields if canManage (they're editable), otherwise only if populated
  const showCompany = canManage || crewMember.company;
  const showEmail = canManage || crewMember.email;
  const showPhone = canManage || crewMember.phone;
  const showNotes = canManage || crewMember.notes;
  const hasAnyDetails = crewMember.email || crewMember.phone || crewMember.company || deptName || positionName || crewMember.notes;

  // Inline save handler factory
  const handleFieldSave = (fieldName) => async (newValue) => {
    if (!onUpdateField) return;
    await onUpdateField(crewMember.id, { [fieldName]: newValue });
  };

  return (
    <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
      <div className="max-w-2xl mx-auto px-8 py-8">
        {/* Hero avatar - circular for crew (portrait style) */}
        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 mb-6 flex items-center justify-center">
          <User className="w-14 h-14 text-slate-300 dark:text-slate-500" />
        </div>

        {/* Name - centered under portrait */}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2 text-center">
          {name}
        </h1>

        {/* Role subtitle - centered */}
        {(positionName || deptName) && (
          <p className="text-base text-slate-600 dark:text-slate-400 text-center mb-6">
            {[positionName, deptName].filter(Boolean).join(" • ")}
          </p>
        )}

        {!positionName && !deptName && <div className="mb-6" />}

        {/* Details section */}
        <div className="space-y-4">
          {/* Company — inline editable */}
          {showCompany && (
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Company
                </p>
                {canManage ? (
                  <InlineEditField
                    value={crewMember.company || ""}
                    onSave={handleFieldSave("company")}
                    placeholder="Add company"
                    type="text"
                  />
                ) : (
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {crewMember.company}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Department — NOT inline editable (requires picker, use modal) */}
          {deptName && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Department
                </p>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {deptName}
                  {positionName && (
                    <span className="text-slate-500 dark:text-slate-400"> — {positionName}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Email — inline editable */}
          {showEmail && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Email
                </p>
                {canManage ? (
                  <InlineEditField
                    value={crewMember.email || ""}
                    onSave={handleFieldSave("email")}
                    placeholder="Add email"
                    type="email"
                  />
                ) : (
                  <a
                    href={`mailto:${crewMember.email}`}
                    className="text-base text-primary hover:underline"
                  >
                    {crewMember.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Phone — inline editable */}
          {showPhone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Phone
                </p>
                {canManage ? (
                  <InlineEditField
                    value={crewMember.phone || ""}
                    onSave={handleFieldSave("phone")}
                    placeholder="Add phone"
                    type="tel"
                  />
                ) : (
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {crewMember.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes — inline editable (multiline) */}
          {showNotes && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Notes
                </p>
                {canManage ? (
                  <InlineEditField
                    value={crewMember.notes || ""}
                    onSave={handleFieldSave("notes")}
                    placeholder="Add notes"
                    multiline
                    rows={3}
                  />
                ) : (
                  <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {crewMember.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Empty state for no details — only show for viewers (editors see editable fields) */}
        {!canManage && !hasAnyDetails && (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center mt-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No additional details for this crew member.
            </p>
          </div>
        )}

        {/* Actions — full edit modal for fields not inline editable (name, dept/position) */}
        {canManage && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button variant="secondary" onClick={() => onEdit(crewMember)}>
              Edit all details
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

function CrewHeaderBand({ canManage, onCreateClick, crewCount }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Title + description */}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Crew
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track production crew, their roles, and contact details
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {crewCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {crewCount} {crewCount === 1 ? "member" : "members"}
              </span>
            )}
            {canManage && (
              <Button onClick={onCreateClick} className="gap-1.5">
                <Plus className="w-4 h-4" />
                New crew member
              </Button>
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

function CrewEmptyState({ canManage, onCreateClick }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <User className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No crew members yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Crew members help you track the production team for your shoots.
          Add directors, photographers, stylists, and other crew with their
          contact details and roles.
        </p>
        {canManage ? (
          <Button onClick={onCreateClick} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add your first crew member
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Producers can create and manage crew members.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE MODAL (Simple wrapper using existing CrewEditModal pattern)
// ============================================================================

function CrewCreateModal({ open, busy, onClose, onCreate, departments }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    departmentId: "",
    positionId: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        departmentId: "",
        positionId: "",
        notes: "",
      });
      setError("");
      setSaving(false);
    }
  }, [open]);

  const positionsForSelectedDept = useMemo(() => {
    const dept = departments.find((d) => d.id === form.departmentId);
    return dept?.positions ?? [];
  }, [departments, form.departmentId]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleDepartmentChange = (event) => {
    setForm((prev) => ({ ...prev, departmentId: event.target.value, positionId: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const first = (form.firstName || "").trim();
    const last = (form.lastName || "").trim();
    if (!first && !last) {
      setError("Enter at least a first or last name.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onCreate({
        firstName: first,
        lastName: last,
        email: (form.email || "").trim() || null,
        phone: (form.phone || "").trim() || null,
        company: (form.company || "").trim() || null,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        notes: (form.notes || "").trim() || null,
        createdBy: null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to create crew member.");
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
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                New crew member
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add a new member to your production crew.
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-first">
                  First name
                </label>
                <Input
                  id="create-crew-first"
                  value={form.firstName}
                  onChange={handleFieldChange("firstName")}
                  placeholder="First name"
                  disabled={saving || busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-last">
                  Last name
                </label>
                <Input
                  id="create-crew-last"
                  value={form.lastName}
                  onChange={handleFieldChange("lastName")}
                  placeholder="Last name"
                  disabled={saving || busy}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-email">
                  Email
                </label>
                <Input
                  id="create-crew-email"
                  type="email"
                  value={form.email}
                  onChange={handleFieldChange("email")}
                  placeholder="Email"
                  disabled={saving || busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-phone">
                  Phone
                </label>
                <Input
                  id="create-crew-phone"
                  value={form.phone}
                  onChange={handleFieldChange("phone")}
                  placeholder="Phone"
                  disabled={saving || busy}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-company">
                Company
              </label>
              <Input
                id="create-crew-company"
                value={form.company}
                onChange={handleFieldChange("company")}
                placeholder="Company (optional)"
                disabled={saving || busy}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-dept">
                  Department
                </label>
                <select
                  id="create-crew-dept"
                  value={form.departmentId}
                  onChange={handleDepartmentChange}
                  disabled={saving || busy}
                  className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-position">
                  Position
                </label>
                <select
                  id="create-crew-position"
                  value={form.positionId}
                  onChange={handleFieldChange("positionId")}
                  disabled={saving || busy || !form.departmentId}
                  className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  <option value="">Select position</option>
                  {positionsForSelectedDept.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="create-crew-notes">
                Notes
              </label>
              <textarea
                id="create-crew-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notes (optional)"
                disabled={saving || busy}
                className="min-h-20 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving || busy}>
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

export default function LibraryCrewPage() {
  // Auth & permissions
  const { clientId, role: globalRole } = useAuth();
  const canManage = canManageProjects(globalRole);

  // Data hooks
  const { departments } = useDepartments(clientId);
  const { crew, loading, error, createCrewMember, updateCrewMember, deleteCrewMember } = useOrganizationCrew(clientId);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCrewMember, setEditingCrewMember] = useState(null);

  // ══════════════════════════════════════════════════════════════════════════
  // LOOKUP MAPS
  // ══════════════════════════════════════════════════════════════════════════

  const deptNameById = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return map;
  }, [departments]);

  const positionNameById = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => d.positions.forEach((p) => map.set(p.id, p.title)));
    return map;
  }, [departments]);

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERED CREW
  // ══════════════════════════════════════════════════════════════════════════

  const filteredCrew = useMemo(() => {
    return filterCrew(crew, searchQuery);
  }, [crew, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTED CREW MEMBER
  // ══════════════════════════════════════════════════════════════════════════

  const selectedCrewMember = useMemo(() => {
    if (!selectedId) return null;
    return crew.find((m) => m.id === selectedId) || null;
  }, [crew, selectedId]);

  // Auto-select first crew member when data loads and nothing is selected
  useEffect(() => {
    if (!loading && crew.length > 0 && !selectedId) {
      setSelectedId(crew[0].id);
    }
  }, [loading, crew, selectedId]);

  // Clear selection if selected crew member was deleted
  useEffect(() => {
    if (selectedId && !crew.find((m) => m.id === selectedId)) {
      setSelectedId(crew.length > 0 ? crew[0].id : null);
    }
  }, [crew, selectedId]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleCreateClick = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleCreate = useCallback(async (data) => {
    await createCrewMember.mutateAsync(data);
  }, [createCrewMember]);

  const handleEdit = useCallback((crewMember) => {
    setEditingCrewMember(crewMember);
    setEditModalOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async ({ updates }) => {
    if (!editingCrewMember) return;
    await updateCrewMember.mutateAsync({
      crewMemberId: editingCrewMember.id,
      updates,
    });
  }, [editingCrewMember, updateCrewMember]);

  // Inline edit handler for individual fields (used by inspector)
  const handleUpdateField = useCallback(async (crewMemberId, updates) => {
    await updateCrewMember.mutateAsync({ crewMemberId, updates });
  }, [updateCrewMember]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && crew.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading crew...
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
            Unable to load crew
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {error?.message || "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no crew at all)
  if (!loading && crew.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <CrewHeaderBand
          canManage={canManage}
          onCreateClick={handleCreateClick}
          crewCount={0}
        />
        <CrewEmptyState
          canManage={canManage}
          onCreateClick={handleCreateClick}
        />
        {canManage && (
          <CrewCreateModal
            open={createModalOpen}
            busy={createCrewMember.isPending}
            onClose={() => setCreateModalOpen(false)}
            onCreate={handleCreate}
            departments={departments}
          />
        )}
      </div>
    );
  }

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <CrewHeaderBand
        canManage={canManage}
        onCreateClick={handleCreateClick}
        crewCount={crew.length}
      />

      {/* Workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <CrewRail
          crew={filteredCrew}
          selectedId={selectedId}
          onSelect={setSelectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={false}
          deptNameById={deptNameById}
          positionNameById={positionNameById}
        />

        {/* Right canvas */}
        <CrewDetailCanvas
          crewMember={selectedCrewMember}
          canManage={canManage}
          onEdit={handleEdit}
          onUpdateField={handleUpdateField}
          deptName={selectedCrewMember?.departmentId ? deptNameById.get(selectedCrewMember.departmentId) : null}
          positionName={selectedCrewMember?.positionId ? positionNameById.get(selectedCrewMember.positionId) : null}
        />
      </div>

      {/* Create modal */}
      {canManage && (
        <CrewCreateModal
          open={createModalOpen}
          busy={createCrewMember.isPending}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreate}
          departments={departments}
        />
      )}

      {/* Edit modal */}
      {canManage && (
        <CrewEditModal
          open={editModalOpen}
          crewMember={editingCrewMember}
          busy={updateCrewMember.isPending}
          onClose={() => {
            setEditModalOpen(false);
            setEditingCrewMember(null);
          }}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
