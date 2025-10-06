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
} from "firebase/firestore";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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

function formatAddress(location) {
  const { street, unit, city, province, postal } = location;
  const lineParts = [street, unit ? `Unit ${unit}` : null, city, province, postal].filter(Boolean);
  return lineParts.join(", ");
}

function LocationCard({ location, canManage, onEdit, editDisabled }) {
  const address = formatAddress(location);
  const name = (location.name || "Unnamed location").trim();

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Thumb
        path={location.photoPath || null}
        size={640}
        alt={name}
        className="aspect-video w-full overflow-hidden bg-slate-100"
        imageClassName="h-full w-full object-cover"
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>
        }
      />
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="space-y-1">
          <div className="text-base font-semibold text-slate-900" title={name}>
            <span className="block truncate">{name}</span>
          </div>
          {address && (
            <div className="text-sm text-slate-600" title={address}>
              <span className="block truncate">{address}</span>
            </div>
          )}
          {location.phone && (
            <div className="text-sm text-slate-600" title={location.phone}>
              <span className="block truncate">☎ {location.phone}</span>
            </div>
          )}
          {location.notes && (
            <div className="text-xs text-slate-500" title={location.notes}>
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
            <div className="text-xs text-slate-500">Read only</div>
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
    const term = queryText.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((entry) => {
      const haystack = [
        entry.name,
        entry.street,
        entry.unit,
        entry.city,
        entry.province,
        entry.postal,
        entry.notes,
        entry.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
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

  return (
    <div className="space-y-6">
      <div className="sticky inset-x-0 top-14 z-20 border-b border-slate-200 bg-white/95 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-none text-2xl font-semibold text-slate-900">Locations</h1>
          <Input
            placeholder="Search locations by name, address, or notes..."
            aria-label="Search locations"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            className="min-w-[200px] flex-1"
          />
          {canManage && (
            <Button type="button" onClick={openCreateModal} className="flex-none whitespace-nowrap">
              New location
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-600">
        Catalogue studios and on-site venues with reference photos and notes.
      </p>

      {feedback && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!canManage && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Locations are read-only for your role. Producers can create and update venue records.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {canManage && <CreateLocationCard onClick={openCreateModal} disabled={creating} />}
        {filteredLocations.map((entry) => (
          <LocationCard
            key={entry.id}
            location={entry}
            canManage={canManage}
            onEdit={openEditModal}
            editDisabled={editBusy && editTarget?.id === entry.id}
          />
        ))}
        {!loading && !filteredLocations.length && (
          <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No locations match the current filters.
            </CardContent>
          </Card>
        )}
      </div>

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
