/**
 * LibraryLocationsPage — Canonical Full-Page Workspace Shell
 *
 * DESIGN PHILOSOPHY (L.1 Delta)
 * =============================
 * This page transforms the Library → Locations view into a workspace-style experience
 * following the Products V3 / Shot Editor V3 spatial language:
 *
 * LAYOUT:
 * - TOP: Header band with page title, search, and primary actions
 * - LEFT: Scannable location rail with search results
 * - RIGHT: Selected location detail canvas
 *
 * KEY CHANGES FROM LEGACY:
 * 1. Master-detail pattern replaces modal-first UX
 * 2. Location selection is local state (no URL routing per spec)
 * 3. Designed empty states for both rail and canvas
 * 4. Full-page workspace instead of admin table presentation
 *
 * DATA SOURCE:
 * - Firestore: clients/{clientId}/locations (via locationsPath)
 * - Real-time subscription via onSnapshot
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
import LocationCreateModal from "../components/locations/LocationCreateModal";
import {
  MapPin,
  Phone,
  FileText,
  Plus,
  Search,
  Building2,
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
// LOCATION DETAIL CANVAS (RIGHT PANEL)
// ============================================================================

function LocationDetailCanvas({ location, canManage, onEdit }) {
  if (!location) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800">
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
  const address = formatAddress(location);

  return (
    <main className="flex-1 overflow-auto bg-white dark:bg-slate-800">
      <div className="max-w-2xl mx-auto px-8 py-8">
        {/* Hero image */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-6">
          <Thumb
            path={location.photoPath || null}
            size={1200}
            alt={name}
            className="w-full h-full"
            imageClassName="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-500" />
              </div>
            }
          />
        </div>

        {/* Name */}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {name}
        </h1>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                Address
              </p>
              <p className="text-base text-slate-900 dark:text-slate-100">
                {address}
              </p>
            </div>
          </div>
        )}

        {/* Phone */}
        {location.phone && (
          <div className="flex items-start gap-3 mb-4">
            <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                Phone
              </p>
              <p className="text-base text-slate-900 dark:text-slate-100">
                {location.phone}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {location.notes && (
          <div className="flex items-start gap-3 mb-6">
            <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                Notes
              </p>
              <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {location.notes}
              </p>
            </div>
          </div>
        )}

        {/* Empty state for no details */}
        {!address && !location.phone && !location.notes && (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No additional details for this location.
            </p>
            {canManage && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Edit the location to add address, phone, or notes.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {canManage && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <Button variant="secondary" onClick={() => onEdit(location)}>
              Edit location
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

  const handleEdit = useCallback((location) => {
    // Inline editing for locations is planned for a future delta
    // For now, show a toast to inform the user
    toast.info(`Edit functionality for "${location.name || "this location"}" coming soon`);
  }, []);

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

        {/* Right canvas */}
        <LocationDetailCanvas
          location={selectedLocation}
          canManage={canManage}
          onEdit={handleEdit}
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
