/**
 * LibraryHubPage — Canonical Library Entry Point (R.2)
 *
 * DESIGN PHILOSOPHY
 * =================
 * This page serves as the canonical entry point to the Library domain,
 * making Library a destination rather than defaulting to a subdomain.
 *
 * Following the Bento-style hub variant from docs/library-domain-architecture.md:
 * - Calm, editorial design inspired by KoboLabs
 * - Clear domain grouping by archetype (Profiles, Structure, Classification)
 * - Statistics provide at-a-glance utility
 * - Each domain tile is a clear, tappable target
 *
 * KEY PRINCIPLES (from R.1):
 * 1. Contextual over generic — different domains for different purposes
 * 2. Navigation clarity over density — clear hierarchy
 * 3. Calm, intentional, editorial — generous whitespace, warm palette
 *
 * DATA SOURCE:
 * - Counts are derived from existing hooks where available
 * - Graceful fallback to "—" for unavailable counts
 * - No new Firestore collections or write paths
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTalent, useLocations } from "../hooks/useFirestoreQuery";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { useDepartments } from "../hooks/useDepartments";
import { useColorSwatches } from "../hooks/useColorSwatches";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import {
  Users,
  User,
  MapPin,
  Briefcase,
  Tag,
  Palette,
  ArrowRight,
} from "lucide-react";

// ============================================================================
// DOMAIN TILE COMPONENT
// ============================================================================

/**
 * DomainTile — Bento-style card for navigating to a Library domain
 *
 * Props:
 * - icon: Lucide icon component
 * - title: Domain name (e.g., "Talent")
 * - description: One-line description
 * - count: Number of items (null/undefined for loading, "—" for unavailable)
 * - countLabel: Singular/plural label (e.g., "profile" / "profiles")
 * - onClick: Navigation handler
 * - loading: Whether count is still loading
 */
function DomainTile({
  icon: Icon,
  title,
  description,
  count,
  countLabel,
  onClick,
  loading = false,
}) {
  const displayCount = loading ? null : (count ?? "—");
  const displayLabel = loading
    ? ""
    : count === 1
      ? countLabel?.singular || countLabel
      : countLabel?.plural || countLabel || "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group relative w-full text-left rounded-xl p-5
        transition-all duration-200 ease-out
        bg-slate-50/80 hover:bg-slate-100
        dark:bg-slate-800/50 dark:hover:bg-slate-700/50
        hover:shadow-md hover:-translate-y-0.5
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2
      "
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-white dark:bg-slate-700 shadow-sm group-hover:shadow">
        <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-4 text-slate-500 dark:text-slate-400">
        {description}
      </p>

      {/* Count and action */}
      <div className="flex items-end justify-between">
        <div>
          {loading ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span className="text-xs text-slate-400">Loading...</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {displayCount}
              </span>
              {displayLabel && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {displayLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Arrow indicator on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

function SectionHeader({ title, description, className = "" }) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function LibraryHubPage() {
  const navigate = useNavigate();
  const { clientId } = useAuth();

  // Fetch counts from existing hooks
  const { data: talent = [], isLoading: talentLoading } = useTalent(clientId);
  const { data: locations = [], isLoading: locationsLoading } = useLocations(clientId);
  const { crew, loading: crewLoading } = useOrganizationCrew(clientId);
  const { departments, loading: departmentsLoading } = useDepartments(clientId);
  const { swatches = [], loading: swatchesLoading } = useColorSwatches(clientId);

  // Compute counts
  const counts = useMemo(() => ({
    talent: talent?.length ?? 0,
    crew: crew?.length ?? 0,
    locations: locations?.length ?? 0,
    departments: departments?.length ?? 0,
    // Tags are project-scoped and aggregated from shots — not available at org level
    tags: null,
    swatches: swatches?.length ?? 0,
  }), [talent, crew, locations, departments, swatches]);

  const loadingStates = {
    talent: talentLoading,
    crew: crewLoading,
    locations: locationsLoading,
    departments: departmentsLoading,
    tags: false,
    swatches: swatchesLoading,
  };

  // Domain definitions grouped by archetype
  const domains = {
    profiles: [
      {
        id: "talent",
        icon: Users,
        title: "Talent",
        description: "Model profiles available for casting across projects.",
        path: "/library/talent",
        countLabel: { singular: "profile", plural: "profiles" },
      },
      {
        id: "crew",
        icon: User,
        title: "Crew",
        description: "Production team members with roles and contact info.",
        path: "/library/crew",
        countLabel: { singular: "member", plural: "members" },
      },
    ],
    structure: [
      {
        id: "departments",
        icon: Briefcase,
        title: "Departments",
        description: "Organizational structure for crew assignment.",
        path: "/library/departments",
        countLabel: { singular: "department", plural: "departments" },
      },
      {
        id: "locations",
        icon: MapPin,
        title: "Locations",
        description: "Shooting venues with logistics details.",
        path: "/library/locations",
        countLabel: { singular: "venue", plural: "venues" },
      },
    ],
    classification: [
      {
        id: "tags",
        icon: Tag,
        title: "Tags",
        description: "Classification vocabulary for shots.",
        path: "/library/tags",
        countLabel: { singular: "tag", plural: "tags" },
      },
      {
        id: "swatches",
        icon: Palette,
        title: "Swatches",
        description: "Standardized color palette for products.",
        path: "/library/palette",
        countLabel: { singular: "swatch", plural: "swatches" },
      },
    ],
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page header - matches existing Library shell */}
      <PageHeader sticky={true} className="top-14 z-40">
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Library</PageHeader.Title>
            <PageHeader.Description>
              Organization-wide assets for your productions
            </PageHeader.Description>
          </div>
        </PageHeader.Content>
      </PageHeader>

      {/* Hub content */}
      <div className="px-6 max-w-4xl mx-auto">
        {/* Profiles section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader
              title="Profiles"
              description="People available across your productions"
            />
            <button
              type="button"
              onClick={() => handleNavigate("/library/profiles")}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              View all profiles
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.profiles.map((domain) => (
              <DomainTile
                key={domain.id}
                icon={domain.icon}
                title={domain.title}
                description={domain.description}
                count={counts[domain.id]}
                countLabel={domain.countLabel}
                loading={loadingStates[domain.id]}
                onClick={() => handleNavigate(domain.path)}
              />
            ))}
          </div>
        </section>

        {/* Structure section */}
        <section className="mb-10">
          <SectionHeader
            title="Structure"
            description="Organizational and physical infrastructure"
            className="mb-4"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.structure.map((domain) => (
              <DomainTile
                key={domain.id}
                icon={domain.icon}
                title={domain.title}
                description={domain.description}
                count={counts[domain.id]}
                countLabel={domain.countLabel}
                loading={loadingStates[domain.id]}
                onClick={() => handleNavigate(domain.path)}
              />
            ))}
          </div>
        </section>

        {/* Classification section */}
        <section>
          <SectionHeader
            title="Classification"
            description="Vocabularies and standards used across the system"
            className="mb-4"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.classification.map((domain) => (
              <DomainTile
                key={domain.id}
                icon={domain.icon}
                title={domain.title}
                description={domain.description}
                count={counts[domain.id]}
                countLabel={domain.countLabel}
                loading={loadingStates[domain.id]}
                onClick={() => handleNavigate(domain.path)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
