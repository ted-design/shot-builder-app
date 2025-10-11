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
import ExportButton from "../components/common/ExportButton";
import { searchTalent } from "../lib/search";
import BatchImageUploadModal from "../components/common/BatchImageUploadModal";
import TalentCreateModal from "../components/talent/TalentCreateModal";
import TalentEditModal from "../components/talent/TalentEditModal";
import Thumb from "../components/Thumb";
import { useAuth } from "../context/AuthContext";
import { db, deleteImageByPath, uploadImageFile } from "../lib/firebase";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { writeDoc } from "../lib/firestoreWrites";
import { toast, showConfirm } from "../lib/toast";
import { talentPath } from "../lib/paths";
import { ROLE, canManageTalent } from "../lib/rbac";
import { User, Upload } from "lucide-react";

function buildDisplayName(firstName, lastName) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unnamed talent";
}

function formatContact(info = {}) {
  return [info.phone, info.email].filter(Boolean).join(" • ");
}

function TalentCard({ talent, canManage, onEdit, editDisabled }) {
  const displayName = talent.name || buildDisplayName(talent.firstName, talent.lastName);
  const contactLine = formatContact(talent);
  const sizingLine = talent.sizing ? `Sizing: ${talent.sizing}` : "";

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Thumb
        path={talent.headshotPath || null}
        size={480}
        alt={displayName}
        className="aspect-[3/4] w-full overflow-hidden bg-slate-100"
        imageClassName="h-full w-full object-cover"
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-500">No image</div>
        }
      />
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
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>{talent.gender}</span>
            </div>
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
            <Button size="sm" variant="secondary" onClick={() => onEdit(talent)} disabled={editDisabled}>
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

function CreateTalentCard({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center transition hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
      aria-label="Create talent"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
        +
      </span>
      <span className="text-base font-semibold text-slate-900">Create talent</span>
      <span className="mt-1 max-w-[220px] text-sm text-slate-500">
        Keep track of models, contact details, and wardrobe notes.
      </span>
    </button>
  );
}

export default function TalentPage() {
  const [talent, setTalent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [batchUploadModalOpen, setBatchUploadModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [, setPendingDeleteId] = useState(null);

  const { clientId, role: globalRole, user, claims } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageTalent(role);
  const currentTalentPath = useMemo(() => talentPath(clientId), [clientId]);

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
    const term = queryText.trim();
    if (!term) return talent;

    const searchResults = searchTalent(talent, term);
    return searchResults.map((result) => result.item);
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

  const handleCreateTalent = async ({
    firstName,
    lastName,
    agency,
    phone,
    email,
    sizing,
    url,
    gender,
    headshotFile,
  }) => {
    const pathSegments = currentTalentPath;
    const targetPath = `/${pathSegments.join("/")}`;

    if (!user) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: no authenticated user", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You must be signed in to add talent.");
    }

    if (!canManage) {
      const authInfo = buildAuthDebugInfo();
      console.warn("[Talent] Create blocked: role lacks manage permission", {
        path: targetPath,
        ...authInfo,
      });
      throw new Error("You do not have permission to add talent.");
    }

    const authInfo = buildAuthDebugInfo();
    const first = (firstName || "").trim();
    const last = (lastName || "").trim();
    if (!first && !last) {
      throw new Error("Enter at least a first or last name.");
    }

    setCreating(true);
    const name = buildDisplayName(first, last);

    console.info("[Talent] Attempting to create talent", {
      path: targetPath,
      ...authInfo,
    });

    try {
      const docRef = await writeDoc("create talent", () =>
        addDoc(collection(db, ...currentTalentPath), {
          firstName: first,
          lastName: last,
          agency: agency || "",
          phone: phone || "",
          email: email || "",
          sizing: sizing || "",
          url: url || "",
          gender: gender || "",
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
      if (headshotFile) {
        try {
          const { path } = await uploadImageFile(headshotFile, { folder: "talent", id: docRef.id });
          await updateDoc(docRef, { headshotPath: path });
        } catch (error) {
          uploadError = error;
        }
      }

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
      console.error("[Talent] Failed to create talent", {
        path: targetPath,
        ...authInfo,
        code,
        message,
        error,
      });
      toast.error({
        title: "Failed to create talent",
        description: `${code}: ${message} (${targetPath})`,
      });
      throw new Error(`${message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (talentRecord, options = {}) => {
    if (!canManage) {
      setFeedback({ type: "error", text: "You do not have permission to delete talent." });
      return;
    }
    const displayName = talentRecord.name || buildDisplayName(talentRecord.firstName, talentRecord.lastName);
    if (!options?.skipPrompt) {
      const confirmed = await showConfirm(`Delete ${displayName}? This action cannot be undone.`);
      if (!confirmed) return;
    }

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

  return (
    <div className="space-y-6">
      <div className="sticky inset-x-0 top-14 z-20 bg-white/95 py-4 px-6 backdrop-blur">
        <Card className="border-b-2">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex-none text-2xl font-semibold text-slate-900">Talent</h1>
              <Input
                placeholder="Search talent by name, agency, or contact..."
                aria-label="Search talent"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                className="min-w-[200px] max-w-md flex-1"
              />
              <ExportButton data={filteredTalent} entityType="talent" />
              {canManage && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBatchUploadModalOpen(true)}
                    className="flex-none whitespace-nowrap flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Batch Upload
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="flex-none whitespace-nowrap"
                  >
                    New talent
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="px-6 text-sm text-slate-600">
        Track models, their agencies, and wardrobe notes for the active project.
      </p>

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
        <div className="mx-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Talent records are read-only for your role. Producers can add or edit talent details.
        </div>
      )}

      <div className="mx-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {canManage && (
          <CreateTalentCard onClick={() => setCreateModalOpen(true)} disabled={creating} />
        )}
        {filteredTalent.map((entry) => (
          <TalentCard
            key={entry.id}
            talent={entry}
            canManage={canManage}
            onEdit={setEditTarget}
            editDisabled={editBusy && editTarget?.id === entry.id}
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

      {canManage && (
        <TalentCreateModal
          open={createModalOpen}
          busy={creating}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateTalent}
        />
      )}

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

      {canManage && (
        <BatchImageUploadModal
          open={batchUploadModalOpen}
          onClose={() => setBatchUploadModalOpen(false)}
          folder="talent"
          entityId="batch-demo"
          entityName="Talent Headshots (Demo)"
          maxFiles={10}
          onFileUploaded={(upload) => {
            console.log("File uploaded:", upload);
            toast.success(`Uploaded ${upload.filename}`);
          }}
          onUploadComplete={(successfulUploads) => {
            console.log("All uploads complete:", successfulUploads);
            toast.success(`Successfully uploaded ${successfulUploads.length} file${successfulUploads.length === 1 ? "" : "s"}!`);
          }}
        />
      )}
    </div>
  );
}
