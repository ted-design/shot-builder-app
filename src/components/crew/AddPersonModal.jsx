import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import Avatar from "../ui/Avatar";
import RoleSelector from "./RoleSelector";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { joinNameParts, normalizeHumanName, splitFullName } from "../../lib/personName";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
};

/**
 * Normalize phone number for matching by stripping formatting characters.
 * @param {string} phone - Raw phone number string
 * @returns {string} Normalized phone string (digits only)
 */
const normalizePhone = (phone) => {
  if (!phone) return "";
  // Strip spaces, dashes, parentheses, plus signs, periods
  return phone.replace(/[\s\-\(\)\+\.]/g, "");
};

/**
 * Check if string contains at least one letter (A-Z, a-z).
 */
const hasLetter = (str) => /[a-zA-Z]/.test(str);

/**
 * Gating: Name-based suggestions require EITHER:
 * - Input contains a space (likely first + last), OR
 * - Input length >= 4 AND contains at least one letter
 */
const shouldGateNameSuggestions = (query) => {
  if (!query) return true; // Gate (don't show) if empty
  const trimmed = query.trim();
  if (trimmed.includes(" ")) return false; // Don't gate - has space
  return !(trimmed.length >= 4 && hasLetter(trimmed)); // Gate unless 4+ chars with letter
};

/**
 * Gating: Phone-based suggestions require normalized digit length >= 7.
 */
const shouldGatePhoneSuggestions = (normalizedPhone) => {
  return normalizedPhone.length < 7;
};

/**
 * Gating: Company-based suggestions require length >= 4 AND contains letter.
 */
const shouldGateCompanySuggestions = (query) => {
  if (!query) return true;
  const trimmed = query.trim();
  return !(trimmed.length >= 4 && hasLetter(trimmed));
};

const emptyRole = {
  departmentId: "",
  positionId: "",
};

/**
 * AddPersonModal - Add crew members to a project with role assignment
 *
 * Features:
 * - Autocomplete search for existing org crew members
 * - Create new crew members (added to both org and project)
 * - Assign department/position roles from project departments
 * - Create new positions on-the-fly
 * - Support for multiple role assignments
 *
 * @param {boolean} open - Whether the modal is open
 * @param {boolean} busy - Loading state
 * @param {function} onClose - Called when modal is closed
 * @param {function} onAddPerson - Called with { crewMember, roles, isNew } when person is added
 * @param {function} onCreatePosition - Called with { departmentId, title } when new position is created
 * @param {Array} orgCrew - Array of org-level crew members for autocomplete
 * @param {Array} projectDepartments - Array of project departments with positions
 * @param {Set} existingCrewIds - Set of crew member IDs already assigned to project
 */
