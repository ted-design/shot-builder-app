import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Search, Plus, Pencil, MapPin, LayoutGrid, Table } from "lucide-react";
import { db, uploadImageFile } from "../lib/firebase";
import { locationsPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { useLocations } from "../hooks/useFirestoreQuery";
import { Button } from "../components/ui/button";
import { Input, Checkbox } from "../components/ui/input";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Card, CardContent } from "../components/ui/card";
import Thumb from "../components/Thumb";
import { readStorage, writeStorage } from "../lib/safeStorage";
import AssetSelectModal from "../components/shots/AssetSelectModal";
import LocationCreateModal from "../components/locations/LocationCreateModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { canManageLocations } from "../lib/rbac";
import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from "../lib/demoSafeFirestore";
import { writeDoc } from "../lib/firestoreWrites";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { toast } from "../lib/toast";

const VIEW_STORAGE_KEY = "catalogue:locations:viewMode";

const normaliseView = (value) => (value === "gallery" ? "gallery" : "table");

function formatAddress(location) {
  const street = location?.street || null;
  const unit = location?.unit ? `Unit ${location.unit}` : null;
  const city = location?.city || null;
  const province = location?.province || null;
  const postal = location?.postal || null;
  return [street, unit, city, province, postal].filter(Boolean).join(", ");
}

