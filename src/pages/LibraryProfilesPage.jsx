/**
 * LibraryProfilesPage — Unified Profiles Discovery Surface (R.4)
 *
 * DESIGN PHILOSOPHY (from R.3):
 * - Unified discovery: Talent + Crew in one surface
 * - Search-first: Primary discovery via search, NOT scrolling a list
 * - NO left rail as primary: Central card grid scales to 500+ profiles
 * - URL state sync: Filter state (?type=talent|crew|all) in URL
 * - Inline editing: Profile canvas uses inline edit fields
 *
 * CRITICAL RULES (from R.4 spec):
 * 1. Discovery != Editing — discovery is calm, editing happens on selection
 * 2. Search-first, NOT rail-first — avoid scroll prison
 * 3. Talent != Crew visual emphasis — same system, different display
 * 4. Inline editing canonical — modals only for create/media
 * 5. URL-addressable filter state — shareable links
 *
 * LAYOUT:
 * - Header band with title, description, count, create button
 * - Search input (primary)
 * - Type filter pills (All / Talent / Crew) with URL sync
 * - Card grid (central, responsive)
 * - Selection → Canvas panel slides in from right
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
import ProfileCard from "../components/profiles/ProfileCard";
import ProfileCanvas from "../components/profiles/ProfileCanvas";
import TalentCreateModal from "../components/talent/TalentCreateModal";
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

// ============================================================================
// TYPE FILTER PILLS
// ============================================================================

function TypeFilterPills({ value, onChange, counts }) {
  const options = [
    { id: "all", label: "All", icon: UserCircle, count: counts.all },
    { id: "talent", label: "Talent", icon: Users, count: counts.talent },
    { id: "crew", label: "Crew", icon: User, count: counts.crew },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1">
      {options.map((opt) => {
        const isActive = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`
              flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium
              transition-all duration-150
              ${isActive
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{opt.label}</span>
            <span className={`
              text-xs tabular-nums
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
// HEADER BAND
// ============================================================================

function ProfilesHeaderBand({ totalCount, canCreate, onCreateClick }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Profiles
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Browse talent and crew across your organization
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              {totalCount} {totalCount === 1 ? "profile" : "profiles"}
            </span>
            {canCreate && (
              <Button onClick={onCreateClick} className="gap-1.5">
                <Plus className="w-4 h-4" />
                New profile
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// EMPTY STATES
// ============================================================================

function EmptyState({ type, hasQuery, onCreateClick, canCreate }) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          No matches found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          Try a different search term or adjust your filters.
        </p>
      </div>
    );
  }

  const Icon = type === "talent" ? Users : type === "crew" ? User : UserCircle;
  const label = type === "all" ? "profiles" : type;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-slate-300 dark:text-slate-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
        No {label} yet
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-md mb-6">
        {type === "talent"
          ? "Talent profiles help you track models for casting across projects."
          : type === "crew"
            ? "Crew profiles help you manage production team members and their roles."
            : "Add talent or crew profiles to build your organization's people directory."}
      </p>
      {canCreate && (
        <Button onClick={onCreateClick} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add your first {type === "all" ? "profile" : type}
        </Button>
      )}
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
  }, [setSearchParams]);

  const handleSelectProfile = useCallback((profile) => {
    setSelectedProfile(profile);
    setSelectedType(profile._type);
  }, []);

  const handleCloseCanvas = useCallback(() => {
    setSelectedProfile(null);
    setSelectedType(null);
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

  // Loading state
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

  const canEdit =
    selectedType === "talent" ? canManageTalentRoles : canManageCrewRoles;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <ProfilesHeaderBand
        totalCount={counts.all}
        canCreate={canCreate}
        onCreateClick={handleCreateClick}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Discovery surface */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedProfile ? "lg:w-1/2" : ""}`}>
          {/* Search and filters */}
          <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search profiles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Type filter pills */}
              <TypeFilterPills
                value={typeFilter}
                onChange={handleTypeChange}
                counts={counts}
              />
            </div>
          </div>

          {/* Results area */}
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
            {filteredProfiles.length === 0 ? (
              <EmptyState
                type={typeFilter}
                hasQuery={!!searchQuery.trim()}
                onCreateClick={handleCreateClick}
                canCreate={canCreate}
              />
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredProfiles.map((profile) => (
                    <ProfileCard
                      key={`${profile._type}-${profile.id}`}
                      profile={profile}
                      type={profile._type}
                      isSelected={
                        selectedProfile?.id === profile.id &&
                        selectedProfile?._type === profile._type
                      }
                      onClick={() => handleSelectProfile(profile)}
                      deptName={profile.departmentId ? deptNameById.get(profile.departmentId) : null}
                      positionName={profile.positionId ? positionNameById.get(profile.positionId) : null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile canvas (slides in on selection) */}
        {selectedProfile && (
          <div className="hidden lg:block w-[420px] flex-shrink-0">
            <ProfileCanvas
              profile={selectedProfile}
              type={selectedType}
              canEdit={canEdit}
              onUpdate={handleProfileUpdate}
              onClose={handleCloseCanvas}
              deptName={selectedProfile.departmentId ? deptNameById.get(selectedProfile.departmentId) : null}
              positionName={selectedProfile.positionId ? positionNameById.get(selectedProfile.positionId) : null}
            />
          </div>
        )}
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
