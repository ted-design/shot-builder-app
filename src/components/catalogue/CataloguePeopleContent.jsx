import React, { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Download,
  Plus,
  Upload,
  User,
  Users,
  LayoutGrid,
  Table,
  ArrowUpDown,
  Pencil,
  Star,
  Wrench,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input, Checkbox } from "../ui/input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Card, CardContent } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Thumb from "../Thumb";
import TalentDetailModal from "../talent/TalentDetailModal";
import { useAuth } from "../../context/AuthContext";

const stripHtml = (value) => {
  if (!value || typeof value !== "string") return "";
  const withNewlines = value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n");
  const withoutTags = withNewlines.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
};

const getNotesPreview = (notes, maxLength = 140) => {
  const plain = stripHtml(notes || "");
  if (!plain) return "";
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
};

const formatContact = (person = {}) => {
  return [person.phone, person.email].filter(Boolean).join(" • ");
};

function normaliseTalentForModal(person) {
  if (!person) return null;
  return {
    id: person.id,
    name: person.displayName || `${person.firstName || ""} ${person.lastName || ""}`.trim(),
    firstName: person.firstName || "",
    lastName: person.lastName || "",
    agency: person.agency || null,
    email: person.email || null,
    phone: person.phone || null,
    notes: person.notes || null,
    sizing: null,
    gender: person.gender || null,
    url: person.url || null,
    headshotPath: person.headshotPath || null,
    measurements: person.measurements || null,
    galleryImages: [],
  };
}