export default function AddPersonModal({
  open,
  busy = false,
  onClose,
  onAddPerson,
  onCreatePosition,
  orgCrew = [],
  projectDepartments = [],
  existingCrewIds = new Set(),
}) {
  const [form, setForm] = useState(emptyForm);
  const [roles, setRoles] = useState([{ ...emptyRole }]);
  const [selectedCrewMember, setSelectedCrewMember] = useState(null);
  const [nameMode, setNameMode] = useState("full"); // "full" | "split"
  const [fullName, setFullName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState("submit"); // "submit" | "addAnother"

  const firstFieldRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open]);

  const resetForm = () => {
    setForm(emptyForm);
    setRoles([{ ...emptyRole }]);
    setSelectedCrewMember(null);
    setNameMode("full");
    setFullName("");
    setShowSuggestions(false);
    setError("");
    setActiveAction("submit");
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const nameQuery = useMemo(() => {
    if (selectedCrewMember) {
      return joinNameParts(selectedCrewMember.firstName || "", selectedCrewMember.lastName || "");
    }
    if (nameMode === "split") return joinNameParts(form.firstName, form.lastName);
    return fullName;
  }, [form.firstName, form.lastName, fullName, nameMode, selectedCrewMember]);

  const debouncedQuery = useDebouncedValue(nameQuery, 300);
  const inferredName = useMemo(() => splitFullName(fullName), [fullName]);

  const suggestions = useMemo(() => {
    if (selectedCrewMember) return [];
    const query = normalizeHumanName(debouncedQuery).toLowerCase();
    if (!query) return [];

    const tokens = query.split(" ").filter(Boolean);
    const normalizedQueryPhone = normalizePhone(query);

    // Compute gating flags once for the entire query
    const gateNames = shouldGateNameSuggestions(query);
    const gatePhones = shouldGatePhoneSuggestions(normalizedQueryPhone);
    const gateCompanies = shouldGateCompanySuggestions(query);

    // If all suggestion types are gated, return early
    if (gateNames && gatePhones && gateCompanies) return [];

    return orgCrew
      .map((member) => {
        const first = (member.firstName || "").toLowerCase();
        const last = (member.lastName || "").toLowerCase();
        const email = (member.email || "").toLowerCase();
        const company = (member.company || "").toLowerCase();
        const phone = member.phone || "";
        const normalizedPhone = normalizePhone(phone);
        const full = `${first} ${last}`.trim();

        let matchedField = null;

        // Check name matches (highest priority) - gated
        if (!gateNames && (full.includes(query) || first.includes(query) || last.includes(query))) {
          matchedField = "name";
        }
        // Check email match - uses same gating as name (requires meaningful query)
        else if (!gateNames && email.includes(query)) {
          matchedField = "email";
        }
        // Check company match - gated (requires 4+ chars with letter)
        else if (!gateCompanies && company && company.includes(query)) {
          matchedField = "company";
        }
        // Check phone match (normalized) - gated (requires 7+ digits)
        else if (!gatePhones && normalizedPhone && normalizedPhone.includes(normalizedQueryPhone)) {
          matchedField = "phone";
        }
        // Check multi-token match for name/email/company - gated by name rules
        else if (!gateNames && tokens.length > 1 && tokens.every((token) =>
          full.includes(token) || email.includes(token) || company.includes(token)
        )) {
          matchedField = "name";
        }

        if (!matchedField) return null;
        return { ...member, _matchedField: matchedField };
      })
      .filter(Boolean)
      .slice(0, 8);
  }, [debouncedQuery, orgCrew, selectedCrewMember]);

  // Get positions for a department
  const getPositionsForDepartment = (departmentId) => {
    const dept = projectDepartments.find((d) => d.id === departmentId);
    return dept?.positions || [];
  };

  // Check if we can submit
  const canSubmit = useMemo(() => {
    const hasName =
      selectedCrewMember ||
      (nameMode === "split" ? Boolean(form.firstName.trim() || form.lastName.trim()) : Boolean(fullName.trim()));
    const hasValidRole = roles.some((role) => role.departmentId && role.positionId);
    return hasName && hasValidRole;
  }, [form.firstName, form.lastName, fullName, nameMode, roles, selectedCrewMember]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const clearSelectedCrewMember = () => {
    setSelectedCrewMember(null);
    setNameMode("full");
    setFullName("");
    setForm(emptyForm);
    setShowSuggestions(false);
  };

  const handleFullNameChange = (event) => {
    const value = event.target.value;
    setFullName(value);
    setShowSuggestions(true);
    if (selectedCrewMember) {
      setSelectedCrewMember(null);
      setForm(emptyForm);
    }
  };

  const handleSplitNameChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setShowSuggestions(true);
    if (selectedCrewMember) {
      setSelectedCrewMember(null);
      setForm((prev) => ({ ...prev, ...emptyForm, [field]: value }));
    }
  };

  const handleSelectCrewMember = (member) => {
    setSelectedCrewMember(member);
    setNameMode("full");
    setFullName(joinNameParts(member.firstName || "", member.lastName || ""));
    setForm({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      email: member.email || "",
      phone: member.phone || "",
      notes: member.notes || "",
    });
    setShowSuggestions(false);
  };

  const handleRoleChange = (index, field, value) => {
    setRoles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Reset position when department changes
      if (field === "departmentId") {
        updated[index].positionId = "";
      }
      return updated;
    });
  };

  const addRole = () => {
    setRoles((prev) => [...prev, { ...emptyRole }]);
  };

  const removeRole = (index) => {
    if (roles.length <= 1) return;
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event, shouldAddAnother = false) => {
    event.preventDefault();
    if (!onAddPerson) return;

    // Filter to only valid roles
    const validRoles = roles.filter((role) => role.departmentId && role.positionId);
    if (validRoles.length === 0) {
      setError("Please assign at least one role");
      return;
    }

    try {
      setError("");
      setActiveAction(shouldAddAnother ? "addAnother" : "submit");

      const isNew = !selectedCrewMember;
      const resolvedName = nameMode === "split" ? { firstName: form.firstName, lastName: form.lastName } : inferredName;
      const first = (resolvedName.firstName || "").trim();
      const last = (resolvedName.lastName || "").trim();
      if (isNew && !first && !last) {
        setError("Enter at least a first or last name.");
        return;
      }

      const crewMember = selectedCrewMember || {
        firstName: first,
        lastName: last,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };

      await onAddPerson({
        crewMember,
        roles: validRoles.map((role) => ({
          departmentId: role.departmentId,
          positionId: role.positionId,
          // Positions from project departments are project-scoped
          departmentScope: "project",
          positionScope: "project",
        })),
        isNew,
      });

      if (shouldAddAnother) {
        resetForm();
      } else {
        onClose?.();
      }
    } catch (err) {
      const message = err?.message || "Unable to add person. Please try again.";
      setError(message);
    } finally {
      setActiveAction("submit");
    }
  };

  const isAlreadyAssigned = selectedCrewMember && existingCrewIds.has(selectedCrewMember.id);

  const modalTitleId = "add-person-title";

  const highlightMatch = (text, query) => {
    if (!text) return null;
    const q = normalizeHumanName(query);
    if (!q) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = q.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
      <>
        {text.slice(0, index)}
        <span className="font-semibold">{text.slice(index, index + q.length)}</span>
        {text.slice(index + q.length)}
      </>
    );
  };

  const showNoMatches =
    !selectedCrewMember && normalizeHumanName(debouncedQuery) && showSuggestions && suggestions.length === 0;

  const primaryLabel = selectedCrewMember ? "Add to project" : "Create";
  const secondaryLabel = selectedCrewMember ? "Add & add another" : "Create & add another";

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      labelledBy={modalTitleId}
      initialFocusRef={firstFieldRef}
      contentClassName="p-0 max-h-[90vh] overflow-y-auto"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id={modalTitleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Add person to project
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search for an existing crew member or create a new one. Assign their role on this project.
          </p>
        </CardHeader>
        <CardContent className="pb-6">
          <form className="space-y-5" onSubmit={(e) => handleSubmit(e, false)}>
            {/* Name Search / Autocomplete */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="person-name-search">
                Name
              </label>
              <div className="relative" ref={suggestionsRef}>
                {nameMode === "full" ? (
                  <Input
                    id="person-name-search"
                    ref={firstFieldRef}
                    value={fullName}
                    onChange={handleFullNameChange}
                    onFocus={() => fullName.trim() && setShowSuggestions(true)}
                    placeholder="Type a full name…"
                    disabled={busy}
                    autoComplete="off"
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="person-first-name">
                        First name
                      </label>
                      <Input
                        id="person-first-name"
                        ref={firstFieldRef}
                        value={form.firstName}
                        onChange={handleSplitNameChange("firstName")}
                        onFocus={() => nameQuery.trim() && setShowSuggestions(true)}
                        placeholder="First name"
                        disabled={busy}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="person-last-name">
                        Last name
                      </label>
                      <Input
                        id="person-last-name"
                        value={form.lastName}
                        onChange={handleSplitNameChange("lastName")}
                        onFocus={() => nameQuery.trim() && setShowSuggestions(true)}
                        placeholder="Last name"
                        disabled={busy}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((member) => {
                      const isAssigned = existingCrewIds.has(member.id);
                      const displayName = joinNameParts(member.firstName || "", member.lastName || "") || "Unnamed";
                      const matchedField = member._matchedField;
                      // Show secondary info based on matched field
                      const secondaryText =
                        matchedField === "phone" && member.phone
                          ? member.phone
                          : matchedField === "company" && member.company
                            ? member.company
                            : member.email || null;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleSelectCrewMember(member)}
                          disabled={isAssigned}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between gap-3 ${
                            isAssigned ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={displayName} email={member.email} size="sm" className="shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {highlightMatch(displayName, debouncedQuery)}
                              </div>
                              {secondaryText && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {matchedField === "phone" || matchedField === "company" ? (
                                    <>{highlightMatch(secondaryText, debouncedQuery)}</>
                                  ) : (
                                    highlightMatch(secondaryText, debouncedQuery)
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {isAssigned && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                              In project
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {!selectedCrewMember && nameMode === "full" && normalizeHumanName(fullName) && (
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="truncate">
                    First: <span className="text-slate-700 dark:text-slate-200">{inferredName.firstName || "—"}</span>{" "}
                    Last: <span className="text-slate-700 dark:text-slate-200">{inferredName.lastName || "—"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNameMode("split");
                      setForm((prev) => ({
                        ...prev,
                        firstName: inferredName.firstName || "",
                        lastName: inferredName.lastName || "",
                      }));
                      setShowSuggestions(false);
                    }}
                    className="shrink-0 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    disabled={busy}
                  >
                    Change
                  </button>
                </div>
              )}

              {!selectedCrewMember && nameMode === "split" && (
                <button
                  type="button"
                  onClick={() => {
                    setFullName(joinNameParts(form.firstName, form.lastName));
                    setNameMode("full");
                    setShowSuggestions(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                  disabled={busy}
                >
                  Use full name input
                </button>
              )}

              {selectedCrewMember ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                    Existing crew member
                  </span>
                  <button
                    type="button"
                    onClick={clearSelectedCrewMember}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    disabled={busy}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              {showNoMatches && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  No matches found — a new contact will be created.
                </p>
              )}
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="person-email">
                  Email
                </label>
                <Input
                  id="person-email"
                  type="email"
                  value={form.email}
                  onChange={updateField("email")}
                  placeholder="Email (optional)"
                  disabled={busy || !!selectedCrewMember}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="person-phone">
                  Phone
                </label>
                <Input
                  id="person-phone"
                  value={form.phone}
                  onChange={updateField("phone")}
                  placeholder="Phone (optional)"
                  disabled={busy || !!selectedCrewMember}
                />
              </div>
            </div>

            {/* Role Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role(s) on this project
                </label>
                <button
                  type="button"
                  onClick={addRole}
                  disabled={busy}
                  className="text-sm text-primary hover:text-primary/80 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  + Add another role
                </button>
              </div>

              {roles.map((role, index) => (
                <div key={index} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Role {index + 1}
                    </span>
                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRole(index)}
                        disabled={busy}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* RoleSelector - SetHero-style two-column picker */}
                  <RoleSelector
                    departments={projectDepartments}
                    selectedDepartmentId={role.departmentId}
                    selectedPositionId={role.positionId}
                    onSelect={({ departmentId, positionId }) => {
                      handleRoleChange(index, "departmentId", departmentId);
                      handleRoleChange(index, "positionId", positionId);
                    }}
                    onCreatePosition={onCreatePosition}
                    placeholder="Search positions..."
                    disabled={busy}
                  />

                  {/* Show selected role info */}
                  {role.departmentId && role.positionId && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {projectDepartments.find((d) => d.id === role.departmentId)?.name} &rarr;{" "}
                      {getPositionsForDepartment(role.departmentId).find((p) => p.id === role.positionId)?.title}
                    </div>
                  )}
                </div>
              ))}

              {projectDepartments.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No project departments configured. Add departments first or copy from org defaults.
                </p>
              )}
            </div>

            {/* Notes (for new crew members only) */}
            {!selectedCrewMember && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="person-notes">
                  Notes
                </label>
                <textarea
                  id="person-notes"
                  value={form.notes}
                  onChange={updateField("notes")}
                  placeholder="Additional notes (optional)"
                  disabled={busy}
                  rows={2}
                  className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:ring-offset-slate-900 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Already assigned warning */}
            {isAlreadyAssigned && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
                This person is already assigned to this project. Select a different person or clear the selection.
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Possible duplicate warning - shown when creating new while suggestions exist */}
            {!selectedCrewMember && suggestions.length > 0 && canSubmit && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
                <span className="font-medium">Possible duplicate:</span> Similar people already exist in your organization. Review the suggestions above before creating a new record.
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, true)}
                disabled={busy || !canSubmit || isAlreadyAssigned}
              >
                {busy && activeAction === "addAnother" && <LoadingSpinner size="sm" className="mr-2" />}
                {secondaryLabel}
              </Button>
              <Button type="submit" disabled={busy || !canSubmit || isAlreadyAssigned}>
                {busy && activeAction === "submit" && <LoadingSpinner size="sm" className="mr-2" />}
                {busy && activeAction === "submit" ? "Working…" : primaryLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
