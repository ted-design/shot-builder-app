import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "../lib/demoSafeFirestore";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PageHeader } from "../components/ui/PageHeader";
import ExpandableSearch from "../components/overview/ExpandableSearch";
import ExportButton from "../components/common/ExportButton";
import ViewModeMenu from "../components/overview/ViewModeMenu";
import DensityMenu from "../components/overview/DensityMenu";
import FieldSettingsMenu from "../components/overview/FieldSettingsMenu";
import { searchLocations } from "../lib/search";
import Thumb from "../components/Thumb";
import LocationCreateModal from "../components/locations/LocationCreateModal";
import LocationEditModal from "../components/locations/LocationEditModal";
import CreateLocationCard from "../components/locations/CreateLocationCard";
import { useAuth } from "../context/AuthContext";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast, showConfirm } from "../lib/toast";
import { locationsPath } from "../lib/paths";
import { ROLE, canManageLocations } from "../lib/rbac";
import { LayoutGrid, MapPin, Table } from "lucide-react";
import { readStorage, writeStorage } from "../lib/safeStorage";

function formatAddress(location) {
  const { street, unit, city, province, postal } = location;
  const lineParts = [street, unit ? `Unit ${unit}` : null, city, province, postal].filter(Boolean);
  return lineParts.join(", ");
}

const VIEW_STORAGE_KEY = "locations:viewMode";
const FIELD_PREFS_STORAGE_KEY = "locations:fieldPrefs";
const DENSITY_STORAGE_KEY = "locations:density";

const VIEW_OPTIONS = [
  { value: "gallery", label: "Gallery", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Table },
];

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfy" },
];

const DENSITY_CONFIG = {
  compact: {
    cardPadding: "p-2.5",
    gridGap: "gap-2",
    imageClass: "aspect-[4/3] h-28",
    tableRow: "py-1.5",
    tablePadding: "px-2.5",
    tableText: "text-xs",
  },
  comfortable: {
    cardPadding: "p-4",
    gridGap: "gap-4",
    imageClass: "aspect-video",
    tableRow: "py-3",
    tablePadding: "px-4",
    tableText: "text-sm",
  },
};

const LOCATION_FIELD_OPTIONS = [
  { key: "preview", label: "Preview" },
  { key: "name", label: "Name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "notes", label: "Notes" },
];

const DEFAULT_FIELD_VISIBILITY = {
  preview: true,
  name: true,
  address: true,
  phone: true,
  notes: true,
};

const FIELD_KEYS = LOCATION_FIELD_OPTIONS.map((f) => f.key);

const normaliseView = (value) => (value === "table" ? "table" : "gallery");
const normaliseDensity = (value) => (value === "compact" ? "compact" : "comfortable");
const normaliseOrder = (order) => {
  if (!Array.isArray(order)) return FIELD_KEYS;
  const base = order.filter((k) => FIELD_KEYS.includes(k));
  return [...base, ...FIELD_KEYS.filter((k) => !base.includes(k))];
};

const readFieldPrefs = () => {
  const visibility = { ...DEFAULT_FIELD_VISIBILITY };
  let order = [...FIELD_KEYS];
  let locked = [];
  try {
    const raw = readStorage(FIELD_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.visibility) {
        FIELD_KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(parsed.visibility, key)) {
            visibility[key] = Boolean(parsed.visibility[key]);
          }
        });
      }
      if (parsed?.order) order = normaliseOrder(parsed.order);
      if (Array.isArray(parsed?.locked)) locked = parsed.locked.filter((k) => FIELD_KEYS.includes(k));
    }
  } catch {}
  return { visibility, order, locked };
};

