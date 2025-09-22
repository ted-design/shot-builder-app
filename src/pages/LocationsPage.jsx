import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import LocationEditModal from "../components/locations/LocationEditModal";
import { useAuth } from "../context/AuthContext";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast } from "../lib/toast";
import { useFilePreview } from "../hooks/useFilePreview";
import { useStorageImage } from "../hooks/useStorageImage";
import { locationsPath } from "../lib/paths";
import { ROLE, canManageLocations } from "../lib/rbac";

const initialDraft = {
  name: "",
  street: "",
  unit: "",
  city: "",
  province: "",
  postal: "",
  phone: "",
  notes: "",
};

function formatAddress(location) {
  const { street, unit, city, province, postal } = location;
  const lineParts = [street, unit ? `Unit ${unit}` : null, city, province, postal].filter(Boolean);
  return lineParts.join(", ");
}

function LocationCard({ location, canManage, onEdit, onDelete, editDisabled, deleteDisabled }) {
  const imageUrl = useStorageImage(location.photoPath, { preferredSize: 640 });
  const address = formatAddress(location);
  const name = (location.name || "Unnamed location").trim();

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="aspect-video w-full overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>
        )}
      </div>
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
            <>
              <Button size="sm" variant="secondary" onClick={() => onEdit(location)} disabled={editDisabled}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(location)}
                disabled={deleteDisabled}
              >
                Delete
              </Button>
            </>
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
  const [draft, setDraft] = useState(initialDraft);
  const [draftFile, setDraftFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const createCardRef = useRef(null);
  const firstFieldRef = useRef(null);

  const { clientId, role: globalRole, user, claims } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageLocations(role);
  const currentLocationsPath = useMemo(() => locationsPath(clientId), [clientId]);

  const draftPreview = useFilePreview(draftFile);

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

  const resetDraft = () => {
    setDraft(initialDraft);
    setDraftFile(null);
  };

  const handleDraftChange = (field) => (event) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const pathSegments = currentLocationsPath;
    const targetPath = `/${pathSegments.join("/")}`;

    if (!user) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Locations] Create blocked: no authenticated user", {
        path: targetPath,
        ...authInfo,
      });
      setFormError("You must be signed in to add locations.");
      return;
    }

    if (!canManage) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Locations] Create blocked: role lacks manage permission", {
        path: targetPath,
        ...authInfo,
      });
      setFormError("You do not have permission to add locations.");
      return;
    }

    const authInfo = buildAuthDebugInfo();
    const name = (draft.name || "").trim();
    if (!name) {
      setFormError("Enter a location name.");
      return;
    }

    setFormError("");
    setCreating(true);

    console.info("[Locations] Attempting to create location", {
      path: targetPath,
      ...authInfo,
    });

    try {
      const docRef = await writeDoc("create location", () =>
        addDoc(collection(db, ...currentLocationsPath), {
          ...draft,
          name,
          shotIds: [],
          photoPath: null,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        })
      );

      console.info("[Locations] Location created", {
        path: targetPath,
        docId: docRef.id,
        ...authInfo,
      });

      let uploadError = null;
      if (draftFile) {
        try {
          const { path } = await uploadImageFile(draftFile, { folder: "locations", id: docRef.id });
          await updateDoc(docRef, { photoPath: path });
        } catch (error) {
          uploadError = error;
        }
      }

      resetDraft();
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
        const text = `${name} was added, but the photo upload failed (${code}: ${message}). Try again from the edit dialog.`;
        setFeedback({ type: "error", text });
        toast.error({ title: "Photo upload failed", description: `${code}: ${message}` });
      } else {
        setFeedback({ type: "success", text: `${name} was added to locations.` });
        notifySuccess(`${name} was added to locations.`);
      }
    } catch (error) {
      const { code, message } = describeFirebaseError(
        error,
        "Unable to create location. Check your connection and try again."
      );
      const description = `${code}: ${message}`;
      setFormError(`${message} (path: ${targetPath})`);
      console.error("[Locations] Failed to create location", {
        path: targetPath,
        ...authInfo,
        code,
        message,
        error,
      });
      toast.error({ title: "Failed to create location", description: `${description} (${targetPath})` });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (locationRecord) => {
    if (!canManage) {
      setFeedback({ type: "error", text: "You do not have permission to delete locations." });
      return;
    }
    const name = (locationRecord.name || "this location").trim();
    const confirmed = window.confirm(`Delete ${name}? This action cannot be undone.`);
    if (!confirmed) return;

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

  const scrollToCreateLocation = () => {
    if (!canManage) return;
    if (createCardRef.current) {
      createCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const focusField = () => {
      if (firstFieldRef.current) {
        try {
          firstFieldRef.current.focus({ preventScroll: true });
        } catch {
          firstFieldRef.current.focus();
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focusField);
    } else {
      focusField();
    }
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
            <Button type="button" onClick={scrollToCreateLocation} className="flex-none whitespace-nowrap">
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

      {canManage ? (
        <div ref={createCardRef}>
          <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Add location</h2>
            <p className="text-sm text-slate-500">
              Provide a name and optional details. Photos can be added or updated later from the edit dialog.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-create-name">
                  Name
                </label>
                <Input
                  id="location-create-name"
                  ref={firstFieldRef}
                  value={draft.name}
                  onChange={handleDraftChange("name")}
                  placeholder="Location name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-create-street">
                  Street address
                </label>
                <Input
                  id="location-create-street"
                  value={draft.street}
                  onChange={handleDraftChange("street")}
                  placeholder="Street address"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-create-unit">
                    Unit / Suite
                  </label>
                  <Input
                    id="location-create-unit"
                    value={draft.unit}
                    onChange={handleDraftChange("unit")}
                    placeholder="Unit (optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-create-city">
                    City
                  </label>
                  <Input
                    id="location-create-city"
                    value={draft.city}
                    onChange={handleDraftChange("city")}
                    placeholder="City"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-create-province">
                    Province / State
                  </label>
                  <Input
                    id="location-create-province"
                    value={draft.province}
                    onChange={handleDraftChange("province")}
                    placeholder="Province / State"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-create-postal">
                    Postal / ZIP
                  </label>
                  <Input
                    id="location-create-postal"
                    value={draft.postal}
                    onChange={handleDraftChange("postal")}
                    placeholder="Postal / ZIP"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-create-phone">
                  Phone
                </label>
                <Input
                  id="location-create-phone"
                  value={draft.phone}
                  onChange={handleDraftChange("phone")}
                  placeholder="Phone (optional)"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-create-notes">
                  Notes
                </label>
                <textarea
                  id="location-create-notes"
                  value={draft.notes}
                  onChange={handleDraftChange("notes")}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Access instructions, load-in, or parking notes"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-create-photo">
                  Photo
                </label>
                {draftPreview ? (
                  <img src={draftPreview} alt="Selected location preview" className="h-40 w-56 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-40 w-56 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                    Optional reference photo
                  </div>
                )}
                <Input
                  id="location-create-photo"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setDraftFile(nextFile);
                    if (event.target) {
                      event.target.value = "";
                    }
                  }}
                />
              </div>
              {formError && (
                <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{formError}</div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Saving…" : "Add Location"}
                </Button>
              </div>
            </form>
          </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Locations are read-only for your role. Producers can create and update venue records.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filteredLocations.map((entry) => (
          <LocationCard
            key={entry.id}
            location={entry}
            canManage={canManage}
            onEdit={setEditTarget}
            onDelete={handleDelete}
            editDisabled={editBusy && editTarget?.id === entry.id}
            deleteDisabled={pendingDeleteId === entry.id}
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

      {editTarget && (
        <LocationEditModal
          open={!!editTarget}
          location={editTarget}
          busy={editBusy}
          onClose={closeEditModal}
          onSave={handleSaveLocation}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
