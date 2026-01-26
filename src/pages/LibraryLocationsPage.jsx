/**
 * LibraryLocationsPage — Canonical Full-Page Workspace Shell (R.9)
 *
 * DESIGN PHILOSOPHY (L.1 Delta → R.9 Inspector Standardization)
 * ==============================================================
 * This page transforms the Library → Locations view into a workspace-style experience
 * following the Products V3 / Shot Editor V3 spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - LEFT: Scannable location rail with search results
 * - RIGHT: Selected location detail canvas (Inspector)
 *
 * KEY CHANGES FROM LEGACY:
 * 1. Master-detail pattern replaces modal-first UX
 * 2. Location selection is local state (no URL routing per spec)
 * 3. Designed empty states for both rail and canvas
 * 4. Full-page workspace instead of admin table presentation
 *
 * R.9 STANDARDIZATION:
 * - Inline editing in the Inspector (canvas) — NO modals for primary editing
 * - Click field → edit inline
 * - Blur/Enter → save
 * - Escape → cancel
 * - Matches Profiles behavior (R.5–R.7)
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/locations (via locationsPath)
 * - Real-time subscription via onSnapshot
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "../lib/demoSafeFirestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { locationsPath } from "../lib/paths";
import { searchLocations } from "../lib/search";
import { canManageLocations } from "../lib/rbac";
import { toast } from "../lib/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import Thumb from "../components/Thumb";
import InlineEditField from "../components/profiles/InlineEditField";
import LocationCreateModal from "../components/locations/LocationCreateModal";
import {
  MapPin,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatAddress(location) {
  const { street, unit, city, province, postal } = location;
  const lineParts = [street, unit ? `Unit ${unit}` : null, city, province, postal].filter(Boolean);
  return lineParts.join(", ");
}

// ============================================================================
// LOCATION RAIL ITEM
// ============================================================================

function LocationRailItem({ location, isSelected, onClick }) {
  const name = (location.name || "Unnamed location").trim();
  const address = formatAddress(location);

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
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-700">
          <Thumb
            path={location.photoPath || null}
            size={96}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
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
          {address && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {address}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// LOCATION RAIL (LEFT PANEL)
// ============================================================================

function LocationRail({
  locations,
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
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Location list */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {searchQuery ? "No matches found" : "No locations yet"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchQuery
                ? "Try a different search term"
                : "Create a location to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {locations.map((location) => (
              <LocationRailItem
                key={location.id}
                location={location}
                isSelected={selectedId === location.id}
                onClick={() => onSelect(location.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && locations.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {locations.length} {locations.length === 1 ? "location" : "locations"}
          </p>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// COMPLETENESS HEURISTIC
// ============================================================================

/**
 * Compute location completeness for the summary band.
 * Returns { filled, total } for display as "X/Y"
 */
function computeCompleteness(location) {
  const fields = [
    Boolean(location.name),
    Boolean(location.photoPath),
    Boolean(location.street || location.city),
    Boolean(location.phone),
    Boolean(location.notes),
  ];
  const filled = fields.filter(Boolean).length;
  return { filled, total: fields.length };
}

/**
 * Format timestamp for display
 */
function formatLastUpdated(timestamp) {
  if (!timestamp) return "—";

  // Handle Firestore Timestamp
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============================================================================
// SUMMARY METRICS BAND
// ============================================================================

function MetricSlot({ icon: Icon, label, value, variant = "default" }) {
  const variantStyles = {
    default: "text-slate-600 dark:text-slate-300",
    muted: "text-slate-400 dark:text-slate-500",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${variantStyles[variant]} opacity-60`} />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className={`text-sm font-semibold truncate ${variantStyles[variant]}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LocationSummaryBand({ location }) {
  const completeness = useMemo(
    () => computeCompleteness(location),
    [location]
  );

  const lastUpdated = formatLastUpdated(location.updatedAt || location.createdAt);

  return (
    <div className="flex items-center divide-x divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
      <MetricSlot
        icon={CheckCircle2}
        label="Completeness"
        value={`${completeness.filled}/${completeness.total}`}
      />
      <MetricSlot
        icon={Clock}
        label="Last updated"
        value={lastUpdated}
      />
    </div>
  );
}

// ============================================================================
// FACT ROW (for editable fields)
// ============================================================================

function FactRow({ label, value, isEditable, onSave, placeholder, type = "text", multiline = false }) {
  const isEmpty = !value || !value.trim();

  // Editable version
  if (isEditable && onSave) {
    return (
      <div className="py-2">
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <InlineEditField
          value={value || ""}
          onSave={onSave}
          placeholder={placeholder || `Add ${label.toLowerCase()}`}
          type={type}
          multiline={multiline}
          rows={multiline ? 4 : undefined}
          className="text-sm"
        />
      </div>
    );
  }

  // Read-only version
  return (
    <div className="py-2">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      {isEmpty ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">—</p>
      ) : (
        <p className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""} text-slate-900 dark:text-slate-100`}>
          {value}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// LOCATION DETAIL CANVAS (RIGHT PANEL) — R.9 Inspector Pattern
// ============================================================================

function LocationDetailCanvas({ location, canManage, onUpdate }) {
  // Field save handler — wraps onUpdate with field-specific logic
  const handleFieldSave = useCallback(async (field, value) => {
    if (!onUpdate) return;
    await onUpdate({ field, value });
  }, [onUpdate]);

  if (!location) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select a location
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose a location from the list to view its details, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  const name = (location.name || "Unnamed location").trim();

  return (
    <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE STAGE CONTAINER (matches ProfileCanvas R.7)
            ════════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">

          {/* ══════════════════════════════════════════════════════════════
              HERO / IDENTITY BLOCK
              ══════════════════════════════════════════════════════════════ */}
          <div className="p-6 pb-4">
            {/* Type badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                Location
              </span>
              {!canManage && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  View only
                </span>
              )}
            </div>

            {/* Hero image */}
            <div className="flex justify-center mb-5">
              <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                <Thumb
                  path={location.photoPath || null}
                  size={800}
                  alt={name}
                  className="w-full h-full"
                  imageClassName="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                    </div>
                  }
                />
              </div>
            </div>

            {/* Name — hero typographic anchor (inline editable) */}
            <div className="text-center mb-1">
              {canManage && onUpdate ? (
                <InlineEditField
                  value={name}
                  onSave={(val) => handleFieldSave("name", val)}
                  placeholder="Enter location name"
                  className="text-xl font-semibold text-slate-900 dark:text-slate-100 justify-center"
                  inputClassName="text-xl font-semibold text-center"
                />
              ) : (
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {name}
                </h1>
              )}
            </div>

            {/* Address summary line (read-only, computed) */}
            {(location.street || location.city) && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
                {formatAddress(location)}
              </p>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SUMMARY METRICS BAND
                ══════════════════════════════════════════════════════════════ */}
            <LocationSummaryBand location={location} />
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DETAILS SECTION — Inline Editable Fields
              ══════════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Address Details
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <FactRow
                label="Street"
                value={location.street || ""}
                isEditable={canManage}
                onSave={(val) => handleFieldSave("street", val)}
                placeholder="Add street address"
              />
              <FactRow
                label="Unit / Suite"
                value={location.unit || ""}
                isEditable={canManage}
                onSave={(val) => handleFieldSave("unit", val)}
                placeholder="Add unit"
              />
              <FactRow
                label="City"
                value={location.city || ""}
                isEditable={canManage}
                onSave={(val) => handleFieldSave("city", val)}
                placeholder="Add city"
              />
              <FactRow
                label="Province / State"
                value={location.province || ""}
                isEditable={canManage}
                onSave={(val) => handleFieldSave("province", val)}
                placeholder="Add province"
              />
              <FactRow
                label="Postal / ZIP"
                value={location.postal || ""}
                isEditable={canManage}
                onSave={(val) => handleFieldSave("postal", val)}
                placeholder="Add postal code"
              />
            </div>
          </div>

          {/* Contact Section */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Contact
            </h3>
            <FactRow
              label="Phone"
              value={location.phone || ""}
              isEditable={canManage}
              onSave={(val) => handleFieldSave("phone", val)}
              placeholder="Add phone number"
              type="tel"
            />
          </div>

          {/* Notes Section */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Notes
            </h3>
            <FactRow
              label="Access & Details"
              value={location.notes || ""}
              isEditable={canManage}
              onSave={(val) => handleFieldSave("notes", val)}
              placeholder="Add access instructions, parking details, loading notes..."
              multiline
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// HEADER BAND
// ============================================================================

function LocationsHeaderBand({ canManage, onCreateClick, locationCount }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Title + count */}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Locations
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Catalogue studios and on-site venues with reference photos and notes
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {locationCount > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {locationCount} {locationCount === 1 ? "location" : "locations"}
              </span>
            )}
            {canManage && (
              <Button onClick={onCreateClick} className="gap-1.5">
                <Plus className="w-4 h-4" />
                New location
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

function LocationsEmptyState({ canManage, onCreateClick }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No locations yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Locations help you organize where your shoots take place. Add studios,
          warehouses, outdoor venues, or any other shooting locations.
        </p>
        {canManage ? (
          <Button onClick={onCreateClick} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add your first location
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Producers can create and manage locations.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function LibraryLocationsPage() {
  // Auth & permissions
  const { clientId, role: globalRole, user } = useAuth();
  const canManage = canManageLocations(globalRole);

  // Data state
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Firestore path
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);

  // ══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const qy = query(collection(db, ...currentLocationsPath), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        setLocations(data);
        setLoading(false);
      },
      (err) => {
        console.error("[LibraryLocationsPage] Error loading locations:", err);
        setError(err?.message || "Unable to load locations.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId, currentLocationsPath]);

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERED LOCATIONS
  // ══════════════════════════════════════════════════════════════════════════

  const filteredLocations = useMemo(() => {
    const term = searchQuery.trim();
    if (!term) return locations;
    const searchResults = searchLocations(locations, term);
    return searchResults.map((result) => result.item);
  }, [locations, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTED LOCATION
  // ══════════════════════════════════════════════════════════════════════════

  const selectedLocation = useMemo(() => {
    if (!selectedId) return null;
    return locations.find((loc) => loc.id === selectedId) || null;
  }, [locations, selectedId]);

  // Auto-select first location when data loads and nothing is selected
  useEffect(() => {
    if (!loading && locations.length > 0 && !selectedId) {
      setSelectedId(locations[0].id);
    }
  }, [loading, locations, selectedId]);

  // Clear selection if selected location was deleted
  useEffect(() => {
    if (selectedId && !locations.find((loc) => loc.id === selectedId)) {
      setSelectedId(locations.length > 0 ? locations[0].id : null);
    }
  }, [locations, selectedId]);

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleCreateClick = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // LOCATION UPDATE HANDLER (R.9 — Inline Edit)
  // ══════════════════════════════════════════════════════════════════════════

  const handleLocationUpdate = useCallback(async ({ field, value }) => {
    if (!selectedId || !clientId) return;

    try {
      const docRef = doc(db, ...locationsPath(clientId), selectedId);
      await updateDoc(docRef, {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
      toast.success("Location updated");
    } catch (err) {
      console.error("[LibraryLocationsPage] Update failed:", err);
      throw new Error(err?.message || "Failed to update location");
    }
  }, [selectedId, clientId]);

  const handleCreateLocation = useCallback(async () => {
    // Delegate to the LocationCreateModal's internal handling
    // The modal will handle the Firestore write and close itself
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Loading state
  if (loading && locations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Loading locations...
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
            Unable to load locations
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no locations at all)
  if (!loading && locations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <LocationsHeaderBand
          canManage={canManage}
          onCreateClick={handleCreateClick}
          locationCount={0}
        />
        <LocationsEmptyState
          canManage={canManage}
          onCreateClick={handleCreateClick}
        />
        {canManage && (
          <LocationCreateModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onCreate={handleCreateLocation}
          />
        )}
      </div>
    );
  }

  // Main workspace layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header band */}
      <LocationsHeaderBand
        canManage={canManage}
        onCreateClick={handleCreateClick}
        locationCount={locations.length}
      />

      {/* Workspace: Rail + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <LocationRail
          locations={filteredLocations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={false}
        />

        {/* Right canvas (Inspector) */}
        <LocationDetailCanvas
          location={selectedLocation}
          canManage={canManage}
          onUpdate={handleLocationUpdate}
        />
      </div>

      {/* Create modal */}
      {canManage && (
        <LocationCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateLocation}
        />
      )}
    </div>
  );
}
