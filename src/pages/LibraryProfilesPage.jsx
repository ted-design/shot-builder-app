/**
 * LibraryProfilesPage — Unified Profiles Workspace (R.5)
 *
 * DESIGN PHILOSOPHY (from R.1/R.3, refined in R.5):
 * - Master-detail workspace: Left rail + right canvas
 * - Rail-first discovery: Compact list scales to 500+ profiles
 * - URL state sync: Filter state (?type=talent|crew|all) in URL
 * - Inline editing: Profile canvas uses inline edit fields
 * - Stable frame: No jarring reflows on selection
 *
 * LAYOUT (R.5):
 * - LEFT RAIL (~280px): Search, type filter, profile list
 * - RIGHT CANVAS (flex): Selected profile detail with sections
 *
 * CRITICAL RULES:
 * 1. Rail is primary navigation, canvas is focused detail
 * 2. Auto-select first result when no selection
 * 3. Inline editing canonical — modals only for create/media
 * 4. URL-addressable filter state — shareable links
 * 5. Empty states are intentional, not broken
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useTalent } from "../hooks/useFirestoreQuery";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { useDepartments } from "../hooks/useDepartments";
import { canManageTalent, canManageProjects } from "../lib/rbac";
import { searchTalent } from "../lib/search";
import { toast } from "../lib/toast";
import { talentPath, crewMemberPath } from "../lib/paths";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import ProfileCanvas from "../components/profiles/ProfileCanvas";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import Thumb from "../components/Thumb";
import {
  Search,
  Plus,
  Users,
  User,
  UserCircle,
} from "lucide-react";

// ============================================================================
// CREW SEARCH (mirrors searchTalent pattern from lib/search.js)
// ============================================================================

function searchCrew(crew, query) {
  if (!query || !query.trim()) return crew.map((item) => ({ item, score: 0 }));

  const q = query.trim().toLowerCase();
  const results = crew.filter((m) => {
    const haystack = `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.phone || ""} ${m.company || ""}`
      .trim()
      .toLowerCase();
    return haystack.includes(q);
  });

  return results.map((item) => ({ item, score: 0 }));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildDisplayName(profile) {
  if (profile.name && profile.name.trim()) {
    return profile.name.trim();
  }
  const first = (profile.firstName || "").trim();
  const last = (profile.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed";
}

function getSecondaryLine(profile, type, deptName, positionName) {
  if (type === "talent") {
    return profile.agency || null;
  }
  // Crew: company or position/department
  const parts = [positionName, deptName].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return profile.company || null;
}

// ============================================================================
// TYPE FILTER PILLS (Rail version - compact)
// ============================================================================

function TypeFilterPillsCompact({ value, onChange, counts }) {
  const options = [
    { id: "all", label: "All", count: counts.all },
    { id: "talent", label: "Talent", count: counts.talent },
    { id: "crew", label: "Crew", count: counts.crew },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium
              transition-all duration-150
              ${isActive
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }
            `}
          >
            <span>{opt.label}</span>
            <span className={`
              tabular-nums
              ${isActive ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}
            `}>
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// PROFILE LIST ITEM (Rail row - compact)
// ============================================================================

function ProfileListItem({
  profile,
  type,
  isSelected,
  onClick,
  secondaryLine,
}) {
  const name = buildDisplayName(profile);
  const isTalent = type === "talent";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg
        transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset
        ${isSelected
          ? "bg-primary/10 dark:bg-primary/20"
          : "hover:bg-slate-100 dark:hover:bg-slate-800"
        }
      `}
    >
      {/* Avatar/Thumbnail */}
      <div className={`
        flex-shrink-0 overflow-hidden bg-slate-200 dark:bg-slate-700
        ${isTalent ? "w-10 h-12 rounded-md" : "w-10 h-10 rounded-full"}
      `}>
        {isTalent ? (
          <Thumb
            path={profile.headshotPath || null}
            size={100}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover object-top"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`
            text-sm font-medium truncate
            ${isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}
          `}>
            {name}
          </span>
          {/* Type badge - subtle */}
          <span className={`
            flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
            ${isTalent
              ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
              : "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
            }
          `}>
            {isTalent ? "T" : "C"}
          </span>
        </div>
        {secondaryLine && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {secondaryLine}
          </p>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// EMPTY STATES
// ============================================================================

function RailEmptyState({ type, hasQuery }) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
          <Search className="w-6 h-6 text-slate-300 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
          No matches found
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-1">
          Try a different search term
        </p>
      </div>
    );
  }

  const Icon = type === "talent" ? Users : type === "crew" ? User : UserCircle;
  const label = type === "all" ? "profiles" : type;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-300 dark:text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
        No {label} yet
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-1 max-w-[200px]">
        {type === "talent"
          ? "Add talent profiles for casting"
          : type === "crew"
            ? "Add crew members to your team"
            : "Add talent or crew to get started"}
      </p>
    </div>
  );
}

function CanvasEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <UserCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <h2 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
          Select a profile
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Choose someone from the list to view their details
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function LibraryProfilesPage() {
  // URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get("type") || "all";

  // Auth & permissions
  const { clientId, role: globalRole } = useAuth();
  const canManageTalentRoles = canManageTalent(globalRole);
  const canManageCrewRoles = canManageProjects(globalRole);
  const canCreate = canManageTalentRoles || canManageCrewRoles;

  // Data hooks
  const { data: talent = [], isLoading: talentLoading } = useTalent(clientId);
  const { crew = [], loading: crewLoading } = useOrganizationCrew(clientId);
  const { departments } = useDepartments(clientId);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState("talent");

  // Loading state
  const loading = talentLoading || crewLoading;

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
  // UNIFIED PROFILES
  // ══════════════════════════════════════════════════════════════════════════

  const allProfiles = useMemo(() => {
    const talentProfiles = talent.map((t) => ({
      ...t,
      _type: "talent",
      _displayName: buildDisplayName(t),
    }));

    const crewProfiles = crew.map((c) => ({
      ...c,
      _type: "crew",
      _displayName: buildDisplayName(c),
    }));

    return [...talentProfiles, ...crewProfiles].sort((a, b) =>
      a._displayName.localeCompare(b._displayName)
    );
  }, [talent, crew]);

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERED PROFILES
  // ══════════════════════════════════════════════════════════════════════════

  const filteredProfiles = useMemo(() => {
    // First filter by type
    let filtered = allProfiles;
    if (typeFilter === "talent") {
      filtered = allProfiles.filter((p) => p._type === "talent");
    } else if (typeFilter === "crew") {
      filtered = allProfiles.filter((p) => p._type === "crew");
    }

    // Then apply search
    const query = searchQuery.trim();
    if (!query) return filtered;

    // Split by type for search functions
    const talentItems = filtered.filter((p) => p._type === "talent");
    const crewItems = filtered.filter((p) => p._type === "crew");

    const talentResults = searchTalent(talentItems, query).map((r) => r.item);
    const crewResults = searchCrew(crewItems, query).map((r) => r.item);

    const combined = [...talentResults, ...crewResults];
    return combined.sort((a, b) => a._displayName.localeCompare(b._displayName));
  }, [allProfiles, typeFilter, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════════
  // COUNTS
  // ══════════════════════════════════════════════════════════════════════════

  const counts = useMemo(() => ({
    all: allProfiles.length,
    talent: talent.length,
    crew: crew.length,
  }), [allProfiles.length, talent.length, crew.length]);

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-SELECT FIRST PROFILE
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Auto-select first profile if none selected and results exist
    // Note: Use filteredProfiles.length in deps to avoid re-running on array identity change
    if (!selectedProfile && filteredProfiles.length > 0 && !loading) {
      const first = filteredProfiles[0];
      setSelectedProfile(first);
      setSelectedType(first._type);
    }
  }, [filteredProfiles.length, selectedProfile, loading]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleTypeChange = useCallback((newType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newType === "all") {
        next.delete("type");
      } else {
        next.set("type", newType);
      }
      return next;
    });
    // Clear selection when changing type filter
    setSelectedProfile(null);
    setSelectedType(null);
  }, [setSearchParams]);

  const handleSelectProfile = useCallback((profile) => {
    setSelectedProfile(profile);
    setSelectedType(profile._type);
  }, []);

  const handleCreateClick = useCallback(() => {
    // Default to talent, but respect current filter
    setCreateType(typeFilter === "crew" ? "crew" : "talent");
    setCreateModalOpen(true);
  }, [typeFilter]);

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILE UPDATE HANDLER
  // ══════════════════════════════════════════════════════════════════════════

  const handleProfileUpdate = useCallback(async ({ field, value }) => {
    if (!selectedProfile) return;

    const profileType = selectedProfile._type;
    const profileId = selectedProfile.id;

    try {
      if (profileType === "talent") {
        const docRef = doc(db, ...talentPath(clientId), profileId);
        await updateDoc(docRef, {
          [field]: value,
          updatedAt: serverTimestamp(),
        });
        toast.success("Profile updated");
      } else {
        const docRef = doc(db, ...crewMemberPath(profileId, clientId));
        await updateDoc(docRef, {
          [field]: value,
          updatedAt: serverTimestamp(),
        });
        toast.success("Profile updated");
      }
    } catch (err) {
      console.error("[LibraryProfilesPage] Update failed:", err);
      throw new Error(err?.message || "Failed to update profile");
    }
  }, [selectedProfile, clientId]);

  // Keep selected profile in sync with data changes
  useEffect(() => {
    if (!selectedProfile) return;

    const found = allProfiles.find(
      (p) => p.id === selectedProfile.id && p._type === selectedProfile._type
    );

    if (found) {
      setSelectedProfile(found);
    } else {
      // Profile was deleted
      setSelectedProfile(null);
      setSelectedType(null);
    }
  }, [allProfiles, selectedProfile?.id, selectedProfile?._type]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const canEdit =
    selectedType === "talent" ? canManageTalentRoles : canManageCrewRoles;

  // Full page loading
  if (loading && allProfiles.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading profiles...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Profiles
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage talent and crew for your organization
              </p>
            </div>

            {canCreate && (
              <Button onClick={handleCreateClick} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                New profile
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL */}
        <aside className="w-[280px] flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
          {/* Search + Filter */}
          <div className="flex-shrink-0 p-3 space-y-3 border-b border-slate-100 dark:border-slate-800">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Type filter pills */}
            <TypeFilterPillsCompact
              value={typeFilter}
              onChange={handleTypeChange}
              counts={counts}
            />
          </div>

          {/* Profile list */}
          <div className="flex-1 overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <RailEmptyState type={typeFilter} hasQuery={!!searchQuery.trim()} />
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredProfiles.map((profile) => (
                  <ProfileListItem
                    key={`${profile._type}-${profile.id}`}
                    profile={profile}
                    type={profile._type}
                    isSelected={
                      selectedProfile?.id === profile.id &&
                      selectedProfile?._type === profile._type
                    }
                    onClick={() => handleSelectProfile(profile)}
                    secondaryLine={getSecondaryLine(
                      profile,
                      profile._type,
                      profile.departmentId ? deptNameById.get(profile.departmentId) : null,
                      profile.positionId ? positionNameById.get(profile.positionId) : null
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rail footer with count */}
          <div className="flex-shrink-0 px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredProfiles.length} {filteredProfiles.length === 1 ? "profile" : "profiles"}
              {searchQuery.trim() && " found"}
            </p>
          </div>
        </aside>

        {/* RIGHT CANVAS */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          {selectedProfile ? (
            <ProfileCanvas
              profile={selectedProfile}
              type={selectedType}
              canEdit={canEdit}
              onUpdate={handleProfileUpdate}
              onClose={null} // No close in workspace mode
              deptName={selectedProfile.departmentId ? deptNameById.get(selectedProfile.departmentId) : null}
              positionName={selectedProfile.positionId ? positionNameById.get(selectedProfile.positionId) : null}
            />
          ) : (
            <CanvasEmptyState />
          )}
        </main>
      </div>

      {/* Create modal (talent only for now — crew uses existing modal) */}
      {canManageTalentRoles && createType === "talent" && (
        <TalentCreateModal
          open={createModalOpen}
          busy={false}
          onClose={() => setCreateModalOpen(false)}
          onCreate={() => {
            // TalentCreateModal handles its own write
            setCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
