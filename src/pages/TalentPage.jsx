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
import TalentEditModal from "../components/talent/TalentEditModal";
import { useAuth } from "../context/AuthContext";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast } from "../lib/toast";
import { useFilePreview } from "../hooks/useFilePreview";
import { useStorageImage } from "../hooks/useStorageImage";
import { talentPath } from "../lib/paths";
import { ROLE, canManageTalent } from "../lib/rbac";

const initialDraft = {
  firstName: "",
  lastName: "",
  agency: "",
  phone: "",
  email: "",
  sizing: "",
  url: "",
  gender: "",
};

function buildDisplayName(firstName, lastName) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed talent";
}

function formatContact(info = {}) {
  return [info.phone, info.email].filter(Boolean).join(" • ");
}

function TalentCard({ talent, canManage, onEdit, onDelete, editDisabled, deleteDisabled }) {
  const imageUrl = useStorageImage(talent.headshotPath, { preferredSize: 480 });
  const displayName = talent.name || buildDisplayName(talent.firstName, talent.lastName);
  const contactLine = formatContact(talent);
  const sizingLine = talent.sizing ? `Sizing: ${talent.sizing}` : "";

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="space-y-1">
          <div className="text-base font-semibold text-slate-900" title={displayName}>
            <span className="block truncate">{displayName}</span>
          </div>
          {talent.agency && (
            <div className="text-sm text-slate-600" title={talent.agency}>
              <span className="block truncate">{talent.agency}</span>
            </div>
          )}
          {contactLine && (
            <div className="text-sm text-slate-600" title={contactLine}>
              <span className="block truncate">{contactLine}</span>
            </div>
          )}
          {talent.gender && (
            <div className="text-xs uppercase tracking-wide text-slate-500">{talent.gender}</div>
          )}
          {sizingLine && (
            <div className="text-xs text-slate-500" title={sizingLine}>
              <span className="block truncate">{sizingLine}</span>
            </div>
          )}
          {talent.url && (
            <a
              href={talent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
              title={talent.url}
            >
              <span className="block truncate">{talent.url}</span>
            </a>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onEdit(talent)} disabled={editDisabled}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(talent)}
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

export default function TalentPage() {
  const [talent, setTalent] = useState([]);
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
  const canManage = canManageTalent(role);
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);

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
    const qy = query(collection(db, ...currentTalentPath), orderBy("lastName", "asc"));
    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        setTalent(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })));
        setLoading(false);
      },
      (error) => {
        setFeedback({ type: "error", text: error?.message || "Unable to load talent." });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentTalentPath]);

  const filteredTalent = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    if (!term) return talent;
    return talent.filter((entry) => {
      const haystack = [
        entry.name,
        entry.firstName,
        entry.lastName,
        entry.agency,
        entry.email,
        entry.phone,
        entry.sizing,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [talent, queryText]);

  useEffect(() => {
    if (!editTarget) return;
    const latest = talent.find((entry) => entry.id === editTarget.id);
    if (latest && latest !== editTarget) {
      setEditTarget(latest);
    }
  }, [talent, editTarget]);

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
    const pathSegments = currentTalentPath;
    const targetPath = `/${pathSegments.join("/")}`;

    if (!user) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: no authenticated user", {
        path: targetPath,
        ...authInfo,
      });
      setFormError("You must be signed in to add talent.");
      return;
    }

    if (!canManage) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: role lacks manage permission", {
        path: targetPath,
        ...authInfo,
      });
      setFormError("You do not have permission to add talent.");
      return;
    }

    const authInfo = buildAuthDebugInfo();
    const first = (draft.firstName || "").trim();
    const last = (draft.lastName || "").trim();
    if (!first && !last) {
      setFormError("Enter at least a first or last name.");
      return;
    }

    setFormError("");
    setCreating(true);
    const name = buildDisplayName(first, last);

    console.info("[Talent] Attempting to create talent", {
      path: targetPath,
      ...authInfo,
    });

    try {
      const docRef = await writeDoc("create talent", () =>
        addDoc(collection(db, ...currentTalentPath), {
          ...draft,
          firstName: first,
          lastName: last,
          name,
          shotIds: [],
          headshotPath: null,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        })
      );

      console.info("[Talent] Talent created", {
        path: targetPath,
        docId: docRef.id,
        ...authInfo,
      });

      let uploadError = null;
      if (draftFile) {
        try {
          const { path } = await uploadImageFile(draftFile, { folder: "talent", id: docRef.id });
          await updateDoc(docRef, { headshotPath: path });
        } catch (error) {
          uploadError = error;
        }
      }

      resetDraft();
      if (uploadError) {
        const { code, message } = describeFirebaseError(
          uploadError,
          "Headshot upload failed."
        );
        console.error("[Talent] Headshot upload failed", {
          path: targetPath,
          docId: docRef.id,
          ...authInfo,
          code,
          message,
          error: uploadError,
        });
        const text = `${name} was added, but the headshot upload failed (${code}: ${message}). Try again from the edit dialog.`;
        setFeedback({ type: "error", text });
        toast.error({ title: "Headshot upload failed", description: `${code}: ${message}` });
      } else {
        setFeedback({ type: "success", text: `${name} was added to talent.` });
        notifySuccess(`${name} was added to talent.`);
      }
    } catch (error) {
      const { code, message } = describeFirebaseError(
        error,
        "Unable to create talent. Check your connection and try again."
      );
      const description = `${code}: ${message}`;
      setFormError(`${message} (path: ${targetPath})`);
      console.error("[Talent] Failed to create talent", {
        path: targetPath,
        ...authInfo,
        code,
        message,
        error,
      });
      toast.error({ title: "Failed to create talent", description: `${description} (${targetPath})` });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (talentRecord) => {
    if (!canManage) {
      setFeedback({ type: "error", text: "You do not have permission to delete talent." });
      return;
    }
    const displayName = talentRecord.name || buildDisplayName(talentRecord.firstName, talentRecord.lastName);
    const confirmed = window.confirm(`Delete ${displayName}? This action cannot be undone.`);
    if (!confirmed) return;

    setPendingDeleteId(talentRecord.id);
    try {
      await deleteDoc(doc(db, ...currentTalentPath, talentRecord.id));
      if (talentRecord.headshotPath) {
        try {
          await deleteImageByPath(talentRecord.headshotPath);
        } catch (error) {
          setFeedback({
            type: "error",
            text: `${displayName} was removed, but the headshot cleanup failed: ${error?.message || error}`,
          });
          setPendingDeleteId(null);
          if (editTarget?.id === talentRecord.id) setEditTarget(null);
          return;
        }
      }
      setFeedback({ type: "success", text: `${displayName} was deleted.` });
      if (editTarget?.id === talentRecord.id) setEditTarget(null);
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to delete talent." });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleSaveTalent = async ({ updates, newImageFile, removeImage }) => {
    if (!canManage) {
      throw new Error("You do not have permission to edit talent.");
    }
    if (!editTarget?.id) {
      throw new Error("No talent selected for editing.");
    }

    const targetId = editTarget.id;
    const docRef = doc(db, ...currentTalentPath, targetId);
    setEditBusy(true);
    try {
      await updateDoc(docRef, updates);

      if (newImageFile) {
        const { path } = await uploadImageFile(newImageFile, { folder: "talent", id: targetId });
        await updateDoc(docRef, { headshotPath: path });
        if (editTarget.headshotPath) {
          try {
            await deleteImageByPath(editTarget.headshotPath);
          } catch {
            // Ignore cleanup failure; stale file can be removed later.
          }
        }
      } else if (removeImage && editTarget.headshotPath) {
        await updateDoc(docRef, { headshotPath: null });
        try {
          await deleteImageByPath(editTarget.headshotPath);
        } catch {
          // Ignore cleanup failure; stale file can be removed later.
        }
      }

      const name = updates.name || buildDisplayName(updates.firstName, updates.lastName);
      setFeedback({ type: "success", text: `Saved changes for ${name}.` });
    } catch (error) {
      setFeedback({ type: "error", text: error?.message || "Unable to update talent." });
      throw error;
    } finally {
      setEditBusy(false);
    }
  };

  const closeEditModal = () => setEditTarget(null);

  const scrollToCreateTalent = () => {
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
      <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Talent</h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Input
              placeholder="Search talent by name, agency, or contact..."
              aria-label="Search talent"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              className="w-full sm:w-72 lg:w-96"
            />
            {canManage && (
              <Button type="button" onClick={scrollToCreateTalent} className="w-full sm:w-auto">
                New talent
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        Track models, their agencies, and wardrobe notes for the active project.
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
            <h2 className="text-lg font-semibold text-slate-900">Add talent</h2>
            <p className="text-sm text-slate-500">
              Provide at least a first or last name. Headshots are optional and can be uploaded later.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-first">
                    First name
                  </label>
                  <Input
                    id="talent-create-first"
                    ref={firstFieldRef}
                    value={draft.firstName}
                    onChange={handleDraftChange("firstName")}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-last">
                    Last name
                  </label>
                  <Input
                    id="talent-create-last"
                    value={draft.lastName}
                    onChange={handleDraftChange("lastName")}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-agency">
                    Agency
                  </label>
                  <Input
                    id="talent-create-agency"
                    value={draft.agency}
                    onChange={handleDraftChange("agency")}
                    placeholder="Agency (optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-gender">
                    Gender
                  </label>
                  <Input
                    id="talent-create-gender"
                    value={draft.gender}
                    onChange={handleDraftChange("gender")}
                    placeholder="Gender (optional)"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-phone">
                    Phone
                  </label>
                  <Input
                    id="talent-create-phone"
                    value={draft.phone}
                    onChange={handleDraftChange("phone")}
                    placeholder="Phone (optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-email">
                    Email
                  </label>
                  <Input
                    id="talent-create-email"
                    type="email"
                    value={draft.email}
                    onChange={handleDraftChange("email")}
                    placeholder="Email (optional)"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-sizing">
                  Sizing notes
                </label>
                <Input
                  id="talent-create-sizing"
                  value={draft.sizing}
                  onChange={handleDraftChange("sizing")}
                  placeholder="Sizing info (optional)"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-url">
                  Reference URL
                </label>
                <Input
                  id="talent-create-url"
                  type="url"
                  value={draft.url}
                  onChange={handleDraftChange("url")}
                  placeholder="URL (optional)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="talent-create-headshot">
                  Headshot
                </label>
                {draftPreview ? (
                  <img
                    src={draftPreview}
                    alt="Selected headshot preview"
                    className="h-40 w-32 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                    Optional 4:5 image
                  </div>
                )}
                <Input
                  id="talent-create-headshot"
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
                  {creating ? "Saving…" : "Add Talent"}
                </Button>
              </div>
            </form>
          </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Talent records are read-only for your role. Producers can add or edit talent details.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filteredTalent.map((entry) => (
          <TalentCard
            key={entry.id}
            talent={entry}
            canManage={canManage}
            onEdit={setEditTarget}
            onDelete={handleDelete}
            editDisabled={editBusy && editTarget?.id === entry.id}
            deleteDisabled={pendingDeleteId === entry.id}
          />
        ))}
        {!loading && !filteredTalent.length && (
          <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No talent matches the current filters.
            </CardContent>
          </Card>
        )}
      </div>

      {editTarget && (
        <TalentEditModal
          open={!!editTarget}
          talent={editTarget}
          busy={editBusy}
          onClose={closeEditModal}
          onSave={handleSaveTalent}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