function LocationGalleryCard({ location }) {
  const name = (location.name || "Unnamed location").trim();
  const address = formatAddress(location);
  const badge = location.inProject ? (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
      In Project
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Available
    </span>
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Thumb
        path={location.photoPath || null}
        size={640}
        alt={name}
        className="aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900"
        imageClassName="h-full w-full object-cover"
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">No photo</div>
        }
      />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100" title={name}>
                <span className="block truncate">{name}</span>
              </div>
              {address ? (
                <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400" title={address}>
                  <span className="block truncate">{address}</span>
                </div>
              ) : null}
            </div>
            {badge}
          </div>
          {location.notes ? (
            <div className="text-xs text-neutral-500 dark:text-neutral-400" title={location.notes}>
              <span className="block truncate">{location.notes}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CatalogueLocationsPage
 *
 * Displays the Locations section of the Catalogue.
 * This page does NOT have the secondary sidebar (unlike People).
 */
export default function CatalogueLocationsPage() {
  const { clientId, user, role: globalRole } = useAuth();
  const { projectId } = useParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState(() => normaliseView(readStorage(VIEW_STORAGE_KEY)));
  const [openSelectModal, setOpenSelectModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const canManage = canManageLocations(globalRole);

  const {
    data: projectLocationsRaw = [],
    isLoading: loading,
    error,
  } = useLocations(clientId, {
    projectId,
    scope: "project",
    enabled: Boolean(clientId && projectId),
  });

  const { data: allLocationsRaw = [] } = useLocations(clientId, {
    scope: "all",
    enabled: Boolean(clientId),
  });

  const projectLocations = useMemo(() => {
    return (projectLocationsRaw || [])
      .slice()
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
  }, [projectLocationsRaw]);

  const projectLocationIds = useMemo(
    () => new Set(projectLocations.map((location) => location.id)),
    [projectLocations]
  );

  const availableLocations = useMemo(() => {
    return (allLocationsRaw || []).filter((location) => !projectLocationIds.has(location.id));
  }, [allLocationsRaw, projectLocationIds]);

  const addExistingLocationsToProject = async (ids) => {
    if (!clientId || !projectId) return;
    try {
      await Promise.all(
        ids.map((id) =>
          updateDoc(doc(db, ...locationsPath(clientId), id), {
            projectIds: arrayUnion(projectId),
          })
        )
      );
      toast.success({ title: `Added ${ids.length} location${ids.length === 1 ? "" : "s"} to project` });
    } catch (e) {
      console.error("[CatalogueLocationsPage] addExistingLocationsToProject failed", e);
      toast.error({ title: "Failed to add locations", description: e?.message });
    }
  };

  const createProjectLocation = async ({ name, street, unit, city, province, postal, phone, notes, photoFile }) => {
    if (!clientId || !projectId) throw new Error("Missing project");
    if (!user) throw new Error("You must be signed in to add locations.");
    if (!canManage) throw new Error("You do not have permission to add locations.");

    const trimmedName = (name || "").trim();
    if (!trimmedName) throw new Error("Enter a location name.");

    setCreateBusy(true);
    try {
      const payload = {
        name: trimmedName,
        street: (street || "").trim(),
        unit: (unit || "").trim(),
        city: (city || "").trim(),
        province: (province || "").trim(),
        postal: (postal || "").trim(),
        phone: (phone || "").trim(),
        notes: (notes || "").trim(),
        shotIds: [],
        projectIds: [projectId],
        photoPath: null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      };

      const docRef = await writeDoc("create location", () =>
        addDoc(collection(db, ...locationsPath(clientId)), payload)
      );

      if (photoFile) {
        const { path } = await uploadImageFile(photoFile, { folder: "locations", id: docRef.id });
        await updateDoc(doc(db, ...locationsPath(clientId), docRef.id), { photoPath: path });
      }

      toast.success({ title: `${payload.name} added to project locations` });
    } catch (error) {
      const { code, message } = describeFirebaseError(error, "Unable to create location.");
      throw new Error(`${code}: ${message}`);
    } finally {
      setCreateBusy(false);
    }
  };

  // Filter locations by search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) {
      return projectLocations.map((location) => ({ ...location, inProject: true }));
    }
    const q = searchQuery.toLowerCase();
    return projectLocations
      .map((location) => ({ ...location, inProject: true }))
      .filter(
      (loc) =>
        (loc.name || "").toLowerCase().includes(q) ||
        (loc.address || "").toLowerCase().includes(q) ||
        (loc.notes || "").toLowerCase().includes(q)
      );
  }, [projectLocations, searchQuery]);

  // Toggle selection
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

  const toggleAll = () => {
    if (selectedIds.size === filteredLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLocations.map((l) => l.id)));
    }
  };

  const allSelected = filteredLocations.length > 0 && selectedIds.size === filteredLocations.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredLocations.length;

  useEffect(() => {
    writeStorage(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-slate-600 dark:text-slate-400">
        Select a project to view its catalogue.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load locations</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            Locations
          </h1>
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex text-sm font-medium">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                aria-label="List view"
              >
                <Table className="h-4 w-4" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
                  viewMode === "gallery"
                    ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                aria-label="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={!canManage}>
                  <Plus className="h-4 w-4" />
                  Add Location
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={!canManage}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpenSelectModal(true);
                  }}
                >
                  Add existing from org
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canManage}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpenCreateModal(true);
                  }}
                >
                  Create new location
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search locations..."
              className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* List / Cards */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === "gallery" ? (
          filteredLocations.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 dark:text-slate-400">
              No locations found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredLocations.map((location) => (
                <LocationGalleryCard key={location.id} location={location} />
              ))}
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="w-[50px] px-3 py-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Address
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Notes
                  </th>
                  <th className="w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="w-[50px] px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-slate-500 dark:text-slate-400">
                      No locations found.
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map((location) => {
                    const address = formatAddress(location);
                    return (
                      <tr key={location.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={selectedIds.has(location.id)}
                            onCheckedChange={() => toggleSelection(location.id)}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {location.name || "Unnamed"}
                        </td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                          {address || "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                          {location.notes || "—"}
                        </td>
                        <td className="px-3 py-3">
                          {location.inProject ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              In Project
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-sm">
                              Available
                            </span>
                          )}
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
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {openSelectModal ? (
        <AssetSelectModal
          open={openSelectModal}
          onClose={() => setOpenSelectModal(false)}
          title="Add Locations to Project"
          items={availableLocations}
          alreadyInProject={new Set()}
          onSave={addExistingLocationsToProject}
        />
      ) : null}

      {canManage ? (
        <LocationCreateModal
          open={openCreateModal}
          busy={createBusy}
          onClose={() => setOpenCreateModal(false)}
          onCreate={createProjectLocation}
        />
      ) : null}
    </>
  );
}