function LocationCard({ location, canManage, onEdit, editDisabled, visibility, densityKey }) {
  const address = formatAddress(location);
  const name = (location.name || "Unnamed location").trim();
  const showPreview = visibility?.preview !== false;
  const showName = visibility?.name !== false;
  const showAddress = visibility?.address !== false;
  const showPhone = visibility?.phone !== false;
  const showNotes = visibility?.notes !== false;
  const densityConfig = DENSITY_CONFIG[densityKey] || DENSITY_CONFIG.comfortable;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {showPreview && (
        <Thumb
          path={location.photoPath || null}
          size={640}
          alt={name}
          className={`${densityConfig.imageClass || "aspect-video"} w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900`}
          imageClassName="h-full w-full object-cover"
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">No photo</div>
          }
        />
      )}
      <CardContent className={`flex flex-1 flex-col gap-3 ${densityConfig.cardPadding || ""}`}>
        <div className="space-y-1">
          {showName && (
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100" title={name}>
              <span className="block truncate">{name}</span>
            </div>
          )}
          {showAddress && address && (
            <div className="flex items-start gap-1.5 text-sm text-neutral-600 dark:text-neutral-400" title={address}>
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
              <span className="block truncate">{address}</span>
            </div>
          )}
          {showPhone && location.phone && (
            <div className="text-sm text-neutral-600 dark:text-neutral-400" title={location.phone}>
              <span className="block truncate">☎ {location.phone}</span>
            </div>
          )}
          {showNotes && location.notes && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400" title={location.notes}>
              <span className="block truncate">{location.notes}</span>
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {canManage ? (
            <Button size="sm" variant="secondary" onClick={() => onEdit(location)} disabled={editDisabled}>
              Edit
            </Button>
          ) : (
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Read only</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState(() => normaliseView(readStorage(VIEW_STORAGE_KEY)));
  const [density, setDensity] = useState(() => normaliseDensity(readStorage(DENSITY_STORAGE_KEY)));
  const initialFieldPrefs = useMemo(() => readFieldPrefs(), []);
  const [fieldVisibility, setFieldVisibility] = useState(initialFieldPrefs.visibility);
  const [fieldOrder, setFieldOrder] = useState(initialFieldPrefs.order);
  const [lockedFields, setLockedFields] = useState(initialFieldPrefs.locked);

  const { clientId, role: globalRole, user, claims } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageLocations(role);
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);
  const selectPortalTarget =
    typeof window === "undefined" ? undefined : window.document.body;

  const buildAuthDebugInfo = useCallback(
    () => ({
      uid: user?.uid ?? null,
      claims: {
        role: claims?.role ?? null,
        clientId: claims?.clientId ?? null,
        orgId: claims?.orgId ?? null,
      },
    }),
    [user, claims]
  );

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, ...currentLocationsPath), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        setLocations(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })));
        setLoading(false);
      },
      (error) => {
        setFeedback({ type: "error", text: error?.message || "Unable to load locations." });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentLocationsPath]);

  const filteredLocations = useMemo(() => {
    const term = queryText.trim();
    if (!term) return locations;

    const searchResults = searchLocations(locations, term);
    return searchResults.map((result) => result.item);
  }, [locations, queryText]);

  useEffect(() => {
    if (!editTarget) return;
    const latest = locations.find((entry) => entry.id === editTarget.id);
    if (latest && latest !== editTarget) {
      setEditTarget(latest);
    }
  }, [locations, editTarget]);

  const notifySuccess = (message) => {
    toast.success(message);
  };

  const handleCreateLocation = async ({
    name,
    street,
    unit,
    city,
    province,
    postal,
    phone,
    notes,
    photoFile,
  }) => {
    const pathSegments = currentLocationsPath;
    const targetPath = `/${pathSegments.join("/")}`;

    if (!user) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Locations] Create blocked: no authenticated user", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You must be signed in to add locations.");
    }

    if (!canManage) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Locations] Create blocked: role lacks manage permission", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You do not have permission to add locations.");
    }

    const authInfo = buildAuthDebugInfo();
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      throw new Error("Enter a location name.");
    }

    setCreating(true);

    console.info("[Locations] Attempting to create location", {
      path: targetPath,
      ...authInfo,
    });

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
        photoPath: null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      };

      const docRef = await writeDoc("create location", () =>
        addDoc(collection(db, ...currentLocationsPath), {
          ...payload,
        })
      );

      console.info("[Locations] Location created", {
        path: targetPath,
        docId: docRef.id,
        ...authInfo,
      });

      let uploadError = null;
      if (photoFile) {
        try {
          const { path } = await uploadImageFile(photoFile, { folder: "locations", id: docRef.id });
          await updateDoc(docRef, { photoPath: path });
        } catch (error) {
          uploadError = error;
        }
      }

      if (uploadError) {
        const { code, message } = describeFirebaseError(uploadError, "Photo upload failed.");
        console.error("[Locations] Photo upload failed", {
          path: targetPath,
          docId: docRef.id,
          ...authInfo,
          code,
          message,
          error: uploadError,
        });
        const text = `${trimmedName} was added, but the photo upload failed (${code}: ${message}). Try again from the edit dialog.`;
        setFeedback({ type: "error", text });
        toast.error({ title: "Photo upload failed", description: `${code}: ${message}` });
      } else {
        setFeedback({ type: "success", text: `${trimmedName} was added to locations.` });
        notifySuccess(`${trimmedName} was added to locations.`);
      }
    } catch (error) {
      const { code, message } = describeFirebaseError(
        error,
        "Unable to create location. Check your connection and try again."
      );
      console.error("[Locations] Failed to create location", {
        path: targetPath,
        ...authInfo,
        code,
        message,
        error,
      });
      toast.error({ title: "Failed to create location", description: `${code}: ${message} (${targetPath})` });
      throw new Error(`${message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (locationRecord, options = {}) => {
    if (!canManage) {
      setFeedback({ type: "error", text: "You do not have permission to delete locations." });
      return;
    }
    const name = (locationRecord.name || "this location").trim();
    if (!options?.skipPrompt) {
      const confirmed = await showConfirm(`Delete ${name}? This action cannot be undone.`);
      if (!confirmed) return;
    }

    setPendingDeleteId(locationRecord.id);
    try {
      await deleteDoc(doc(db, ...currentLocationsPath, locationRecord.id));
      if (locationRecord.photoPath) {
        try {
          await deleteImageByPath(locationRecord.photoPath);
        } catch (error) {
          setFeedback({
            type: "error",
            text: `${name} was removed, but the photo cleanup failed: ${error?.message || error}`,
          });
          setPendingDeleteId(null);
          if (editTarget?.id === locationRecord.id) setEditTarget(null);
          return;
        }
      }
      setFeedback({ type: "success", text: `${name} was deleted.` });
      if (editTarget?.id === locationRecord.id) setEditTarget(null);
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to delete location." });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleSaveLocation = async ({ updates, newImageFile, removeImage }) => {
    if (!canManage) {
      throw new Error("You do not have permission to edit locations.");
    }
    if (!editTarget?.id) {
      throw new Error("No location selected for editing.");
    }

    const targetId = editTarget.id;
    const docRef = doc(db, ...currentLocationsPath, targetId);
    setEditBusy(true);
    try {
      await updateDoc(docRef, updates);

      if (newImageFile) {
        const { path } = await uploadImageFile(newImageFile, { folder: "locations", id: targetId });
        await updateDoc(docRef, { photoPath: path });
        if (editTarget.photoPath) {
          try {
            await deleteImageByPath(editTarget.photoPath);
          } catch {
            // Ignore cleanup failure; stale file can be removed later.
          }
        }
      } else if (removeImage && editTarget.photoPath) {
        await updateDoc(docRef, { photoPath: null });
        try {
          await deleteImageByPath(editTarget.photoPath);
        } catch {
          // Ignore cleanup failure; stale file can be removed later.
        }
      }

      const name = updates.name || editTarget.name || "Location";
      setFeedback({ type: "success", text: `Saved changes for ${name}.` });
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to update location." });
      throw error;
    } finally {
      setEditBusy(false);
    }
  };

  const closeEditModal = () => setEditTarget(null);

  const openCreateModal = () => {
    setEditTarget(null);
    setCreateModalOpen(true);
  };

  const openEditModal = (location) => {
    setCreateModalOpen(false);
    setEditTarget(location);
  };

  const renderTableView = () => {
    if (!filteredLocations.length) {
      return (
        <Card className="mx-6">
          <CardContent className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No locations match the current filters.
          </CardContent>
        </Card>
      );
    }

    const visibility = resolvedVisibility;
    const columns = resolvedOrder
      .map((key) => {
        switch (key) {
          case "preview":
            return { key, label: "Preview" };
          case "name":
            return { key, label: "Name" };
          case "address":
            return { key, label: "Address" };
          case "phone":
            return { key, label: "Phone" };
          case "notes":
            return { key, label: "Notes" };
          default:
            return null;
        }
      })
      .filter(Boolean)
      .filter((col) => visibility[col.key] !== false);

    return (
      <Card className="mx-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                      {col.label}
                    </th>
                  ))}
                  <th className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {filteredLocations.map((location) => {
                  const address = formatAddress(location);
                  return (
                    <tr
                      key={location.id}
                      className="odd:bg-white even:bg-slate-50/40 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800"
                    >
                      {columns.map((col) => {
                        if (col.key === "preview") {
                          return (
                            <td key="preview" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <Thumb
                                path={location.photoPath || null}
                                size={240}
                                alt={location.name || "Location preview"}
                                className="h-16 w-24 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"
                                imageClassName="h-full w-full object-cover"
                                fallback={
                                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                                    No photo
                                  </div>
                                }
                              />
                            </td>
                          );
                        }
                        if (col.key === "name") {
                          return (
                            <td key="name" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} font-semibold text-slate-900 dark:text-slate-100`}>
                                {location.name || "Unnamed location"}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "address") {
                          return (
                            <td key="address" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{address || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "phone") {
                          return (
                            <td key="phone" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400`}>{location.phone || "—"}</div>
                            </td>
                          );
                        }
                        if (col.key === "notes") {
                          return (
                            <td key="notes" className={`${densityConfig.tablePadding} ${densityConfig.tableRow}`}>
                              <div className={`${densityConfig.tableText} text-slate-600 dark:text-slate-400 line-clamp-2`}>
                                {location.notes || "—"}
                              </div>
                            </td>
                          );
                        }
                        return null;
                      })}
                      <td className={`${densityConfig.tablePadding} ${densityConfig.tableRow} text-right`}>
                        {canManage ? (
                          <Button size="sm" variant="secondary" onClick={() => openEditModal(location)} disabled={editBusy && editTarget?.id === location.id}>
                            Edit
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };
  useEffect(() => {
    writeStorage(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(DENSITY_STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    try {
      writeStorage(
        FIELD_PREFS_STORAGE_KEY,
        JSON.stringify({ visibility: fieldVisibility, order: fieldOrder, locked: lockedFields })
      );
    } catch {}
  }, [fieldVisibility, fieldOrder, lockedFields]);

  const resolvedVisibility = useMemo(
    () => ({ ...DEFAULT_FIELD_VISIBILITY, ...(fieldVisibility || {}) }),
    [fieldVisibility]
  );
  const resolvedOrder = useMemo(() => normaliseOrder(fieldOrder), [fieldOrder]);
  const resolvedDensity = DENSITY_CONFIG[density] ? density : "comfortable";
  const densityConfig = DENSITY_CONFIG[resolvedDensity] || DENSITY_CONFIG.comfortable;

  const toggleFieldVisibility = useCallback(
    (key) => {
      if (lockedFields.includes(key)) return;
      setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [lockedFields]
  );

  const toggleFieldLock = useCallback((key) => {
    setLockedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const handleFieldOrderChange = useCallback((next) => {
    setFieldOrder(normaliseOrder(next));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader sticky={true} className="top-14 z-40">
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Locations</PageHeader.Title>
            <PageHeader.Description>
              Catalogue studios and on-site venues with reference photos and notes.
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div className="flex flex-wrap items-center gap-3">
              <ExpandableSearch
                value={queryText}
                onChange={setQueryText}
                placeholder="Search locations by name, address, or notes..."
                ariaLabel="Search locations"
              />
              <ViewModeMenu
                options={VIEW_OPTIONS}
                value={viewMode}
                onChange={(value) => setViewMode(normaliseView(value))}
              />
              <DensityMenu
                options={DENSITY_OPTIONS}
                value={resolvedDensity}
                onChange={(value) => setDensity(normaliseDensity(value))}
              />
              <FieldSettingsMenu
                fields={LOCATION_FIELD_OPTIONS}
                visibleMap={resolvedVisibility}
                lockedKeys={lockedFields}
                order={resolvedOrder}
                onToggleVisible={toggleFieldVisibility}
                onToggleLock={toggleFieldLock}
                onReorder={handleFieldOrderChange}
              />
              <ExportButton data={filteredLocations} entityType="locations" />
              {canManage && (
                <Button type="button" onClick={openCreateModal} className="flex-none whitespace-nowrap">
                  New location
                </Button>
              )}
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      {feedback && (
        <div
          className={`mx-6 rounded-md px-4 py-2 text-sm ${
            feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!canManage && (
        <div className="mx-6 rounded-card border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-600 dark:text-neutral-400">
          Locations are read-only for your role. Producers can create and update venue records.
        </div>
      )}

      {viewMode === "table" ? (
        renderTableView()
      ) : (
        <div
          className={`mx-6 grid ${
            resolvedDensity === "compact"
              ? `${densityConfig.gridGap} sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`
              : `${densityConfig.gridGap} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6`
          }`}
        >
          {canManage && <CreateLocationCard onClick={openCreateModal} disabled={creating} />}
          {filteredLocations.map((entry) => (
            <LocationCard
              key={entry.id}
              location={entry}
              canManage={canManage}
              onEdit={openEditModal}
              editDisabled={editBusy && editTarget?.id === entry.id}
              visibility={resolvedVisibility}
              densityKey={resolvedDensity}
            />
          ))}
          {!loading && !filteredLocations.length && (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
              <CardContent className="p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                No locations match the current filters.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {canManage && (
        <LocationCreateModal
          open={createModalOpen}
          busy={creating}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateLocation}
          selectPortalTarget={selectPortalTarget}
        />
      )}

      {editTarget && (
        <LocationEditModal
          open={!!editTarget}
          location={editTarget}
          busy={editBusy}
          onClose={closeEditModal}
          onSave={handleSaveLocation}
          onDelete={handleDelete}
          selectPortalTarget={selectPortalTarget}
        />
      )}
    </div>
  );
}