function TalentGalleryCard({ person, onView }) {
  const displayName = person.displayName || `${person.firstName || ""} ${person.lastName || ""}`.trim() || "Unnamed talent";
  const contactLine = formatContact(person);
  const notesPreview = getNotesPreview(person.notes);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Thumb
        path={person.headshotPath || null}
        size={480}
        alt={displayName}
        className="aspect-[4/5] w-full overflow-hidden bg-slate-100 dark:bg-slate-900"
        imageClassName="h-full w-full object-contain"
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No image</div>
        }
      />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100" title={displayName}>
            <span className="block truncate">{displayName}</span>
          </div>
          {person.agency ? (
            <div className="text-sm text-slate-600 dark:text-slate-400" title={person.agency}>
              <span className="block truncate">{person.agency}</span>
            </div>
          ) : null}
          {contactLine ? (
            <div className="text-sm text-slate-600 dark:text-slate-400" title={contactLine}>
              <span className="block truncate">{contactLine}</span>
            </div>
          ) : null}
          {notesPreview ? (
            <div className="text-xs text-slate-500 dark:text-slate-400" title={notesPreview}>
              <span className="block truncate">{notesPreview}</span>
            </div>
          ) : null}
          {person.url ? (
            <a
              href={person.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
              title={person.url}
            >
              <span className="block truncate">{person.url}</span>
            </a>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onView?.(person)}>
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CataloguePeopleContent
 *
 * Main content area for the Catalogue People section.
 * Displays a data table with search, filter, and action controls.
 */
export default function CataloguePeopleContent({
  people = [],
  selectedGroup = "all",
  searchQuery = "",
  onSearchChange,
  loading = false,
  error = null,
  addMenuItems = [],
}) {
  const { clientId } = useAuth();
  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  // View mode for talent (by person or by role) - only shown when talent filter is active
  const [viewMode, setViewMode] = useState("person");
  const [talentLayout, setTalentLayout] = useState("table");
  const [detailTalent, setDetailTalent] = useState(null);

  const isTalentGallery = selectedGroup === "talent" && talentLayout === "gallery";
  const talentGalleryPeople = useMemo(
    () => (selectedGroup === "talent" ? people.filter((p) => p.type === "talent") : []),
    [people, selectedGroup]
  );

  // Toggle selection for a single row
  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all selections
  const toggleAll = () => {
    if (selectedIds.size === people.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(people.map((p) => p.id)));
    }
  };

  const allSelected = people.length > 0 && selectedIds.size === people.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < people.length;

  // Get dynamic title based on filter
  const getTitle = () => {
    switch (selectedGroup) {
      case "crew":
        return "Crew";
      case "talent":
        return "Talent";
      default:
        return "All People";
    }
  };

  // Get dynamic button label based on filter
  const hasAddMenu = Array.isArray(addMenuItems) && addMenuItems.length > 0;
  const addDisabled = hasAddMenu && addMenuItems.every((item) => item?.disabled);

  // Render loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load people</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Header Area */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Title and View Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {getTitle()}
            </h1>
            {/* View mode toggle - only show for Talent */}
            {selectedGroup === "talent" && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex text-sm font-medium">
                  <button
                    onClick={() => setViewMode("person")}
                    className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                      viewMode === "person"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    By Person
                  </button>
                  <button
                    onClick={() => setViewMode("role")}
                    className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                      viewMode === "role"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    By Role
                  </button>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex text-sm font-medium">
                  <button
                    onClick={() => setTalentLayout("table")}
                    className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                      talentLayout === "table"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    aria-label="List view"
                    type="button"
                  >
                    <Table className="h-4 w-4" />
                    List
                  </button>
                  <button
                    onClick={() => setTalentLayout("gallery")}
                    className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                      talentLayout === "gallery"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    aria-label="Card view"
                    type="button"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Cards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Primary Actions */}
          <div className="flex items-center gap-2">
            {hasAddMenu ? (
              // If there's only one enabled menu item, directly trigger it (no dropdown)
              addMenuItems.filter((item) => !item.disabled).length === 1 ? (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  onClick={() => {
                    const enabledItem = addMenuItems.find((item) => !item.disabled);
                    enabledItem?.onSelect?.();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              ) : (
                // Multiple options - show dropdown
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={addDisabled}>
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {addMenuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.key || item.label}
                        disabled={item.disabled}
                        onSelect={(event) => {
                          event.preventDefault();
                          item.onSelect?.();
                        }}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            ) : (
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={true}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
              <Upload className="h-4 w-4" />
              Import People
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Type to search..."
                className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Table / Cards Area */}
      <div className="flex-1 overflow-auto p-6 bg-white dark:bg-slate-900">
        {isTalentGallery ? (
          <>
            {talentGalleryPeople.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-slate-500 dark:text-slate-400">
                No results found.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {talentGalleryPeople.map((person) => (
                  <TalentGalleryCard
                    key={person.id}
                    person={person}
                    onView={(item) => setDetailTalent(item)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="w-[40px] px-3 py-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="w-[50px] px-3 py-3"></th>
                  <th className="w-[150px] px-3 py-3 text-left">
                    <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                      First Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last Name
                  </th>
                  <th className="w-[200px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Roles
                  </th>
                  <th className="w-[200px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </th>
                  <th className="w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Phone
                  </th>
                  <th className="w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Location
                  </th>
                  <th className="w-[100px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Pay Rate
                  </th>
                  <th className="w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Notes
                  </th>
                  <th className="w-[50px] px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {people.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="h-24 text-center text-slate-500 dark:text-slate-400">
                      No results found.
                    </td>
                  </tr>
                ) : (
                  people.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      isSelected={selectedIds.has(person.id)}
                      onToggleSelection={() => toggleSelection(person.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Info */}
        <div className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-right">
          1 - {people.length} of {people.length} items
        </div>
      </div>

      <TalentDetailModal
        open={Boolean(detailTalent)}
        talent={normaliseTalentForModal(detailTalent)}
        clientId={clientId}
        canEdit={false}
        onClose={() => setDetailTalent(null)}
      />
    </div>
  );
}

/**
 * PersonRow
 *
 * Individual row in the people table.
 */
function PersonRow({ person, isSelected, onToggleSelection }) {
  const isTalent = person.type === "talent";

  // Get avatar colors based on type
  const avatarBgClass = isTalent
    ? "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300"
    : "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300";

  // Get role badge colors based on type
  const roleBadgeClass = isTalent
    ? "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800"
    : "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800";

  const RoleIcon = isTalent ? Star : Wrench;

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
      <td className="px-3 py-3">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelection} />
      </td>
      <td className="px-3 py-3">
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${avatarBgClass}`}
        >
          {person.avatar}
        </div>
      </td>
      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
        {person.firstName || "—"}
      </td>
      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
        {person.lastName || "—"}
      </td>
      <td className="px-3 py-3">
        {person.role ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-normal border ${roleBadgeClass}`}
          >
            <RoleIcon className="h-3 w-3 opacity-50" />
            {person.role}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-sm">
        {person.email || "Not set"}
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-sm">
        {person.phone || "Not set"}
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-sm">
        {person.location || "Not set"}
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-sm">
        {person.payRate || "Not set"}
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-sm">
        <span className="block truncate max-w-[140px]" title={person.notes || ""}>
          {person.notes ? (
            person.notes.length > 30 ? `${person.notes.slice(0, 30)}...` : person.notes
          ) : (
            "Not set"
          )}
        </span>
      </td>
      <td className="px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
